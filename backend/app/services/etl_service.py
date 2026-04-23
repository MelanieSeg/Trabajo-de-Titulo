from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    AreaDistribution,
    Company,
    ETLJob,
    Facility,
    MonthlyConsumption,
    ResourceAreaDistribution,
    ResourceMonthlyConsumption,
    ResourceType,
)
from app.services.activity_service import log_activity
from app.services.resource_service import ensure_resource_catalog

REQUIRED_COLUMNS = {
    "company_name",
    "facility_name",
    "region",
    "year",
    "month",
    "electricity_kwh",
    "water_m3",
    "electricity_cost_usd",
    "water_cost_usd",
    "co2_avoided_ton",
}

DISTRIBUTION_COLUMNS = [
    ("lighting_pct", "Iluminación"),
    ("hvac_pct", "Climatización"),
    ("machinery_pct", "Maquinaria"),
    ("offices_pct", "Oficinas"),
    ("others_pct", "Otros"),
]

RESOURCE_COLUMN_MAPPING = {
    "gas_natural": ("gas_natural_m3", "gas_natural_cost_usd"),
    "diesel": ("diesel_l", "diesel_cost_usd"),
    "gasolina": ("gasolina_l", "gasolina_cost_usd"),
    "glp_propano": ("glp_propano_kg", "glp_propano_cost_usd"),
    "vapor_termica": ("vapor_termica_gj", "vapor_termica_cost_usd"),
    "energia_renovable": ("energia_renovable_kwh", "energia_renovable_cost_usd"),
    "residuos": ("residuos_kg", "residuos_cost_usd"),
    "emisiones_co2e": ("emisiones_co2e_t", "emisiones_co2e_cost_usd"),
    "quimicos_consumibles": ("quimicos_consumibles_l", "quimicos_consumibles_cost_usd"),
}

RESOURCE_EMISSION_FACTORS = {
    "gas_natural": 0.0019,
    "diesel": 0.00268,
    "gasolina": 0.00231,
    "glp_propano": 0.0030,
    "vapor_termica": 0.040,
    "energia_renovable": 0.00005,
    "residuos": 0.0008,
    "quimicos_consumibles": 0.0006,
}


def _normalize_distribution(row: pd.Series) -> dict[str, float]:
    values = {}
    for key, label in DISTRIBUTION_COLUMNS:
        values[label] = float(row.get(key, 0) or 0)

    total = sum(values.values())
    if total <= 0:
        return {
            "Iluminación": 28.0,
            "Climatización": 35.0,
            "Maquinaria": 22.0,
            "Oficinas": 10.0,
            "Otros": 5.0,
        }

    return {k: (v / total) * 100 for k, v in values.items()}


def _clean_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    df.columns = [c.strip().lower() for c in df.columns]

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"CSV inválido. Faltan columnas: {', '.join(sorted(missing))}")

    initial_rows = len(df)

    df = df.dropna(subset=["company_name", "facility_name", "year", "month", "electricity_kwh", "water_m3"])

    numeric_cols = [
        "year",
        "month",
        "electricity_kwh",
        "water_m3",
        "electricity_cost_usd",
        "water_cost_usd",
        "co2_avoided_ton",
        "lighting_pct",
        "hvac_pct",
        "machinery_pct",
        "offices_pct",
        "others_pct",
    ]
    for value_col, cost_col in RESOURCE_COLUMN_MAPPING.values():
        numeric_cols.append(value_col)
        numeric_cols.append(cost_col)
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["year", "month", "electricity_kwh", "water_m3", "electricity_cost_usd", "water_cost_usd", "co2_avoided_ton"])
    df = df[(df["month"] >= 1) & (df["month"] <= 12)]

    agg_map: dict[str, str] = {
        "electricity_kwh": "sum",
        "water_m3": "sum",
        "electricity_cost_usd": "sum",
        "water_cost_usd": "sum",
        "co2_avoided_ton": "sum",
        "lighting_pct": "mean",
        "hvac_pct": "mean",
        "machinery_pct": "mean",
        "offices_pct": "mean",
        "others_pct": "mean",
    }
    for value_col, cost_col in RESOURCE_COLUMN_MAPPING.values():
        if value_col in df.columns:
            agg_map[value_col] = "sum"
        if cost_col in df.columns:
            agg_map[cost_col] = "sum"

    grouped = df.groupby(["company_name", "facility_name", "region", "year", "month"], as_index=False).agg(agg_map).reset_index(drop=True)

    rejected = initial_rows - len(grouped)
    return grouped, max(rejected, 0)


def _get_or_create_company(db: Session, name: str) -> Company:
    company = db.scalar(select(Company).where(Company.name == name))
    if company:
        return company
    company = Company(name=name)
    db.add(company)
    db.flush()
    return company


def _get_or_create_facility(db: Session, company_id: int, facility_name: str, region: str | None) -> Facility:
    facility = db.scalar(
        select(Facility).where(
            Facility.company_id == company_id,
            Facility.name == facility_name,
        )
    )
    if facility:
        if region and facility.region != region:
            facility.region = region
        return facility

    facility = Facility(company_id=company_id, name=facility_name, region=region)
    db.add(facility)
    db.flush()
    return facility


def _upsert_monthly_consumption(db: Session, facility_id: int, row: pd.Series) -> MonthlyConsumption:
    record = db.scalar(
        select(MonthlyConsumption).where(
            MonthlyConsumption.facility_id == facility_id,
            MonthlyConsumption.year == int(row["year"]),
            MonthlyConsumption.month == int(row["month"]),
        )
    )
    if not record:
        record = MonthlyConsumption(
            facility_id=facility_id,
            year=int(row["year"]),
            month=int(row["month"]),
            electricity_kwh=float(row["electricity_kwh"]),
            water_m3=float(row["water_m3"]),
            electricity_cost_usd=float(row["electricity_cost_usd"]),
            water_cost_usd=float(row["water_cost_usd"]),
            co2_avoided_ton=float(row["co2_avoided_ton"]),
        )
        db.add(record)
        db.flush()
        return record

    record.electricity_kwh = float(row["electricity_kwh"])
    record.water_m3 = float(row["water_m3"])
    record.electricity_cost_usd = float(row["electricity_cost_usd"])
    record.water_cost_usd = float(row["water_cost_usd"])
    record.co2_avoided_ton = float(row["co2_avoided_ton"])
    db.flush()
    return record


def _upsert_distribution(db: Session, monthly_consumption_id: int, normalized: dict[str, float]) -> None:
    existing = db.scalars(
        select(AreaDistribution).where(AreaDistribution.monthly_consumption_id == monthly_consumption_id)
    ).all()
    existing_map = {d.area_name: d for d in existing}

    for area_name, pct in normalized.items():
        if area_name in existing_map:
            existing_map[area_name].percentage = float(pct)
        else:
            db.add(
                AreaDistribution(
                    monthly_consumption_id=monthly_consumption_id,
                    area_name=area_name,
                    percentage=float(pct),
                )
            )


def _upsert_resource_distribution(db: Session, resource_consumption_id: int, normalized: dict[str, float]) -> None:
    existing = db.scalars(
        select(ResourceAreaDistribution).where(ResourceAreaDistribution.resource_consumption_id == resource_consumption_id)
    ).all()
    existing_map = {item.area_name: item for item in existing}

    for area_name, pct in normalized.items():
        if area_name in existing_map:
            existing_map[area_name].percentage = float(pct)
        else:
            db.add(
                ResourceAreaDistribution(
                    resource_consumption_id=resource_consumption_id,
                    area_name=area_name,
                    percentage=float(pct),
                )
            )


def _upsert_resource_consumptions(
    db: Session,
    *,
    facility_id: int,
    row: pd.Series,
    normalized_distribution: dict[str, float],
    resource_types: dict[str, ResourceType],
) -> None:
    year = int(row["year"])
    month = int(row["month"])

    for code, resource_type in resource_types.items():
        columns = RESOURCE_COLUMN_MAPPING.get(code)
        if not columns:
            continue
        value_column, cost_column = columns
        if value_column not in row.index and cost_column not in row.index:
            continue

        raw_value = row.get(value_column, 0)
        raw_cost = row.get(cost_column, 0)
        value = 0.0 if pd.isna(raw_value) else float(raw_value or 0)
        cost = 0.0 if pd.isna(raw_cost) else float(raw_cost or 0)
        if value <= 0 and cost <= 0:
            continue

        if code == "emisiones_co2e":
            emissions = max(0.0, value)
        else:
            emissions = max(0.0, value * RESOURCE_EMISSION_FACTORS.get(code, 0.0))

        record = db.scalar(
            select(ResourceMonthlyConsumption).where(
                ResourceMonthlyConsumption.resource_type_id == resource_type.id,
                ResourceMonthlyConsumption.facility_id == facility_id,
                ResourceMonthlyConsumption.year == year,
                ResourceMonthlyConsumption.month == month,
            )
        )
        if not record:
            record = ResourceMonthlyConsumption(
                resource_type_id=resource_type.id,
                facility_id=facility_id,
                year=year,
                month=month,
                consumption_value=max(0.0, value),
                cost_usd=max(0.0, cost),
                emissions_tco2e=emissions,
                source="etl_csv",
            )
            db.add(record)
            db.flush()
        else:
            record.consumption_value = max(0.0, value)
            record.cost_usd = max(0.0, cost)
            record.emissions_tco2e = emissions
            record.source = "etl_csv"
            db.flush()

        _upsert_resource_distribution(db, record.id, normalized_distribution)


def run_etl_from_csv(db: Session, csv_path: str, source_filename: str | None = None) -> ETLJob:
    started_at = datetime.now(timezone.utc)
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"No se encontró archivo CSV: {csv_path}")

    source_name = source_filename or path.name
    df = pd.read_csv(path)
    cleaned, rejected = _clean_dataframe(df)
    resource_types = ensure_resource_catalog(db)

    processed = 0
    for _, row in cleaned.iterrows():
        company = _get_or_create_company(db, str(row["company_name"]).strip())
        facility = _get_or_create_facility(db, company.id, str(row["facility_name"]).strip(), str(row.get("region", "")).strip() or None)
        record = _upsert_monthly_consumption(db, facility.id, row)

        distribution = _normalize_distribution(row)
        _upsert_distribution(db, record.id, distribution)
        _upsert_resource_consumptions(
            db,
            facility_id=facility.id,
            row=row,
            normalized_distribution=distribution,
            resource_types=resource_types,
        )
        processed += 1

    finished_at = datetime.now(timezone.utc)
    job = ETLJob(
        source_filename=source_name,
        rows_processed=processed,
        rows_rejected=rejected,
        status="completed",
        notes="Proceso ETL ejecutado correctamente",
        started_at=started_at,
        finished_at=finished_at,
    )
    db.add(job)

    log_activity(
        db,
        activity_type="etl",
        message=f"ETL ejecutado sobre {source_name}",
        metadata={"rows_processed": processed, "rows_rejected": rejected},
    )

    db.flush()
    return job
