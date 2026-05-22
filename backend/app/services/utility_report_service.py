from __future__ import annotations

import io
from datetime import date, datetime, timezone
from typing import Any, Literal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import MonthlyConsumption, SmartAlert
from app.services.operations_service import get_operations_overview
from app.utils.date_utils import month_label

ReportPeriodType = Literal["monthly", "annual", "range"]


def _monthly_utility_rows(db: Session, utility: str) -> list[dict[str, Any]]:
    utility_key = utility.strip().lower()
    if utility_key == "electricity":
        value_col = MonthlyConsumption.electricity_kwh
        cost_col = MonthlyConsumption.electricity_cost_usd
    elif utility_key == "water":
        value_col = MonthlyConsumption.water_m3
        cost_col = MonthlyConsumption.water_cost_usd
    else:
        raise ValueError("Utilidad no soportada. Debe ser 'electricity' o 'water'.")

    rows = db.execute(
        select(
            MonthlyConsumption.year,
            MonthlyConsumption.month,
            func.sum(value_col).label("consumption"),
            func.sum(cost_col).label("cost"),
        )
        .group_by(MonthlyConsumption.year, MonthlyConsumption.month)
        .order_by(MonthlyConsumption.year, MonthlyConsumption.month)
    ).all()

    return [
        {
            "year": int(row.year),
            "month": int(row.month),
            "label": month_label(int(row.year), int(row.month)),
            "consumption": float(row.consumption or 0),
            "cost": float(row.cost or 0),
        }
        for row in rows
    ]


def _period_rows(
    rows: list[dict[str, Any]],
    *,
    period_type: ReportPeriodType,
    year: int | None,
    month: int | None,
    start_date: date | None,
    end_date: date | None,
) -> tuple[list[dict[str, Any]], str]:
    if not rows:
        raise ValueError("No existen datos cargados para generar el reporte.")

    if period_type == "monthly":
        selected_year = int(year) if year is not None else int(rows[-1]["year"])
        selected_month = int(month) if month is not None else int(rows[-1]["month"])
        selected = [
            row
            for row in rows
            if int(row["year"]) == selected_year and int(row["month"]) == selected_month
        ]
        if not selected:
            raise ValueError("No hay datos para el mes/año seleccionado.")
        return selected, month_label(selected_year, selected_month)

    if period_type == "annual":
        selected_year = int(year) if year is not None else int(rows[-1]["year"])
        selected = [
            row
            for row in rows
            if int(row["year"]) == selected_year
        ]
        if not selected:
            raise ValueError("No hay datos para el año seleccionado.")
        return selected, f"Año {selected_year}"

    if period_type != "range":
        raise ValueError("period_type inválido. Usa monthly, annual o range.")

    if start_date is None or end_date is None:
        selected = rows[-12:] if len(rows) > 12 else rows
        if not selected:
            raise ValueError("No hay datos en el rango solicitado.")
        return selected, f"Rango {selected[0]['label']} - {selected[-1]['label']}"

    if start_date > end_date:
        raise ValueError("La fecha de inicio no puede ser mayor a la fecha de fin.")

    selected = []
    for row in rows:
        row_date = date(int(row["year"]), int(row["month"]), 1)
        if start_date <= row_date <= end_date:
            selected.append(row)

    if not selected:
        raise ValueError("No hay datos para el rango de fechas seleccionado.")

    return selected, f"Rango {selected[0]['label']} - {selected[-1]['label']}"


def _utility_label_and_unit(utility: str) -> tuple[str, str]:
    utility_key = utility.strip().lower()
    if utility_key == "electricity":
        return "Electricidad", "kWh"
    return "Agua", "m³"


def _summary_table_data(
    *,
    utility_label: str,
    unit: str,
    period_label: str,
    selected_rows: list[dict[str, Any]],
    savings_total: float,
    savings_pct: float,
) -> list[list[str]]:
    total_consumption = sum(float(item["consumption"]) for item in selected_rows)
    total_cost = sum(float(item["cost"]) for item in selected_rows)
    peak_row = max(selected_rows, key=lambda item: float(item["consumption"]))

    return [
        ["Utilidad", utility_label],
        ["Período", period_label],
        [f"Consumo total ({unit})", f"{total_consumption:,.2f}"],
        ["Costo total (USD)", f"{total_cost:,.2f}"],
        [f"Pico de consumo ({unit})", f"{peak_row['label']} · {float(peak_row['consumption']):,.2f}"],
        ["Ahorro estimado con software (USD)", f"{savings_total:,.2f}"],
        ["Ahorro estimado con software (%)", f"{savings_pct:.2f}%"],
    ]


def _build_pdf_bytes(
    *,
    utility: str,
    utility_label: str,
    unit: str,
    period_label: str,
    selected_rows: list[dict[str, Any]],
    comparison_rows: list[dict[str, Any]],
    anomalies: list[SmartAlert],
    recommendations: list[str],
    savings_total: float,
    savings_pct: float,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=28 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="EcoTitle",
            parent=styles["Title"],
            textColor=colors.HexColor("#0b6e4f"),
            fontName="Helvetica-Bold",
            fontSize=19,
            leading=23,
        )
    )
    styles.add(
        ParagraphStyle(
            name="EcoHeading",
            parent=styles["Heading2"],
            textColor=colors.HexColor("#0f8f5b"),
            fontName="Helvetica-Bold",
            fontSize=12,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="EcoBody",
            parent=styles["BodyText"],
            textColor=colors.HexColor("#1f2937"),
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
        )
    )

    story = []
    generated_at = datetime.now(timezone.utc)

    story.append(Paragraph("EcoEnergy · Reporte de Consumo y Optimización", styles["EcoTitle"]))
    story.append(Spacer(1, 3 * mm))
    story.append(
        Paragraph(
            f"Informe de <b>{utility_label}</b> · {period_label} · Generado {generated_at.strftime('%Y-%m-%d %H:%M UTC')}",
            styles["EcoBody"],
        )
    )
    story.append(Spacer(1, 5 * mm))

    story.append(Paragraph("1. Resumen Ejecutivo", styles["EcoHeading"]))
    summary_data = _summary_table_data(
        utility_label=utility_label,
        unit=unit,
        period_label=period_label,
        selected_rows=selected_rows,
        savings_total=savings_total,
        savings_pct=savings_pct,
    )
    summary_table = Table(summary_data, colWidths=[70 * mm, 95 * mm])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6f4ee")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c9e5d8")),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f0fbf6")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("2. Evolución de Consumo y Costo", styles["EcoHeading"]))
    consumption_table_data = [["Período", f"Consumo ({unit})", "Costo (USD)"]]
    for row in selected_rows[:36]:
        consumption_table_data.append(
            [
                str(row["label"]),
                f"{float(row['consumption']):,.2f}",
                f"{float(row['cost']):,.2f}",
            ]
        )
    consumption_table = Table(consumption_table_data, colWidths=[55 * mm, 55 * mm, 55 * mm])
    consumption_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f8f5b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.8),
                ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]
        )
    )
    story.append(consumption_table)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("3. Comparativa Económica (Sin vs Con Software)", styles["EcoHeading"]))
    if comparison_rows:
        comparison_table_data = [["Año", "Escenario", "Sin software (USD)", "Con software (USD)", "Ahorro (USD)"]]
        cost_without_key = "electricity_cost_without_software_usd" if utility == "electricity" else "water_cost_without_software_usd"
        cost_with_key = "electricity_cost_with_software_usd" if utility == "electricity" else "water_cost_with_software_usd"
        for row in comparison_rows:
            without = float(row.get(cost_without_key, 0) or 0)
            with_software = float(row.get(cost_with_key, 0) or 0)
            comparison_table_data.append(
                [
                    str(row.get("year", "")),
                    "Predictivo" if row.get("scenario_type") == "predictive" else "Histórico",
                    f"{without:,.2f}",
                    f"{with_software:,.2f}",
                    f"{max(0.0, without - with_software):,.2f}",
                ]
            )
        comparison_table = Table(
            comparison_table_data,
            colWidths=[19 * mm, 27 * mm, 40 * mm, 40 * mm, 40 * mm],
        )
        comparison_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#14532d")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8.2),
                    ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ]
            )
        )
        story.append(comparison_table)
    else:
        story.append(Paragraph("No hay datos comparativos suficientes para este período.", styles["EcoBody"]))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("4. Anomalías y Picos Detectados", styles["EcoHeading"]))
    if anomalies:
        anomalies_data = [["Fecha", "Severidad", "Descripción"]]
        for alert in anomalies[:18]:
            when = "-"
            if alert.year and alert.month:
                when = month_label(int(alert.year), int(alert.month))
            elif alert.year:
                when = str(alert.year)
            severity = str(alert.severity).upper()
            description = str(alert.description)
            if len(description) > 118:
                description = f"{description[:115]}..."
            anomalies_data.append([when, severity, description])
        anomalies_table = Table(anomalies_data, colWidths=[35 * mm, 25 * mm, 106 * mm])
        anomalies_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7f1d1d")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e5e7eb")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8.2),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff7f7")]),
                ]
            )
        )
        story.append(anomalies_table)
    else:
        story.append(Paragraph("No se detectaron anomalías para el período seleccionado.", styles["EcoBody"]))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("5. Recomendaciones y Plan de Acción", styles["EcoHeading"]))
    for recommendation in recommendations:
        story.append(Paragraph(f"• {recommendation}", styles["EcoBody"]))
        story.append(Spacer(1, 1.4 * mm))

    def _draw_header_footer(canvas_obj, _doc) -> None:
        width, height = A4
        canvas_obj.saveState()
        canvas_obj.setFillColor(colors.HexColor("#0f8f5b"))
        canvas_obj.rect(0, height - (19 * mm), width, 19 * mm, fill=1, stroke=0)
        canvas_obj.setFillColor(colors.white)
        canvas_obj.setFont("Helvetica-Bold", 11)
        canvas_obj.drawString(14 * mm, height - (12.5 * mm), f"EcoEnergy · Informe {utility_label}")
        canvas_obj.setFont("Helvetica", 8)
        canvas_obj.drawRightString(width - (14 * mm), height - (12.5 * mm), period_label)
        canvas_obj.setFillColor(colors.HexColor("#6b7280"))
        canvas_obj.drawRightString(width - (14 * mm), 8 * mm, f"Página {canvas_obj.getPageNumber()}")
        canvas_obj.restoreState()

    doc.build(story, onFirstPage=_draw_header_footer, onLaterPages=_draw_header_footer)
    buffer.seek(0)
    return buffer.read()


def generate_utility_pdf_report(
    db: Session,
    *,
    utility: Literal["electricity", "water"],
    period_type: ReportPeriodType,
    year: int | None = None,
    month: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict[str, Any]:
    utility_key = utility.strip().lower()
    rows = _monthly_utility_rows(db, utility_key)
    selected_rows, period_label = _period_rows(
        rows,
        period_type=period_type,
        year=year,
        month=month,
        start_date=start_date,
        end_date=end_date,
    )
    utility_label, unit = _utility_label_and_unit(utility_key)

    selected_years = sorted({int(item["year"]) for item in selected_rows})
    selected_keys = {(int(item["year"]), int(item["month"])) for item in selected_rows}

    overview = get_operations_overview(db, months=12)
    comparison_rows_raw = overview.get("comparisons", {}).get("rows", [])
    comparison_rows = [
        row
        for row in comparison_rows_raw
        if int(row.get("year", 0)) in selected_years
    ]

    cost_without_key = "electricity_cost_without_software_usd" if utility_key == "electricity" else "water_cost_without_software_usd"
    cost_with_key = "electricity_cost_with_software_usd" if utility_key == "electricity" else "water_cost_with_software_usd"
    savings_total = max(
        0.0,
        sum(float(row.get(cost_without_key, 0) or 0) for row in comparison_rows)
        - sum(float(row.get(cost_with_key, 0) or 0) for row in comparison_rows),
    )
    total_without = sum(float(row.get(cost_without_key, 0) or 0) for row in comparison_rows)
    savings_pct = (savings_total / max(total_without, 1.0)) * 100.0

    alert_rows = db.scalars(
        select(SmartAlert)
        .where(
            SmartAlert.utility == utility_key,
            SmartAlert.is_resolved.is_(False),
        )
        .order_by(SmartAlert.created_at.desc())
    ).all()
    anomalies = [
        alert
        for alert in alert_rows
        if (
            (alert.year is not None and alert.month is not None and (int(alert.year), int(alert.month)) in selected_keys)
            or (alert.year is not None and alert.month is None and int(alert.year) in selected_years)
        )
    ]

    utility_noun = "eléctrica" if utility_key == "electricity" else "hídrica"
    recommendations = [
        f"Implementar monitoreo de picos en tiempo real con umbral dinámico por mes para la demanda {utility_noun}.",
        "Planificar mantenimiento preventivo en equipos de mayor carga para reducir consumos fuera de patrón.",
        "Aplicar acciones de eficiencia por área (climatización, iluminación y procesos) con seguimiento mensual.",
        "Reentrenar el modelo de predicción después de cada carga ETL para mantener precisión en escenarios futuros.",
    ]
    if anomalies:
        recommendations.insert(
            0,
            f"Priorizar investigación de {len(anomalies)} anomalías activas detectadas en el período y cerrar su causa raíz.",
        )

    pdf_bytes = _build_pdf_bytes(
        utility=utility_key,
        utility_label=utility_label,
        unit=unit,
        period_label=period_label,
        selected_rows=selected_rows,
        comparison_rows=comparison_rows,
        anomalies=anomalies,
        recommendations=recommendations,
        savings_total=savings_total,
        savings_pct=savings_pct,
    )

    period_slug = period_type
    if period_type == "monthly":
        period_slug = f"{selected_rows[0]['year']}-{selected_rows[0]['month']:02d}"
    elif period_type == "annual":
        period_slug = str(selected_rows[0]["year"])
    elif selected_rows:
        period_slug = f"{selected_rows[0]['year']}-{selected_rows[0]['month']:02d}_to_{selected_rows[-1]['year']}-{selected_rows[-1]['month']:02d}"

    filename = f"reporte_{utility_key}_{period_slug}.pdf"
    metadata = {
        "utility": utility_key,
        "period_type": period_type,
        "period_label": period_label,
        "rows": len(selected_rows),
        "anomalies": len(anomalies),
        "estimated_savings_usd": round(savings_total, 2),
    }
    return {
        "content": pdf_bytes,
        "filename": filename,
        "metadata": metadata,
    }
