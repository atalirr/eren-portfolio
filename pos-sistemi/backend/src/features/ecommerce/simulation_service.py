"""
E-Commerce Simulation Service
Mağaza açılmadan önce test için sahte sipariş üretimi
"""

from sqlalchemy.orm import Session
from datetime import datetime
import random
from typing import Optional

from src.features.orders.models import Order, OrderItem, OrderSource, MarketplacePlatform, MarketplaceStatus
from src.features.transactions.models import Transaction, TransactionType
from src.features.inventory.models import Product
from src.features.customers.models import Customer


class SimulationService:
    """Simülasyon servisi"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def simulate_incoming_order(self, platform: MarketplacePlatform = MarketplacePlatform.TRENDYOL) -> Optional[Order]:
        """
        Rastgele bir online sipariş oluştur
        
        @param platform: Pazaryeri platformu
        @returns: Oluşturulan sipariş
        """
        # Rastgele ürünler seç
        products = self.db.query(Product).filter(
            Product.is_deleted == False,
            Product.stock_quantity > 0
        ).limit(10).all()
        
        if not products:
            return None
        
        # Rastgele 1-3 ürün seç
        selected_products = random.sample(products, min(random.randint(1, 3), len(products)))
        
        # Sipariş numarası oluştur
        order_number = f"ONL-{platform.value}-{datetime.now().strftime('%Y%m%d%H%M%S')}-{random.randint(1000, 9999)}"
        
        # Sipariş oluştur
        order = Order(
            order_number=order_number,
            user_id="system",  # TODO: Gerçek kullanıcı ID'si
            customer_id=None,  # Online siparişlerde müşteri olmayabilir
            total_amount=0.0,
            discount_type=None,
            discount_value=0.0,
            final_amount=0.0,
            payment_method="CARD",
            status="completed",
            source=OrderSource.ONLINE,
            platform=platform,
            marketplace_status=MarketplaceStatus.NEW,
            marketplace_order_id=f"{platform.value}-{random.randint(100000, 999999)}",
            notes=f"Simülasyon siparişi - {platform.value}"
        )
        self.db.add(order)
        self.db.flush()
        
        # Sipariş kalemleri oluştur
        total_amount = 0.0
        for product in selected_products:
            quantity = random.randint(1, 3)
            unit_price = product.sell_price
            subtotal = quantity * unit_price
            
            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=quantity,
                unit_sell_price=unit_price,
                unit_buy_price=product.buy_price,
                discount=0.0,
                subtotal=subtotal
            )
            self.db.add(order_item)
            
            total_amount += subtotal
        
        # Toplam tutarı güncelle
        order.total_amount = total_amount
        order.final_amount = total_amount
        
        # Transaction oluştur
        transaction = Transaction(
            type=TransactionType.INCOME,
            category="Online Satış Geliri",
            amount=total_amount,
            description=f"Online sipariş: {order_number} ({platform.value})",
            user_id="system",
            related_order_id=order.id
        )
        self.db.add(transaction)
        
        self.db.commit()
        self.db.refresh(order)
        
        return order
    
    def simulate_batch_orders(self, count: int = 5, platform: MarketplacePlatform = MarketplacePlatform.TRENDYOL) -> list[Order]:
        """
        Toplu simülasyon siparişi oluştur
        
        @param count: Oluşturulacak sipariş sayısı
        @param platform: Pazaryeri platformu
        @returns: Oluşturulan siparişler
        """
        orders = []
        for _ in range(count):
            order = self.simulate_incoming_order(platform)
            if order:
                orders.append(order)
        return orders









