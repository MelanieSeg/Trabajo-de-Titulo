# 4. Frontend (React + Vite)

## Objetivo de UI

Proveer una interfaz operativa para consumo energético con foco en:
- Monitoreo de KPIs principales.
- Exploración de tendencias y predicciones.
- Gestión rápida de acciones operativas (ETL, ML, export, metas, alertas).

## Componentes funcionales

- Tarjetas de métricas (electricidad, agua, costo, CO2 evitado).
- Gráfico de consumo mensual con predicciones ML.
- Gráfico de distribución por área.
- Panel de alertas inteligentes.
- Índice de eficiencia y metas.
- Actividad reciente.
- Acciones rápidas conectadas a backend real.

## Integración de datos

- Cliente API tipado en `frontend/src/lib/api.ts`.
- React Query para cacheo e invalidación de datos.
- Botones de acciones rápidas con mutaciones y feedback visual.

## Endpoints consumidos

- `GET /api/dashboard/data`
- `POST /api/etl/upload`
- `POST /api/ml/train`
- `GET /api/reports/monthly`
- `GET /api/export/consumption.csv`
- `POST /api/alerts/config`
- `POST /api/targets`
- `POST /api/metrics/custom`
- `POST /api/etl/schedule`
