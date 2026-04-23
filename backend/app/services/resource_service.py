from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    MLPrediction,
    MonthlyConsumption,
    ResourceAreaDistribution,
    ResourceMonthlyConsumption,
    ResourceType,
    SmartAlert,
)
from app.services.activity_service import log_activity
from app.utils.date_utils import month_label, next_month

AREA_WEIGHTS = [
    ("Producción", 30.0),
    ("Climatización", 22.0),
    ("Iluminación", 18.0),
    ("Equipos", 16.0),
    ("Servicios", 14.0),
]

RESOURCE_CATALOG = [
    {
        "code": "gas_natural",
        "name": "Gas Natural",
        "category": "Combustible gaseoso",
        "unit": "m3",
        "regulatory_body": "SEC / MMA",
        "description": "Consumo de gas natural en procesos térmicos, calefacción y producción.",
        "cost_factor": 0.55,
        "emission_factor": 0.0019,
    },
    {
        "code": "diesel",
        "name": "Diésel",
        "category": "Combustible fósil",
        "unit": "L",
        "regulatory_body": "SEC / MMA",
        "description": "Consumo de diésel en generadores, transporte interno y maquinaria.",
        "cost_factor": 1.20,
        "emission_factor": 0.00268,
    },
    {
        "code": "gasolina",
        "name": "Gasolina",
        "category": "Combustible fósil",
        "unit": "L",
        "regulatory_body": "SEC / MMA",
        "description": "Consumo de gasolina en flota liviana y equipos auxiliares.",
        "cost_factor": 1.35,
        "emission_factor": 0.00231,
    },
    {
        "code": "glp_propano",
        "name": "GLP / Propano",
        "category": "Combustible fósil",
        "unit": "kg",
        "regulatory_body": "SEC / MMA",
        "description": "Consumo de GLP/propano para procesos térmicos y cocción industrial.",
        "cost_factor": 0.95,
        "emission_factor": 0.00300,
    },
    {
        "code": "vapor_termica",
        "name": "Vapor / Energía Térmica",
        "category": "Energía de proceso",
        "unit": "GJ",
        "regulatory_body": "SMA / MMA",
        "description": "Energía térmica en calderas, intercambio de calor y calentamiento de agua.",
        "cost_factor": 12.0,
        "emission_factor": 0.040,
    },
    {
        "code": "energia_renovable",
        "name": "Energía Renovable Generada",
        "category": "Generación renovable",
        "unit": "kWh",
        "regulatory_body": "CNE / SEC",
        "description": "Generación propia renovable (solar, eólica o mini-hidro).",
        "cost_factor": 0.08,
        "emission_factor": 0.00005,
    },
    {
        "code": "residuos",
        "name": "Residuos Totales",
        "category": "Gestión ambiental",
        "unit": "kg",
        "regulatory_body": "MMA / SMA",
        "description": "Residuos sólidos y peligrosos gestionados por la operación.",
        "cost_factor": 0.20,
        "emission_factor": 0.0008,
    },
    {
        "code": "emisiones_co2e",
        "name": "Emisiones Reales de CO2e",
        "category": "Huella de carbono",
        "unit": "tCO2e",
        "regulatory_body": "MMA / GRI / CDP",
        "description": "Emisiones reales generadas por consumo de energía y combustibles.",
        "cost_factor": 18.0,
        "emission_factor": 1.0,
    },
    {
        "code": "quimicos_consumibles",
        "name": "Químicos y Consumibles",
        "category": "Sustancias reguladas",
        "unit": "L",
        "regulatory_body": "SEREMI Salud / SMA",
        "description": "Sustancias químicas, refrigerantes y consumibles operacionales.",
        "cost_factor": 2.5,
        "emission_factor": 0.0006,
    },
]


def _catalog_map() -> dict[str, dict[str, Any]]:
    return {item["code"]: item for item in RESOURCE_CATALOG}


def ensure_resource_catalog(db: Session) -> dict[str, ResourceType]:
    catalog = _catalog_map()
    created_or_updated: dict[str, ResourceType] = {}
    for code, payload in catalog.items():
        row = db.scalar(select(ResourceType).where(ResourceType.code == code))
        if row:
            row.name = payload["name"]
            row.category = payload["category"]
            row.unit = payload["unit"]
            row.regulatory_body = payload["regulatory_body"]
            row.description = payload["description"]
            row.is_active = True
        else:
            row = ResourceType(
                code=payload["code"],
                name=payload["name"],
                category=payload["category"],
                unit=payload["unit"],
                regulatory_body=payload["regulatory_body"],
                description=payload["description"],
                is_active=True,
            )
            db.add(row)
            db.flush()
        created_or_updated[code] = row
    return created_or_updated


def list_resource_catalog(db: Session) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(ResourceType).where(ResourceType.is_active.is_(True)).order_by(ResourceType.name.asc())
    ).all()
    payload = []
    for row in rows:
        payload.append(
            {
                "code": row.code,
                "name": row.name,
                "category": row.category,
                "unit": row.unit,
                "regulatory_body": row.regulatory_body,
                "description": row.description,
            }
        )
    return payload


def _jitter(code: str, year: int, month: int, facility_id: int) -> float:
    seed = (year * 13 + month * 7 + facility_id * 5 + len(code) * 3) % 11
    return 1 + (seed - 5) * 0.025


def _resource_value(
    code: str,
    electricity_kwh: float,
    water_m3: float,
    year: int,
    month: int,
    facility_id: int,
) -> float:
    j = _jitter(code, year, month, facility_id)
    if code == "gas_natural":
        return max(0.0, electricity_kwh * 0.075 * j)
    if code == "diesel":
        return max(0.0, electricity_kwh * 0.009 * j)
    if code == "gasolina":
        return max(0.0, electricity_kwh * 0.0035 * j)
    if code == "glp_propano":
        return max(0.0, (electricity_kwh * 0.0045 + water_m3 * 0.08) * j)
    if code == "vapor_termica":
        return max(0.0, electricity_kwh * 0.0028 * j)
    if code == "energia_renovable":
        seasonal = 1 + (month - 6) / 40.0
        return max(0.0, electricity_kwh * 0.22 * seasonal * j)
    if code == "residuos":
        return max(0.0, (electricity_kwh * 0.004 + water_m3 * 0.03) * j)
    if code == "emisiones_co2e":
        return max(0.0, (electricity_kwh * 0.00032 + water_m3 * 0.00002) * j)
    if code == "quimicos_consumibles":
        return max(0.0, (water_m3 * 0.045 + electricity_kwh * 0.0008) * j)
    return 0.0


def _resource_area_percentages(code: str, year: int, month: int, facility_id: int) -> list[tuple[str, float]]:
    raw: list[tuple[str, float]] = []
    for index, (area, base_weight) in enumerate(AREA_WEIGHTS):
        seed = (len(code) * 17 + year * 3 + month * 5 + facility_id * 11 + index * 7) % 13
        factor = 1 + (seed - 6) * 0.02
        raw.append((area, max(1.0, base_weight * factor)))
    total = sum(item[1] for item in raw)
    return [(area, round(weight * 100 / total, 2)) for area, weight in raw]


def _threshold_for_resource(code: str) -> float:
    if code == "emisiones_co2e":
        return 10.0
    if code == "energia_renovable":
        return 12.0
    return 15.0


def seed_resource_data(db: Session) -> int:
    # Si ya existe cualquier dato para recursos fiscalizados, no reseed.
    already_exists = db.scalar(select(ResourceMonthlyConsumption.id).limit(1))
    if already_exists:
        return 0

    resource_types = ensure_resource_catalog(db)
    base_rows = db.execute(
        select(
            MonthlyConsumption.facility_id,
            MonthlyConsumption.year,
            MonthlyConsumption.month,
            MonthlyConsumption.electricity_kwh,
            MonthlyConsumption.water_m3,
        )
    ).all()
    if not base_rows:
        return 0

    catalog = _catalog_map()
    created = 0
    for base in base_rows:
        for code, resource in resource_types.items():
            info = catalog[code]
            value = _resource_value(
                code=code,
                electricity_kwh=float(base.electricity_kwh or 0),
                water_m3=float(base.water_m3 or 0),
                year=int(base.year),
                month=int(base.month),
                facility_id=int(base.facility_id),
            )
            cost_usd = round(value * float(info["cost_factor"]), 4)
            emissions = round(value * float(info["emission_factor"]), 6)
            if code == "emisiones_co2e":
                emissions = round(value, 6)

            record = ResourceMonthlyConsumption(
                resource_type_id=resource.id,
                facility_id=int(base.facility_id),
                year=int(base.year),
                month=int(base.month),
                consumption_value=round(value, 4),
                cost_usd=max(0.0, cost_usd),
                emissions_tco2e=max(0.0, emissions),
                source="synthetic_seed",
            )
            db.add(record)
            db.flush()

            percentages = _resource_area_percentages(code, int(base.year), int(base.month), int(base.facility_id))
            for area_name, percentage in percentages:
                db.add(
                    ResourceAreaDistribution(
                        resource_consumption_id=record.id,
                        area_name=area_name,
                        percentage=percentage,
                    )
                )
            created += 1

    if created > 0:
        log_activity(
            db,
            activity_type="resources_seed",
            message="Datos base para energías fiscalizadas generados",
            metadata={"records": created, "resource_types": len(resource_types)},
        )
    return created


def _resource_row(db: Session, code: str) -> ResourceType:
    row = db.scalar(select(ResourceType).where(ResourceType.code == code, ResourceType.is_active.is_(True)))
    if not row:
        raise ValueError(f"No existe recurso fiscalizado con código '{code}'.")
    return row


def _monthly_aggregates(db: Session, resource_type_id: int) -> list[dict[str, Any]]:
    rows = db.execute(
        select(
            ResourceMonthlyConsumption.year,
            ResourceMonthlyConsumption.month,
            func.sum(ResourceMonthlyConsumption.consumption_value).label("consumo"),
            func.sum(ResourceMonthlyConsumption.cost_usd).label("costo"),
        )
        .where(ResourceMonthlyConsumption.resource_type_id == resource_type_id)
        .group_by(ResourceMonthlyConsumption.year, ResourceMonthlyConsumption.month)
        .order_by(ResourceMonthlyConsumption.year, ResourceMonthlyConsumption.month)
    ).all()
    return [
        {
            "year": int(row.year),
            "month": int(row.month),
            "mes": month_label(int(row.year), int(row.month)),
            "consumo": round(float(row.consumo or 0), 2),
            "costo": round(float(row.costo or 0), 2),
        }
        for row in rows
    ]


def _forecast_values(series: list[dict[str, Any]], horizon: int = 3) -> list[dict[str, Any]]:
    if not series:
        return []
    values = [float(item["consumo"]) for item in series]
    if len(values) == 1:
        slope = 0.0
        baseline = values[-1]
    else:
        window = values[-3:] if len(values) >= 3 else values
        baseline = sum(window) / len(window)
        slope = (window[-1] - window[0]) / max(len(window) - 1, 1)

    latest_year = int(series[-1]["year"])
    latest_month = int(series[-1]["month"])
    predictions: list[dict[str, Any]] = []

    for step in range(1, horizon + 1):
        latest_year, latest_month = next_month(latest_year, latest_month)
        predicted = max(0.0, baseline + slope * step * 0.8)
        predictions.append(
            {
                "year": latest_year,
                "month": latest_month,
                "mes": month_label(latest_year, latest_month),
                "value": round(predicted, 2),
            }
        )
    return predictions


def _store_predictions(db: Session, code: str, predictions: list[dict[str, Any]]) -> None:
    scope = f"resource:{code}"
    db.query(MLPrediction).filter(MLPrediction.scope == scope, MLPrediction.utility == code).delete()
    for item in predictions:
        db.add(
            MLPrediction(
                scope=scope,
                utility=code,
                year=int(item["year"]),
                month=int(item["month"]),
                predicted_value=float(item["value"]),
                model_name="ResourceTrendModel",
                validation_mae=0.0,
            )
        )


def ensure_resource_predictions(db: Session, horizon: int = 3) -> dict[str, list[dict[str, Any]]]:
    resources = db.scalars(
        select(ResourceType).where(ResourceType.is_active.is_(True)).order_by(ResourceType.code.asc())
    ).all()
    generated: dict[str, list[dict[str, Any]]] = {}

    for resource in resources:
        series = _monthly_aggregates(db, resource.id)
        predictions = _forecast_values(series, horizon=horizon)
        if predictions:
            _store_predictions(db, resource.code, predictions)
        generated[resource.code] = predictions

    db.flush()
    return generated


def _create_resource_alert_if_needed(
    db: Session,
    *,
    code: str,
    name: str,
    latest: dict[str, Any] | None,
    previous: dict[str, Any] | None,
) -> None:
    if not latest or not previous:
        return
    prev_value = max(float(previous["consumo"]), 0.0001)
    change_pct = ((float(latest["consumo"]) - prev_value) / prev_value) * 100
    threshold = _threshold_for_resource(code)

    should_alert = False
    title = ""
    severity = "warning"
    if code == "energia_renovable":
        # Para generación renovable, una caída brusca es el riesgo.
        if change_pct <= -threshold:
            should_alert = True
            title = f"Caída en generación renovable ({name})"
            severity = "critical" if change_pct <= -(threshold * 1.5) else "warning"
    else:
        if change_pct >= threshold:
            should_alert = True
            title = f"Consumo elevado detectado ({name})"
            severity = "critical" if change_pct >= threshold * 1.4 else "warning"

    if not should_alert:
        return

    alert_year = int(latest["year"])
    alert_month = int(latest["month"])

    exists = db.scalar(
        select(SmartAlert).where(
            SmartAlert.title == title,
            SmartAlert.utility == code,
            SmartAlert.year == alert_year,
            SmartAlert.month == alert_month,
            SmartAlert.is_resolved.is_(False),
        )
    )
    if exists:
        return

    description = (
        f"{name}: variación de {change_pct:+.1f}% en {month_label(alert_year, alert_month)} "
        "respecto al período anterior."
    )
    db.add(
        SmartAlert(
            severity=severity,
            title=title,
            description=description,
            utility=code,
            year=alert_year,
            month=alert_month,
            is_resolved=False,
            extra_data={
                "source": "resource_engine",
                "change_pct": round(change_pct, 2),
                "threshold_pct": threshold,
            },
        )
    )


def _latest_area_breakdown(db: Session, resource_type_id: int, year: int, month: int) -> list[dict[str, Any]]:
    rows = db.execute(
        select(
            ResourceAreaDistribution.area_name,
            func.avg(ResourceAreaDistribution.percentage).label("percentage"),
            func.sum(
                ResourceMonthlyConsumption.consumption_value
                * ResourceAreaDistribution.percentage
                / 100.0
            ).label("consumo"),
        )
        .join(
            ResourceMonthlyConsumption,
            ResourceMonthlyConsumption.id == ResourceAreaDistribution.resource_consumption_id,
        )
        .where(
            ResourceMonthlyConsumption.resource_type_id == resource_type_id,
            ResourceMonthlyConsumption.year == year,
            ResourceMonthlyConsumption.month == month,
        )
        .group_by(ResourceAreaDistribution.area_name)
        .order_by(func.avg(ResourceAreaDistribution.percentage).desc())
    ).all()
    return [
        {
            "area": row.area_name,
            "consumo": round(float(row.consumo or 0), 2),
            "percentage": round(float(row.percentage or 0), 2),
        }
        for row in rows
    ]


def get_resource_overview(db: Session, code: str, months: int = 12) -> dict[str, Any]:
    resource = _resource_row(db, code)
    series = _monthly_aggregates(db, resource.id)
    if len(series) > months:
        series = series[-months:]

    latest = series[-1] if series else None
    previous = series[-2] if len(series) > 1 else latest

    predictions = _forecast_values(series, horizon=3)
    if predictions:
        _store_predictions(db, code, predictions)

    _create_resource_alert_if_needed(
        db,
        code=code,
        name=resource.name,
        latest=latest,
        previous=previous,
    )

    open_alerts = db.scalars(
        select(SmartAlert)
        .where(SmartAlert.utility == code, SmartAlert.is_resolved.is_(False))
        .order_by(SmartAlert.created_at.desc())
        .limit(4)
    ).all()

    if latest and previous:
        consumption_change_pct = ((latest["consumo"] - max(previous["consumo"], 0.0001)) / max(previous["consumo"], 0.0001)) * 100
        cost_change_pct = ((latest["costo"] - max(previous["costo"], 0.0001)) / max(previous["costo"], 0.0001)) * 100
    else:
        consumption_change_pct = 0.0
        cost_change_pct = 0.0

    avg_consumption = (
        sum(item["consumo"] for item in series) / max(len(series), 1)
        if series
        else 0.0
    )
    intensity_pct = (
        (latest["consumo"] / avg_consumption) * 100
        if latest and avg_consumption > 0
        else 0.0
    )
    intensity_change_pct = (
        ((latest["consumo"] - avg_consumption) / max(avg_consumption, 0.0001)) * 100
        if latest and avg_consumption > 0
        else 0.0
    )

    latest_year = int(latest["year"]) if latest else datetime.now(timezone.utc).year
    latest_month = int(latest["month"]) if latest else datetime.now(timezone.utc).month
    areas = _latest_area_breakdown(db, resource.id, latest_year, latest_month) if latest else []

    return {
        "resource": {
            "code": resource.code,
            "name": resource.name,
            "category": resource.category,
            "unit": resource.unit,
            "regulatory_body": resource.regulatory_body,
            "description": resource.description,
        },
        "cards": [
            {
                "label": "Consumo Actual",
                "value": round(float(latest["consumo"]) if latest else 0.0, 2),
                "unit": resource.unit,
                "change_pct": round(consumption_change_pct, 2),
            },
            {
                "label": "Costo Mensual",
                "value": round(float(latest["costo"]) if latest else 0.0, 2),
                "unit": "USD",
                "change_pct": round(cost_change_pct, 2),
            },
            {
                "label": "Intensidad vs Promedio",
                "value": round(intensity_pct, 2),
                "unit": "%",
                "change_pct": round(intensity_change_pct, 2),
            },
        ],
        "monthly": series,
        "areas": areas,
        "predictions": predictions,
        "alerts": [
            {
                "id": row.id,
                "severity": row.severity,
                "title": row.title,
                "description": row.description,
                "year": row.year,
                "month": row.month,
                "created_at": row.created_at,
            }
            for row in open_alerts
        ],
    }
