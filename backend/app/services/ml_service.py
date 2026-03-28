from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import TimeSeriesSplit
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import MLPrediction, MonthlyConsumption, SmartAlert
from app.services.activity_service import log_activity
from app.services.alert_service import get_or_create_alert_config
from app.utils.date_utils import month_label, next_month


@dataclass
class TrainResult:
    trained_records: int
    validation_mae: dict[str, float]
    predictions: list[dict]


def _load_series(db: Session) -> pd.DataFrame:
    stmt = (
        select(
            MonthlyConsumption.year,
            MonthlyConsumption.month,
            MonthlyConsumption.electricity_kwh,
            MonthlyConsumption.water_m3,
        )
        .order_by(MonthlyConsumption.year, MonthlyConsumption.month)
    )
    rows = db.execute(stmt).all()
    if not rows:
        return pd.DataFrame(columns=["year", "month", "electricity_kwh", "water_m3"])

    df = pd.DataFrame(rows, columns=["year", "month", "electricity_kwh", "water_m3"])
    grouped = (
        df.groupby(["year", "month"], as_index=False)
        .agg({"electricity_kwh": "sum", "water_m3": "sum"})
        .sort_values(["year", "month"])
        .reset_index(drop=True)
    )
    return grouped


def _train_utility(series: np.ndarray, months_arr: np.ndarray, horizon: int) -> tuple[list[float], float]:
    if len(series) < 6:
        raise ValueError("Se requieren al menos 6 meses de datos para entrenar el modelo.")

    t_idx = np.arange(len(series))
    month_sin = np.sin(2 * np.pi * months_arr / 12)
    month_cos = np.cos(2 * np.pi * months_arr / 12)

    X = np.column_stack(
        [
            t_idx[1:],
            months_arr[1:],
            month_sin[1:],
            month_cos[1:],
            series[:-1],
        ]
    )
    y = series[1:]

    model = RandomForestRegressor(
        n_estimators=250,
        random_state=42,
        min_samples_leaf=2,
    )

    if len(X) >= 5:
        splits = min(3, len(X) - 1)
        cv = TimeSeriesSplit(n_splits=splits)
        errs = []
        for train_idx, test_idx in cv.split(X):
            model.fit(X[train_idx], y[train_idx])
            pred = model.predict(X[test_idx])
            errs.append(mean_absolute_error(y[test_idx], pred))
        mae = float(np.mean(errs))
    else:
        mae = 0.0

    model.fit(X, y)

    predictions = []
    last_value = float(series[-1])
    base_t = len(series)
    last_month = int(months_arr[-1])

    for step in range(1, horizon + 1):
        future_month = ((last_month + step - 1) % 12) + 1
        features = np.array(
            [
                [
                    base_t + step,
                    future_month,
                    np.sin(2 * np.pi * future_month / 12),
                    np.cos(2 * np.pi * future_month / 12),
                    last_value,
                ]
            ]
        )
        pred = float(model.predict(features)[0])
        pred = max(pred, 0.0)
        predictions.append(pred)
        last_value = pred

    return predictions, mae


def train_and_predict(db: Session, horizon_months: int = 3) -> TrainResult:
    df = _load_series(db)
    if df.empty:
        raise ValueError("No existen datos de consumo para entrenar el modelo ML.")

    if len(df) < 6:
        raise ValueError("Se requieren al menos 6 meses de datos consolidados para entrenamiento ML.")

    months_arr = df["month"].to_numpy(dtype=float)

    elec_preds, elec_mae = _train_utility(df["electricity_kwh"].to_numpy(dtype=float), months_arr, horizon_months)
    water_preds, water_mae = _train_utility(df["water_m3"].to_numpy(dtype=float), months_arr, horizon_months)

    db.execute(delete(MLPrediction).where(MLPrediction.scope == "global"))

    latest_year = int(df.iloc[-1]["year"])
    latest_month = int(df.iloc[-1]["month"])

    predictions_payload = []
    future_dates: list[tuple[int, int]] = []
    y, m = latest_year, latest_month
    for idx in range(horizon_months):
        y, m = next_month(y, m)
        future_dates.append((y, m))

        e_val = float(elec_preds[idx])
        w_val = float(water_preds[idx])

        db.add(
            MLPrediction(
                scope="global",
                utility="electricity",
                year=y,
                month=m,
                predicted_value=e_val,
                model_name="RandomForestRegressor",
                validation_mae=elec_mae,
            )
        )
        db.add(
            MLPrediction(
                scope="global",
                utility="water",
                year=y,
                month=m,
                predicted_value=w_val,
                model_name="RandomForestRegressor",
                validation_mae=water_mae,
            )
        )

        predictions_payload.append({"utility": "electricity", "year": y, "month": m, "value": round(e_val, 2)})
        predictions_payload.append({"utility": "water", "year": y, "month": m, "value": round(w_val, 2)})

    cfg = get_or_create_alert_config(db)
    first_year, first_month = future_dates[0]

    first_e_pred = elec_preds[0]
    latest_e_actual = float(df.iloc[-1]["electricity_kwh"])
    e_change = ((first_e_pred - latest_e_actual) / max(latest_e_actual, 1.0)) * 100
    if e_change >= cfg.electricity_threshold_pct:
        db.add(
            SmartAlert(
                severity="warning" if e_change < cfg.electricity_threshold_pct * 1.4 else "critical",
                title="Predicción de alza eléctrica",
                description=f"Modelo ML proyecta +{e_change:.1f}% para {month_label(first_year, first_month)}.",
                utility="electricity",
                year=first_year,
                month=first_month,
                extra_data={"source": "ml_prediction", "change_pct": round(e_change, 2)},
            )
        )

    first_w_pred = water_preds[0]
    latest_w_actual = float(df.iloc[-1]["water_m3"])
    w_change = ((first_w_pred - latest_w_actual) / max(latest_w_actual, 1.0)) * 100
    if w_change >= cfg.water_threshold_pct:
        db.add(
            SmartAlert(
                severity="warning" if w_change < cfg.water_threshold_pct * 1.4 else "critical",
                title="Predicción de alza en agua",
                description=f"Modelo ML proyecta +{w_change:.1f}% para {month_label(first_year, first_month)}.",
                utility="water",
                year=first_year,
                month=first_month,
                extra_data={"source": "ml_prediction", "change_pct": round(w_change, 2)},
            )
        )

    log_activity(
        db,
        activity_type="ml",
        message="Modelo ML entrenado y predicciones generadas",
        metadata={
            "horizon_months": horizon_months,
            "validation_mae": {
                "electricity": round(elec_mae, 2),
                "water": round(water_mae, 2),
            },
        },
    )

    db.flush()

    return TrainResult(
        trained_records=len(df),
        validation_mae={"electricity": round(elec_mae, 2), "water": round(water_mae, 2)},
        predictions=predictions_payload,
    )
