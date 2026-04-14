from __future__ import annotations

from calendar import monthrange
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.models import (
    ActivityLog,
    AlertConfig,
    AreaDistribution,
    Company,
    CustomMetric,
    ETLJob,
    ETLSchedule,
    EfficiencyTarget,
    Facility,
    MLPrediction,
    MonthlyConsumption,
    SmartAlert,
    User,
)
from app.services.activity_service import log_activity
from app.services.alert_service import get_or_create_alert_config, regenerate_anomaly_alerts
from app.services.dashboard_service import get_distribution, get_efficiency, get_summary, get_timeseries
from app.utils.date_utils import month_label


def _safe_float(value: Any) -> float:
    if value is None:
        return 0.0
    return float(value)


def _pct_change(current: float, previous: float) -> float:
    if previous == 0:
        return 0.0
    return ((current - previous) / previous) * 100


def _trend(change_pct: float) -> str:
    if change_pct > 0.8:
        return "up"
    if change_pct < -0.8:
        return "down"
    return "stable"


def _status_from_progress(progress_pct: float) -> str:
    if progress_pct >= 100:
        return "good"
    if progress_pct >= 80:
        return "warning"
    return "critical"


def _monthly_aggregates(db: Session, months: int = 12) -> list[dict[str, Any]]:
    stmt = (
        select(
            MonthlyConsumption.year.label("year"),
            MonthlyConsumption.month.label("month"),
            func.sum(MonthlyConsumption.electricity_kwh).label("electricity_kwh"),
            func.sum(MonthlyConsumption.water_m3).label("water_m3"),
            func.sum(MonthlyConsumption.electricity_cost_usd).label("electricity_cost_usd"),
            func.sum(MonthlyConsumption.water_cost_usd).label("water_cost_usd"),
            func.sum(MonthlyConsumption.electricity_cost_usd + MonthlyConsumption.water_cost_usd).label("total_cost_usd"),
            func.sum(MonthlyConsumption.co2_avoided_ton).label("co2_avoided_ton"),
        )
        .group_by(MonthlyConsumption.year, MonthlyConsumption.month)
        .order_by(MonthlyConsumption.year, MonthlyConsumption.month)
    )

    rows = db.execute(stmt).all()
    result = []

    # Limitar a los últimos N meses
    if len(rows) > months:
        rows = rows[-months:]

    for row in rows:
        result.append(
            {
                "year": int(row.year),
                "month": int(row.month),
                "label": month_label(int(row.year), int(row.month)),
                "electricity_kwh": round(_safe_float(row.electricity_kwh), 2),
                "water_m3": round(_safe_float(row.water_m3), 2),
                "electricity_cost_usd": round(_safe_float(row.electricity_cost_usd), 2),
                "water_cost_usd": round(_safe_float(row.water_cost_usd), 2),
                "total_cost_usd": round(_safe_float(row.total_cost_usd), 2),
                "co2_avoided_ton": round(_safe_float(row.co2_avoided_ton), 2),
            }
        )
    return result


def _latest_pair(monthly: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not monthly:
        return None, None
    latest = monthly[-1]
    previous = monthly[-2] if len(monthly) > 1 else None
    return latest, previous


def _target_map(db: Session) -> dict[str, float]:
    targets = db.scalars(select(EfficiencyTarget)).all()
    return {target.metric_name: float(target.target_value) for target in targets}


def _latest_area_breakdown(db: Session, year: int, month: int) -> list[dict[str, Any]]:
    stmt = (
        select(
            AreaDistribution.area_name.label("area_name"),
            func.avg(AreaDistribution.percentage).label("percentage"),
            func.sum(MonthlyConsumption.electricity_kwh * AreaDistribution.percentage / 100.0).label("electricity_kwh"),
            func.sum(MonthlyConsumption.water_m3 * AreaDistribution.percentage / 100.0).label("water_m3"),
        )
        .join(MonthlyConsumption, MonthlyConsumption.id == AreaDistribution.monthly_consumption_id)
        .where(MonthlyConsumption.year == year, MonthlyConsumption.month == month)
        .group_by(AreaDistribution.area_name)
        .order_by(func.avg(AreaDistribution.percentage).desc())
    )

    rows = db.execute(stmt).all()
    return [
        {
            "area": row.area_name,
            "percentage": round(_safe_float(row.percentage), 2),
            "electricity_kwh": round(_safe_float(row.electricity_kwh), 2),
            "water_m3": round(_safe_float(row.water_m3), 2),
        }
        for row in rows
    ]


def _build_utility_section(
    utility_name: str,
    monthly: list[dict[str, Any]],
    targets: dict[str, float],
    area_breakdown: list[dict[str, Any]],
) -> dict[str, Any]:
    latest, previous = _latest_pair(monthly)
    if not latest:
        unit = "kWh" if utility_name == "electricity" else "m³"
        return {
            "cards": [
                {"label": "Consumo Actual", "value": 0.0, "unit": unit, "change_pct": 0.0},
                {"label": "Costo Mensual", "value": 0.0, "unit": "USD", "change_pct": 0.0},
                {"label": "Cumplimiento Meta", "value": 0.0, "unit": "%", "change_pct": 0.0},
            ],
            "monthly": [],
            "areas": [],
        }

    if utility_name == "electricity":
        consumption_field = "electricity_kwh"
        cost_field = "electricity_cost_usd"
        target_value = targets.get("electricity_kwh", latest[consumption_field] * 0.95)
        area_items = [
            {
                "area": item["area"],
                "consumo": item["electricity_kwh"],
                "percentage": item["percentage"],
            }
            for item in area_breakdown
        ]
        unit = "kWh"
    else:
        consumption_field = "water_m3"
        cost_field = "water_cost_usd"
        target_value = targets.get("water_m3", latest[consumption_field] * 0.95)
        area_items = [
            {
                "area": item["area"],
                "consumo": item["water_m3"],
                "percentage": item["percentage"],
            }
            for item in area_breakdown
        ]
        unit = "m³"

    previous_consumption = previous[consumption_field] if previous else latest[consumption_field]
    previous_cost = previous[cost_field] if previous else latest[cost_field]

    change_pct = round(_pct_change(latest[consumption_field], previous_consumption), 2)
    cost_change_pct = round(_pct_change(latest[cost_field], previous_cost), 2)
    target_progress = 0.0
    if latest[consumption_field] > 0:
        target_progress = min(150.0, (target_value / latest[consumption_field]) * 100)

    return {
        "cards": [
            {
                "label": "Consumo Actual",
                "value": round(latest[consumption_field], 2),
                "unit": unit,
                "change_pct": change_pct,
            },
            {
                "label": "Costo Mensual",
                "value": round(latest[cost_field], 2),
                "unit": "USD",
                "change_pct": cost_change_pct,
            },
            {
                "label": "Cumplimiento Meta",
                "value": round(target_progress, 1),
                "unit": "%",
                "change_pct": round(target_value - latest[consumption_field], 2),
            },
        ],
        "monthly": [
            {
                "mes": row["label"],
                "consumo": row[consumption_field],
                "costo": row[cost_field],
            }
            for row in monthly[-12:]
        ],
        "areas": area_items,
    }


def _build_metric_cards(efficiency_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cards = []
    for item in efficiency_items:
        value = round(_safe_float(item.get("value", 0)), 1)
        target = round(_safe_float(item.get("target", 0)), 1)
        cards.append(
            {
                "label": item.get("label", "Métrica"),
                "value": value,
                "target": target,
                "status": _status_from_progress(value),
            }
        )
    return cards


def _build_kpis(monthly: list[dict[str, Any]], targets: dict[str, float]) -> list[dict[str, Any]]:
    latest, previous = _latest_pair(monthly)
    if not latest:
        return []

    previous = previous or latest

    electricity_target = targets.get("electricity_kwh", latest["electricity_kwh"] * 0.95)
    water_target = targets.get("water_m3", latest["water_m3"] * 0.95)
    co2_target = targets.get("co2_avoided_ton", max(0.1, latest["co2_avoided_ton"] * 0.9))

    entries = [
        {
            "name": "kWh mensual",
            "value": round(latest["electricity_kwh"], 2),
            "target": round(electricity_target, 2),
            "unit": "kWh",
            "progress": min(150.0, (electricity_target / max(latest["electricity_kwh"], 1.0)) * 100),
            "trend": _trend(_pct_change(latest["electricity_kwh"], previous["electricity_kwh"])),
        },
        {
            "name": "m³ mensual",
            "value": round(latest["water_m3"], 2),
            "target": round(water_target, 2),
            "unit": "m³",
            "progress": min(150.0, (water_target / max(latest["water_m3"], 1.0)) * 100),
            "trend": _trend(_pct_change(latest["water_m3"], previous["water_m3"])),
        },
        {
            "name": "Costo Total Mensual",
            "value": round(latest["total_cost_usd"], 2),
            "target": round((electricity_target + water_target) * 0.8, 2),
            "unit": "USD",
            "progress": min(150.0, ((electricity_target + water_target) * 0.8 / max(latest["total_cost_usd"], 1.0)) * 100),
            "trend": _trend(_pct_change(latest["total_cost_usd"], previous["total_cost_usd"])),
        },
        {
            "name": "CO₂ Evitado",
            "value": round(latest["co2_avoided_ton"], 2),
            "target": round(co2_target, 2),
            "unit": "Ton",
            "progress": min(150.0, (latest["co2_avoided_ton"] / max(co2_target, 0.1)) * 100),
            "trend": _trend(_pct_change(latest["co2_avoided_ton"], previous["co2_avoided_ton"])),
        },
    ]

    for entry in entries:
        entry["status"] = _status_from_progress(entry["progress"])

    return entries


def _build_map_data(db: Session, year: int, month: int) -> list[dict[str, Any]]:
    stmt = (
        select(
            Facility.id,
            Facility.name,
            Facility.region,
            func.sum(MonthlyConsumption.electricity_kwh).label("electricity_kwh"),
            func.sum(MonthlyConsumption.water_m3).label("water_m3"),
        )
        .join(MonthlyConsumption, MonthlyConsumption.facility_id == Facility.id)
        .where(MonthlyConsumption.year == year, MonthlyConsumption.month == month)
        .group_by(Facility.id, Facility.name, Facility.region)
        .order_by(func.sum(MonthlyConsumption.electricity_kwh).desc())
    )

    rows = db.execute(stmt).all()
    if not rows:
        return []

    avg_electricity = sum(_safe_float(row.electricity_kwh) for row in rows) / len(rows)
    avg_water = sum(_safe_float(row.water_m3) for row in rows) / len(rows)

    zones = []
    for row in rows:
        elec = _safe_float(row.electricity_kwh)
        water = _safe_float(row.water_m3)

        if elec > avg_electricity * 1.15 or water > avg_water * 1.15:
            status = "Alto consumo"
            color = "destructive"
        elif elec < avg_electricity * 0.85 and water < avg_water * 0.85:
            status = "Bajo consumo"
            color = "default"
        else:
            status = "Normal"
            color = "secondary"

        zones.append(
            {
                "id": row.id,
                "name": row.name,
                "region": row.region,
                "electricity": round(elec, 2),
                "water": round(water, 2),
                "status": status,
                "color": color,
            }
        )

    return zones


def _build_prediction_section(db: Session, monthly: list[dict[str, Any]]) -> dict[str, Any]:
    series = get_timeseries(db, months=12)
    series_payload = [
        {
            "mes": item.label,
            "electricidad_real": item.electricity_kwh,
            "agua_real": item.water_m3,
            "electricidad_pred": item.predicted_electricity_kwh,
            "agua_pred": item.predicted_water_m3,
        }
        for item in series
    ]

    latest, _ = _latest_pair(monthly)
    latest_electricity = latest["electricity_kwh"] if latest else 0.0
    latest_water = latest["water_m3"] if latest else 0.0
    latest_total_cost = latest["total_cost_usd"] if latest else 0.0

    pred_rows = db.execute(
        select(MLPrediction.utility, MLPrediction.predicted_value, MLPrediction.validation_mae)
        .where(MLPrediction.scope == "global")
        .order_by(MLPrediction.year, MLPrediction.month)
    ).all()

    mae_electricity = 0.0
    mae_water = 0.0
    first_electricity_pred = None
    first_water_pred = None

    for row in pred_rows:
        if row.utility == "electricity":
            mae_electricity = _safe_float(row.validation_mae)
            if first_electricity_pred is None:
                first_electricity_pred = _safe_float(row.predicted_value)
        if row.utility == "water":
            mae_water = _safe_float(row.validation_mae)
            if first_water_pred is None:
                first_water_pred = _safe_float(row.predicted_value)

    baseline = max((latest_electricity + latest_water) / 2.0, 1.0)
    avg_mae = (mae_electricity + mae_water) / 2.0
    accuracy = max(0.0, min(100.0, 100.0 - (avg_mae / baseline) * 100.0))

    projected_savings = 0.0
    if first_electricity_pred is not None and first_water_pred is not None and latest:
        predicted_total_units = first_electricity_pred + first_water_pred
        actual_total_units = latest_electricity + latest_water
        if actual_total_units > 0:
            unit_cost = latest_total_cost / actual_total_units
            projected_cost = predicted_total_units * unit_cost
            projected_savings = max(0.0, latest_total_cost - projected_cost)

    unresolved_anomalies = db.scalar(
        select(func.count()).select_from(SmartAlert).where(SmartAlert.is_resolved.is_(False))
    )
    anomaly_count = int(unresolved_anomalies or 0)

    recommendations = [
        {
            "text": "Programar cargas eléctricas intensivas fuera de la hora punta.",
            "type": "high" if anomaly_count >= 3 else "medium",
        },
        {
            "text": "Revisar consumos en áreas con crecimiento sostenido en los últimos 3 meses.",
            "type": "medium",
        },
        {
            "text": "Actualizar modelo ML después de cada carga ETL para mantener precisión.",
            "type": "low",
        },
    ]

    return {
        "accuracy_pct": round(accuracy, 2),
        "projected_savings_usd": round(projected_savings, 2),
        "anomaly_count": anomaly_count,
        "series": series_payload,
        "recommendations": recommendations,
    }


def _build_trends(monthly: list[dict[str, Any]]) -> dict[str, Any]:
    history = monthly[-12:]
    if not history:
        return {
            "series": [],
            "electricity_change_pct": 0.0,
            "water_change_pct": 0.0,
            "insights": [],
        }

    first = history[0]
    last = history[-1]
    elec_change = _pct_change(last["electricity_kwh"], max(first["electricity_kwh"], 1.0))
    water_change = _pct_change(last["water_m3"], max(first["water_m3"], 1.0))

    insights = [
        f"Electricidad: variación de {elec_change:+.1f}% en el período analizado.",
        f"Agua: variación de {water_change:+.1f}% en el período analizado.",
    ]

    return {
        "series": [
            {
                "mes": row["label"],
                "electricidad": row["electricity_kwh"],
                "agua": row["water_m3"],
            }
            for row in history
        ],
        "electricity_change_pct": round(elec_change, 2),
        "water_change_pct": round(water_change, 2),
        "insights": insights,
    }


def _build_anomalies(db: Session) -> dict[str, Any]:
    rows = db.scalars(select(SmartAlert).order_by(SmartAlert.created_at.desc()).limit(40)).all()

    critical_count = len([a for a in rows if (not a.is_resolved) and a.severity == "critical"])
    warning_count = len([a for a in rows if (not a.is_resolved) and a.severity == "warning"])
    resolved_count = len([a for a in rows if a.is_resolved])

    items = []
    for alert in rows:
        meta = alert.extra_data or {}
        if isinstance(meta, dict) and "change_pct" in meta:
            value = f"{_safe_float(meta.get('change_pct')):+.1f}% vs referencia"
        else:
            value = alert.description[:80]

        status = "Resuelta" if alert.is_resolved else "Abierta"
        area = "Sistema"
        if alert.utility == "electricity":
            area = "Consumo eléctrico"
        elif alert.utility == "water":
            area = "Consumo de agua"

        items.append(
            {
                "id": alert.id,
                "date": alert.created_at.date().isoformat() if alert.created_at else None,
                "type": alert.title,
                "area": area,
                "severity": alert.severity,
                "value": value,
                "status": status,
                "description": alert.description,
            }
        )

    return {
        "critical": critical_count,
        "warning": warning_count,
        "resolved": resolved_count,
        "items": items,
    }


def _build_comparisons(monthly: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not monthly:
        return []

    buckets: dict[tuple[int, int], dict[str, float]] = {}
    for row in monthly:
        year = int(row["year"])
        quarter = ((int(row["month"]) - 1) // 3) + 1
        key = (year, quarter)
        if key not in buckets:
            buckets[key] = {
                "electricity": 0.0,
                "water": 0.0,
            }
        buckets[key]["electricity"] += _safe_float(row["electricity_kwh"])
        buckets[key]["water"] += _safe_float(row["water_m3"])

    payload = []
    for (year, quarter) in sorted(buckets.keys()):
        data = buckets[(year, quarter)]
        payload.append(
            {
                "periodo": f"Q{quarter} {year}",
                "electricidad": round(data["electricity"], 2),
                "agua": round(data["water"], 2),
            }
        )

    return payload[-8:]


def _build_goals(db: Session, monthly: list[dict[str, Any]]) -> list[dict[str, Any]]:
    latest, _ = _latest_pair(monthly)
    latest_map = {
        "electricity_kwh": _safe_float(latest["electricity_kwh"]) if latest else 0.0,
        "water_m3": _safe_float(latest["water_m3"]) if latest else 0.0,
        "co2_avoided_ton": _safe_float(latest["co2_avoided_ton"]) if latest else 0.0,
        "total_cost_usd": _safe_float(latest["total_cost_usd"]) if latest else 0.0,
    }

    goals: list[dict[str, Any]] = []

    targets = db.scalars(select(EfficiencyTarget).order_by(EfficiencyTarget.created_at.desc())).all()
    for target in targets:
        current = latest_map.get(target.metric_name, 0.0)
        lower_is_better = target.metric_name in {"electricity_kwh", "water_m3", "total_cost_usd"}

        if lower_is_better:
            progress = min(150.0, (target.target_value / max(current, 1.0)) * 100)
        else:
            progress = min(150.0, (current / max(target.target_value, 0.1)) * 100)

        status = "Completado" if progress >= 100 else "En progreso" if progress >= 75 else "En riesgo"

        goals.append(
            {
                "id": target.id,
                "name": target.metric_name,
                "target": round(_safe_float(target.target_value), 2),
                "current": round(current, 2),
                "unit": target.unit,
                "progress": round(progress, 1),
                "deadline": target.end_date.isoformat() if target.end_date else None,
                "status": status,
            }
        )

    custom_metrics = db.scalars(select(CustomMetric).order_by(CustomMetric.created_at.desc()).limit(10)).all()
    for metric in custom_metrics:
        progress = min(150.0, (_safe_float(metric.target_value) / max(_safe_float(metric.current_value), 1.0)) * 100)
        status = "Completado" if progress >= 100 else "En progreso" if progress >= 75 else "En riesgo"
        goals.append(
            {
                "id": f"custom-{metric.id}",
                "name": metric.name,
                "target": round(_safe_float(metric.target_value), 2),
                "current": round(_safe_float(metric.current_value), 2),
                "unit": metric.unit,
                "progress": round(progress, 1),
                "deadline": None,
                "status": status,
            }
        )

    return goals


def _build_uploads(db: Session) -> list[dict[str, Any]]:
    rows = db.scalars(select(ETLJob).order_by(ETLJob.finished_at.desc()).limit(10)).all()
    return [
        {
            "id": row.id,
            "name": row.source_filename,
            "date": row.finished_at.date().isoformat() if row.finished_at else None,
            "rows_processed": row.rows_processed,
            "rows_rejected": row.rows_rejected,
            "status": row.status,
        }
        for row in rows
    ]


def _build_reports(monthly: list[dict[str, Any]]) -> list[dict[str, Any]]:
    payload = []
    for idx, row in enumerate(reversed(monthly[-12:]), start=1):
        estimated_size_mb = max(0.2, (row["electricity_kwh"] + row["water_m3"]) / 15000)
        payload.append(
            {
                "id": idx,
                "name": f"Reporte Mensual — {row['label']}",
                "type": "PDF",
                "date": f"{row['year']}-{int(row['month']):02d}-01",
                "size": f"{estimated_size_mb:.1f} MB",
                "month_label": row["label"],
                "total_cost_usd": row["total_cost_usd"],
            }
        )
    return payload


def _build_database_status(db: Session) -> dict[str, Any]:
    tables: list[dict[str, Any]] = []
    storage_mb = 0.0

    try:
        storage_bytes = db.execute(text("SELECT pg_database_size(current_database())")).scalar_one()
        storage_mb = round(_safe_float(storage_bytes) / (1024 * 1024), 2)

        rows = db.execute(
            text(
                """
                SELECT
                    s.relname AS table_name,
                    COALESCE(s.n_live_tup, 0) AS row_count,
                    pg_total_relation_size(s.relid) AS size_bytes
                FROM pg_stat_user_tables s
                ORDER BY pg_total_relation_size(s.relid) DESC
                LIMIT 20
                """
            )
        ).all()

        for row in rows:
            size_mb = round(_safe_float(row.size_bytes) / (1024 * 1024), 2)
            tables.append(
                {
                    "name": row.table_name,
                    "rows": int(_safe_float(row.row_count)),
                    "size": f"{size_mb} MB",
                    "status": "active",
                }
            )
    except Exception:
        model_counts = [
            ("monthly_consumptions", db.scalar(select(func.count()).select_from(MonthlyConsumption)) or 0),
            ("ml_predictions", db.scalar(select(func.count()).select_from(MLPrediction)) or 0),
            ("smart_alerts", db.scalar(select(func.count()).select_from(SmartAlert)) or 0),
            ("app_users", db.scalar(select(func.count()).select_from(User)) or 0),
            ("etl_jobs", db.scalar(select(func.count()).select_from(ETLJob)) or 0),
        ]
        for name, count in model_counts:
            tables.append(
                {
                    "name": name,
                    "rows": int(count),
                    "size": "N/D",
                    "status": "active",
                }
            )

    return {
        "storage_mb": storage_mb,
        "tables_active": len(tables),
        "uptime_pct": 99.9,
        "tables": tables,
    }


def _next_etl_run(cron_expression: str, now: datetime) -> datetime:
    parts = cron_expression.split()
    if len(parts) != 5:
        return now + timedelta(days=1)

    minute_s, hour_s, day_s, month_s, weekday_s = parts
    if not (minute_s.isdigit() and hour_s.isdigit()):
        return now + timedelta(days=1)

    minute = int(minute_s)
    hour = int(hour_s)

    if day_s.isdigit() and month_s == "*" and weekday_s == "*":
        day = int(day_s)
        current_last_day = monthrange(now.year, now.month)[1]
        candidate = now.replace(
            day=min(day, current_last_day),
            hour=hour,
            minute=minute,
            second=0,
            microsecond=0,
        )
        if candidate <= now:
            year = now.year + 1 if now.month == 12 else now.year
            month = 1 if now.month == 12 else now.month + 1
            next_last_day = monthrange(year, month)[1]
            candidate = candidate.replace(year=year, month=month, day=min(day, next_last_day))
        return candidate

    if day_s == "*" and month_s == "*" and weekday_s == "*":
        candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= now:
            candidate += timedelta(days=1)
        return candidate

    return now + timedelta(days=1)


def _build_calendar(db: Session, goals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    events: list[dict[str, Any]] = []

    schedule = db.get(ETLSchedule, 1)
    cron_expression = schedule.cron_expression if schedule else "0 6 1 * *"
    next_run = _next_etl_run(cron_expression, now)
    events.append(
        {
            "id": "etl-next",
            "date": next_run.date().isoformat(),
            "title": "Próxima ejecución ETL",
            "type": "ETL",
        }
    )

    report_due = (now + timedelta(days=15)).date().isoformat()
    events.append(
        {
            "id": "monthly-report",
            "date": report_due,
            "title": "Revisión de reporte mensual",
            "type": "Reporte",
        }
    )

    open_alerts = db.scalars(
        select(SmartAlert)
        .where(SmartAlert.is_resolved.is_(False))
        .order_by(SmartAlert.created_at.desc())
        .limit(6)
    ).all()
    for alert in open_alerts:
        event_date = (alert.created_at + timedelta(days=1)).date().isoformat() if alert.created_at else now.date().isoformat()
        events.append(
            {
                "id": f"alert-{alert.id}",
                "date": event_date,
                "title": f"Seguimiento alerta: {alert.title}",
                "type": "Alerta",
            }
        )

    for goal in goals:
        if goal.get("deadline"):
            events.append(
                {
                    "id": f"goal-{goal['id']}",
                    "date": goal["deadline"],
                    "title": f"Meta: {goal['name']}",
                    "type": "Objetivo",
                }
            )

    events.sort(key=lambda event: event["date"])
    return events[:12]


def _build_alerts_center(db: Session) -> dict[str, Any]:
    alerts = db.scalars(select(SmartAlert).order_by(SmartAlert.created_at.desc()).limit(40)).all()
    unread_count = len([alert for alert in alerts if not alert.is_resolved])

    items = [
        {
            "id": alert.id,
            "title": alert.title,
            "desc": alert.description,
            "severity": alert.severity,
            "date": alert.created_at.isoformat() if alert.created_at else None,
            "read": bool(alert.is_resolved),
            "utility": alert.utility,
        }
        for alert in alerts
    ]

    return {
        "unread_count": unread_count,
        "items": items,
    }


def _build_users(db: Session) -> list[dict[str, Any]]:
    users = db.scalars(select(User).order_by(User.created_at.desc()).limit(100)).all()
    return [
        {
            "id": user.id,
            "name": user.full_name,
            "email": user.email,
            "role": user.role,
            "status": "Activo" if user.status == "ACTIVE" else "Inactivo",
            "email_verified": user.email_verified,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "initials": "".join([piece[0] for piece in (user.full_name or "U").split()[:2]]).upper(),
        }
        for user in users
    ]


def _build_company(db: Session, database_status: dict[str, Any]) -> dict[str, Any]:
    company = db.scalar(select(Company).order_by(Company.id.asc()))
    users_count = db.scalar(select(func.count()).select_from(User).where(User.status == "ACTIVE")) or 0

    facilities_count = 0
    if company:
        facilities_count = db.scalar(select(func.count()).select_from(Facility).where(Facility.company_id == company.id)) or 0

    company_name = company.name if company else "Organización"
    industry = company.industry if company else "No definida"

    return {
        "name": company_name,
        "industry": industry,
        "employees": int(users_count),
        "facilities": int(facilities_count),
        "website": None,
        "plan": "Enterprise",
        "license_until": "2026-12-31",
        "storage": f"{database_status['storage_mb']} MB",
    }


def _build_settings(db: Session) -> dict[str, Any]:
    cfg = get_or_create_alert_config(db)
    schedule = db.get(ETLSchedule, 1)
    if not schedule:
        schedule = ETLSchedule(id=1, cron_expression="0 6 1 * *", enabled=True)
        db.add(schedule)
        db.flush()

    return {
        "notify_email": bool(cfg.notify_email),
        "notify_in_app": bool(cfg.notify_in_app),
        "electricity_threshold_pct": round(_safe_float(cfg.electricity_threshold_pct), 2),
        "water_threshold_pct": round(_safe_float(cfg.water_threshold_pct), 2),
        "volatility_threshold_pct": round(_safe_float(cfg.volatility_threshold_pct), 2),
        "etl_enabled": bool(schedule.enabled),
        "etl_cron_expression": schedule.cron_expression,
    }


def _build_security(db: Session) -> dict[str, Any]:
    users = db.scalars(select(User).order_by(User.last_login_at.desc().nullslast(), User.created_at.desc()).limit(8)).all()
    sessions = []
    for index, user in enumerate(users):
        date_value = user.last_login_at or user.created_at
        sessions.append(
            {
                "device": f"Sesión {user.email}",
                "ip": "N/D",
                "date": date_value.isoformat() if date_value else None,
                "current": index == 0,
            }
        )

    logs = db.scalars(select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(20)).all()
    audit = [
        {
            "action": log.message,
            "user": "sistema",
            "date": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]

    return {
        "sessions": sessions,
        "audit": audit,
    }


def get_operations_overview(db: Session, months: int = 12) -> dict[str, Any]:
    monthly = _monthly_aggregates(db, months=months)
    latest, _ = _latest_pair(monthly)
    latest_year = int(latest["year"]) if latest else datetime.now(timezone.utc).year
    latest_month = int(latest["month"]) if latest else datetime.now(timezone.utc).month

    area_breakdown = _latest_area_breakdown(db, latest_year, latest_month) if latest else []
    targets = _target_map(db)

    efficiency = get_efficiency(db)

    electricity = _build_utility_section("electricity", monthly, targets, area_breakdown)
    water = _build_utility_section("water", monthly, targets, area_breakdown)
    metrics = _build_metric_cards([item.model_dump() for item in efficiency.items])
    kpis = _build_kpis(monthly, targets)
    map_data = _build_map_data(db, latest_year, latest_month) if latest else []
    predictions = _build_prediction_section(db, monthly)
    trends = _build_trends(monthly)
    anomalies = _build_anomalies(db)
    comparisons = _build_comparisons(monthly)
    goals = _build_goals(db, monthly)
    uploads = _build_uploads(db)
    reports = _build_reports(monthly)
    database_status = _build_database_status(db)
    calendar_events = _build_calendar(db, goals)
    alerts_center = _build_alerts_center(db)
    users = _build_users(db)
    company = _build_company(db, database_status)
    settings = _build_settings(db)
    security = _build_security(db)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": get_summary(db).model_dump(),
        "distribution": [item.model_dump() for item in get_distribution(db)],
        "timeseries": [item.model_dump() for item in get_timeseries(db, months=months)],
        "efficiency": efficiency.model_dump(),
        "electricity": electricity,
        "water": water,
        "metrics": metrics,
        "kpis": kpis,
        "map": map_data,
        "predictions": predictions,
        "trends": trends,
        "anomalies": anomalies,
        "comparisons": comparisons,
        "goals": goals,
        "uploads": uploads,
        "reports": reports,
        "exports": [
            {
                "id": "consumption",
                "title": "Datos de Consumo",
                "desc": "Exportación consolidada de electricidad y agua",
                "formats": ["CSV", "JSON"],
            },
            {
                "id": "predictions",
                "title": "Predicciones ML",
                "desc": "Predicciones generadas por modelo activo",
                "formats": ["CSV", "JSON"],
            },
            {
                "id": "alerts",
                "title": "Alertas",
                "desc": "Histórico de alertas y anomalías",
                "formats": ["CSV"],
            },
        ],
        "database": database_status,
        "calendar": calendar_events,
        "alerts_center": alerts_center,
        "users": users,
        "company": company,
        "settings": settings,
        "security": security,
    }


def resolve_alert(db: Session, alert_id: int) -> dict[str, Any]:
    alert = db.get(SmartAlert, alert_id)
    if not alert:
        raise ValueError("Alerta no encontrada")

    alert.is_resolved = True
    log_activity(
        db,
        activity_type="alert_resolved",
        message=f"Alerta resuelta: {alert.title}",
        metadata={"alert_id": alert.id},
    )
    db.flush()

    return {
        "id": alert.id,
        "resolved": True,
        "title": alert.title,
    }


def resolve_all_alerts(db: Session) -> dict[str, Any]:
    open_alerts = db.scalars(select(SmartAlert).where(SmartAlert.is_resolved.is_(False))).all()
    for alert in open_alerts:
        alert.is_resolved = True

    log_activity(
        db,
        activity_type="alert_resolved",
        message="Todas las alertas fueron marcadas como resueltas",
        metadata={"count": len(open_alerts)},
    )
    db.flush()

    return {
        "resolved": len(open_alerts),
    }


def create_user(
    db: Session,
    *,
    full_name: str,
    email: str,
    password: str | None,
    role: str,
    status: str,
    email_verified: bool,
) -> dict[str, Any]:
    normalized_email = email.lower().strip()
    existing = db.scalar(select(User).where(User.email == normalized_email))
    if existing:
        raise ValueError("Ya existe un usuario con ese correo")

    temporary_password = password
    generated_password = False
    if not temporary_password:
        temporary_password = f"Tmp-{token_urlsafe(8)}"
        generated_password = True

    user = User(
        email=normalized_email,
        full_name=full_name.strip(),
        password_hash=hash_password(temporary_password),
        email_verified=email_verified,
        status=status,
        role=role,
        must_change_password=generated_password,
        is_active=status == "ACTIVE",
    )
    db.add(user)
    db.flush()

    log_activity(
        db,
        activity_type="user",
        message=f"Usuario creado: {normalized_email}",
        metadata={"user_id": user.id, "role": role, "status": status},
    )

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "status": user.status,
        "email_verified": user.email_verified,
        "temporary_password": temporary_password if generated_password else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def update_settings(db: Session, payload: dict[str, Any]) -> dict[str, Any]:
    cfg = get_or_create_alert_config(db)
    schedule = db.get(ETLSchedule, 1)
    if not schedule:
        schedule = ETLSchedule(id=1, cron_expression="0 6 1 * *", enabled=True)
        db.add(schedule)

    thresholds_changed = False
    if payload.get("notify_email") is not None:
        cfg.notify_email = bool(payload["notify_email"])
    if payload.get("notify_in_app") is not None:
        cfg.notify_in_app = bool(payload["notify_in_app"])
    if payload.get("electricity_threshold_pct") is not None:
        cfg.electricity_threshold_pct = float(payload["electricity_threshold_pct"])
        thresholds_changed = True
    if payload.get("water_threshold_pct") is not None:
        cfg.water_threshold_pct = float(payload["water_threshold_pct"])
        thresholds_changed = True
    if payload.get("volatility_threshold_pct") is not None:
        cfg.volatility_threshold_pct = float(payload["volatility_threshold_pct"])
        thresholds_changed = True

    if thresholds_changed:
        regenerate_anomaly_alerts(db)

    if payload.get("etl_enabled") is not None:
        schedule.enabled = bool(payload["etl_enabled"])
    if payload.get("etl_cron_expression"):
        schedule.cron_expression = str(payload["etl_cron_expression"])

    log_activity(
        db,
        activity_type="settings",
        message="Configuración de la plataforma actualizada",
        metadata={
            "notify_email": cfg.notify_email,
            "notify_in_app": cfg.notify_in_app,
            "etl_enabled": schedule.enabled,
            "etl_cron_expression": schedule.cron_expression,
        },
    )

    db.flush()

    return {
        "notify_email": cfg.notify_email,
        "notify_in_app": cfg.notify_in_app,
        "electricity_threshold_pct": cfg.electricity_threshold_pct,
        "water_threshold_pct": cfg.water_threshold_pct,
        "volatility_threshold_pct": cfg.volatility_threshold_pct,
        "etl_enabled": schedule.enabled,
        "etl_cron_expression": schedule.cron_expression,
    }
