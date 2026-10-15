
"""
Inventory Services
Business Logic Layer
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta

from src.features.inventory.models import Category, Product
from src.features.inventory.schemas import (
    CategoryCreate, CategoryUpdate,
    ProductCreate, ProductUpdate
)
from src.features.inventory.repository import CategoryRepository, ProductRepository
from src.features.inventory.stock_movement import StockMovement, StockMovementReason


class CategoryService:
    """Category Service"""
    
    def __init__(self, db: Session):
        self.db = db
        self.repository = CategoryRepository()
    
    def get_all(self, include_deleted: bool = False) -> List[Category]:
        """Tüm kategorileri getir"""
        return self.repository.get_all(self.db, include_deleted)
    
    def get_by_id(self, category_id: str) -> Optional[Category]:
        """ID'ye göre kategori getir"""
        return self.repository.get_by_id(self.db, category_id)
    
    def get_by_name(self, name: str, include_deleted: bool = False) -> Optional[Category]:
        """İsme göre kategori getir"""
        return self.repository.get_by_name(self.db, name, include_deleted)
    
    def create(self, category_data: CategoryCreate) -> Category:
        """Yeni kategori oluştur"""
        print(f"[DEBUG] CategoryService.create called with: {category_data.model_dump()}")
        
        # Aynı isimde kategori var mı kontrol et (silinenler dahil)
        try:
            existing = self.repository.get_by_name(self.db, category_data.name, include_deleted=True)
            print(f"[DEBUG] Existing search result: {existing}")
        except Exception as e:
            print(f"[ERROR] Error searching for existing category: {e}")
            raise
        
        if existing:
            if existing.is_deleted:
                print(f"[DEBUG] Reactivating existing deleted category: {existing.id}")
                existing.is_deleted = False
                existing.is_synced = False
                return self.repository.update(self.db, existing)
            print(f"[DEBUG] Returning existing active category: {existing.id}")
            return existing
            
        print("[DEBUG] Creating new category instance")
        try:
            category = Category(**category_data.model_dump())
            # Ensure base fields are set explicitly if they were missing in DB
            category.is_synced = False
            category.is_deleted = False
            
            print(f"[DEBUG] Saving new category to DB: {category.name}")
            return self.repository.create(self.db, category)
        except Exception as e:
            print(f"[ERROR] Error creating or saving new category: {e}")
            raise
    
    def update(self, category_id: str, category_data: CategoryUpdate) -> Optional[Category]:
        """Kategoriyi güncelle"""
        category = self.repository.get_by_id(self.db, category_id)
        if not category:
            return None
        
        update_data = category_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(category, field, value)
        
        category.is_synced = False
        return self.repository.update(self.db, category)
    
    def delete(self, category_id: str) -> bool:
        """Kategoriyi sil (soft delete)"""
        category = self.repository.get_by_id(self.db, category_id)
        if not category:
            return False
        
        self.repository.soft_delete(self.db, category)
        return True


class ProductService:
    """Product Service"""
    
    def __init__(self, db: Session):
        self.db = db
        self.repository = ProductRepository()
    
    def get_all(self, include_deleted: bool = False) -> List[Product]:
        """Tüm ürünleri getir"""
        return self.repository.get_all(self.db, include_deleted)
    
    def get_by_id(self, product_id: str) -> Optional[Product]:
        """ID'ye göre ürün getir"""
        return self.repository.get_by_id(self.db, product_id)
    
    def get_by_category(self, category_id: str, include_deleted: bool = False) -> List[Product]:
        """Kategoriye göre ürünleri getir"""
        return self.repository.get_by_category(self.db, category_id, include_deleted)
    
    def get_by_barcode(self, barcode: str) -> Optional[Product]:
        """Barkod'a göre ürün getir"""
        return self.repository.get_by_barcode(self.db, barcode)
    
    def create(self, product_data: ProductCreate) -> Product:
        """Yeni ürün oluştur"""
        # Barkod çakışma kontrolü
        if product_data.barcode:
            from sqlalchemy import and_
            # Silinmemiş ürünler arasında ara
            existing = self.db.query(Product).filter(
                and_(Product.barcode == product_data.barcode, Product.is_deleted == False)
            ).first()
            
            if existing:
                from fastapi import HTTPException, status
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Bu barkod ({product_data.barcode}) zaten başka bir üründe ({existing.name}) kullanılıyor. Lütfen farklı bir barkod kullanın."
                )

        data = product_data.model_dump()
        # Schema'daki price/cost -> Model'deki sell_price/buy_price mapping
        if "price" in data:
            data["sell_price"] = data.pop("price")
        if "cost" in data:
            _cost = data.pop("cost")
            data["buy_price"] = _cost if _cost is not None else 0.0
            
        product = Product(**data)
        # Tabloya eklerken is_synced ve is_deleted zorunlu olabilir - explicit set
        product.is_synced = False
        product.is_deleted = False
        
        return self.repository.create(self.db, product)
    
    def update(self, product_id: str, product_data: ProductUpdate) -> Optional[Product]:
        """Ürünü güncelle"""
        product = self.repository.get_by_id(self.db, product_id)
        if not product:
            return None
        
        update_data = product_data.model_dump(exclude_unset=True)
        
        # Barkod güncellemesi var mı kontrol et
        if "barcode" in update_data and update_data["barcode"]:
            from sqlalchemy import and_
            existing = self.db.query(Product).filter(
                and_(
                    Product.barcode == update_data["barcode"], 
                    Product.id != product_id,
                    Product.is_deleted == False
                )
            ).first()
            if existing:
                from fastapi import HTTPException, status
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Bu barkod ({update_data['barcode']}) zaten başka bir üründe ({existing.name}) kullanılıyor."
                )

        # Schema'daki price/cost -> Model'deki sell_price/buy_price mapping
        if "price" in update_data:
            update_data["sell_price"] = update_data.pop("price")
        if "cost" in update_data:
            _ucost = update_data.pop("cost")
            if _ucost is not None:
                update_data["buy_price"] = _ucost
        
        for field, value in update_data.items():
            setattr(product, field, value)
        
        product.is_synced = False
        return self.repository.update(self.db, product)
    
    def delete(self, product_id: str) -> bool:
        """Ürünü sil (soft delete) ve varsa varyantlarını da sil"""
        product = self.repository.get_by_id(self.db, product_id)
        if not product:
            return False
        
        # Kendisini sil
        self.repository.soft_delete(self.db, product)
        
        # Varyantlarını da sil (parent_id'si bu ürün olanları)
        self.db.query(Product).filter(Product.parent_id == product_id).update({
            "is_deleted": True,
            "is_synced": False,
            "updated_at": datetime.now()
        }, synchronize_session=False)
        self.db.commit()
        
        return True
    
    def update_stock(
        self, 
        product_id: str, 
        amount: int, 
        reason: str,
        user_id: str = "default-user",
        notes: Optional[str] = None
    ) -> Optional[Product]:
        """
        GÜVENLİ STOK GÜNCELLEME
        """
        try:
            # Ürünü bul
            product = self.repository.get_by_id(self.db, product_id)
            if not product:
                return None
            
            # Eski stok değerini sakla
            old_stock = product.stock_quantity
            
            # Yeni stok = Eski Stok + amount
            new_stock = old_stock + amount
            
            # Negatif stok kontrolü
            if new_stock < 0:
                raise ValueError(f"Stok negatif olamaz! Mevcut stok: {old_stock}, Değişim: {amount}")
            
            # Product tablosunu güncelle
            product.stock_quantity = new_stock
            product.is_synced = False
            
            # Reason enum'ını dönüştür
            try:
                reason_enum = StockMovementReason(reason)
            except ValueError:
                reason_enum = StockMovementReason.CORRECTION
            
            # StockMovement tablosuna log at
            stock_movement = StockMovement(
                product_id=product.id,
                user_id=user_id,
                quantity_change=amount,
                reason=reason_enum,
                notes=notes or f"Stok güncelleme: {old_stock} -> {new_stock}"
            )
            self.db.add(stock_movement)
            
            # Değişiklikleri kaydet
            self.db.commit()
            self.db.refresh(product)
            
            return product
            
        except Exception as e:
            self.db.rollback()
            error_detail = str(e)
            print(f"[ERROR] Stok guncelleme hatasi: {error_detail}")
            raise ValueError(f"Stok güncelleme başarısız: {error_detail}")
    
    def get_critical_products(self) -> List[Product]:
        """KRİTİK STOK KONTROLÜ"""
        return self.db.query(Product).filter(
            Product.stock_quantity <= Product.critical_level,
            Product.is_active == True,
            Product.is_deleted == False
        ).all()
    
    def get_stock_history(self, product_id: str) -> List[StockMovement]:
        """Bir ürünün stok geçmişini getir"""
        return self.db.query(StockMovement).filter(
            StockMovement.product_id == product_id
        ).order_by(StockMovement.created_at.desc()).all()
