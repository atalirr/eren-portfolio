"""
Inventory Pydantic Schemas
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


# ============================================
# Category Schemas
# ============================================

class CategoryBase(BaseModel):
    """Category base schema"""
    name: str = Field(..., min_length=1, max_length=100, description="Kategori adı")
    description: Optional[str] = Field(None, description="Kategori açıklaması")
    color: Optional[str] = Field("#3B82F6", max_length=20, description="Kategori rengi")


class CategoryCreate(CategoryBase):
    """Category create schema"""
    pass


class CategoryUpdate(BaseModel):
    """Category update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None


class CategoryResponse(CategoryBase):
    """Category response schema"""
    id: str = Field(..., description="UUID")
    created_at: datetime
    updated_at: datetime
    is_synced: bool
    is_deleted: bool
    color: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# Product Schemas
# ============================================

class ProductBase(BaseModel):
    """Product base schema"""
    category_id: str = Field(..., description="Kategori ID (UUID)")
    name: str = Field(..., min_length=1, max_length=200, description="Ürün adı")
    barcode: Optional[str] = Field(None, max_length=100, description="Barkod")
    sku: Optional[str] = Field(None, max_length=100, description="Stock Keeping Unit")
    brand: Optional[str] = Field(None, max_length=100, description="Marka")
    price: float = Field(..., ge=0, description="Satış fiyatı")
    cost: Optional[float] = Field(None, ge=0, description="Maliyet")
    stock_quantity: int = Field(default=0, ge=0, description="Stok miktarı")
    critical_level: int = Field(default=10, ge=0, description="Kritik stok seviyesi")
    unit: str = Field(default="adet", max_length=20, description="Birim")
    description: Optional[str] = Field(None, description="Ürün açıklaması")
    image_url: Optional[str] = Field(None, max_length=500, description="Görsel URL")
    # Variant fields
    parent_id: Optional[str] = Field(None, description="Ana ürün ID (UUID)")
    color: Optional[str] = Field(None, max_length=50, description="Renk varyantı")
    size: Optional[str] = Field(None, max_length=50, description="Beden/Boyut varyantı")
    material: Optional[str] = Field(None, max_length=100, description="Materyal varyantı")
    tax_rate: float = Field(default=18.0, ge=0, description="KDV oranı (%)")
    is_active: bool = Field(default=True, description="Aktif mi?")


class ProductCreate(ProductBase):
    """Product create schema"""
    pass


class ProductUpdate(BaseModel):
    """Product update schema"""
    category_id: Optional[str] = None
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    barcode: Optional[str] = Field(None, max_length=100)
    sku: Optional[str] = Field(None, max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    price: Optional[float] = Field(None, ge=0)
    cost: Optional[float] = Field(None, ge=0)
    stock_quantity: Optional[int] = Field(None, ge=0)
    critical_level: Optional[int] = Field(None, ge=0)
    unit: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=500)
    parent_id: Optional[str] = None
    color: Optional[str] = Field(None, max_length=50)
    size: Optional[str] = Field(None, max_length=50)
    material: Optional[str] = Field(None, max_length=100)
    tax_rate: Optional[float] = Field(None, ge=0)
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    """Product response schema"""
    id: str = Field(..., description="UUID")
    created_at: datetime
    updated_at: datetime
    is_synced: bool
    is_deleted: bool
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True  # Alias'ları kullan
    )


class ProductWithCategory(ProductResponse):
    """Product with category info"""
    category: Optional[CategoryResponse] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# Stock Management Schemas
# ============================================

class StockUpdateSchema(BaseModel):
    """Stok güncelleme şeması"""
    amount: int = Field(..., description="Değişim miktarı (+ veya -)")
    reason: str = Field(..., description="Sebep: SALE, RESTOCK, RETURN, CORRECTION, WASTE")
    notes: Optional[str] = Field(None, description="Opsiyonel notlar")


class StockMovementResponse(BaseModel):
    """Stok hareketi yanıt şeması"""
    id: str
    product_id: str
    user_id: Optional[str]
    quantity_change: int
    reason: str
    notes: Optional[str]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


