"""
Ruta de predicción de consumo de combustible.
Modelo: Árbol de Decisión (CRISP-DM Sprint 3, hold-out 2018-19, err.rel 9.04%)
Autora: Melanie Constanza Seguel Orellana
"""

from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.models import FuelPredictionLog

router = APIRouter(prefix="/combustible-ml", tags=["combustible-ml"])

_MODEL_PATH = Path(__file__).parent.parent.parent.parent / "data" / "modelo_combustible.joblib"
_CO2_FACTOR: dict[str, float] = {"D": 2.68, "G": 1.89}
_MEJORA_EFICIENCIA_PCT = 10.0

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
    """
    Llama al pipeline sklearn.
    - km_per_liter None → NaN; el SimpleImputer usa la mediana del entrenamiento.
    - litros_teoricos = dist_km / km_per_liter combinan ambas variables en un
      predictor lineal que hace al modelo sensible a cambios en distancia y
      eficiencia simultáneamente (feature engineering CRISP-DM Sprint 3).
    """
    kpl = km_per_liter if km_per_liter is not None else np.nan
    litros_teo = dist_km / kpl if km_per_liter is not None else np.nan
    features = pd.DataFrame([{
        "dist_km":        dist_km,
        "km_per_liter":   kpl,
        "litros_teoricos": litros_teo,
        "vehicle_cat":    vehicle_cat,
        "fuel_type":      fuel_type,
        "year":           "2018-19",
    }])
    log_pred = float(model.predict(features)[0])
    return max(float(np.expm1(log_pred)), 0.0)


class FuelPredictionRequest(BaseModel):
    vehicle_cat: Literal["Van", "Truck", "Bus", "Car"] = Field(..., description="Categoría del vehículo")
    fuel_type: Literal["D", "G"] = Field(..., description="Tipo de combustible: D=Diésel, G=Gas Oil")
    dist_km: float = Field(..., gt=0, description="Distancia total del período de operación en km")
    km_per_liter: Optional[float] = Field(
        default=None,
        gt=0,
        description=(
            "Eficiencia histórica en km/L. "
            "Si se omite, el modelo usa la mediana del dataset de entrenamiento."
        ),
    )
    precio_litro_clp: float = Field(default=1050.0, gt=0, description="Precio por litro en CLP")


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


@router.post("/predict", response_model=FuelPredictionResponse)
def predict_fuel(
    payload: FuelPredictionRequest,
    db: Session = Depends(get_db),
) -> FuelPredictionResponse:
    model = _get_model()
    co2_factor = _CO2_FACTOR[payload.fuel_type]
    fue_imputado = payload.km_per_liter is None

    # Predicción base
    fuel_liters = _predecir_litros(
        model, payload.dist_km, payload.km_per_liter,
        payload.vehicle_cat, payload.fuel_type,
    )

    # km_per_liter efectivo: si fue imputado, lo derivamos de la predicción
    km_pl_efectivo = (
        round(payload.dist_km / fuel_liters, 2) if fue_imputado and fuel_liters > 0
        else payload.km_per_liter or 1.0
    )

    co2_kg = round(fuel_liters * co2_factor, 2)
    costo_clp = round(fuel_liters * payload.precio_litro_clp, 0)
    costo_por_km = round(costo_clp / payload.dist_km, 1) if payload.dist_km > 0 else 0.0

    # Escenario optimizado: segunda llamada real al modelo con +10% de eficiencia.
    # Random Forest interpola entre árboles, por lo que produce predicciones
    # distintas para cambios continuos de eficiencia (sin función escalón).
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

    # Persistir predicción para trazabilidad (OE6)
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
    """Retorna las últimas predicciones guardadas, más recientes primero."""
    registros = (
        db.query(FuelPredictionLog)
        .order_by(FuelPredictionLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return registros
