from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EcoEnergy API"
    app_env: str = "development"
    app_version: str = "1.0.0"

    database_url: str = "postgresql+psycopg2://eco_user:eco_pass@db:5432/eco_energy"
    cors_origins: str = (
        "http://localhost:8080,http://127.0.0.1:8080,"
        "http://localhost:8081,http://127.0.0.1:8081,"
        "https://localhost:8080,https://127.0.0.1:8080,"
        "https://localhost:8081,https://127.0.0.1:8081"
    )
    cors_origin_regex: str | None = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    cors_methods: str = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    cors_headers: str = "Authorization,Content-Type,Accept,Origin,X-Requested-With"
    cors_expose_headers: str = "Content-Length,Content-Type"

    etl_upload_dir: str = "/app/data/uploads"
    sample_csv_path: str = "/app/data/raw/sample_consumption.csv"
    platform_config_path: str = "../app/platform-config.json"

    default_company_name: str = "Green Glow Industries"
    default_alert_electricity_threshold_pct: float = 20.0
    default_alert_water_threshold_pct: float = 18.0
    default_alert_volatility_threshold_pct: float = 15.0

    # Configuración JWT
    secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    jwt_issuer: str = "eco-energy-api"
    jwt_audience: str = "eco-energy-app"

    # Configuración de Email
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = "your-email@gmail.com"
    smtp_password: str = "your-app-password"
    email_from: str = "noreply@ecoenergy.com"
    email_from_name: str = "EcoEnergy"
    reset_password_token_expire_hours: int = 1

    # URL del frontend para enlaces de email
    frontend_url: str = "http://localhost:8081"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
