from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import AlertConfig, SmartAlert
from app.services.activity_service import log_activity
from app.services.dashboard_service import month_breakdown
from app.utils.date_utils import month_label


def get_or_create_alert_config(db: Session) -> AlertConfig:
    cfg = db.get(AlertConfig, 1)
    if cfg:
        return cfg

    settings = get_settings()
    cfg = AlertConfig(
        id=1,
        electricity_threshold_pct=settings.default_alert_electricity_threshold_pct,
        water_threshold_pct=settings.default_alert_water_threshold_pct,
        volatility_threshold_pct=settings.default_alert_volatility_threshold_pct,
    )
    db.add(cfg)
    db.flush()
    return cfg


def update_alert_config(
    db: Session,
    electricity_threshold_pct: float,
    water_threshold_pct: float,
    volatility_threshold_pct: float,
) -> AlertConfig:
    cfg = get_or_create_alert_config(db)
    cfg.electricity_threshold_pct = electricity_threshold_pct
    cfg.water_threshold_pct = water_threshold_pct
    cfg.volatility_threshold_pct = volatility_threshold_pct
    db.flush()

    log_activity(
        db,
        activity_type="alert_config",
        message="Configuración de alertas actualizada",
        metadata={
            "electricity_threshold_pct": electricity_threshold_pct,
            "water_threshold_pct": water_threshold_pct,
            "volatility_threshold_pct": volatility_threshold_pct,
        },
    )
    return cfg


def _severity(change_pct: float, threshold: float) -> str:
    if change_pct >= threshold * 1.4:
        return "critical"
    if change_pct >= threshold:
        return "warning"
    return "info"


def regenerate_anomaly_alerts(db: Session) -> int:
    cfg = get_or_create_alert_config(db)

    existing_auto_alerts = db.scalars(select(SmartAlert).where(SmartAlert.is_resolved.is_(False))).all()
    for alert in existing_auto_alerts:
        if (alert.extra_data or {}).get("source") == "anomaly_engine":
            db.delete(alert)

    breakdown = month_breakdown(db)
    sorted_months = sorted(breakdown.keys())
    created = 0

    for idx in range(1, len(sorted_months)):
        prev_key = sorted_months[idx - 1]
        cur_key = sorted_months[idx]

        prev = breakdown[prev_key]
        cur = breakdown[cur_key]

        electricity_change = ((cur["electricity_kwh"] - prev["electricity_kwh"]) / max(prev["electricity_kwh"], 1.0)) * 100
        water_change = ((cur["water_m3"] - prev["water_m3"]) / max(prev["water_m3"], 1.0)) * 100

        if electricity_change >= cfg.electricity_threshold_pct:
            db.add(
                SmartAlert(
                    severity=_severity(electricity_change, cfg.electricity_threshold_pct),
                    title="Consumo eléctrico elevado",
                    description=f"{month_label(cur_key[0], cur_key[1])} registró +{electricity_change:.1f}% vs mes anterior.",
                    utility="electricity",
                    year=cur_key[0],
                    month=cur_key[1],
                    extra_data={"source": "anomaly_engine", "change_pct": round(electricity_change, 2)},
                )
            )
            created += 1

        if water_change >= cfg.water_threshold_pct:
            db.add(
                SmartAlert(
                    severity=_severity(water_change, cfg.water_threshold_pct),
                    title="Consumo de agua elevado",
                    description=f"{month_label(cur_key[0], cur_key[1])} registró +{water_change:.1f}% vs mes anterior.",
                    utility="water",
                    year=cur_key[0],
                    month=cur_key[1],
                    extra_data={"source": "anomaly_engine", "change_pct": round(water_change, 2)},
                )
            )
            created += 1

        if abs(electricity_change) >= cfg.volatility_threshold_pct:
            db.add(
                SmartAlert(
                    severity="warning",
                    title="Variación brusca de electricidad",
                    description=f"Cambio de {electricity_change:.1f}% detectado en {month_label(cur_key[0], cur_key[1])}.",
                    utility="electricity",
                    year=cur_key[0],
                    month=cur_key[1],
                    extra_data={"source": "anomaly_engine", "kind": "volatility", "change_pct": round(electricity_change, 2)},
                )
            )
            created += 1

    db.flush()
    return created


def add_info_alert_if_empty(db: Session) -> None:
    has_alerts = db.scalar(select(SmartAlert.id).limit(1))
    if has_alerts:
        return

    db.add(
        SmartAlert(
            severity="info",
            title="Sistema inicializado",
            description="Carga datos para comenzar el monitoreo inteligente de consumo.",
            utility=None,
            extra_data={"source": "bootstrap"},
        )
    )
