"""
Servicio de generación de reportes PDF para energías fiscalizadas (recursos).
Produce un informe por código de recurso con consumo histórico, predicciones ML
y alertas activas, usando la misma paleta visual que utility_report_service.py.
"""
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

from app.db.models import (
    MLPrediction,
    ResourceMonthlyConsumption,
    ResourceType,
    SmartAlert,
)
from app.utils.date_utils import month_label

ReportPeriodType = Literal["monthly", "annual", "range"]


# ---------------------------------------------------------------------------
# Consultas de datos
# ---------------------------------------------------------------------------

def _fetch_resource(db: Session, code: str) -> ResourceType:
    row = db.scalar(
        select(ResourceType).where(ResourceType.code == code, ResourceType.is_active.is_(True))
    )
    if not row:
        raise ValueError(f"No existe recurso fiscalizado con código '{code}'.")
    return row


def _monthly_rows(db: Session, resource_type_id: int) -> list[dict[str, Any]]:
    rows = db.execute(
        select(
            ResourceMonthlyConsumption.year,
            ResourceMonthlyConsumption.month,
            func.sum(ResourceMonthlyConsumption.consumption_value).label("consumo"),
            func.sum(ResourceMonthlyConsumption.cost_usd).label("costo"),
        )
        .where(ResourceMonthlyConsumption.resource_type_id == resource_type_id)
        .group_by(ResourceMonthlyConsumption.year, ResourceMonthlyConsumption.month)
        .order_by(ResourceMonthlyConsumption.year, ResourceMonthlyConsumption.month)
    ).all()
    return [
        {
            "year": int(row.year),
            "month": int(row.month),
            "label": month_label(int(row.year), int(row.month)),
            "consumo": float(row.consumo or 0),
            "costo": float(row.costo or 0),
        }
        for row in rows
    ]


def _prediction_rows(db: Session, code: str) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(MLPrediction)
        .where(MLPrediction.scope == f"resource:{code}", MLPrediction.utility == code)
        .order_by(MLPrediction.year, MLPrediction.month)
    ).all()
    return [
        {
            "year": int(row.year),
            "month": int(row.month),
            "label": month_label(int(row.year), int(row.month)),
            "value": float(row.predicted_value),
        }
        for row in rows
    ]


def _filter_by_period(
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
        sel_year = int(year) if year is not None else int(rows[-1]["year"])
        sel_month = int(month) if month is not None else int(rows[-1]["month"])
        selected = [r for r in rows if int(r["year"]) == sel_year and int(r["month"]) == sel_month]
        if not selected:
            raise ValueError("No hay datos para el mes/año seleccionado.")
        return selected, month_label(sel_year, sel_month)

    if period_type == "annual":
        sel_year = int(year) if year is not None else int(rows[-1]["year"])
        selected = [r for r in rows if int(r["year"]) == sel_year]
        if not selected:
            raise ValueError("No hay datos para el año seleccionado.")
        return selected, f"Año {sel_year}"

    # range
    if start_date is None or end_date is None:
        selected = rows[-12:] if len(rows) > 12 else rows
        if not selected:
            raise ValueError("No hay datos en el rango solicitado.")
        return selected, f"Rango {selected[0]['label']} – {selected[-1]['label']}"

    if start_date > end_date:
        raise ValueError("La fecha de inicio no puede ser mayor a la fecha de fin.")

    selected = [r for r in rows if start_date <= date(int(r["year"]), int(r["month"]), 1) <= end_date]
    if not selected:
        raise ValueError("No hay datos para el rango de fechas seleccionado.")
    return selected, f"Rango {selected[0]['label']} – {selected[-1]['label']}"


# ---------------------------------------------------------------------------
# Construcción del PDF
# ---------------------------------------------------------------------------

def _build_pdf(
    *,
    resource_name: str,
    resource_code: str,
    unit: str,
    regulatory_body: str,
    period_label: str,
    selected_rows: list[dict[str, Any]],
    prediction_rows: list[dict[str, Any]],
    alerts: list[SmartAlert],
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

    # ── Portada / cabecera ──────────────────────────────────────────────────
    story.append(Paragraph("EcoEnergy · Reporte de Consumo y Optimización", styles["EcoTitle"]))
    story.append(Spacer(1, 3 * mm))
    story.append(
        Paragraph(
            f"Informe de <b>{resource_name}</b> · {period_label} · "
            f"Generado {generated_at.strftime('%Y-%m-%d %H:%M UTC')}",
            styles["EcoBody"],
        )
    )
    story.append(Spacer(1, 5 * mm))

    # ── 1. Resumen ejecutivo ────────────────────────────────────────────────
    story.append(Paragraph("1. Resumen Ejecutivo", styles["EcoHeading"]))
    total_consumo = sum(float(r["consumo"]) for r in selected_rows)
    total_costo = sum(float(r["costo"]) for r in selected_rows)
    peak_row = max(selected_rows, key=lambda r: float(r["consumo"]))
    promedio = total_consumo / max(len(selected_rows), 1)

    summary_data = [
        ["Recurso", resource_name],
        ["Código", resource_code],
        ["Organismo regulador", regulatory_body],
        ["Período", period_label],
        [f"Consumo total ({unit})", f"{total_consumo:,.2f}"],
        ["Costo total (USD)", f"{total_costo:,.2f}"],
        [f"Promedio mensual ({unit})", f"{promedio:,.2f}"],
        [f"Pico de consumo ({unit})", f"{peak_row['label']} · {float(peak_row['consumo']):,.2f}"],
    ]
    summary_table = Table(summary_data, colWidths=[75 * mm, 90 * mm])
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

    # ── 2. Evolución mensual ────────────────────────────────────────────────
    story.append(Paragraph("2. Evolución de Consumo y Costo", styles["EcoHeading"]))
    table_data = [["Período", f"Consumo ({unit})", "Costo (USD)"]]
    for row in selected_rows[:36]:
        table_data.append(
            [row["label"], f"{float(row['consumo']):,.2f}", f"{float(row['costo']):,.2f}"]
        )
    cons_table = Table(table_data, colWidths=[55 * mm, 55 * mm, 55 * mm])
    cons_table.setStyle(
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
    story.append(cons_table)
    story.append(Spacer(1, 6 * mm))

    # ── 3. Predicciones ML ──────────────────────────────────────────────────
    story.append(Paragraph("3. Predicciones ML (Horizonte 3 meses)", styles["EcoHeading"]))
    if prediction_rows:
        pred_data = [["Período proyectado", f"Consumo previsto ({unit})"]]
        for pred in prediction_rows:
            pred_data.append([pred["label"], f"{float(pred['value']):,.2f}"])
        pred_table = Table(pred_data, colWidths=[80 * mm, 85 * mm])
        pred_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#14532d")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0fbf6")]),
                ]
            )
        )
        story.append(pred_table)
    else:
        story.append(
            Paragraph(
                "No hay predicciones ML disponibles. Ejecuta el reentrenamiento desde Predicciones ML.",
                styles["EcoBody"],
            )
        )
    story.append(Spacer(1, 6 * mm))

    # ── 4. Alertas activas ──────────────────────────────────────────────────
    story.append(Paragraph("4. Alertas y Anomalías Detectadas", styles["EcoHeading"]))
    if alerts:
        alerts_data = [["Fecha", "Severidad", "Descripción"]]
        for alert in alerts[:18]:
            when = "-"
            if alert.year and alert.month:
                when = month_label(int(alert.year), int(alert.month))
            elif alert.year:
                when = str(alert.year)
            desc = str(alert.description)
            if len(desc) > 118:
                desc = f"{desc[:115]}..."
            alerts_data.append([when, str(alert.severity).upper(), desc])
        alerts_table = Table(alerts_data, colWidths=[35 * mm, 25 * mm, 106 * mm])
        alerts_table.setStyle(
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
        story.append(alerts_table)
    else:
        story.append(
            Paragraph("No se detectaron alertas activas para el período seleccionado.", styles["EcoBody"])
        )
    story.append(Spacer(1, 6 * mm))

    # ── 5. Recomendaciones ──────────────────────────────────────────────────
    story.append(Paragraph("5. Recomendaciones y Plan de Acción", styles["EcoHeading"]))
    recommendations = [
        f"Monitorear el consumo de {resource_name} mensualmente con umbrales de alerta dinámica.",
        "Realizar auditoría de procesos con mayor carga para identificar puntos de mejora.",
        "Comparar consumo real vs predicho mensualmente y actuar ante desviaciones superiores al 10%.",
        "Reentrenar el modelo de predicción periódicamente para mantener su precisión con datos recientes.",
        f"Asegurar cumplimiento normativo ante {regulatory_body} con reportes periódicos documentados.",
    ]
    if alerts:
        recommendations.insert(
            0,
            f"Investigar y resolver las {len(alerts)} alerta(s) activa(s) detectadas en el período.",
        )
    for rec in recommendations:
        story.append(Paragraph(f"• {rec}", styles["EcoBody"]))
        story.append(Spacer(1, 1.4 * mm))

    # ── Header/footer ───────────────────────────────────────────────────────
    def _draw_header_footer(canvas_obj, _doc) -> None:
        width, height = A4
        canvas_obj.saveState()
        canvas_obj.setFillColor(colors.HexColor("#0f8f5b"))
        canvas_obj.rect(0, height - (19 * mm), width, 19 * mm, fill=1, stroke=0)
        canvas_obj.setFillColor(colors.white)
        canvas_obj.setFont("Helvetica-Bold", 11)
        canvas_obj.drawString(14 * mm, height - (12.5 * mm), f"EcoEnergy · Informe {resource_name}")
        canvas_obj.setFont("Helvetica", 8)
        canvas_obj.drawRightString(width - (14 * mm), height - (12.5 * mm), period_label)
        canvas_obj.setFillColor(colors.HexColor("#6b7280"))
        canvas_obj.drawRightString(width - (14 * mm), 8 * mm, f"Página {canvas_obj.getPageNumber()}")
        canvas_obj.restoreState()

    doc.build(story, onFirstPage=_draw_header_footer, onLaterPages=_draw_header_footer)
    buffer.seek(0)
    return buffer.read()


# ---------------------------------------------------------------------------
# Función pública
# ---------------------------------------------------------------------------

def generate_resource_pdf_report(
    db: Session,
    *,
    code: str,
    period_type: ReportPeriodType = "annual",
    year: int | None = None,
    month: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict[str, Any]:
    """Genera el reporte PDF para un recurso fiscalizado y devuelve bytes + metadata."""
    resource = _fetch_resource(db, code)
    all_rows = _monthly_rows(db, resource.id)
    selected_rows, period_label = _filter_by_period(
        all_rows,
        period_type=period_type,
        year=year,
        month=month,
        start_date=start_date,
        end_date=end_date,
    )
    prediction_rows = _prediction_rows(db, code)

    # Alertas activas del recurso en el período seleccionado
    selected_keys = {(int(r["year"]), int(r["month"])) for r in selected_rows}
    alert_rows = db.scalars(
        select(SmartAlert)
        .where(SmartAlert.utility == code, SmartAlert.is_resolved.is_(False))
        .order_by(SmartAlert.created_at.desc())
    ).all()
    alerts = [
        a
        for a in alert_rows
        if a.year is not None and a.month is not None and (int(a.year), int(a.month)) in selected_keys
    ]

    pdf_bytes = _build_pdf(
        resource_name=resource.name,
        resource_code=resource.code,
        unit=resource.unit,
        regulatory_body=resource.regulatory_body or "N/D",
        period_label=period_label,
        selected_rows=selected_rows,
        prediction_rows=prediction_rows,
        alerts=alerts,
    )

    # Slug para el nombre de archivo
    if period_type == "monthly":
        period_slug = f"{selected_rows[0]['year']}-{selected_rows[0]['month']:02d}"
    elif period_type == "annual":
        period_slug = str(selected_rows[0]["year"])
    else:
        period_slug = (
            f"{selected_rows[0]['year']}-{selected_rows[0]['month']:02d}"
            f"_to_{selected_rows[-1]['year']}-{selected_rows[-1]['month']:02d}"
        )

    filename = f"reporte_{code}_{period_slug}.pdf"
    metadata = {
        "resource_code": code,
        "resource_name": resource.name,
        "period_type": period_type,
        "period_label": period_label,
        "rows": len(selected_rows),
        "alerts": len(alerts),
    }
    return {"content": pdf_bytes, "filename": filename, "metadata": metadata}
