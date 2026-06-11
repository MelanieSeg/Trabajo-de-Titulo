# 5. Modelo de Datos PostgreSQL

## Fuente de verdad

- `db/init.sql`

El esquema es idempotente y se puede ejecutar múltiples veces sin recrear objetos existentes.

## Entidades núcleo

- Organización: `companies`, `facilities`, `facility_areas`.
- Medición: `utility_types`, `meters`, `meter_monthly_readings`.
- Consumo agregado: `monthly_consumptions`, `area_distributions`.
- Analítica ML: `ml_models`, `ml_predictions`.
- Alertas: `smart_alerts`, `alert_configs`, `alert_subscriptions`.
- Usuarios y roles: `app_users`, `roles`, `app_user_roles`.
- Eficiencia y KPI: `efficiency_targets`, `facility_efficiency_targets`, `custom_metrics`, `custom_metric_values`.
- ETL y trazabilidad: `etl_data_sources`, `etl_jobs`, `etl_schedules`, `activity_logs`, `reports`.

## Relaciones relevantes

- 1:N `companies -> facilities`
- 1:N `facilities -> monthly_consumptions`
- 1:N `monthly_consumptions -> area_distributions`
- N:M `app_users <-> roles` mediante `app_user_roles`
- 1:N `facilities -> smart_alerts` (opcional)
- 1:N `app_users -> smart_alerts` como asignado (opcional)
- 1:N `etl_data_sources -> etl_jobs`

## Calidad de datos

- Constraints `CHECK` para rango de meses/años y no-negatividad.
- `UNIQUE` para evitar duplicados por período y entidad.
- Índices por período y claves de acceso frecuente.
- Triggers para mantener `updated_at` consistente.

## Vistas analíticas

- `v_company_monthly_consumption`
- `v_open_alerts_by_facility`
