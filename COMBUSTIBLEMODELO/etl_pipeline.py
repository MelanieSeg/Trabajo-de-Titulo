"""
ETL Pipeline - Gestión de Combustibles de Flota

Fuente de datos: Fleet Vehicles Fuel Consumption (Leeds City Council)
Archivos: 2013-1.csv, 2014-2.csv, 2015-16-5.csv, 2016-17-3.csv, 2018-19-4.csv

Resultado: fleet_fuel_clean.csv — dataset unificado y limpio para entrenamiento ML
"""

import pandas as pd
import numpy as np

# ============================================================
# CONSTANTES DE CONVERSIÓN Y FACTORES DE EMISIÓN
# ============================================================
LITERS_PER_UK_GALLON   = 4.54609   # 1 galón UK = 4.54609 litros
KM_PER_MILE            = 1.60934   # 1 milla = 1.60934 km
CO2_DIESEL_KG_PER_LITER = 2.68     # Factor IPCC: diésel
CO2_GASOIL_KG_PER_LITER = 1.89     # Factor IPCC: gas oil / CNG


# ============================================================
# EXTRACCIÓN — Carga de archivos por año
# ============================================================

def parse_distance_to_km(val):
    """
    Convierte valores sucios de distancia a kilómetros.
    Ejemplos de entrada: '3673M', '1216K', '1216K*', 'ERROR', 'ONLY'
    - Sufijo M = millas → convertir a km
    - Sufijo K = kilómetros → retornar directo
    - ERROR / ONLY / vacío → NaN
    """
    if pd.isna(val):
        return np.nan
    s = str(val).strip().upper().replace('*', '').replace(',', '')
    if s in ('ERROR', 'ONLY', '', 'N/A'):
        return np.nan
    if s.endswith('M'):
        try:
            return float(s[:-1]) * KM_PER_MILE
        except ValueError:
            return np.nan
    if s.endswith('K'):
        try:
            return float(s[:-1])
        except ValueError:
            return np.nan
    try:
        return float(s)
    except ValueError:
        return np.nan


def load_early(path, year_label):
    """
    Carga archivos 2013, 2014 y 2015-16.
    Estructura: ExtractDate, Fleet, Vehicle, Fuel, Dist.Run, MPG, Type/Typ
    """
    df = pd.read_csv(path)
    type_col = 'Type' if 'Type' in df.columns else 'Typ'
    out = pd.DataFrame()
    out['year']        = year_label
    out['fleet_id']    = df['Fleet'].astype(str).str.strip()
    out['vehicle']     = df['Vehicle'].astype(str).str.strip()
    out['fuel_type']   = df[type_col].astype(str).str.strip()   # D o G
    out['fuel_liters'] = pd.to_numeric(df['Fuel'], errors='coerce')
    out['dist_km']     = df['Dist.Run'].apply(parse_distance_to_km)
    out['mpg']         = pd.to_numeric(df['MPG'], errors='coerce')
    return out


def load_2016(path):
    """
    Carga archivo 2016-17. Misma lógica que archivos tempranos,
    columnas ligeramente distintas (Reference en lugar de ExtractDate).
    """
    df = pd.read_csv(path)
    out = pd.DataFrame()
    out['year']        = '2016-17'
    out['fleet_id']    = df['Fleet'].astype(str).str.strip()
    out['vehicle']     = df['Vehicle'].astype(str).str.strip()
    out['fuel_type']   = df['Typ'].astype(str).str.strip()
    out['fuel_liters'] = pd.to_numeric(df['Fuel'], errors='coerce')
    out['dist_km']     = df['Dist.Run'].apply(parse_distance_to_km)
    out['mpg']         = pd.to_numeric(df['MPG'], errors='coerce')
    return out


def load_2018(path):
    """
    Carga archivo 2018-19. Estructura completamente distinta:
    - No tiene columna Fuel directa → se calcula desde MPG + Distance
    - Distancia puede estar en millas o kilómetros (columna Unit)
    - Tipo de combustible: Diesel / Gasoil / CNG
    """
    df = pd.read_csv(path).dropna(subset=['Product'])
    out = pd.DataFrame()
    out['year']      = '2018-19'
    out['fleet_id']  = df['Registration'].astype(str).str.strip()
    out['vehicle']   = df['Details'].astype(str).str.strip()
    out['fuel_type'] = df['Product'].map(
        {'Diesel': 'D', 'Gasoil': 'G', 'CNG': 'G'}
    ).fillna('D')

    dist = pd.to_numeric(df['Distance'], errors='coerce')
    unit = df['Unit'].astype(str).str.strip()

    # Convertir distancia a km
    out['dist_km'] = np.where(unit == 'Miles', dist * KM_PER_MILE, dist)

    # Calcular litros: (millas / MPG) × litros_por_galón
    mpg = pd.to_numeric(df['MPG'], errors='coerce')
    dist_miles = np.where(unit == 'Miles', dist, dist / KM_PER_MILE)
    out['fuel_liters'] = (dist_miles / mpg) * LITERS_PER_UK_GALLON
    out['mpg']         = mpg
    return out


# ============================================================
# TRANSFORMACIÓN — Unificación y limpieza
# ============================================================

def transform(df):
    # 1. Eliminar filas sin variable objetivo
    df = df.dropna(subset=['fuel_liters'])

    # 2. Solo combustibles relevantes al alcance del proyecto
    df = df[df['fuel_type'].isin(['D', 'G'])]

    # 3. Eliminar valores negativos o cero (errores de registro)
    df = df[df['fuel_liters'] > 0]

    # 4. Eliminar outliers extremos (percentil 99.5)
    p995 = df['fuel_liters'].quantile(0.995)
    df = df[df['fuel_liters'] <= p995]

    # 5. Calcular eficiencia km/litro
    df = df.copy()
    df['km_per_liter'] = df['dist_km'] / df['fuel_liters']
    df.loc[df['km_per_liter'] < 0,  'km_per_liter'] = np.nan
    df.loc[df['km_per_liter'] > 50, 'km_per_liter'] = np.nan  # físicamente imposible

    # 6. Calcular variable objetivo CO2 con factores IPCC
    df['co2_kg'] = np.where(
        df['fuel_type'] == 'D',
        df['fuel_liters'] * CO2_DIESEL_KG_PER_LITER,
        df['fuel_liters'] * CO2_GASOIL_KG_PER_LITER
    )

    # 7. Categorizar tipo de vehículo para usarlo como feature
    vehicle_map = {
        'SMALL VAN': 'Van',    'MED VAN': 'Van',     'LARGE VAN': 'Van',
        'LUTON': 'Van',        'MASTER': 'Van',
        'MED TIPPER': 'Truck', 'LOADING SH': 'Truck', '2 AXLE BIN': 'Truck',
        '3 AXLE BIN': 'Truck', 'FLATBACK': 'Truck',   'TRACTOR': 'Truck',
        'SML SWEEPE': 'Truck',
        'CAR': 'Car',
        'MINIBUS': 'Bus',      'LIBRARY BU': 'Bus',
    }
    df['vehicle_cat'] = df['vehicle'].map(vehicle_map).fillna('Other')

    return df


# ============================================================
# CARGA — Guardar dataset limpio
# ============================================================

def run_etl(output_path='fleet_fuel_clean.csv'):
    print("🔄 Iniciando pipeline ETL...")

    # Extracción
    dfs = [
        load_early("2013-1.csv",    "2013"),
        load_early("2014-2.csv",    "2014"),
        load_early("2015-16-5.csv", "2015-16"),
        load_2016("2016-17-3.csv"),
        load_2018("2018-19-4.csv"),
    ]
    raw = pd.concat(dfs, ignore_index=True)
    print(f"   Filas extraídas: {len(raw)}")

    # Transformación
    clean = transform(raw)
    print(f"   Filas tras limpieza: {len(clean)}")
    print(f"   Nulos en dist_km: {clean['dist_km'].isna().sum()}")
    print(f"   Distribución tipo combustible:\n{clean['fuel_type'].value_counts().to_string()}")
    print(f"   Distribución categoría vehículo:\n{clean['vehicle_cat'].value_counts().to_string()}")

    # Carga
    clean.to_csv(output_path, index=False)
    print(f"\n✅ Dataset limpio guardado en: {output_path}")
    print(f"   Shape final: {clean.shape}")
    return clean


if __name__ == "__main__":
    df = run_etl()
    print("\nColumnas disponibles para modelo ML:")
    print([c for c in df.columns])
