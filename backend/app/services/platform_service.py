from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import AlertConfig, Company, ETLSchedule, EfficiencyTarget

_CACHE: dict[str, Any] = {}


def _default_platform_config() -> dict[str, Any]:
    settings = get_settings()
    return {
        "profile": {
            "name": "fallback-default",
            "version": settings.app_version,
            "owner": settings.app_name,
        },
        "organization": {
            "default_company_name": settings.default_company_name,
            "industry": None,
            "timezone": "America/Santiago",
        },
        "dashboard": {
            "title": "Dashboard de Eficiencia Energética",
            "default_timeseries_months": 12,
            "show_costs_in": "USD",
        },
        "alerts": {
            "electricity_threshold_pct": settings.default_alert_electricity_threshold_pct,
            "water_threshold_pct": settings.default_alert_water_threshold_pct,
            "volatility_threshold_pct": settings.default_alert_volatility_threshold_pct,
        },
        "etl": {
            "cron_expression": "0 6 1 * *",
            "enabled": True,
            "source_priority": ["csv", "api", "manual"],
        },
        "ml": {
            "default_horizon_months": 3,
            "algorithm": "RandomForestRegressor",
            "min_required_months": 6,
        },
        "efficiency_targets": [
            {"metric_name": "electricity_kwh", "target_value": 5200.0, "unit": "kWh"},
            {"metric_name": "water_m3", "target_value": 2500.0, "unit": "m3"},
            {"metric_name": "co2_avoided_ton", "target_value": 1.6, "unit": "Ton"},
        ],
    }


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    for key, value in override.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value
    return base


def _load_from_file(path: Path) -> tuple[dict[str, Any], str]:
    if not path.exists():
        return _default_platform_config(), "defaults"

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raise ValueError("El JSON de plataforma debe ser un objeto.")
    except Exception:
        return _default_platform_config(), "defaults_invalid_json"

    merged = _deep_merge(_default_platform_config(), raw)
    return merged, "file"


def get_platform_config(force_reload: bool = False) -> dict[str, Any]:
    settings = get_settings()
    path = Path(settings.platform_config_path)

    mtime = path.stat().st_mtime if path.exists() else None
    cache_key = f"{path}:{mtime}"

    if not force_reload and _CACHE.get("cache_key") == cache_key:
        return _CACHE["payload"]

    config, source = _load_from_file(path)
    payload = {
        "source": source,
        "path": str(path),
        "loaded_at": datetime.now(timezone.utc),
        "config": deepcopy(config),
    }

    _CACHE["cache_key"] = cache_key
    _CACHE["payload"] = payload
    return payload


def apply_platform_config_to_db(db: Session, force_reload: bool = False) -> dict[str, Any]:
    payload = get_platform_config(force_reload=force_reload)
    cfg = payload["config"]

    org_cfg = cfg.get("organization", {})
    company_name = str(org_cfg.get("default_company_name") or "Green Glow Industries").strip()
    company = db.scalar(select(Company).where(Company.name == company_name))
    created_company = False
    if not company:
        company = Company(
            name=company_name,
            industry=org_cfg.get("industry"),
        )
        db.add(company)
        created_company = True

    alert_cfg = cfg.get("alerts", {})
    alert_record = db.get(AlertConfig, 1)
    if not alert_record:
        alert_record = AlertConfig(id=1)
        db.add(alert_record)

    alert_record.electricity_threshold_pct = float(alert_cfg.get("electricity_threshold_pct", 20))
    alert_record.water_threshold_pct = float(alert_cfg.get("water_threshold_pct", 18))
    alert_record.volatility_threshold_pct = float(alert_cfg.get("volatility_threshold_pct", 15))

    etl_cfg = cfg.get("etl", {})
    etl_schedule = db.get(ETLSchedule, 1)
    if not etl_schedule:
        etl_schedule = ETLSchedule(id=1)
        db.add(etl_schedule)

    etl_schedule.cron_expression = str(etl_cfg.get("cron_expression", "0 6 1 * *"))
    etl_schedule.enabled = bool(etl_cfg.get("enabled", True))

    # Deduplicate config entries by (metric_name, unit) and handle pending rows
    # because SessionLocal is configured with autoflush=False.
    normalized_targets: dict[tuple[str, str], float] = {}
    for target in cfg.get("efficiency_targets", []):
        metric_name = str(target.get("metric_name", "")).strip()
        unit = str(target.get("unit", "")).strip()
        target_value = float(target.get("target_value", 0) or 0)
        if not metric_name or not unit or target_value <= 0:
            continue
        normalized_targets[(metric_name, unit)] = target_value

    pending_targets = {
        (obj.metric_name, obj.unit): obj
        for obj in db.new
        if isinstance(obj, EfficiencyTarget)
    }

    targets_upserted = 0
    for (metric_name, unit), target_value in normalized_targets.items():
        existing = pending_targets.get((metric_name, unit))
        if not existing:
            existing = db.scalar(
                select(EfficiencyTarget).where(
                    EfficiencyTarget.metric_name == metric_name,
                    EfficiencyTarget.unit == unit,
                )
            )

        if existing:
            existing.target_value = target_value
        else:
            db.add(
                EfficiencyTarget(
                    metric_name=metric_name,
                    unit=unit,
                    target_value=target_value,
                )
            )
        targets_upserted += 1

    db.flush()

    return {
        "source": payload["source"],
        "path": payload["path"],
        "loaded_at": payload["loaded_at"],
        "created_company": created_company,
        "company_name": company_name,
        "targets_upserted": targets_upserted,
        "cron_expression": etl_schedule.cron_expression,
        "etl_enabled": etl_schedule.enabled,
        "alert_thresholds": {
            "electricity_threshold_pct": alert_record.electricity_threshold_pct,
            "water_threshold_pct": alert_record.water_threshold_pct,
            "volatility_threshold_pct": alert_record.volatility_threshold_pct,
        },
    }
