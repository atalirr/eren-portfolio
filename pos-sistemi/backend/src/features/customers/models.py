"""
Customers Models
Müşteri Yönetimi
"""

from sqlalchemy import Column, String, Float, Integer
from sqlalchemy.orm import relationship

from src.shared.models.base import BaseModel


class Customer(BaseModel):
    """
    Customer Model
    Müşteriler
    """
    
    __tablename__ = "customers"
    
    name = Column(String(200), nullable=False, comment="Müşteri adı")
    last_name = Column(String(200), nullable=True, comment="Müşteri soyadı")
    phone = Column(String(20), nullable=True, comment="Telefon numarası")
    email = Column(String(100), nullable=True, comment="E-posta adresi")
    
    # Balance: Pozitif = Müşterinin borcu, Negatif = Müşterinin alacağı (nadir)
    balance = Column(Float, nullable=False, default=0.0, comment="Müşteri bakiyesi (Borç/Alacak)")
    
    address = Column(String(500), nullable=True, comment="Adres")
    notes = Column(String(1000), nullable=True, comment="Notlar")
    due_date = Column(String(20), nullable=True, comment="Beklenen ödeme tarihi")
    
    # Düzenli Teslimat Takibi
    needed_material = Column(String(300), nullable=True, comment="Düzenli ihtiyaç duyulan ürün/malzeme adı")
    product_id = Column(String(36), nullable=True, comment="Stoktan bağlı ürün ID (varsa)")
    quantity = Column(Integer, nullable=True, default=1, comment="Her teslimatda verilecek adet")
    unit_price = Column(Float, nullable=True, comment="Birim fiyat (stoktan veya manuel)")
    period_days = Column(Integer, nullable=True, default=30, comment="Kaç günde bir tekrar edilecek")
    last_delivery_date = Column(String(10), nullable=True, comment="Son teslimat tarihi (YYYY-MM-DD)")
    next_delivery_date = Column(String(10), nullable=True, comment="Sonraki teslimat tarihi (YYYY-MM-DD)")
    
    # Relationships
    orders = relationship("Order", back_populates="customer")
    sale_orders = relationship("SaleOrder", back_populates="customer")
    
    def __repr__(self) -> str:
        return f"<Customer(id={self.id}, name={self.name}, balance={self.balance})>"










