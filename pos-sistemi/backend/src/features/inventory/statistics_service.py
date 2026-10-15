"""
Inventory Statistics Services
Extended Business Logic Layer for Intelligent Statistics
"""

from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from datetime import datetime, timedelta

from src.features.inventory.models import Product
from src.features.inventory.stock_movement import StockMovement, StockMovementReason


class InventoryStatisticsService:
    """Inventory Statistics Service for Intelligent Dashboard Cards"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_financial_inventory_value(self) -> Dict[str, Any]:
        """
        Kart 1: Finansal Envanter Değeri
        Toplam Sermaye ve Potansiyel Ciro hesapla
        """
        variant_parents = self.db.query(Product.parent_id).filter(
            Product.parent_id.isnot(None),
            Product.is_deleted == False
        ).distinct().subquery()

        inventory_filter = or_(
            Product.parent_id.isnot(None),
            ~Product.id.in_(variant_parents)
        )

        total_cost = self.db.query(
            func.sum(Product.stock_quantity * Product.buy_price)
        ).filter(
            Product.is_active == True,
            Product.is_deleted == False,
            inventory_filter
        ).scalar() or 0
        
        total_revenue = self.db.query(
            func.sum(Product.stock_quantity * Product.sell_price)
        ).filter(
            Product.is_active == True,
            Product.is_deleted == False,
            inventory_filter
        ).scalar() or 0
        
        expected_profit = total_revenue - total_cost
        
        # Toplam ürün sayısı
        total_products = self.db.query(Product).filter(
            Product.is_active == True,
            Product.is_deleted == False,
            inventory_filter
        ).count()
        
        # Ortalama kar per ürün
        avg_profit_per_product = expected_profit / total_products if total_products > 0 else 0
        
        return {
            "total_stock_cost_value": total_cost,
            "total_stock_sell_value": total_revenue,
            "expected_net_profit": expected_profit,
            "total_products": total_products,
            "avg_profit_per_product": avg_profit_per_product
        }

    def get_stock_warnings(self) -> Dict[str, Any]:
        """
        Kart 2: Stok Uyarı Merkezi
        Kritik ve tükenmiş ürün sayıları
        """
        variant_parents = self.db.query(Product.parent_id).filter(
            Product.parent_id.isnot(None),
            Product.is_deleted == False
        ).distinct().subquery()

        inventory_filter = or_(
            Product.parent_id.isnot(None),
            ~Product.id.in_(variant_parents)
        )

        critical_count = self.db.query(Product).filter(
            Product.stock_quantity <= Product.critical_level,
            Product.stock_quantity > 0,
            Product.is_active == True,
            Product.is_deleted == False,
            inventory_filter
        ).count()
        
        out_of_stock_count = self.db.query(Product).filter(
            Product.stock_quantity == 0,
            Product.is_active == True,
            Product.is_deleted == False,
            inventory_filter
        ).count()
        
        return {
            "low_stock_count": critical_count,
            "out_of_stock_count": out_of_stock_count
        }

    def get_inventory_turnover_rate(self) -> Dict[str, Any]:
        """
        Kart 3: Envanter Devir Hızı
        Son 30 günlük satış verilerine göre devir hızı
        """
        # Son 30 gün
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        # Son 30 gündeki stok düşüşlerini (satışları) hesapla
        sales_movements = self.db.query(StockMovement).filter(
            StockMovement.reason == StockMovementReason.SALE,
            StockMovement.created_at >= thirty_days_ago
        ).all()
        
        total_sold_quantity = sum(abs(m.quantity_change) for m in sales_movements)
        
        # Ortalama stok değeri (varyantı olan parent'lar hariç)
        variant_parents = self.db.query(Product.parent_id).filter(
            Product.parent_id.isnot(None),
            Product.is_deleted == False
        ).distinct().subquery()

        inventory_filter = or_(
            Product.parent_id.isnot(None),
            ~Product.id.in_(variant_parents)
        )

        avg_stock_quantity = self.db.query(
            func.avg(Product.stock_quantity)
        ).filter(
            Product.is_active == True,
            Product.is_deleted == False,
            inventory_filter
        ).scalar() or 1
        
        # Devir hızı formülü: (Satılan Toplam Ürün Sayısı) / (Ortalama Stok Miktarı)
        turnover_rate = total_sold_quantity / avg_stock_quantity if avg_stock_quantity > 0 else 0
        renewal_days = 30 / turnover_rate if turnover_rate > 0 else 999
        
        return {
            "turnover_rate": round(turnover_rate, 2),
            "renewal_days": int(renewal_days),
            "sold_last_30_days": total_sold_quantity,
            "turnover_percentage": min(95, max(15, int(turnover_rate * 20)))
        }

    def get_dead_stock_list(self) -> Dict[str, Any]:
        """
        Kart 4: Dinamik 'Ölü Stok' Listesi
        Son 90 günde satılmayan ürünler
        """
        ninety_days_ago = datetime.utcnow() - timedelta(days=90)
        
        # Son 90 günde satılan ürünleri bul
        sold_products = self.db.query(StockMovement.product_id).filter(
            StockMovement.reason == StockMovementReason.SALE,
            StockMovement.created_at >= ninety_days_ago
        ).distinct().subquery()
        
        variant_parents = self.db.query(Product.parent_id).filter(
            Product.parent_id.isnot(None),
            Product.is_deleted == False
        ).distinct().subquery()

        inventory_filter = or_(
            Product.parent_id.isnot(None),
            ~Product.id.in_(variant_parents)
        )

        # Son 90 günde satılmayan ürünleri getir
        dead_stock = self.db.query(Product).filter(
            ~Product.id.in_(sold_products),
            Product.is_active == True,
            Product.is_deleted == False,
            Product.stock_quantity > 0,
            inventory_filter
        ).order_by(
            Product.stock_quantity.desc()  # Stok çoktan aza doğru
        ).limit(10).all()
        
        # Format için son satış tarihlerini bul
        dead_stock_list = []
        for product in dead_stock:
            last_sale = self.db.query(StockMovement).filter(
                StockMovement.product_id == product.id,
                StockMovement.reason == StockMovementReason.SALE
            ).order_by(StockMovement.created_at.desc()).first()
            
            days_since_last_sale = None
            if last_sale:
                days_since_last_sale = (datetime.utcnow() - last_sale.created_at).days
            else:
                days_since_last_sale = 999  # Hiç satılmamış
            
            dead_stock_list.append({
                "id": product.id,
                "name": product.name,
                "stock_quantity": product.stock_quantity,
                "days_since_last_sale": days_since_last_sale,
                "last_sale_display": f"{days_since_last_sale} gün önce" if days_since_last_sale < 999 else "Hiç satılmadı"
            })
        
        # 90+ gündür satılmayan toplam ürün sayısı
        total_dead_stock = self.db.query(Product).filter(
            ~Product.id.in_(sold_products),
            Product.is_active == True,
            Product.is_deleted == False,
            Product.stock_quantity > 0,
            inventory_filter
        ).count()
        
        return {
            "dead_stock_list": dead_stock_list,
            "total_dead_stock_count": total_dead_stock
        }

    def get_all_statistics(self) -> Dict[str, Any]:
        """
        Tüm istatistikleri tek bir çağrıda getir
        """
        return {
            "financial": self.get_financial_inventory_value(),
            "warnings": self.get_stock_warnings(),
            "turnover": self.get_inventory_turnover_rate(),
            "dead_stock": self.get_dead_stock_list()
        }
