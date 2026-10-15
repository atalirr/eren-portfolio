"""
Sales Models
Satış Modülü - Order ve OrderItem Modelleri
"""

from sqlalchemy import Column, String, Float, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from src.shared.models.base import BaseModel


class PaymentMethod(str, enum.Enum):
    """Ödeme yöntemi"""
    CASH = "CASH"  # Nakit
    CARD = "CARD"  # Kart
    TRANSFER = "TRANSFER"  # Havale
    DEBT = "DEBT"  # Veresiye
    SPLIT = "SPLIT"  # Parçalı Ödeme



class SalesPlatform(str, enum.Enum):
    """Satış platformu"""
    STORE = "STORE"  # Mağaza
    TRENDYOL = "TRENDYOL"  # Trendyol
    HEPSIBURADA = "HEPSIBURADA"  # Hepsiburada


class OrderStatus(str, enum.Enum):
    """Sipariş durumu"""
    COMPLETED = "COMPLETED"  # Tamamlandı
    REFUNDED = "REFUNDED"  # İade edildi


class SaleOrder(BaseModel):
    """
    Sale Order Model
    Satış Siparişleri
    """
    
    __tablename__ = "sale_orders"
    
    order_number = Column(String(50), nullable=False, unique=True, comment="Sipariş numarası (#S-1024)")
    
    customer_id = Column(
        String(36),
        ForeignKey("customers.id"),
        nullable=True,
        comment="Müşteri ID (FK) - Misafir müşteri olabilir"
    )
    
    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=True,
        comment="Satışı yapan kasiyer ID (FK)"
    )
    
    total_amount = Column(Float, nullable=False, default=0.0, comment="Satış toplamı")
    
    total_profit = Column(
        Float, 
        nullable=False, 
        default=0.0, 
        comment="KRİTİK: Satış anındaki (Satış Fiyatı - Maliyet) * Adet toplamı"
    )
    
    payment_method = Column(
        SQLEnum(PaymentMethod), 
        nullable=False, 
        default=PaymentMethod.CASH,
        comment="Ödeme yöntemi: CASH, CARD, TRANSFER, DEBT"
    )
    
    platform = Column(
        SQLEnum(SalesPlatform), 
        nullable=False, 
        default=SalesPlatform.STORE,
        comment="Platform: STORE, TRENDYOL, HEPSIBURADA"
    )
    
    status = Column(
        SQLEnum(OrderStatus), 
        nullable=False, 
        default=OrderStatus.COMPLETED,
        comment="Sipariş durumu: COMPLETED, REFUNDED"
    )
    
    due_date = Column(String(20), nullable=True, comment="Vade / Beklenen ödeme tarihi")
    
    # İndirim bilgileri
    discount_type = Column(String(20), nullable=True, comment="İndirim türü: PERCENT, FIXED")
    discount_value = Column(Float, nullable=True, default=0.0, comment="İndirim değeri")
    discount_amount = Column(Float, nullable=True, default=0.0, comment="İndirim tutarı")
    final_amount = Column(Float, nullable=True, default=0.0, comment="İndirim sonrası genel toplam")
    
    # Relationships
    customer = relationship("Customer", back_populates="sale_orders")
    items = relationship("SaleOrderItem", back_populates="order", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<SaleOrder(id={self.id}, order_number={self.order_number}, total_amount={self.total_amount}, total_profit={self.total_profit})>"


class SaleOrderItem(BaseModel):
    """
    Sale Order Item Model
    Satış Sipariş Kalemleri
    """
    
    __tablename__ = "sale_order_items"
    
    order_id = Column(
        String(36),
        ForeignKey("sale_orders.id", ondelete="CASCADE"),
        nullable=False,
        comment="Sipariş ID (FK)"
    )
    
    product_id = Column(
        String(36),
        ForeignKey("products.id"),
        nullable=False,
        comment="Ürün ID (FK)"
    )
    
    product_name = Column(
        String(200), 
        nullable=False, 
        comment="Ürün adı (snapshot - ürün adı değişirse geçmiş bozulmasın diye)"
    )
    
    quantity = Column(Integer, nullable=False, default=1, comment="Miktar")
    
    unit_price = Column(
        Float, 
        nullable=False, 
        default=0.0, 
        comment="Birim satış fiyatı (satış anındaki fiyat)"
    )
    
    unit_cost = Column(
        Float, 
        nullable=False, 
        default=0.0, 
        comment="Birim maliyet (satış anındaki maliyet - kâr hesabı için)"
    )
    
    tax_rate = Column(
        Float, 
        nullable=True, 
        default=18.0, 
        comment="KDV oranı (satış anındaki)"
    )
    
    discount = Column(
        Float, 
        nullable=True, 
        default=0.0, 
        comment="Kaleme uygulanan indirim tutarı"
    )
    
    # Relationships
    order = relationship("SaleOrder", back_populates="items")
    product = relationship("Product")
    
    def __repr__(self) -> str:
        return f"<SaleOrderItem(id={self.id}, product_name={self.product_name}, quantity={self.quantity}, unit_price={self.unit_price})>"













