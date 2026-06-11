# Configuración de Límite de Velocidad (Rate Limiting)

## Descripción General

El proyecto EcoEnergy utiliza **slowapi** para implementar límite de velocidad en endpoints sensibles, particularmente en aquellos relacionados con autenticación y recuperación de contraseña.

## Ubicaciones de Configuración

### 1. **Inicialización del Limitador** (`backend/app/core/rate_limit.py`)

```python
from slowapi import Limiter
from app.core.rate_limit import get_client_ip

limiter = Limiter(key_func=get_client_ip)
```

- **Función de clave**: `get_client_ip` - utiliza la IP real del cliente cuando la solicitud llega desde un proxy confiable
- Headers soportados detrás de proxy: `CF-Connecting-IP`, `X-Forwarded-For` y `X-Real-IP`
- Este módulo define el objeto `limiter` central que se utiliza en toda la aplicación

### 2. **Registro en la Aplicación** (`backend/app/main.py`)

```python
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.rate_limit import limiter

# Configurar limitador de velocidad
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

- El limitador se adjunta al estado de la aplicación FastAPI
- Se registra un manejador de excepciones personalizado para responder cuando se exceden los límites

### 3. **Aplicación a Endpoints** (`backend/app/api/routes/auth.py`)

#### `/register` - 3 intentos por hora
```python
@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    """Register endpoint with rate limiting (3 attempts per hour per IP)."""
```

#### `/forgot-password` - 3 intentos por hora
```python
@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit("3/hour")
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request password reset with rate limiting (3 attempts per hour per IP)."""
```

#### `/login` - configurable por entorno
```python
@router.post("/login", response_model=LoginResponse)
@limiter.limit(settings.login_rate_limit)
def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    """Login endpoint with configurable rate limiting per client IP."""
```

#### `/reset-password` - 5 intentos por hora
```python
@router.post("/reset-password", response_model=ResetPasswordResponse)
@limiter.limit("5/hour")
def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password with reset token. ⏱️ Rate Limit: 5 attempts per hour per IP address"""
```

## Formato de Límites

El formato general para especificar límites es:

```
"cantidad/período"
```

- `cantidad`: número de solicitudes permitidas
- `período`: período de tiempo (ejemplos: `second`, `minute`, `hour`, `day`)

Ejemplos válidos:
- `"5/hour"` - 5 solicitudes por hora
- `"3/day"` - 3 solicitudes por día
- `"5/15minutes"` - 5 solicitudes por 15 minutos
- `"10/second"` - 10 solicitudes por segundo

## Cómo Funcionan los Límites

1. **Identificación por IP**: Los límites se rastrean por dirección IP real del cliente
2. **Contador de solicitudes**: Cada solicitud al endpoint decorado con `@limiter.limit()` incrementa el contador
3. **Ventana de tiempo deslizante**: Los contadores se reinician después del período especificado
4. **Respuesta 429**: Cuando se excede el límite, se devuelve un error HTTP 429 (Too Many Requests)

En Docker o detrás de nginx/Cloudflare, el backend confía por defecto en proxies locales y redes privadas:

```env
RATE_LIMIT_TRUSTED_PROXIES=127.0.0.1/32,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

## Modificar Límites

Para cambiar los límites de velocidad, ajusta las variables de entorno:

```env
LOGIN_RATE_LIMIT=20/15minutes
REGISTER_RATE_LIMIT=3/hour
FORGOT_PASSWORD_RATE_LIMIT=3/hour
RESET_PASSWORD_RATE_LIMIT=5/hour
```

Reinicia la aplicación para que los cambios tengan efecto.

## Extender Rate Limiting a Otros Endpoints

Para añadir límite de velocidad a un nuevo endpoint:

```python
from app.core.rate_limit import limiter

@router.post("/mi-endpoint", response_model=MiResponse)
@limiter.limit("10/hour")  # Añadir esta línea
def mi_endpoint(request: Request, payload: MiPayload, db: Session = Depends(get_db)):
    """Mi nuevo endpoint con límite de velocidad"""
    pass
```

**Importante**: Siempre incluir `request: Request` como parámetro en la función para que `limiter` pueda acceder a la dirección IP del cliente.

## Consideraciones de Seguridad

- Los límites más restrictivos (3/hora) se aplican a operaciones sensibles (registro, recuperación de contraseña)
- Los límites más permisivos se aplican a operaciones comunes como login
- Los límites se aplican por IP real cuando el proxy reenvía headers confiables

## Pruebas

En el archivo `backend/tests/test_auth.py` hay pruebas que verifican el comportamiento del rate limiting:

- Pruebas de límites normales
- Pruebas de excedencia de límites
- Pruebas de reinicio de contadores

Ejecutar pruebas:
```bash
pytest backend/tests/test_auth.py -v -k "rate_limit"
```
