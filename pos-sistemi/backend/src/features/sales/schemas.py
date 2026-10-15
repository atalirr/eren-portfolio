"""
Sales Pydantic Schemas
Satış Modülü - Veri Doğrulama Şemaları
"""

from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


# ============================================
# Order Item Schemas
# ============================================

class OrderItemCreate(BaseModel):
    """Sipariş kalemi oluşturma şeması"""
    product_id: str = Field(..., description="Ürün ID (UUID)")
    quantity: int = Field(..., gt=0, description="Miktar")
    price: Optional[float] = Field(default=None, description="Birim satış fiyatı")
    unit_sell_price: Optional[float] = Field(default=None, description="Birim satış fiyatı alternatifi")
    discount: Optional[float] = Field(default=0.0, description="İndirim tutarı")
    
    model_config = ConfigDict(extra="ignore")
    
    def __init__(self, **data):
        if "unit_sell_price" in data and ("price" not in data or data["price"] is None):
            data["price"] = data["unit_sell_price"]
        elif "price" in data and ("unit_sell_price" not in data or data["unit_sell_price"] is None):
            data["unit_sell_price"] = data["price"]
        super().__init__(**data)


# Geriye dönük uyumluluk için alias
OrderItemSchema = OrderItemCreate


class OrderItemResponse(BaseModel):
    """Sipariş kalemi yanıt şeması"""
    id: str
    order_id: str
    product_id: str
    product_name: str
    quantity: int
    unit_price: float
    unit_cost: float
    discount: Optional[float] = 0.0
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# Order Schemas
# ============================================

class OrderCreateSchema(BaseModel):
    """
    Satış oluşturma şeması
    Frontend satış yaparken şu JSON'u gönderecek:
    
    {
      "customer_id": "uuid...",
      "payment_method": "CASH",
      "platform": "STORE",
      "items": [
        { "product_id": "uuid...", "quantity": 2, "price": 50.0 }
      ]
    }
    """
    customer_id: Optional[str] = Field(None, description="Müşteri ID (UUID) - Misafir müşteri için null")
    payment_method: str = Field(default="CASH", description="Ödeme yöntemi: CASH, CARD, TRANSFER, DEBT, SPLIT")
    platform: str = Field(default="STORE", description="Platform: STORE, TRENDYOL, HEPSIBURADA")
    items: List[OrderItemCreate] = Field(..., min_length=1, description="Sipariş kalemleri")
    due_date: Optional[str] = Field(None, description="Vade / Beklenen ödeme tarihi")
    discount_type: Optional[str] = Field(None, description="İndirim türü: PERCENT, FIXED")
    discount_value: Optional[float] = Field(None, description="İndirim değeri")
    discount_amount: Optional[float] = Field(None, description="İndirim tutarı")
    split_cash: Optional[float] = Field(None, description="Parçalı ödemede nakit kısmı")
    split_card: Optional[float] = Field(None, description="Parçalı ödemede kart kısmı")
    split_transfer: Optional[float] = Field(None, description="Parçalı ödemede havale kısmı")
    split_debt: Optional[float] = Field(None, description="Parçalı ödemede veresiye kısmı")



class OrderResponse(BaseModel):
    """Sipariş yanıt şeması"""
    id: str
    order_number: str
    customer_id: Optional[str]
    total_amount: float
    total_profit: float
    payment_method: str
    platform: str
    status: str
    created_at: str
    discount_type: Optional[str] = None
    discount_value: Optional[float] = 0.0
    discount_amount: Optional[float] = 0.0
    final_amount: Optional[float] = None
    items: List[OrderItemResponse] = []
    
    model_config = ConfigDict(from_attributes=True)













