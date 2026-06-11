from __future__ import annotations

from statistics import median

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


def _percentile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    q_clamped = min(1.0, max(0.0, q))
    index = (len(ordered) - 1) * q_clamped
    low = int(index)
    high = min(low + 1, len(ordered) - 1)
    if low == high:
        return ordered[low]
    weight = index - low
    return ordered[low] * (1.0 - weight) + ordered[high] * weight


def _add_peak_alerts(
    db: Session,
    *,
    utility: str,
    threshold_pct: float,
    series: list[tuple[tuple[int, int], float]],
) -> int:
    values = [value for _, value in series if value > 0]
    if len(values) < 8:
        return 0

    med = median(values)
    q75 = _percentile(values, 0.75)
    base_threshold = max(q75 * 1.01, med * 1.08)

    created = 0
    ranked = sorted(series, key=lambda item: item[1], reverse=True)[:6]
    for (year, month), value in ranked:
        if value < base_threshold:
            continue
        gap_pct = ((value - med) / max(med, 1.0)) * 100.0
        severity = "critical" if gap_pct >= max(45.0, threshold_pct * 2.0) else "warning"
        utility_label = "eléctrico" if utility == "electricity" else "hídrico"
        db.add(
            SmartAlert(
                severity=severity,
                title=f"Pico {utility_label} detectado",
                description=(
                    f"{month_label(year, month)} superó el patrón histórico "
                    f"({gap_pct:+.1f}% vs mediana)."
                ),
                utility=utility,
                year=year,
                month=month,
                extra_data={
                    "source": "anomaly_engine",
                    "kind": "historical_peak",
                    "change_pct": round(gap_pct, 2),
                    "value": round(value, 2),
                    "baseline_median": round(med, 2),
                },
            )
        )
        created += 1

    # Fallback para series estables: igualmente reportar los máximos históricos.
    if created == 0:
        for (year, month), value in ranked[:2]:
            gap_pct = ((value - med) / max(med, 1.0)) * 100.0
            if gap_pct < 4.0:
                continue
            utility_label = "eléctrico" if utility == "electricity" else "hídrico"
            db.add(
                SmartAlert(
                    severity="warning",
                    title=f"Pico {utility_label} detectado",
                    description=(
                        f"{month_label(year, month)} figura entre los máximos históricos "
                        f"({gap_pct:+.1f}% vs mediana)."
                    ),
                    utility=utility,
                    year=year,
                    month=month,
                    extra_data={
                        "source": "anomaly_engine",
                        "kind": "historical_peak",
                        "change_pct": round(gap_pct, 2),
                        "value": round(value, 2),
                        "baseline_median": round(med, 2),
                    },
                )
            )
            created += 1

    annual: dict[int, float] = {}
    for (year, _month), value in series:
        annual[year] = annual.get(year, 0.0) + value

    years = sorted(annual.keys())
    for idx in range(1, len(years)):
        prev_year = years[idx - 1]
        cur_year = years[idx]
        prev_value = annual[prev_year]
        cur_value = annual[cur_year]
        if prev_value <= 0:
            continue
        yoy_pct = ((cur_value - prev_value) / prev_value) * 100.0
        if yoy_pct < max(18.0, threshold_pct * 1.2):
            continue
        utility_label = "eléctrico" if utility == "electricity" else "de agua"
        db.add(
            SmartAlert(
                severity=_severity(yoy_pct, max(18.0, threshold_pct * 1.2)),
                title=f"Pico anual {utility_label}",
                description=(
                    f"El año {cur_year} subió {yoy_pct:+.1f}% respecto a {prev_year} "
                    f"en consumo {utility_label}."
                ),
                utility=utility,
                year=cur_year,
                month=None,
                extra_data={
                    "source": "anomaly_engine",
                    "kind": "annual_spike",
                    "change_pct": round(yoy_pct, 2),
                    "value": round(cur_value, 2),
                    "previous_value": round(prev_value, 2),
                },
            )
        )
        created += 1

    return created


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

        if abs(water_change) >= cfg.volatility_threshold_pct:
            db.add(
                SmartAlert(
                    severity="warning",
                    title="Variación brusca de agua",
                    description=f"Cambio de {water_change:.1f}% detectado en {month_label(cur_key[0], cur_key[1])}.",
                    utility="water",
                    year=cur_key[0],
                    month=cur_key[1],
                    extra_data={"source": "anomaly_engine", "kind": "volatility", "change_pct": round(water_change, 2)},
                )
            )
            created += 1

    electricity_series = [
        (key, breakdown[key]["electricity_kwh"])
        for key in sorted_months
    ]
    water_series = [
        (key, breakdown[key]["water_m3"])
        for key in sorted_months
    ]
    created += _add_peak_alerts(
        db,
        utility="electricity",
        threshold_pct=cfg.electricity_threshold_pct,
        series=electricity_series,
    )
    created += _add_peak_alerts(
        db,
        utility="water",
        threshold_pct=cfg.water_threshold_pct,
        series=water_series,
    )

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
