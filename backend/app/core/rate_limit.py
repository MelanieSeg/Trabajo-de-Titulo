"""Configuración de límite de velocidad usando slowapi."""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Inicializar limitador de velocidad con función de clave basada en IP
limiter = Limiter(key_func=get_remote_address)
