"""
Invoice Models
Fatura Modulu - Invoice ve InvoiceItem Modelleri
"""

from sqlalchemy import Column, String, Float, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from src.shared.models.base import BaseModel


class InvoiceType(str, enum.Enum):
    """Fatura tipi"""
    SALES = "SALES"          # Satis Faturasi
    PURCHASE = "PURCHASE"    # Alis Faturasi


class InvoiceStatus(str, enum.Enum):
    """Fatura durumu"""
    DRAFT = "DRAFT"          # Taslak
    SENT = "SENT"            # Gonderildi
    PAID = "PAID"            # Odendi
    CANCELLED = "CANCELLED"  # Iptal


class Invoice(BaseModel):
    """
    Invoice Model
    Faturalar
    """
    
    __tablename__ = "invoices"
    
    invoice_number = Column(String(50), nullable=False, unique=True, comment="Fatura numarasi (FTR-YYYYMMDD-XXX)")
    invoice_type = Column(SQLEnum(InvoiceType), nullable=False, default=InvoiceType.SALES, comment="Fatura tipi")
    
    customer_id = Column(
        String(36),
        ForeignKey("customers.id"),
        nullable=True,
        comment="Musteri ID - Satis faturasi icin"
    )
    
    supplier_id = Column(
        String(36),
        ForeignKey("suppliers.id"),
        nullable=True,
        comment="Tedarikci ID - Alis faturasi icin"
    )
    
    invoice_date = Column(String(20), nullable=False, comment="Fatura tarihi (YYYY-MM-DD)")
    due_date = Column(String(20), nullable=True, comment="Vade tarihi")
    
    subtotal = Column(Float, nullable=False, default=0.0, comment="KDV haric ara toplam")
    total_vat = Column(Float, nullable=False, default=0.0, comment="Toplam KDV")
    total_discount = Column(Float, nullable=False, default=0.0, comment="Toplam iskonto")
    total_amount = Column(Float, nullable=False, default=0.0, comment="Genel toplam (KDV dahil)")
    
    status = Column(SQLEnum(InvoiceStatus), nullable=False, default=InvoiceStatus.DRAFT, comment="Fatura durumu")
    notes = Column(Text, nullable=True, comment="Notlar")
    payment_method = Column(String(20), nullable=True, comment="Odeme yontemi")
    
    # Relationships
    customer = relationship("Customer", backref="invoices", lazy="joined")
    supplier = relationship("Supplier", backref="invoices", lazy="joined")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan", lazy="joined")


class InvoiceItem(BaseModel):
    """
    Invoice Item Model
    Fatura Kalemleri
    """
    
    __tablename__ = "invoice_items"
    
    invoice_id = Column(
        String(36),
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
        comment="Fatura ID (FK)"
    )
    
    product_id = Column(
        String(36),
        ForeignKey("products.id"),
        nullable=True,
        comment="Urun ID (FK) - Opsiyonel"
    )
    
    description = Column(String(300), nullable=False, comment="Urun/hizmet aciklamasi")
    quantity = Column(Float, nullable=False, default=1, comment="Miktar")
    unit = Column(String(20), nullable=False, default="adet", comment="Birim")
    unit_price = Column(Float, nullable=False, default=0.0, comment="Birim fiyat (KDV haric)")
    vat_rate = Column(Float, nullable=False, default=20.0, comment="KDV orani (%1, %10, %20)")
    vat_amount = Column(Float, nullable=False, default=0.0, comment="KDV tutari")
    discount_rate = Column(Float, nullable=False, default=0.0, comment="Iskonto orani (%)")
    discount_amount = Column(Float, nullable=False, default=0.0, comment="Iskonto tutari")
    line_total = Column(Float, nullable=False, default=0.0, comment="Satir toplami (KDV dahil)")
    
    # Relationships
    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product", lazy="joined")