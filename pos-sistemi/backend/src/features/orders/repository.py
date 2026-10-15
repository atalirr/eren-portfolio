"""
Orders Repository
Data Access Layer
"""

from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from src.features.orders.models import Order, OrderItem


class OrderRepository:
    """Order Repository"""
    
    @staticmethod
    def get_all(db: Session, include_deleted: bool = False, include_items: bool = False) -> List[Order]:
        """Tüm siparişleri getir"""
        try:
            query = db.query(Order)
            if not include_deleted:
                # SQLite için boolean karşılaştırması
                query = query.filter(Order.is_deleted == 0)
            # Items'ları eager load et
            if include_items:
                query = query.options(joinedload(Order.items))
            return query.order_by(Order.created_at.desc()).all()
        except Exception as e:
            import traceback
            print(f"[ERROR] Repository get_all error: {str(e)}")
            print(traceback.format_exc())
            raise
    
    @staticmethod
    def get_by_id(db: Session, order_id: str) -> Optional[Order]:
        """ID'ye göre sipariş getir"""
        return db.query(Order).filter(
            and_(Order.id == order_id, Order.is_deleted == 0)
        ).first()
    
    @staticmethod
    def create(db: Session, order: Order) -> Order:
        """Yeni sipariş oluştur"""
        db.add(order)
        db.commit()
        db.refresh(order)
        return order
    
    @staticmethod
    def soft_delete(db: Session, order: Order) -> None:
        """Soft delete"""
        order.is_deleted = True
        order.is_synced = False
        db.commit()




        """Soft delete"""
        order.is_deleted = True
        order.is_synced = False
        db.commit()




        """Soft delete"""
        order.is_deleted = True
        order.is_synced = False
        db.commit()



