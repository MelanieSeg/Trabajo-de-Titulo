from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


@dataclass
class DatasetConfig:
    name: str
    company_name: str
    focus: str
    software_start_year: int
    start_year: int = 2000
    end_year: int = 2026
    facilities: int = 60


REGIONS = [
    "Santiago",
    "Valparaiso",
    "Biobio",
    "Antofagasta",
    "Coquimbo",
    "Maule",
    "Los Lagos",
    "Atacama",
]


def _distribution(rng: np.random.Generator) -> tuple[float, float, float, float, float]:
    values = np.array(
        [
            27.0 + rng.normal(0, 1.3),
            34.0 + rng.normal(0, 1.4),
            23.0 + rng.normal(0, 1.2),
            11.0 + rng.normal(0, 0.9),
            5.0 + rng.normal(0, 0.5),
        ],
        dtype=float,
    )
    values = np.clip(values, 1.0, None)
    values = (values / values.sum()) * 100.0
    return tuple(float(round(v, 2)) for v in values)


def _build_dataset(config: DatasetConfig, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows: list[dict[str, float | int | str]] = []

    yearly_points = (config.end_year - config.start_year + 1) * 12
    software_idx = (config.software_start_year - config.start_year) * 12

    for facility_idx in range(config.facilities):
        facility_name = f"Planta {facility_idx + 1:02d}"
        region = REGIONS[facility_idx % len(REGIONS)]

        base_e = 1700 + facility_idx * 36 + rng.normal(0, 18)
        base_w = 680 + facility_idx * 14 + rng.normal(0, 11)
        phase = (facility_idx % 12) / 12.0 * 2.0 * np.pi

        for offset in range(yearly_points):
            year = config.start_year + (offset // 12)
            month = (offset % 12) + 1

            seasonal_e = 1.0 + 0.12 * np.sin((2 * np.pi * month / 12.0) + phase)
            seasonal_w = 1.0 + 0.10 * np.cos((2 * np.pi * month / 12.0) + phase / 2.0)

            if offset < software_idx:
                # Etapa sin software de gestión energética: crecimiento ineficiente.
                inefficiency = 1.0 + 0.0028 * offset
            else:
                # Etapa con software: reducción gradual por recomendaciones aplicadas.
                post_offset = offset - software_idx
                inefficiency = max(0.79, (1.0 + 0.0028 * software_idx) - 0.0045 * post_offset)

            focus_e = 1.20 if config.focus == "electricity" else 1.0
            focus_w = 1.20 if config.focus == "water" else 1.0

            electricity = base_e * seasonal_e * inefficiency * focus_e + rng.normal(0, 28)
            water = base_w * seasonal_w * inefficiency * focus_w + rng.normal(0, 15)

            electricity = max(250.0, electricity)
            water = max(120.0, water)

            # Tarifas con inflación y variación mensual.
            year_progress = year - config.start_year
            e_rate = 0.085 + (year_progress * 0.0017) + (0.002 * np.sin(2 * np.pi * month / 12.0))
            w_rate = 1.18 + (year_progress * 0.018) + (0.045 * np.cos(2 * np.pi * month / 12.0))

            electricity_cost = electricity * e_rate
            water_cost = water * w_rate

            # Mejora ambiental mayor tras software.
            post_factor = 1.12 if year >= config.software_start_year else 0.88
            co2_avoided = max(0.05, electricity * 0.00024 * post_factor + rng.normal(0, 0.02))

            lighting, hvac, machinery, offices, others = _distribution(rng)

            rows.append(
                {
                    "company_name": config.company_name,
                    "facility_name": facility_name,
                    "region": region,
                    "year": year,
                    "month": month,
                    "electricity_kwh": round(electricity, 2),
                    "water_m3": round(water, 2),
                    "electricity_cost_usd": round(electricity_cost, 2),
                    "water_cost_usd": round(water_cost, 2),
                    "co2_avoided_ton": round(co2_avoided, 4),
                    "lighting_pct": lighting,
                    "hvac_pct": hvac,
                    "machinery_pct": machinery,
                    "offices_pct": offices,
                    "others_pct": others,
                    "gas_natural_m3": round(max(0.0, electricity * 0.065 + rng.normal(0, 2.5)), 2),
                    "gas_natural_cost_usd": round(max(0.0, electricity * 0.031 + rng.normal(0, 1.4)), 2),
                    "diesel_l": round(max(0.0, electricity * 0.0068 + rng.normal(0, 0.7)), 2),
                    "diesel_cost_usd": round(max(0.0, electricity * 0.0094 + rng.normal(0, 0.9)), 2),
                    "gasolina_l": round(max(0.0, electricity * 0.0036 + rng.normal(0, 0.4)), 2),
                    "gasolina_cost_usd": round(max(0.0, electricity * 0.0051 + rng.normal(0, 0.5)), 2),
                    "glp_propano_kg": round(max(0.0, water * 0.082 + rng.normal(0, 1.8)), 2),
                    "glp_propano_cost_usd": round(max(0.0, water * 0.095 + rng.normal(0, 1.9)), 2),
                    "vapor_termica_gj": round(max(0.0, electricity * 0.0025 + rng.normal(0, 0.18)), 2),
                    "vapor_termica_cost_usd": round(max(0.0, electricity * 0.031 + rng.normal(0, 0.6)), 2),
                    "energia_renovable_kwh": round(max(0.0, electricity * 0.19 + rng.normal(0, 7.0)), 2),
                    "energia_renovable_cost_usd": round(max(0.0, electricity * 0.0076 + rng.normal(0, 0.8)), 2),
                    "residuos_kg": round(max(0.0, (electricity + water) * 0.012 + rng.normal(0, 1.1)), 2),
                    "residuos_cost_usd": round(max(0.0, (electricity + water) * 0.0024 + rng.normal(0, 0.4)), 2),
                    "emisiones_co2e_t": round(max(0.0, electricity * 0.00033 + water * 0.00021 + rng.normal(0, 0.03)), 4),
                    "emisiones_co2e_cost_usd": round(max(0.0, electricity * 0.004 + water * 0.002 + rng.normal(0, 0.7)), 2),
                    "quimicos_consumibles_l": round(max(0.0, water * 0.041 + rng.normal(0, 0.9)), 2),
                    "quimicos_consumibles_cost_usd": round(max(0.0, water * 0.086 + rng.normal(0, 1.2)), 2),
                    "software_start_year": config.software_start_year,
                    "dataset_focus": config.focus,
                }
            )

    return pd.DataFrame(rows)


def main() -> None:
    output_dir = Path("backend/data/raw/enterprise_big_datasets")
    output_dir.mkdir(parents=True, exist_ok=True)

    electricity_df = _build_dataset(
        DatasetConfig(
            name="electricity",
            company_name="Industrias Atlas Ficticia S.A.",
            focus="electricity",
            software_start_year=2016,
        ),
        seed=2026051801,
    )
    water_df = _build_dataset(
        DatasetConfig(
            name="water",
            company_name="Industrias Atlas Ficticia S.A.",
            focus="water",
            software_start_year=2017,
        ),
        seed=2026051802,
    )

    electricity_path = output_dir / "electricidad_empresa_ficticia_2000_2026.csv"
    water_path = output_dir / "agua_empresa_ficticia_2000_2026.csv"
    legacy_electricity_path = output_dir / "electricidad_empresa_ficticia_1998_2026.csv"
    legacy_water_path = output_dir / "agua_empresa_ficticia_1998_2026.csv"
    electricity_recent_path = output_dir / "electricidad_empresa_ficticia_2020_2026.csv"
    water_recent_path = output_dir / "agua_empresa_ficticia_2020_2026.csv"

    electricity_df.to_csv(electricity_path, index=False)
    water_df.to_csv(water_path, index=False)
    # Compatibilidad: mantener nombres históricos, pero con rango válido para la BD actual.
    electricity_df.to_csv(legacy_electricity_path, index=False)
    water_df.to_csv(legacy_water_path, index=False)
    electricity_df[electricity_df["year"] >= 2020].to_csv(electricity_recent_path, index=False)
    water_df[water_df["year"] >= 2020].to_csv(water_recent_path, index=False)

    readme_path = output_dir / "README.txt"
    readme_path.write_text(
        "Datasets gigantes para pruebas ETL/ML (empresa ficticia).\n\n"
        "Archivos:\n"
        "1) electricidad_empresa_ficticia_2000_2026.csv\n"
        "2) agua_empresa_ficticia_2000_2026.csv\n"
        "3) electricidad_empresa_ficticia_1998_2026.csv (alias compatible)\n"
        "4) agua_empresa_ficticia_1998_2026.csv (alias compatible)\n\n"
        "5) electricidad_empresa_ficticia_2020_2026.csv\n"
        "6) agua_empresa_ficticia_2020_2026.csv\n\n"
        "Ambos son compatibles con /api/etl/upload y contienen:\n"
        "- 60 plantas\n"
        "- Registros mensuales desde 2000 hasta 2026\n"
        "- Columnas base + distribución por área + recursos adicionales\n"
        "- Patrón antes/después de software de gestión energética\n\n"
        "Los archivos *_2020_2026.csv son recortes para pruebas rápidas de alertas recientes.\n\n"
        "Orden sugerido de carga:\n"
        "1. electricidad_empresa_ficticia_2000_2026.csv\n"
        "2. agua_empresa_ficticia_2000_2026.csv\n",
        encoding="utf-8",
    )

    print(f"Generado: {electricity_path} ({len(electricity_df)} filas)")
    print(f"Generado: {water_path} ({len(water_df)} filas)")


if __name__ == "__main__":
    main()
