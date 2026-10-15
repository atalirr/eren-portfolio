"""
Settings Models
Application Settings
"""

from sqlalchemy import Column, String, Text

from src.shared.models.base import BaseModel


class Setting(BaseModel):
    """
    Setting Model
    Uygulama ayarları (Vergi oranı, Dükkan adı, vb.)
    """
    
    __tablename__ = "settings"
    
    key = Column(String(100), nullable=False, unique=True, comment="Ayar anahtarı")
    value = Column(Text, nullable=True, comment="Ayar değeri")
    description = Column(Text, nullable=True, comment="Ayar açıklaması")
    
    def __repr__(self) -> str:
        return f"<Setting(id={self.id}, key={self.key}, value={self.value})>"


