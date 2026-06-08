"""Configuración de límite de velocidad usando slowapi."""

from functools import lru_cache
from ipaddress import ip_address, ip_network

from slowapi import Limiter
from starlette.requests import Request

from app.core.config import get_settings


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache(maxsize=1)
def _trusted_proxy_networks():
    networks = []
    for value in _split_csv(get_settings().rate_limit_trusted_proxies):
        try:
            networks.append(ip_network(value, strict=False))
        except ValueError:
            continue
    return tuple(networks)


def _is_trusted_proxy(remote_address: str | None) -> bool:
    if not remote_address:
        return False

    try:
        remote_ip = ip_address(remote_address)
    except ValueError:
        return False

    return any(remote_ip in network for network in _trusted_proxy_networks())


def _clean_ip(value: str | None) -> str | None:
    if not value:
        return None

    candidate = value.strip()
    if not candidate:
        return None

    try:
        return str(ip_address(candidate))
    except ValueError:
        return None


def _first_forwarded_for_ip(value: str | None) -> str | None:
    if not value:
        return None

    for item in value.split(","):
        candidate = _clean_ip(item)
        if candidate:
            return candidate
    return None


def get_client_ip(request: Request) -> str:
    remote_address = request.client.host if request.client else None

    if _is_trusted_proxy(remote_address):
        cf_ip = _clean_ip(request.headers.get("cf-connecting-ip"))
        if cf_ip:
            return cf_ip

        forwarded_ip = _first_forwarded_for_ip(request.headers.get("x-forwarded-for"))
        if forwarded_ip:
            return forwarded_ip

        real_ip = _clean_ip(request.headers.get("x-real-ip"))
        if real_ip:
            return real_ip

    return remote_address or "unknown"


# Inicializar limitador de velocidad con función de clave basada en IP real.
limiter = Limiter(key_func=get_client_ip)
