from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    ActivityLog,
    AreaDistribution,
    EfficiencyTarget,
    MLPrediction,
    MonthlyConsumption,
    SmartAlert,
)
from app.schemas.api import (
    ActivityItem,
    AlertItem,
    DashboardSummaryResponse,
    DistributionItem,
    EfficiencyItem,
    EfficiencyResponse,
    SummaryMetric,
    TimeseriesPoint,
)
from app.utils.date_utils import month_key, month_label


def _monthly_aggregates(db: Session) -> list[dict[str, Any]]:
    stmt = (
        select(
            MonthlyConsumption.year.label("year"),
            MonthlyConsumption.month.label("month"),
            func.sum(MonthlyConsumption.electricity_kwh).label("electricity_kwh"),
            func.sum(MonthlyConsumption.water_m3).label("water_m3"),
            func.sum(MonthlyConsumption.electricity_cost_usd + MonthlyConsumption.water_cost_usd).label("total_cost_usd"),
            func.sum(MonthlyConsumption.co2_avoided_ton).label("co2_avoided_ton"),
        )
        .group_by(MonthlyConsumption.year, MonthlyConsumption.month)
        .order_by(MonthlyConsumption.year, MonthlyConsumption.month)
    )
    rows = db.execute(stmt).all()
    return [dict(r._mapping) for r in rows]


def get_summary(db: Session) -> DashboardSummaryResponse:
    data = _monthly_aggregates(db)
    if not data:
        return DashboardSummaryResponse(
            latest_month_label="Sin datos",
            metrics=[
                SummaryMetric(title="Electricidad", value=0, unit="kWh", change_pct=0),
                SummaryMetric(title="Agua", value=0, unit="m³", change_pct=0),
                SummaryMetric(title="Costo Total", value=0, unit="USD", change_pct=0),
                SummaryMetric(title="CO₂ Evitado", value=0, unit="Ton", change_pct=0),
            ],
            open_alerts=0,
        )

    latest = data[-1]
    previous = data[-2] if len(data) > 1 else None

    def pct_change(current: float, prev: float | None) -> float:
        if prev is None or prev == 0:
            return 0.0
        return ((current - prev) / prev) * 100

    metrics = [
        SummaryMetric(
            title="Electricidad",
            value=round(latest["electricity_kwh"], 2),
            unit="kWh",
            change_pct=round(pct_change(latest["electricity_kwh"], previous["electricity_kwh"] if previous else None), 2),
        ),
        SummaryMetric(
            title="Agua",
            value=round(latest["water_m3"], 2),
            unit="m³",
            change_pct=round(pct_change(latest["water_m3"], previous["water_m3"] if previous else None), 2),
        ),
        SummaryMetric(
            title="Costo Total",
            value=round(latest["total_cost_usd"], 2),
            unit="USD",
            change_pct=round(pct_change(latest["total_cost_usd"], previous["total_cost_usd"] if previous else None), 2),
        ),
        SummaryMetric(
            title="CO₂ Evitado",
            value=round(latest["co2_avoided_ton"], 2),
            unit="Ton",
            change_pct=round(pct_change(latest["co2_avoided_ton"], previous["co2_avoided_ton"] if previous else None), 2),
        ),
    ]

    open_alerts = db.scalar(select(func.count()).select_from(SmartAlert).where(SmartAlert.is_resolved.is_(False))) or 0

    return DashboardSummaryResponse(
        latest_month_label=month_label(latest["year"], latest["month"]),
        metrics=metrics,
        open_alerts=int(open_alerts),
    )


def get_timeseries(db: Session, months: int = 12) -> list[TimeseriesPoint]:
    monthly = _monthly_aggregates(db)

    pred_stmt = (
        select(MLPrediction.year, MLPrediction.month, MLPrediction.utility, MLPrediction.predicted_value)
        .where(MLPrediction.scope == "global")
        .order_by(MLPrediction.year, MLPrediction.month)
    )
    pred_rows = db.execute(pred_stmt).all()

    combined: dict[int, dict[str, Any]] = {}

    for row in monthly:
        k = month_key(row["year"], row["month"])
        combined[k] = {
            "year": row["year"],
            "month": row["month"],
            "label": month_label(row["year"], row["month"]),
            "electricity_kwh": float(row["electricity_kwh"]),
            "water_m3": float(row["water_m3"]),
            "predicted_electricity_kwh": None,
            "predicted_water_m3": None,
        }

    for pred in pred_rows:
        k = month_key(pred.year, pred.month)
        if k not in combined:
            combined[k] = {
                "year": pred.year,
                "month": pred.month,
                "label": month_label(pred.year, pred.month),
                "electricity_kwh": None,
                "water_m3": None,
                "predicted_electricity_kwh": None,
                "predicted_water_m3": None,
            }
        field = "predicted_electricity_kwh" if pred.utility == "electricity" else "predicted_water_m3"
        combined[k][field] = float(pred.predicted_value)

    sorted_keys = sorted(combined.keys())
    if len(sorted_keys) > months + 3:
        sorted_keys = sorted_keys[-(months + 3) :]

    return [TimeseriesPoint(**combined[k]) for k in sorted_keys]


def get_distribution(db: Session) -> list[DistributionItem]:
    latest_stmt = select(MonthlyConsumption.year, MonthlyConsumption.month).order_by(
        MonthlyConsumption.year.desc(),
        MonthlyConsumption.month.desc(),
    )
    latest = db.execute(latest_stmt).first()
    if not latest:
        return []

    stmt = (
        select(AreaDistribution.area_name, func.avg(AreaDistribution.percentage).label("value"))
        .join(MonthlyConsumption, MonthlyConsumption.id == AreaDistribution.monthly_consumption_id)
        .where(
            MonthlyConsumption.year == latest.year,
            MonthlyConsumption.month == latest.month,
        )
        .group_by(AreaDistribution.area_name)
        .order_by(func.avg(AreaDistribution.percentage).desc())
    )
    rows = db.execute(stmt).all()

    return [DistributionItem(name=r.area_name, value=round(float(r.value), 2)) for r in rows]


def get_alerts(db: Session, limit: int = 4) -> list[AlertItem]:
    stmt = (
        select(SmartAlert)
        .where(SmartAlert.is_resolved.is_(False))
        .order_by(SmartAlert.created_at.desc())
        .limit(limit)
    )
    alerts = db.scalars(stmt).all()
    return [
        AlertItem(
            id=a.id,
            severity=a.severity if a.severity in {"critical", "warning", "info"} else "info",
            title=a.title,
            description=a.description,
            utility=a.utility,
            year=a.year,
            month=a.month,
            created_at=a.created_at,
        )
        for a in alerts
    ]


def get_recent_activity(db: Session, limit: int = 5) -> list[ActivityItem]:
    stmt = select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit)
    rows = db.scalars(stmt).all()
    return [
        ActivityItem(
            id=r.id,
            activity_type=r.activity_type,
            message=r.message,
            created_at=r.created_at,
            metadata=r.extra_data or {},
        )
        for r in rows
    ]


def _target_map(db: Session) -> dict[str, float]:
    rows = db.scalars(select(EfficiencyTarget)).all()
    return {r.metric_name: r.target_value for r in rows}


def get_efficiency(db: Session) -> EfficiencyResponse:
    monthly = _monthly_aggregates(db)
    if not monthly:
        return EfficiencyResponse(score=0, items=[])

    latest = monthly[-1]
    targets = _target_map(db)

    electricity_target = targets.get("electricity_kwh", max(1.0, latest["electricity_kwh"] * 0.9))
    water_target = targets.get("water_m3", max(1.0, latest["water_m3"] * 0.9))
    co2_target = targets.get("co2_avoided_ton", max(0.1, latest["co2_avoided_ton"] * 1.1))

    electricity_score = min(100.0, max(0.0, (electricity_target / max(1.0, latest["electricity_kwh"])) * 100))
    water_score = min(100.0, max(0.0, (water_target / max(1.0, latest["water_m3"])) * 100))
    co2_score = min(100.0, max(0.0, (latest["co2_avoided_ton"] / max(0.1, co2_target)) * 100))

    overall_score = round((electricity_score + water_score + co2_score) / 3, 1)

    items = [
        EfficiencyItem(label="Electricidad", value=round(electricity_score, 1), target=85),
        EfficiencyItem(label="Agua", value=round(water_score, 1), target=90),
        EfficiencyItem(label="Huella de Carbono", value=round(co2_score, 1), target=80),
        EfficiencyItem(label="Eficiencia General", value=overall_score, target=85),
    ]

    return EfficiencyResponse(score=overall_score, items=items)


def get_report_for_latest_month(db: Session) -> dict[str, Any]:
    monthly = _monthly_aggregates(db)
    if not monthly:
        return {
            "month_label": "Sin datos",
            "total_electricity_kwh": 0.0,
            "total_water_m3": 0.0,
            "total_cost_usd": 0.0,
            "highlights": ["No hay registros cargados."],
        }

    latest = monthly[-1]
    previous = monthly[-2] if len(monthly) > 1 else None

    highlights = []
    if previous:
        elec_change = ((latest["electricity_kwh"] - previous["electricity_kwh"]) / max(previous["electricity_kwh"], 1)) * 100
        water_change = ((latest["water_m3"] - previous["water_m3"]) / max(previous["water_m3"], 1)) * 100
        if elec_change > 0:
            highlights.append(f"Consumo eléctrico subió {elec_change:.1f}% respecto al mes anterior.")
        else:
            highlights.append(f"Consumo eléctrico bajó {abs(elec_change):.1f}% respecto al mes anterior.")

        if water_change > 0:
            highlights.append(f"Consumo de agua subió {water_change:.1f}% respecto al mes anterior.")
        else:
            highlights.append(f"Consumo de agua bajó {abs(water_change):.1f}% respecto al mes anterior.")

    alerts_count = db.scalar(select(func.count()).select_from(SmartAlert).where(SmartAlert.is_resolved.is_(False))) or 0
    highlights.append(f"Hay {alerts_count} alertas activas para seguimiento.")

    return {
        "month_label": month_label(latest["year"], latest["month"]),
        "total_electricity_kwh": round(latest["electricity_kwh"], 2),
        "total_water_m3": round(latest["water_m3"], 2),
        "total_cost_usd": round(latest["total_cost_usd"], 2),
        "highlights": highlights,
    }


def export_consumption_csv(db: Session) -> str:
    stmt = (
        select(
            MonthlyConsumption.year,
            MonthlyConsumption.month,
            func.sum(MonthlyConsumption.electricity_kwh).label("electricity_kwh"),
            func.sum(MonthlyConsumption.water_m3).label("water_m3"),
            func.sum(MonthlyConsumption.electricity_cost_usd + MonthlyConsumption.water_cost_usd).label("total_cost_usd"),
        )
        .group_by(MonthlyConsumption.year, MonthlyConsumption.month)
        .order_by(MonthlyConsumption.year, MonthlyConsumption.month)
    )
    rows = db.execute(stmt).all()

    lines = ["year,month,electricity_kwh,water_m3,total_cost_usd"]
    for r in rows:
        lines.append(f"{r.year},{r.month},{float(r.electricity_kwh):.2f},{float(r.water_m3):.2f},{float(r.total_cost_usd):.2f}")

    return "\n".join(lines)


def month_breakdown(db: Session) -> dict[tuple[int, int], dict[str, float]]:
    """Devuelve búsqueda rápida para verificaciones de variación mes a mes."""
    stmt = (
        select(
            MonthlyConsumption.year,
            MonthlyConsumption.month,
            func.sum(MonthlyConsumption.electricity_kwh).label("electricity_kwh"),
            func.sum(MonthlyConsumption.water_m3).label("water_m3"),
        )
        .group_by(MonthlyConsumption.year, MonthlyConsumption.month)
        .order_by(MonthlyConsumption.year, MonthlyConsumption.month)
    )
    result: dict[tuple[int, int], dict[str, float]] = defaultdict(dict)
    for r in db.execute(stmt).all():
        result[(r.year, r.month)] = {
            "electricity_kwh": float(r.electricity_kwh),
            "water_m3": float(r.water_m3),
        }
    return result
