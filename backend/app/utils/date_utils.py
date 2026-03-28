from datetime import date

SPANISH_MONTHS = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
]


def month_key(year: int, month: int) -> int:
    return year * 100 + month


def month_label(year: int, month: int) -> str:
    return f"{SPANISH_MONTHS[month - 1]} {year}"


def next_month(year: int, month: int) -> tuple[int, int]:
    if month == 12:
        return year + 1, 1
    return year, month + 1


def to_date(year: int, month: int) -> date:
    return date(year=year, month=month, day=1)
