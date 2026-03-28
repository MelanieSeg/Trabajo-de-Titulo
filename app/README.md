# App Layer Activa

La carpeta `app/` contiene configuración transversal viva del sistema.

Archivo principal:
- `platform-config.json`: perfil operativo que el backend carga y aplica en runtime.

Qué controla hoy:
- Umbrales de alertas por defecto.
- Programación ETL por defecto.
- Metas de eficiencia iniciales.
- Metadatos de organización y dashboard.

Integración real:
- `backend` monta esta carpeta en Docker y lee la ruta configurada por `PLATFORM_CONFIG_PATH`.
- En arranque, el backend aplica esta configuración sobre la base de datos de forma idempotente.
- Endpoints:
  - `GET /api/system/platform-config`
  - `POST /api/system/apply-config`
