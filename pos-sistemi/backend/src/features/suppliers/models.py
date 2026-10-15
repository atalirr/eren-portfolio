"""
Supplier Models
Tedarikciler Modulu - Supplier Model
"""

from sqlalchemy import Column, String, Float, Text, Integer, Boolean, ForeignKey, DateTime
from src.shared.models.base import BaseModel


class Supplier(BaseModel):
    """
    Supplier Model
    Tedarikciler
    """
    
    __tablename__ = "suppliers"
    
    name = Column(String(200), nullable=False, comment="Tedarikci adi")
    short_code = Column(String(30), nullable=True, comment="Kısa kod (TED-1049 gibi)")
    category = Column(String(50), nullable=True, comment="Kategori: Tıbbi Sarf, İlaç & Serum, Cihaz & Ekipman, Genel Gider")
    contact_name = Column(String(200), nullable=True, comment="Yetkili kisi adi")
    phone = Column(String(20), nullable=True, comment="Telefon")
    email = Column(String(100), nullable=True, comment="E-posta")
    tax_office = Column(String(100), nullable=True, comment="Vergi dairesi")
    tax_number = Column(String(20), nullable=True, comment="Vergi No / TCKN")
    address = Column(String(500), nullable=True, comment="Adres")
    iban = Column(String(50), nullable=True, comment="IBAN")
    bank_name = Column(String(100), nullable=True, comment="Banka adı")
    default_due_days = Column(Integer, nullable=True, default=30, comment="Standart vade günü")
    e_invoice_registered = Column(Boolean, nullable=False, default=False, comment="e-Fatura mükellefiyeti")
    balance = Column(Float, nullable=False, default=0.0, comment="Bakiye (Pozitif = biz borcuz)")
    notes = Column(Text, nullable=True, comment="Notlar")


class SupplierTransaction(BaseModel):
    """
    Supplier Transaction Model
    Tedarikci Islemleri
    """
    
    __tablename__ = "supplier_transactions"
    
    supplier_id = Column(String(36), ForeignKey("suppliers.id"), nullable=False)
    type = Column(String(30), nullable=False)  # INVOICE, PAYMENT_CASH, PAYMENT_BANK, PAYMENT_CHECK, OPENING_BALANCE, ADJUSTMENT
    document_no = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    debit = Column(Float, nullable=False, default=0.0)  # Borç (alış)
    credit = Column(Float, nullable=False, default=0.0)  # Alacak (ödeme)
    running_balance = Column(Float, nullable=False, default=0.0)
    due_date = Column(DateTime, nullable=True)
    payment_method = Column(String(30), nullable=True)  # Nakit, Banka, Çek
    transaction_date = Column(DateTime, nullable=False)