from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AreaDistribution, Company, ETLJob, Facility, MonthlyConsumption
from app.services.activity_service import log_activity

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
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["year", "month", "electricity_kwh", "water_m3", "electricity_cost_usd", "water_cost_usd", "co2_avoided_ton"])
    df = df[(df["month"] >= 1) & (df["month"] <= 12)]

    grouped = (
        df.groupby(["company_name", "facility_name", "region", "year", "month"], as_index=False)
        .agg(
            {
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
        )
        .reset_index(drop=True)
    )

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


def run_etl_from_csv(db: Session, csv_path: str, source_filename: str | None = None) -> ETLJob:
    started_at = datetime.now(timezone.utc)
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"No se encontró archivo CSV: {csv_path}")

    source_name = source_filename or path.name
    df = pd.read_csv(path)
    cleaned, rejected = _clean_dataframe(df)

    processed = 0
    for _, row in cleaned.iterrows():
        company = _get_or_create_company(db, str(row["company_name"]).strip())
        facility = _get_or_create_facility(db, company.id, str(row["facility_name"]).strip(), str(row.get("region", "")).strip() or None)
        record = _upsert_monthly_consumption(db, facility.id, row)

        distribution = _normalize_distribution(row)
        _upsert_distribution(db, record.id, distribution)
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
