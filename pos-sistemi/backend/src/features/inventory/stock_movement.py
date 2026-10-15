"""
Stock Movement Model
Stok hareketleri logu
"""

from sqlalchemy import Column, String, Integer, Float, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from src.shared.models.base import BaseModel


class StockMovementReason(str, enum.Enum):
    """Stok hareketi sebepleri"""
    SALE = "SALE"  # Satış
    RETURN = "RETURN"  # İade
    RESTOCK = "RESTOCK"  # Stok ekleme
    WASTE = "WASTE"  # Fire/İsraf
    ADJUSTMENT = "ADJUSTMENT"  # Düzeltme
    CORRECTION = "CORRECTION"  # Düzeltme (ADJUSTMENT ile aynı ama farklı isim)


class StockMovement(BaseModel):
    """
    Stock Movement Model
    Stok hareketleri logu
    """
    
    __tablename__ = "stock_movements"
    
    product_id = Column(
        String(36),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        comment="Ürün ID (FK)"
    )
    
    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=True,
        comment="Kullanıcı ID (FK)"
    )
    
    quantity_change = Column(Integer, nullable=False, comment="Miktar değişimi (+/-) - Örn: +50 veya -1")
    reason = Column(SQLEnum(StockMovementReason), nullable=False, comment="Hareket sebebi")
    notes = Column(String(500), nullable=True, comment="Notlar")
    
    # Relationships
    product = relationship("Product", back_populates="stock_movements")
    user = relationship("User", back_populates="stock_movements")
    
    def __repr__(self) -> str:
        return f"<StockMovement(id={self.id}, product_id={self.product_id}, quantity_change={self.quantity_change}, reason={self.reason})>"


