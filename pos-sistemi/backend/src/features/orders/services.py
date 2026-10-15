"""
Orders Services
Business Logic Layer - Zincirleme Satış Mantığı
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from src.features.orders.models import Order, OrderItem
from src.features.orders.schemas import OrderCreate
from src.features.orders.repository import OrderRepository
from src.features.inventory.models import Product
from src.features.inventory.stock_movement import StockMovement, StockMovementReason
from src.features.transactions.models import Transaction, TransactionType
from src.features.system.models import SystemLog
from src.features.auth.models import User
from src.features.sales.models import SaleOrder


class OrderService:
    """Order Service - Zincirleme Satış Mantığı"""
    
    def __init__(self, db: Session):
        self.db = db
        self.repository = OrderRepository()
    
    def _generate_order_number(self) -> str:
        """Sipariş numarası oluştur (#1001 formatında)"""
        # Tüm siparişlerin sayısını al (silinmemiş olanlar)
        count = self.db.query(Order).filter(
            Order.is_deleted == 0
        ).count()
        # Unique olması için timestamp ekle
        import time
        timestamp = int(time.time() * 1000) % 10000  # Son 4 hanesi
        return f"#{count + 1001:04d}-{timestamp:04d}"
    
    def process_sale(self, order_data: OrderCreate, user_id: str) -> Order:
        """
        SATIŞ İŞLEMİ - Zincirleme Reaksiyonlar
        
        Senaryo: Satış yapıldığında sırasıyla:
        1. Order ve OrderItem kayıtlarını oluştur
        2. Stok Düş: Her ürün için StockMovement tablosuna "SALE" sebebiyle kayıt at ve Product stoğunu düş
        3. Kasa Girişi: Toplam tutar kadar Transaction tablosuna "INCOME" (Satış Geliri) kaydı at
        4. Loglama: SystemLog tablosuna "X Kullanıcısı #1001 nolu satışı yaptı" kaydı at
        """
        try:
            # 0. User kontrolü - Eğer user yoksa oluştur veya hata ver
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                # Default user yoksa oluştur
                user = User(
                    id=user_id,  # Manuel olarak ID set et
                    username="default-user",
                    password_hash="",  # Şifre yok
                    full_name="Varsayılan Kullanıcı",
                    role="CASHIER",
                    is_active=True
                )
                self.db.add(user)
                self.db.flush()  # User'ı flush et
            
            # 1. Order ve OrderItem kayıtlarını oluştur
            order_number = self._generate_order_number()
            
            # İndirim hesaplaması
            total_amount = sum(item.subtotal for item in order_data.items)
            discount_amount = 0.0
            
            if order_data.discount_type == "PERCENT" and order_data.discount_value > 0:
                discount_amount = total_amount * (order_data.discount_value / 100)
            elif order_data.discount_type == "FIXED" and order_data.discount_value > 0:
                discount_amount = order_data.discount_value
            
            final_amount = total_amount - discount_amount
            
            # Order oluştur
            order_dict = order_data.model_dump(exclude={"items"})
            
            # Source ve platform enum'larını dönüştür
            from src.features.orders.models import OrderSource, MarketplacePlatform
            source_enum = None
            if order_dict.get("source"):
                try:
                    source_enum = OrderSource(order_dict.get("source"))
                except ValueError:
                    source_enum = None
            
            platform_enum = None
            if order_dict.get("platform"):
                try:
                    platform_enum = MarketplacePlatform(order_dict.get("platform"))
                except ValueError:
                    platform_enum = None
            
            # Veresiye satışları için status'u 'credit_pending' yap (onaylanana kadar grafiklere yansımasın)
            payment_method = str(order_dict.get("payment_method", "CASH")).upper().strip()
            order_status = order_dict.get("status", "completed")
            if payment_method == "CREDIT":
                order_status = "credit_pending"  # Onaylanana kadar beklet
            
            order = Order(
                order_number=order_number,
                user_id=user_id,
                customer_id=order_dict.get("customer_id"),  # Veresiye satışlar için
                total_amount=total_amount,
                discount_value=discount_amount,
                final_amount=final_amount,
                payment_method=payment_method,
                status=order_status,
                notes=order_dict.get("notes"),
                discount_type=order_dict.get("discount_type"),
                source=source_enum,
                platform=platform_enum,
            )
            
            # Order'ı önce oluştur ve flush et (order_id için)
            self.db.add(order)
            self.db.flush()  # Order'ı flush et ki id'si oluşsun
            
            # Order items oluştur (snapshot ile)
            items = []
            for item_data in order_data.items:
                # Ürün bilgilerini al (snapshot için)
                product = self.db.query(Product).filter(Product.id == item_data.product_id).first()
                if not product:
                    raise ValueError(f"Ürün bulunamadı: {item_data.product_id}")
                
                # Stok kontrolü (Negatif stoğa izin veriyoruz)
                if product.stock_quantity < item_data.quantity:
                    print(f"[WARNING] Yetersiz stok (Orders): {product.name} (Stok: {product.stock_quantity}, İstenen: {item_data.quantity}). Satışa devam ediliyor.")
                
                item = OrderItem(
                    order_id=order.id,  # Order ID'yi manuel olarak set et
                    product_id=item_data.product_id,
                    quantity=item_data.quantity,
                    unit_sell_price=item_data.unit_sell_price,  # Frontend'den gelen fiyat
                    unit_buy_price=item_data.unit_buy_price,  # Frontend'den gelen maliyet
                    discount=item_data.discount if hasattr(item_data, 'discount') else 0.0,
                    subtotal=item_data.subtotal
                )
                items.append(item)
                self.db.add(item)  # OrderItem'ı ekle
                
                # 2. Stok Düş: StockMovement tablosuna "SALE" sebebiyle kayıt at
                stock_movement = StockMovement(
                    product_id=product.id,
                    user_id=user_id,
                    quantity_change=-item_data.quantity,  # Eksi değer (satış = stok düşer)
                    reason=StockMovementReason.SALE,
                    notes=f"Sipariş: {order_number}"
                )
                self.db.add(stock_movement)
                
                # Product stoğunu düş
                product.stock_quantity -= item_data.quantity
                product.is_synced = False
            
            # Veresiye satışlar için müşteri bakiyesini güncelle
            payment_info = ""
            if order.payment_method == "CREDIT" and order.customer_id:
                from src.features.customers.models import Customer
                from src.features.customers.services import CustomerService
                customer_service = CustomerService(self.db)
                customer_service.update_balance(order.customer_id, final_amount)
                
                # Müşteri adını log için al
                customer = self.db.query(Customer).filter(Customer.id == order.customer_id).first()
                customer_name = customer.name if customer else "Bilinmeyen"
                payment_info = f" - VERESİYE ({customer_name})"
            
            # 3. Kasa Girişi: Transaction tablosuna "INCOME" (Satış Geliri) kaydı at
            # NOT: Veresiye satışlarda (credit_pending) nakit girişi olmaz!
            # Sadece onaylanmış (completed) veresiye satışları için transaction oluşturulur
            if order.payment_method != "CREDIT" or order.status == "completed":
                # Source ve platform bilgilerini transaction'a ekle
                from src.features.transactions.models import TransactionSource, MarketplacePlatform as TransactionMarketplacePlatform
                from src.features.orders.models import OrderSource as OrderSourceEnum, MarketplacePlatform as OrderMarketplacePlatform
                
                transaction_source = TransactionSource.MANUAL
                transaction_platform = None
                
                # POS satışları
                if source_enum == OrderSourceEnum.POS:
                    transaction_source = TransactionSource.POS
                # E-Ticaret / Online satışlar
                elif platform_enum in (
                    OrderMarketplacePlatform.TRENDYOL,
                    OrderMarketplacePlatform.HEPSIBURADA,
                    OrderMarketplacePlatform.SHOPIFY,
                    OrderMarketplacePlatform.N11,
                    OrderMarketplacePlatform.GITTIGIDIYOR,
                ) or source_enum == OrderSourceEnum.ONLINE:
                    transaction_source = TransactionSource.ECOMMERCE
                # Diğer her şey (ör. manuel eklenen veya tanımsız kaynaklar)
                else:
                    transaction_source = TransactionSource.MANUAL
                
                if platform_enum:
                    try:
                        transaction_platform = TransactionMarketplacePlatform(platform_enum.value)
                    except Exception:
                        transaction_platform = None
                
                # Payment method'a göre payment_source belirle
                # TRANSFER -> BANK, diğerleri -> CASH
                # payment_method değişkenini kullan (order_dict'ten gelen değer)
                payment_method_str = str(payment_method).upper().strip()
                payment_source = 'BANK' if payment_method_str == 'TRANSFER' else 'CASH'
                
                transaction = Transaction(
                    type=TransactionType.INCOME,
                    category="Satış Geliri",
                    amount=final_amount,
                    description=f"Sipariş: {order_number}",
                    user_id=user_id,
                    related_order_id=order.id,  # Artık order.id mevcut (flush sayesinde)
                    payment_source=payment_source,
                    source=transaction_source,
                    platform=transaction_platform,
                    reference_id=order.id,
                    payment_method=payment_method_str if hasattr(Transaction, "payment_method") else None,
                )
                self.db.add(transaction)
            
            # 4. Loglama: SystemLog tablosuna kayıt at
            user = self.db.query(User).filter(User.id == user_id).first()
            user_name = user.full_name if user else "Bilinmeyen"
            
            system_log = SystemLog(
                user_id=user_id,
                action_type="SALE",
                details=f"{user_name} satış yaptı - {order_number} - {final_amount:.2f} TL{payment_info}"
            )
            self.db.add(system_log)
            
            # Tüm değişiklikleri commit et
            self.db.commit()
            self.db.refresh(order)
            
            return order
            
        except Exception as e:
            self.db.rollback()
            import traceback
            error_detail = str(e)
            traceback_str = traceback.format_exc()
            print(f"[ERROR] Satış işlemi hatası: {error_detail}")
            print(f"[TRACE] Traceback:\n{traceback_str}")
            raise ValueError(f"Satış işlemi başarısız: {error_detail}")
    
    def get_all(self, include_deleted: bool = False, include_items: bool = False) -> List[Order]:
        """Tüm siparişleri getir"""
        return self.repository.get_all(self.db, include_deleted, include_items)
    
    def get_by_id(self, order_id: str) -> Optional[Order]:
        """ID'ye göre sipariş getir"""
        return self.repository.get_by_id(self.db, order_id)
    
    def delete(self, order_id: str) -> bool:
        """Siparişi sil (soft delete)"""
        order = self.repository.get_by_id(self.db, order_id)
        if not order:
            return False
        
        self.repository.soft_delete(self.db, order)
        return True
    
    def approve_credit_sale(self, order_id: str, user_id: str) -> Order:
        """
        Veresiye satışını onayla
        - Order status'unu 'completed' yap
        - Transaction oluştur (gelir olarak)
        """
        try:
            order = self.db.query(Order).filter(Order.id == order_id).first()
            if not order:
                raise ValueError(f"Sipariş bulunamadı: {order_id}")
            
            if order.payment_method != "CREDIT":
                raise ValueError("Bu sipariş veresiye satışı değil!")
            
            if order.status == "completed":
                raise ValueError("Bu satış zaten onaylanmış!")
            
            # Status'u 'completed' yap
            order.status = "completed"
            
            # Transaction oluştur (gelir olarak)
            from src.features.transactions.models import Transaction, TransactionType, TransactionSource, MarketplacePlatform as TransactionMarketplacePlatform
            
            transaction_source = None
            transaction_platform = None
            if order.source:
                try:
                    transaction_source = TransactionSource(order.source.value)
                except:
                    pass
            if order.platform:
                try:
                    transaction_platform = TransactionMarketplacePlatform(order.platform.value)
                except:
                    pass
            
            # Payment method'a göre payment_source belirle
            # TRANSFER -> BANK, diğerleri -> CASH
            # order.payment_method'u refresh et
            self.db.refresh(order)  # Order'ı refresh et ki payment_method güncel olsun
            payment_method_str = str(order.payment_method).upper().strip() if order.payment_method else 'CASH'
            payment_source = 'BANK' if payment_method_str == 'TRANSFER' else 'CASH'
            
            transaction = Transaction(
                type=TransactionType.INCOME,
                category="Satış Geliri",
                amount=order.final_amount,
                description=f"Sipariş: {order.order_number} - VERESİYE ONAYLANDI",
                user_id=user_id,
                related_order_id=order.id,
                payment_source=payment_source,
                source=transaction_source,
                platform=transaction_platform,
                reference_id=order.id,
            )
            self.db.add(transaction)
            
            # Veresiye satışlar için müşteri bakiyesini güncelle
            if order.customer_id:
                from src.features.customers.models import Customer
                from src.features.customers.services import CustomerService
                customer_service = CustomerService(self.db)
                customer_service.update_balance(order.customer_id, order.final_amount)
            
            self.db.commit()
            self.db.refresh(order)
            
            return order
        
        except Exception as e:
            self.db.rollback()
            raise e
    
    def get_weekly_sales_trend(self) -> List[dict]:
        """
        Haftalık satış trendini getir (Son 7 gün)
        - POS ve Online satışları ayrı ayrı hesapla
        - Veritabanından direkt olarak veri çek (optimize edilmiş)
        """
        from sqlalchemy import func, and_, or_
        from datetime import timedelta
        from src.features.orders.models import OrderSource
        
        # Haftanın başlangıcını bul (Pazartesi)
        today = datetime.now()
        day_of_week = today.weekday()  # 0 = Pazartesi, 6 = Pazar
        monday = today.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=day_of_week)
        
        # Son 7 günü hesapla
        day_names = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
        weekly_data = []
        
        for i in range(7):
            current_date = monday + timedelta(days=i)
            next_date = current_date + timedelta(days=1)
            day_name = day_names[i]
            
            # POS satışları (source = POS veya NULL)
            pos_revenue = self.db.query(
                func.sum(Order.final_amount)
            ).filter(
                and_(
                    Order.is_deleted == 0,
                    Order.status != "cancelled",
                    or_(
                        Order.source == OrderSource.POS,
                        Order.source.is_(None)
                    ),
                    Order.created_at >= current_date,
                    Order.created_at < next_date
                )
            ).scalar() or 0.0
            
            # Online satışları (source = ONLINE)
            online_revenue = self.db.query(
                func.sum(Order.final_amount)
            ).filter(
                and_(
                    Order.is_deleted == 0,
                    Order.status != "cancelled",
                    Order.source == OrderSource.ONLINE,
                    Order.created_at >= current_date,
                    Order.created_at < next_date
                )
            ).scalar() or 0.0
            
            weekly_data.append({
                "day": day_name,
                "pos": float(pos_revenue),
                "online": float(online_revenue)
            })
        
        return weekly_data
    
    def get_daily_sales_trend(self) -> List[dict]:
        """
        Günlük satış trendini getir (Bugün saatlik)
        - POS ve Online satışları ayrı ayrı hesapla
        - Veritabanından direkt olarak veri çek (optimize edilmiş)
        """
        from sqlalchemy import func, and_, or_, extract
        from datetime import timedelta
        from src.features.orders.models import OrderSource
        
        # Bugünün başlangıcı
        today = datetime.now()
        today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_start = today_start + timedelta(days=1)
        
        # Saatlik veriler (09:00 - 20:00)
        hours = list(range(9, 21))  # 9'dan 20'ye kadar
        daily_data = []
        
        for hour in hours:
            hour_start = today_start.replace(hour=hour, minute=0, second=0, microsecond=0)
            if hour < 20:
                hour_end = hour_start.replace(hour=hour + 1, minute=0, second=0, microsecond=0)
            else:
                hour_end = tomorrow_start
            
            # POS satışları (source = POS veya NULL)
            pos_revenue = self.db.query(
                func.sum(Order.final_amount)
            ).filter(
                and_(
                    Order.is_deleted == 0,
                    Order.status != "cancelled",
                    or_(
                        Order.source == OrderSource.POS,
                        Order.source.is_(None)
                    ),
                    Order.created_at >= hour_start,
                    Order.created_at < hour_end
                )
            ).scalar() or 0.0
            
            # Online satışları (source = ONLINE)
            online_revenue = self.db.query(
                func.sum(Order.final_amount)
            ).filter(
                and_(
                    Order.is_deleted == 0,
                    Order.status != "cancelled",
                    Order.source == OrderSource.ONLINE,
                    Order.created_at >= hour_start,
                    Order.created_at < hour_end
                )
            ).scalar() or 0.0
            
            daily_data.append({
                "hour": f"{hour:02d}:00",
                "pos": float(pos_revenue),
                "online": float(online_revenue)
            })
        
        return daily_data
    
    def get_payment_method_statistics(self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> dict:
        """
        Ödeme yöntemleri istatistiklerini getir - Order ve SaleOrder tablolarından
        - Nakit (CASH)
        - Kart (CARD)
        - Havale (TRANSFER)
        - Veresiye (DEBT/CREDIT)
        
        Kaynak: Order ve SaleOrder tabloları (GROUP BY ile verimli sorgu)
        """
        from sqlalchemy import func, or_
        from src.features.sales.models import SaleOrder, PaymentMethod as SalesPaymentMethod
        
        # Tarih filtresi
        from src.features.sales.models import OrderStatus as SalesOrderStatus
        date_filters = [Order.is_deleted == 0, Order.status == "completed"]
        sale_date_filters = [SaleOrder.is_deleted == 0, SaleOrder.status == SalesOrderStatus.COMPLETED]
        
        if start_date:
            date_filters.append(Order.created_at >= start_date)
            sale_date_filters.append(SaleOrder.created_at >= start_date)
        if end_date:
            date_filters.append(Order.created_at <= end_date)
            sale_date_filters.append(SaleOrder.created_at <= end_date)
        
        # Order tablosundan ödeme yöntemlerine göre grupla (SQL GROUP BY)
        order_stats = self.db.query(
            Order.payment_method,
            func.count(Order.id).label('count'),
            func.sum(Order.final_amount).label('total')
        ).filter(*date_filters).group_by(Order.payment_method).all()
        
        # SaleOrder tablosundan ödeme yöntemlerine göre grupla
        sale_order_stats = self.db.query(
            SaleOrder.payment_method,
            func.count(SaleOrder.id).label('count'),
            func.sum(SaleOrder.total_amount).label('total')
        ).filter(*sale_date_filters).group_by(SaleOrder.payment_method).all()
        
        # Ödeme yöntemlerine göre birleştir
        stats = {
            "CASH": {"count": 0, "total": 0.0},
            "CARD": {"count": 0, "total": 0.0},
            "TRANSFER": {"count": 0, "total": 0.0},
            "DEBT": {"count": 0, "total": 0.0},
            "CREDIT": {"count": 0, "total": 0.0},  # Eski Order tablosu için
        }
        
        # Order tablosundan gelen verileri ekle
        for payment_method, count, total in order_stats:
            method = str(payment_method).upper().strip() if payment_method else "CASH"
            # CREDIT -> DEBT'e map et (aynı şey)
            if method == "CREDIT":
                method = "DEBT"
            if method in stats:
                stats[method]["count"] += count or 0
                stats[method]["total"] += float(total or 0)
        
        # SaleOrder tablosundan gelen verileri ekle
        for payment_method, count, total in sale_order_stats:
            if payment_method:
                # PaymentMethod enum'ından değeri al
                if hasattr(payment_method, 'value'):
                    method = payment_method.value.upper().strip()
                elif isinstance(payment_method, str):
                    method = payment_method.upper().strip()
                else:
                    method = str(payment_method).upper().strip()
                
                # CREDIT -> DEBT'e map et (aynı şey)
                if method == "CREDIT":
                    method = "DEBT"
                
                if method in stats:
                    stats[method]["count"] += count or 0
                    stats[method]["total"] += float(total or 0)
        
        # DEBT ve CREDIT'i birleştir (eğer ikisi de varsa)
        if stats["CREDIT"]["count"] > 0 or stats["CREDIT"]["total"] > 0:
            stats["DEBT"]["count"] += stats["CREDIT"]["count"]
            stats["DEBT"]["total"] += stats["CREDIT"]["total"]
            stats["CREDIT"] = {"count": 0, "total": 0.0}
        
        # Transaction tablosundan tahsilat verilerini ekle (category='Tahsilat / Debt Collection')
        try:
            from src.features.transactions.models import Transaction, TransactionType, PaymentMethod as TransactionPaymentMethod
            transaction_stats = self.db.query(
                Transaction.payment_method,
                func.count(Transaction.id).label('count'),
                func.sum(Transaction.amount).label('total')
            ).filter(
                Transaction.type == TransactionType.INCOME,
                Transaction.category == 'Tahsilat / Debt Collection',
                Transaction.is_deleted == 0
            )
            if start_date:
                transaction_stats = transaction_stats.filter(Transaction.created_at >= start_date)
            if end_date:
                transaction_stats = transaction_stats.filter(Transaction.created_at <= end_date)
            transaction_stats = transaction_stats.group_by(Transaction.payment_method).all()
            
            # Transaction tablosundan gelen tahsilat verilerini ekle
            for payment_method, count, total in transaction_stats:
                if payment_method:
                    # PaymentMethod enum'ından değeri al
                    if hasattr(payment_method, 'value'):
                        method = payment_method.value.upper().strip()
                    elif isinstance(payment_method, str):
                        method = payment_method.upper().strip()
                    else:
                        method = str(payment_method).upper().strip()
                    
                    if method in stats:
                        stats[method]["count"] += count or 0
                        stats[method]["total"] += float(total or 0)
        except Exception as e:
            # Transaction tablosunda payment_method sütunu yoksa veya başka bir hata varsa sessizce devam et
            import traceback
            print(f"[WARN] Transaction tablosundan tahsilat verileri alınırken hata (görmezden geliniyor): {str(e)}")
            print(traceback.format_exc())
        
        # Toplam hesapla
        total_count = sum(s["count"] for s in stats.values())
        total_amount = sum(s["total"] for s in stats.values())
        
        # Method label mapping
        method_labels = {
            "CASH": "Nakit Satış",
            "CARD": "Kredi Kartı",
            "TRANSFER": "Havale / EFT",
            "DEBT": "Veresiye / Açık Hesap",
        }
        
        # Yüzde hesapla ve sonuç oluştur
        result = []
        for key, value in stats.items():
            if key == "CREDIT":  # CREDIT'i atla, DEBT'e birleştirdik
                continue
            if value["count"] > 0 or value["total"] > 0:
                percentage = (value["total"] / total_amount * 100) if total_amount > 0 else 0
                result.append({
                    "method": key,
                    "label": method_labels.get(key, key),
                    "count": value["count"],
                    "total": round(value["total"], 2),
                    "percentage": round(percentage, 2)
                })
        
        return {
            "data": result,
            "summary": {
                "total_count": total_count,
                "total_amount": round(total_amount, 2)
            }
        }

        
        # SaleOrder tablosundan gelen verileri ekle
        for payment_method, count, total in sale_order_stats:
            if payment_method:
                # PaymentMethod enum'ından değeri al
                if hasattr(payment_method, 'value'):
                    method = payment_method.value.upper().strip()
                elif isinstance(payment_method, str):
                    method = payment_method.upper().strip()
                else:
                    method = str(payment_method).upper().strip()
                
                # CREDIT -> DEBT'e map et (aynı şey)
                if method == "CREDIT":
                    method = "DEBT"
                
                if method in stats:
                    stats[method]["count"] += count or 0
                    stats[method]["total"] += float(total or 0)
        
        # DEBT ve CREDIT'i birleştir (eğer ikisi de varsa)
        if stats["CREDIT"]["count"] > 0 or stats["CREDIT"]["total"] > 0:
            stats["DEBT"]["count"] += stats["CREDIT"]["count"]
            stats["DEBT"]["total"] += stats["CREDIT"]["total"]
            stats["CREDIT"] = {"count": 0, "total": 0.0}
        
        # Transaction tablosundan tahsilat verilerini ekle (category='Tahsilat / Debt Collection')
        try:
            from src.features.transactions.models import Transaction, TransactionType, PaymentMethod as TransactionPaymentMethod
            transaction_stats = self.db.query(
                Transaction.payment_method,
                func.count(Transaction.id).label('count'),
                func.sum(Transaction.amount).label('total')
            ).filter(
                Transaction.type == TransactionType.INCOME,
                Transaction.category == 'Tahsilat / Debt Collection',
                Transaction.is_deleted == 0
            )
            if start_date:
                transaction_stats = transaction_stats.filter(Transaction.created_at >= start_date)
            if end_date:
                transaction_stats = transaction_stats.filter(Transaction.created_at <= end_date)
            transaction_stats = transaction_stats.group_by(Transaction.payment_method).all()
            
            # Transaction tablosundan gelen tahsilat verilerini ekle
            for payment_method, count, total in transaction_stats:
                if payment_method:
                    # PaymentMethod enum'ından değeri al
                    if hasattr(payment_method, 'value'):
                        method = payment_method.value.upper().strip()
                    elif isinstance(payment_method, str):
                        method = payment_method.upper().strip()
                    else:
                        method = str(payment_method).upper().strip()
                    
                    if method in stats:
                        stats[method]["count"] += count or 0
                        stats[method]["total"] += float(total or 0)
        except Exception as e:
            # Transaction tablosunda payment_method sütunu yoksa veya başka bir hata varsa sessizce devam et
            import traceback
            print(f"[WARN] Transaction tablosundan tahsilat verileri alınırken hata (görmezden geliniyor): {str(e)}")
            print(traceback.format_exc())
        
        # Toplam hesapla
        total_count = sum(s["count"] for s in stats.values())
        total_amount = sum(s["total"] for s in stats.values())
        
        # Method label mapping
        method_labels = {
            "CASH": "Nakit Satış",
            "CARD": "Kredi Kartı",
            "TRANSFER": "Havale / EFT",
            "DEBT": "Veresiye / Açık Hesap",
        }
        
        # Yüzde hesapla ve sonuç oluştur
        result = []
        for key, value in stats.items():
            if key == "CREDIT":  # CREDIT'i atla, DEBT'e birleştirdik
                continue
            if value["count"] > 0 or value["total"] > 0:
                percentage = (value["total"] / total_amount * 100) if total_amount > 0 else 0
                result.append({
                    "method": key,
                    "label": method_labels.get(key, key),
                    "count": value["count"],
                    "total": round(value["total"], 2),
                    "percentage": round(percentage, 2)
                })
        
        return {
            "data": result,
            "summary": {
                "total_count": total_count,
                "total_amount": round(total_amount, 2)
            }
        }

        
        # SaleOrder tablosundan gelen verileri ekle
        for payment_method, count, total in sale_order_stats:
            if payment_method:
                # PaymentMethod enum'ından değeri al
                if hasattr(payment_method, 'value'):
                    method = payment_method.value.upper().strip()
                elif isinstance(payment_method, str):
                    method = payment_method.upper().strip()
                else:
                    method = str(payment_method).upper().strip()
                
                # CREDIT -> DEBT'e map et (aynı şey)
                if method == "CREDIT":
                    method = "DEBT"
                
                if method in stats:
                    stats[method]["count"] += count or 0
                    stats[method]["total"] += float(total or 0)
        
        # DEBT ve CREDIT'i birleştir (eğer ikisi de varsa)
        if stats["CREDIT"]["count"] > 0 or stats["CREDIT"]["total"] > 0:
            stats["DEBT"]["count"] += stats["CREDIT"]["count"]
            stats["DEBT"]["total"] += stats["CREDIT"]["total"]
            stats["CREDIT"] = {"count": 0, "total": 0.0}
        
        # Transaction tablosundan tahsilat verilerini ekle (category='Tahsilat / Debt Collection')
        try:
            from src.features.transactions.models import Transaction, TransactionType, PaymentMethod as TransactionPaymentMethod
            transaction_stats = self.db.query(
                Transaction.payment_method,
                func.count(Transaction.id).label('count'),
                func.sum(Transaction.amount).label('total')
            ).filter(
                Transaction.type == TransactionType.INCOME,
                Transaction.category == 'Tahsilat / Debt Collection',
                Transaction.is_deleted == 0
            )
            if start_date:
                transaction_stats = transaction_stats.filter(Transaction.created_at >= start_date)
            if end_date:
                transaction_stats = transaction_stats.filter(Transaction.created_at <= end_date)
            transaction_stats = transaction_stats.group_by(Transaction.payment_method).all()
            
            # Transaction tablosundan gelen tahsilat verilerini ekle
            for payment_method, count, total in transaction_stats:
                if payment_method:
                    # PaymentMethod enum'ından değeri al
                    if hasattr(payment_method, 'value'):
                        method = payment_method.value.upper().strip()
                    elif isinstance(payment_method, str):
                        method = payment_method.upper().strip()
                    else:
                        method = str(payment_method).upper().strip()
                    
                    if method in stats:
                        stats[method]["count"] += count or 0
                        stats[method]["total"] += float(total or 0)
        except Exception as e:
            # Transaction tablosunda payment_method sütunu yoksa veya başka bir hata varsa sessizce devam et
            import traceback
            print(f"[WARN] Transaction tablosundan tahsilat verileri alınırken hata (görmezden geliniyor): {str(e)}")
            print(traceback.format_exc())
        
        # Toplam hesapla
        total_count = sum(s["count"] for s in stats.values())
        total_amount = sum(s["total"] for s in stats.values())
        
        # Method label mapping
        method_labels = {
            "CASH": "Nakit Satış",
            "CARD": "Kredi Kartı",
            "TRANSFER": "Havale / EFT",
            "DEBT": "Veresiye / Açık Hesap",
        }
        
        # Yüzde hesapla ve sonuç oluştur
        result = []
        for key, value in stats.items():
            if key == "CREDIT":  # CREDIT'i atla, DEBT'e birleştirdik
                continue
            if value["count"] > 0 or value["total"] > 0:
                percentage = (value["total"] / total_amount * 100) if total_amount > 0 else 0
                result.append({
                    "method": key,
                    "label": method_labels.get(key, key),
                    "count": value["count"],
                    "total": round(value["total"], 2),
                    "percentage": round(percentage, 2)
                })
        
        return {
            "data": result,
            "summary": {
                "total_count": total_count,
                "total_amount": round(total_amount, 2)
            }
        }

        
        # SaleOrder tablosundan gelen verileri ekle
        for payment_method, count, total in sale_order_stats:
            if payment_method:
                # PaymentMethod enum'ından değeri al
                if hasattr(payment_method, 'value'):
                    method = payment_method.value.upper().strip()
                elif isinstance(payment_method, str):
                    method = payment_method.upper().strip()
                else:
                    method = str(payment_method).upper().strip()
                
                # CREDIT -> DEBT'e map et (aynı şey)
                if method == "CREDIT":
                    method = "DEBT"
                
                if method in stats:
                    stats[method]["count"] += count or 0
                    stats[method]["total"] += float(total or 0)
        
        # DEBT ve CREDIT'i birleştir (eğer ikisi de varsa)
        if stats["CREDIT"]["count"] > 0 or stats["CREDIT"]["total"] > 0:
            stats["DEBT"]["count"] += stats["CREDIT"]["count"]
            stats["DEBT"]["total"] += stats["CREDIT"]["total"]
            stats["CREDIT"] = {"count": 0, "total": 0.0}
        
        # Transaction tablosundan tahsilat verilerini ekle (category='Tahsilat / Debt Collection')
        try:
            from src.features.transactions.models import Transaction, TransactionType, PaymentMethod as TransactionPaymentMethod
            transaction_stats = self.db.query(
                Transaction.payment_method,
                func.count(Transaction.id).label('count'),
                func.sum(Transaction.amount).label('total')
            ).filter(
                Transaction.type == TransactionType.INCOME,
                Transaction.category == 'Tahsilat / Debt Collection',
                Transaction.is_deleted == 0
            )
            if start_date:
                transaction_stats = transaction_stats.filter(Transaction.created_at >= start_date)
            if end_date:
                transaction_stats = transaction_stats.filter(Transaction.created_at <= end_date)
            transaction_stats = transaction_stats.group_by(Transaction.payment_method).all()
            
            # Transaction tablosundan gelen tahsilat verilerini ekle
            for payment_method, count, total in transaction_stats:
                if payment_method:
                    # PaymentMethod enum'ından değeri al
                    if hasattr(payment_method, 'value'):
                        method = payment_method.value.upper().strip()
                    elif isinstance(payment_method, str):
                        method = payment_method.upper().strip()
                    else:
                        method = str(payment_method).upper().strip()
                    
                    if method in stats:
                        stats[method]["count"] += count or 0
                        stats[method]["total"] += float(total or 0)
        except Exception as e:
            # Transaction tablosunda payment_method sütunu yoksa veya başka bir hata varsa sessizce devam et
            import traceback
            print(f"[WARN] Transaction tablosundan tahsilat verileri alınırken hata (görmezden geliniyor): {str(e)}")
            print(traceback.format_exc())
        
        # Toplam hesapla
        total_count = sum(s["count"] for s in stats.values())
        total_amount = sum(s["total"] for s in stats.values())
        
        # Method label mapping
        method_labels = {
            "CASH": "Nakit Satış",
            "CARD": "Kredi Kartı",
            "TRANSFER": "Havale / EFT",
            "DEBT": "Veresiye / Açık Hesap",
        }
        
        # Yüzde hesapla ve sonuç oluştur
        result = []
        for key, value in stats.items():
            if key == "CREDIT":  # CREDIT'i atla, DEBT'e birleştirdik
                continue
            if value["count"] > 0 or value["total"] > 0:
                percentage = (value["total"] / total_amount * 100) if total_amount > 0 else 0
                result.append({
                    "method": key,
                    "label": method_labels.get(key, key),
                    "count": value["count"],
                    "total": round(value["total"], 2),
                    "percentage": round(percentage, 2)
                })
        
        return {
            "data": result,
            "summary": {
                "total_count": total_count,
                "total_amount": round(total_amount, 2)
            }
        }

        
        # SaleOrder tablosundan gelen verileri ekle
        for payment_method, count, total in sale_order_stats:
            if payment_method:
                # PaymentMethod enum'ından değeri al
                if hasattr(payment_method, 'value'):
                    method = payment_method.value.upper().strip()
                elif isinstance(payment_method, str):
                    method = payment_method.upper().strip()
                else:
                    method = str(payment_method).upper().strip()
                
                # CREDIT -> DEBT'e map et (aynı şey)
                if method == "CREDIT":
                    method = "DEBT"
                
                if method in stats:
                    stats[method]["count"] += count or 0
                    stats[method]["total"] += float(total or 0)
        
        # DEBT ve CREDIT'i birleştir (eğer ikisi de varsa)
        if stats["CREDIT"]["count"] > 0 or stats["CREDIT"]["total"] > 0:
            stats["DEBT"]["count"] += stats["CREDIT"]["count"]
            stats["DEBT"]["total"] += stats["CREDIT"]["total"]
            stats["CREDIT"] = {"count": 0, "total": 0.0}
        
        # Transaction tablosundan tahsilat verilerini ekle (category='Tahsilat / Debt Collection')
        try:
            from src.features.transactions.models import Transaction, TransactionType, PaymentMethod as TransactionPaymentMethod
            transaction_stats = self.db.query(
                Transaction.payment_method,
                func.count(Transaction.id).label('count'),
                func.sum(Transaction.amount).label('total')
            ).filter(
                Transaction.type == TransactionType.INCOME,
                Transaction.category == 'Tahsilat / Debt Collection',
                Transaction.is_deleted == 0
            )
            if start_date:
                transaction_stats = transaction_stats.filter(Transaction.created_at >= start_date)
            if end_date:
                transaction_stats = transaction_stats.filter(Transaction.created_at <= end_date)
            transaction_stats = transaction_stats.group_by(Transaction.payment_method).all()
            
            # Transaction tablosundan gelen tahsilat verilerini ekle
            for payment_method, count, total in transaction_stats:
                if payment_method:
                    # PaymentMethod enum'ından değeri al
                    if hasattr(payment_method, 'value'):
                        method = payment_method.value.upper().strip()
                    elif isinstance(payment_method, str):
                        method = payment_method.upper().strip()
                    else:
                        method = str(payment_method).upper().strip()
                    
                    if method in stats:
                        stats[method]["count"] += count or 0
                        stats[method]["total"] += float(total or 0)
        except Exception as e:
            # Transaction tablosunda payment_method sütunu yoksa veya başka bir hata varsa sessizce devam et
            import traceback
            print(f"[WARN] Transaction tablosundan tahsilat verileri alınırken hata (görmezden geliniyor): {str(e)}")
            print(traceback.format_exc())
        
        # Toplam hesapla
        total_count = sum(s["count"] for s in stats.values())
        total_amount = sum(s["total"] for s in stats.values())
        
        # Method label mapping
        method_labels = {
            "CASH": "Nakit Satış",
            "CARD": "Kredi Kartı",
            "TRANSFER": "Havale / EFT",
            "DEBT": "Veresiye / Açık Hesap",
        }
        
        # Yüzde hesapla ve sonuç oluştur
        result = []
        for key, value in stats.items():
            if key == "CREDIT":  # CREDIT'i atla, DEBT'e birleştirdik
                continue
            if value["count"] > 0 or value["total"] > 0:
                percentage = (value["total"] / total_amount * 100) if total_amount > 0 else 0
                result.append({
                    "method": key,
                    "label": method_labels.get(key, key),
                    "count": value["count"],
                    "total": round(value["total"], 2),
                    "percentage": round(percentage, 2)
                })
        
        return {
            "data": result,
            "summary": {
                "total_count": total_count,
                "total_amount": round(total_amount, 2)
            }
        }

        
        # SaleOrder tablosundan gelen verileri ekle
        for payment_method, count, total in sale_order_stats:
            if payment_method:
                # PaymentMethod enum'ından değeri al
                if hasattr(payment_method, 'value'):
                    method = payment_method.value.upper().strip()
                elif isinstance(payment_method, str):
                    method = payment_method.upper().strip()
                else:
                    method = str(payment_method).upper().strip()
                
                # CREDIT -> DEBT'e map et (aynı şey)
                if method == "CREDIT":
                    method = "DEBT"
                
                if method in stats:
                    stats[method]["count"] += count or 0
                    stats[method]["total"] += float(total or 0)
        
        # DEBT ve CREDIT'i birleştir (eğer ikisi de varsa)
        if stats["CREDIT"]["count"] > 0 or stats["CREDIT"]["total"] > 0:
            stats["DEBT"]["count"] += stats["CREDIT"]["count"]
            stats["DEBT"]["total"] += stats["CREDIT"]["total"]
            stats["CREDIT"] = {"count": 0, "total": 0.0}
        
        # Transaction tablosundan tahsilat verilerini ekle (category='Tahsilat / Debt Collection')
        try:
            from src.features.transactions.models import Transaction, TransactionType, PaymentMethod as TransactionPaymentMethod
            transaction_stats = self.db.query(
                Transaction.payment_method,
                func.count(Transaction.id).label('count'),
                func.sum(Transaction.amount).label('total')
            ).filter(
                Transaction.type == TransactionType.INCOME,
                Transaction.category == 'Tahsilat / Debt Collection',
                Transaction.is_deleted == 0
            )
            if start_date:
                transaction_stats = transaction_stats.filter(Transaction.created_at >= start_date)
            if end_date:
                transaction_stats = transaction_stats.filter(Transaction.created_at <= end_date)
            transaction_stats = transaction_stats.group_by(Transaction.payment_method).all()
            
            # Transaction tablosundan gelen tahsilat verilerini ekle
            for payment_method, count, total in transaction_stats:
                if payment_method:
                    # PaymentMethod enum'ından değeri al
                    if hasattr(payment_method, 'value'):
                        method = payment_method.value.upper().strip()
                    elif isinstance(payment_method, str):
                        method = payment_method.upper().strip()
                    else:
                        method = str(payment_method).upper().strip()
                    
                    if method in stats:
                        stats[method]["count"] += count or 0
                        stats[method]["total"] += float(total or 0)
        except Exception as e:
            # Transaction tablosunda payment_method sütunu yoksa veya başka bir hata varsa sessizce devam et
            import traceback
            print(f"[WARN] Transaction tablosundan tahsilat verileri alınırken hata (görmezden geliniyor): {str(e)}")
            print(traceback.format_exc())
        
        # Toplam hesapla
        total_count = sum(s["count"] for s in stats.values())
        total_amount = sum(s["total"] for s in stats.values())
        
        # Method label mapping
        method_labels = {
            "CASH": "Nakit Satış",
            "CARD": "Kredi Kartı",
            "TRANSFER": "Havale / EFT",
            "DEBT": "Veresiye / Açık Hesap",
        }
        
        # Yüzde hesapla ve sonuç oluştur
        result = []
        for key, value in stats.items():
            if key == "CREDIT":  # CREDIT'i atla, DEBT'e birleştirdik
                continue
            if value["count"] > 0 or value["total"] > 0:
                percentage = (value["total"] / total_amount * 100) if total_amount > 0 else 0
                result.append({
                    "method": key,
                    "label": method_labels.get(key, key),
                    "count": value["count"],
                    "total": round(value["total"], 2),
                    "percentage": round(percentage, 2)
                })
        
        return {
            "data": result,
            "summary": {
                "total_count": total_count,
                "total_amount": round(total_amount, 2)
            }
        }
