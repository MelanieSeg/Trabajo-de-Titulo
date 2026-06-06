"""
Módulo de IA para gestión de combustible de flota.
Detección automática de ineficiencias operativas, trazabilidad y reporte RETC.
Incluye reentrenamiento del modelo con datos reales de la empresa.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.db.models import FuelPredictionLog, FuelTransaction, User

router = APIRouter(prefix="/combustible-ml", tags=["combustible-ml"])

_DATA_DIR       = Path(__file__).parent.parent.parent.parent / "data"
_MODEL_PATH     = _DATA_DIR / "modelo_combustible.joblib"
_MODEL_META_PATH= _DATA_DIR / "modelo_combustible_meta.json"
_BASE_CSV_PATH  = _DATA_DIR / "fleet_fuel_base.csv"

_CO2_FACTOR: dict[str, float] = {"D": 2.68, "G": 1.89}
_MEJORA_EFICIENCIA_PCT = 10.0
_UMBRAL_ANOMALIA_PCT   = 10.0
_MIN_REGISTROS_REENTRENAMIENTO = 30

_model      = None
_model_meta: dict = {}


def _load_model_meta() -> dict:
    """Lee el JSON de metadatos del modelo (si existe)."""
    if _MODEL_META_PATH.exists():
        with open(_MODEL_META_PATH, encoding="utf-8") as f:
            return json.load(f)
    # Metadatos por defecto: modelo genérico original (usa year)
    return {"uses_year": True, "trained_with_company_data": False}


def _get_model():
    global _model, _model_meta
    if _model is None:
        if not _MODEL_PATH.exists():
            raise HTTPException(
                status_code=503,
                detail="Modelo de combustible no disponible. Coloque modelo_combustible.joblib en backend/data/",
            )
        _model = joblib.load(_MODEL_PATH)
        _model_meta = _load_model_meta()
    return _model


def _predecir_litros(
    model,
    dist_km: float,
    km_per_liter: Optional[float],
    vehicle_cat: str,
    fuel_type: str,
) -> float:
    """
    Predice litros consumidos. Si el modelo fue reentrenado con datos de empresa,
    no usa el feature 'year' (que era específico del dataset de entrenamiento original).
    """
    kpl = km_per_liter if km_per_liter is not None else np.nan
    litros_teo = dist_km / kpl if km_per_liter is not None else np.nan

    if _model_meta.get("uses_year", True):
        # Modelo genérico original, requiere el feature year
        features = pd.DataFrame([{
            "dist_km":         dist_km,
            "km_per_liter":    kpl,
            "litros_teoricos": litros_teo,
            "vehicle_cat":     vehicle_cat,
            "fuel_type":       fuel_type,
            "year":            "2018-19",
        }])
    else:
        # Modelo adaptado a la empresa, no usa el feature year
        features = pd.DataFrame([{
            "dist_km":         dist_km,
            "km_per_liter":    kpl,
            "litros_teoricos": litros_teo,
            "vehicle_cat":     vehicle_cat,
            "fuel_type":       fuel_type,
        }])

    log_pred = float(model.predict(features)[0])
    return max(float(np.expm1(log_pred)), 0.0)


# Schemas

class FuelPredictionRequest(BaseModel):
    vehicle_cat: Literal["Van", "Truck", "Bus", "Car"] = Field(..., description="Categoría del vehículo")
    fuel_type: Literal["D", "G"] = Field(..., description="D=Diésel, G=Gas Oil")
    dist_km: float = Field(..., gt=0)
    km_per_liter: Optional[float] = Field(default=None, gt=0)
    precio_litro_clp: float = Field(..., gt=0, description="Precio actual por litro en CLP (varía mensualmente, no se usa valor por defecto)")


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
    facility_id: Optional[int] = Field(default=None, description="Instalación a la que pertenece esta transacción")
    vehicle_id: str = Field(..., min_length=1, max_length=50)
    vehicle_cat: Literal["Van", "Truck", "Bus", "Car"]
    fuel_type: Literal["D", "G"]
    fecha: datetime
    dist_km: float = Field(..., gt=0)
    fuel_liters_real: Optional[float] = Field(default=None, gt=0)
    km_per_liter: Optional[float] = Field(default=None, gt=0)
    precio_litro_clp: float = Field(..., gt=0, description="Precio efectivo pagado por litro en CLP")
    notas: Optional[str] = Field(default=None, max_length=255)


class FuelTransactionResponse(BaseModel):
    id: int
    facility_id: Optional[int]
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


# Endpoints

class FuelPredictionRequestWithFacility(FuelPredictionRequest):
    facility_id: Optional[int] = Field(default=None, description="Instalación asociada a esta predicción")


@router.post("/predict", response_model=FuelPredictionResponse)
def predict_fuel(
    payload: FuelPredictionRequestWithFacility,
    db: Session = Depends(get_db),
) -> FuelPredictionResponse:
    # Rendimiento mínimo físico aceptable por tipo de vehículo (km/L).
    # Si la predicción implica un rendimiento por debajo de esto, el modelo
    # recibió features demasiado incompletas (dist_km muy corta sin km_per_liter).
    _KM_PER_LITER_MIN: dict[str, float] = {
        "Van": 4.0, "Car": 5.0, "Bus": 1.5, "Truck": 1.5
    }

    model = _get_model()
    co2_factor = _CO2_FACTOR[payload.fuel_type]
    fue_imputado = payload.km_per_liter is None

    fuel_liters = _predecir_litros(
        model, payload.dist_km, payload.km_per_liter,
        payload.vehicle_cat, payload.fuel_type,
    )

    # Sanidad: verificar que el rendimiento implícito sea físicamente posible.
    # Sin km_per_liter, el modelo imputa la mediana del entrenamiento y puede
    # producir predicciones absurdas para distancias cortas.
    if fuel_liters > 0:
        km_pl_implicito = payload.dist_km / fuel_liters
        km_pl_min = _KM_PER_LITER_MIN.get(payload.vehicle_cat, 2.0)
        if km_pl_implicito < km_pl_min:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"La predicción para {payload.dist_km} km sin km_por_litro informado "
                    f"produjo un rendimiento implícito de {km_pl_implicito:.1f} km/L, "
                    f"que es físicamente imposible para un {payload.vehicle_cat} "
                    f"(mínimo esperado: {km_pl_min} km/L). "
                    "Ingresa el rendimiento real del vehículo (km/litro) para obtener una predicción válida."
                ),
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
        facility_id=payload.facility_id,
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
        model_name=f"Random Forest + litros_teoricos (err.rel {_model_meta.get('error_relativo_empresa_pct', 6.13):.2f}%)",
        error_rel_pct=_model_meta.get("error_relativo_empresa_pct", 6.13),
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
            modelo_info={"nombre": "Random Forest + litros_teoricos", "error_relativo_pct": _model_meta.get("error_relativo_empresa_pct", 6.13)},
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
        try:
            pred = _predecir_litros(model, t.dist_km, t.km_per_liter, t.vehicle_cat, t.fuel_type)
        except Exception:
            continue
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
            co2_real_kg=round(p["diesel_real"] * 2.68 + p["gasoil_real"] * 1.89, 2),
            co2_predicho_kg=round(p["diesel_pred"] * 2.68 + p["gasoil_pred"] * 1.89, 2),
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
            "error_relativo_pct": _model_meta.get("error_relativo_empresa_pct", 6.13),
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


@router.get(
    "/exportar-retc",
    response_class=Response,
    responses={
        200: {
            "description": "CSV exportado en formato RETC",
            "content": {
                "text/csv": {
                    "schema": {"type": "string", "format": "binary"}
                }
            },
        }
    },
)
def exportar_retc(
    anio: Optional[int] = None,
    db: Session = Depends(get_db),
) -> Response:
    """
    Exporta un CSV con las transacciones de flota en formato compatible con
    el reporte RETC (Registro de Emisiones y Transferencia de Contaminantes)
    exigido por la Ley 21.305 - Scope 1 combustión móvil.
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
    limit: int = 500,
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
        facility_id=payload.facility_id,
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


# Schema para estado del modelo

class ModeloEstadoResponse(BaseModel):
    trained_with_company_data: bool
    uses_year: bool
    n_empresa: Optional[int] = None
    n_base: Optional[int] = None
    error_relativo_empresa_pct: Optional[float] = None
    mae_empresa_L: Optional[float] = None
    retrained_at: Optional[str] = None
    n_transacciones_disponibles: int
    puede_reentrenar: bool
    min_registros_requeridos: int


@router.get("/modelo-estado", response_model=ModeloEstadoResponse)
def modelo_estado(db: Session = Depends(get_db)) -> ModeloEstadoResponse:
    """Devuelve el estado actual del modelo: si fue adaptado a la empresa o es el genérico."""
    meta = _load_model_meta()
    n_disponibles = db.query(func.count(FuelTransaction.id)).filter(
        FuelTransaction.fuel_liters_real.isnot(None)
    ).scalar() or 0
    return ModeloEstadoResponse(
        trained_with_company_data=meta.get("trained_with_company_data", False),
        uses_year=meta.get("uses_year", True),
        n_empresa=meta.get("n_empresa"),
        n_base=meta.get("n_base"),
        error_relativo_empresa_pct=meta.get("error_relativo_empresa_pct"),
        mae_empresa_L=meta.get("mae_empresa_L"),
        retrained_at=meta.get("retrained_at"),
        n_transacciones_disponibles=n_disponibles,
        puede_reentrenar=n_disponibles >= _MIN_REGISTROS_REENTRENAMIENTO,
        min_registros_requeridos=_MIN_REGISTROS_REENTRENAMIENTO,
    )


@router.post("/reentrenar")
def reentrenar_modelo(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> dict[str, Any]:
    """
    Reentrena el Random Forest combinando el dataset base externo (5.795 registros de
    referencia sobre física del consumo de combustible) con las transacciones reales
    registradas en el sistema por la empresa.

    El nuevo modelo NO usa el feature 'year' (que era específico del dataset original UK),
    lo que lo hace aplicable a cualquier año de operación.

    Los datos de la empresa reciben peso triple para que el modelo se adapte a la flota
    y rutas específicas, sin perder el conocimiento base del dataset de referencia.

    Requiere al menos 30 transacciones con fuel_liters_real.
    Solo accesible para administradores.
    """
    global _model, _model_meta

    # 1. Verificar dataset base
    if not _BASE_CSV_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="Dataset base no disponible (fleet_fuel_base.csv). Contacte al administrador.",
        )

    # 2. Verificar transacciones de empresa
    transacciones = (
        db.query(FuelTransaction)
        .filter(FuelTransaction.fuel_liters_real.isnot(None))
        .all()
    )
    n_empresa = len(transacciones)

    if n_empresa < _MIN_REGISTROS_REENTRENAMIENTO:
        return {
            "success": False,
            "message": (
                f"Se necesitan al menos {_MIN_REGISTROS_REENTRENAMIENTO} transacciones "
                f"con consumo real registrado. Actualmente hay {n_empresa}."
            ),
            "n_empresa": n_empresa,
            "n_requeridas": _MIN_REGISTROS_REENTRENAMIENTO,
        }

    # 3. Cargar y preparar dataset base (sin columna year)
    df_base = pd.read_csv(_BASE_CSV_PATH)
    df_base["log_fuel"] = np.log1p(df_base["fuel_liters"])
    if "litros_teoricos" not in df_base.columns:
        df_base["litros_teoricos"] = df_base["dist_km"] / df_base["km_per_liter"]

    FEATURES_NUM = ["dist_km", "km_per_liter", "litros_teoricos"]
    FEATURES_CAT = ["vehicle_cat", "fuel_type"]
    FEATURES     = FEATURES_NUM + FEATURES_CAT

    df_base_clean = df_base[FEATURES + ["log_fuel"]].copy()

    # 4. Preparar features de empresa, filtrando registros anómalos
    # Se usa el modelo actual para detectar qué registros tienen una desviación
    # excesiva (>35%). Incluirlos en el entrenamiento sesgaría el modelo
    # hacia consumos ineficientes como si fueran normales.
    modelo_actual = _get_model()
    _UMBRAL_FILTRO_REENTRENAMIENTO = 35.0  # % de desvío máximo aceptado

    rows_limpios = []
    n_excluidos = 0
    for t in transacciones:
        real = float(t.fuel_liters_real)  # type: ignore[arg-type]
        pred_actual = _predecir_litros(
            modelo_actual, t.dist_km, t.km_per_liter, t.vehicle_cat, t.fuel_type
        )
        desvio = ((real - pred_actual) / pred_actual * 100) if pred_actual > 0 else 0.0
        if abs(desvio) > _UMBRAL_FILTRO_REENTRENAMIENTO:
            # Registro anómalo: no enseñar al nuevo modelo que esto es "normal"
            n_excluidos += 1
            continue
        kpl        = float(t.km_per_liter) if t.km_per_liter else np.nan
        litros_teo = float(t.dist_km) / kpl if t.km_per_liter else np.nan
        rows_limpios.append({
            "dist_km":         float(t.dist_km),
            "km_per_liter":    kpl,
            "litros_teoricos": litros_teo,
            "vehicle_cat":     t.vehicle_cat,
            "fuel_type":       t.fuel_type,
            "log_fuel":        np.log1p(real),
        })

    n_limpios = len(rows_limpios)
    if n_limpios < _MIN_REGISTROS_REENTRENAMIENTO:
        return {
            "success": False,
            "message": (
                f"Tras excluir {n_excluidos} registros anómalos (desvío >35%), "
                f"solo quedan {n_limpios} registros válidos para entrenamiento. "
                f"Se necesitan al menos {_MIN_REGISTROS_REENTRENAMIENTO}. "
                f"Registre más operaciones normales antes de reentrenar."
            ),
            "n_empresa": n_empresa,
            "n_limpios": n_limpios,
            "n_excluidos": n_excluidos,
            "n_requeridas": _MIN_REGISTROS_REENTRENAMIENTO,
        }

    df_empresa = pd.DataFrame(rows_limpios)

    # 5. Separar datos de empresa: 80% entrenamiento / 20% evaluación honesta
    df_emp_train, df_emp_test = train_test_split(
        df_empresa, test_size=0.2, random_state=42
    )

    # Construir dataset de entrenamiento: base + empresa_train × 3
    df_train_combinado = pd.concat(
        [df_base_clean, pd.concat([df_emp_train] * 3, ignore_index=True)],
        ignore_index=True,
    )

    # 6. Construir pipeline
    preprocesador = ColumnTransformer(
        transformers=[
            ("num", SimpleImputer(strategy="median"), FEATURES_NUM),
            ("cat", OrdinalEncoder(
                handle_unknown="use_encoded_value", unknown_value=-1
            ), FEATURES_CAT),
        ],
        remainder="drop",
    )
    pipeline = Pipeline([
        ("prep", preprocesador),
        ("mod",  RandomForestRegressor(
            n_estimators=200, max_depth=15, min_samples_leaf=5,
            max_features="sqrt", n_jobs=-1, random_state=42,
        )),
    ])

    # Entrenamiento temporal para obtener métricas honestas
    pipeline.fit(df_train_combinado[FEATURES], df_train_combinado["log_fuel"])

    # 7. Evaluar exclusivamente sobre el 20% retenido (datos no vistos durante fit)
    y_pred_log = pipeline.predict(df_emp_test[FEATURES])
    y_pred     = np.expm1(y_pred_log)
    y_real     = np.expm1(df_emp_test["log_fuel"].values)
    mae        = float(np.mean(np.abs(y_real - y_pred)))
    error_rel  = float(mae / y_real.mean() * 100) if y_real.mean() > 0 else 0.0
    n_test     = len(df_emp_test)

    # 8. Reentrenar modelo de producción con el 100% de los datos disponibles
    df_combinado = pd.concat(
        [df_base_clean, pd.concat([df_empresa] * 3, ignore_index=True)],
        ignore_index=True,
    )
    pipeline.fit(df_combinado[FEATURES], df_combinado["log_fuel"])

    # 9. Guardar modelo y metadatos
    joblib.dump(pipeline, _MODEL_PATH)
    meta = {
        "uses_year":                   False,
        "trained_with_company_data":   True,
        "n_base":                      len(df_base),
        "n_empresa":                   n_empresa,
        "n_limpios":                   n_limpios,
        "n_excluidos":                 n_excluidos,
        "n_test":                      n_test,
        "n_total_entrenamiento":       len(df_combinado),
        "error_relativo_empresa_pct":  round(error_rel, 2),
        "mae_empresa_L":               round(mae, 1),
        "retrained_at":                datetime.now(timezone.utc).isoformat(),
    }
    with open(_MODEL_META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    # 10. Recargar en memoria
    _model      = pipeline
    _model_meta = meta

    return {
        "success": True,
        "message": (
            f"Modelo reentrenado con {n_limpios} transacciones limpias de empresa "
            f"({n_excluidos} anómalas excluidas) + {len(df_base)} registros base. "
            f"Error relativo (evaluado sobre {n_test} registros retenidos): {error_rel:.1f}%."
        ),
        **meta,
    }
