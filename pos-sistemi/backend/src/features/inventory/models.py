"""
Inventory Models
Products and Categories
"""

from sqlalchemy import Column, String, Integer, Float, ForeignKey, Text, Boolean, Index
from sqlalchemy.orm import relationship

from src.shared.models.base import BaseModel


class Category(BaseModel):
    """
    Category Model
    Ürün kategorileri
    """
    
    __tablename__ = "categories"
    
    name = Column(String(100), nullable=False, unique=True, comment="Kategori adı")
    color = Column(String(20), nullable=True, default="#3B82F6", comment="Kategori rengi (hex)")
    description = Column(Text, nullable=True, comment="Kategori açıklaması")
    
    # Relationships
    products = relationship("Product", back_populates="category", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Category(id={self.id}, name={self.name})>"


class Product(BaseModel):
    """
    Product Model
    Ürünler
    """
    
    __tablename__ = "products"
    
    category_id = Column(
        String(36),
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
        comment="Kategori ID (FK)"
    )
    
    name = Column(String(200), nullable=False, comment="Ürün adı")
    barcode = Column(String(100), nullable=True, unique=True, comment="Barkod", index=True)  # Hızlı arama için index
    sku = Column(String(100), nullable=True, unique=True, comment="Stock Keeping Unit")
    
    # Kategori ve marka (category_id zaten var, category string olarak da saklanabilir ama FK daha iyi)
    brand = Column(String(100), nullable=True, comment="Marka")
    
    sell_price = Column(Float, nullable=False, default=0.0, comment="Satış fiyatı")
    buy_price = Column(Float, nullable=False, default=0.0, comment="Maliyet (alış fiyatı) - Kâr hesabı için gizli kahraman")
    
    stock_quantity = Column(Integer, nullable=False, default=0, comment="Mevcut Stok")
    critical_level = Column(Integer, nullable=False, default=10, comment="Kritik stok seviyesi - Bu sayının altına düşerse Dashboard'da uyarı ver")
    unit = Column(String(20), nullable=False, default="adet", comment="Birim (adet, kg, lt)")
    
    description = Column(Text, nullable=True, comment="Ürün açıklaması")
    image_url = Column(String(500), nullable=True, comment="Görsel URL (yerel dosya yolu)")
    
    # Variant fields
    parent_id = Column(String(36), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, comment="Ana ürün ID")
    color = Column(String(50), nullable=True, comment="Renk varyantı")
    size = Column(String(50), nullable=True, comment="Beden/Boyut varyantı")
    material = Column(String(100), nullable=True, comment="Materyal varyantı")
    tax_rate = Column(Float, nullable=False, default=18.0, comment="KDV oranı (%)")
    
    is_active = Column(Boolean, nullable=False, default=True, comment="Aktif mi? (Silinenleri tamamen yok etme, pasife çek)")
    
    # Relationships
    category = relationship("Category", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")
    stock_movements = relationship("StockMovement", back_populates="product")
    
    # Variant Relationship
    variants = relationship("Product", backref="parent", remote_side="Product.id")
    
    def __repr__(self) -> str:
        return f"<Product(id={self.id}, name={self.name}, sell_price={self.sell_price})>"

# To prevent circular imports and guarantee that related models are registered
# in SQLAlchemy declarative registry during development and hot-reload.
try:
    from src.features.orders.models import OrderItem
except ImportError:
    pass

try:
    from src.features.inventory.stock_movement import StockMovement
except ImportError:
    pass
