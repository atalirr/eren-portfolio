"""
Orders Pydantic Schemas
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


# ============================================
# Order Item Schemas
# ============================================

class OrderItemBase(BaseModel):
    """Order item base schema"""
    product_id: str = Field(..., description="Ürün ID (UUID)")
    quantity: int = Field(..., gt=0, description="Miktar")
    unit_sell_price: float = Field(..., ge=0, description="Birim satış fiyatı")
    unit_buy_price: float = Field(default=0.0, ge=0, description="Birim maliyet")
    discount: float = Field(default=0.0, ge=0, description="İndirim tutarı")
    subtotal: float = Field(..., ge=0, description="Ara toplam")


class OrderItemCreate(OrderItemBase):
    """Order item create schema"""
    pass


class OrderItemResponse(OrderItemBase):
    """Order item response schema"""
    id: str = Field(..., description="UUID")
    order_id: str = Field(..., description="Sipariş ID (UUID)")
    created_at: datetime
    updated_at: datetime
    is_synced: bool
    is_deleted: bool
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# Order Schemas
# ============================================

class OrderBase(BaseModel):
    """Order base schema"""
    total_amount: float = Field(..., ge=0, description="Toplam tutar")
    discount_type: Optional[str] = Field(None, description="İndirim tipi: PERCENT, FIXED")
    discount_value: float = Field(default=0.0, ge=0, description="İndirim değeri")
    final_amount: float = Field(..., ge=0, description="İndirim sonrası tutar")
    payment_method: str = Field(default="CASH", max_length=20, description="Ödeme yöntemi: CASH, CARD, CREDIT")
    status: str = Field(default="completed", max_length=20, description="Sipariş durumu")
    customer_id: Optional[str] = Field(None, description="Müşteri ID (UUID) - Veresiye satışlar için")
    notes: Optional[str] = Field(None, description="Notlar")
    source: Optional[str] = Field(None, description="Sipariş kaynağı: POS, ONLINE")
    platform: Optional[str] = Field(None, description="Pazaryeri platformu: LOCAL, TRENDYOL, HEPSIBURADA, SHOPIFY")


class OrderCreate(OrderBase):
    """Order create schema"""
    items: List[OrderItemCreate] = Field(..., min_length=1, description="Sipariş kalemleri")


class OrderUpdate(BaseModel):
    """Order update schema"""
    customer_name: Optional[str] = Field(None, max_length=200)
    total_amount: Optional[float] = Field(None, ge=0)
    tax_amount: Optional[float] = Field(None, ge=0)
    discount_amount: Optional[float] = Field(None, ge=0)
    payment_method: Optional[str] = Field(None, max_length=20)
    status: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None


class OrderResponse(OrderBase):
    """Order response schema"""
    id: str = Field(..., description="UUID")
    order_number: str = Field(..., description="Sipariş numarası")
    user_id: str = Field(..., description="Kullanıcı ID (UUID)")
    customer_id: Optional[str] = Field(None, description="Müşteri ID (UUID)")
    created_at: datetime
    updated_at: datetime
    is_synced: bool
    is_deleted: bool
    
    model_config = ConfigDict(from_attributes=True)


class OrderWithItems(OrderResponse):
    """Order with items"""
    items: List[OrderItemResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

