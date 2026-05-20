"""
Módulo de Entrenamiento: Modelos predictivos de consumo de combustible
=======================================================================
Tesis: Sistema Inteligente Basado en Aprendizaje Supervisado
        para la Gestión de Combustibles y Trazabilidad de Emisiones
Autora: Melanie Constanza Seguel Orellana
Etapa CRISP-DM: Modeling + Evaluation (Sprint 3)

Modelos comparados:
    1. Regresión Lineal
    2. Árbol de Decisión
    3. Random Forest

Estrategia de validación: TimeSeriesSplit manual por período fiscal
    Fold 1: Train [2013]                         → Test 2014
    Fold 2: Train [2013, 2014]                   → Test 2015-16
    Fold 3: Train [2013, 2014, 2015-16]          → Test 2016-17
    Fold 4: Train [2013, 2014, 2015-16, 2016-17] → Test 2018-19  ← hold-out oficial

El fold 4 coincide con el hold-out cronológico final y constituye
la métrica oficial reportada en la tesis.
"""

# =============================================================================
# 0. IMPORTACIONES
# =============================================================================
import sys
sys.stdout.reconfigure(encoding='utf-8')

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns
import joblib
import warnings
warnings.filterwarnings('ignore')

from sklearn.linear_model  import LinearRegression
from sklearn.tree          import DecisionTreeRegressor
from sklearn.ensemble      import RandomForestRegressor
from sklearn.preprocessing import OrdinalEncoder
from sklearn.impute        import SimpleImputer
from sklearn.pipeline      import Pipeline
from sklearn.compose       import ColumnTransformer
from sklearn.metrics       import mean_absolute_error, mean_squared_error

sns.set_theme(style='whitegrid', palette='muted')
plt.rcParams['figure.dpi'] = 130

# =============================================================================
# 1. CARGA Y VALIDACIÓN DEL DATASET
# =============================================================================
print("=" * 65)
print("MÓDULO DE ENTRENAMIENTO — MODELOS PREDICTIVOS DE COMBUSTIBLE")
print("=" * 65)

df = pd.read_csv('fleet_fuel_clean.csv')
print(f"\n[1] Dataset cargado: {df.shape[0]:,} filas x {df.shape[1]} columnas")

assert 'fuel_liters' in df.columns,  "Falta columna fuel_liters"
assert 'vehicle_cat' in df.columns,  "Falta columna vehicle_cat"
assert 'year'        in df.columns,  "Falta columna year"
assert df['fuel_liters'].isna().sum() == 0, "Hay nulos en la variable objetivo"

print("    Distribución de categorías vehiculares:")
for cat, n in df['vehicle_cat'].value_counts().items():
    print(f"      {cat:<8}: {n:>5} registros ({n/len(df)*100:.1f}%)")

# =============================================================================
# 2. DEFINICIÓN DE FEATURES Y VARIABLE OBJETIVO
# =============================================================================
FEATURES_NUM = ['dist_km', 'km_per_liter', 'litros_teoricos']
FEATURES_CAT = ['vehicle_cat', 'fuel_type', 'year']
FEATURES     = FEATURES_NUM + FEATURES_CAT
TARGET_RAW   = 'fuel_liters'

df['log_fuel'] = np.log1p(df[TARGET_RAW])

print(f"\n[2] Features: numéricas={FEATURES_NUM}  categóricas={FEATURES_CAT}")
print(f"    Variable objetivo: log(1 + {TARGET_RAW})  →  transformación inversa: expm1")

# =============================================================================
# 3. DEFINICIÓN DE FOLDS TEMPORALES
# =============================================================================
ORDEN_AÑOS = ['2013', '2014', '2015-16', '2016-17', '2018-19']

FOLDS = [
    {'train': ['2013'],                                   'test': '2014'},
    {'train': ['2013', '2014'],                           'test': '2015-16'},
    {'train': ['2013', '2014', '2015-16'],                'test': '2016-17'},
    {'train': ['2013', '2014', '2015-16', '2016-17'],     'test': '2018-19'},
]

print(f"\n[3] TimeSeriesSplit — {len(FOLDS)} folds:")
for i, fold in enumerate(FOLDS, 1):
    n_train = df[df['year'].isin(fold['train'])].shape[0]
    n_test  = df[df['year'] == fold['test']].shape[0]
    print(f"    Fold {i}: train={fold['train']} ({n_train:,}) → test={fold['test']} ({n_test:,})")

# =============================================================================
# 4. DEFINICIÓN DE MODELOS Y PREPROCESADOR
# =============================================================================
def crear_preprocesador():
    return ColumnTransformer(
        transformers=[
            ('num', SimpleImputer(strategy='median'),                   FEATURES_NUM),
            ('cat', OrdinalEncoder(handle_unknown='use_encoded_value',
                                   unknown_value=-1),                   FEATURES_CAT),
        ],
        remainder='drop'
    )

def crear_modelos():
    return {
        'Regresión Lineal': Pipeline([
            ('prep', crear_preprocesador()),
            ('mod',  LinearRegression())
        ]),
        'Árbol de Decisión': Pipeline([
            ('prep', crear_preprocesador()),
            ('mod',  DecisionTreeRegressor(
                max_depth=10, min_samples_leaf=10, random_state=42))
        ]),
        'Random Forest': Pipeline([
            ('prep', crear_preprocesador()),
            ('mod',  RandomForestRegressor(
                n_estimators=200, max_depth=15, min_samples_leaf=5,
                max_features='sqrt', n_jobs=-1, random_state=42))
        ]),
    }

# =============================================================================
# 5. FUNCIÓN DE MÉTRICAS
# =============================================================================
def metricas(y_real_log, y_pred_log):
    y_real   = np.expm1(y_real_log)
    y_pred   = np.expm1(y_pred_log)
    mae      = mean_absolute_error(y_real, y_pred)
    rmse     = np.sqrt(mean_squared_error(y_real, y_pred))
    err_rel  = (mae / y_real.mean()) * 100
    return mae, rmse, err_rel, y_real, y_pred

# =============================================================================
# 6. VALIDACIÓN CRUZADA TEMPORAL
# =============================================================================
print(f"\n[4] Validación cruzada TimeSeriesSplit...")
print("-" * 65)

# Estructura: cv_results[nombre_modelo][fold_idx] = dict de métricas
cv_results = {nombre: [] for nombre in crear_modelos()}

for fold_idx, fold in enumerate(FOLDS, 1):
    train_df = df[df['year'].isin(fold['train'])]
    test_df  = df[df['year'] == fold['test']]

    X_tr = train_df[FEATURES]
    y_tr = train_df['log_fuel']
    X_te = test_df[FEATURES]
    y_te = test_df['log_fuel']

    print(f"\n  Fold {fold_idx} — test: {fold['test']}  "
          f"({len(train_df):,} train | {len(test_df):,} test)")

    modelos_fold = crear_modelos()
    for nombre, pipeline in modelos_fold.items():
        pipeline.fit(X_tr, y_tr)
        mae, rmse, err_rel, y_real, y_pred = metricas(y_te, pipeline.predict(X_te))

        cv_results[nombre].append({
            'fold'       : fold_idx,
            'test_year'  : fold['test'],
            'mae'        : mae,
            'rmse'       : rmse,
            'err_rel'    : err_rel,
            'y_real'     : y_real,
            'y_pred'     : y_pred,
            'pipeline'   : pipeline,
            'n_train'    : len(train_df),
            'n_test'     : len(test_df),
        })

        print(f"    {nombre:<22} MAE={mae:>7.1f} L  "
              f"RMSE={rmse:>8.1f} L  Err.rel={err_rel:>5.2f}%")

# =============================================================================
# 7. TABLA RESUMEN DE VALIDACIÓN CRUZADA
# =============================================================================
print(f"\n[5] Resumen CV — media ± desviación estándar (4 folds):")
print("-" * 65)

resumen_cv = []
for nombre, folds in cv_results.items():
    maes     = [f['mae']     for f in folds]
    rmses    = [f['rmse']    for f in folds]
    err_rels = [f['err_rel'] for f in folds]
    resumen_cv.append({
        'Modelo'            : nombre,
        'MAE medio (L)'     : round(np.mean(maes),     1),
        'MAE std (L)'       : round(np.std(maes),      1),
        'RMSE medio (L)'    : round(np.mean(rmses),    1),
        'Err.rel medio %'   : round(np.mean(err_rels), 2),
        'Err.rel std %'     : round(np.std(err_rels),  2),
    })

tabla_cv = pd.DataFrame(resumen_cv).set_index('Modelo')
print(tabla_cv.to_string())

# Selección por MAE medio
mejor_nombre = tabla_cv['MAE medio (L)'].idxmin()
print(f"\n    → Modelo seleccionado por CV: {mejor_nombre}")

# =============================================================================
# 8. MÉTRICAS OFICIALES — FOLD 4 (hold-out 2018-19)
# =============================================================================
print(f"\n[6] Métricas oficiales — Fold 4 / hold-out 2018-19:")
print("-" * 65)

filas_oficial = []
for nombre, folds in cv_results.items():
    f4 = folds[3]  # fold 4 = índice 3
    filas_oficial.append({
        'Modelo'            : nombre,
        'MAE (L)'           : round(f4['mae'],     1),
        'RMSE (L)'          : round(f4['rmse'],    1),
        'Error relativo %'  : round(f4['err_rel'], 2),
        'Acepta (<10%)'     : 'SÍ ✓' if f4['err_rel'] < 10 else 'NO',
    })

tabla_oficial = pd.DataFrame(filas_oficial).set_index('Modelo')
print(tabla_oficial.to_string())

mejor_fold4 = cv_results[mejor_nombre][3]
print(f"\n    ✓ Modelo ganador : {mejor_nombre}")
print(f"      MAE            : {mejor_fold4['mae']:,.1f} L")
print(f"      RMSE           : {mejor_fold4['rmse']:,.1f} L")
print(f"      Error relativo : {mejor_fold4['err_rel']:.2f}%")
umbral_ok = mejor_fold4['err_rel'] < 10
print(f"      Criterio <10%  : {'APROBADO ✓' if umbral_ok else 'RECHAZADO ✗'}")

# =============================================================================
# 9. GRÁFICO 1 — MAE por fold y modelo (evolución temporal del error)
# =============================================================================
print(f"\n[7] Generando gráficos...")

fig, axes = plt.subplots(1, 3, figsize=(17, 5))
colores_modelo = {
    'Regresión Lineal' : 'steelblue',
    'Árbol de Decisión': 'coral',
    'Random Forest'    : 'seagreen',
}
años_test = [f['test'] for f in FOLDS]

# Panel 1: MAE por fold
for nombre, folds in cv_results.items():
    maes = [f['mae'] for f in folds]
    axes[0].plot(años_test, maes, marker='o', linewidth=2,
                 label=nombre, color=colores_modelo[nombre])

axes[0].axvline(x=años_test[-1], color='red', linestyle=':', linewidth=1.2,
                label='Hold-out oficial')
axes[0].set_title('MAE por fold (evolución temporal)', fontweight='bold')
axes[0].set_xlabel('Período de prueba')
axes[0].set_ylabel('MAE (litros)')
axes[0].legend(fontsize=8)
axes[0].yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f'{v:,.0f}'))

# Panel 2: MAE medio ± std (barras de error)
nombres   = list(cv_results.keys())
mae_medios = [np.mean([f['mae'] for f in cv_results[n]]) for n in nombres]
mae_stds   = [np.std( [f['mae'] for f in cv_results[n]]) for n in nombres]

bars = axes[1].bar(nombres, mae_medios,
                   color=[colores_modelo[n] for n in nombres],
                   alpha=0.85, edgecolor='white')
axes[1].errorbar(nombres, mae_medios, yerr=mae_stds,
                 fmt='none', color='black', capsize=6, linewidth=2)
axes[1].set_title('MAE medio ± std (4 folds)', fontweight='bold')
axes[1].set_xticklabels(nombres, rotation=12, ha='right')
axes[1].set_ylabel('MAE (litros)')
axes[1].yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f'{v:,.0f}'))
for bar, val, std in zip(bars, mae_medios, mae_stds):
    axes[1].text(bar.get_x() + bar.get_width()/2, val + std + 20,
                 f'{val:,.0f}', ha='center', va='bottom', fontsize=9)

# Panel 3: Error relativo % por fold
for nombre, folds in cv_results.items():
    err_rels = [f['err_rel'] for f in folds]
    axes[2].plot(años_test, err_rels, marker='s', linewidth=2,
                 label=nombre, color=colores_modelo[nombre])

axes[2].axhline(y=10, color='red', linestyle='--', linewidth=1.5,
                label='Umbral 10%')
axes[2].set_title('Error relativo % por fold', fontweight='bold')
axes[2].set_xlabel('Período de prueba')
axes[2].set_ylabel('Error relativo (%)')
axes[2].legend(fontsize=8)

plt.suptitle('Validación cruzada TimeSeriesSplit — 4 folds',
             fontsize=13, fontweight='bold', y=1.02)
plt.tight_layout()
plt.savefig('fig_cv_resultados.png', bbox_inches='tight')
plt.close()
print("    fig_cv_resultados.png        ✓")

# =============================================================================
# 10. GRÁFICO 2 — Valores reales vs predichos (fold 4, 3 modelos)
# =============================================================================
fig, axes = plt.subplots(1, 3, figsize=(16, 5))

for ax, nombre in zip(axes, cv_results):
    f4     = cv_results[nombre][3]
    y_real = f4['y_real']
    y_pred = f4['y_pred']
    lim    = max(y_real.max(), y_pred.max()) * 1.05

    ax.scatter(y_real, y_pred, alpha=0.35, s=12,
               color=colores_modelo[nombre])
    ax.plot([0, lim], [0, lim], 'r--', linewidth=1.2,
            label='Predicción perfecta')
    ax.set_xlim(0, lim); ax.set_ylim(0, lim)
    ax.set_xlabel('Consumo real (litros)')
    ax.set_ylabel('Consumo predicho (litros)')
    ax.set_title(f'{nombre}\nMAE={f4["mae"]:,.0f} L  '
                 f'Err.rel={f4["err_rel"]:.2f}%', fontweight='bold')
    ax.legend(fontsize=8)
    ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f'{v:,.0f}'))
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f'{v:,.0f}'))

plt.suptitle('Real vs Predicho — Hold-out 2018-19 (Fold 4)',
             fontsize=13, fontweight='bold', y=1.02)
plt.tight_layout()
plt.savefig('fig_real_vs_predicho.png', bbox_inches='tight')
plt.close()
print("    fig_real_vs_predicho.png     ✓")

# =============================================================================
# 11. GRÁFICO 3 — Residuos del modelo ganador (fold 4)
# =============================================================================
f4_mejor  = cv_results[mejor_nombre][3]
residuos  = f4_mejor['y_real'] - f4_mejor['y_pred']

fig, axes = plt.subplots(1, 2, figsize=(13, 5))

axes[0].hist(residuos, bins=40, color='steelblue',
             edgecolor='white', linewidth=0.4)
axes[0].axvline(0, color='red', linestyle='--', linewidth=1.5,
                label='Error = 0')
axes[0].axvline(residuos.mean(), color='orange', linestyle='--',
                linewidth=1.5,
                label=f'Media = {residuos.mean():.0f} L')
axes[0].set_title(f'Distribución de residuos — {mejor_nombre}',
                  fontweight='bold')
axes[0].set_xlabel('Residuo (real − predicho) en litros')
axes[0].set_ylabel('Frecuencia')
axes[0].legend()

axes[1].scatter(f4_mejor['y_pred'], residuos,
                alpha=0.35, s=12, color='steelblue')
axes[1].axhline(0, color='red', linestyle='--', linewidth=1.5)
axes[1].set_title(f'Residuos vs Predichos — {mejor_nombre}',
                  fontweight='bold')
axes[1].set_xlabel('Consumo predicho (litros)')
axes[1].set_ylabel('Residuo (litros)')
axes[1].xaxis.set_major_formatter(
    mticker.FuncFormatter(lambda v, _: f'{v:,.0f}'))
axes[1].yaxis.set_major_formatter(
    mticker.FuncFormatter(lambda v, _: f'{v:,.0f}'))

plt.suptitle(f'Diagnóstico de residuos — {mejor_nombre} (Hold-out 2018-19)',
             fontsize=13, fontweight='bold', y=1.02)
plt.tight_layout()
plt.savefig('fig_residuos.png', bbox_inches='tight')
plt.close()
print("    fig_residuos.png             ✓")

# =============================================================================
# 12. GRÁFICO 4 — Importancia de features (Random Forest, fold 4)
# =============================================================================
if 'Random Forest' in cv_results:
    rf_pipe      = cv_results['Random Forest'][3]['pipeline']
    importancias = rf_pipe.named_steps['mod'].feature_importances_
    imp_df = (
        pd.DataFrame({'Feature': FEATURES_NUM + FEATURES_CAT,
                      'Importancia': importancias})
        .sort_values('Importancia', ascending=True)
    )

    fig, ax = plt.subplots(figsize=(8, 4))
    n = len(imp_df)
    colores_barra = ['#2196F3' if i >= n - 2 else '#90CAF9'
                     for i in range(n)]
    ax.barh(imp_df['Feature'], imp_df['Importancia'],
            color=colores_barra, edgecolor='white')
    ax.set_title('Importancia de features — Random Forest (Fold 4 / 2018-19)',
                 fontweight='bold')
    ax.set_xlabel('Importancia relativa (Gini)')
    for i, (val, _) in enumerate(
            zip(imp_df['Importancia'], imp_df['Feature'])):
        ax.text(val + 0.002, i, f'{val:.3f}', va='center', fontsize=9)

    plt.tight_layout()
    plt.savefig('fig_importancia_features.png', bbox_inches='tight')
    plt.close()
    print("    fig_importancia_features.png ✓")

# =============================================================================
# 13. ERROR POR CATEGORÍA DE VEHÍCULO — modelo ganador, fold 4
# =============================================================================
print(f"\n[8] Error por categoría de vehículo ({mejor_nombre}, hold-out 2018-19):")
print("-" * 65)

test_df = df[df['year'] == '2018-19'].copy()
pipeline_ganador = cv_results[mejor_nombre][3]['pipeline']

test_df['predicho']   = np.expm1(pipeline_ganador.predict(test_df[FEATURES]))
test_df['error_abs']  = (test_df[TARGET_RAW] - test_df['predicho']).abs()
test_df['error_rel%'] = test_df['error_abs'] / test_df[TARGET_RAW] * 100

por_cat = (
    test_df.groupby('vehicle_cat')
    .agg(n=('error_abs', 'count'),
         mae_L=('error_abs', 'mean'),
         err_rel_median=('error_rel%', 'median'))
    .round(2)
    .sort_values('mae_L', ascending=False)
)
print(por_cat.to_string())

# =============================================================================
# 14. EXPORTACIÓN DEL MODELO GANADOR (entrenado con todos los datos pre-2018-19)
# =============================================================================
print(f"\n[9] Exportando modelo de producción...")

# Random Forest se exporta como modelo de producción por su respuesta gradual
# a cambios continuos de eficiencia y distancia (suaviza la función escalón
# del Árbol de Decisión al promediar múltiples árboles con distintos umbrales).
# El Árbol de Decisión queda documentado en resultados_modelos.csv como baseline.
MODELO_PRODUCCION = 'Random Forest'
pipeline_produccion = crear_modelos()[MODELO_PRODUCCION]
train_final = df[df['year'].isin(['2013', '2014', '2015-16', '2016-17'])]
pipeline_produccion.fit(train_final[FEATURES], train_final['log_fuel'])

joblib.dump(pipeline_produccion, 'modelo_combustible.joblib')
print(f"    modelo_combustible.joblib  ✓  ({MODELO_PRODUCCION})")

tabla_oficial.reset_index().to_csv('resultados_modelos.csv', index=False)
tabla_cv.reset_index().to_csv('resultados_cv.csv', index=False)
print(f"    resultados_modelos.csv     ✓")
print(f"    resultados_cv.csv          ✓")

# =============================================================================
# 15. RESUMEN FINAL
# =============================================================================
print(f"\n{'=' * 65}")
print(f"RESUMEN FINAL")
print(f"{'=' * 65}")
rf_fold4  = cv_results['Random Forest'][3]
rf_cv_mae = tabla_cv.loc['Random Forest', 'MAE medio (L)']
rf_cv_std = tabla_cv.loc['Random Forest', 'MAE std (L)']
rf_ok     = rf_fold4['err_rel'] < 10

print(f"  Estrategia        : TimeSeriesSplit — 4 folds temporales")
print(f"  Mejor CV (MAE)    : {mejor_nombre}")
print(f"  Producción        : {MODELO_PRODUCCION} (respuesta gradual continua)")
print(f"  MAE CV medio RF   : {rf_cv_mae:,.1f} ± {rf_cv_std:,.1f} L")
print(f"  --- Hold-out oficial (2018-19) — Random Forest ---")
print(f"  MAE               : {rf_fold4['mae']:,.1f} L")
print(f"  RMSE              : {rf_fold4['rmse']:,.1f} L")
print(f"  Error relativo    : {rf_fold4['err_rel']:.2f}%")
print(f"  Criterio <10%     : {'APROBADO ✓' if rf_ok else 'RECHAZADO ✗'}")
print(f"\nArchivos generados:")
for f in ['fig_cv_resultados.png', 'fig_real_vs_predicho.png',
          'fig_residuos.png', 'fig_importancia_features.png',
          'modelo_combustible.joblib', 'resultados_modelos.csv',
          'resultados_cv.csv']:
    print(f"  {f}")
print(f"{'=' * 65}\n")
