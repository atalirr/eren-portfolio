"""
E-Commerce Schemas
Pydantic Models for E-Commerce API
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from src.features.orders.models import MarketplacePlatform, MarketplaceStatus


# ============================================
# MarketplaceConfig Schemas
# ============================================

class MarketplaceConfigBase(BaseModel):
    """MarketplaceConfig base schema"""
    platform: str = Field(..., description="Pazaryeri platformu")
    api_key: Optional[str] = Field(None, description="API Anahtarı")
    api_secret: Optional[str] = Field(None, description="API Secret")
    merchant_id: Optional[str] = Field(None, description="Satıcı ID")
    is_active: bool = Field(default=False, description="Aktif mi?")
    is_simulation_mode: bool = Field(default=True, description="Simülasyon modu aktif mi?")
    webhook_url: Optional[str] = Field(None, description="Webhook URL")
    notes: Optional[str] = Field(None, description="Notlar")


class MarketplaceConfigCreate(MarketplaceConfigBase):
    """MarketplaceConfig create schema"""
    pass


class MarketplaceConfigUpdate(BaseModel):
    """MarketplaceConfig update schema"""
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    merchant_id: Optional[str] = None
    is_active: Optional[bool] = None
    is_simulation_mode: Optional[bool] = None
    webhook_url: Optional[str] = None
    notes: Optional[str] = None


class MarketplaceConfigResponse(MarketplaceConfigBase):
    """MarketplaceConfig response schema"""
    id: str
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


# ============================================
# ProductMapping Schemas
# ============================================

class ProductMappingBase(BaseModel):
    """ProductMapping base schema"""
    product_id: str = Field(..., description="Yerel ürün ID")
    marketplace_config_id: str = Field(..., description="Pazaryeri config ID")
    marketplace_product_id: str = Field(..., description="Pazaryeri ürün ID'si")
    marketplace_sku: Optional[str] = Field(None, description="Pazaryeri SKU")
    marketplace_barcode: Optional[str] = Field(None, description="Pazaryeri barkod")
    is_active: bool = Field(default=True, description="Eşleştirme aktif mi?")


class ProductMappingCreate(ProductMappingBase):
    """ProductMapping create schema"""
    pass


class ProductMappingUpdate(BaseModel):
    """ProductMapping update schema"""
    marketplace_product_id: Optional[str] = None
    marketplace_sku: Optional[str] = None
    marketplace_barcode: Optional[str] = None
    is_active: Optional[bool] = None


class ProductMappingResponse(ProductMappingBase):
    """ProductMapping response schema"""
    id: str
    created_at: datetime
    updated_at: datetime
    last_sync_at: Optional[str] = None
    
    model_config = {"from_attributes": True}


# ============================================
# Simulation Schemas
# ============================================

class SimulationRequest(BaseModel):
    """Simülasyon isteği"""
    count: int = Field(default=1, ge=1, le=10, description="Oluşturulacak sipariş sayısı")
    platform: MarketplacePlatform = Field(default=MarketplacePlatform.TRENDYOL, description="Pazaryeri platformu")





















