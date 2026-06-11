Datasets para pruebas ETL/ML (empresa ficticia).

Archivos:
1) electricidad_empresa_ficticia_2020_2026.csv
2) agua_empresa_ficticia_2020_2026.csv
3) electricidad_empresa_ficticia_sintetico_2020_2034_5mb.csv
4) agua_empresa_ficticia_sintetico_2020_2034_5mb.csv
5) electricidad_empresa_ficticia_sintetico_2020_2039_10mb.csv
6) agua_empresa_ficticia_sintetico_2020_2039_10mb.csv

Todos son compatibles con /api/etl/upload y contienen:
- Registros mensuales por planta
- Columnas base + distribución por área + recursos adicionales
- Patrón antes/después de software de gestión energética

Los archivos originales *_2020_2026.csv se conservan sin cambios:
- 60 plantas
- 5.040 filas por archivo
- Años 2020-2026

Los archivos *_sintetico_2020_2034_5mb.csv son derivados sintéticos para
pruebas medianas:
- 120 plantas
- 21.600 filas por archivo
- Años 2020-2034
- Tamaño aproximado: 5 MB

Los archivos *_sintetico_2020_2039_10mb.csv son derivados sintéticos para
pruebas pesadas:
- 180 plantas
- 43.200 filas por archivo
- Años 2020-2039
- Tamaño aproximado: 10 MB

Orden sugerido de carga:
1. electricidad_empresa_ficticia_2020_2026.csv
2. agua_empresa_ficticia_2020_2026.csv
3. electricidad_empresa_ficticia_sintetico_2020_2034_5mb.csv
4. agua_empresa_ficticia_sintetico_2020_2034_5mb.csv
5. electricidad_empresa_ficticia_sintetico_2020_2039_10mb.csv
6. agua_empresa_ficticia_sintetico_2020_2039_10mb.csv
