"""
Auth Models
User Management
"""

from sqlalchemy import Column, String, Boolean
from sqlalchemy.orm import relationship

from src.shared.models.base import BaseModel


class User(BaseModel):
    """
    User Model
    Kullanıcılar (Admin, Cashier)
    """
    
    __tablename__ = "users"
    
    username = Column(String(100), nullable=False, unique=True, comment="Kullanıcı adı")
    password_hash = Column(String(255), nullable=False, comment="Şifre hash")
    full_name = Column(String(200), nullable=False, comment="Tam ad")
    role = Column(String(20), nullable=False, default="CASHIER", comment="Rol: ADMIN, CASHIER")
    is_active = Column(Boolean, nullable=False, default=True, comment="Aktif mi?")
    
    # Relationships
    orders = relationship("Order", back_populates="user")
    stock_movements = relationship("StockMovement", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    system_logs = relationship("SystemLog", back_populates="user")
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, username={self.username}, role={self.role})>"


