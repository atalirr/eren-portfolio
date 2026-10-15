"""
Orders Models
Orders and Order Items
"""

from sqlalchemy import Column, String, Float, Integer, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from src.shared.models.base import BaseModel


class OrderSource(str, enum.Enum):
    """Sipariş kaynağı"""
    POS = "POS"  # Mağaza satışı
    ONLINE = "ONLINE"  # Online satış


class MarketplacePlatform(str, enum.Enum):
    """Pazaryeri platformu"""
    LOCAL = "LOCAL"  # Kendi web sitesi
    TRENDYOL = "TRENDYOL"
    HEPSIBURADA = "HEPSIBURADA"
    SHOPIFY = "SHOPIFY"
    N11 = "N11"
    GITTIGIDIYOR = "GITTIGIDIYOR"


class MarketplaceStatus(str, enum.Enum):
    """Pazaryeri sipariş durumu"""
    NEW = "NEW"  # Yeni
    PREPARING = "PREPARING"  # Hazırlanıyor
    SHIPPED = "SHIPPED"  # Kargolandı
    DELIVERED = "DELIVERED"  # Teslim Edildi
    CANCELLED = "CANCELLED"  # İptal Edildi


class Order(BaseModel):
    """
    Order Model
    Siparişler
    """
    
    __tablename__ = "orders"
    
    order_number = Column(String(50), nullable=False, unique=True, comment="Sipariş numarası (#1001)")
    
    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        comment="Kullanıcı ID (FK) - Satışı yapan"
    )
    
    customer_id = Column(
        String(36),
        ForeignKey("customers.id"),
        nullable=True,
        comment="Müşteri ID (FK) - Veresiye satışlar için"
    )
    
    total_amount = Column(Float, nullable=False, default=0.0, comment="Toplam tutar")
    discount_type = Column(String(20), nullable=True, comment="İndirim tipi: PERCENT, FIXED")
    discount_value = Column(Float, nullable=False, default=0.0, comment="İndirim değeri")
    final_amount = Column(Float, nullable=False, default=0.0, comment="İndirim sonrası tutar")
    
    payment_method = Column(String(20), nullable=False, default="CASH", comment="Ödeme yöntemi: CASH, CARD, CREDIT")
    status = Column(String(20), nullable=False, default="completed", comment="Sipariş durumu")
    
    # E-Ticaret alanları
    source = Column(SQLEnum(OrderSource), nullable=True, comment="Sipariş kaynağı: POS, ONLINE")
    platform = Column(SQLEnum(MarketplacePlatform), nullable=True, comment="Pazaryeri platformu")
    marketplace_status = Column(SQLEnum(MarketplaceStatus), nullable=True, comment="Pazaryeri sipariş durumu")
    marketplace_order_id = Column(String(200), nullable=True, comment="Pazaryeri sipariş ID'si")
    
    notes = Column(Text, nullable=True, comment="Notlar")
    
    # Relationships
    user = relationship("User", back_populates="orders")
    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="order")
    
    def __repr__(self) -> str:
        return f"<Order(id={self.id}, order_number={self.order_number}, final_amount={self.final_amount})>"


class OrderItem(BaseModel):
    """
    Order Item Model
    Sipariş kalemleri
    """
    
    __tablename__ = "order_items"
    
    order_id = Column(
        String(36),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        comment="Sipariş ID (FK)"
    )
    
    product_id = Column(
        String(36),
        ForeignKey("products.id"),
        nullable=False,
        comment="Ürün ID (FK)"
    )
    
    quantity = Column(Integer, nullable=False, default=1, comment="Miktar")
    unit_sell_price = Column(Float, nullable=False, default=0.0, comment="Birim satış fiyatı (sipariş anındaki snapshot)")
    unit_buy_price = Column(Float, nullable=False, default=0.0, comment="Birim maliyet (kâr hesabı için snapshot)")
    discount = Column(Float, nullable=False, default=0.0, comment="İndirim tutarı")
    subtotal = Column(Float, nullable=False, default=0.0, comment="Ara toplam")
    
    # Relationships
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")
    
    def __repr__(self) -> str:
        return f"<OrderItem(id={self.id}, quantity={self.quantity}, subtotal={self.subtotal})>"

