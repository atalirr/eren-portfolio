"""
Base Model with UUID and Sync Columns
Tüm modeller bu BaseModel'den türetilecek
"""

from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, func
from sqlalchemy.dialects.sqlite import DATETIME

from src.shared.database.base import Base
from src.shared.utils.uuid import generate_uuid
from src.shared.utils.datetime import get_utc_now


class BaseModel(Base):
    """
    Base Model Class
    Tüm tablolarda zorunlu sütunlar:
    - id: UUIDv4 (Primary Key)
    - created_at: UTC timestamp
    - updated_at: UTC timestamp
    - is_synced: Boolean (Cloud sync için)
    - is_deleted: Boolean (Soft delete için)
    """
    
    __abstract__ = True  # Bu sınıf tablo olarak oluşturulmaz
    
    id = Column(
        String(36),
        primary_key=True,
        default=generate_uuid,
        nullable=False,
        unique=True,
        comment="UUIDv4 Primary Key"
    )
    
    created_at = Column(
        DATETIME,
        default=get_utc_now,
        nullable=False,
        server_default=func.current_timestamp(),
        comment="Oluşturulma zamanı (UTC)"
    )
    
    updated_at = Column(
        DATETIME,
        default=get_utc_now,
        onupdate=get_utc_now,
        nullable=False,
        server_default=func.current_timestamp(),
        comment="Son güncelleme zamanı (UTC)"
    )
    
    is_synced = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Bulut senkronizasyonu için flag"
    )
    
    is_deleted = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Soft delete için flag"
    )
    
    def to_dict(self) -> dict:
        """
        Model'i dictionary'ye çevirir
        @returns: Dictionary representation
        """
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }
    
    def __repr__(self) -> str:
        """String representation"""
        return f"<{self.__class__.__name__}(id={self.id})>"


