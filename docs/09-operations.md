# 9. Operación y Mantenimiento

## Scripts disponibles

- `scripts/up.sh`: `docker compose up --build`
- `scripts/down.sh`: `docker compose down`
- `scripts/reset-db.sh`: reinicio completo con borrado de volúmenes

## Operaciones frecuentes

### Reaplicar configuración transversal

```bash
curl -X POST http://localhost:8000/api/system/apply-config
```

### Ver configuración activa de plataforma

```bash
curl http://localhost:8000/api/system/platform-config
```

### Validar salud de API

```bash
curl http://localhost:8000/api/health
```

### Ver logs de backend

```bash
docker compose logs -f backend
```

## Buenas prácticas

- Versionar cambios en `app/platform-config.json` junto con cambios de backend.
- Mantener `db/init.sql` compatible hacia atrás (sin `DROP` en producción).
- Ejecutar entrenamiento ML después de cargas ETL significativas.
- Registrar ajustes de umbral de alertas y metas como parte de operación.
