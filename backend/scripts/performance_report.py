from __future__ import annotations

import argparse
import csv
import html
import platform
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from time import perf_counter
from typing import Any

import pandas as pd
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.base import Base
from app.db.models import Company, Facility, MonthlyConsumption
from app.services.etl_service import _clean_dataframe, run_etl_from_csv
from app.services.ml_service import train_and_predict


DEFAULT_DATASETS = {
    "quick": [
        BACKEND_DIR / "data/raw/sample_consumption.csv",
    ],
    "standard": [
        BACKEND_DIR / "data/raw/sample_consumption.csv",
        BACKEND_DIR / "data/raw/enterprise_big_datasets/electricidad_empresa_ficticia_2020_2026.csv",
        BACKEND_DIR / "data/raw/enterprise_big_datasets/agua_empresa_ficticia_2020_2026.csv",
    ],
    "full": [
        BACKEND_DIR / "data/raw/enterprise_big_datasets/electricidad_empresa_ficticia_2000_2026.csv",
        BACKEND_DIR / "data/raw/enterprise_big_datasets/agua_empresa_ficticia_2000_2026.csv",
    ],
}


@dataclass
class DatasetBenchmark:
    dataset: str
    mode: str
    csv_path: Path
    csv_rows: int
    rows_processed: int
    rows_rejected: int
    monthly_records: int
    companies: int
    facilities: int
    read_seconds: float
    clean_seconds: float
    load_seconds: float
    processing_seconds: float
    ml_seconds: float
    total_seconds: float
    rows_per_second: float
    trained_records: int
    validation_mae: dict[str, float]
    accuracy_pct: dict[str, float]
    champion_models: dict[str, str]
    model_benchmark: dict[str, list[dict[str, Any]]]


def _count_csv_rows(path: Path) -> int:
    with path.open("rb") as file:
        return max(sum(1 for _ in file) - 1, 0)


def _format_number(value: float | int, digits: int = 2) -> str:
    if isinstance(value, int):
        return f"{value:,}".replace(",", ".")
    return f"{value:,.{digits}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _make_session() -> tuple[Session, Any]:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return session_local(), engine


def _seed_monthly_consumption(db: Session, cleaned: pd.DataFrame) -> int:
    company_ids: dict[str, int] = {}
    facility_ids: dict[tuple[int, str], int] = {}
    inserted = 0

    for row in cleaned.itertuples(index=False):
        company_name = str(row.company_name).strip()
        facility_name = str(row.facility_name).strip()
        region = str(getattr(row, "region", "") or "").strip() or None

        company_id = company_ids.get(company_name)
        if company_id is None:
            company = Company(name=company_name)
            db.add(company)
            db.flush()
            company_id = int(company.id)
            company_ids[company_name] = company_id

        facility_key = (company_id, facility_name)
        facility_id = facility_ids.get(facility_key)
        if facility_id is None:
            facility = Facility(company_id=company_id, name=facility_name, region=region)
            db.add(facility)
            db.flush()
            facility_id = int(facility.id)
            facility_ids[facility_key] = facility_id

        db.add(
            MonthlyConsumption(
                facility_id=facility_id,
                year=int(row.year),
                month=int(row.month),
                electricity_kwh=float(row.electricity_kwh),
                water_m3=float(row.water_m3),
                electricity_cost_usd=float(row.electricity_cost_usd),
                water_cost_usd=float(row.water_cost_usd),
                co2_avoided_ton=float(row.co2_avoided_ton),
            )
        )
        inserted += 1

    db.flush()
    return inserted


def _count_table(db: Session, model: Any) -> int:
    return int(db.scalar(select(func.count()).select_from(model)) or 0)


def run_dataset_benchmark(csv_path: Path, mode: str, horizon_months: int) -> DatasetBenchmark:
    if not csv_path.exists():
        raise FileNotFoundError(f"No se encontro el CSV: {csv_path}")

    csv_rows = _count_csv_rows(csv_path)
    db, engine = _make_session()

    read_seconds = 0.0
    clean_seconds = 0.0
    load_seconds = 0.0
    rows_processed = 0
    rows_rejected = 0

    try:
        started = perf_counter()
        if mode == "full-etl":
            processing_start = perf_counter()
            job = run_etl_from_csv(db, str(csv_path), source_filename=csv_path.name)
            processing_seconds = perf_counter() - processing_start
            rows_processed = int(job.rows_processed)
            rows_rejected = int(job.rows_rejected)
        else:
            read_start = perf_counter()
            raw_df = pd.read_csv(csv_path)
            read_seconds = perf_counter() - read_start

            clean_start = perf_counter()
            cleaned, rows_rejected = _clean_dataframe(raw_df)
            clean_seconds = perf_counter() - clean_start

            load_start = perf_counter()
            rows_processed = _seed_monthly_consumption(db, cleaned)
            load_seconds = perf_counter() - load_start
            processing_seconds = read_seconds + clean_seconds + load_seconds

        monthly_records = _count_table(db, MonthlyConsumption)
        companies = _count_table(db, Company)
        facilities = _count_table(db, Facility)

        ml_start = perf_counter()
        train_result = train_and_predict(db, horizon_months=horizon_months)
        ml_seconds = perf_counter() - ml_start
        db.commit()

        total_seconds = perf_counter() - started
        rows_per_second = rows_processed / processing_seconds if processing_seconds > 0 else 0.0

        return DatasetBenchmark(
            dataset=csv_path.stem,
            mode=mode,
            csv_path=csv_path,
            csv_rows=csv_rows,
            rows_processed=rows_processed,
            rows_rejected=rows_rejected,
            monthly_records=monthly_records,
            companies=companies,
            facilities=facilities,
            read_seconds=read_seconds,
            clean_seconds=clean_seconds,
            load_seconds=load_seconds,
            processing_seconds=processing_seconds,
            ml_seconds=ml_seconds,
            total_seconds=total_seconds,
            rows_per_second=rows_per_second,
            trained_records=train_result.trained_records,
            validation_mae=train_result.validation_mae,
            accuracy_pct=train_result.accuracy_pct,
            champion_models=train_result.champion_models,
            model_benchmark=train_result.model_benchmark,
        )
    finally:
        db.close()
        engine.dispose()


def _table(headers: list[str], rows: list[list[str]]) -> str:
    widths = [
        max(len(headers[index]), *(len(row[index]) for row in rows))
        for index in range(len(headers))
    ]
    header_line = " | ".join(headers[index].ljust(widths[index]) for index in range(len(headers)))
    separator = "-+-".join("-" * width for width in widths)
    row_lines = [
        " | ".join(row[index].ljust(widths[index]) for index in range(len(headers)))
        for row in rows
    ]
    return "\n".join([header_line, separator, *row_lines])


def _summary_rows(results: list[DatasetBenchmark]) -> list[list[str]]:
    return [
        [
            result.dataset,
            result.mode,
            _format_number(result.csv_rows, 0),
            _format_number(result.rows_processed, 0),
            _format_number(result.rows_rejected, 0),
            _format_number(result.processing_seconds),
            _format_number(result.rows_per_second),
            _format_number(result.ml_seconds),
            _format_number(result.total_seconds),
            _format_number(result.monthly_records, 0),
        ]
        for result in results
    ]


def _champion_rows(results: list[DatasetBenchmark]) -> list[list[str]]:
    rows: list[list[str]] = []
    for result in results:
        for utility in ("electricity", "water"):
            rows.append(
                [
                    result.dataset,
                    utility,
                    result.champion_models.get(utility, "-"),
                    _format_number(result.accuracy_pct.get(utility, 0.0), 2),
                    _format_number(result.validation_mae.get(utility, 0.0), 4),
                    _format_number(result.trained_records, 0),
                ]
            )
    return rows


def _benchmark_rows(results: list[DatasetBenchmark]) -> list[list[str]]:
    rows: list[list[str]] = []
    for result in results:
        for utility, metrics in result.model_benchmark.items():
            for item in metrics:
                rows.append(
                    [
                        result.dataset,
                        utility,
                        str(item["model"]),
                        _format_number(float(item["accuracy_pct"]), 3),
                        _format_number(float(item["mape_pct"]), 3),
                        _format_number(float(item["mae"]), 4),
                        _format_number(float(item["r2"]), 4),
                    ]
                )
    return rows


def print_console_report(results: list[DatasetBenchmark]) -> None:
    print("\n=== Resumen de procesamiento CSV + ML ===")
    print(
        _table(
            [
                "Dataset",
                "Modo",
                "Filas CSV",
                "Procesadas",
                "Rechazadas",
                "Proc. s",
                "Filas/s",
                "ML s",
                "Total s",
                "Meses",
            ],
            _summary_rows(results),
        )
    )
    print("\n=== Modelos campeones ===")
    print(
        _table(
            ["Dataset", "Utilidad", "Modelo", "Precision %", "MAE", "Meses entrenados"],
            _champion_rows(results),
        )
    )
    print("\n=== Benchmark completo por modelo ===")
    print(
        _table(
            ["Dataset", "Utilidad", "Modelo", "Precision %", "MAPE %", "MAE", "R2"],
            _benchmark_rows(results),
        )
    )


def _markdown_table(headers: list[str], rows: list[list[str]]) -> str:
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    return "\n".join(lines)


def write_markdown_report(results: list[DatasetBenchmark], output_dir: Path) -> Path:
    output_path = output_dir / "performance_report.md"
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        "# Reporte de rendimiento ETL + ML",
        "",
        f"Generado: {generated_at}",
        "",
        "## Resumen ejecutivo",
        "",
        "- El benchmark procesa cada CSV en una base temporal limpia, sin tocar la base real del proyecto.",
        "- El modo `analysis` mide lectura, limpieza, consolidacion mensual y entrenamiento ML.",
        "- El modo `full-etl` ejecuta el ETL completo del backend, incluyendo distribuciones y recursos.",
        "- La precision se calcula como `100 - MAPE`, acotada por el servicio ML para interpretacion de negocio.",
        "",
        "## Resumen de procesamiento",
        "",
        _markdown_table(
            [
                "Dataset",
                "Modo",
                "Filas CSV",
                "Procesadas",
                "Rechazadas",
                "Proc. s",
                "Filas/s",
                "ML s",
                "Total s",
                "Meses",
            ],
            _summary_rows(results),
        ),
        "",
        "## Modelos campeones",
        "",
        _markdown_table(
            ["Dataset", "Utilidad", "Modelo", "Precision %", "MAE", "Meses entrenados"],
            _champion_rows(results),
        ),
        "",
        "## Benchmark completo por modelo",
        "",
        _markdown_table(
            ["Dataset", "Utilidad", "Modelo", "Precision %", "MAPE %", "MAE", "R2"],
            _benchmark_rows(results),
        ),
        "",
        "## Metodologia",
        "",
        "- Flujo evaluado: CSV -> limpieza y consolidacion -> tabla `monthly_consumptions` -> `train_and_predict`.",
        "- Modelos evaluados: RandomForestRegressor, GradientBoostingRegressor, KNeighborsRegressor, BayesianRidge y LinearRegression.",
        "- Validacion temporal: holdout para series cortas y `TimeSeriesSplit` para series con mas datos.",
        f"- Entorno: Python {platform.python_version()} en {platform.platform()}.",
    ]
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return output_path


def write_csv_reports(results: list[DatasetBenchmark], output_dir: Path) -> tuple[Path, Path]:
    summary_path = output_dir / "performance_summary.csv"
    benchmark_path = output_dir / "model_benchmark.csv"

    with summary_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(
            [
                "dataset",
                "mode",
                "csv_path",
                "csv_rows",
                "rows_processed",
                "rows_rejected",
                "monthly_records",
                "companies",
                "facilities",
                "read_seconds",
                "clean_seconds",
                "load_seconds",
                "processing_seconds",
                "ml_seconds",
                "total_seconds",
                "rows_per_second",
                "trained_records",
                "electricity_champion",
                "water_champion",
                "electricity_accuracy_pct",
                "water_accuracy_pct",
                "electricity_mae",
                "water_mae",
            ]
        )
        for result in results:
            writer.writerow(
                [
                    result.dataset,
                    result.mode,
                    str(result.csv_path),
                    result.csv_rows,
                    result.rows_processed,
                    result.rows_rejected,
                    result.monthly_records,
                    result.companies,
                    result.facilities,
                    round(result.read_seconds, 6),
                    round(result.clean_seconds, 6),
                    round(result.load_seconds, 6),
                    round(result.processing_seconds, 6),
                    round(result.ml_seconds, 6),
                    round(result.total_seconds, 6),
                    round(result.rows_per_second, 6),
                    result.trained_records,
                    result.champion_models.get("electricity", ""),
                    result.champion_models.get("water", ""),
                    result.accuracy_pct.get("electricity", 0.0),
                    result.accuracy_pct.get("water", 0.0),
                    result.validation_mae.get("electricity", 0.0),
                    result.validation_mae.get("water", 0.0),
                ]
            )

    with benchmark_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["dataset", "utility", "model", "accuracy_pct", "mape_pct", "mae", "r2"])
        for result in results:
            for utility, metrics in result.model_benchmark.items():
                for item in metrics:
                    writer.writerow(
                        [
                            result.dataset,
                            utility,
                            item["model"],
                            item["accuracy_pct"],
                            item["mape_pct"],
                            item["mae"],
                            item["r2"],
                        ]
                    )

    return summary_path, benchmark_path


def _html_table(headers: list[str], rows: list[list[str]]) -> str:
    header_html = "".join(f"<th>{html.escape(header)}</th>" for header in headers)
    body_html = "\n".join(
        "<tr>" + "".join(f"<td>{html.escape(cell)}</td>" for cell in row) + "</tr>"
        for row in rows
    )
    return f"<table><thead><tr>{header_html}</tr></thead><tbody>{body_html}</tbody></table>"


def write_html_report(results: list[DatasetBenchmark], output_dir: Path) -> Path:
    output_path = output_dir / "performance_report.html"
    total_rows = sum(result.csv_rows for result in results)
    total_processed = sum(result.rows_processed for result in results)
    avg_accuracy = []
    for result in results:
        avg_accuracy.extend(result.accuracy_pct.values())
    average_accuracy = sum(avg_accuracy) / len(avg_accuracy) if avg_accuracy else 0.0
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    document = f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reporte de rendimiento ETL + ML</title>
  <style>
    :root {{
      color-scheme: light;
      font-family: Arial, Helvetica, sans-serif;
      color: #172033;
      background: #f5f7fb;
    }}
    body {{
      margin: 0;
      padding: 32px;
    }}
    main {{
      max-width: 1320px;
      margin: 0 auto;
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: 30px;
    }}
    h2 {{
      margin: 32px 0 12px;
      font-size: 20px;
    }}
    .subtitle {{
      margin: 0 0 24px;
      color: #516070;
    }}
    .cards {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin: 20px 0 28px;
    }}
    .card {{
      background: white;
      border: 1px solid #dce3ed;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(20, 32, 52, 0.06);
    }}
    .label {{
      color: #687789;
      font-size: 13px;
      margin-bottom: 8px;
    }}
    .value {{
      font-size: 26px;
      font-weight: 700;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      background: white;
      border: 1px solid #dce3ed;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(20, 32, 52, 0.06);
    }}
    th, td {{
      padding: 10px 12px;
      border-bottom: 1px solid #e8edf4;
      text-align: left;
      white-space: nowrap;
      font-size: 13px;
    }}
    th {{
      background: #eaf1f8;
      color: #27364a;
      font-weight: 700;
    }}
    tr:last-child td {{
      border-bottom: 0;
    }}
    .note {{
      margin-top: 24px;
      color: #516070;
      line-height: 1.5;
      background: white;
      border: 1px solid #dce3ed;
      border-radius: 8px;
      padding: 16px;
    }}
  </style>
</head>
<body>
  <main>
    <h1>Reporte de rendimiento ETL + ML</h1>
    <p class="subtitle">Generado: {html.escape(generated_at)}. Base temporal aislada, sin modificar datos reales.</p>
    <section class="cards">
      <div class="card"><div class="label">Datasets evaluados</div><div class="value">{len(results)}</div></div>
      <div class="card"><div class="label">Filas CSV leidas</div><div class="value">{_format_number(total_rows, 0)}</div></div>
      <div class="card"><div class="label">Registros procesados</div><div class="value">{_format_number(total_processed, 0)}</div></div>
      <div class="card"><div class="label">Precision promedio</div><div class="value">{_format_number(average_accuracy, 2)}%</div></div>
    </section>
    <h2>Resumen de procesamiento</h2>
    {_html_table(["Dataset", "Modo", "Filas CSV", "Procesadas", "Rechazadas", "Proc. s", "Filas/s", "ML s", "Total s", "Meses"], _summary_rows(results))}
    <h2>Modelos campeones</h2>
    {_html_table(["Dataset", "Utilidad", "Modelo", "Precision %", "MAE", "Meses entrenados"], _champion_rows(results))}
    <h2>Benchmark completo por modelo</h2>
    {_html_table(["Dataset", "Utilidad", "Modelo", "Precision %", "MAPE %", "MAE", "R2"], _benchmark_rows(results))}
    <div class="note">
      Metodologia: CSV -> limpieza y consolidacion mensual -> tabla monthly_consumptions -> entrenamiento con train_and_predict.
      La precision corresponde a 100 - MAPE, acotada por el servicio ML. El modo analysis prioriza medicion rapida de datos y modelos;
      el modo full-etl ejecuta tambien distribuciones y recursos.
    </div>
  </main>
</body>
</html>
"""
    output_path.write_text(document, encoding="utf-8")
    return output_path


def resolve_datasets(args: argparse.Namespace) -> list[Path]:
    if args.dataset:
        return [Path(item).resolve() for item in args.dataset]
    return DEFAULT_DATASETS[args.preset]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Genera pruebas de rendimiento para procesamiento CSV y modelos ML.",
    )
    parser.add_argument(
        "--preset",
        choices=sorted(DEFAULT_DATASETS),
        default="quick",
        help="Conjunto de datasets predefinido. quick es rapido; standard incluye CSV grandes 2020-2026; full usa historicos completos.",
    )
    parser.add_argument(
        "--dataset",
        action="append",
        help="Ruta a un CSV especifico. Se puede repetir. Si se usa, reemplaza --preset.",
    )
    parser.add_argument(
        "--mode",
        choices=["analysis", "full-etl"],
        default="analysis",
        help="analysis mide CSV + consolidacion + ML; full-etl ejecuta el ETL completo del backend.",
    )
    parser.add_argument(
        "--horizon-months",
        type=int,
        default=3,
        choices=range(1, 13),
        metavar="[1-12]",
        help="Horizonte de prediccion usado por el servicio ML.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(BACKEND_DIR / "reports/performance"),
        help="Directorio donde se guardan Markdown, HTML y CSV.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    results = [
        run_dataset_benchmark(path, mode=args.mode, horizon_months=args.horizon_months)
        for path in resolve_datasets(args)
    ]

    print_console_report(results)
    markdown_path = write_markdown_report(results, output_dir)
    html_path = write_html_report(results, output_dir)
    summary_csv_path, benchmark_csv_path = write_csv_reports(results, output_dir)

    print("\nReportes generados:")
    print(f"- Markdown: {markdown_path}")
    print(f"- HTML: {html_path}")
    print(f"- CSV resumen: {summary_csv_path}")
    print(f"- CSV modelos: {benchmark_csv_path}")


if __name__ == "__main__":
    main()
