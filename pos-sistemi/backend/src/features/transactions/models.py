"""
Transaction Models
Kasa Hareketleri
"""

from sqlalchemy import Column, String, Float, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from src.shared.models.base import BaseModel


class TransactionType(str, enum.Enum):
    """İşlem tipi"""
    INCOME = "INCOME"  # Gelir
    EXPENSE = "EXPENSE"  # Gider


class PaymentMethod(str, enum.Enum):
    """Ödeme yöntemi"""
    CASH = "CASH"  # Nakit
    CARD = "CARD"  # Kredi Kartı
    TRANSFER = "TRANSFER"  # Havale / EFT
    DEBT = "DEBT"  # Veresiye / Borçlandırma


class TransactionSource(str, enum.Enum):
    """İşlem kaynağı (Single Source of Truth)"""
    POS = "POS"  # Mağaza / POS satışı
    ONLINE = "ONLINE"  # Online siparişler (genel)
    INVOICE = "INVOICE"  # Fatura üzerinden gelen hareketler
    ECOMMERCE = "ECOMMERCE"  # Pazaryeri / e-ticaret siparişleri
    MANUAL = "MANUAL"  # Finans ekranından/manuel eklenen hareketler


class MarketplacePlatform(str, enum.Enum):
    """Transaction tarafında da kullanılan pazaryeri platform enum'u"""
    LOCAL = "LOCAL"
    TRENDYOL = "TRENDYOL"
    HEPSIBURADA = "HEPSIBURADA"
    SHOPIFY = "SHOPIFY"
    N11 = "N11"
    GITTIGIDIYOR = "GITTIGIDIYOR"


class Transaction(BaseModel):
    """
    Transaction Model
    Kasa Hareketleri (Gelir/Gider)
    """
    
    __tablename__ = "transactions"
    
    type = Column(SQLEnum(TransactionType), nullable=False, comment="İşlem tipi: INCOME, EXPENSE")
    category = Column(String(100), nullable=True, comment="Kategori (örn: Satış Geliri, Kira Gideri)")
    amount = Column(Float, nullable=False, comment="Tutar")
    description = Column(Text, nullable=True, comment="Açıklama")
    payment_source = Column(String(20), nullable=True, default='CASH', comment="Ödeme kaynağı: CASH, BANK")
    payment_method = Column(SQLEnum(PaymentMethod), nullable=True, comment="Ödeme yöntemi: CASH, CARD, TRANSFER")
    source = Column(SQLEnum(TransactionSource), nullable=True, comment="İşlem kaynağı: POS, INVOICE, ECOMMERCE, MANUAL")
    platform = Column(SQLEnum(MarketplacePlatform), nullable=True, comment="Pazaryeri / kanal bilgisi")
    reference_id = Column(String(36), nullable=True, comment="İlgili kayıt ID'si (sipariş, fatura, entegrasyon vb.)")
    
    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
        comment="Kullanıcı ID (FK) - İşlemi yapan"
    )
    
    related_order_id = Column(
        String(36),
        ForeignKey("orders.id"),
        nullable=True,
        comment="İlgili sipariş ID (eğer satıştan kaynaklanıyorsa)"
    )
    
    user = relationship("User", back_populates="transactions")
    order = relationship("Order", back_populates="transactions")
    
    def __repr__(self) -> str:
        return f"<Transaction(id={self.id}, type={self.type}, amount={self.amount})>"


