# EcoEnergy Platform

Plataforma web para monitorear, analizar y optimizar el consumo de electricidad y agua en empresas con múltiples instalaciones.

## 1. ¿Qué problema resuelve?

En operaciones industriales y corporativas, el consumo energético suele estar distribuido en distintas plantas, medidores y fuentes de datos. Este proyecto centraliza esa información y la transforma en decisiones accionables mediante:
- Dashboards operativos con indicadores claros.
- Alertas automáticas por aumentos anómalos.
- Predicciones de consumo de corto plazo.
- Metas de eficiencia y seguimiento continuo.

## 2. Stack tecnológico

- **Frontend**: React + Vite + TypeScript + Recharts + React Query.
- **Backend**: FastAPI + SQLAlchemy + Pydantic.
- **Base de datos**: PostgreSQL 16.
- **ETL**: Pandas.
- **Machine Learning**: Scikit-learn (RandomForestRegressor).
- **Infraestructura**: Docker Compose.

## 3. Estructura del repositorio

```text
.
├── frontend/              # UI React/Vite
├── backend/               # API, servicios ETL/ML y dominio
├── db/                    # init SQL + credenciales
├── app/                   # configuración transversal activa (platform-config.json)
├── docs/                  # documentación por secciones
├── scripts/               # utilitarios operativos
├── docker-compose.yml
├── .env.example
└── README.md
```

## 4. Carpeta `app/` con funcionalidad real

`app/` ya no es solo un placeholder. Contiene configuración transversal que el backend usa activamente en runtime:
- Archivo: `app/platform-config.json`.
- El backend lo lee desde `PLATFORM_CONFIG_PATH`.
- En arranque, aplica configuración a la BD:
  - Umbrales de alertas.
  - Programación ETL.
  - Metas de eficiencia.
  - Empresa base por defecto.

Endpoints asociados:
- `GET /api/system/platform-config`
- `POST /api/system/apply-config`

## 5. Funcionalidades principales

### 5.1 Dashboard
- Tarjetas con electricidad, agua, costo total y CO2 evitado.
- Serie temporal con datos históricos + predicciones ML.
- Distribución por área de consumo.
- Panel de alertas inteligentes.
- Índice de eficiencia y metas.
- Actividad reciente.

### 5.2 Gestión de datos (ETL)
- Carga CSV por UI.
- Limpieza y normalización automática.
- Upsert mensual por instalación.
- Registro de jobs ETL para trazabilidad.

### 5.3 Predicción y anomalías
- Entrenamiento de modelo ML con series temporales.
- Predicción de horizonte configurable.
- Detección de aumentos y variaciones abruptas.
- Generación de alertas por umbral.

### 5.4 Operación
- Exportación CSV de datos consolidados.
- Configuración de alertas.
- Definición de metas de eficiencia.
- Programación ETL.

## 6. Base de datos y modelo relacional

- Fuente de verdad del esquema: `db/init.sql`.
- Esquema idempotente con:
  - `CREATE TABLE IF NOT EXISTS`
  - `CREATE INDEX IF NOT EXISTS`
  - `INSERT ... ON CONFLICT DO NOTHING`
- Incluye relaciones 1:N y N:M, constraints, triggers y vistas analíticas.

## 7. Inicialización automática de BD

En Docker Compose:
- Servicio `db` inicia PostgreSQL.
- Servicio `db-init` ejecuta `db/init.sql`.
- El script puede correrse múltiples veces sin duplicar estructura.

Esto permite que si ya existen tablas, no se vuelvan a crear de forma destructiva.

## 8. Cómo ejecutar

### 8.1 Preparación

```bash
cp .env.example .env
cp db/credentials.env.example db/credentials.env
```

### 8.2 Levantar entorno

```bash
docker compose up --build
```

### 8.3 URLs por defecto

- Frontend: `http://localhost:8080`
- Backend docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/api/health`

## 9. Scripts útiles

- `scripts/up.sh`
- `scripts/down.sh`
- `scripts/reset-db.sh`

## 10. Documentación detallada

Índice principal:
- `docs/README.md`

Secciones:
- `docs/01-overview.md`
- `docs/02-architecture.md`
- `docs/03-backend.md`
- `docs/04-frontend.md`
- `docs/05-database.md`
- `docs/06-etl-ml.md`
- `docs/07-api.md`
- `docs/08-deployment.md`
- `docs/09-operations.md`
