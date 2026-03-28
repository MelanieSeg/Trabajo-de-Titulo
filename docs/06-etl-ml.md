# 6. Pipeline ETL y Machine Learning

## ETL

### Entrada

CSV con columnas base:
- `company_name`, `facility_name`, `region`, `year`, `month`
- `electricity_kwh`, `water_m3`, `electricity_cost_usd`, `water_cost_usd`, `co2_avoided_ton`

Opcionales:
- `lighting_pct`, `hvac_pct`, `machinery_pct`, `offices_pct`, `others_pct`

### Proceso

1. Validación de estructura de columnas.
2. Limpieza de nulos y tipado numérico.
3. Filtrado de rangos válidos (mes 1-12).
4. Agregación mensual por entidad.
5. Upsert transaccional en tablas de consumo.
6. Registro de job ETL y actividad.

## Machine Learning

### Objetivo

Predicción de consumo mensual de electricidad y agua para horizonte futuro.

### Implementación actual

- Modelo: `RandomForestRegressor`.
- Features: tendencia temporal + estacionalidad + lag.
- Validación: `TimeSeriesSplit` y MAE.
- Persistencia: `ml_predictions`.

### Integración con negocio

- Se generan alertas cuando la predicción proyecta incrementos por sobre umbrales.
- Predicciones se reflejan en el dashboard junto con histórico.
