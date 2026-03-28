# 7. API REST

## Salud

- `GET /api/health`

## Dashboard

- `GET /api/dashboard/data`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/timeseries`
- `GET /api/dashboard/distribution`
- `GET /api/dashboard/alerts`
- `GET /api/dashboard/activity`
- `GET /api/dashboard/efficiency`

## ETL

- `POST /api/etl/upload`
- `GET /api/etl/schedule`
- `POST /api/etl/schedule`
- `POST /api/etl/run-sample`

## ML

- `POST /api/ml/train`
- `GET /api/ml/predictions`

## Acciones de negocio

- `GET /api/reports/monthly`
- `GET /api/export/consumption.csv`
- `GET /api/alerts/config`
- `POST /api/alerts/config`
- `POST /api/targets`
- `POST /api/metrics/custom`

## Sistema / configuración transversal

- `GET /api/system/platform-config`
- `POST /api/system/apply-config`

Para payloads exactos, revisar OpenAPI en `http://localhost:8000/docs`.
