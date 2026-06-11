"""Tests funcionales para predicción de consumo de combustible"""
import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from unittest.mock import MagicMock, patch

from app.main import app
from app.db.models import FuelPredictionLog

client = TestClient(app)

_PAYLOAD_BASE = {
    "vehicle_cat": "Van",
    "fuel_type": "D",
    "dist_km": 500.0,
    "km_per_liter": 14.0,
    "precio_litro_clp": 1100.0,
}


@pytest.fixture
def mock_model():
    """Mock del modelo RF — evita necesitar el .joblib en CI."""
    with patch("app.api.routes.combustible_ml._get_model") as mock_get:
        model = MagicMock()
        # Retorna ~75 L en todas las llamadas (log1p(75) ≈ 4.32)
        model.predict.return_value = np.array([np.log1p(75.0)])
        mock_get.return_value = model
        yield model


class TestPredict:

    def test_respuesta_200_con_campos_requeridos(self, mock_model, db):
        resp = client.post("/api/combustible-ml/predict", json=_PAYLOAD_BASE)
        assert resp.status_code == 200
        data = resp.json()
        for campo in ("fuel_liters", "co2_kg", "co2_toneladas", "costo_clp",
                      "costo_por_km_clp", "optimizacion", "model_name"):
            assert campo in data, f"Campo ausente: {campo}"
        assert data["fuel_liters"] > 0

    def test_sin_km_per_liter_marca_imputacion(self, mock_model, db):
        payload = {**_PAYLOAD_BASE}
        del payload["km_per_liter"]
        resp = client.post("/api/combustible-ml/predict", json=payload)
        assert resp.status_code == 200
        assert resp.json()["km_per_liter_fue_imputado"] is True

    def test_con_km_per_liter_no_marca_imputacion(self, mock_model, db):
        resp = client.post("/api/combustible-ml/predict", json=_PAYLOAD_BASE)
        assert resp.status_code == 200
        assert resp.json()["km_per_liter_fue_imputado"] is False

    def test_co2_toneladas_es_co2_kg_dividido_1000(self, mock_model, db):
        resp = client.post("/api/combustible-ml/predict", json=_PAYLOAD_BASE)
        data = resp.json()
        assert abs(data["co2_toneladas"] - data["co2_kg"] / 1000) < 1e-6

    def test_optimizacion_km_mejorado_es_mayor(self, mock_model, db):
        resp = client.post("/api/combustible-ml/predict", json=_PAYLOAD_BASE)
        opt = resp.json()["optimizacion"]
        assert opt["km_per_liter_mejorado"] > opt["km_per_liter_efectivo"]
        assert opt["mejora_eficiencia_pct"] == 10.0

    def test_optimizacion_ahorros_no_negativos(self, mock_model, db):
        resp = client.post("/api/combustible-ml/predict", json=_PAYLOAD_BASE)
        opt = resp.json()["optimizacion"]
        assert opt["ahorro_litros"] >= 0
        assert opt["ahorro_clp"] >= 0
        assert opt["ahorro_co2_kg"] >= 0

    def test_prediccion_persiste_en_db(self, mock_model, db):
        resp = client.post("/api/combustible-ml/predict", json={
            "vehicle_cat": "Bus",
            "fuel_type": "G",
            "dist_km": 200.0,
            "km_per_liter": 10.0,
        })
        assert resp.status_code == 200
        log = db.query(FuelPredictionLog).first()
        assert log is not None
        assert log.vehicle_cat == "Bus"
        assert log.fuel_type == "G"
        assert log.dist_km == 200.0
        assert log.fuel_liters > 0

    def test_multiples_predicciones_se_acumulan_en_db(self, mock_model, db):
        for _ in range(3):
            client.post("/api/combustible-ml/predict", json=_PAYLOAD_BASE)
        total = db.query(FuelPredictionLog).count()
        assert total == 3

    def test_dist_km_cero_retorna_422(self, mock_model):
        resp = client.post("/api/combustible-ml/predict", json={**_PAYLOAD_BASE, "dist_km": 0})
        assert resp.status_code == 422

    def test_dist_km_negativo_retorna_422(self, mock_model):
        resp = client.post("/api/combustible-ml/predict", json={**_PAYLOAD_BASE, "dist_km": -100})
        assert resp.status_code == 422

    def test_vehicle_cat_invalida_retorna_422(self, mock_model):
        resp = client.post("/api/combustible-ml/predict", json={**_PAYLOAD_BASE, "vehicle_cat": "Moto"})
        assert resp.status_code == 422

    def test_fuel_type_invalido_retorna_422(self, mock_model):
        resp = client.post("/api/combustible-ml/predict", json={**_PAYLOAD_BASE, "fuel_type": "E"})
        assert resp.status_code == 422

    def test_km_per_liter_cero_retorna_422(self, mock_model):
        resp = client.post("/api/combustible-ml/predict", json={**_PAYLOAD_BASE, "km_per_liter": 0})
        assert resp.status_code == 422

    def test_fuel_type_label_diesel(self, mock_model, db):
        resp = client.post("/api/combustible-ml/predict", json={**_PAYLOAD_BASE, "fuel_type": "D"})
        assert resp.json()["fuel_type_label"] == "Diésel"

    def test_fuel_type_label_gasoil(self, mock_model, db):
        resp = client.post("/api/combustible-ml/predict", json={**_PAYLOAD_BASE, "fuel_type": "G"})
        assert resp.json()["fuel_type_label"] == "Gas Oil"


class TestHistorial:

    def test_historial_vacio_retorna_lista(self, mock_model, db):
        resp = client.get("/api/combustible-ml/historial")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_historial_incluye_prediccion_guardada(self, mock_model, db):
        client.post("/api/combustible-ml/predict", json=_PAYLOAD_BASE)
        resp = client.get("/api/combustible-ml/historial")
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 1
        assert items[0]["vehicle_cat"] == "Van"
        assert items[0]["fuel_type"] == "D"
        assert items[0]["dist_km"] == 500.0

    def test_historial_retorna_todos_los_registros(self, mock_model, db):
        for dist in [100.0, 200.0, 300.0]:
            client.post("/api/combustible-ml/predict", json={**_PAYLOAD_BASE, "dist_km": dist})
        resp = client.get("/api/combustible-ml/historial")
        items = resp.json()
        assert len(items) == 3
        # Todos los registros deben estar presentes (el orden exacto depende del reloj del servidor)
        dists = {item["dist_km"] for item in items}
        assert dists == {100.0, 200.0, 300.0}

    def test_historial_respeta_limite(self, mock_model, db):
        for _ in range(5):
            client.post("/api/combustible-ml/predict", json=_PAYLOAD_BASE)
        resp = client.get("/api/combustible-ml/historial?limit=3")
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_historial_campos_requeridos(self, mock_model, db):
        client.post("/api/combustible-ml/predict", json=_PAYLOAD_BASE)
        item = client.get("/api/combustible-ml/historial").json()[0]
        for campo in ("id", "vehicle_cat", "fuel_type", "dist_km",
                      "fuel_liters", "co2_kg", "costo_clp", "created_at"):
            assert campo in item, f"Campo ausente en historial: {campo}"
