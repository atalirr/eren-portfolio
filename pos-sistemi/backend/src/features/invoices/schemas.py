"""
Invoice Pydantic Schemas
Fatura Modulu - Veri Dogrulama Semalari
"""

from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class InvoiceItemCreate(BaseModel):
    product_id: Optional[str] = Field(None, description="Urun ID")
    description: str = Field(..., description="Urun/hizmet aciklamasi")
    quantity: float = Field(1, gt=0, description="Miktar")
    unit: str = Field("adet", description="Birim")
    unit_price: float = Field(0, ge=0, description="Birim fiyat (KDV haric)")
    vat_rate: float = Field(20.0, description="KDV orani")
    discount_rate: float = Field(0.0, ge=0, description="Iskonto orani (%)")


class InvoiceItemResponse(BaseModel):
    id: str
    invoice_id: str
    product_id: Optional[str] = None
    description: str
    quantity: float
    unit: str
    unit_price: float
    vat_rate: float
    vat_amount: float
    discount_rate: float
    discount_amount: float
    line_total: float
    
    model_config = ConfigDict(from_attributes=True)


class InvoiceCreate(BaseModel):
    invoice_type: str = Field("SALES", description="SALES veya PURCHASE")
    customer_id: Optional[str] = Field(None, description="Musteri ID")
    supplier_id: Optional[str] = Field(None, description="Tedarikci ID")
    invoice_date: str = Field(..., description="Fatura tarihi YYYY-MM-DD")
    due_date: Optional[str] = Field(None, description="Vade tarihi")
    notes: Optional[str] = Field(None, description="Notlar")
    payment_method: Optional[str] = Field(None, description="Odeme yontemi")
    items: List[InvoiceItemCreate] = Field(..., min_length=1, description="Fatura kalemleri")


class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    invoice_type: str
    customer_id: Optional[str] = None
    supplier_id: Optional[str] = None
    invoice_date: str
    due_date: Optional[str] = None
    subtotal: float
    total_vat: float
    total_discount: float
    total_amount: float
    status: str
    notes: Optional[str] = None
    payment_method: Optional[str] = None
    created_at: Optional[str] = None
    items: List[InvoiceItemResponse] = []
    customer_name: Optional[str] = None
    supplier_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)