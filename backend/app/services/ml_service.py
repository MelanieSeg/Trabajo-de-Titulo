from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import RegressorMixin, clone
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import BayesianRidge, LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
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
    champion_models: dict[str, str]
    accuracy_pct: dict[str, float]
    predictions: list[dict[str, Any]]
    model_benchmark: dict[str, list[dict[str, Any]]]


@dataclass
class _ModelScore:
    model_name: str
    mae: float
    mape_pct: float
    r2: float
    accuracy_pct: float


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


def _build_supervised_dataset(series: np.ndarray, months_arr: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    rows: list[list[float]] = []
    targets: list[float] = []

    for idx in range(3, len(series)):
        month = float(months_arr[idx])
        lag1 = float(series[idx - 1])
        lag2 = float(series[idx - 2])
        lag3 = float(series[idx - 3])
        rolling_3 = float((lag1 + lag2 + lag3) / 3.0)
        momentum = float(lag1 - lag2)

        rows.append(
            [
                float(idx),
                month,
                float(np.sin(2 * np.pi * month / 12.0)),
                float(np.cos(2 * np.pi * month / 12.0)),
                lag1,
                lag2,
                lag3,
                rolling_3,
                momentum,
            ]
        )
        targets.append(float(series[idx]))

    if not rows:
        return np.empty((0, 9), dtype=float), np.empty((0,), dtype=float)

    return np.array(rows, dtype=float), np.array(targets, dtype=float)


def _safe_mape_pct(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    if y_true.size == 0:
        return 100.0
    denominator = np.where(np.abs(y_true) < 1.0, 1.0, np.abs(y_true))
    return float(np.mean(np.abs((y_true - y_pred) / denominator)) * 100.0)


def _score_predictions(y_true: np.ndarray, y_pred: np.ndarray) -> _ModelScore:
    mae = float(mean_absolute_error(y_true, y_pred))
    mape_pct = _safe_mape_pct(y_true, y_pred)

    try:
        r2 = float(r2_score(y_true, y_pred))
    except Exception:
        r2 = 0.0

    # Accuracy orientada a negocio: penaliza sobre todo error porcentual y acota salida.
    accuracy_pct = max(0.0, min(99.0, 100.0 - mape_pct))

    return _ModelScore(
        model_name="",
        mae=mae,
        mape_pct=mape_pct,
        r2=r2,
        accuracy_pct=accuracy_pct,
    )


def _candidate_models() -> dict[str, RegressorMixin]:
    return {
        "RandomForestRegressor": RandomForestRegressor(
            n_estimators=500,
            max_depth=14,
            min_samples_leaf=1,
            random_state=42,
        ),
        "GradientBoostingRegressor": GradientBoostingRegressor(
            n_estimators=220,
            learning_rate=0.05,
            max_depth=3,
            random_state=42,
        ),
        "KNeighborsRegressor": make_pipeline(
            StandardScaler(),
            KNeighborsRegressor(n_neighbors=3, weights="distance"),
        ),
        "BayesianRidge": make_pipeline(
            StandardScaler(),
            BayesianRidge(),
        ),
        "LinearRegression": make_pipeline(
            StandardScaler(),
            LinearRegression(),
        ),
    }


def _validate_model(model: RegressorMixin, X: np.ndarray, y: np.ndarray) -> _ModelScore:
    if len(X) < 3:
        fitted = clone(model)
        fitted.fit(X, y)
        train_pred = fitted.predict(X)
        score = _score_predictions(y, train_pred)
        return score

    # Para series cortas, usar holdout temporal estable en vez de CV.
    if len(X) < 10:
        train_end = max(2, len(X) - 2)
        fitted = clone(model)
        fitted.fit(X[:train_end], y[:train_end])
        pred = fitted.predict(X[train_end:])
        return _score_predictions(y[train_end:], np.array(pred, dtype=float))

    max_splits_from_train = max(2, len(X) // 5)
    n_splits = min(5, len(X) - 1, max_splits_from_train)
    cv = TimeSeriesSplit(n_splits=n_splits)

    y_true_chunks: list[np.ndarray] = []
    y_pred_chunks: list[np.ndarray] = []

    for train_idx, test_idx in cv.split(X):
        fold_model = clone(model)
        fold_model.fit(X[train_idx], y[train_idx])
        fold_pred = fold_model.predict(X[test_idx])
        y_true_chunks.append(y[test_idx])
        y_pred_chunks.append(np.array(fold_pred, dtype=float))

    y_true = np.concatenate(y_true_chunks)
    y_pred = np.concatenate(y_pred_chunks)
    return _score_predictions(y_true, y_pred)


def _future_feature_vector(history: list[float], future_month: int) -> np.ndarray:
    lag1 = float(history[-1])
    lag2 = float(history[-2])
    lag3 = float(history[-3])
    rolling_3 = (lag1 + lag2 + lag3) / 3.0
    momentum = lag1 - lag2

    idx = len(history)
    return np.array(
        [
            [
                float(idx),
                float(future_month),
                float(np.sin(2 * np.pi * future_month / 12.0)),
                float(np.cos(2 * np.pi * future_month / 12.0)),
                lag1,
                lag2,
                lag3,
                rolling_3,
                momentum,
            ]
        ],
        dtype=float,
    )


def _train_utility(
    *,
    utility: str,
    series: np.ndarray,
    months_arr: np.ndarray,
    horizon: int,
) -> tuple[list[float], _ModelScore, list[_ModelScore], str]:
    if len(series) < 12:
        raise ValueError("Se requieren al menos 12 meses de datos para entrenar el modelo.")

    X, y = _build_supervised_dataset(series, months_arr)
    if len(X) < 5:
        raise ValueError("No hay suficientes muestras supervisadas para entrenamiento robusto.")

    models = _candidate_models()
    benchmark: list[_ModelScore] = []

    for model_name, model in models.items():
        score = _validate_model(model, X, y)
        score.model_name = model_name
        benchmark.append(score)

    benchmark.sort(key=lambda item: (-item.accuracy_pct, item.mae, -item.r2))
    champion = benchmark[0]
    champion_model_name = champion.model_name

    # Entrenamiento final con el modelo ganador.
    champion_model = clone(models[champion_model_name])
    champion_model.fit(X, y)

    history = [float(value) for value in series.tolist()]
    predictions: list[float] = []

    last_month = int(months_arr[-1])
    for step in range(1, horizon + 1):
        future_month = ((last_month + step - 1) % 12) + 1
        features = _future_feature_vector(history, future_month)
        prediction = float(champion_model.predict(features)[0])
        prediction = max(0.0, prediction)
        predictions.append(prediction)
        history.append(prediction)

    return predictions, champion, benchmark, champion_model_name


def train_and_predict(db: Session, horizon_months: int = 3) -> TrainResult:
    df = _load_series(db)
    if df.empty:
        raise ValueError("No existen datos de consumo para entrenar el modelo ML.")

    if len(df) < 12:
        raise ValueError("Se requieren al menos 12 meses de datos consolidados para entrenamiento ML robusto.")

    months_arr = df["month"].to_numpy(dtype=float)

    elec_preds, elec_best, elec_benchmark, elec_model_name = _train_utility(
        utility="electricity",
        series=df["electricity_kwh"].to_numpy(dtype=float),
        months_arr=months_arr,
        horizon=horizon_months,
    )
    water_preds, water_best, water_benchmark, water_model_name = _train_utility(
        utility="water",
        series=df["water_m3"].to_numpy(dtype=float),
        months_arr=months_arr,
        horizon=horizon_months,
    )

    db.execute(delete(MLPrediction).where(MLPrediction.scope == "global"))

    latest_year = int(df.iloc[-1]["year"])
    latest_month = int(df.iloc[-1]["month"])

    predictions_payload: list[dict[str, Any]] = []
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
                model_name=elec_model_name,
                validation_mae=elec_best.mae,
            )
        )
        db.add(
            MLPrediction(
                scope="global",
                utility="water",
                year=y,
                month=m,
                predicted_value=w_val,
                model_name=water_model_name,
                validation_mae=water_best.mae,
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

    accuracy_map = {
        "electricity": round(elec_best.accuracy_pct, 2),
        "water": round(water_best.accuracy_pct, 2),
    }

    benchmark_payload = {
        "electricity": [
            {
                "model": item.model_name,
                "mae": round(item.mae, 4),
                "mape_pct": round(item.mape_pct, 3),
                "r2": round(item.r2, 4),
                "accuracy_pct": round(item.accuracy_pct, 3),
            }
            for item in elec_benchmark
        ],
        "water": [
            {
                "model": item.model_name,
                "mae": round(item.mae, 4),
                "mape_pct": round(item.mape_pct, 3),
                "r2": round(item.r2, 4),
                "accuracy_pct": round(item.accuracy_pct, 3),
            }
            for item in water_benchmark
        ],
    }

    champion_models = {
        "electricity": elec_model_name,
        "water": water_model_name,
    }

    log_activity(
        db,
        activity_type="ml",
        message="Modelos ML entrenados y predicciones generadas",
        metadata={
            "horizon_months": horizon_months,
            "validation_mae": {
                "electricity": round(elec_best.mae, 4),
                "water": round(water_best.mae, 4),
            },
            "accuracy_pct": accuracy_map,
            "champion_models": champion_models,
            "benchmark": benchmark_payload,
        },
    )

    db.flush()

    return TrainResult(
        trained_records=len(df),
        validation_mae={
            "electricity": round(elec_best.mae, 4),
            "water": round(water_best.mae, 4),
        },
        champion_models=champion_models,
        accuracy_pct=accuracy_map,
        predictions=predictions_payload,
        model_benchmark=benchmark_payload,
    )
