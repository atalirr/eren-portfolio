"""
E-Commerce Models
Pazaryeri Entegrasyonları ve Ürün Eşleştirmeleri
"""

from sqlalchemy import Column, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
import enum

from src.shared.models.base import BaseModel
from src.features.orders.models import MarketplacePlatform


class MarketplaceConfig(BaseModel):
    """
    MarketplaceConfig Model
    Pazaryeri API Ayarları
    """
    
    __tablename__ = "marketplace_configs"
    
    platform = Column(
        String(50),
        nullable=False,
        unique=True,
        comment="Pazaryeri platformu: TRENDYOL, HEPSIBURADA, SHOPIFY"
    )
    
    api_key = Column(String(500), nullable=True, comment="API Anahtarı")
    api_secret = Column(String(500), nullable=True, comment="API Secret")
    merchant_id = Column(String(200), nullable=True, comment="Satıcı ID")
    
    is_active = Column(Boolean, nullable=False, default=False, comment="Aktif mi?")
    is_simulation_mode = Column(Boolean, nullable=False, default=True, comment="Simülasyon modu aktif mi?")
    
    webhook_url = Column(String(500), nullable=True, comment="Webhook URL")
    notes = Column(Text, nullable=True, comment="Notlar")
    
    # Relationships
    product_mappings = relationship("ProductMapping", back_populates="marketplace_config", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<MarketplaceConfig(id={self.id}, platform={self.platform}, is_active={self.is_active})>"


class ProductMapping(BaseModel):
    """
    ProductMapping Model
    Yerel Ürün ile Pazaryeri Ürün Eşleştirmesi
    """
    
    __tablename__ = "product_mappings"
    
    product_id = Column(
        String(36),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        comment="Yerel ürün ID (FK)"
    )
    
    marketplace_config_id = Column(
        String(36),
        ForeignKey("marketplace_configs.id", ondelete="CASCADE"),
        nullable=False,
        comment="Pazaryeri config ID (FK)"
    )
    
    marketplace_product_id = Column(String(200), nullable=False, comment="Pazaryeri ürün ID'si")
    marketplace_sku = Column(String(200), nullable=True, comment="Pazaryeri SKU")
    marketplace_barcode = Column(String(200), nullable=True, comment="Pazaryeri barkod")
    
    is_active = Column(Boolean, nullable=False, default=True, comment="Eşleştirme aktif mi?")
    last_sync_at = Column(String(50), nullable=True, comment="Son senkronizasyon zamanı")
    
    # Relationships
    product = relationship("Product")
    marketplace_config = relationship("MarketplaceConfig", back_populates="product_mappings")
    
    def __repr__(self) -> str:
        return f"<ProductMapping(id={self.id}, product_id={self.product_id}, marketplace_product_id={self.marketplace_product_id})>"





















