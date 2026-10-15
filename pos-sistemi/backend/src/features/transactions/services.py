"""
Transactions Services
Kasa Hareketleri - İş Mantığı
"""

from typing import List, Optional, Dict
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract

from src.features.transactions.models import Transaction, TransactionType, PaymentMethod, TransactionSource
from src.features.transactions.schemas import TransactionCreate
from src.features.system.models import SystemLog
from src.shared.utils.currency import round_money, to_decimal
from src.features.sales.services import get_sale_order_effective_amount_column


class TransactionService:
    """Transaction Service - Gider Girişi ve İşlem Mantığı"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def add_expense(self, amount: float, category: str, description: str, user_id: str, payment_source: str = 'CASH', payment_method: Optional[str] = None, supplier_id: Optional[str] = None) -> Transaction:
        """
        GİDER GİRİŞİ - Senaryo: Gider girildiğinde
        
        1. Transaction tablosuna "EXPENSE" kaydı at
        2. SystemLog tablosuna "X Kullanıcısı kasadan para aldı" yaz
        3. supplier_id varsa tedarikçi bakiyesini güncelle (M2 Fix)
        """
        try:
            payment_method_enum = None
            if payment_method:
                try:
                    payment_method_enum = PaymentMethod(payment_method.upper())
                except ValueError:
                    payment_method_enum = None
            
            if payment_method_enum:
                if payment_method_enum == PaymentMethod.CASH:
                    final_payment_source = 'CASH'
                elif payment_method_enum in [PaymentMethod.CARD, PaymentMethod.TRANSFER]:
                    final_payment_source = 'BANK'
                else:
                    final_payment_source = payment_source
            else:
                final_payment_source = payment_source
            
            # 1. Transaction tablosuna "EXPENSE" kaydı at
            transaction = Transaction(
                type=TransactionType.EXPENSE,
                category=category,
                amount=amount,
                description=description,
                user_id=user_id,
                payment_source=final_payment_source,
                payment_method=payment_method_enum,
                source=TransactionSource.MANUAL,
                reference_id=supplier_id,
            )
            self.db.add(transaction)

            # Tedarikçi ödemesi ise tedarikçi bakiyesini düşür (M2 Fix)
            if supplier_id:
                from src.features.suppliers.models import Supplier
                supplier = self.db.query(Supplier).filter(Supplier.id == supplier_id).first()
                if supplier:
                    supplier.balance -= amount
            
            # 2. SystemLog tablosuna kayıt at
            from src.features.auth.models import User
            user = self.db.query(User).filter(User.id == user_id).first()
            user_name = user.full_name if user else "Bilinmeyen"
            
            system_log = SystemLog(
                user_id=user_id,
                action_type="EXPENSE",
                details=f"{user_name} kasadan {amount:.2f} TL aldı - {category}: {description}"
            )
            self.db.add(system_log)
            
            self.db.commit()
            self.db.refresh(transaction)
            
            return transaction
            
        except Exception as e:
            self.db.rollback()
            raise e
    
    def add_income(self, amount: float, category: str, description: str, user_id: str, payment_source: str = 'CASH', payment_method: Optional[str] = None, customer_id: Optional[str] = None, sale_order_id: Optional[str] = None) -> Transaction:
        """
        GELİR GİRİŞİ - Senaryo: Gelir girildiğinde (Tahsilat vb.)
        
        1. Transaction tablosuna "INCOME" kaydı at
        2. SystemLog tablosuna "X Kullanıcısı kasaya para ekledi" yaz
        3. Müşteri bakiyesini güncelle (customer_id veya sale_order_id üzerinden)
        """
        try:
            # payment_method'u enum'a çevir
            payment_method_enum = None
            if payment_method:
                try:
                    payment_method_enum = PaymentMethod(payment_method.upper())
                except ValueError:
                    # Geçersiz değer ise None bırak
                    payment_method_enum = None
            
            # payment_method'a göre payment_source'u otomatik belirle (eğer belirtilmemişse)
            if payment_method_enum:
                if payment_method_enum == PaymentMethod.CASH:
                    final_payment_source = 'CASH'
                elif payment_method_enum in [PaymentMethod.CARD, PaymentMethod.TRANSFER]:
                    final_payment_source = 'BANK'
                else:
                    final_payment_source = payment_source
            else:
                final_payment_source = payment_source
            
            # 1. Transaction tablosuna "INCOME" kaydı at
            transaction = Transaction(
                type=TransactionType.INCOME,
                category=category,
                amount=amount,
                description=description,
                user_id=user_id,
                payment_source=final_payment_source,
                payment_method=payment_method_enum,
                source=TransactionSource.MANUAL,
            )
            self.db.add(transaction)
            
            # 2. SystemLog tablosuna kayıt at
            from src.features.auth.models import User
            user = self.db.query(User).filter(User.id == user_id).first()
            user_name = user.full_name if user else "Bilinmeyen"
            
            system_log = SystemLog(
                user_id=user_id,
                action_type="INCOME",
                details=f"{user_name} kasaya {amount:.2f} TL ekledi - {category}: {description}"
            )
            self.db.add(system_log)
            
            
            # 3. Müşteri bakiyesini güncelle (BORÇ ÖDEME)
            # Önce customer_id'yi çöz (sale_order_id veya direkt customer_id)
            resolved_customer_id = customer_id
            if not resolved_customer_id and sale_order_id:
                # SaleOrder üzerinden müşteriyi bul
                try:
                    from src.features.sales.models import SaleOrder
                    sale_order = self.db.query(SaleOrder).filter(SaleOrder.id == sale_order_id).first()
                    if sale_order and sale_order.customer_id:
                        resolved_customer_id = str(sale_order.customer_id)
                except Exception:
                    pass

            if resolved_customer_id:
                transaction.reference_id = resolved_customer_id
                from src.features.customers.models import Customer
                customer = self.db.query(Customer).filter(Customer.id == resolved_customer_id).first()
                if customer:
                    customer.balance -= amount
                    # Bakiyeyi sıfırın altına düşürme (negatif bakiye iş mantığına göre hata olabilir)
                    # customer.balance = max(0.0, customer.balance)
            
            self.db.commit()
            self.db.refresh(transaction)
            
            return transaction
            
        except Exception as e:
            self.db.rollback()
            raise e
    
    def get_all(self, include_deleted: bool = False) -> List[Transaction]:
        """Tüm işlemleri getir"""
        query = self.db.query(Transaction)
        if not include_deleted:
            query = query.filter(Transaction.is_deleted == False)
        return query.order_by(Transaction.created_at.desc()).all()
    
    def get_by_id(self, transaction_id: str) -> Optional[Transaction]:
        """ID'ye göre işlem getir"""
        return self.db.query(Transaction).filter(
            Transaction.id == transaction_id,
            Transaction.is_deleted == False
        ).first()
    
    def get_balance(self, include_transfers: bool = False, payment_source: Optional[str] = None) -> float:
        """Bakiye (Gelir - Gider)

        Notlar:
        - include_transfers=False ise 'Virman' işlemleri (CASH<->BANK transfer) raporlara dahil edilmez.
        - payment_source verildiyse sadece ilgili kaynağa (CASH/BANK) göre filtrelenir.
        """
        base_filters = [Transaction.is_deleted == False]
        if payment_source:
            base_filters.append(Transaction.payment_source == payment_source)
        if not include_transfers:
            base_filters.append(Transaction.category.notin_(['Virman', 'Veresiye Satış']))

        income = (
            self.db.query(Transaction)
            .filter(*(base_filters + [Transaction.type == TransactionType.INCOME]))
            .with_entities(func.sum(Transaction.amount))
            .scalar()
            or 0.0
        )

        expense = (
            self.db.query(Transaction)
            .filter(*(base_filters + [Transaction.type == TransactionType.EXPENSE]))
            .with_entities(func.sum(Transaction.amount))
            .scalar()
            or 0.0
        )

        return float(income) - float(expense)
    
    def get_daily_summary(
        self,
        date: Optional[datetime] = None,
        include_transfers: bool = False,
        payment_source: Optional[str] = None,
    ) -> Dict:
        """Günlük özet"""
        if date is None:
            date = datetime.now()
        
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = date.replace(hour=23, minute=59, second=59, microsecond=999999)

        from src.features.sales.models import SaleOrder, OrderStatus as SalesOrderStatus, PaymentMethod as SalesPaymentMethod
        from src.features.orders.models import Order

        effective_pos_amt = get_sale_order_effective_amount_column()
        pos_rev_q = self.db.query(func.coalesce(func.sum(effective_pos_amt), 0.0)).filter(
            SaleOrder.is_deleted == False,
            SaleOrder.status == SalesOrderStatus.COMPLETED,
            SaleOrder.created_at >= start_of_day,
            SaleOrder.created_at <= end_of_day,
        )
        if payment_source:
            if payment_source == 'CASH':
                pos_rev_q = pos_rev_q.filter(SaleOrder.payment_method == SalesPaymentMethod.CASH)
            elif payment_source == 'BANK':
                pos_rev_q = pos_rev_q.filter(SaleOrder.payment_method.in_([SalesPaymentMethod.CARD, SalesPaymentMethod.TRANSFER]))
        pos_rev = float(pos_rev_q.scalar() or 0.0)

        order_rev_q = self.db.query(func.coalesce(func.sum(Order.final_amount), 0.0)).filter(
            Order.is_deleted == False,
            Order.status == 'completed',
            Order.created_at >= start_of_day,
            Order.created_at <= end_of_day,
        )
        if payment_source:
            if payment_source == 'CASH':
                order_rev_q = order_rev_q.filter(Order.payment_method == 'CASH')
            elif payment_source == 'BANK':
                order_rev_q = order_rev_q.filter(Order.payment_method.in_(['CARD', 'TRANSFER']))
        order_rev = float(order_rev_q.scalar() or 0.0)

        daily_income = round_money(pos_rev + order_rev)
        
        # Günlük gider (Virman hariç)
        exp_filters = [
            Transaction.is_deleted == False,
            Transaction.created_at >= start_of_day,
            Transaction.created_at <= end_of_day,
            Transaction.type == TransactionType.EXPENSE,
            func.lower(func.coalesce(Transaction.category, '')).notin_(['virman', 'transfer']),
        ]
        if payment_source:
            exp_filters.append(Transaction.payment_source == payment_source)
        daily_expense = round_money(self.db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(and_(*exp_filters)).scalar() or 0.0)
        
        # Günlük işlem sayısı
        income_count = self.db.query(Transaction).filter(
            and_(
                *base_filters,
                Transaction.type == TransactionType.INCOME,
            )
        ).count()
        
        expense_count = self.db.query(Transaction).filter(
            and_(
                *base_filters,
                Transaction.type == TransactionType.EXPENSE,
            )
        ).count()
        
        return {
            "date": date.strftime("%Y-%m-%d"),
            "income": float(daily_income),
            "expense": float(daily_expense),
            "net": float(daily_income - daily_expense),
            "income_count": income_count,
            "expense_count": expense_count,
            "total_count": income_count + expense_count
        }
    
    def get_category_statistics(
        self,
        days: int = 30,
        include_transfers: bool = False,
        payment_source: Optional[str] = None,
    ) -> Dict:
        """Kategori bazlı istatistikler"""
        start_date = datetime.now() - timedelta(days=days)

        base_filters = [
            Transaction.is_deleted == False,
            Transaction.created_at >= start_date,
        ]
        if payment_source:
            base_filters.append(Transaction.payment_source == payment_source)
        if not include_transfers:
            base_filters.append(Transaction.category.notin_(['Virman', 'Veresiye Satış']))
        
        # Gider kategorileri
        expense_by_category = self.db.query(
            Transaction.category,
            func.sum(Transaction.amount).label('total')
        ).filter(
            and_(
                *base_filters,
                Transaction.type == TransactionType.EXPENSE,
            )
        ).group_by(Transaction.category).all()
        
        # Gelir kategorileri
        income_by_category = self.db.query(
            Transaction.category,
            func.sum(Transaction.amount).label('total')
        ).filter(
            and_(
                *base_filters,
                Transaction.type == TransactionType.INCOME,
            )
        ).group_by(Transaction.category).all()
        
        return {
            "expenses": [{"category": cat or "Diğer", "amount": float(total)} for cat, total in expense_by_category],
            "incomes": [{"category": cat or "Diğer", "amount": float(total)} for cat, total in income_by_category]
        }
    
    def get_weekly_trend(
        self,
        weeks: int = 4,
        include_transfers: bool = False,
        payment_source: Optional[str] = None,
    ) -> List[Dict]:
        """Haftalık trend verisi"""
        end_date = datetime.now()
        start_date = end_date - timedelta(weeks=weeks)

        base_filters = [
            Transaction.is_deleted == False,
            Transaction.created_at >= start_date,
        ]
        if payment_source:
            base_filters.append(Transaction.payment_source == payment_source)
        if not include_transfers:
            base_filters.append(Transaction.category.notin_(['Virman', 'Veresiye Satış']))
        
        # Haftalık gruplama
        weekly_data = self.db.query(
            extract('year', Transaction.created_at).label('year'),
            extract('week', Transaction.created_at).label('week'),
            Transaction.type,
            func.sum(Transaction.amount).label('total')
        ).filter(
            and_(*base_filters)
        ).group_by(
            extract('year', Transaction.created_at),
            extract('week', Transaction.created_at),
            Transaction.type
        ).all()
        
        # Haftalık veriyi organize et
        result = {}
        for year, week, trans_type, total in weekly_data:
            key = f"{int(year)}-W{int(week):02d}"
            if key not in result:
                result[key] = {"week": key, "income": 0.0, "expense": 0.0}
            
            if trans_type == TransactionType.INCOME:
                result[key]["income"] = float(total)
            else:
                result[key]["expense"] = float(total)
        
        return sorted([v for v in result.values()], key=lambda x: x["week"])
    
    def get_daily_trend(
        self,
        days: int = 7,
        include_transfers: bool = False,
        payment_source: Optional[str] = None,
    ) -> List[Dict]:
        """
        Günlük trend verisi (Single Source of Truth - Issue H3)
        - Gelir (Ciro): SaleOrder (POS) + Order (Online) + Bağımsız Ek Gelirler (Tahsilat ve Virman HARIÇ)
        - Maliyet (COGS): SaleOrderItem (unit_cost * qty) + OrderItem (unit_buy_price * qty)
        - Giderler (OpEx): Transaction EXPENSE (Virman HARIÇ)
        - Kâr: Gelir - Maliyet - Giderler
        """
        from src.features.sales.models import SaleOrder, SaleOrderItem, OrderStatus as SalesOrderStatus, PaymentMethod as SalesPaymentMethod
        from src.features.orders.models import Order, OrderItem

        end_date = datetime.now()
        start_date = (end_date - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

        # 1. POS Satış Geliri (SaleOrder)
        effective_pos_amt = get_sale_order_effective_amount_column()
        pos_rev_q = self.db.query(
            func.date(SaleOrder.created_at).label('date'),
            func.coalesce(func.sum(effective_pos_amt), 0.0).label('total')
        ).filter(
            and_(
                SaleOrder.is_deleted == False,
                SaleOrder.created_at >= start_date,
                SaleOrder.status == SalesOrderStatus.COMPLETED
            )
        )
        if payment_source:
            if payment_source == 'CASH':
                pos_rev_q = pos_rev_q.filter(SaleOrder.payment_method == SalesPaymentMethod.CASH)
            elif payment_source == 'BANK':
                pos_rev_q = pos_rev_q.filter(SaleOrder.payment_method.in_([SalesPaymentMethod.CARD, SalesPaymentMethod.TRANSFER]))
        pos_rev_data = pos_rev_q.group_by(func.date(SaleOrder.created_at)).all()

        # 2. Online / Legacy Sipariş Geliri (Order)
        order_rev_q = self.db.query(
            func.date(Order.created_at).label('date'),
            func.coalesce(func.sum(Order.final_amount), 0.0).label('total')
        ).filter(
            and_(
                Order.is_deleted == False,
                Order.created_at >= start_date,
                Order.status == 'completed'
            )
        )
        if payment_source:
            if payment_source == 'CASH':
                order_rev_q = order_rev_q.filter(Order.payment_method == 'CASH')
            elif payment_source == 'BANK':
                order_rev_q = order_rev_q.filter(Order.payment_method.in_(['CARD', 'TRANSFER']))
        order_rev_data = order_rev_q.group_by(func.date(Order.created_at)).all()

        # 3. POS Satılan Malın Maliyeti (SaleOrderItem)
        pos_cost_q = self.db.query(
            func.date(SaleOrder.created_at).label('date'),
            func.coalesce(func.sum(SaleOrderItem.quantity * func.coalesce(SaleOrderItem.unit_cost, 0.0)), 0.0).label('total_cost')
        ).join(
            SaleOrderItem, SaleOrder.id == SaleOrderItem.order_id
        ).filter(
            and_(
                SaleOrder.is_deleted == False,
                SaleOrder.created_at >= start_date,
                SaleOrder.status == SalesOrderStatus.COMPLETED
            )
        )
        if payment_source:
            if payment_source == 'CASH':
                pos_cost_q = pos_cost_q.filter(SaleOrder.payment_method == SalesPaymentMethod.CASH)
            elif payment_source == 'BANK':
                pos_cost_q = pos_cost_q.filter(SaleOrder.payment_method.in_([SalesPaymentMethod.CARD, SalesPaymentMethod.TRANSFER]))
        pos_cost_data = pos_cost_q.group_by(func.date(SaleOrder.created_at)).all()

        # 4. Online Sipariş Maliyeti (OrderItem)
        order_cost_q = self.db.query(
            func.date(Order.created_at).label('date'),
            func.coalesce(func.sum(OrderItem.quantity * func.coalesce(OrderItem.unit_buy_price, 0.0)), 0.0).label('total_cost')
        ).join(
            OrderItem, Order.id == OrderItem.order_id
        ).filter(
            and_(
                Order.is_deleted == False,
                Order.created_at >= start_date,
                Order.status == 'completed'
            )
        )
        if payment_source:
            if payment_source == 'CASH':
                order_cost_q = order_cost_q.filter(Order.payment_method == 'CASH')
            elif payment_source == 'BANK':
                order_cost_q = order_cost_q.filter(Order.payment_method.in_(['CARD', 'TRANSFER']))
        order_cost_data = order_cost_q.group_by(func.date(Order.created_at)).all()

        # 5. İşletme Giderleri (Transaction EXPENSE - Virman HARIÇ)
        expense_filters = [
            Transaction.is_deleted == False,
            Transaction.created_at >= start_date,
            Transaction.type == TransactionType.EXPENSE,
            func.lower(func.coalesce(Transaction.category, '')).notin_(['virman', 'transfer']),
        ]
        if payment_source:
            expense_filters.append(Transaction.payment_source == payment_source)

        expense_data = self.db.query(
            func.date(Transaction.created_at).label('date'),
            func.coalesce(func.sum(Transaction.amount), 0.0).label('total_expense')
        ).filter(
            and_(*expense_filters)
        ).group_by(func.date(Transaction.created_at)).all()

        # 6. Bağımsız Manuel Gelirler (Transaction INCOME - Satış/Tahsilat/Virman HARIÇ)
        excluded_cats = [
            'virman', 'transfer',
            'tahsilat', 'cari tahsilat', 'tahsilat / debt collection', 'borç tahsilatı', 'müşteri tahsilatı', 'cek tahsilati',
            'satış geliri', 'satış geliri (nakit)', 'satış geliri (kart)', 'satış geliri (havale)', 'veresiye satış', 'veresiye',
            'online satış geliri', 'fatura geliri', 'invoice payment'
        ]
        manual_inc_filters = [
            Transaction.is_deleted == False,
            Transaction.created_at >= start_date,
            Transaction.type == TransactionType.INCOME,
            Transaction.reference_id.is_(None),
            Transaction.related_order_id.is_(None),
            func.lower(func.coalesce(Transaction.category, '')).notin_(excluded_cats),
        ]
        if payment_source:
            manual_inc_filters.append(Transaction.payment_source == payment_source)

        manual_inc_data = self.db.query(
            func.date(Transaction.created_at).label('date'),
            func.coalesce(func.sum(Transaction.amount), 0.0).label('total')
        ).filter(
            and_(*manual_inc_filters)
        ).group_by(func.date(Transaction.created_at)).all()

        # Günlük slotları hazırla
        result = {}
        for i in range(days):
            d = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
            result[d] = {"date": d, "income": 0.0, "expense": 0.0, "cost": 0.0, "gross_profit": 0.0, "profit": 0.0}

        for date_str, total in pos_rev_data:
            d_key = str(date_str)
            if d_key in result:
                result[d_key]["income"] += float(total or 0.0)

        for date_str, total in order_rev_data:
            d_key = str(date_str)
            if d_key in result:
                result[d_key]["income"] += float(total or 0.0)

        for date_str, total in manual_inc_data:
            d_key = str(date_str)
            if d_key in result:
                result[d_key]["income"] += float(total or 0.0)

        for date_str, total in pos_cost_data:
            d_key = str(date_str)
            if d_key in result:
                result[d_key]["cost"] += float(total or 0.0)

        for date_str, total in order_cost_data:
            d_key = str(date_str)
            if d_key in result:
                result[d_key]["cost"] += float(total or 0.0)

        for date_str, total in expense_data:
            d_key = str(date_str)
            if d_key in result:
                result[d_key]["expense"] += float(total or 0.0)

        for k, v in result.items():
            v["income"] = round_money(v["income"])
            v["cost"] = round_money(v["cost"])
            v["expense"] = round_money(v["expense"])
            v["gross_profit"] = round_money(v["income"] - v["cost"])
            v["profit"] = round_money(v["income"] - v["cost"] - v["expense"])

        return sorted([v for v in result.values()], key=lambda x: x["date"])

    def get_monthly_trend(
        self,
        months: int = 6,
        include_transfers: bool = False,
        payment_source: Optional[str] = None,
    ) -> List[Dict]:
        """
        Aylık trend verisi (Single Source of Truth - Issue H3)
        - Gelir (Ciro): SaleOrder (POS) + Order (Online) + Bağımsız Ek Gelirler (Tahsilat ve Virman HARIÇ)
        - Maliyet (COGS): SaleOrderItem (unit_cost * qty) + OrderItem (unit_buy_price * qty)
        - Giderler (OpEx): Transaction EXPENSE (Virman HARIÇ)
        - Brüt Kâr: Ciro - Maliyet
        - Net Kâr: Brüt Kâr - Giderler
        """
        from src.features.sales.models import SaleOrder, SaleOrderItem, OrderStatus as SalesOrderStatus, PaymentMethod as SalesPaymentMethod
        from src.features.orders.models import Order, OrderItem

        end_date = datetime.now()
        start_date = end_date - timedelta(days=months * 30)

        # 1. POS Satış Geliri (SaleOrder)
        effective_pos_amt = get_sale_order_effective_amount_column()
        pos_rev_q = self.db.query(
            extract('year', SaleOrder.created_at).label('year'),
            extract('month', SaleOrder.created_at).label('month'),
            func.coalesce(func.sum(effective_pos_amt), 0.0).label('total')
        ).filter(
            and_(
                SaleOrder.is_deleted == False,
                SaleOrder.created_at >= start_date,
                SaleOrder.status == SalesOrderStatus.COMPLETED
            )
        )
        if payment_source:
            if payment_source == 'CASH':
                pos_rev_q = pos_rev_q.filter(SaleOrder.payment_method == SalesPaymentMethod.CASH)
            elif payment_source == 'BANK':
                pos_rev_q = pos_rev_q.filter(SaleOrder.payment_method.in_([SalesPaymentMethod.CARD, SalesPaymentMethod.TRANSFER]))
        pos_rev_data = pos_rev_q.group_by(
            extract('year', SaleOrder.created_at),
            extract('month', SaleOrder.created_at)
        ).all()

        # 2. Online / Legacy Sipariş Geliri (Order)
        order_rev_q = self.db.query(
            extract('year', Order.created_at).label('year'),
            extract('month', Order.created_at).label('month'),
            func.coalesce(func.sum(Order.final_amount), 0.0).label('total')
        ).filter(
            and_(
                Order.is_deleted == False,
                Order.created_at >= start_date,
                Order.status == 'completed'
            )
        )
        if payment_source:
            if payment_source == 'CASH':
                order_rev_q = order_rev_q.filter(Order.payment_method == 'CASH')
            elif payment_source == 'BANK':
                order_rev_q = order_rev_q.filter(Order.payment_method.in_(['CARD', 'TRANSFER']))
        order_rev_data = order_rev_q.group_by(
            extract('year', Order.created_at),
            extract('month', Order.created_at)
        ).all()

        # 3. POS Satılan Malın Maliyeti (SaleOrderItem)
        pos_cost_q = self.db.query(
            extract('year', SaleOrder.created_at).label('year'),
            extract('month', SaleOrder.created_at).label('month'),
            func.coalesce(func.sum(SaleOrderItem.quantity * func.coalesce(SaleOrderItem.unit_cost, 0.0)), 0.0).label('total_cost')
        ).join(
            SaleOrderItem, SaleOrder.id == SaleOrderItem.order_id
        ).filter(
            and_(
                SaleOrder.is_deleted == False,
                SaleOrder.created_at >= start_date,
                SaleOrder.status == SalesOrderStatus.COMPLETED
            )
        )
        if payment_source:
            if payment_source == 'CASH':
                pos_cost_q = pos_cost_q.filter(SaleOrder.payment_method == SalesPaymentMethod.CASH)
            elif payment_source == 'BANK':
                pos_cost_q = pos_cost_q.filter(SaleOrder.payment_method.in_([SalesPaymentMethod.CARD, SalesPaymentMethod.TRANSFER]))
        pos_cost_data = pos_cost_q.group_by(
            extract('year', SaleOrder.created_at),
            extract('month', SaleOrder.created_at)
        ).all()

        # 4. Online Sipariş Maliyeti (OrderItem)
        order_cost_q = self.db.query(
            extract('year', Order.created_at).label('year'),
            extract('month', Order.created_at).label('month'),
            func.coalesce(func.sum(OrderItem.quantity * func.coalesce(OrderItem.unit_buy_price, 0.0)), 0.0).label('total_cost')
        ).join(
            OrderItem, Order.id == OrderItem.order_id
        ).filter(
            and_(
                Order.is_deleted == False,
                Order.created_at >= start_date,
                Order.status == 'completed'
            )
        )
        if payment_source:
            if payment_source == 'CASH':
                order_cost_q = order_cost_q.filter(Order.payment_method == 'CASH')
            elif payment_source == 'BANK':
                order_cost_q = order_cost_q.filter(Order.payment_method.in_(['CARD', 'TRANSFER']))
        order_cost_data = order_cost_q.group_by(
            extract('year', Order.created_at),
            extract('month', Order.created_at)
        ).all()

        # 5. İşletme Giderleri (Transaction EXPENSE - Virman HARIÇ)
        expense_filters = [
            Transaction.is_deleted == False,
            Transaction.created_at >= start_date,
            Transaction.type == TransactionType.EXPENSE,
            func.lower(func.coalesce(Transaction.category, '')).notin_(['virman', 'transfer']),
        ]
        if payment_source:
            expense_filters.append(Transaction.payment_source == payment_source)

        expense_data = self.db.query(
            extract('year', Transaction.created_at).label('year'),
            extract('month', Transaction.created_at).label('month'),
            func.coalesce(func.sum(Transaction.amount), 0.0).label('total_expense')
        ).filter(
            and_(*expense_filters)
        ).group_by(
            extract('year', Transaction.created_at),
            extract('month', Transaction.created_at)
        ).all()

        # 6. Bağımsız Manuel Gelirler (Transaction INCOME - Satış/Tahsilat/Virman HARIÇ)
        excluded_cats = [
            'virman', 'transfer',
            'tahsilat', 'cari tahsilat', 'tahsilat / debt collection', 'borç tahsilatı', 'müşteri tahsilatı', 'cek tahsilati',
            'satış geliri', 'satış geliri (nakit)', 'satış geliri (kart)', 'satış geliri (havale)', 'veresiye satış', 'veresiye',
            'online satış geliri', 'fatura geliri', 'invoice payment'
        ]
        manual_inc_filters = [
            Transaction.is_deleted == False,
            Transaction.created_at >= start_date,
            Transaction.type == TransactionType.INCOME,
            Transaction.reference_id.is_(None),
            Transaction.related_order_id.is_(None),
            func.lower(func.coalesce(Transaction.category, '')).notin_(excluded_cats),
        ]
        if payment_source:
            manual_inc_filters.append(Transaction.payment_source == payment_source)

        manual_inc_data = self.db.query(
            extract('year', Transaction.created_at).label('year'),
            extract('month', Transaction.created_at).label('month'),
            func.coalesce(func.sum(Transaction.amount), 0.0).label('total')
        ).filter(
            and_(*manual_inc_filters)
        ).group_by(
            extract('year', Transaction.created_at),
            extract('month', Transaction.created_at)
        ).all()

        # Aylık veriyi organize et
        month_names = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                      "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
        
        result = {}
        def get_bucket(year, month):
            key = f"{int(year)}-{int(month):02d}"
            if key not in result:
                label = f"{month_names[int(month)]} {int(year)}"
                result[key] = {
                    "month": label,
                    "income": 0.0,
                    "expense": 0.0,
                    "cost": 0.0,
                    "gross_profit": 0.0,
                    "net_profit": 0.0
                }
            return result[key]

        for year, month, total in pos_rev_data:
            get_bucket(year, month)["income"] += float(total or 0.0)

        for year, month, total in order_rev_data:
            get_bucket(year, month)["income"] += float(total or 0.0)

        for year, month, total in manual_inc_data:
            get_bucket(year, month)["income"] += float(total or 0.0)

        for year, month, total in pos_cost_data:
            get_bucket(year, month)["cost"] += float(total or 0.0)

        for year, month, total in order_cost_data:
            get_bucket(year, month)["cost"] += float(total or 0.0)

        for year, month, total in expense_data:
            get_bucket(year, month)["expense"] += float(total or 0.0)

        for k, b in result.items():
            b["income"] = round_money(b["income"])
            b["cost"] = round_money(b["cost"])
            b["expense"] = round_money(b["expense"])
            b["gross_profit"] = round_money(b["income"] - b["cost"])
            b["net_profit"] = round_money(b["gross_profit"] - b["expense"])

        return [result[k] for k in sorted(result.keys())]
    
    def delete(self, transaction_id: str) -> bool:
        """Transaction'ı sil (soft delete) ve cari bakiyeyi geri al (C3 Fix)"""
        transaction = self.get_by_id(transaction_id)
        if not transaction:
            return False
        
        try:
            # 1. Müşteri Tahsilatını geri al (Tahsilat silindiyse müşterinin borcu geri artar)
            if transaction.type == TransactionType.INCOME and transaction.reference_id:
                from src.features.customers.models import Customer
                customer = self.db.query(Customer).filter(Customer.id == transaction.reference_id).first()
                if customer:
                    customer.balance += transaction.amount

            # 2. Tedarikçi Ödemesini geri al (Tedarikçi ödemesi silindiyse tedarikçiye olan borcumuz geri artar)
            elif transaction.type == TransactionType.EXPENSE and transaction.reference_id:
                from src.features.suppliers.models import Supplier
                supplier = self.db.query(Supplier).filter(Supplier.id == transaction.reference_id).first()
                if supplier:
                    supplier.balance += transaction.amount

            transaction.is_deleted = True
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            raise e
    
    def transfer(self, amount: float, from_source: str, to_source: str, description: str, user_id: str) -> tuple[Transaction, Transaction]:
        """
        VİRMAN İŞLEMİ - Banka ve Kasa arası para transferi
        
        1. Kaynak hesaptan EXPENSE transaction oluştur
        2. Hedef hesaba INCOME transaction oluştur
        3. SystemLog tablosuna kayıt at
        """
        try:
            if from_source == to_source:
                raise ValueError("Kaynak ve hedef aynı olamaz")
            
            if from_source not in ['CASH', 'BANK'] or to_source not in ['CASH', 'BANK']:
                raise ValueError("Kaynak ve hedef 'CASH' veya 'BANK' olmalıdır")
            
            # 1. Kaynak hesaptan EXPENSE transaction
            expense_transaction = Transaction(
                type=TransactionType.EXPENSE,
                category='Virman',
                amount=amount,
                description=f"Virman: {from_source} → {to_source}" + (f" - {description}" if description else ""),
                user_id=user_id,
                payment_source=from_source
            )
            self.db.add(expense_transaction)
            
            # 2. Hedef hesaba INCOME transaction
            income_transaction = Transaction(
                type=TransactionType.INCOME,
                category='Virman',
                amount=amount,
                description=f"Virman: {from_source} → {to_source}" + (f" - {description}" if description else ""),
                user_id=user_id,
                payment_source=to_source
            )
            self.db.add(income_transaction)
            
            # 3. SystemLog tablosuna kayıt at
            from src.features.auth.models import User
            user = self.db.query(User).filter(User.id == user_id).first()
            user_name = user.full_name if user else "Bilinmeyen"
            
            from_source_tr = "Nakit Kasa" if from_source == 'CASH' else "Banka"
            to_source_tr = "Nakit Kasa" if to_source == 'CASH' else "Banka"
            
            system_log = SystemLog(
                user_id=user_id,
                action_type="TRANSFER",
                details=f"{user_name} {amount:.2f} TL virman yaptı: {from_source_tr} → {to_source_tr}" + (f" - {description}" if description else "")
            )
            self.db.add(system_log)
            
            self.db.commit()
            self.db.refresh(expense_transaction)
            self.db.refresh(income_transaction)
            
            return expense_transaction, income_transaction
            
        except Exception as e:
            self.db.rollback()
            raise e

    def refund_sale(self, transaction_id: str, user_id: str) -> Dict:
        """
        Satış iadesi (Finance ekranından)

        Desteklenen senaryolar:
        1) Order tablosuna bağlı satış (orders/services.py):
           - Transaction.related_order_id dolu (orders.id)
        2) SaleOrder tablosuna bağlı POS satış (sales/services.py):
           - Transaction.source == POS
           - Transaction.reference_id (sale_orders.id) veya description içinde order_number ("Satış S-...")

        İade ile:
          - Satışın ürünleri stoğa geri eklenir (StockMovement: RETURN)
          - Satış ve ilgili transaction(lar) soft-delete edilir (is_deleted = True)
          - SaleOrder durumu REFUNDED yapılır (is_deleted = False kalır)
          - (Veresiye/borç ise) müşteri bakiyesinden düşülür
          - SystemLog kaydı oluşturulur
        """
        try:
            from src.features.inventory.models import Product
            from src.features.inventory.stock_movement import StockMovement, StockMovementReason
            from src.features.system.models import SystemLog
            from src.features.auth.models import User

            tx = self.db.query(Transaction).filter(
                Transaction.id == transaction_id,
                Transaction.is_deleted == False
            ).first()
            if not tx:
                raise ValueError(f"İşlem bulunamadı: {transaction_id}")

            if tx.type != TransactionType.INCOME:
                raise ValueError("Bu işlem satış iadesi için uygun değil.")

            # ------------------------------------------------------------
            # 1) Eski Order (orders) üzerinden iade
            # ------------------------------------------------------------
            if tx.related_order_id:
                from src.features.orders.models import Order, OrderItem
                from src.features.customers.services import CustomerService

                order = self.db.query(Order).filter(
                    Order.id == tx.related_order_id
                ).first()
                if not order:
                    raise ValueError("İlgili sipariş bulunamadı veya zaten silinmiş.")
                if order.is_deleted or getattr(order, "status", "") == "cancelled":
                    raise ValueError("Bu sipariş zaten iade edilmiş veya iptal edilmiş.")

                items = self.db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
                for item in items:
                    product = self.db.query(Product).filter(Product.id == item.product_id).first()
                    if not product:
                        continue

                    self.db.add(
                        StockMovement(
                            product_id=product.id,
                            user_id=user_id,
                            quantity_change=int(item.quantity),
                            reason=StockMovementReason.RETURN,
                            notes=f"İade: {order.order_number}",
                        )
                    )
                    product.stock_quantity += int(item.quantity)
                    if hasattr(product, "is_synced"):
                        product.is_synced = False

                # Veresiye satış ise müşteri borcundan düş
                payment_method_str = str(getattr(order, "payment_method", "") or "").upper().strip()
                if payment_method_str in ("CREDIT", "DEBT") and getattr(order, "customer_id", None):
                    CustomerService(self.db).update_balance(order.customer_id, -float(order.final_amount or 0.0))

                # Bu siparişe bağlı tüm transaction'ları soft delete et
                related_txs = self.db.query(Transaction).filter(
                    Transaction.related_order_id == order.id,
                    Transaction.is_deleted == False
                ).all()
                for rtx in related_txs:
                    rtx.is_deleted = True

                tx.is_deleted = True

                if hasattr(order, "status"):
                    order.status = "cancelled"

                # SystemLog
                user_obj = self.db.query(User).filter(User.id == user_id).first()
                u_name = user_obj.full_name if user_obj else (user_obj.username if user_obj else user_id)
                self.db.add(
                    SystemLog(
                        user_id=user_id,
                        action_type="REFUND",
                        details=f"{u_name} tarafından #{order.order_number} nolu sipariş iade edildi."
                    )
                )

                self.db.commit()
                return {
                    "refunded": True,
                    "transaction_id": transaction_id,
                    "order_type": "order",
                    "order_id": order.id,
                    "order_number": getattr(order, "order_number", ""),
                    "restocked_items": len(items),
                }

            # ------------------------------------------------------------
            # 2) SaleOrder (sales) üzerinden iade
            # ------------------------------------------------------------
            from src.features.sales.models import SaleOrder, SaleOrderItem, OrderStatus as SaleOrderStatus
            from src.features.transactions.models import TransactionSource
            import re

            # Yalnızca POS kaynaklı satış transaction'ları için
            if tx.source != TransactionSource.POS:
                raise ValueError("Bu işlem satış iadesi için uygun değil.")

            sale_order: SaleOrder | None = None

            # Öncelik 1: reference_id (sale_orders.id)
            if tx.reference_id:
                sale_order = self.db.query(SaleOrder).filter(
                    SaleOrder.id == tx.reference_id
                ).first()

            # Öncelik 2: description içinden order_number çıkar ("Satış S-...")
            if not sale_order:
                desc = (tx.description or "").strip()
                order_number = None

                for prefix in ("Satış ", "Satis "):
                    if desc.startswith(prefix):
                        order_number = desc[len(prefix):].strip()
                        break

                if not order_number:
                    m = re.search(r"(Satış|Satis)\s+([^\s]+)", desc)
                    if m:
                        order_number = m.group(2)

                if order_number:
                    sale_order = self.db.query(SaleOrder).filter(
                        SaleOrder.order_number == order_number
                    ).first()

            if not sale_order:
                raise ValueError("İlgili satış bulunamadı (SaleOrder).")

            # İdempotency check: Zaten iade edilmiş mi?
            if sale_order.status == SaleOrderStatus.REFUNDED:
                raise ValueError("Bu satış siparişi zaten iade edilmiş.")

            # Ürünleri stoğa geri yükle
            items = self.db.query(SaleOrderItem).filter(SaleOrderItem.order_id == sale_order.id).all()
            for item in items:
                product = self.db.query(Product).filter(Product.id == item.product_id).first()
                if not product:
                    continue

                self.db.add(
                    StockMovement(
                        product_id=product.id,
                        user_id=user_id,
                        quantity_change=int(item.quantity),
                        reason=StockMovementReason.RETURN,
                        notes=f"İade: {sale_order.order_number}",
                    )
                )
                product.stock_quantity += int(item.quantity)
                if hasattr(product, "is_synced"):
                    product.is_synced = False

            # Transaction(lar)ı soft delete et:
            # 1) Tetikleyen mevcut transaction
            tx.is_deleted = True

            # 2) Bu satışa referans veren veya aynı sipariş numarasına sahip tüm aktif POS transaction'ları
            related_txs = []
            if sale_order.id:
                related_txs = self.db.query(Transaction).filter(
                    Transaction.is_deleted == False,
                    Transaction.source == TransactionSource.POS,
                    Transaction.reference_id == sale_order.id
                ).all()
                for otx in related_txs:
                    otx.is_deleted = True

            # Ek olarak sipariş numarası açıklamada geçen aktif transaction'lar varsa
            if sale_order.order_number:
                desc_txs = self.db.query(Transaction).filter(
                    Transaction.is_deleted == False,
                    Transaction.source == TransactionSource.POS,
                    Transaction.description.like(f"%{sale_order.order_number}%")
                ).all()
                for dtx in desc_txs:
                    dtx.is_deleted = True

            # Borç / Cari iadesi:
            # Eğer bu satış veresiye içeriyorsa, müşteri bakiyesinden bu borcu düş.
            if sale_order.customer_id:
                from src.features.customers.models import Customer
                customer = self.db.query(Customer).filter(Customer.id == sale_order.customer_id).first()
                if customer:
                    total_debt_refund = 0.0
                    all_matched_txs = [tx] + [t for t in related_txs if t.id != tx.id]
                    debt_txs = [
                        t for t in all_matched_txs
                        if (t.payment_method == PaymentMethod.DEBT or str(getattr(t, "payment_method", "") or "").upper() == "DEBT")
                    ]
                    if debt_txs:
                        total_debt_refund = sum(float(t.amount or 0.0) for t in debt_txs)
                    elif str(getattr(sale_order, "payment_method", "") or "").upper() in ("DEBT", "VERESIYE", "CREDIT"):
                        total_debt_refund = float(sale_order.final_amount or 0.0)

                    if total_debt_refund > 0:
                        customer.balance -= total_debt_refund

            # SaleOrder durumunu REFUNDED olarak güncelle, ancak is_deleted = False bırak
            sale_order.status = SaleOrderStatus.REFUNDED
            sale_order.is_deleted = False

            # SystemLog kaydı oluştur
            user_obj = self.db.query(User).filter(User.id == user_id).first()
            u_name = user_obj.full_name if user_obj else (user_obj.username if user_obj else user_id)
            system_log = SystemLog(
                user_id=user_id,
                action_type="REFUND",
                details=f"{u_name} tarafından {sale_order.order_number} nolu satış iade edildi. Tutar: {sale_order.final_amount:.2f} TL, {len(items)} kalem ürün stoğa iade edildi."
            )
            self.db.add(system_log)

            self.db.commit()
            return {
                "refunded": True,
                "transaction_id": transaction_id,
                "order_type": "sale_order",
                "order_id": sale_order.id,
                "order_number": sale_order.order_number,
                "restocked_items": len(items),
            }
        except Exception as e:
            self.db.rollback()
            raise e
