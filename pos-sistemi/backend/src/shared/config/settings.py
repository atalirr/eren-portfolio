"""
Pydantic Settings Configuration
"""

import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings"""
    
    # Environment
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    
    # Server
    PYTHON_HOST: str = Field(default="127.0.0.1", env="PYTHON_HOST")
    PYTHON_PORT: int = Field(default=14533, env="PYTHON_PORT")
    
    # Database
    DATABASE_PATH: Optional[str] = Field(default=None, env="DATABASE_PATH")
    
    # Security
    SECRET_KEY: str = Field(
        default="your-secret-key-here-change-in-production",
        env="SECRET_KEY"
    )
    
    # Cloud Sync (Future)
    CLOUD_SYNC_ENABLED: bool = Field(default=False, env="CLOUD_SYNC_ENABLED")
    CLOUD_API_URL: Optional[str] = Field(default=None, env="CLOUD_API_URL")
    CLOUD_API_KEY: Optional[str] = Field(default=None, env="CLOUD_API_KEY")
    
    # Logging
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")

    # Integrations
    # Google Gemini Vision API key (fatura tarama için direkt AI entegrasyonu)
    GEMINI_API_KEY: Optional[str] = Field(default=None, env="GEMINI_API_KEY")

    # n8n invoice-reader webhook (legacy - artık kullanılmıyor, Gemini direkt çağrılıyor)
    N8N_FATURA_OKUR_URL: str = Field(
        default="http://localhost:5678/webhook/fatura-okur",
        env="N8N_FATURA_OKUR_URL",
    )

    # Optional: n8n test webhook (requires "Listen for test event")
    N8N_FATURA_OKUR_TEST_URL: str = Field(
        default="http://localhost:5678/webhook-test/fatura-okur",
        env="N8N_FATURA_OKUR_TEST_URL",
    )
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get settings instance (singleton)"""
    global _settings
    if _settings is None:
        _settings = Settings()
        
        # Database path'i ayarla (%APPDATA% için)
        if _settings.DATABASE_PATH is None:
            if os.name == 'nt':  # Windows
                appdata = os.getenv('APPDATA')
                if appdata:
                    db_dir = Path(appdata) / "pos6"
                    db_dir.mkdir(parents=True, exist_ok=True)
                    _settings.DATABASE_PATH = str(db_dir / "db.sqlite")
                else:
                    _settings.DATABASE_PATH = "db.sqlite"
            else:  # Linux/Mac
                home = os.path.expanduser("~")
                db_dir = Path(home) / ".local" / "share" / "pos6"
                db_dir.mkdir(parents=True, exist_ok=True)
                _settings.DATABASE_PATH = str(db_dir / "db.sqlite")
    
    return _settings


