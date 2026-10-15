"""
Customers Service
Business Logic Layer
"""

from typing import List, Optional
from sqlalchemy.orm import Session

from src.features.customers.models import Customer
from src.features.customers.repository import CustomerRepository
from src.features.customers.schemas import CustomerCreate, CustomerUpdate


class CustomerService:
    """Customer Service"""
    
    def __init__(self, db: Session):
        self.db = db
        self.repository = CustomerRepository
    
    def get_all(self, include_deleted: bool = False, search: Optional[str] = None) -> List[Customer]:
        """Tüm müşterileri getir"""
        return self.repository.get_all(self.db, include_deleted, search)
    
    def get_by_id(self, customer_id: str) -> Optional[Customer]:
        """ID'ye göre müşteri getir"""
        return self.repository.get_by_id(self.db, customer_id)
    
    def create(self, data: CustomerCreate) -> Customer:
        """Yeni müşteri oluştur"""
        customer = Customer(**data.model_dump())
        return self.repository.create(self.db, customer)
    
    def update(self, customer_id: str, data: CustomerUpdate) -> Optional[Customer]:
        """Müşteriyi güncelle"""
        customer = self.repository.get_by_id(self.db, customer_id)
        if not customer:
            return None
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(customer, key, value)
        
        return self.repository.update(self.db, customer)
    
    def update_balance(self, customer_id: str, amount: float) -> Optional[Customer]:
        """Müşteri bakiyesini güncelle"""
        return self.repository.update_balance(self.db, customer_id, amount)
    
    def get_balance(self, customer_id: str) -> Optional[dict]:
        """Müşteri bakiyesi bilgilerini getir"""
        customer = self.repository.get_by_id(self.db, customer_id)
        if not customer:
            return None
        
        # Toplam borç ve ödenen tutarı hesapla (legacy orders + modern sale_orders)
        from src.features.orders.models import Order
        from src.features.sales.models import SaleOrder, PaymentMethod as SalesPaymentMethod
        
        legacy_orders = self.db.query(Order).filter(
            Order.customer_id == customer_id,
            Order.is_deleted == False
        ).all()
        
        sale_orders = self.db.query(SaleOrder).filter(
            SaleOrder.customer_id == customer_id,
            SaleOrder.is_deleted == False
        ).all()
        
        # Legacy hesap
        legacy_debt = sum(order.final_amount for order in legacy_orders if order.payment_method == "CREDIT")
        legacy_paid = sum(order.final_amount for order in legacy_orders if order.payment_method != "CREDIT")
        
        # Modern sale_orders hesap
        modern_debt = 0.0
        modern_paid = 0.0
        for so in sale_orders:
            amt = float(so.final_amount or so.total_amount or 0.0)
            if so.payment_method == SalesPaymentMethod.DEBT:
                modern_debt += amt
            else:
                modern_paid += amt
        
        total_debt = round(legacy_debt + modern_debt, 2)
        total_paid = round(legacy_paid + modern_paid, 2)
        
        return {
            "customer_id": customer.id,
            "customer_name": f"{customer.name} {customer.last_name or ''}".strip(),
            "balance": round(customer.balance, 2),
            "total_debt": total_debt,
            "total_paid": total_paid,
        }
    
    def delete(self, customer_id: str) -> bool:
        """Müşteriyi sil (soft delete)"""
        customer = self.repository.get_by_id(self.db, customer_id)
        if not customer:
            return False
        
        self.repository.soft_delete(self.db, customer)
        return True

    def record_delivery(
        self,
        customer_id: str,
        manual_price: float | None = None,
        payment_method: str = "CASH"
    ):
        """
        Teslimat yapıldı işlemi:
        1. Stokta ürün varsa stoktan düş.
        2. Satışı kasa/transaction olarak kaydet.
        3. Son teslimat tarihini bugün yap, sonrakini hesapla.
        """
        from datetime import date, timedelta
        
        customer = self.repository.get_by_id(self.db, customer_id)
        if not customer:
            return None

        today = date.today().isoformat()

        # Aynı gün mükerrer teslimat yapılmasını engelle
        if customer.last_delivery_date == today:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bu müşteriye bugün zaten teslimat yapıldı."
            )

        # Default bir kullanıcı al (hem stok hareketi hem kasa kaydı için)
        from src.features.auth.models import User
        user = self.db.query(User).first()
        user_id = user.id if user else "default-user"

        period = customer.period_days or 30
        next_date = (date.today() + timedelta(days=period)).isoformat()

        # Kullanılacak fiyat ve adet
        qty = customer.quantity or 1
        price = manual_price
        description = f"Düzenli Teslimat — {customer.name} {customer.last_name or ''} / {customer.needed_material or 'Malzeme'}"

        # JSON kontrolü (birden fazla ürün desteği)
        import json
        is_multiple = False
        items = []
        if customer.needed_material and (customer.needed_material.startswith('[') or customer.needed_material.startswith('JSON:')):
            try:
                js_str = customer.needed_material
                if js_str.startswith('JSON:'):
                    js_str = js_str[5:]
                items = json.loads(js_str)
                if isinstance(items, list):
                    is_multiple = True
            except Exception:
                is_multiple = False

        if is_multiple:
            total_price = 0.0
            description_parts = []
            from src.features.inventory.models import Product
            from src.features.inventory.stock_movement import StockMovement, StockMovementReason
            
            for item in items:
                p_id = item.get("product_id")
                p_qty = item.get("quantity", 1)
                u_price = item.get("unit_price", 0.0)
                name = item.get("name", "Ürün")
                
                if p_id:
                    product = self.db.query(Product).filter(
                        Product.id == p_id,
                        Product.is_deleted == False
                    ).first()
                    if product:
                        old_stock = product.stock_quantity
                        product.stock_quantity -= p_qty
                        self.db.add(product)
                        
                        # Stok hareketi kaydı oluştur
                        move = StockMovement(
                            product_id=product.id,
                            user_id=user_id,
                            quantity_change=-p_qty,
                            reason=StockMovementReason.SALE,
                            notes=f"Düzenli Teslimat: {customer.name} {customer.last_name or ''} ({old_stock} -> {product.stock_quantity})"
                        )
                        self.db.add(move)
                        
                        if not u_price:
                            u_price = product.sell_price or 0.0
                
                total_price += u_price * p_qty
                description_parts.append(f"{p_qty}x {name}")
                
            if price is None:
                price = total_price
            desc_items = ", ".join(description_parts)
            description = f"Düzenli Teslimat — {customer.name} {customer.last_name or ''} / {desc_items}"
        else:
            # Tekil ürün (Eski yapı)
            if customer.product_id:
                from src.features.inventory.models import Product
                from src.features.inventory.stock_movement import StockMovement, StockMovementReason
                product = self.db.query(Product).filter(
                    Product.id == customer.product_id,
                    Product.is_deleted == False
                ).first()
                if product:
                    old_stock = product.stock_quantity
                    product.stock_quantity -= qty
                    self.db.add(product)
                    
                    # Stok hareketi kaydı oluştur
                    move = StockMovement(
                        product_id=product.id,
                        user_id=user_id,
                        quantity_change=-qty,
                        reason=StockMovementReason.SALE,
                        notes=f"Düzenli Teslimat: {customer.name} {customer.last_name or ''} ({old_stock} -> {product.stock_quantity})"
                    )
                    self.db.add(move)
                    
                    if price is None:
                        price = (product.sell_price or customer.unit_price or 0.0) * qty
                else:
                    if price is None:
                        price = (customer.unit_price or 0.0) * qty
            else:
                if price is None:
                    price = (customer.unit_price or 0.0) * qty

        try:
            # Kasaya kaydet
            if price and price > 0:
                from src.features.transactions.models import Transaction, TransactionType, PaymentMethod, TransactionSource
                
                tx = Transaction(
                    type=TransactionType.INCOME,
                    amount=price,
                    description=description,
                    payment_method=PaymentMethod.CASH if payment_method == "CASH" else PaymentMethod.CARD,
                    source=TransactionSource.POS,
                    user_id=user_id,
                )
                self.db.add(tx)

            # Tarihleri güncelle
            customer.last_delivery_date = today
            customer.next_delivery_date = next_date

            self.db.commit()
            self.db.refresh(customer)
            return customer
        except Exception as e:
            self.db.rollback()
            raise e























