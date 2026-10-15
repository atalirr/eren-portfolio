"""
Customers Repository
Data Access Layer
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from src.features.customers.models import Customer


class CustomerRepository:
    """Customer Repository"""
    
    @staticmethod
    def get_all(db: Session, include_deleted: bool = False, search: Optional[str] = None) -> List[Customer]:
        """Tüm müşterileri getir"""
        query = db.query(Customer)
        if not include_deleted:
            query = query.filter(Customer.is_deleted == False)
        if search:
            search_filter = or_(
                Customer.name.ilike(f"%{search}%"),
                Customer.phone.ilike(f"%{search}%"),
                Customer.email.ilike(f"%{search}%")
            )
            query = query.filter(search_filter)
        return query.order_by(Customer.name).all()
    
    @staticmethod
    def get_by_id(db: Session, customer_id: str) -> Optional[Customer]:
        """ID'ye göre müşteri getir"""
        return db.query(Customer).filter(
            and_(Customer.id == customer_id, Customer.is_deleted == False)
        ).first()
    
    @staticmethod
    def create(db: Session, customer: Customer) -> Customer:
        """Yeni müşteri oluştur"""
        db.add(customer)
        db.commit()
        db.refresh(customer)
        return customer
    
    @staticmethod
    def update(db: Session, customer: Customer) -> Customer:
        """Müşteriyi güncelle"""
        db.commit()
        db.refresh(customer)
        return customer
    
    @staticmethod
    def update_balance(db: Session, customer_id: str, amount: float) -> Customer:
        """Müşteri bakiyesini güncelle (borç ekle/çıkar)"""
        customer = CustomerRepository.get_by_id(db, customer_id)
        if customer:
            customer.balance += amount
            db.commit()
            db.refresh(customer)
        return customer
    
    @staticmethod
    def soft_delete(db: Session, customer: Customer) -> None:
        """Soft delete"""
        customer.is_deleted = True
        db.commit()






















