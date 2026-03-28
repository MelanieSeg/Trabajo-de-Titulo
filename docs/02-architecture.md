# 2. Arquitectura

## Estructura de alto nivel

- `frontend/`: SPA React + Vite, servida en producción con Nginx.
- `backend/`: API FastAPI, lógica de negocio, ETL y ML.
- `db/`: modelo SQL idempotente y credenciales runtime.
- `app/`: configuración transversal activa (`platform-config.json`).
- `docs/`: documentación técnica segmentada.
- `scripts/`: operación de stack Docker.

## Diagrama lógico

```text
[Frontend React/Vite]
        |
      /api
        |
[Backend FastAPI]
  |      |       |
  |      |       +--> Módulo ML (entrenamiento/predicción)
  |      +----------> Módulo ETL (ingesta/limpieza/upsert)
  +-----------------> PostgreSQL (modelo relacional)
```

## Configuración transversal (`app/`)

El backend consume `app/platform-config.json` en runtime para aplicar configuración de plataforma:
- Umbrales de alerta.
- Programación ETL.
- Metas de eficiencia iniciales.
- Metadatos de organización/dashboard.

Endpoints de gestión:
- `GET /api/system/platform-config`
- `POST /api/system/apply-config`

## Patrones de diseño

- Separación por capas en backend: `api`, `services`, `db`, `schemas`.
- Modelo relacional con restricciones explícitas (FK, unique, checks).
- Inicialización idempotente de DB (`db/init.sql`).
- Configuración externa por variables de entorno y archivo JSON de plataforma.
