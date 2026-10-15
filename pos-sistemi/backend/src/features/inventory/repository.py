"""
Inventory Repository
Data Access Layer
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from src.features.inventory.models import Product, Category
from src.shared.models.base import BaseModel


class CategoryRepository:
    """Category Repository"""
    
    @staticmethod
    def get_all(db: Session, include_deleted: bool = False) -> List[Category]:
        """Tüm kategorileri getir"""
        query = db.query(Category)
        if not include_deleted:
            query = query.filter(Category.is_deleted == False)
        return query.all()
    
    @staticmethod
    def get_by_id(db: Session, category_id: str) -> Optional[Category]:
        """ID'ye göre kategori getir"""
        return db.query(Category).filter(
            and_(Category.id == category_id, Category.is_deleted == False)
        ).first()
    
    @staticmethod
    def get_by_name(db: Session, name: str, include_deleted: bool = False) -> Optional[Category]:
        """İsme göre kategori getir"""
        # Standart lower() ile ara (SQLite'da case-insensitive arama için genelde yeterlidir)
        query = db.query(Category).filter(Category.name.ilike(name.strip()))
        if not include_deleted:
            query = query.filter(Category.is_deleted == False)
        return query.first()
    
    @staticmethod
    def create(db: Session, category: Category) -> Category:
        """Yeni kategori oluştur"""
        db.add(category)
        db.commit()
        db.refresh(category)
        return category
    
    @staticmethod
    def update(db: Session, category: Category) -> Category:
        """Kategoriyi güncelle"""
        db.commit()
        db.refresh(category)
        return category
    
    @staticmethod
    def soft_delete(db: Session, category: Category) -> None:
        """Soft delete"""
        category.is_deleted = True
        category.is_synced = False
        db.commit()


class ProductRepository:
    """Product Repository"""
    
    @staticmethod
    def get_all(db: Session, include_deleted: bool = False) -> List[Product]:
        """Tüm ürünleri getir"""
        query = db.query(Product)
        if not include_deleted:
            query = query.filter(Product.is_deleted == False)
        return query.all()
    
    @staticmethod
    def get_by_id(db: Session, product_id: str) -> Optional[Product]:
        """ID'ye göre ürün getir"""
        return db.query(Product).filter(
            and_(Product.id == product_id, Product.is_deleted == False)
        ).first()
    
    @staticmethod
    def get_by_category(db: Session, category_id: str, include_deleted: bool = False) -> List[Product]:
        """Kategoriye göre ürünleri getir"""
        query = db.query(Product).filter(Product.category_id == category_id)
        if not include_deleted:
            query = query.filter(Product.is_deleted == False)
        return query.all()
    
    @staticmethod
    def get_by_barcode(db: Session, barcode: str) -> Optional[Product]:
        """Barkod'a göre ürün getir"""
        return db.query(Product).filter(
            and_(Product.barcode == barcode, Product.is_deleted == False)
        ).first()
    
    @staticmethod
    def create(db: Session, product: Product) -> Product:
        """Yeni ürün oluştur"""
        db.add(product)
        db.commit()
        db.refresh(product)
        return product
    
    @staticmethod
    def update(db: Session, product: Product) -> Product:
        """Ürünü güncelle"""
        db.commit()
        db.refresh(product)
        return product
    
    @staticmethod
    def soft_delete(db: Session, product: Product) -> None:
        """Soft delete"""
        product.is_deleted = True
        product.is_synced = False
        db.commit()


