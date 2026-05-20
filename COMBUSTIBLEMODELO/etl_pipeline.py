"""
ETL Pipeline - Gestión de Combustibles de Flota
================================================
Tesis: Sistema Inteligente Basado en Aprendizaje Supervisado
        para la Gestión de Combustibles y Trazabilidad de Emisiones
Autora: Melanie Constanza Seguel Orellana
"""

import pandas as pd
import numpy as np

LITERS_PER_UK_GALLON    = 4.54609
KM_PER_MILE             = 1.60934
CO2_DIESEL_KG_PER_LITER = 2.68
CO2_GASOIL_KG_PER_LITER = 1.89


def parse_distance_to_km(val):
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
    df = pd.read_csv(path)
    type_col = 'Type' if 'Type' in df.columns else 'Typ'
    out = pd.DataFrame()
    out['fleet_id']    = df['Fleet'].astype(str).str.strip()
    out['vehicle']     = df['Vehicle'].astype(str).str.strip()
    out['fuel_type']   = df[type_col].astype(str).str.strip()
    out['fuel_liters'] = pd.to_numeric(df['Fuel'], errors='coerce')
    out['dist_km']     = df['Dist.Run'].apply(parse_distance_to_km)
    out['mpg']         = pd.to_numeric(df['MPG'], errors='coerce')
    out['year']        = year_label
    return out


def load_2016(path):
    df = pd.read_csv(path)
    out = pd.DataFrame()
    out['fleet_id']    = df['Fleet'].astype(str).str.strip()
    out['vehicle']     = df['Vehicle'].astype(str).str.strip()
    out['fuel_type']   = df['Typ'].astype(str).str.strip()
    out['fuel_liters'] = pd.to_numeric(df['Fuel'], errors='coerce')
    out['dist_km']     = df['Dist.Run'].apply(parse_distance_to_km)
    out['mpg']         = pd.to_numeric(df['MPG'], errors='coerce')
    out['year']        = '2016-17'
    return out


def load_2018(path):
    df = pd.read_csv(path).dropna(subset=['Product'])
    out = pd.DataFrame()
    out['fleet_id']  = df['Registration'].astype(str).str.strip()
    out['vehicle']   = df['Details'].astype(str).str.strip()
    out['fuel_type'] = df['Product'].map(
        {'Diesel': 'D', 'Gasoil': 'G', 'CNG': 'G'}
    ).fillna('D')
    dist           = pd.to_numeric(df['Distance'], errors='coerce')
    unit           = df['Unit'].astype(str).str.strip()
    out['dist_km'] = np.where(unit == 'Miles', dist * KM_PER_MILE, dist)
    mpg            = pd.to_numeric(df['MPG'], errors='coerce')
    dist_miles     = np.where(unit == 'Miles', dist, dist / KM_PER_MILE)
    out['fuel_liters'] = (dist_miles / mpg) * LITERS_PER_UK_GALLON
    out['mpg']         = mpg
    out['year']        = '2018-19'
    return out


def classify_vehicle(name):
    n = str(name).upper().strip()
    if any(k in n for k in [
        'BIN', 'TIPPER', 'TIPP', 'TIPE', 'HOOKLOAD', 'GULLY',
        'SWEEPER', 'SWEEPE', 'BULK GRIT', 'GRITTER', 'HGV',
        'FLATBACK', 'FLATBED', 'HOIST', 'PLANT', '18TN', '26TN',
        'TRACTOR', 'LOADING SH', 'AROCS', 'ECONIC', 'KERAX',
        'CARGO', 'ATEGO', 'MIDLUM', 'CANTER', 'CC TIP', 'DEMOUNT'
    ]):
        return 'Truck'
    if any(k in n for k in [
        'VAN', 'TRANSIT', 'MASTER', 'BOXER', 'SPRINTER', 'DUCATO',
        'EXPERT', 'PARTNER', 'CONNECT', 'CADDY', 'COMBO', 'CRAFTER',
        'TRANSPORTER', 'LUTON', 'MOVANO', 'MEDIUM VAN', 'SMALL VAN',
        'LARGE VAN', 'MED VAN'
    ]):
        return 'Van'
    if any(k in n for k in [
        'BUS', 'MINIBUS', 'WELFARE', 'COACH', 'MELLOR', 'TREKA',
        'LIBRARY', 'MPV', 'COMBI', 'MOBILE', 'MEETING', 'TEPEE'
    ]):
        return 'Bus'
    if any(k in n for k in [
        'CAR', 'LIMOUSINE', 'MONDEO', 'ASTRA', 'CORSA', 'FIESTA',
        'KUGA', 'MOKKA', 'RANGER', '4X4', '4 X 4', '308'
    ]):
        return 'Car'
    return 'Other'


def transform(df):
    df = df.dropna(subset=['fuel_liters'])
    df = df[df['fuel_type'].isin(['D', 'G'])]
    df = df[df['fuel_liters'] > 0]
    p995 = df['fuel_liters'].quantile(0.995)
    df = df[df['fuel_liters'] <= p995]
    df = df.copy()
    df['km_per_liter'] = df['dist_km'] / df['fuel_liters']
    df.loc[df['km_per_liter'] < 0,  'km_per_liter'] = np.nan
    df.loc[df['km_per_liter'] > 50, 'km_per_liter'] = np.nan
    df['co2_kg'] = np.where(
        df['fuel_type'] == 'D',
        df['fuel_liters'] * CO2_DIESEL_KG_PER_LITER,
        df['fuel_liters'] * CO2_GASOIL_KG_PER_LITER
    )
    df['vehicle_cat'] = df['vehicle'].apply(classify_vehicle)

    # Eliminacion de registros sin descripcion de vehiculo clasificable:
    # 5 registros con vehicle_cat='Other' corresponden a filas con nombre de
    # vehiculo nulo (basura o registros de prueba) que no pueden asignarse a
    # ninguna categoria con evidencia. Se eliminan por representar el 0.09%
    # del dataset, sin impacto estadistico en el entrenamiento.
    df = df[df['vehicle_cat'] != 'Other']
    return df


def run_etl(output_path='fleet_fuel_clean.csv'):
    print("Iniciando pipeline ETL...")
    dfs = [
        load_early("2013-1.csv",    "2013"),
        load_early("2014-2.csv",    "2014"),
        load_early("2015-16-5.csv", "2015-16"),
        load_2016("2016-17-3.csv"),
        load_2018("2018-19-4.csv"),
    ]
    raw = pd.concat(dfs, ignore_index=True)
    print(f"   Filas extraidas: {len(raw)}")
    clean = transform(raw)
    print(f"   Filas tras limpieza: {len(clean)}")
    print(f"   Distribucion tipo combustible:\n{clean['fuel_type'].value_counts().to_string()}")
    print(f"   Distribucion categoria vehiculo:\n{clean['vehicle_cat'].value_counts().to_string()}")
    clean.to_csv(output_path, index=False)
    print(f"\nDataset limpio guardado en: {output_path}")
    print(f"   Shape final: {clean.shape}")
    return clean


if __name__ == "__main__":
    df = run_etl()
    print("\nColumnas disponibles para modelo ML:")
    print(list(df.columns))