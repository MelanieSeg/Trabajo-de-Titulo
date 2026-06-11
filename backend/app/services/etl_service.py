from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy import select, tuple_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db.models import (
    AreaDistribution,
    Company,
    ETLJob,
    Facility,
    FuelTransaction,
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

YEAR_MIN = 2000
YEAR_MAX = 2100

UTILITY_REQUIRED_COLUMNS = {
    "electricity": {
        "company_name",
        "facility_name",
        "year",
        "month",
        "electricity_kwh",
        "electricity_cost_usd",
    },
    "water": {
        "company_name",
        "facility_name",
        "year",
        "month",
        "water_m3",
        "water_cost_usd",
    },
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

    for col in ("company_name", "facility_name", "region"):
        if col in df.columns:
            df[col] = df[col].astype("string").str.strip()

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
    df = df[(df["year"] >= YEAR_MIN) & (df["year"] <= YEAR_MAX)]

    if df.empty:
        raise ValueError(
            f"CSV sin filas válidas: el campo year debe estar entre {YEAR_MIN} y {YEAR_MAX}."
        )

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


def _clean_utility_dataframe(df: pd.DataFrame, utility: str) -> tuple[pd.DataFrame, int]:
    utility_key = utility.strip().lower()
    if utility_key not in UTILITY_REQUIRED_COLUMNS:
        raise ValueError("Utilidad no soportada para ETL parcial.")

    df.columns = [c.strip().lower() for c in df.columns]

    missing = UTILITY_REQUIRED_COLUMNS[utility_key] - set(df.columns)
    if missing:
        raise ValueError(
            f"CSV inválido para {utility_key}. Faltan columnas: {', '.join(sorted(missing))}"
        )

    # Región es opcional en carga por módulo.
    if "region" not in df.columns:
        df["region"] = ""

    for col in ("company_name", "facility_name", "region"):
        if col in df.columns:
            df[col] = df[col].astype("string").str.strip()

    initial_rows = len(df)
    drop_subset = [
        "company_name",
        "facility_name",
        "year",
        "month",
    ]
    if utility_key == "electricity":
        drop_subset.extend(["electricity_kwh", "electricity_cost_usd"])
    else:
        drop_subset.extend(["water_m3", "water_cost_usd"])

    df = df.dropna(subset=drop_subset)

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

    if utility_key == "electricity":
        df = df.dropna(subset=["year", "month", "electricity_kwh", "electricity_cost_usd"])
    else:
        df = df.dropna(subset=["year", "month", "water_m3", "water_cost_usd"])

    df = df[(df["month"] >= 1) & (df["month"] <= 12)]
    df = df[(df["year"] >= YEAR_MIN) & (df["year"] <= YEAR_MAX)]

    if df.empty:
        raise ValueError(
            f"CSV sin filas válidas para {utility_key}: year debe estar entre {YEAR_MIN} y {YEAR_MAX}."
        )

    agg_map: dict[str, str] = {}
    if "co2_avoided_ton" in df.columns:
        agg_map["co2_avoided_ton"] = "sum"
    for area_col in ["lighting_pct", "hvac_pct", "machinery_pct", "offices_pct", "others_pct"]:
        if area_col in df.columns:
            agg_map[area_col] = "mean"
    if utility_key == "electricity":
        agg_map["electricity_kwh"] = "sum"
        agg_map["electricity_cost_usd"] = "sum"
    else:
        agg_map["water_m3"] = "sum"
        agg_map["water_cost_usd"] = "sum"

    for value_col, cost_col in RESOURCE_COLUMN_MAPPING.values():
        if value_col in df.columns:
            agg_map[value_col] = "sum"
        if cost_col in df.columns:
            agg_map[cost_col] = "sum"

    grouped = (
        df.groupby(["company_name", "facility_name", "region", "year", "month"], as_index=False)
        .agg(agg_map)
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


def _chunked(sequence: list, size: int):
    for idx in range(0, len(sequence), size):
        yield sequence[idx : idx + size]


def _ensure_companies_bulk(db: Session, company_names: list[str]) -> dict[str, int]:
    normalized = sorted({name.strip() for name in company_names if isinstance(name, str) and name.strip()})
    if not normalized:
        return {}

    existing = db.execute(select(Company.id, Company.name).where(Company.name.in_(normalized))).all()
    company_map = {str(row.name): int(row.id) for row in existing}
    missing = [name for name in normalized if name not in company_map]

    for chunk in _chunked(missing, 1000):
        insert_stmt = pg_insert(Company).values([{"name": name} for name in chunk])
        db.execute(insert_stmt.on_conflict_do_nothing(index_elements=[Company.name]))

    if missing:
        db.flush()
        existing = db.execute(select(Company.id, Company.name).where(Company.name.in_(normalized))).all()
        company_map = {str(row.name): int(row.id) for row in existing}

    return company_map


def _ensure_facilities_bulk(
    db: Session,
    *,
    rows: list[dict[str, object]],
) -> dict[tuple[int, str], int]:
    normalized: dict[tuple[int, str], str | None] = {}
    for row in rows:
        company_id = int(row["company_id"])
        facility_name = str(row["facility_name"]).strip()
        if not facility_name:
            continue
        raw_region = row.get("region")
        region = str(raw_region).strip() if isinstance(raw_region, str) else ""
        normalized[(company_id, facility_name)] = region or None

    if not normalized:
        return {}

    payload = [
        {
            "company_id": company_id,
            "name": facility_name,
            "region": region,
        }
        for (company_id, facility_name), region in normalized.items()
    ]

    for chunk in _chunked(payload, 2000):
        insert_stmt = pg_insert(Facility).values(chunk)
        db.execute(
            insert_stmt.on_conflict_do_update(
                constraint="uq_facility_company_name",
                set_={"region": insert_stmt.excluded.region},
            )
        )

    db.flush()

    keys = list(normalized.keys())
    fetched = []
    for chunk in _chunked(keys, 2000):
        fetched.extend(
            db.execute(
                select(Facility.id, Facility.company_id, Facility.name).where(
                    tuple_(Facility.company_id, Facility.name).in_(chunk)
                )
            ).all()
        )

    return {
        (int(row.company_id), str(row.name)): int(row.id)
        for row in fetched
    }


def _bulk_upsert_monthly_consumption_utility(
    db: Session,
    *,
    cleaned: pd.DataFrame,
    utility: str,
) -> int:
    utility_key = utility.strip().lower()
    if cleaned.empty:
        return 0

    frame = cleaned.copy()
    frame["company_name"] = frame["company_name"].astype("string").str.strip()
    frame["facility_name"] = frame["facility_name"].astype("string").str.strip()
    frame["region"] = frame["region"].fillna("").astype("string").str.strip()

    company_map = _ensure_companies_bulk(db, frame["company_name"].dropna().tolist())
    if not company_map:
        return 0

    frame["company_id"] = frame["company_name"].map(company_map)
    frame = frame.dropna(subset=["company_id"])
    frame["company_id"] = frame["company_id"].astype(int)

    facility_rows = frame[["company_id", "facility_name", "region"]].to_dict("records")
    facility_map = _ensure_facilities_bulk(db, rows=facility_rows)
    if not facility_map:
        return 0

    frame["facility_id"] = frame.apply(
        lambda row: facility_map.get((int(row["company_id"]), str(row["facility_name"]))),
        axis=1,
    )
    frame = frame.dropna(subset=["facility_id"])
    frame["facility_id"] = frame["facility_id"].astype(int)

    payload: list[dict[str, float | int]] = []
    for row in frame.itertuples(index=False):
        year = int(row.year)
        month = int(row.month)
        if utility_key == "electricity":
            electricity_kwh = float(row.electricity_kwh)
            electricity_cost_usd = float(row.electricity_cost_usd)
            water_m3 = max(80.0, electricity_kwh * 0.36)
            water_cost_usd = max(30.0, water_m3 * 1.25)
            co2_raw = getattr(row, "co2_avoided_ton", None)
            co2_avoided_ton = float(co2_raw) if co2_raw is not None and not pd.isna(co2_raw) else max(0.05, electricity_kwh * 0.00022)
        else:
            water_m3 = float(row.water_m3)
            water_cost_usd = float(row.water_cost_usd)
            electricity_kwh = max(250.0, water_m3 * 2.7)
            electricity_cost_usd = max(60.0, electricity_kwh * 0.11)
            co2_raw = getattr(row, "co2_avoided_ton", None)
            co2_avoided_ton = float(co2_raw) if co2_raw is not None and not pd.isna(co2_raw) else max(0.05, electricity_kwh * 0.0002)

        payload.append(
            {
                "facility_id": int(row.facility_id),
                "year": year,
                "month": month,
                "electricity_kwh": electricity_kwh,
                "water_m3": water_m3,
                "electricity_cost_usd": electricity_cost_usd,
                "water_cost_usd": water_cost_usd,
                "co2_avoided_ton": co2_avoided_ton,
            }
        )

    for chunk in _chunked(payload, 5000):
        insert_stmt = pg_insert(MonthlyConsumption).values(chunk)
        if utility_key == "electricity":
            upsert_stmt = insert_stmt.on_conflict_do_update(
                constraint="uq_monthly_consumption",
                set_={
                    "electricity_kwh": insert_stmt.excluded.electricity_kwh,
                    "electricity_cost_usd": insert_stmt.excluded.electricity_cost_usd,
                    "co2_avoided_ton": insert_stmt.excluded.co2_avoided_ton,
                },
            )
        else:
            upsert_stmt = insert_stmt.on_conflict_do_update(
                constraint="uq_monthly_consumption",
                set_={
                    "water_m3": insert_stmt.excluded.water_m3,
                    "water_cost_usd": insert_stmt.excluded.water_cost_usd,
                    "co2_avoided_ton": insert_stmt.excluded.co2_avoided_ton,
                },
            )
        db.execute(upsert_stmt)

    db.flush()
    return len(payload)


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


def _default_counterpart_values(utility: str, row: pd.Series) -> tuple[float, float]:
    utility_key = utility.strip().lower()
    if utility_key == "electricity":
        electricity_kwh = float(row.get("electricity_kwh", 0) or 0)
        water_m3 = max(80.0, electricity_kwh * 0.36)
        water_cost_usd = max(30.0, water_m3 * 1.25)
        return water_m3, water_cost_usd

    water_m3 = float(row.get("water_m3", 0) or 0)
    electricity_kwh = max(250.0, water_m3 * 2.7)
    electricity_cost_usd = max(60.0, electricity_kwh * 0.11)
    return electricity_kwh, electricity_cost_usd


def _upsert_monthly_consumption_utility(
    db: Session,
    *,
    facility_id: int,
    row: pd.Series,
    utility: str,
) -> MonthlyConsumption:
    utility_key = utility.strip().lower()
    record = db.scalar(
        select(MonthlyConsumption).where(
            MonthlyConsumption.facility_id == facility_id,
            MonthlyConsumption.year == int(row["year"]),
            MonthlyConsumption.month == int(row["month"]),
        )
    )

    co2_value = row.get("co2_avoided_ton")
    co2_is_valid = co2_value is not None and not pd.isna(co2_value)

    if utility_key == "electricity":
        electricity_kwh = float(row["electricity_kwh"])
        electricity_cost_usd = float(row["electricity_cost_usd"])
        default_water_m3, default_water_cost_usd = _default_counterpart_values("electricity", row)
        if not record:
            record = MonthlyConsumption(
                facility_id=facility_id,
                year=int(row["year"]),
                month=int(row["month"]),
                electricity_kwh=electricity_kwh,
                water_m3=default_water_m3,
                electricity_cost_usd=electricity_cost_usd,
                water_cost_usd=default_water_cost_usd,
                co2_avoided_ton=float(co2_value) if co2_is_valid else max(0.05, electricity_kwh * 0.00022),
            )
            db.add(record)
            db.flush()
            return record

        record.electricity_kwh = electricity_kwh
        record.electricity_cost_usd = electricity_cost_usd
        if co2_is_valid:
            record.co2_avoided_ton = float(co2_value)
        db.flush()
        return record

    water_m3 = float(row["water_m3"])
    water_cost_usd = float(row["water_cost_usd"])
    default_electricity_kwh, default_electricity_cost_usd = _default_counterpart_values("water", row)
    if not record:
        record = MonthlyConsumption(
            facility_id=facility_id,
            year=int(row["year"]),
            month=int(row["month"]),
            electricity_kwh=default_electricity_kwh,
            water_m3=water_m3,
            electricity_cost_usd=default_electricity_cost_usd,
            water_cost_usd=water_cost_usd,
            co2_avoided_ton=float(co2_value) if co2_is_valid else max(0.05, default_electricity_kwh * 0.0002),
        )
        db.add(record)
        db.flush()
        return record

    record.water_m3 = water_m3
    record.water_cost_usd = water_cost_usd
    if co2_is_valid:
        record.co2_avoided_ton = float(co2_value)
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


FUEL_REQUIRED_COLUMNS = {"vehicle_id", "vehicle_cat", "fuel_type", "fecha", "dist_km", "precio_litro_clp"}
FUEL_VALID_VEHICLE_CATS = {"Van", "Truck", "Bus", "Car"}
FUEL_VALID_FUEL_TYPES = {"D", "G"}


def run_etl_from_fuel_csv(db: Session, csv_path: str, source_filename: str | None = None) -> ETLJob:
    started_at = datetime.now(timezone.utc)
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"No se encontró archivo CSV: {csv_path}")

    source_name = source_filename or path.name
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]

    missing = FUEL_REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(
            f"CSV inválido. Faltan columnas: {', '.join(sorted(missing))}. "
            f"Descarga la plantilla para ver el formato esperado."
        )

    initial_rows = len(df)

    for col in ("vehicle_id", "vehicle_cat", "fuel_type"):
        df[col] = df[col].astype("string").str.strip()
    df["vehicle_id"] = df["vehicle_id"].str.upper()

    df = df.dropna(subset=list(FUEL_REQUIRED_COLUMNS))
    df = df[df["vehicle_cat"].isin(FUEL_VALID_VEHICLE_CATS)]
    df = df[df["fuel_type"].isin(FUEL_VALID_FUEL_TYPES)]

    for col in ("dist_km", "fuel_liters_real", "km_per_liter", "precio_litro_clp"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["dist_km", "precio_litro_clp"])
    df = df[(df["dist_km"] > 0) & (df["precio_litro_clp"] > 0)]
    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
    df = df.dropna(subset=["fecha"])

    if df.empty:
        raise ValueError(
            "CSV sin filas válidas tras la limpieza. "
            "Verifica que vehicle_cat sea Van/Truck/Bus/Car, fuel_type sea D/G, "
            "y que fecha tenga formato YYYY-MM-DD."
        )

    rejected = initial_rows - len(df)
    records = []
    for row in df.itertuples(index=False):
        fuel_liters = None
        if "fuel_liters_real" in df.columns:
            v = getattr(row, "fuel_liters_real", None)
            if v is not None and not pd.isna(v) and float(v) > 0:
                fuel_liters = float(v)

        km_per_liter = None
        if "km_per_liter" in df.columns:
            v = getattr(row, "km_per_liter", None)
            if v is not None and not pd.isna(v) and float(v) > 0:
                km_per_liter = float(v)

        notas = None
        if "notas" in df.columns:
            v = getattr(row, "notas", None)
            if v is not None and str(v).strip().lower() not in ("", "nan", "none"):
                notas = str(v).strip()[:255]

        fecha_dt = row.fecha.to_pydatetime()
        if fecha_dt.tzinfo is None:
            fecha_dt = fecha_dt.replace(tzinfo=timezone.utc)

        records.append(FuelTransaction(
            vehicle_id=str(row.vehicle_id),
            vehicle_cat=str(row.vehicle_cat),
            fuel_type=str(row.fuel_type),
            fecha=fecha_dt,
            dist_km=float(row.dist_km),
            fuel_liters_real=fuel_liters,
            km_per_liter=km_per_liter,
            precio_litro_clp=float(row.precio_litro_clp),
            notas=notas,
        ))

    db.bulk_save_objects(records)
    db.flush()

    finished_at = datetime.now(timezone.utc)
    job = ETLJob(
        source_filename=source_name,
        rows_processed=len(records),
        rows_rejected=rejected,
        status="completed",
        notes=f"Importación de transacciones de flota: {len(records)} registros insertados, {rejected} rechazados",
        started_at=started_at,
        finished_at=finished_at,
    )
    db.add(job)

    log_activity(
        db,
        activity_type="etl",
        message=f"Importación de transacciones de flota desde {source_name}",
        metadata={"rows_processed": len(records), "rows_rejected": rejected},
    )

    db.flush()
    return job


RESOURCE_VALID_CODES = {
    "gas_natural", "gasolina", "glp_propano", "vapor_termica",
    "energia_renovable", "residuos", "emisiones_co2e", "quimicos_consumibles",
}

_RESOURCE_EMISSION_FACTORS: dict[str, float] = {
    "gas_natural":        0.0019,
    "gasolina":           0.00231,
    "glp_propano":        0.00300,
    "vapor_termica":      0.040,
    "energia_renovable":  0.00005,
    "residuos":           0.0008,
    "emisiones_co2e":     1.0,
    "quimicos_consumibles": 0.0006,
}

_RESOURCE_COST_FACTORS: dict[str, float] = {
    "gas_natural":        0.55,
    "gasolina":           1.35,
    "glp_propano":        0.95,
    "vapor_termica":      12.0,
    "energia_renovable":  0.08,
    "residuos":           0.20,
    "emisiones_co2e":     18.0,
    "quimicos_consumibles": 2.5,
}


def run_etl_from_resource_csv(
    db: Session,
    *,
    code: str,
    csv_path: str,
    source_filename: str | None = None,
) -> ETLJob:
    """Carga mensual para cualquier recurso fiscalizado excepto electricidad, agua y combustibles de flota.

    Formato CSV esperado: year,month,consumption_value,cost_usd
    - cost_usd es opcional; si no se indica se estima con el factor de costo del recurso.
    """
    started_at = datetime.now(timezone.utc)
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"No se encontró archivo CSV: {csv_path}")

    if code not in RESOURCE_VALID_CODES:
        raise ValueError(
            f"Código de recurso no válido: '{code}'. "
            f"Válidos: {', '.join(sorted(RESOURCE_VALID_CODES))}"
        )

    source_name = source_filename or path.name
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]

    missing = {"year", "month", "consumption_value"} - set(df.columns)
    if missing:
        raise ValueError(
            f"Faltan columnas obligatorias: {', '.join(sorted(missing))}. "
            "Formato esperado: year,month,consumption_value,cost_usd"
        )

    initial_rows = len(df)

    for col in ("year", "month", "consumption_value"):
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["year", "month", "consumption_value"])
    df = df[(df["year"] >= 2000) & (df["year"] <= 2100)]
    df = df[(df["month"] >= 1) & (df["month"] <= 12)]
    df = df[df["consumption_value"] >= 0]

    if "cost_usd" in df.columns:
        df["cost_usd"] = pd.to_numeric(df["cost_usd"], errors="coerce").fillna(0.0)
    else:
        df["cost_usd"] = 0.0

    rejected = initial_rows - len(df)

    if df.empty:
        raise ValueError(
            "CSV sin filas válidas. "
            "Verifica que year (2000-2100), month (1-12) y consumption_value sean numéricos y no negativos."
        )

    resource_type = db.scalar(
        select(ResourceType).where(ResourceType.code == code, ResourceType.is_active.is_(True))
    )
    if not resource_type:
        raise ValueError(f"Recurso '{code}' no encontrado.")

    facility_id = db.scalar(select(Facility.id).order_by(Facility.id.asc()).limit(1))
    if not facility_id:
        raise ValueError("No existe ninguna instalación configurada en el sistema.")

    emission_factor = _RESOURCE_EMISSION_FACTORS.get(code, 0.0)
    cost_factor     = _RESOURCE_COST_FACTORS.get(code, 1.0)

    processed = 0
    for row in df.itertuples(index=False):
        year  = int(row.year)
        month = int(row.month)
        value = float(row.consumption_value)
        cost_raw = float(getattr(row, "cost_usd", 0.0) or 0.0)
        cost = cost_raw if cost_raw > 0 else round(value * cost_factor, 4)
        emissions = value if code == "emisiones_co2e" else round(value * emission_factor, 6)

        record = db.scalar(
            select(ResourceMonthlyConsumption).where(
                ResourceMonthlyConsumption.resource_type_id == resource_type.id,
                ResourceMonthlyConsumption.facility_id == facility_id,
                ResourceMonthlyConsumption.year == year,
                ResourceMonthlyConsumption.month == month,
            )
        )
        if record:
            record.consumption_value = max(0.0, value)
            record.cost_usd          = max(0.0, cost)
            record.emissions_tco2e   = max(0.0, emissions)
            record.source            = "csv_upload"
        else:
            record = ResourceMonthlyConsumption(
                resource_type_id=resource_type.id,
                facility_id=facility_id,
                year=year,
                month=month,
                consumption_value=max(0.0, value),
                cost_usd=max(0.0, cost),
                emissions_tco2e=max(0.0, emissions),
                source="csv_upload",
            )
            db.add(record)

        db.flush()
        processed += 1

    finished_at = datetime.now(timezone.utc)
    job = ETLJob(
        source_filename=source_name,
        rows_processed=processed,
        rows_rejected=rejected,
        status="completed",
        notes=f"Carga de {resource_type.name}: {processed} períodos actualizados, {rejected} filas rechazadas",
        started_at=started_at,
        finished_at=finished_at,
    )
    db.add(job)

    log_activity(
        db,
        activity_type="etl",
        message=f"Carga de {resource_type.name} desde {source_name}",
        metadata={"code": code, "rows_processed": processed, "rows_rejected": rejected},
    )

    db.flush()
    return job


def run_etl_from_utility_csv(
    db: Session,
    *,
    csv_path: str,
    utility: str,
    source_filename: str | None = None,
) -> ETLJob:
    utility_key = utility.strip().lower()
    if utility_key not in {"electricity", "water"}:
        raise ValueError("Utilidad no soportada. Debe ser 'electricity' o 'water'.")

    started_at = datetime.now(timezone.utc)
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"No se encontró archivo CSV: {csv_path}")

    source_name = source_filename or path.name
    df = pd.read_csv(path)
    cleaned, rejected = _clean_utility_dataframe(df, utility_key)
    # Catálogo de recursos se mantiene inicializado, pero en ETL parcial evitamos
    # cargar consumos de recursos para priorizar velocidad y actualización de vistas
    # eléctricas/hídricas.
    ensure_resource_catalog(db)
    processed = _bulk_upsert_monthly_consumption_utility(
        db,
        cleaned=cleaned,
        utility=utility_key,
    )

    finished_at = datetime.now(timezone.utc)
    job = ETLJob(
        source_filename=source_name,
        rows_processed=processed,
        rows_rejected=rejected,
        status="completed",
        notes=f"Proceso ETL {utility_key} ejecutado correctamente (modo rápido por módulo)",
        started_at=started_at,
        finished_at=finished_at,
    )
    db.add(job)

    log_activity(
        db,
        activity_type="etl",
        message=f"ETL {utility_key} ejecutado sobre {source_name}",
        metadata={
            "utility": utility_key,
            "rows_processed": processed,
            "rows_rejected": rejected,
        },
    )

    db.flush()
    return job
