"""
Settings Services
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from src.features.settings.models import Setting


class SettingService:
    """Setting Service - Uygulama ayarlarını yönetir"""

    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> List[Setting]:
        """Tüm ayarları getir"""
        return self.db.query(Setting).all()

    def get_by_key(self, key: str) -> Optional[Setting]:
        """Anahtara göre ayar getir"""
        return self.db.query(Setting).filter(Setting.key == key).first()

    def get_value(self, key: str, default: str = None) -> str:
        """Ayar değerini getir (yoksa varsayılanı döndür)"""
        setting = self.get_by_key(key)
        return setting.value if setting else default

    def update_setting(self, key: str, value: str, description: str = None) -> Setting:
        """Ayar güncelle veya oluştur"""
        setting = self.get_by_key(key)
        
        if setting:
            setting.value = value
            if description:
                setting.description = description
        else:
            setting = Setting(key=key, value=value, description=description)
            self.db.add(setting)
        
        self.db.commit()
        self.db.refresh(setting)
        return setting
