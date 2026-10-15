"""
System Models
System Logs
"""

from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from src.shared.models.base import BaseModel


class SystemLog(BaseModel):
    """
    System Log Model
    Sistem logları (Dashboard'da canlı akış için)
    """
    
    __tablename__ = "system_logs"
    
    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=True,
        comment="Kullanıcı ID (FK)"
    )
    
    action_type = Column(String(50), nullable=False, comment="İşlem tipi (SALE, EXPENSE, STOCK_UPDATE, vb.)")
    details = Column(Text, nullable=True, comment="Detaylar (Dashboard'da gösterilecek)")
    
    # Relationships
    user = relationship("User", back_populates="system_logs")
    
    def __repr__(self) -> str:
        return f"<SystemLog(id={self.id}, action_type={self.action_type}, details={self.details})>"


