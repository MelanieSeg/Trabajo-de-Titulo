Datasets gigantes para pruebas ETL/ML (empresa ficticia).

Archivos:
1) electricidad_empresa_ficticia_2000_2026.csv
2) agua_empresa_ficticia_2000_2026.csv
3) electricidad_empresa_ficticia_1998_2026.csv (alias compatible)
4) agua_empresa_ficticia_1998_2026.csv (alias compatible)

Ambos son compatibles con /api/etl/upload y contienen:
- 60 plantas
- Registros mensuales desde 2000 hasta 2026
- Columnas base + distribución por área + recursos adicionales
- Patrón antes/después de software de gestión energética

Orden sugerido de carga:
1. electricidad_empresa_ficticia_2000_2026.csv
2. agua_empresa_ficticia_2000_2026.csv
