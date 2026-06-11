# 3. Backend (FastAPI)

## Stack

- FastAPI (API REST).
- SQLAlchemy ORM (acceso a datos).
- Pydantic (validación/serialización).
- Pandas (ETL).
- Scikit-learn (ML).

## Organización interna

- `backend/app/main.py`: inicialización de app y ciclo de vida.
- `backend/app/api/routes/`: endpoints por dominio.
- `backend/app/services/`: lógica de negocio.
- `backend/app/db/`: sesión y modelos ORM.
- `backend/app/schemas/`: contratos de entrada/salida.

## Servicios clave

- `dashboard_service`: agregaciones para tarjetas, series, distribución, actividad y eficiencia.
- `etl_service`: carga CSV, normalización y upsert transaccional.
- `ml_service`: entrenamiento y predicción por series temporales.
- `alert_service`: generación de alertas por variación y umbrales.
- `platform_service`: carga y aplicación de configuración transversal desde `app/platform-config.json`.

## Flujo de arranque

Durante el startup:
1. Verifica/estructura esquema de BD (fallback ORM si falta esquema base).
2. Aplica defaults y configuración de plataforma (`platform_service`).
3. Semilla dataset inicial si no hay consumo cargado.
4. Regenera alertas y deja estado operativo.

## Principios de implementación

- Idempotencia en inicialización.
- Fail-safe en componentes ML (si faltan datos no rompe startup).
- Operaciones de escritura encapsuladas en transacciones de sesión.
- Contratos API tipados y consistentes.
