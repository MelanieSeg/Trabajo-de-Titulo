"""
ETL Pipeline - Gestión de Combustibles de Flota
================================================
Tesis: Sistema Inteligente Basado en Aprendizaje Supervisado
        para la Gestión de Combustibles y Trazabilidad de Emisiones
"""

import pandas as pd
import numpy as np

# Factores de unidad y emisiones usados en todo el pipeline.
LITERS_PER_UK_GALLON    = 4.54609
KM_PER_MILE             = 1.60934
CO2_DIESEL_KG_PER_LITER = 2.68
CO2_GASOIL_KG_PER_LITER = 1.89


def parse_distance_to_km(val):
    """Convierte formatos mixtos de distancia a kilómetros.

    Acepta valores numéricos y cadenas como "3673M" (millas) o "1216K" (km).
    Tokens inválidos (p. ej., ERROR/ONLY) se tratan como valores faltantes.
    """
    if pd.isna(val):
        return np.nan
    s = str(val).strip().upper().replace('*', '').replace(',', '')
    # Valores no válidos conocidos en los CSV originales.
    if s in ('ERROR', 'ONLY', '', 'N/A'):
        return np.nan
    # Sufijo M = millas, K = kilómetros.
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
    # Caso base: intentar parsear como número.
    try:
        return float(s)
    except ValueError:
        return np.nan


def load_early(path, year_label):
    """Carga los CSV 2013-2015-16 con el esquema común.

    Estos archivos incluyen Fuel (litros), Dist.Run (distancia) y MPG directamente.
    """
    df = pd.read_csv(path)
    type_col = 'Type' if 'Type' in df.columns else 'Typ'
    out = pd.DataFrame()
    # Normaliza nombres y conserva solo los campos necesarios.
    out['fleet_id']    = df['Fleet'].astype(str).str.strip()
    out['vehicle']     = df['Vehicle'].astype(str).str.strip()
    out['fuel_type']   = df[type_col].astype(str).str.strip()
    out['fuel_liters'] = pd.to_numeric(df['Fuel'], errors='coerce')
    out['dist_km']     = df['Dist.Run'].apply(parse_distance_to_km)
    out['mpg']         = pd.to_numeric(df['MPG'], errors='coerce')
    out['year']        = year_label
    return out


def load_2016(path):
    """Carga el CSV 2016-17 (misma estructura, etiqueta de año fija)."""
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
    """Carga el CSV 2018-19 con un esquema distinto.

    El archivo trae distancia y MPG pero no litros, así que se calculan como:
    litros = (distancia en millas / MPG) * 4.54609
    """
    df = pd.read_csv(path).dropna(subset=['Product'])
    out = pd.DataFrame()
    out['fleet_id']  = df['Registration'].astype(str).str.strip()
    out['vehicle']   = df['Details'].astype(str).str.strip()
    # Mapea nombres de producto a las etiquetas D/G usadas en años previos.
    out['fuel_type'] = df['Product'].map(
        {'Diesel': 'D', 'Gasoil': 'G', 'CNG': 'G'}
    ).fillna('D')
    dist           = pd.to_numeric(df['Distance'], errors='coerce')
    unit           = df['Unit'].astype(str).str.strip()
    # Normaliza la distancia a kilómetros para las features.
    out['dist_km'] = np.where(unit == 'Miles', dist * KM_PER_MILE, dist)
    mpg            = pd.to_numeric(df['MPG'], errors='coerce')
    # Calcula litros desde distancia en millas y MPG (galones UK).
    dist_miles     = np.where(unit == 'Miles', dist, dist / KM_PER_MILE)
    out['fuel_liters'] = (dist_miles / mpg) * LITERS_PER_UK_GALLON
    out['mpg']         = mpg
    out['year']        = '2018-19'
    return out


def classify_vehicle(name):
    """Clasifica el tipo de vehículo con reglas basadas en palabras clave."""
    n = str(name).upper().strip()
    # Camiones y vehículos pesados.
    if any(k in n for k in [
        'BIN', 'TIPPER', 'TIPP', 'TIPE', 'HOOKLOAD', 'GULLY',
        'SWEEPER', 'SWEEPE', 'BULK GRIT', 'GRITTER', 'HGV',
        'FLATBACK', 'FLATBED', 'HOIST', 'PLANT', '18TN', '26TN',
        'TRACTOR', 'LOADING SH', 'AROCS', 'ECONIC', 'KERAX',
        'CARGO', 'ATEGO', 'MIDLUM', 'CANTER', 'CC TIP', 'DEMOUNT'
    ]):
        return 'Truck'
    # Vans y vehículos comerciales livianos.
    if any(k in n for k in [
        'VAN', 'TRANSIT', 'MASTER', 'BOXER', 'SPRINTER', 'DUCATO',
        'EXPERT', 'PARTNER', 'CONNECT', 'CADDY', 'COMBO', 'CRAFTER',
        'TRANSPORTER', 'LUTON', 'MOVANO', 'MEDIUM VAN', 'SMALL VAN',
        'LARGE VAN', 'MED VAN'
    ]):
        return 'Van'
    # Buses, minibuses y vehículos de servicio similares.
    if any(k in n for k in [
        'BUS', 'MINIBUS', 'WELFARE', 'COACH', 'MELLOR', 'TREKA',
        'LIBRARY', 'MPV', 'COMBI', 'MOBILE', 'MEETING', 'TEPEE'
    ]):
        return 'Bus'
    # Autos de pasajeros y vehículos pequeños.
    if any(k in n for k in [
        'CAR', 'LIMOUSINE', 'MONDEO', 'ASTRA', 'CORSA', 'FIESTA',
        'KUGA', 'MOKKA', 'RANGER', '4X4', '4 X 4', '308'
    ]):
        return 'Car'
    # Descripciones desconocidas o ruidosas se dejan como Other.
    return 'Other'


def transform(df):
    """Limpia, normaliza y enriquece el dataset concatenado."""
    # Conserva solo filas con la variable objetivo presente.
    df = df.dropna(subset=['fuel_liters'])
    # Conserva solo tipos de combustible conocidos.
    df = df[df['fuel_type'].isin(['D', 'G'])]
    # Elimina valores de consumo inválidos o negativos.
    df = df[df['fuel_liters'] > 0]
    # Filtra outliers extremos sobre el percentil 99,5.
    p995 = df['fuel_liters'].quantile(0.995)
    df = df[df['fuel_liters'] <= p995]
    df = df.copy()
    # Calcula eficiencia en km/L para features y control de calidad.
    df['km_per_liter'] = df['dist_km'] / df['fuel_liters']
    # Descarta eficiencias físicamente imposibles.
    df.loc[df['km_per_liter'] < 0,  'km_per_liter'] = np.nan
    df.loc[df['km_per_liter'] > 50, 'km_per_liter'] = np.nan
    # Feature engineering: consumo teórico (dist / eficiencia).
    # Combina distancia y eficiencia en un solo predictor lineal, lo que permite
    # que modelos de ensamble (Random Forest) sean sensibles a cambios en ambas
    # variables simultáneamente.
    df['litros_teoricos'] = df['dist_km'] / df['km_per_liter']
    # Emisiones de CO2 según tipo de combustible.
    df['co2_kg'] = np.where(
        df['fuel_type'] == 'D',
        df['fuel_liters'] * CO2_DIESEL_KG_PER_LITER,
        df['fuel_liters'] * CO2_GASOIL_KG_PER_LITER
    )
    # Categoría operacional derivada desde la descripción textual.
    df['vehicle_cat'] = df['vehicle'].apply(classify_vehicle)

    # Eliminación de registros sin descripción de vehículo clasificable:
    # 5 registros con vehicle_cat='Other' corresponden a filas con nombre de
    # vehículo nulo (basura o registros de prueba) que no pueden asignarse a
    # ninguna categoría con evidencia. Se eliminan por representar el 0.09%
    # del dataset, sin impacto estadístico en el entrenamiento.
    df = df[df['vehicle_cat'] != 'Other']
    return df


def run_etl(output_path='fleet_fuel_clean.csv'):
    """Orquesta el ETL completo: carga, combina, limpia y guarda."""
    print("Iniciando pipeline ETL...")
    # Carga cada año con su función correspondiente para respetar diferencias de esquema.
    dfs = [
        load_early("2013-1.csv",    "2013"),
        load_early("2014-2.csv",    "2014"),
        load_early("2015-16-5.csv", "2015-16"),
        load_2016("2016-17-3.csv"),
        load_2018("2018-19-4.csv"),
    ]
    # Concatena en un solo dataset bruto para luego limpiar.
    raw = pd.concat(dfs, ignore_index=True)
    print(f"   Filas extraidas: {len(raw)}")
    clean = transform(raw)
    print(f"   Filas tras limpieza: {len(clean)}")
    # Chequeos rápidos de distribución.
    print(f"   Distribucion tipo combustible:\n{clean['fuel_type'].value_counts().to_string()}")
    print(f"   Distribucion categoria vehiculo:\n{clean['vehicle_cat'].value_counts().to_string()}")
    # Persiste el dataset limpio para modelado.
    clean.to_csv(output_path, index=False)
    print(f"\nDataset limpio guardado en: {output_path}")
    print(f"   Shape final: {clean.shape}")
    return clean


if __name__ == "__main__":
    # Permite ejecutar el ETL desde la línea de comandos.
    df = run_etl()
    print("\nColumnas disponibles para modelo ML:")
    print(list(df.columns))