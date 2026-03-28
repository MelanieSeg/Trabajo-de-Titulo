# 8. Despliegue y Docker

## Servicios del stack

- `db`: PostgreSQL 16.
- `db-init`: ejecuta `db/init.sql` de forma idempotente.
- `backend`: API FastAPI.
- `frontend`: build React servido por Nginx.

## Variables de entorno

Archivo raíz `.env` (basado en `.env.example`):
- `FRONTEND_PORT`
- `BACKEND_PORT`
- `POSTGRES_PORT`
- `VITE_API_BASE_URL`
- `CORS_ORIGINS`
- `ETL_UPLOAD_DIR`
- `SAMPLE_CSV_PATH`
- `PLATFORM_CONFIG_PATH`

Archivo `db/credentials.env`:
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`

## Arranque

```bash
cp .env.example .env
cp db/credentials.env.example db/credentials.env
docker compose up --build
```

## Secuencia de inicialización

1. Inicia PostgreSQL.
2. `db-init` aplica `db/init.sql`.
3. Inicia backend y ejecuta bootstrap de servicios.
4. Inicia frontend.

## Notas

- Si un puerto está ocupado, cambia la variable en `.env`.
- El schema SQL no elimina datos existentes; aplica cambios compatibles.
