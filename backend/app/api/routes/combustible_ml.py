"""
Módulo de IA para gestión de combustible de flota.
Detección automática de ineficiencias operativas, trazabilidad y reporte RETC.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.models import FuelPredictionLog, FuelTransaction

router = APIRouter(prefix="/combustible-ml", tags=["combustible-ml"])

_MODEL_PATH = Path(__file__).parent.parent.parent.parent / "data" / "modelo_combustible.joblib"
_CO2_FACTOR: dict[str, float] = {"D": 2.68, "G": 1.89}
_MEJORA_EFICIENCIA_PCT = 10.0
_UMBRAL_ANOMALIA_PCT = 10.0

_model = None


def _get_model():
    global _model
    if _model is None:
        if not _MODEL_PATH.exists():
            raise HTTPException(
                status_code=503,
                detail="Modelo de combustible no disponible. Coloque modelo_combustible.joblib en backend/data/",
            )
        _model = joblib.load(_MODEL_PATH)
    return _model


def _predecir_litros(
    model,
    dist_km: float,
    km_per_liter: Optional[float],
    vehicle_cat: str,
    fuel_type: str,
) -> float:
    kpl = km_per_liter if km_per_liter is not None else np.nan
    litros_teo = dist_km / kpl if km_per_liter is not None else np.nan
    features = pd.DataFrame([{
        "dist_km":         dist_km,
        "km_per_liter":    kpl,
        "litros_teoricos": litros_teo,
        "vehicle_cat":     vehicle_cat,
        "fuel_type":       fuel_type,
        "year":            "2018-19",
    }])
    log_pred = float(model.predict(features)[0])
    return max(float(np.expm1(log_pred)), 0.0)


# ─── Schemas ──────────────────────────────────────────────────────────────────

class FuelPredictionRequest(BaseModel):
    vehicle_cat: Literal["Van", "Truck", "Bus", "Car"] = Field(..., description="Categoría del vehículo")
    fuel_type: Literal["D", "G"] = Field(..., description="D=Diésel, G=Gas Oil")
    dist_km: float = Field(..., gt=0)
    km_per_liter: Optional[float] = Field(default=None, gt=0)
    precio_litro_clp: float = Field(default=1050.0, gt=0)


class EscenarioOptimizacion(BaseModel):
    km_per_liter_efectivo: float
    km_per_liter_mejorado: float
    fuel_liters_mejorado: float
    costo_clp_mejorado: float
    co2_kg_mejorado: float
    ahorro_litros: float
    ahorro_clp: float
    ahorro_co2_kg: float
    mejora_eficiencia_pct: float


class FuelPredictionResponse(BaseModel):
    fuel_liters: float
    co2_kg: float
    co2_toneladas: float
    costo_clp: float
    costo_por_km_clp: float
    fuel_type_label: str
    vehicle_cat: str
    dist_km: float
    km_per_liter_usado: float
    km_per_liter_fue_imputado: bool
    precio_litro_clp: float
    model_name: str
    error_rel_pct: float
    optimizacion: EscenarioOptimizacion


class FuelPredictionLogResponse(BaseModel):
    id: int
    vehicle_cat: str
    fuel_type: str
    dist_km: float
    km_per_liter_usado: float
    km_per_liter_fue_imputado: bool
    precio_litro_clp: float
    fuel_liters: float
    co2_kg: float
    costo_clp: float
    ahorro_litros: float
    ahorro_clp: float
    ahorro_co2_kg: float
    created_at: datetime

    model_config = {"from_attributes": True}


class FuelTransactionCreate(BaseModel):
    vehicle_id: str = Field(..., min_length=1, max_length=50)
    vehicle_cat: Literal["Van", "Truck", "Bus", "Car"]
    fuel_type: Literal["D", "G"]
    fecha: datetime
    dist_km: float = Field(..., gt=0)
    fuel_liters_real: Optional[float] = Field(default=None, gt=0)
    km_per_liter: Optional[float] = Field(default=None, gt=0)
    precio_litro_clp: float = Field(default=1050.0, gt=0)
    notas: Optional[str] = Field(default=None, max_length=255)


class FuelTransactionResponse(BaseModel):
    id: int
    vehicle_id: str
    vehicle_cat: str
    fuel_type: str
    fecha: datetime
    dist_km: float
    fuel_liters_real: Optional[float]
    km_per_liter: Optional[float]
    precio_litro_clp: float
    notas: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class AnomaliaFlota(BaseModel):
    id_transaccion: int
    vehicle_id: str
    vehicle_cat: str
    fecha: str
    fuel_liters_real: float
    fuel_liters_predicho: float
    desvio_pct: float
    severidad: Literal["baja", "media", "alta"]
    co2_exceso_kg: float
    precio_litro_clp: float
    costo_exceso_clp: float
    notas: Optional[str]


class ConsumoMensual(BaseModel):
    periodo: str
    year: int
    month: int
    label: str
    real_litros: float
    predicho_litros: float
    desvio_pct: float
    co2_real_kg: float
    co2_predicho_kg: float
    diesel_real_l: Optional[float] = None
    gasoil_real_l: Optional[float] = None
    diesel_pred_l: Optional[float] = None
    gasoil_pred_l: Optional[float] = None


class AnalisisFlotaResponse(BaseModel):
    precision_promedio_pct: float
    total_registros_analizados: int
    registros_con_desvio: int
    ahorro_proyectado_litros: float
    ahorro_proyectado_clp: float
    reduccion_co2_proyectada_kg: float
    anomalias: list[AnomaliaFlota]
    consumo_por_periodo: list[ConsumoMensual]
    modelo_info: dict[str, Any]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/predict", response_model=FuelPredictionResponse)
def predict_fuel(
    payload: FuelPredictionRequest,
    db: Session = Depends(get_db),
) -> FuelPredictionResponse:
    model = _get_model()
    co2_factor = _CO2_FACTOR[payload.fuel_type]
    fue_imputado = payload.km_per_liter is None

    fuel_liters = _predecir_litros(
        model, payload.dist_km, payload.km_per_liter,
        payload.vehicle_cat, payload.fuel_type,
    )

    km_pl_efectivo = (
        round(payload.dist_km / fuel_liters, 2) if fue_imputado and fuel_liters > 0
        else payload.km_per_liter or 1.0
    )

    co2_kg = round(fuel_liters * co2_factor, 2)
    costo_clp = round(fuel_liters * payload.precio_litro_clp, 0)
    costo_por_km = round(costo_clp / payload.dist_km, 1) if payload.dist_km > 0 else 0.0

    km_pl_opt = round(km_pl_efectivo * (1 + _MEJORA_EFICIENCIA_PCT / 100), 2)
    fuel_liters_opt = _predecir_litros(
        model, payload.dist_km, km_pl_opt,
        payload.vehicle_cat, payload.fuel_type,
    )
    fuel_liters_opt = round(fuel_liters_opt, 2)
    co2_kg_opt = round(fuel_liters_opt * co2_factor, 2)
    costo_opt = round(fuel_liters_opt * payload.precio_litro_clp, 0)

    ahorro_litros = round(fuel_liters - fuel_liters_opt, 2)
    ahorro_clp = round(costo_clp - costo_opt, 0)
    ahorro_co2_kg = round(co2_kg - co2_kg_opt, 2)

    optimizacion = EscenarioOptimizacion(
        km_per_liter_efectivo=km_pl_efectivo,
        km_per_liter_mejorado=km_pl_opt,
        fuel_liters_mejorado=fuel_liters_opt,
        costo_clp_mejorado=costo_opt,
        co2_kg_mejorado=co2_kg_opt,
        ahorro_litros=ahorro_litros,
        ahorro_clp=ahorro_clp,
        ahorro_co2_kg=ahorro_co2_kg,
        mejora_eficiencia_pct=_MEJORA_EFICIENCIA_PCT,
    )

    db.add(FuelPredictionLog(
        vehicle_cat=payload.vehicle_cat,
        fuel_type=payload.fuel_type,
        dist_km=payload.dist_km,
        km_per_liter_usado=km_pl_efectivo,
        km_per_liter_fue_imputado=fue_imputado,
        precio_litro_clp=payload.precio_litro_clp,
        fuel_liters=round(fuel_liters, 2),
        co2_kg=co2_kg,
        costo_clp=costo_clp,
        ahorro_litros=ahorro_litros,
        ahorro_clp=ahorro_clp,
        ahorro_co2_kg=ahorro_co2_kg,
    ))
    db.commit()

    return FuelPredictionResponse(
        fuel_liters=round(fuel_liters, 2),
        co2_kg=co2_kg,
        co2_toneladas=round(co2_kg / 1000, 4),
        costo_clp=costo_clp,
        costo_por_km_clp=costo_por_km,
        fuel_type_label="Diésel" if payload.fuel_type == "D" else "Gas Oil",
        vehicle_cat=payload.vehicle_cat,
        dist_km=payload.dist_km,
        km_per_liter_usado=km_pl_efectivo,
        km_per_liter_fue_imputado=fue_imputado,
        precio_litro_clp=payload.precio_litro_clp,
        model_name="Random Forest + litros_teoricos (Sprint 3 · err.rel 6.13%)",
        error_rel_pct=6.13,
        optimizacion=optimizacion,
    )


@router.get("/historial", response_model=list[FuelPredictionLogResponse])
def get_historial(
    limit: int = 20,
    db: Session = Depends(get_db),
) -> list[FuelPredictionLogResponse]:
    registros = (
        db.query(FuelPredictionLog)
        .order_by(FuelPredictionLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return registros


@router.get("/analisis-flota", response_model=AnalisisFlotaResponse)
def analisis_flota(db: Session = Depends(get_db)) -> AnalisisFlotaResponse:
    """
    Corre el modelo sobre todas las transacciones reales registradas.
    Detecta automáticamente ineficiencias operativas y las persiste
    para trazabilidad y reporte RETC.
    """
    model = _get_model()

    transacciones = (
        db.query(FuelTransaction)
        .filter(FuelTransaction.fuel_liters_real.isnot(None))
        .order_by(FuelTransaction.fecha)
        .all()
    )

    if not transacciones:
        return AnalisisFlotaResponse(
            precision_promedio_pct=0.0,
            total_registros_analizados=0,
            registros_con_desvio=0,
            ahorro_proyectado_litros=0.0,
            ahorro_proyectado_clp=0.0,
            reduccion_co2_proyectada_kg=0.0,
            anomalias=[],
            consumo_por_periodo=[],
            modelo_info={"nombre": "Random Forest + litros_teoricos", "error_relativo_pct": 6.13},
        )

    anomalias: list[AnomaliaFlota] = []
    precision_acum = 0.0
    total_exceso_litros = 0.0
    total_exceso_clp = 0.0
    total_exceso_co2 = 0.0

    # Agrupación mensual: {periodo: {diesel_real, gasoil_real, diesel_pred, gasoil_pred}}
    periodos: dict[str, dict[str, float]] = {}

    for t in transacciones:
        real = float(t.fuel_liters_real)  # type: ignore[arg-type]
        pred = _predecir_litros(model, t.dist_km, t.km_per_liter, t.vehicle_cat, t.fuel_type)
        desvio_pct = ((real - pred) / pred * 100) if pred > 0 else 0.0
        precision_acum += max(0.0, 100.0 - abs(desvio_pct))

        co2_factor = _CO2_FACTOR[t.fuel_type]
        periodo = t.fecha.strftime("%Y-%m")
        if periodo not in periodos:
            periodos[periodo] = {
                "year": t.fecha.year, "month": t.fecha.month,
                "diesel_real": 0.0, "gasoil_real": 0.0,
                "diesel_pred": 0.0, "gasoil_pred": 0.0,
            }
        if t.fuel_type == "D":
            periodos[periodo]["diesel_real"] += real
            periodos[periodo]["diesel_pred"] += pred
        else:
            periodos[periodo]["gasoil_real"] += real
            periodos[periodo]["gasoil_pred"] += pred

        if desvio_pct > _UMBRAL_ANOMALIA_PCT:
            if desvio_pct > 35:
                severidad = "alta"
            elif desvio_pct > 20:
                severidad = "media"
            else:
                severidad = "baja"

            exceso_litros = max(0.0, real - pred)
            exceso_co2 = round(exceso_litros * co2_factor, 2)
            exceso_clp = round(exceso_litros * t.precio_litro_clp, 0)

            total_exceso_litros += exceso_litros
            total_exceso_clp += exceso_clp
            total_exceso_co2 += exceso_co2

            anomalias.append(AnomaliaFlota(
                id_transaccion=t.id,
                vehicle_id=t.vehicle_id,
                vehicle_cat=t.vehicle_cat,
                fecha=t.fecha.strftime("%Y-%m-%d"),
                fuel_liters_real=round(real, 2),
                fuel_liters_predicho=round(pred, 2),
                desvio_pct=round(desvio_pct, 1),
                severidad=severidad,  # type: ignore[arg-type]
                co2_exceso_kg=exceso_co2,
                precio_litro_clp=t.precio_litro_clp,
                costo_exceso_clp=exceso_clp,
                notas=t.notas,
            ))

    precision_promedio = precision_acum / len(transacciones) if transacciones else 0.0

    # Construir series mensuales para el gráfico
    consumo_por_periodo: list[ConsumoMensual] = []
    for periodo_key in sorted(periodos.keys()):
        p = periodos[periodo_key]
        real_total = p["diesel_real"] + p["gasoil_real"]
        pred_total = p["diesel_pred"] + p["gasoil_pred"]
        desvio = ((real_total - pred_total) / pred_total * 100) if pred_total > 0 else 0.0
        year, month = p["year"], p["month"]
        label = f"{['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][month-1]} {year}"
        consumo_por_periodo.append(ConsumoMensual(
            periodo=periodo_key,
            year=year,
            month=month,
            label=label,
            real_litros=round(real_total, 2),
            predicho_litros=round(pred_total, 2),
            desvio_pct=round(desvio, 1),
            co2_real_kg=round(real_total * 2.5, 2),
            co2_predicho_kg=round(pred_total * 2.5, 2),
            diesel_real_l=round(p["diesel_real"], 2) if p["diesel_real"] > 0 else None,
            gasoil_real_l=round(p["gasoil_real"], 2) if p["gasoil_real"] > 0 else None,
            diesel_pred_l=round(p["diesel_pred"], 2) if p["diesel_pred"] > 0 else None,
            gasoil_pred_l=round(p["gasoil_pred"], 2) if p["gasoil_pred"] > 0 else None,
        ))

    n_total = db.query(func.count(FuelTransaction.id)).scalar() or 0

    return AnalisisFlotaResponse(
        precision_promedio_pct=round(precision_promedio, 1),
        total_registros_analizados=len(transacciones),
        registros_con_desvio=len(anomalias),
        ahorro_proyectado_litros=round(total_exceso_litros, 2),
        ahorro_proyectado_clp=round(total_exceso_clp, 0),
        reduccion_co2_proyectada_kg=round(total_exceso_co2, 2),
        anomalias=sorted(anomalias, key=lambda a: a.desvio_pct, reverse=True),
        consumo_por_periodo=consumo_por_periodo,
        modelo_info={
            "nombre": "Random Forest + litros_teoricos",
            "error_relativo_pct": 6.13,
            "registros_entrenamiento": 5795,
            "registros_flota_analizados": len(transacciones),
            "total_transacciones_sistema": n_total,
        },
    )


@router.get("/consumo-mensual")
def consumo_mensual(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """
    Devuelve series mensuales real + predicho en el formato que acepta ConsumptionChart.
    Permite integrar Diésel y Gas Oil en el gráfico multienergía de Predicciones ML.
    """
    model = _get_model()

    transacciones = (
        db.query(FuelTransaction)
        .filter(FuelTransaction.fuel_liters_real.isnot(None))
        .order_by(FuelTransaction.fecha)
        .all()
    )

    periodos: dict[str, dict[str, Any]] = {}
    for t in transacciones:
        real = float(t.fuel_liters_real)  # type: ignore[arg-type]
        pred = _predecir_litros(model, t.dist_km, t.km_per_liter, t.vehicle_cat, t.fuel_type)
        key = t.fecha.strftime("%Y-%m")
        if key not in periodos:
            periodos[key] = {
                "year": t.fecha.year, "month": t.fecha.month,
                "diesel_real": 0.0, "gasoil_real": 0.0,
                "diesel_pred": 0.0, "gasoil_pred": 0.0,
            }
        if t.fuel_type == "D":
            periodos[key]["diesel_real"] += real
            periodos[key]["diesel_pred"] += pred
        else:
            periodos[key]["gasoil_real"] += real
            periodos[key]["gasoil_pred"] += pred

    result: list[dict[str, Any]] = []
    meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    for key in sorted(periodos.keys()):
        p = periodos[key]
        result.append({
            "year": p["year"],
            "month": p["month"],
            "label": f"{meses[p['month']-1]} {p['year']}",
            "electricity_kwh": None,
            "water_m3": None,
            "predicted_electricity_kwh": None,
            "predicted_water_m3": None,
            "energy_values": {
                "diesel_l":  round(p["diesel_real"], 2) if p["diesel_real"] > 0 else None,
                "gasoil_l":  round(p["gasoil_real"], 2) if p["gasoil_real"] > 0 else None,
            },
            "energy_predictions": {
                "diesel_l":  round(p["diesel_pred"], 2) if p["diesel_pred"] > 0 else None,
                "gasoil_l":  round(p["gasoil_pred"], 2) if p["gasoil_pred"] > 0 else None,
            },
        })
    return result


@router.get("/exportar-retc")
def exportar_retc(
    anio: Optional[int] = None,
    db: Session = Depends(get_db),
) -> Response:
    """
    Exporta un CSV con las transacciones de flota en formato compatible con
    el reporte RETC (Registro de Emisiones y Transferencia de Contaminantes)
    exigido por la Ley 21.305 — Scope 1 combustión móvil.
    Filtra por año si se indica; de lo contrario exporta todo.
    """
    model = _get_model()

    query = db.query(FuelTransaction).filter(FuelTransaction.fuel_liters_real.isnot(None))
    if anio:
        query = query.filter(func.extract("year", FuelTransaction.fecha) == anio)
    transacciones = query.order_by(FuelTransaction.fecha).all()

    NOMBRES_MES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
    FACTOR_CO2 = {"D": 2.68, "G": 1.89}
    TIPO_LABEL = {"D": "Diesel", "G": "Gas Oil"}

    header = [
        "periodo",
        "vehicle_id",
        "vehicle_cat",
        "tipo_combustible",
        "factor_emision_kgCO2_L",
        "dist_km",
        "litros_reales",
        "litros_esperados",
        "exceso_litros",
        "co2_real_kg",
        "co2_esperado_kg",
        "co2_exceso_kg",
        "precio_litro_clp",
        "costo_exceso_clp",
        "severidad",
        "notas",
    ]

    rows = [",".join(header)]
    for t in transacciones:
        real = float(t.fuel_liters_real)  # type: ignore[arg-type]
        pred = round(_predecir_litros(model, t.dist_km, t.km_per_liter, t.vehicle_cat, t.fuel_type), 2)
        exceso = round(max(real - pred, 0.0), 2)
        factor = FACTOR_CO2.get(t.fuel_type, 2.68)
        desvio_pct = (real - pred) / pred * 100 if pred > 0 else 0.0
        severidad = (
            "alta" if desvio_pct >= 35
            else "media" if desvio_pct >= 20
            else "baja" if desvio_pct >= 10
            else "normal"
        )
        mes_label = NOMBRES_MES[t.fecha.month - 1]
        periodo = f"{mes_label} {t.fecha.year}"

        notas = (t.notas or "").replace(",", ";")
        row = [
            periodo,
            t.vehicle_id,
            t.vehicle_cat,
            TIPO_LABEL.get(t.fuel_type, t.fuel_type),
            str(factor),
            str(round(t.dist_km, 1)),
            str(round(real, 2)),
            str(pred),
            str(exceso),
            str(round(real * factor, 2)),
            str(round(pred * factor, 2)),
            str(round(exceso * factor, 2)),
            str(round(t.precio_litro_clp, 0)),
            str(round(exceso * t.precio_litro_clp, 0)),
            severidad,
            notas,
        ]
        rows.append(",".join(row))

    csv_content = "\n".join(rows)
    filename = f"retc_scope1_combustion_movil_{anio or 'todos'}.csv"
    return Response(
        content=csv_content.encode("utf-8-sig"),  # utf-8-sig para que Excel lo abra bien
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/transacciones", response_model=list[FuelTransactionResponse])
def list_transacciones(
    limit: int = 50,
    db: Session = Depends(get_db),
) -> list[FuelTransactionResponse]:
    return (
        db.query(FuelTransaction)
        .order_by(FuelTransaction.fecha.desc())
        .limit(limit)
        .all()
    )


@router.post("/transacciones", response_model=FuelTransactionResponse, status_code=201)
def create_transaccion(
    payload: FuelTransactionCreate,
    db: Session = Depends(get_db),
) -> FuelTransactionResponse:
    t = FuelTransaction(
        vehicle_id=payload.vehicle_id,
        vehicle_cat=payload.vehicle_cat,
        fuel_type=payload.fuel_type,
        fecha=payload.fecha.replace(tzinfo=timezone.utc) if payload.fecha.tzinfo is None else payload.fecha,
        dist_km=payload.dist_km,
        fuel_liters_real=payload.fuel_liters_real,
        km_per_liter=payload.km_per_liter,
        precio_litro_clp=payload.precio_litro_clp,
        notas=payload.notas,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t
