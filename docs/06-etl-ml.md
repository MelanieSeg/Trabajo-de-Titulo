# 6. Pipeline ETL y Machine Learning

## ETL

### Entrada

CSV con columnas base:
- `company_name`, `facility_name`, `region`, `year`, `month`
- `electricity_kwh`, `water_m3`, `electricity_cost_usd`, `water_cost_usd`, `co2_avoided_ton`

Opcionales:
- `lighting_pct`, `hvac_pct`, `machinery_pct`, `offices_pct`, `others_pct`

Carga por módulo (sin afectar otras vistas):
- `POST /api/etl/upload/electricity` con columnas mínimas:
  - `company_name`, `facility_name`, `year`, `month`, `electricity_kwh`, `electricity_cost_usd`
- `POST /api/etl/upload/water` con columnas mínimas:
  - `company_name`, `facility_name`, `year`, `month`, `water_m3`, `water_cost_usd`

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

- Pipeline multmodelo por utilidad: `RandomForestRegressor`, `GradientBoostingRegressor`, `KNeighborsRegressor`, `BayesianRidge`, `LinearRegression`.
- Features: tendencia temporal + estacionalidad + lags (1-3) + promedio móvil + momentum.
- Validación: `TimeSeriesSplit` con benchmark por modelo (`MAE`, `MAPE`, `R2`, precisión estimada).
- Selección automática del modelo campeón para electricidad y agua.
- Persistencia: `ml_predictions` (predicción consolidada) + `activity_logs` (benchmark y métricas de entrenamiento).

### Integración con negocio

- Se generan alertas cuando la predicción proyecta incrementos por sobre umbrales.
- Predicciones y precisión por utilidad se reflejan en el dashboard junto con histórico.
- Comparativas anuales incluyen escenario sin software vs escenario optimizado/predictivo para visualizar ahorro proyectado.
