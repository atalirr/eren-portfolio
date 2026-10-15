"""
Customers Schemas
Müşteri Yönetimi - Pydantic Schemas
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class CustomerBase(BaseModel):
    """Customer base schema"""
    name: str = Field(..., min_length=1, max_length=200, description="Müşteri adı")
    last_name: Optional[str] = Field(None, max_length=200, description="Müşteri soyadı")
    phone: Optional[str] = Field(None, max_length=20, description="Telefon numarası")
    email: Optional[str] = Field(None, max_length=100, description="E-posta adresi")
    address: Optional[str] = Field(None, max_length=500, description="Adres")
    notes: Optional[str] = Field(None, max_length=1000, description="Notlar")
    # Düzenli Teslimat
    needed_material: Optional[str] = Field(None, max_length=300, description="Düzenli ihtiyaç duyulan ürün/malzeme")
    product_id: Optional[str] = Field(None, description="Stoktan bağlı ürün ID")
    quantity: Optional[int] = Field(None, ge=1, description="Her teslimatda verilecek adet")
    unit_price: Optional[float] = Field(None, ge=0, description="Birim fiyat")
    period_days: Optional[int] = Field(None, ge=1, description="Kaç günde bir tekrar")
    last_delivery_date: Optional[str] = Field(None, max_length=10, description="Son teslimat tarihi (YYYY-MM-DD)")
    next_delivery_date: Optional[str] = Field(None, max_length=10, description="Sonraki teslimat tarihi (YYYY-MM-DD)")


class CustomerCreate(CustomerBase):
    """Customer create schema"""
    pass


class CustomerUpdate(BaseModel):
    """Customer update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    last_name: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)
    needed_material: Optional[str] = Field(None, max_length=300)
    product_id: Optional[str] = None
    quantity: Optional[int] = Field(None, ge=1)
    unit_price: Optional[float] = Field(None, ge=0)
    period_days: Optional[int] = Field(None, ge=1)
    last_delivery_date: Optional[str] = Field(None, max_length=10)
    next_delivery_date: Optional[str] = Field(None, max_length=10)




class CustomerResponse(CustomerBase):
    """Customer response schema"""
    id: str
    balance: float = Field(..., description="Müşteri bakiyesi (Borç/Alacak)")
    created_at: datetime
    updated_at: datetime
    is_synced: bool
    is_deleted: bool
    
    model_config = ConfigDict(from_attributes=True)


class CustomerBalanceResponse(BaseModel):
    """Customer balance response schema"""
    customer_id: str
    customer_name: str
    balance: float = Field(..., description="Müşteri bakiyesi (Borç/Alacak)")
    total_debt: float = Field(..., description="Toplam borç")
    total_paid: float = Field(..., description="Toplam ödenen")


class DeliveryRequest(BaseModel):
    """Teslimat yapıldı isteği"""
    manual_price: Optional[float] = Field(None, ge=0, description="Stokta yoksa manuel fiyat")
    payment_method: Optional[str] = Field("CASH", description="Ödeme yöntemi")


