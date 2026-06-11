Escenarios CSV para pruebas manuales de EcoEnergy

Formato compatible con /api/etl/upload (mismas columnas que sample_consumption.csv).

Orden recomendado de carga:
1) 01_base_operacion_2026_q2.csv
2) 02_eficiencia_mejorada_2026_q3.csv
3) 03_anomalias_picos_2026_q4.csv
4) 04_fuga_agua_2027_q1.csv
5) 05_expansion_planta_2027_q2.csv
6) 06_recuperacion_optima_2027_q3.csv

Que deberias observar:
- Dashboards y graficos: cambios visibles en tendencia mensual y comparativas.
- Alertas inteligentes: aumento con 03 y 04; disminucion con 06.
- KPIs/eficiencia: mejora clara en 02 y 06.
- ML: al reentrenar tras cada carga, cambian predicciones y MAE.

Nota tecnica:
El ETL hace upsert por (facility_name, year, month). Si subes otro CSV con la misma planta/anio/mes, reemplaza esos valores.
