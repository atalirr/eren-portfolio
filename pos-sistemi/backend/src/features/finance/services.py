"""
Finance Analytics Service
Finansal Veri Analitiği ve Dashboard Veri İşleme
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, extract, case
from sqlalchemy.sql import func as sql_func

from src.features.orders.models import Order, OrderItem, MarketplacePlatform, OrderSource
from src.features.transactions.models import Transaction, TransactionType, TransactionSource, PaymentMethod as TransactionPaymentMethod
from src.features.sales.models import (
    SaleOrder,
    SaleOrderItem,
    SalesPlatform,
    OrderStatus as SalesOrderStatus,
    PaymentMethod as SalesPaymentMethod,
)
from src.features.inventory.models import Product
from src.features.customers.models import Customer
from src.shared.utils.currency import round_money, to_decimal
from src.features.sales.services import get_sale_order_effective_amount_column, calculate_unified_revenue


class FinanceService:
    """Finance Analytics Service - Dashboard Veri İşleme"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_payment_methods_distribution(self, scope: str = 'general', start_date: Optional[str] = None) -> List[Dict]:
        """
        Ödeme Yöntemleri Dağılımı
        
        Args:
            scope: 'local' veya 'general'
                - 'local': Sadece satış sayfasından gelen ödeme yöntemleri (POS/LOCAL)
                - 'general': Tüm kaynaklar (E-ticaret + Satış + Manuel gelirler)
            start_date: Başlangıç tarihi (ISO format: YYYY-MM-DDTHH:MM:SS) - Bu tarihten sonraki verileri getirir
        """
        # start_date varsa parse et
        start_datetime = None
        if start_date:
            try:
                start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                print(f"[Finance] [INFO] Sıfırlama zamanı: {start_datetime}")
            except Exception as e:
                print(f"[Finance] [WARN] start_date parse hatası: {e}")
                start_datetime = None
        payment_method_colors = {
            'CASH': '#22c55e',  # Yeşil
            'CARD': '#3b82f6',  # Mavi
            'TRANSFER': '#8b5cf6',  # Mor
            'DEBT': '#f59e0b',  # Turuncu
        }
        payment_method_labels = {
            'CASH': 'Nakit',
            'CARD': 'Kart',
            'TRANSFER': 'Havale',
            'DEBT': 'Veresiye',
        }
        
        payment_methods_dict: Dict[str, float] = {}
        
        try:
            # =====================================================
            # LOKAL SCOPE: Sadece POS satış sayfasındaki ödemeler
            # Kaynak: SaleOrder (sales modülü)
            # =====================================================
            if scope == 'local':
                filters = [
                    SaleOrder.is_deleted == 0,
                    SaleOrder.status == SalesOrderStatus.COMPLETED,
                    SaleOrder.platform == SalesPlatform.STORE,
                ]
                if start_datetime:
                    filters.append(SaleOrder.created_at >= start_datetime)
                
                sale_query = (
                    self.db.query(
                        SaleOrder.payment_method,
                        func.sum(SaleOrder.total_amount).label("total"),
                    )
                    .filter(and_(*filters))
                    .group_by(SaleOrder.payment_method)
                    .all()
                )

                print(f"[Finance] Lokal scope (SaleOrder) için {len(sale_query)} ödeme yöntemi bulundu")
                for pm_enum, total in sale_query:
                    if not pm_enum or not total or total <= 0:
                        continue
                    # Enum ise .value al, değilse string'e çevir
                    method_str = (
                        pm_enum.value.upper().strip()
                        if hasattr(pm_enum, "value")
                        else str(pm_enum).upper().strip()
                    )
                    if method_str == "CREDIT":
                        method_str = "DEBT"
                    payment_methods_dict[method_str] = payment_methods_dict.get(method_str, 0.0) + float(total or 0)
                    print(f"[Finance]  - {method_str}: {total}")
            
            else:  # general
                # Genel: Tüm kaynaklar (E-ticaret + POS + Manuel gelirler)
                # 1) Eski Order tablosu
                order_filters = [
                    Order.is_deleted == 0,
                    Order.status == "completed",
                ]
                if start_datetime:
                    order_filters.append(Order.created_at >= start_datetime)
                
                order_query = (
                    self.db.query(
                        Order.payment_method,
                        func.sum(Order.final_amount).label("total"),
                    )
                    .filter(and_(*order_filters))
                    .group_by(Order.payment_method)
                    .all()
                )
                print(f"[Finance] Genel scope (Order) için {len(order_query)} sonuç")
                for method, total in order_query:
                    if not method or not total or total <= 0:
                        continue
                    method_str = str(method).upper().strip()
                    if method_str == "CREDIT":
                        method_str = "DEBT"
                    payment_methods_dict[method_str] = payment_methods_dict.get(method_str, 0.0) + float(total or 0)

                # 2) Yeni SaleOrder tablosu (tüm platformlar)
                sale_filters = [
                    SaleOrder.is_deleted == 0,
                    SaleOrder.status == SalesOrderStatus.COMPLETED,
                ]
                if start_datetime:
                    sale_filters.append(SaleOrder.created_at >= start_datetime)
                
                sale_query = (
                    self.db.query(
                        SaleOrder.payment_method,
                        func.sum(SaleOrder.total_amount).label("total"),
                    )
                    .filter(and_(*sale_filters))
                    .group_by(SaleOrder.payment_method)
                    .all()
                )
                print(f"[Finance] Genel scope (SaleOrder) için {len(sale_query)} sonuç")
                for pm_enum, total in sale_query:
                    if not pm_enum or not total or total <= 0:
                        continue
                    method_str = (
                        pm_enum.value.upper().strip()
                        if hasattr(pm_enum, "value")
                        else str(pm_enum).upper().strip()
                    )
                    if method_str == "CREDIT":
                        method_str = "DEBT"
                    payment_methods_dict[method_str] = payment_methods_dict.get(method_str, 0.0) + float(total or 0)

                # 3) Transaction tablosundan manuel eklenen gelirler
                transaction_filters = [
                    Transaction.type == TransactionType.INCOME,
                    Transaction.is_deleted == False,
                    Transaction.related_order_id.is_(None),
                    Transaction.payment_method.isnot(None),
                ]
                if start_datetime:
                    transaction_filters.append(Transaction.created_at >= start_datetime)
                
                manual_income_payments = (
                    self.db.query(
                        Transaction.payment_method,
                        func.sum(Transaction.amount).label("total"),
                    )
                    .filter(and_(*transaction_filters))
                    .group_by(Transaction.payment_method)
                    .all()
                )
                print(f"[Finance] Genel scope (Transaction) için {len(manual_income_payments)} sonuç")
                for pm_enum, total in manual_income_payments:
                    if not pm_enum or not total or total <= 0:
                        continue
                    method_str = (
                        pm_enum.value.upper().strip()
                        if hasattr(pm_enum, "value")
                        else str(pm_enum).upper().strip()
                    )
                    if method_str == "CREDIT":
                        method_str = "DEBT"
                    payment_methods_dict[method_str] = payment_methods_dict.get(method_str, 0.0) + float(total or 0)

            # Sonuç listesini oluştur
            payment_methods_data: List[Dict] = []
            print(f"[Finance] payment_methods_dict içeriği: {payment_methods_dict}")
            for method, total in payment_methods_dict.items():
                if total > 0:
                    key = str(method).upper().strip()
                    payment_methods_data.append(
                        {
                            "name": payment_method_labels.get(key, key),
                            "value": round(total, 2),
                            "color": payment_method_colors.get(key, "#94a3b8"),
                        }
                    )
                    print(
                        f"[Finance] Eklenen: {key} -> {payment_method_labels.get(key, key)} ({round(total, 2)} TL)"
                    )

            print(
                f"[Finance] Toplam {len(payment_methods_data)} ödeme yöntemi döndürülüyor: {payment_methods_data}"
            )
            return payment_methods_data
            
        except Exception as e:
            import traceback
            print(f"[ERROR] Ödeme yöntemleri dağılımı hesaplanırken hata: {str(e)}")
            print(traceback.format_exc())
            return []
    
    def get_dashboard_stats(self) -> Dict:
        """
        Dashboard için finansal özet verileri:
        - Nakit ve Banka Dağılımı (cash_bank_distribution)
        - Ödeme Yöntemleri Dağılımı (payment_methods_distribution)
        """
        # Nakit ve Banka Dağılımı
        # Transaction tablosundan payment_source'a göre topla
        cash_income = self.db.query(
            func.sum(Transaction.amount).label('total')
        ).filter(
            and_(
                Transaction.type == TransactionType.INCOME,
                Transaction.payment_source == 'CASH',
                Transaction.is_deleted == False,
                or_(Transaction.payment_method.is_(None), Transaction.payment_method != TransactionPaymentMethod.DEBT)
            )
        ).scalar() or 0.0
        
        cash_expense = self.db.query(
            func.sum(Transaction.amount).label('total')
        ).filter(
            and_(
                Transaction.type == TransactionType.EXPENSE,
                Transaction.payment_source == 'CASH',
                Transaction.is_deleted == False
            )
        ).scalar() or 0.0
        
        cash_balance = (cash_income or 0.0) - (cash_expense or 0.0)
        
        bank_income = self.db.query(
            func.sum(Transaction.amount).label('total')
        ).filter(
            and_(
                Transaction.type == TransactionType.INCOME,
                Transaction.payment_source == 'BANK',
                Transaction.is_deleted == False,
                or_(Transaction.payment_method.is_(None), Transaction.payment_method != TransactionPaymentMethod.DEBT)
            )
        ).scalar() or 0.0
        
        bank_expense = self.db.query(
            func.sum(Transaction.amount).label('total')
        ).filter(
            and_(
                Transaction.type == TransactionType.EXPENSE,
                Transaction.payment_source == 'BANK',
                Transaction.is_deleted == False
            )
        ).scalar() or 0.0
        
        bank_balance = (bank_income or 0.0) - (bank_expense or 0.0)
        
        # POS/Bloke: Bekleyen POS tahsilatları (şimdilik 0 - gelecekte e-commerce entegrasyonundan gelecek)
        pos_balance = 0.0
        
        # Ödeme Yöntemleri Dağılımı (Order tablosundan - Genel: Tüm kaynaklar)
        # CASH, CARD, TRANSFER, DEBT
        payment_methods_query = self.db.query(
            Order.payment_method,
            func.sum(Order.final_amount).label('total')
        ).filter(
            and_(
                Order.is_deleted == 0,  # SQLite'da boolean 0/1 olarak saklanıyor
                Order.status == 'completed'
            )
        ).group_by(
            Order.payment_method
        ).all()
        
        # Manuel eklenen gelirlerden ödeme yöntemleri (Transaction tablosundan)
        manual_income_payments = self.db.query(
            Transaction.payment_method,
            func.sum(Transaction.amount).label('total')
        ).filter(
            and_(
                Transaction.type == TransactionType.INCOME,
                Transaction.is_deleted == False,
                Transaction.related_order_id.is_(None),  # Satıştan kaynaklanmayan
                Transaction.payment_method.isnot(None)
            )
        ).group_by(
            Transaction.payment_method
        ).all()
        
        # Ödeme yöntemlerini birleştir (Order + Transaction)
        payment_methods_dict = {}
        for method, total in payment_methods_query:
            if method and total and total > 0:
                if method not in payment_methods_dict:
                    payment_methods_dict[method] = 0.0
                payment_methods_dict[method] += float(total)
        
        for method, total in manual_income_payments:
            if method and total and total > 0:
                # Transaction'daki payment_method'u Order formatına çevir
                method_normalized = method.upper()
                if method_normalized not in payment_methods_dict:
                    payment_methods_dict[method_normalized] = 0.0
                payment_methods_dict[method_normalized] += float(total)
        
        payment_methods_data = []
        payment_method_colors = {
            'CASH': '#22c55e',  # Yeşil
            'CARD': '#3b82f6',  # Mavi
            'TRANSFER': '#8b5cf6',  # Mor
            'DEBT': '#f59e0b',  # Turuncu
        }
        payment_method_labels = {
            'CASH': 'Nakit',
            'CARD': 'Kart',
            'TRANSFER': 'Havale',
            'DEBT': 'Veresiye',
        }
        
        for method, total in payment_methods_dict.items():
            if total > 0:
                payment_methods_data.append({
                    "name": payment_method_labels.get(method, method),
                    "value": round(total, 2),
                    "color": payment_method_colors.get(method, '#94a3b8')
                })
        
        return {
            "cash_bank_distribution": [
                {
                    "name": "Nakit Kasa",
                    "value": round(cash_balance, 2),
                    "color": "#22c55e"
                },
                {
                    "name": "Banka Hesapları",
                    "value": round(bank_balance, 2),
                    "color": "#3b82f6"
                },
                {
                    "name": "POS / Bloke",
                    "value": round(pos_balance, 2),
                    "color": "#8b5cf6"
                }
            ],
            "payment_methods_distribution": payment_methods_data  # Genel için varsayılan
        }
    
    def get_finance_dashboard_data(
        self, 
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        days: int = 30
    ) -> Dict:
        """
        Dashboard için tüm finansal verileri toplar
        
        Returns:
            {
                "revenue_sources": [...],  # Donut Chart
                "profit_trend": [...],    # Area Chart
                "expense_analysis": [...]  # Top 5 List
            }
        """
        
        # Tarih aralığını belirle
        if end_date is None:
            end_date = datetime.now()
        if start_date is None:
            if days == 1:
                start_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
            else:
                start_date = end_date - timedelta(days=days)
        
        # Tarih filtresi (sadece tarih kısmı, saat yok)
        start_date_only = start_date.date()
        end_date_only = end_date.date()
        
        return {
            "revenue_sources": self._get_revenue_sources(start_date_only, end_date_only),
            "profit_trend": self._get_profit_trend(start_date_only, end_date_only),
            "expense_analysis": self._get_expense_analysis(start_date_only, end_date_only),
        }
    
    def _get_revenue_sources(self, start_date, end_date) -> List[Dict]:
        """
        Gelir Kaynakları (Donut Chart)
        3 Ana Kategori: Perakende (POS), E-Ticaret, Kurumsal/Diğer
        """
        
        # 1. Perakende (POS / Mağaza)
        # - Eski Order: platform='LOCAL' veya source='POS'
        # - Yeni SaleOrder: platform='STORE'
        retail_orders_total = (
            self.db.query(func.sum(Order.final_amount).label("total"))
            .filter(
                and_(
                    func.date(Order.created_at) >= start_date,
                    func.date(Order.created_at) <= end_date,
                    Order.is_deleted == False,
                    Order.status == "completed",
                    or_(
                        Order.platform == MarketplacePlatform.LOCAL,
                        Order.source == OrderSource.POS,
                    ),
                )
            )
            .scalar()
            or 0.0
        )

        retail_sales_total = (
            self.db.query(func.sum(SaleOrder.total_amount).label("total"))
            .filter(
                and_(
                    func.date(SaleOrder.created_at) >= start_date,
                    func.date(SaleOrder.created_at) <= end_date,
                    SaleOrder.is_deleted == 0,
                    SaleOrder.status == SalesOrderStatus.COMPLETED,
                    SaleOrder.platform == SalesPlatform.STORE,
                )
            )
            .scalar()
            or 0.0
        )

        retail_total = float(retail_orders_total or 0.0) + float(retail_sales_total or 0.0)
        
        # 2. E-Ticaret: Eski Order + Yeni SaleOrder (TRENDYOL, HEPSIBURADA)
        ecommerce_orders_total = (
            self.db.query(func.sum(Order.final_amount).label("total"))
            .filter(
                and_(
                    func.date(Order.created_at) >= start_date,
                    func.date(Order.created_at) <= end_date,
                    Order.is_deleted == False,
                    Order.status == "completed",
                    Order.platform.in_([MarketplacePlatform.TRENDYOL, MarketplacePlatform.HEPSIBURADA]),
                )
            )
            .scalar()
            or 0.0
        )

        ecommerce_sales_total = (
            self.db.query(func.sum(SaleOrder.total_amount).label("total"))
            .filter(
                and_(
                    func.date(SaleOrder.created_at) >= start_date,
                    func.date(SaleOrder.created_at) <= end_date,
                    SaleOrder.is_deleted == 0,
                    SaleOrder.status == SalesOrderStatus.COMPLETED,
                    SaleOrder.platform.in_([SalesPlatform.TRENDYOL, SalesPlatform.HEPSIBURADA]),
                )
            )
            .scalar()
            or 0.0
        )

        ecommerce_total = float(ecommerce_orders_total or 0.0) + float(ecommerce_sales_total or 0.0)
        
        # 3. Kurumsal/Diğer: Transaction tablosunda Satış dışı gelirler
        corporate_query = self.db.query(
            func.sum(Transaction.amount).label('total')
        ).filter(
            and_(
                func.date(Transaction.created_at) >= start_date,
                func.date(Transaction.created_at) <= end_date,
                Transaction.is_deleted == False,
                Transaction.type == TransactionType.INCOME,
                or_(Transaction.payment_method.is_(None), Transaction.payment_method != TransactionPaymentMethod.DEBT),  # Veresiye hariç
                or_(
                    Transaction.category == 'Invoice Payment',
                    Transaction.category == 'Fatura Geliri',
                    Transaction.category == 'Cari Tahsilat',
                    Transaction.related_order_id.is_(None)  # Satıştan kaynaklanmayan gelirler
                )
            )
        )
        corporate_total = corporate_query.scalar() or 0.0
        
        return [
            {
                "name": "Perakende (POS)",
                "value": round(retail_total, 2),
                "color": "#3b82f6"
            },
            {
                "name": "E-Ticaret",
                "value": round(ecommerce_total, 2),
                "color": "#8b5cf6"
            },
            {
                "name": "Kurumsal/Diğer",
                "value": round(corporate_total, 2),
                "color": "#f97316"
            }
        ]
    
    def _get_profit_trend(self, start_date, end_date) -> List[Dict]:
        """
        Kâr ve Ciro Makası (Area Chart)
        Günlük döküm: Ciro, Maliyet, Giderler, Net Kâr
        """
        
        # Tarih aralığındaki tüm günleri oluştur
        current_date = start_date
        trend_data = []

        # Veresiye Satışlar için maliyet oranı hesapla (veresiye tahsilatı maliyeti için)
        debt_sales = (
            self.db.query(
                func.sum(
                    case(
                        (SaleOrder.final_amount > 0.0, SaleOrder.final_amount),
                        else_=SaleOrder.total_amount
                    )
                )
            )
            .filter(
                and_(
                    SaleOrder.is_deleted == 0,
                    SaleOrder.status == SalesOrderStatus.COMPLETED,
                    SaleOrder.payment_method == "DEBT"
                )
            )
            .scalar()
            or 0.0
        )

        debt_profit = (
            self.db.query(func.sum(SaleOrder.total_profit))
            .filter(
                and_(
                    SaleOrder.is_deleted == 0,
                    SaleOrder.status == SalesOrderStatus.COMPLETED,
                    SaleOrder.payment_method == "DEBT"
                )
            )
            .scalar()
            or 0.0
        )

        debt_cogs_ratio = (debt_sales - debt_profit) / debt_sales if debt_sales > 0 else 0.0

        # Mağaza genel maliyet oranı (yedek)
        store_sales = (
            self.db.query(func.sum(SaleOrder.total_amount))
            .filter(SaleOrder.is_deleted == 0, SaleOrder.status == SalesOrderStatus.COMPLETED)
            .scalar()
            or 0.0
        )
        store_profit = (
            self.db.query(func.sum(SaleOrder.total_profit))
            .filter(SaleOrder.is_deleted == 0, SaleOrder.status == SalesOrderStatus.COMPLETED)
            .scalar()
            or 0.0
        )
        store_cogs_ratio = (store_sales - store_profit) / store_sales if store_sales > 0 else 0.4  # %40 varsayılan maliyet

        cost_ratio = debt_cogs_ratio if debt_cogs_ratio > 0 else store_cogs_ratio
        
        while current_date <= end_date:
            date_str = current_date.strftime('%d.%m')
            
            # 1. Ciro: O günkü SaleOrder ve Order satış cirosu (Tahsilat ve Virman HARIÇ)
            orders_revenue = (
                self.db.query(func.coalesce(func.sum(Order.final_amount), 0.0))
                .filter(
                    and_(
                        func.date(Order.created_at) == current_date,
                        Order.is_deleted == False,
                        Order.status == "completed",
                    )
                )
                .scalar()
                or 0.0
            )

            effective_pos_amt = get_sale_order_effective_amount_column()
            sales_revenue = (
                self.db.query(func.coalesce(func.sum(effective_pos_amt), 0.0))
                .filter(
                    and_(
                        func.date(SaleOrder.created_at) == current_date,
                        SaleOrder.is_deleted == False,
                        SaleOrder.status == SalesOrderStatus.COMPLETED,
                    )
                )
                .scalar()
                or 0.0
            )
            
            revenue = round_money(orders_revenue + sales_revenue)
            
            # 2. Maliyet (COGS): O gün satılan ürünlerin alış fiyatı toplamı
            orders_cost = (
                self.db.query(func.coalesce(func.sum(OrderItem.unit_buy_price * OrderItem.quantity), 0.0))
                .join(Order, OrderItem.order_id == Order.id)
                .filter(
                    and_(
                        func.date(Order.created_at) == current_date,
                        Order.is_deleted == False,
                        Order.status == "completed",
                    )
                )
                .scalar()
                or 0.0
            )

            sales_cost = (
                self.db.query(func.coalesce(func.sum(SaleOrderItem.quantity * func.coalesce(SaleOrderItem.unit_cost, 0.0)), 0.0))
                .join(SaleOrder, SaleOrder.id == SaleOrderItem.order_id)
                .filter(
                    and_(
                        func.date(SaleOrder.created_at) == current_date,
                        SaleOrder.is_deleted == False,
                        SaleOrder.status == SalesOrderStatus.COMPLETED,
                    )
                )
                .scalar()
                or 0.0
            )

            cost = round_money(orders_cost + sales_cost)
            
            # 3. Giderler (OpEx): O günkü Transaction giderleri (Virman HARIÇ)
            expenses = (
                self.db.query(func.coalesce(func.sum(Transaction.amount), 0.0))
                .filter(
                    and_(
                        func.date(Transaction.created_at) == current_date,
                        Transaction.is_deleted == False,
                        Transaction.type == TransactionType.EXPENSE,
                        func.lower(func.coalesce(Transaction.category, '')).notin_(['virman', 'transfer']),
                    )
                )
                .scalar()
                or 0.0
            )
            expenses = round_money(expenses)
            
            # 4. Net Kâr: Ciro - Maliyet - Giderler
            profit = round_money(revenue - cost - expenses)
            
            trend_data.append({
                "date": date_str,
                "ciro": revenue,
                "maliyet": cost,
                "giderler": expenses,
                "kar": profit
            })
            
            current_date += timedelta(days=1)
        
        return trend_data
    
    def _get_expense_analysis(self, start_date, end_date) -> List[Dict]:
        """
        Gider Analizi (Top 5 Liste)
        Transaction tablosunda type='EXPENSE' olanları category bazında grupla
        """
        
        expense_query = self.db.query(
            Transaction.category,
            func.sum(Transaction.amount).label('total')
        ).filter(
            and_(
                func.date(Transaction.created_at) >= start_date,
                func.date(Transaction.created_at) <= end_date,
                Transaction.is_deleted == False,
                Transaction.type == TransactionType.EXPENSE
            )
        ).group_by(
            Transaction.category
        ).order_by(
            func.sum(Transaction.amount).desc()
        ).limit(5).all()
        
        return [
            {
                "category": category or "Diğer",
                "amount": round(total, 2)
            }
            for category, total in expense_query
        ]
    
    def get_financial_health_metrics(self) -> Dict:
        """
        Finansal Sağlık Göstergeleri
        - Varlık/Borç Dengesi (Assets vs Liabilities)
        - Nakit Ömrü (Burn Rate & Runway)
        """
        from datetime import timedelta
        
        try:
            # A. FİNANSAL TERAZİ (ASSETS vs LIABILITIES)
            
            # Varlıklar (Assets)
            # 1. Nakit Kasa Bakiyesi
            cash_income = self.db.query(
                func.sum(Transaction.amount).label('total')
            ).filter(
                and_(
                    Transaction.type == TransactionType.INCOME,
                    Transaction.payment_source == 'CASH',
                    Transaction.is_deleted == False,
                    or_(Transaction.payment_method.is_(None), Transaction.payment_method != TransactionPaymentMethod.DEBT)
                )
            ).scalar() or 0.0
            
            cash_expense = self.db.query(
                func.sum(Transaction.amount).label('total')
            ).filter(
                and_(
                    Transaction.type == TransactionType.EXPENSE,
                    Transaction.payment_source == 'CASH',
                    Transaction.is_deleted == False
                )
            ).scalar() or 0.0
            
            cash_balance = (cash_income or 0.0) - (cash_expense or 0.0)
            
            # 2. Banka Bakiyesi
            bank_income = self.db.query(
                func.sum(Transaction.amount).label('total')
            ).filter(
                and_(
                    Transaction.type == TransactionType.INCOME,
                    Transaction.payment_source == 'BANK',
                    Transaction.is_deleted == False,
                    or_(Transaction.payment_method.is_(None), Transaction.payment_method != TransactionPaymentMethod.DEBT)
                )
            ).scalar() or 0.0
            
            bank_expense = self.db.query(
                func.sum(Transaction.amount).label('total')
            ).filter(
                and_(
                    Transaction.type == TransactionType.EXPENSE,
                    Transaction.payment_source == 'BANK',
                    Transaction.is_deleted == False
                )
            ).scalar() or 0.0
            
            bank_balance = (bank_income or 0.0) - (bank_expense or 0.0)
            
            # 3. Customer tablosundaki alacaklar (balance > 0 ise alacak)
            receivables = 0.0
            try:
                receivables = self.db.query(
                    func.sum(Customer.balance).label('total')
                ).filter(
                    Customer.balance > 0
                ).scalar() or 0.0
                receivables = receivables or 0.0
            except Exception as e:
                print(f"[WARN] Customer tablosundan alacaklar alinirken hata (gormezden geliniyor): {str(e)}")
                receivables = 0.0
            
            # 4. MarketplaceConfig içindeki current_balance (şimdilik 0 - modelde yok)
            marketplace_balance = 0.0
            
            total_assets = cash_balance + bank_balance + receivables + marketplace_balance
            
            # Yükümlülükler (Liabilities)
            # 1. Customer tablosundaki borçlar (balance < 0 ise borç)
            customer_debts = 0.0
            try:
                customer_debts_result = self.db.query(
                    func.sum(Customer.balance).label('total')
                ).filter(
                    Customer.balance < 0
                ).scalar() or 0.0
                customer_debts = abs(customer_debts_result or 0.0)
            except Exception as e:
                print(f"[WARN] Customer tablosundan borclar alinirken hata (gormezden geliniyor): {str(e)}")
                customer_debts = 0.0
            
            # 2. Planlanmış giderler (gelecek tarihli EXPENSE transaction'lar)
            now = datetime.now()
            planned_expenses = self.db.query(
                func.sum(Transaction.amount).label('total')
            ).filter(
                and_(
                    Transaction.type == TransactionType.EXPENSE,
                    Transaction.created_at > now,
                    Transaction.is_deleted == False
                )
            ).scalar() or 0.0
            planned_expenses = planned_expenses or 0.0
            
            total_liabilities = customer_debts + planned_expenses
            
            # Oran Hesabı
            ratio = (total_assets / total_liabilities * 100) if total_liabilities > 0 else (1000 if total_assets > 0 else 0)
            
            # B. NAKİT YAKMA HIZI (BURN RATE & RUNWAY)
            
            # Son 30 gündeki sabit giderler
            thirty_days_ago = now - timedelta(days=30)
            fixed_expense_categories = ['Kira', 'Fatura', 'Personel', 'Vergi', 'Elektrik', 'Su', 'Kira Gideri', 'Fatura Gideri']
            
            monthly_fixed_expenses = self.db.query(
                func.sum(Transaction.amount).label('total')
            ).filter(
                and_(
                    Transaction.type == TransactionType.EXPENSE,
                    Transaction.created_at >= thirty_days_ago,
                    Transaction.created_at <= now,
                    Transaction.is_deleted == False,
                    Transaction.category.in_(fixed_expense_categories)
                )
            ).scalar() or 0.0
            monthly_fixed_expenses = monthly_fixed_expenses or 0.0
            
            # Günlük yakma hızı
            daily_burn_rate = monthly_fixed_expenses / 30.0 if monthly_fixed_expenses > 0 else 0.0
            
            # Nakit ömrü (gün)
            current_cash = cash_balance + bank_balance
            runway_days = (current_cash / daily_burn_rate) if daily_burn_rate > 0 else (999 if current_cash > 0 else 0)
            
            return {
                "financial_balance": {
                    "assets": round(total_assets, 2),
                    "liabilities": round(total_liabilities, 2),
                    "ratio": round(ratio, 2),
                    "status": "Güvenli" if ratio >= 100 else "Riskli" if ratio >= 50 else "Kritik",
                    "details": {
                        "cash_balance": round(cash_balance, 2),
                        "bank_balance": round(bank_balance, 2),
                        "receivables": round(receivables, 2),
                        "marketplace_balance": round(marketplace_balance, 2),
                        "customer_debts": round(customer_debts, 2),
                        "planned_expenses": round(planned_expenses, 2)
                    }
                },
                "cash_runway": {
                    "monthly_fixed_expenses": round(monthly_fixed_expenses, 2),
                    "daily_burn_rate": round(daily_burn_rate, 2),
                    "current_cash": round(current_cash, 2),
                    "runway_days": round(runway_days, 2),
                    "status": "Güvenli" if runway_days >= 60 else "Dikkat" if runway_days >= 30 else "Kritik"
                }
            }
        except Exception as e:
            import traceback
            print(f"[ERROR] Financial health metrics hesaplanırken hata: {str(e)}")
            print(traceback.format_exc())
            return {
                "financial_balance": {
                    "assets": 0.0,
                    "liabilities": 0.0,
                    "ratio": 0.0,
                    "status": "Kritik",
                    "details": {
                        "cash_balance": 0.0,
                        "bank_balance": 0.0,
                        "receivables": 0.0,
                        "marketplace_balance": 0.0,
                        "customer_debts": 0.0,
                        "planned_expenses": 0.0
                    }
                },
                "cash_runway": {
                    "monthly_fixed_expenses": 0.0,
                    "daily_burn_rate": 0.0,
                    "current_cash": 0.0,
                    "runway_days": 0.0,
                    "status": "Kritik"
                }
            }

    # ============================================
    # MODÜL 5: CİRO & KÂR TRENDİ (CASHFLOW/PROFIT TREND)
    # ============================================

    def get_cashflow_trend(
        self,
        period: str = "daily",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        points: int = 7,
    ) -> Dict:
        """
        Ciro & Kâr Trendi (daily/weekly/monthly)

        - revenue: (Order.final_amount + SaleOrder.total_amount)
        - cogs: (OrderItem.unit_buy_price*qty + (SaleOrder.total_amount - SaleOrder.total_profit))
        - expenses: Transaction EXPENSE
        - profit: revenue - cogs - expenses
        """
        try:
            if end_date is None:
                end_date = datetime.now()

            period = (period or "daily").lower().strip()
            if period not in ("daily", "weekly", "monthly"):
                period = "daily"

            points = int(points or 0) if points is not None else 0
            if points <= 0:
                points = 7 if period == "daily" else 8 if period == "weekly" else 6
            points = max(1, min(points, 365))

            # Eğer start_date verilmemişse: period'e göre geriye doğru hesapla
            if start_date is None:
                if period == "daily":
                    start_date = (end_date - timedelta(days=points - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
                elif period == "weekly":
                    anchor = end_date
                    week_start = (anchor - timedelta(days=anchor.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
                    start_date = week_start - timedelta(weeks=points - 1)
                else:  # monthly
                    anchor = end_date
                    month_start = anchor.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                    # rough: go back points-1 months
                    y = month_start.year
                    m = month_start.month - (points - 1)
                    while m <= 0:
                        y -= 1
                        m += 12
                    start_date = month_start.replace(year=y, month=m)

            # Bucket generator
            buckets: List[Dict] = []

            if period == "daily":
                cursor = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
                for _ in range(points):
                    b_start = cursor
                    b_end = (cursor + timedelta(days=1))
                    key = b_start.strftime("%Y-%m-%d")
                    buckets.append({"key": key, "start": b_start, "end": b_end})
                    cursor = b_end
            elif period == "weekly":
                cursor = (start_date - timedelta(days=start_date.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
                for _ in range(points):
                    b_start = cursor
                    b_end = cursor + timedelta(days=7)
                    iso_year, iso_week, _ = b_start.isocalendar()
                    key = f"{iso_year}-W{int(iso_week):02d}"
                    buckets.append({"key": key, "start": b_start, "end": b_end})
                    cursor = b_end
            else:  # monthly
                cursor = start_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                for _ in range(points):
                    b_start = cursor
                    # next month
                    y = b_start.year
                    m = b_start.month + 1
                    if m == 13:
                        y += 1
                        m = 1
                    b_end = b_start.replace(year=y, month=m, day=1)
                    key = b_start.strftime("%Y-%m")
                    buckets.append({"key": key, "start": b_start, "end": b_end})
                    cursor = b_end

            out_points: List[Dict] = []
            for b in buckets:
                b_start: datetime = b["start"]
                b_end: datetime = b["end"]

                orders_rev = (
                    self.db.query(func.sum(Order.final_amount).label("total"))
                    .filter(
                        and_(
                            Order.created_at >= b_start,
                            Order.created_at < b_end,
                            Order.is_deleted == False,
                            Order.status == "completed",
                        )
                    )
                    .scalar()
                    or 0.0
                )

                orders_cogs = (
                    self.db.query(func.sum(OrderItem.unit_buy_price * OrderItem.quantity).label("total"))
                    .join(Order, OrderItem.order_id == Order.id)
                    .filter(
                        and_(
                            Order.created_at >= b_start,
                            Order.created_at < b_end,
                            Order.is_deleted == False,
                            Order.status == "completed",
                        )
                    )
                    .scalar()
                    or 0.0
                )

                # Sadece tahsil edilmiş satışlar (veresiye DEĞİL) - bekleyen tahsilatlar ciroda görünmez
                sales_rev = (
                    self.db.query(func.sum(SaleOrder.total_amount).label("total"))
                    .filter(
                        and_(
                            SaleOrder.created_at >= b_start,
                            SaleOrder.created_at < b_end,
                            SaleOrder.is_deleted == 0,
                            SaleOrder.status == SalesOrderStatus.COMPLETED,
                        )
                    )
                    .scalar()
                    or 0.0
                )

                # Satış dışı tüm gelirler (Düzenli Teslimatlar, Cari Tahsilatlar ve diğer manuel gelirler)
                transactions_rev = (
                    self.db.query(func.sum(Transaction.amount).label("total"))
                    .filter(
                        and_(
                            Transaction.created_at >= b_start,
                            Transaction.created_at < b_end,
                            Transaction.is_deleted == False,
                            Transaction.type == TransactionType.INCOME,
                            Transaction.related_order_id.is_(None),
                            # Sadece SaleOrder'a (satış faturasına) bağlı POS işlemlerini dışla (çift sayımı önlemek için)
                            or_(
                                Transaction.source.is_(None),
                                and_(
                                    Transaction.source != "POS",
                                    Transaction.source != TransactionSource.POS
                                ),
                                and_(
                                    Transaction.source == TransactionSource.POS,
                                    Transaction.reference_id.is_(None)
                                )
                            ),
                            or_(Transaction.payment_method.is_(None), Transaction.payment_method != TransactionPaymentMethod.DEBT)  # Veresiye hariç
                        )
                    )
                    .scalar()
                    or 0.0
                )

                # Kâr: total_profit = alış-satış farkı (KDV karışmaz)
                sales_profit = (
                    self.db.query(func.sum(SaleOrder.total_profit).label("total"))
                    .filter(
                        and_(
                            SaleOrder.created_at >= b_start,
                            SaleOrder.created_at < b_end,
                            SaleOrder.is_deleted == 0,
                            SaleOrder.status == SalesOrderStatus.COMPLETED,
                        )
                    )
                    .scalar()
                    or 0.0
                )

                sales_cogs = max(float(sales_rev or 0.0) - float(sales_profit or 0.0), 0.0)

                expenses = (
                    self.db.query(func.sum(Transaction.amount).label("total"))
                    .filter(
                        and_(
                            Transaction.created_at >= b_start,
                            Transaction.created_at < b_end,
                            Transaction.is_deleted == False,
                            Transaction.type == TransactionType.EXPENSE,
                        )
                    )
                    .scalar()
                    or 0.0
                )

                revenue = float(orders_rev or 0.0) + float(sales_rev or 0.0) + float(transactions_rev or 0.0)
                cogs = float(orders_cogs or 0.0) + float(sales_cogs or 0.0)
                profit = revenue - cogs - float(expenses or 0.0)

                out_points.append(
                    {
                        "key": b["key"],
                        "revenue": round(revenue, 2),
                        "cogs": round(cogs, 2),
                        "expenses": round(float(expenses or 0.0), 2),
                        "profit": round(profit, 2),
                    }
                )

            return {
                "period": period,
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "points": out_points,
            }
        except Exception as e:
            import traceback
            print(f"[ERROR] Cashflow trend hesaplanırken hata: {str(e)}")
            print(traceback.format_exc())
            return {"period": period, "start": "", "end": "", "points": []}
        except Exception as e:
            import traceback
            print(f"[ERROR] Finansal saglik gostergeleri hesaplanirken hata: {str(e)}")
            print(traceback.format_exc())
            # Hata durumunda varsayılan değerler döndür
            return {
                "financial_balance": {
                    "assets": 0.0,
                    "liabilities": 0.0,
                    "ratio": 0.0,
                    "status": "Kritik",
                    "details": {
                        "cash_balance": 0.0,
                        "bank_balance": 0.0,
                        "receivables": 0.0,
                        "marketplace_balance": 0.0,
                        "customer_debts": 0.0,
                        "planned_expenses": 0.0
                    }
                },
                "cash_runway": {
                    "monthly_fixed_expenses": 0.0,
                    "daily_burn_rate": 0.0,
                    "current_cash": 0.0,
                    "runway_days": 0.0,
                    "status": "Kritik"
                }
            }
    
    # ============================================
    # MODÜL 1: GERÇEK KARLILIK (NET PROFITABILITY)
    # ============================================
    
    def get_net_profitability(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        days: int = 30
    ) -> Dict:
        """
        Gerçek Karlılık Analizi
        
        - Brüt Kar (Gross Profit): Her satış için (Satış Fiyatı - Ürün Maliyeti)
        - Net Kar (Net Profit): Toplam Brüt Kar - Operasyonel Giderler
        - Brüt Kar Marjı % (Gross Margin)
        
        Returns:
            {
                "period": {"start": "...", "end": "..."},
                "revenue": float,
                "cost_of_goods_sold": float,
                "gross_profit": float,
                "gross_margin_percent": float,
                "operational_expenses": float,
                "net_profit": float,
                "net_margin_percent": float,
                "warning": str | None  # Eğer marj %20'den düşükse uyarı
            }
        """
        try:
            # Tarih aralığını belirle
            if isinstance(end_date, str):
                try:
                    end_date = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                except Exception:
                    end_date = datetime.strptime(end_date, "%Y-%m-%d")
            if isinstance(start_date, str):
                try:
                    start_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                except Exception:
                    start_date = datetime.strptime(start_date, "%Y-%m-%d")

            if end_date is None:
                end_date = datetime.now()
            if start_date is None:
                if days == 1:
                    start_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
                else:
                    start_date = end_date - timedelta(days=days)
            
            # 1) CİRO (Revenue): Single Source of Truth
            # POS Satışları (SaleOrder) + Online/Eski Siparişler (Order)
            # ZERO-SAFE SaleOrder.final_amount, tamamlanmış satışlar, silinmemiş
            # Veresiye (DEBT) dahil: Satış anında tahakkuk eder.
            # Virman, Tahsilat ve kasa transferleri KESİNLİKLE satış cirosuna dahil edilmez!
            effective_pos_amt = get_sale_order_effective_amount_column()

            pos_sales_row = (
                self.db.query(
                    func.coalesce(func.sum(effective_pos_amt), 0.0).label("revenue"),
                    func.coalesce(func.sum(SaleOrder.total_profit), 0.0).label("profit"),
                )
                .filter(
                    and_(
                        SaleOrder.created_at >= start_date,
                        SaleOrder.created_at <= end_date,
                        SaleOrder.is_deleted == False,
                        SaleOrder.status == SalesOrderStatus.COMPLETED,
                    )
                )
                .first()
            )
            pos_revenue = float(pos_sales_row.revenue or 0.0) if pos_sales_row else 0.0
            pos_profit = float(pos_sales_row.profit or 0.0) if pos_sales_row else 0.0

            # POS COGS: Tamamlanmış siparişlerde satılan ürünlerin gerçek maliyet toplamı (SaleOrderItem)
            pos_cogs = (
                self.db.query(
                    func.coalesce(func.sum(SaleOrderItem.quantity * func.coalesce(SaleOrderItem.unit_cost, 0.0)), 0.0)
                )
                .join(SaleOrder, SaleOrder.id == SaleOrderItem.order_id)
                .filter(
                    and_(
                        SaleOrder.created_at >= start_date,
                        SaleOrder.created_at <= end_date,
                        SaleOrder.is_deleted == False,
                        SaleOrder.status == SalesOrderStatus.COMPLETED,
                    )
                )
                .scalar()
                or 0.0
            )

            # Online / Eski Siparişler (Order & OrderItem)
            orders_revenue = (
                self.db.query(func.coalesce(func.sum(Order.final_amount), 0.0))
                .filter(
                    and_(
                        Order.created_at >= start_date,
                        Order.created_at <= end_date,
                        Order.is_deleted == False,
                        Order.status == "completed",
                    )
                )
                .scalar()
                or 0.0
            )

            orders_cogs = (
                self.db.query(
                    func.coalesce(func.sum(OrderItem.unit_buy_price * OrderItem.quantity), 0.0)
                )
                .join(Order, OrderItem.order_id == Order.id)
                .filter(
                    and_(
                        Order.created_at >= start_date,
                        Order.created_at <= end_date,
                        Order.is_deleted == False,
                        Order.status == "completed",
                    )
                )
                .scalar()
                or 0.0
            )

            orders_profit_query = (
                self.db.query(
                    func.coalesce(
                        func.sum(
                            ((OrderItem.unit_sell_price * OrderItem.quantity - func.coalesce(OrderItem.discount, 0.0)) /
                             (1.0 + func.coalesce(Product.tax_rate, 18.0) / 100.0)) -
                            (OrderItem.unit_buy_price * OrderItem.quantity)
                        ),
                        0.0
                    )
                )
                .join(Order, OrderItem.order_id == Order.id)
                .outerjoin(Product, OrderItem.product_id == Product.id)
                .filter(
                    and_(
                        Order.created_at >= start_date,
                        Order.created_at <= end_date,
                        Order.is_deleted == False,
                        Order.status == "completed",
                    )
                )
                .scalar()
            )
            orders_profit = float(orders_profit_query or 0.0)

            # 2) BİRLEŞİK FİNANSAL METRİKLER (Single Source of Truth)
            revenue = round_money(pos_revenue + orders_revenue)
            cost_of_goods_sold = round_money(pos_cogs + orders_cogs)
            gross_profit = round_money(pos_profit + orders_profit)

            # 3) BRÜT KÂR MARJI %
            gross_margin_percent = round_money((gross_profit / revenue * 100), 2) if revenue > 0 else 0.0

            # 4) OPERASYONEL GİDERLER (OpEx): Transaction tablosundan EXPENSE (Virman HARIÇ)
            operational_expenses_query = self.db.query(
                func.coalesce(func.sum(Transaction.amount), 0.0)
            ).filter(
                and_(
                    Transaction.created_at >= start_date,
                    Transaction.created_at <= end_date,
                    Transaction.is_deleted == False,
                    Transaction.type == TransactionType.EXPENSE,
                    func.lower(func.coalesce(Transaction.category, '')).notin_(['virman', 'transfer']),
                )
            )
            operational_expenses = round_money(operational_expenses_query.scalar() or 0.0)

            # 5) NET KÂR
            net_profit = round_money(gross_profit - operational_expenses)

            # 6) NET KÂR MARJI %
            net_margin_percent = round_money((net_profit / revenue * 100), 2) if revenue > 0 else 0.0

            # 7) UYARI
            warning = None
            if gross_margin_percent < 20.0 and revenue > 0:
                warning = f"⚠️ Düşük Kar Marjı: Brüt kar marjınız %{gross_margin_percent:.1f}. Bu, maliyetlerinizin çok yüksek olduğunu gösteriyor. Ürün fiyatlandırmasını veya maliyet yönetimini gözden geçirin."

            return {
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                },
                "revenue": revenue,
                "pos_revenue": round_money(pos_revenue),
                "cost_of_goods_sold": cost_of_goods_sold,
                "gross_profit": gross_profit,
                "gross_margin_percent": gross_margin_percent,
                "operational_expenses": operational_expenses,
                "net_profit": net_profit,
                "net_margin_percent": net_margin_percent,
                "warning": warning,
                "pos_profit": round_money(pos_profit)
            }
        except Exception as e:
            import traceback
            print(f"[ERROR] Net profitability hesaplanırken hata: {str(e)}")
            print(traceback.format_exc())
            return {
                "period": {"start": "", "end": ""},
                "revenue": 0.0,
                "pos_revenue": 0.0,
                "cost_of_goods_sold": 0.0,
                "gross_profit": 0.0,
                "gross_margin_percent": 0.0,
                "operational_expenses": 0.0,
                "net_profit": 0.0,
                "net_margin_percent": 0.0,
                "warning": None,
                "pos_profit": 0.0
            }
    
    # ============================================
    # MODÜL 2: AKILLI GİDER ANALİZİ (EXPENSE BREAKDOWN)
    # ============================================
    
    def get_expense_breakdown(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        days: int = 30
    ) -> Dict:
        """
        Akıllı Gider Analizi
        
        - Giderleri kategorize et (Personel, Tedarik, Kira, Pazarlama)
        - Her gider kaleminin toplam ciro içindeki payını (%) hesapla
        - Anomaly Detection: Son 3 ayın ortalamasından %20 fazlaysa uyarı
        
        Returns:
            {
                "period": {"start": "...", "end": "..."},
                "total_revenue": float,
                "total_expenses": float,
                "expense_to_revenue_ratio": float,
                "categories": [
                    {
                        "category": str,
                        "amount": float,
                        "percentage_of_revenue": float,
                        "percentage_of_total_expenses": float,
                        "is_anomaly": bool,
                        "anomaly_reason": str | None
                    }
                ]
            }
        """
        try:
            # Tarih aralığını belirle
            if end_date is None:
                end_date = datetime.now()
            if start_date is None:
                if days == 1:
                    start_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
                else:
                    start_date = end_date - timedelta(days=days)
            
            # Toplam ciro (Unified Revenue: SaleOrder + Order)
            rev_dict = calculate_unified_revenue(self.db, start_date=start_date, end_date=end_date)
            total_revenue = rev_dict["total_revenue"]
            
            # Mevcut dönem giderleri (kategori bazında, Virman HARIÇ)
            current_expenses_query = self.db.query(
                Transaction.category,
                func.sum(Transaction.amount).label('total')
            ).filter(
                and_(
                    Transaction.created_at >= start_date,
                    Transaction.created_at <= end_date,
                    Transaction.is_deleted == False,
                    Transaction.type == TransactionType.EXPENSE,
                    func.lower(func.coalesce(Transaction.category, '')).notin_(['virman', 'transfer']),
                )
            ).group_by(Transaction.category).all()
            
            current_expenses_dict = {cat or "Diğer": float(total) for cat, total in current_expenses_query}
            total_expenses = sum(current_expenses_dict.values())
            
            # Son 3 ayın ortalaması (anomali tespiti için)
            three_months_ago = start_date - timedelta(days=90)
            historical_expenses_query = self.db.query(
                Transaction.category,
                func.sum(Transaction.amount).label('total')
            ).filter(
                and_(
                    Transaction.created_at >= three_months_ago,
                    Transaction.created_at < start_date,
                    Transaction.is_deleted == False,
                    Transaction.type == TransactionType.EXPENSE,
                    func.lower(func.coalesce(Transaction.category, '')).notin_(['virman', 'transfer']),
                )
            ).group_by(Transaction.category).all()
            
            # Kategori bazında 3 aylık ortalama (90 gün / 30 gün = 3 ay)
            historical_avg_dict = {}
            for cat, total in historical_expenses_query:
                category = cat or "Diğer"
                # 3 aylık toplamı 30 güne normalize et (ortalama günlük * 30)
                days_in_period = (start_date - three_months_ago).days
                avg_daily = float(total) / days_in_period if days_in_period > 0 else 0.0
                avg_monthly = avg_daily * 30.0
                historical_avg_dict[category] = avg_monthly
            
            # Kategorileri oluştur ve anomali kontrolü yap
            categories = []
            for category, amount in current_expenses_dict.items():
                percentage_of_revenue = (amount / total_revenue * 100) if total_revenue > 0 else 0.0
                percentage_of_total_expenses = (amount / total_expenses * 100) if total_expenses > 0 else 0.0
                
                # Anomali tespiti: Mevcut dönem, son 3 ayın ortalamasından %20 fazlaysa
                is_anomaly = False
                anomaly_reason = None
                historical_avg = historical_avg_dict.get(category, 0.0)
                
                if historical_avg > 0:
                    increase_percent = ((amount - historical_avg) / historical_avg * 100) if historical_avg > 0 else 0.0
                    if increase_percent > 20.0:
                        is_anomaly = True
                        anomaly_reason = f"Bu gider kalemi, son 3 ayın ortalamasından %{increase_percent:.1f} daha yüksek. Olağandışı bir artış var."
                
                categories.append({
                    "category": category,
                    "amount": round(amount, 2),
                    "percentage_of_revenue": round(percentage_of_revenue, 2),
                    "percentage_of_total_expenses": round(percentage_of_total_expenses, 2),
                    "is_anomaly": is_anomaly,
                    "anomaly_reason": anomaly_reason
                })
            
            # Kategoriye göre sırala (en yüksekten en düşüğe)
            categories.sort(key=lambda x: x["amount"], reverse=True)
            
            expense_to_revenue_ratio = (total_expenses / total_revenue * 100) if total_revenue > 0 else 0.0
            
            return {
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                },
                "total_revenue": round(total_revenue, 2),
                "total_expenses": round(total_expenses, 2),
                "expense_to_revenue_ratio": round(expense_to_revenue_ratio, 2),
                "categories": categories
            }
        except Exception as e:
            import traceback
            print(f"[ERROR] Expense breakdown hesaplanırken hata: {str(e)}")
            print(traceback.format_exc())
            return {
                "period": {"start": "", "end": ""},
                "total_revenue": 0.0,
                "total_expenses": 0.0,
                "expense_to_revenue_ratio": 0.0,
                "categories": []
            }
    
    # ============================================
    # MODÜL 3: GELİŞMİŞ TREND VE PROJEKSİYON (ADVANCED PROJECTION)
    # ============================================
    
    def get_advanced_projection(
        self,
        target_month: Optional[int] = None,
        target_year: Optional[int] = None
    ) -> Dict:
        """
        Gelişmiş Trend ve Projeksiyon Analizi
        
        - Pace (Hız) Analizi: Bugünün şu anki saati ile geçen ayın aynı günlerinin kümülatif cirosunu kıyasla
        - Ay Sonu Tahmini (Run Rate Prediction): Ağırlıklı ortalama ile ayın geri kalanı için tahmini ciro
        - Mevsimsellik (Seasonality): Hafta sonu çarpanı
        
        Args:
            target_month: Hedef ay (1-12). None ise mevcut ay.
            target_year: Hedef yıl. None ise mevcut yıl.
        
        Returns:
            {
                "target_period": {"month": int, "year": int},
                "pace_analysis": {
                    "current_time": str,
                    "current_cumulative_revenue": float,
                    "last_month_same_day_cumulative": float,
                    "last_week_same_day_cumulative": float,
                    "pace_vs_last_month_percent": float,
                    "pace_vs_last_week_percent": float,
                    "status": str  # "ahead", "behind", "on_track"
                },
                "month_end_projection": {
                    "current_revenue": float,
                    "days_completed": int,
                    "days_remaining": int,
                    "last_7_days_avg": float,
                    "weighted_avg": float,
                    "projected_revenue": float,
                    "confidence": str  # "high", "medium", "low"
                },
                "seasonality": {
                    "weekend_multiplier": float,
                    "weekday_avg": float,
                    "weekend_avg": float
                }
            }
        """
        try:
            now = datetime.now()
            target_month = target_month or now.month
            target_year = target_year or now.year
            
            # Hedef ayın başlangıç ve bitiş tarihleri
            month_start = datetime(target_year, target_month, 1)
            if target_month == 12:
                month_end = datetime(target_year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = datetime(target_year, target_month + 1, 1) - timedelta(days=1)
            
            # Bugünün tarihi ve saati
            current_date = now.date()
            current_time = now.time()
            current_hour = current_time.hour
            current_minute = current_time.minute
            current_time_str = f"{current_hour:02d}:{current_minute:02d}"
            
            # Bugünün günü (0=Monday, 6=Sunday)
            current_weekday = now.weekday()
            
            # ============================================
            # PACE ANALİZİ
            # ============================================
            
            # Bugünün şu anki kümülatif cirosu (bugün saat X'e kadar)
            today_revenue_query = self.db.query(
                func.sum(Order.final_amount).label('total')
            ).filter(
                and_(
                    func.date(Order.created_at) == current_date,
                    func.extract('hour', Order.created_at) <= current_hour,
                    func.extract('minute', Order.created_at) <= current_minute,
                    Order.is_deleted == False,
                    Order.status == 'completed'
                )
            )
            current_cumulative_revenue = today_revenue_query.scalar() or 0.0
            
            # Geçen ayın aynı günlerinin (aynı hafta günü) kümülatif cirosu
            last_month = target_month - 1 if target_month > 1 else 12
            last_month_year = target_year if target_month > 1 else target_year - 1
            
            # Geçen ayın aynı hafta günlerini bul (örn: bugün Salı ise, geçen ayın tüm Salı günleri)
            last_month_same_weekday_revenue = 0.0
            last_month_start = datetime(last_month_year, last_month, 1)
            if last_month == 12:
                last_month_end = datetime(last_month_year + 1, 1, 1) - timedelta(days=1)
            else:
                last_month_end = datetime(last_month_year, last_month + 1, 1) - timedelta(days=1)
            
            # Geçen ayın aynı hafta günlerinde, bugünün saatine kadar olan ciroları topla
            for day_offset in range(0, 32):  # Max 31 gün
                check_date = last_month_start + timedelta(days=day_offset)
                if check_date > last_month_end:
                    break
                if check_date.weekday() == current_weekday:
                    # Bu günün bugünkü saatine kadar olan cirosunu al
                    day_revenue_query = self.db.query(
                        func.sum(Order.final_amount).label('total')
                    ).filter(
                        and_(
                            func.date(Order.created_at) == check_date.date(),
                            func.extract('hour', Order.created_at) <= current_hour,
                            func.extract('minute', Order.created_at) <= current_minute,
                            Order.is_deleted == False,
                            Order.status == 'completed'
                        )
                    )
                    day_revenue = day_revenue_query.scalar() or 0.0
                    last_month_same_weekday_revenue += day_revenue
            
            # Geçen haftanın aynı günü (7 gün önce)
            last_week_date = current_date - timedelta(days=7)
            last_week_same_day_query = self.db.query(
                func.sum(Order.final_amount).label('total')
            ).filter(
                and_(
                    func.date(Order.created_at) == last_week_date,
                    func.extract('hour', Order.created_at) <= current_hour,
                    func.extract('minute', Order.created_at) <= current_minute,
                    Order.is_deleted == False,
                    Order.status == 'completed'
                )
            )
            last_week_same_day_cumulative = last_week_same_day_query.scalar() or 0.0
            
            # Pace karşılaştırması
            pace_vs_last_month_percent = 0.0
            if last_month_same_weekday_revenue > 0:
                pace_vs_last_month_percent = ((current_cumulative_revenue - last_month_same_weekday_revenue) / last_month_same_weekday_revenue * 100)
            
            pace_vs_last_week_percent = 0.0
            if last_week_same_day_cumulative > 0:
                pace_vs_last_week_percent = ((current_cumulative_revenue - last_week_same_day_cumulative) / last_week_same_day_cumulative * 100)
            
            # Pace durumu
            if pace_vs_last_month_percent > 10:
                pace_status = "ahead"
            elif pace_vs_last_month_percent < -10:
                pace_status = "behind"
            else:
                pace_status = "on_track"
            
            # ============================================
            # AY SONU TAHMİNİ (RUN RATE PREDICTION)
            # ============================================
            
            # Mevcut ayın tamamlanmış günlerinin cirosu
            days_completed = min((current_date - month_start.date()).days + 1, (month_end.date() - month_start.date()).days + 1)
            days_remaining = max(0, (month_end.date() - current_date).days)
            
            current_revenue_query = self.db.query(
                func.sum(Order.final_amount).label('total')
            ).filter(
                and_(
                    Order.created_at >= month_start,
                    Order.created_at <= now,
                    Order.is_deleted == False,
                    Order.status == 'completed'
                )
            )
            current_revenue = current_revenue_query.scalar() or 0.0
            
            # Son 7 günlük hareketli ortalama (ağırlıklı: son günler daha önemli)
            last_7_days_start = now - timedelta(days=7)
            last_7_days_revenue_query = self.db.query(
                func.date(Order.created_at).label('date'),
                func.sum(Order.final_amount).label('daily_total')
            ).filter(
                and_(
                    Order.created_at >= last_7_days_start,
                    Order.created_at <= now,
                    Order.is_deleted == False,
                    Order.status == 'completed'
                )
            ).group_by(func.date(Order.created_at)).all()
            
            # Ağırlıklı ortalama: Son günler daha yüksek ağırlık
            weighted_sum = 0.0
            weight_sum = 0.0
            for idx, (date, daily_total) in enumerate(last_7_days_revenue_query):
                weight = idx + 1  # Son gün en yüksek ağırlık
                weighted_sum += float(daily_total or 0.0) * weight
                weight_sum += weight
            
            last_7_days_avg = weighted_sum / weight_sum if weight_sum > 0 else 0.0
            
            # Basit ortalama (karşılaştırma için)
            simple_avg = sum(float(total) for _, total in last_7_days_revenue_query) / len(last_7_days_revenue_query) if last_7_days_revenue_query else 0.0
            
            # Tahmini ciro: Mevcut ciro + (Kalan gün sayısı * Ağırlıklı ortalama)
            projected_revenue = current_revenue + (days_remaining * last_7_days_avg)
            
            # Güven seviyesi
            if days_completed >= 15:  # Ayın yarısı geçmişse
                confidence = "high"
            elif days_completed >= 7:
                confidence = "medium"
            else:
                confidence = "low"
            
            # ============================================
            # MEVSİMSELLİK (SEASONALITY)
            # ============================================
            
            # Son 30 günün hafta içi ve hafta sonu ortalamaları
            thirty_days_ago = now - timedelta(days=30)
            weekday_revenues = []
            weekend_revenues = []
            
            weekday_query = self.db.query(
                func.sum(Order.final_amount).label('total')
            ).filter(
                and_(
                    Order.created_at >= thirty_days_ago,
                    Order.created_at <= now,
                    func.extract('dow', Order.created_at).in_([1, 2, 3, 4, 5]),  # Mon-Fri (PostgreSQL: 1=Mon)
                    Order.is_deleted == False,
                    Order.status == 'completed'
                )
            )
            weekday_total = weekday_query.scalar() or 0.0
            
            weekend_query = self.db.query(
                func.sum(Order.final_amount).label('total')
            ).filter(
                and_(
                    Order.created_at >= thirty_days_ago,
                    Order.created_at <= now,
                    func.extract('dow', Order.created_at).in_([0, 6]),  # Sat-Sun (PostgreSQL: 0=Sun, 6=Sat)
                    Order.is_deleted == False,
                    Order.status == 'completed'
                )
            )
            weekend_total = weekend_query.scalar() or 0.0
            
            # Hafta içi ve hafta sonu gün sayıları (yaklaşık)
            weekday_days = 22  # 30 günde yaklaşık 22 hafta içi
            weekend_days = 8   # 30 günde yaklaşık 8 hafta sonu
            
            weekday_avg = weekday_total / weekday_days if weekday_days > 0 else 0.0
            weekend_avg = weekend_total / weekend_days if weekend_days > 0 else 0.0
            
            weekend_multiplier = (weekend_avg / weekday_avg) if weekday_avg > 0 else 1.0
            
            return {
                "target_period": {
                    "month": target_month,
                    "year": target_year
                },
                "pace_analysis": {
                    "current_time": current_time_str,
                    "current_cumulative_revenue": round(current_cumulative_revenue, 2),
                    "last_month_same_day_cumulative": round(last_month_same_weekday_revenue, 2),
                    "last_week_same_day_cumulative": round(last_week_same_day_cumulative, 2),
                    "pace_vs_last_month_percent": round(pace_vs_last_month_percent, 2),
                    "pace_vs_last_week_percent": round(pace_vs_last_week_percent, 2),
                    "status": pace_status
                },
                "month_end_projection": {
                    "current_revenue": round(current_revenue, 2),
                    "days_completed": days_completed,
                    "days_remaining": days_remaining,
                    "last_7_days_avg": round(last_7_days_avg, 2),
                    "weighted_avg": round(last_7_days_avg, 2),
                    "projected_revenue": round(projected_revenue, 2),
                    "confidence": confidence
                },
                "seasonality": {
                    "weekend_multiplier": round(weekend_multiplier, 2),
                    "weekday_avg": round(weekday_avg, 2),
                    "weekend_avg": round(weekend_avg, 2)
                }
            }
        except Exception as e:
            import traceback
            print(f"[ERROR] Advanced projection hesaplanırken hata: {str(e)}")
            print(traceback.format_exc())
            return {
                "target_period": {"month": 0, "year": 0},
                "pace_analysis": {
                    "current_time": "",
                    "current_cumulative_revenue": 0.0,
                    "last_month_same_day_cumulative": 0.0,
                    "last_week_same_day_cumulative": 0.0,
                    "pace_vs_last_month_percent": 0.0,
                    "pace_vs_last_week_percent": 0.0,
                    "status": "unknown"
                },
                "month_end_projection": {
                    "current_revenue": 0.0,
                    "days_completed": 0,
                    "days_remaining": 0,
                    "last_7_days_avg": 0.0,
                    "weighted_avg": 0.0,
                    "projected_revenue": 0.0,
                    "confidence": "low"
                },
                "seasonality": {
                    "weekend_multiplier": 1.0,
                    "weekday_avg": 0.0,
                    "weekend_avg": 0.0
                }
            }

    # ============================================
    # MODÜL 4: SATIŞ ISI HARİTASI (WEEKLY HEATMAP)
    # ============================================

    def get_weekly_sales_heatmap(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        hours_start: int = 9,
        hours_end: int = 18,
    ) -> Dict:
        """
        Haftalık Satış Isı Haritası (Mon–Sun, 09:00–18:00)

        Kaynaklar:
        - Order (orders) -> final_amount (completed)
        - SaleOrder (sales) -> total_amount (completed)
        """
        now = datetime.now()

        # start_date verilirse:
        # - Isı haritası "hafta" sınırlarını (Pzt 00:00 -> +7 gün) bu tarihin haftasına göre belirler
        # - Aynı zamanda filtre başlangıcı olarak kullanılır (örn: reset_timestamp)
        anchor = start_date or now
        week_start = (anchor - timedelta(days=anchor.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        week_end = week_start + timedelta(days=7)

        # override (gerekirse)
        if end_date is None:
            end_date = week_end

        # filtre başlangıcı: haftanın başından önce olmasın
        filter_start = max(start_date, week_start) if start_date else week_start

        # normalize hours
        hours_start = max(0, min(23, int(hours_start)))
        hours_end = max(0, min(23, int(hours_end)))
        if hours_end < hours_start:
            hours_start, hours_end = hours_end, hours_start

        hours = list(range(hours_start, hours_end + 1))
        hour_labels = [f"{h:02d}:00" for h in hours]
        days = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
        values: List[List[float]] = [[0.0 for _ in range(7)] for _ in range(len(hours))]

        # 1) Orders (eski)
        try:
            order_rows = (
                self.db.query(Order.created_at, Order.final_amount)
                .filter(
                    and_(
                        Order.is_deleted == False,
                        Order.status == "completed",
                        Order.created_at >= filter_start,
                        Order.created_at < end_date,
                    )
                )
                .all()
            )
        except Exception:
            order_rows = []

        for created_at, amount in order_rows:
            if not created_at or not amount:
                continue
            d = created_at if isinstance(created_at, datetime) else None
            if not d:
                continue
            hour = d.hour
            if hour < hours_start or hour > hours_end:
                continue
            # Python: Monday=0 .. Sunday=6
            day_idx = d.weekday()
            if day_idx < 0 or day_idx > 6:
                continue
            row_idx = hour - hours_start
            values[row_idx][day_idx] += float(amount or 0.0)

        # 2) SaleOrders (yeni satış modülü)
        try:
            sale_rows = (
                self.db.query(SaleOrder.created_at, SaleOrder.total_amount)
                .filter(
                    and_(
                        SaleOrder.is_deleted == 0,
                        SaleOrder.status == SalesOrderStatus.COMPLETED,
                        SaleOrder.created_at >= filter_start,
                        SaleOrder.created_at < end_date,
                    )
                )
                .all()
            )
        except Exception:
            sale_rows = []

        for created_at, amount in sale_rows:
            if not created_at or not amount:
                continue
            d = created_at if isinstance(created_at, datetime) else None
            if not d:
                continue
            hour = d.hour
            if hour < hours_start or hour > hours_end:
                continue
            day_idx = d.weekday()
            if day_idx < 0 or day_idx > 6:
                continue
            row_idx = hour - hours_start
            values[row_idx][day_idx] += float(amount or 0.0)

        # round for stable JSON
        for r in range(len(values)):
            for c in range(len(values[r])):
                values[r][c] = round(values[r][c], 2)

        return {
            "start": week_start.isoformat(),
            "end": end_date.isoformat(),
            "hour_labels": hour_labels,
            "days": days,
            "values": values,
        }

    # ============================================
    # SYSTEM: FINANCE DATA RESET
    # ============================================

    def reset_finance_data(self) -> Dict:
        """
        Finance sayfasını besleyen DB verilerini temizler.

        Notlar:
        - Müşteriler silinmez; sadece bakiye 0'lanır (receivables/payables kartı için).
        - FK sorunlarını önlemek için çocuk tablolar önce silinir.
        """
        deleted: Dict[str, int] = {}

        # 1) Müşteri bakiyelerini sıfırla
        try:
            customers_zeroed = (
                self.db.query(Customer)
                .filter(Customer.balance != 0)
                .update({Customer.balance: 0.0}, synchronize_session=False)
            )
        except Exception:
            customers_zeroed = 0        # 2) İşlemler (kasa hareketleri) - Order FK'si var, önce bunu temizle
        deleted["transactions"] = self.db.query(Transaction).delete(synchronize_session=False)

        # 3) Yeni satış modülü
        deleted["sale_order_items"] = self.db.query(SaleOrderItem).delete(synchronize_session=False)
        deleted["sale_orders"] = self.db.query(SaleOrder).delete(synchronize_session=False)

        # 4) Eski order modülü
        deleted["order_items"] = self.db.query(OrderItem).delete(synchronize_session=False)
        deleted["orders"] = self.db.query(Order).delete(synchronize_session=False)

        self.db.commit()

        return {
            "deleted": deleted,
            "customers_zeroed": int(customers_zeroed or 0),
        }

    # ============================================
    # MODÜL 6: MALİ MÜŞAVİR / MUHASEBECİ PAKETİ
    # ============================================

    def get_accountant_package_data(self, year: int, month: int) -> Dict:
        """
        Mali Müşavir / Muhasebeci Paketi Veri Seti Üretici (SMMM Resmi Standartlarında)
        
        5 Ana Veri Seti:
        1. Satış Faturaları Listesi (e-Fatura + POS Z-Raporu Perakende İcmali, Matrah, KDV %1, %10, %20, Tevkifat, Genel Toplam)
        2. Alış Faturaları ve Tedarikçi/İşletme Giderleri Listesi
        3. Kasa ve Banka Muavin Defteri (Nakit tahsilat/tediye dökümü, yürüyen bakiye)
        4. Ay Sonu KDV Özeti ve Hesaplanan (391) / İndirilecek (191) KDV Dengesi
        5. Çek / Senet Portföy Durumu
        """
        import calendar
        from datetime import datetime
        from sqlalchemy import func, or_, and_
        from src.features.invoices.models import Invoice, InvoiceItem, InvoiceType
        from src.features.suppliers.models import Supplier
        from src.features.checks.models import Check, CheckType, CheckStatus

        if month < 1 or month > 12:
            raise ValueError("Ay 1 ile 12 arasında bir değer olmalıdır.")

        days_in_month = calendar.monthrange(year, month)[1]
        start_dt = datetime(year, month, 1, 0, 0, 0)
        end_dt = datetime(year, month, days_in_month, 23, 59, 59)
        start_date_str = f"{year:04d}-{month:02d}-01"
        end_date_str = f"{year:04d}-{month:02d}-{days_in_month:02d}"
        prefix_month_str = f"{year:04d}-{month:02d}"

        month_names_tr = {
            1: "Ocak", 2: "Şubat", 3: "Mart", 4: "Nisan", 5: "Mayıs", 6: "Haziran",
            7: "Temmuz", 8: "Ağustos", 9: "Eylül", 10: "Ekim", 11: "Kasım", 12: "Aralık"
        }
        month_name = month_names_tr.get(month, f"{month}. Ay")

        # ----------------------------------------------------
        # 1. SATIŞ FATURALARI & POS PERAKENDE İCMALİ
        # ----------------------------------------------------
        sales_inv_query = self.db.query(Invoice).filter(
            Invoice.is_deleted == False,
            Invoice.invoice_type == InvoiceType.SALES,
            or_(
                Invoice.invoice_date.startswith(prefix_month_str),
                and_(Invoice.invoice_date >= start_date_str, Invoice.invoice_date <= end_date_str),
                and_(Invoice.created_at >= start_dt, Invoice.created_at <= end_dt),
            )
        ).order_by(Invoice.invoice_date.asc(), Invoice.invoice_number.asc()).all()

        sales_invoices = []
        sales_391_by_rate = {
            1.0: {"matrah": 0.0, "vat": 0.0},
            10.0: {"matrah": 0.0, "vat": 0.0},
            20.0: {"matrah": 0.0, "vat": 0.0}
        }

        for inv in sales_inv_query:
            cust_name = f"{inv.customer.name} {inv.customer.last_name or ''}".strip() if inv.customer else "Nihai Tüketici"
            tax_num = getattr(inv.customer, 'tax_number', None) or getattr(inv.customer, 'tc_no', None) or "Nihai Tüketici"

            inv_vat_01 = 0.0
            inv_vat_10 = 0.0
            inv_vat_20 = 0.0
            inv_matrah_01 = 0.0
            inv_matrah_10 = 0.0
            inv_matrah_20 = 0.0

            if inv.items:
                for item in inv.items:
                    rate = float(item.vat_rate or 20.0)
                    vat_amt = float(item.vat_amount or 0.0)
                    base_amt = float(item.line_total or 0.0) - vat_amt
                    if round(rate) == 1:
                        inv_vat_01 += vat_amt
                        inv_matrah_01 += base_amt
                        sales_391_by_rate[1.0]["vat"] += vat_amt
                        sales_391_by_rate[1.0]["matrah"] += base_amt
                    elif round(rate) in (8, 10):
                        inv_vat_10 += vat_amt
                        inv_matrah_10 += base_amt
                        sales_391_by_rate[10.0]["vat"] += vat_amt
                        sales_391_by_rate[10.0]["matrah"] += base_amt
                    else:
                        inv_vat_20 += vat_amt
                        inv_matrah_20 += base_amt
                        sales_391_by_rate[20.0]["vat"] += vat_amt
                        sales_391_by_rate[20.0]["matrah"] += base_amt
            else:
                total_vat = float(inv.total_vat or 0.0)
                subtotal = float(inv.subtotal or 0.0)
                inv_vat_20 = total_vat
                inv_matrah_20 = subtotal
                sales_391_by_rate[20.0]["vat"] += total_vat
                sales_391_by_rate[20.0]["matrah"] += subtotal

            subtotal_val = float(inv.subtotal or (inv_matrah_01 + inv_matrah_10 + inv_matrah_20))
            total_val = float(inv.total_amount or (subtotal_val + inv_vat_01 + inv_vat_10 + inv_vat_20))

            sales_invoices.append({
                "invoice_number": inv.invoice_number,
                "date": inv.invoice_date or (inv.created_at.strftime("%Y-%m-%d") if inv.created_at else start_date_str),
                "customer_name": cust_name,
                "tax_number": tax_num,
                "subtotal": round(subtotal_val, 2),
                "vat_01": round(inv_vat_01, 2),
                "vat_10": round(inv_vat_10, 2),
                "vat_20": round(inv_vat_20, 2),
                "withholding_tax": 0.0,
                "total_amount": round(total_val, 2),
                "invoice_type": "Resmi Satış Faturası"
            })

        # POS Perakende Satışlar (SaleOrder)
        pos_orders = self.db.query(SaleOrder).filter(
            SaleOrder.is_deleted == False,
            SaleOrder.status == SalesOrderStatus.COMPLETED,
            SaleOrder.created_at >= start_dt,
            SaleOrder.created_at <= end_dt
        ).all()

        pos_summary = {
            "order_count": len(pos_orders),
            "total_revenue": 0.0,
            "matrah": 0.0,
            "vat_01": 0.0,
            "vat_10": 0.0,
            "vat_20": 0.0,
            "total_vat": 0.0,
        }

        if pos_orders:
            order_ids = [o.id for o in pos_orders]
            pos_items = self.db.query(SaleOrderItem).filter(
                SaleOrderItem.order_id.in_(order_ids)
            ).all()

            total_pos_effective = sum(
                float(o.final_amount if o.final_amount is not None and o.final_amount > 0 else o.total_amount)
                for o in pos_orders
            )

            for it in pos_items:
                qty = float(it.quantity or 1)
                u_price = float(it.unit_price or 0.0)
                disc = float(it.discount or 0.0)
                line_tot = max(0.0, (qty * u_price) - disc)

                rate = float(it.tax_rate or 20.0)
                vat_part = line_tot * (rate / (100.0 + rate))
                base_part = line_tot - vat_part

                if round(rate) == 1:
                    pos_summary["vat_01"] += vat_part
                    sales_391_by_rate[1.0]["vat"] += vat_part
                    sales_391_by_rate[1.0]["matrah"] += base_part
                elif round(rate) in (8, 10):
                    pos_summary["vat_10"] += vat_part
                    sales_391_by_rate[10.0]["vat"] += vat_part
                    sales_391_by_rate[10.0]["matrah"] += base_part
                else:
                    pos_summary["vat_20"] += vat_part
                    sales_391_by_rate[20.0]["vat"] += vat_part
                    sales_391_by_rate[20.0]["matrah"] += base_part

            total_vat_pos = pos_summary["vat_01"] + pos_summary["vat_10"] + pos_summary["vat_20"]
            pos_summary["total_vat"] = round(total_vat_pos, 2)
            pos_summary["total_revenue"] = round(total_pos_effective, 2)
            pos_summary["matrah"] = round(total_pos_effective - total_vat_pos, 2)
            pos_summary["vat_01"] = round(pos_summary["vat_01"], 2)
            pos_summary["vat_10"] = round(pos_summary["vat_10"], 2)
            pos_summary["vat_20"] = round(pos_summary["vat_20"], 2)

            sales_invoices.append({
                "invoice_number": f"Z-RAPORU-{year:04d}{month:02d}",
                "date": end_date_str,
                "customer_name": f"Perakende Satış Fişleri İcmali ({len(pos_orders)} Sipariş)",
                "tax_number": "Nihai Tüketici",
                "subtotal": pos_summary["matrah"],
                "vat_01": pos_summary["vat_01"],
                "vat_10": pos_summary["vat_10"],
                "vat_20": pos_summary["vat_20"],
                "withholding_tax": 0.0,
                "total_amount": pos_summary["total_revenue"],
                "invoice_type": "Perakende Satış İcmali"
            })

        # ----------------------------------------------------
        # 2. ALIŞ FATURALARI VE TEDARİKÇİ/İŞLETME GİDERLERİ
        # ----------------------------------------------------
        purch_inv_query = self.db.query(Invoice).filter(
            Invoice.is_deleted == False,
            Invoice.invoice_type == InvoiceType.PURCHASE,
            or_(
                Invoice.invoice_date.startswith(prefix_month_str),
                and_(Invoice.invoice_date >= start_date_str, Invoice.invoice_date <= end_date_str),
                and_(Invoice.created_at >= start_dt, Invoice.created_at <= end_dt),
            )
        ).order_by(Invoice.invoice_date.asc(), Invoice.invoice_number.asc()).all()

        purchase_invoices = []
        purch_191_by_rate = {
            1.0: {"matrah": 0.0, "vat": 0.0},
            10.0: {"matrah": 0.0, "vat": 0.0},
            20.0: {"matrah": 0.0, "vat": 0.0}
        }

        for inv in purch_inv_query:
            supp_name = inv.supplier.name if inv.supplier else "Genel Tedarikçi"
            cat = getattr(inv.supplier, 'category', None) or "Ticari Mal Alışı"
            subtotal = float(inv.subtotal or 0.0)
            vat_amt = float(inv.total_vat or 0.0)
            total_amt = float(inv.total_amount or (subtotal + vat_amt))

            if inv.items:
                for it in inv.items:
                    r = float(it.vat_rate or 20.0)
                    v = float(it.vat_amount or 0.0)
                    m = float(it.line_total or 0.0) - v
                    if round(r) == 1:
                        purch_191_by_rate[1.0]["vat"] += v
                        purch_191_by_rate[1.0]["matrah"] += m
                    elif round(r) in (8, 10):
                        purch_191_by_rate[10.0]["vat"] += v
                        purch_191_by_rate[10.0]["matrah"] += m
                    else:
                        purch_191_by_rate[20.0]["vat"] += v
                        purch_191_by_rate[20.0]["matrah"] += m
            else:
                purch_191_by_rate[20.0]["vat"] += vat_amt
                purch_191_by_rate[20.0]["matrah"] += subtotal

            purchase_invoices.append({
                "invoice_number": inv.invoice_number,
                "date": inv.invoice_date or (inv.created_at.strftime("%Y-%m-%d") if inv.created_at else start_date_str),
                "supplier_name": supp_name,
                "category": cat,
                "source_type": "Alış Faturası",
                "subtotal": round(subtotal, 2),
                "vat_amount": round(vat_amt, 2),
                "total_amount": round(total_amt, 2)
            })

        # İşletme Gider Fişleri (Transaction EXPENSE, fatura dışı)
        expense_tx_query = self.db.query(Transaction).filter(
            Transaction.is_deleted == False,
            Transaction.type == TransactionType.EXPENSE,
            Transaction.created_at >= start_dt,
            Transaction.created_at <= end_dt,
            func.lower(func.coalesce(Transaction.category, '')).notin_(['virman', 'transfer']),
            Transaction.source != TransactionSource.INVOICE
        ).order_by(Transaction.created_at.asc()).all()

        for tx in expense_tx_query:
            amt = float(tx.amount or 0.0)
            cat_lower = (tx.category or "").lower()
            if any(k in cat_lower for k in ["personel", "maaş", "avans", "sigorta", "sgk"]):
                matrah = amt
                vat = 0.0
            else:
                vat = round(amt * (20.0 / 120.0), 2)
                matrah = round(amt - vat, 2)
                purch_191_by_rate[20.0]["vat"] += vat
                purch_191_by_rate[20.0]["matrah"] += matrah

            purchase_invoices.append({
                "invoice_number": tx.reference_id or f"GDR-{tx.id[:8].upper()}",
                "date": tx.created_at.strftime("%Y-%m-%d"),
                "supplier_name": tx.description or tx.category or "Muhtelif Gider / Muhatap",
                "category": tx.category or "Genel İşletme Gideri",
                "source_type": "Gider Makbuzu / Fiş",
                "subtotal": matrah,
                "vat_amount": vat,
                "total_amount": round(amt, 2)
            })

        # ----------------------------------------------------
        # 3. KASA VE BANKA MUAVİN DEFTERİ
        # ----------------------------------------------------
        prior_incomes = self.db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(
            Transaction.is_deleted == False,
            Transaction.type == TransactionType.INCOME,
            Transaction.created_at < start_dt
        ).scalar() or 0.0

        prior_expenses = self.db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(
            Transaction.is_deleted == False,
            Transaction.type == TransactionType.EXPENSE,
            Transaction.created_at < start_dt
        ).scalar() or 0.0

        initial_balance = round(float(prior_incomes) - float(prior_expenses), 2)
        running_bal = initial_balance

        month_transactions = self.db.query(Transaction).filter(
            Transaction.is_deleted == False,
            Transaction.created_at >= start_dt,
            Transaction.created_at <= end_dt
        ).order_by(Transaction.created_at.asc()).all()

        cash_bank_ledger = []
        cash_bank_ledger.append({
            "date": start_date_str + " 00:00",
            "document_no": "DEVİR",
            "payment_source": "Kasa & Banka",
            "type": "Devir Bakiyesi",
            "category": "Açılış",
            "description": "Önceki Dönemden Devreden Kasa/Banka Bakiyesi",
            "inflow": initial_balance if initial_balance > 0 else 0.0,
            "outflow": abs(initial_balance) if initial_balance < 0 else 0.0,
            "running_balance": initial_balance
        })

        for tx in month_transactions:
            amt = float(tx.amount or 0.0)
            is_income = (tx.type == TransactionType.INCOME)
            inflow = amt if is_income else 0.0
            outflow = amt if not is_income else 0.0
            running_bal = round(running_bal + inflow - outflow, 2)

            p_source = "Kasa (Nakit)" if tx.payment_source == 'CASH' else "Banka Hesabı"
            tx_type_tr = "Tahsilat (Giriş)" if is_income else "Tediye (Çıkış)"

            cash_bank_ledger.append({
                "date": tx.created_at.strftime("%Y-%m-%d %H:%M"),
                "document_no": tx.reference_id or f"İŞL-{tx.id[:8].upper()}",
                "payment_source": p_source,
                "type": tx_type_tr,
                "category": tx.category or "Genel",
                "description": tx.description or tx.category or tx_type_tr,
                "inflow": inflow,
                "outflow": outflow,
                "running_balance": running_bal
            })

        # ----------------------------------------------------
        # 4. AY SONU KDV ÖZETİ (391 HESAPLANAN vs 191 İNDİRİLECEK)
        # ----------------------------------------------------
        total_391_vat = round(sales_391_by_rate[1.0]["vat"] + sales_391_by_rate[10.0]["vat"] + sales_391_by_rate[20.0]["vat"], 2)
        total_391_matrah = round(sales_391_by_rate[1.0]["matrah"] + sales_391_by_rate[10.0]["matrah"] + sales_391_by_rate[20.0]["matrah"], 2)

        total_191_vat = round(purch_191_by_rate[1.0]["vat"] + purch_191_by_rate[10.0]["vat"] + purch_191_by_rate[20.0]["vat"], 2)
        total_191_matrah = round(purch_191_by_rate[1.0]["matrah"] + purch_191_by_rate[10.0]["matrah"] + purch_191_by_rate[20.0]["matrah"], 2)

        net_vat = round(total_391_vat - total_191_vat, 2)
        payable_vat = net_vat if net_vat > 0 else 0.0
        carryover_vat = abs(net_vat) if net_vat < 0 else 0.0

        if net_vat > 0:
            vat_status = "ÖDENECEK KDV (360)"
            vat_desc = f"{payable_vat:,.2f} ₺ Vergi Dairesine Ödenecek KDV tahakkuk etmektedir."
        elif net_vat < 0:
            vat_status = "DEVREDEN KDV (190)"
            vat_desc = f"{carryover_vat:,.2f} ₺ Sonraki Döneme Devreden KDV alacağı kalmaktadır."
        else:
            vat_status = "BAŞABAŞ (0 ₺)"
            vat_desc = "Bu dönem hesaplanan ve indirilecek KDV birbirine eşittir."

        vat_summary = {
            "sales_vat_391": {
                "rate_01": {"matrah": round(sales_391_by_rate[1.0]["matrah"], 2), "vat": round(sales_391_by_rate[1.0]["vat"], 2)},
                "rate_10": {"matrah": round(sales_391_by_rate[10.0]["matrah"], 2), "vat": round(sales_391_by_rate[10.0]["vat"], 2)},
                "rate_20": {"matrah": round(sales_391_by_rate[20.0]["matrah"], 2), "vat": round(sales_391_by_rate[20.0]["vat"], 2)},
                "total_matrah": total_391_matrah,
                "total_vat": total_391_vat
            },
            "purchase_vat_191": {
                "rate_01": {"matrah": round(purch_191_by_rate[1.0]["matrah"], 2), "vat": round(purch_191_by_rate[1.0]["vat"], 2)},
                "rate_10": {"matrah": round(purch_191_by_rate[10.0]["matrah"], 2), "vat": round(purch_191_by_rate[10.0]["vat"], 2)},
                "rate_20": {"matrah": round(purch_191_by_rate[20.0]["matrah"], 2), "vat": round(purch_191_by_rate[20.0]["vat"], 2)},
                "total_matrah": total_191_matrah,
                "total_vat": total_191_vat
            },
            "net_vat": net_vat,
            "payable_vat": payable_vat,
            "carryover_vat": carryover_vat,
            "status": vat_status,
            "status_description": vat_desc
        }

        # ----------------------------------------------------
        # 5. ÇEK / SENET PORTFÖYÜ
        # ----------------------------------------------------
        checks_query = self.db.query(Check).filter(
            Check.is_deleted == False
        ).order_by(Check.due_date.asc()).all()

        status_labels = {
            CheckStatus.IN_PORTFOLIO: "Portföyde / Kasada",
            CheckStatus.COLLECTED: "Tahsil Edildi",
            CheckStatus.TRANSFERRED: "Ciro Edildi",
            CheckStatus.BOUNCED: "Karşılıksız",
        }

        type_labels = {
            CheckType.INCOMING: "Alınan Çek (Müşteri)",
            CheckType.OUTGOING: "Verilen Çek (Firma)",
        }

        checks_portfolio = []
        for c in checks_query:
            in_this_month = (
                (c.due_date and c.due_date.startswith(prefix_month_str)) or
                (c.issue_date and c.issue_date.startswith(prefix_month_str)) or
                (c.status == CheckStatus.IN_PORTFOLIO)
            )
            if not in_this_month:
                continue

            c_type_str = type_labels.get(c.check_type, "Alınan Çek" if str(c.check_type).upper() == "INCOMING" else "Verilen Çek")
            c_status_str = status_labels.get(c.status, str(c.status))
            contact = f"{c.customer.name} {c.customer.last_name or ''}".strip() if c.customer else (c.supplier.name if c.supplier else "")
            bank_info = f"{c.bank_name} / {c.branch_name}" if c.branch_name else c.bank_name

            checks_portfolio.append({
                "check_type": c_type_str,
                "check_number": c.check_number,
                "bank_branch": bank_info,
                "issuer": c.issuer,
                "contact_name": contact,
                "issue_date": c.issue_date,
                "due_date": c.due_date,
                "amount": round(float(c.amount or 0.0), 2),
                "status": c_status_str,
                "notes": c.notes or ""
            })

        return {
            "period": {
                "year": year,
                "month": month,
                "month_name": month_name,
                "label": f"{month_name} {year}",
                "start_date": start_date_str,
                "end_date": end_date_str
            },
            "sales_invoices": sales_invoices,
            "pos_sales_summary": pos_summary,
            "purchase_invoices": purchase_invoices,
            "cash_bank_ledger": cash_bank_ledger,
            "vat_summary": vat_summary,
            "checks_portfolio": checks_portfolio,
            "summary_counts": {
                "sales_count": len(sales_invoices),
                "purchase_count": len(purchase_invoices),
                "ledger_count": len(cash_bank_ledger),
                "checks_count": len(checks_portfolio)
            }
        }
