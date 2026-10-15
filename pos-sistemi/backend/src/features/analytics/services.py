"""
Analytics Service
Derinlemesine analiz ve raporlama servisi
"""

from typing import Dict, List, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_, or_, case


class AnalyticsService:
    """Analytics Service - Derinlemesine analiz"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_all_stats(self) -> Dict[str, Any]:
        """Tüm istatistikleri topla"""
        try:
            kpi = self._get_kpi_stats()
        except Exception as e:
            print(f"[ERROR] KPI stats hatasi: {e}")
            import traceback
            traceback.print_exc()
            kpi = {
                "total_revenue": 0.0,
                "net_profit": 0.0,
                "leakage": 0.0,
                "month_end_estimate": 0.0,
                "daily_average": 0.0,
            }
        
        try:
            shop = self._get_shop_stats()
        except Exception as e:
            print(f"[ERROR] Shop stats hatasi: {e}")
            import traceback
            traceback.print_exc()
            shop = {
                "hourly_density": {},
                "product_pareto": [],
                "basket_sizes": [],
                "payment_methods": [],
                "category_performance": [],
            }
        
        try:
            ecommerce = self._get_ecommerce_stats()
        except Exception as e:
            print(f"[ERROR] Ecommerce stats hatasi: {e}")
            import traceback
            traceback.print_exc()
            ecommerce = {
                "platform_daily": [],
                "platform_profitability": [],
                "return_rates": [],
            }
        
        try:
            staff = self._get_staff_stats()
        except Exception as e:
            print(f"[ERROR] Staff stats hatasi: {e}")
            import traceback
            traceback.print_exc()
            staff = {
                "staff_leaders": [],
            }
        
        return {
            "kpi": kpi,
            "shop": shop,
            "ecommerce": ecommerce,
            "staff": staff,
        }
    
    def _get_kpi_stats(self) -> Dict[str, Any]:
        """KPI İstatistikleri - Single Source of Truth (SaleOrder + Order)"""
        # Lazy import to avoid relationship mapping issues
        from src.features.orders.models import Order, OrderItem
        from src.features.sales.models import SaleOrder, SaleOrderItem, OrderStatus
        from src.features.sales.services import calculate_unified_revenue
        from src.features.transactions.models import Transaction, TransactionType
        from src.shared.utils.currency import round_money
        
        # Mevcut ay başlangıcı
        now = datetime.now()
        month_start = datetime(now.year, now.month, 1)
        
        # 1. Toplam Ciro (Mağaza SaleOrder + E-Ticaret Order)
        unified = calculate_unified_revenue(self.db, start_date=month_start)
        total_revenue = unified["total_revenue"]
        
        # 2. Toplam Maliyet (COGS: SaleOrderItem + OrderItem)
        pos_cost = self.db.query(
            func.coalesce(func.sum(SaleOrderItem.unit_cost * SaleOrderItem.quantity), 0.0)
        ).select_from(SaleOrderItem).join(
            SaleOrder, SaleOrder.id == SaleOrderItem.order_id
        ).filter(
            and_(
                SaleOrder.is_deleted == False,
                SaleOrder.status == OrderStatus.COMPLETED,
                SaleOrder.created_at >= month_start
            )
        ).scalar() or 0.0

        order_cost = self.db.query(
            func.coalesce(func.sum(OrderItem.unit_buy_price * OrderItem.quantity), 0.0)
        ).select_from(OrderItem).join(
            Order, Order.id == OrderItem.order_id
        ).filter(
            and_(
                Order.is_deleted == False,
                Order.status != "cancelled",
                Order.created_at >= month_start
            )
        ).scalar() or 0.0

        total_cost = float(pos_cost) + float(order_cost)
        
        # 3. Toplam Giderler (Transaction EXPENSE, Virman hariç)
        total_expenses = self.db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(
            and_(
                Transaction.type == TransactionType.EXPENSE,
                Transaction.is_deleted == False,
                Transaction.created_at >= month_start,
                Transaction.category != "VIRMAN",
                Transaction.category != "Virman"
            )
        ).scalar() or 0.0
        
        # 4. Net Kâr
        net_profit = total_revenue - total_cost - total_expenses
        
        # 5. Kaçak Analizi (İndirim + İptal/İade)
        pos_discount = self.db.query(func.coalesce(func.sum(SaleOrder.discount_amount), 0.0)).filter(
            and_(
                SaleOrder.is_deleted == False,
                SaleOrder.created_at >= month_start
            )
        ).scalar() or 0.0

        order_discount = self.db.query(func.coalesce(func.sum(Order.discount_value), 0.0)).filter(
            and_(
                Order.is_deleted == False,
                Order.created_at >= month_start
            )
        ).scalar() or 0.0
        
        pos_refund = self.db.query(func.coalesce(func.sum(SaleOrder.total_amount), 0.0)).filter(
            and_(
                SaleOrder.is_deleted == False,
                SaleOrder.status == OrderStatus.REFUNDED,
                SaleOrder.created_at >= month_start
            )
        ).scalar() or 0.0

        order_refund = self.db.query(func.coalesce(func.sum(Order.final_amount), 0.0)).filter(
            and_(
                Order.is_deleted == False,
                Order.status == "cancelled",
                Order.created_at >= month_start
            )
        ).scalar() or 0.0
        
        leakage = float(pos_discount) + float(order_discount) + float(pos_refund) + float(order_refund)
        
        # 6. Ay Sonu Tahmini
        current_day = now.day
        if now.month == 12:
            next_month_start = datetime(now.year + 1, 1, 1)
        else:
            next_month_start = datetime(now.year, now.month + 1, 1)
        days_in_month = (next_month_start - timedelta(days=1)).day
        daily_average = total_revenue / current_day if current_day > 0 else 0.0
        month_end_estimate = daily_average * days_in_month
        
        return {
            "total_revenue": round_money(total_revenue),
            "net_profit": round_money(net_profit),
            "leakage": round_money(leakage),
            "month_end_estimate": round_money(month_end_estimate),
            "daily_average": round_money(daily_average),
        }
    
    def _get_shop_stats(self) -> Dict[str, Any]:
        """Mağaza/Dükkan İstatistikleri (SaleOrder ve SaleOrderItem bazlı)"""
        # Lazy import to avoid relationship mapping issues
        from src.features.sales.models import SaleOrder, SaleOrderItem, OrderStatus
        from src.features.sales.services import get_sale_order_effective_amount_column
        from src.features.inventory.models import Product, Category
        from src.shared.utils.currency import round_money
        
        now = datetime.now()
        month_start = datetime(now.year, now.month, 1)
        effective_amt = get_sale_order_effective_amount_column()
        
        # Mağaza POS siparişleri
        shop_orders = self.db.query(SaleOrder).filter(
            and_(
                SaleOrder.is_deleted == False,
                SaleOrder.status == OrderStatus.COMPLETED,
                SaleOrder.created_at >= month_start
            )
        ).all()
        
        # Saatlik Yoğunluk
        hourly_density = {}
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        for order in shop_orders:
            if order.created_at:
                hour = order.created_at.hour
                day_idx = order.created_at.weekday()
                day = day_names[day_idx]
                key = f"{day}_{hour}"
                hourly_density[key] = hourly_density.get(key, 0) + 1
        
        # Ürün Pareto Analizi (SaleOrderItem)
        item_rev_expr = SaleOrderItem.unit_price * SaleOrderItem.quantity - func.coalesce(SaleOrderItem.discount, 0.0)
        product_revenue = self.db.query(
            SaleOrderItem.product_name,
            func.sum(item_rev_expr).label('revenue')
        ).select_from(SaleOrderItem).join(
            SaleOrder, SaleOrder.id == SaleOrderItem.order_id
        ).filter(
            and_(
                SaleOrder.is_deleted == False,
                SaleOrder.status == OrderStatus.COMPLETED,
                SaleOrder.created_at >= month_start
            )
        ).group_by(SaleOrderItem.product_name).order_by(
            func.sum(item_rev_expr).desc()
        ).limit(20).all()
        
        # Sepet Büyüklüğü (Histogram)
        basket_sizes = [
            round_money(order.final_amount if order.final_amount and order.final_amount > 0 else (order.total_amount - (order.discount_amount or 0.0)))
            for order in shop_orders
        ]
        
        # Ödeme Tercihleri
        payment_methods = self.db.query(
            SaleOrder.payment_method,
            func.count(SaleOrder.id).label('count'),
            func.sum(effective_amt).label('total')
        ).filter(
            and_(
                SaleOrder.is_deleted == False,
                SaleOrder.status == OrderStatus.COMPLETED,
                SaleOrder.created_at >= month_start
            )
        ).group_by(SaleOrder.payment_method).all()
        
        # Kategori Performansı
        category_performance = self.db.query(
            Category.name,
            func.sum(item_rev_expr).label('revenue')
        ).select_from(SaleOrderItem).join(
            SaleOrder, SaleOrder.id == SaleOrderItem.order_id
        ).join(
            Product, Product.id == SaleOrderItem.product_id
        ).join(
            Category, Category.id == Product.category_id
        ).filter(
            and_(
                SaleOrder.is_deleted == False,
                SaleOrder.status == OrderStatus.COMPLETED,
                SaleOrder.created_at >= month_start
            )
        ).group_by(Category.id, Category.name).all()
        
        return {
            "hourly_density": hourly_density,
            "product_pareto": [
                {"name": p[0], "revenue": round_money(float(p[1] or 0))}
                for p in product_revenue
            ],
            "basket_sizes": basket_sizes,
            "payment_methods": [
                {"method": str(p[0].value if hasattr(p[0], 'value') else p[0]) if p[0] else "CASH", "count": int(p[1] or 0), "total": round_money(float(p[2] or 0))}
                for p in payment_methods
            ],
            "category_performance": [
                {"name": c[0], "revenue": round_money(float(c[1] or 0))}
                for c in category_performance
            ],
        }
    
    def _get_ecommerce_stats(self) -> Dict[str, Any]:
        """E-Ticaret İstatistikleri (source == 'ONLINE')"""
        # Lazy import to avoid relationship mapping issues
        from src.features.orders.models import Order, OrderSource, MarketplacePlatform
        from src.shared.utils.currency import round_money
        
        now = datetime.now()
        month_start = datetime(now.year, now.month, 1)
        
        # Son 30 gün
        days_30_ago = now - timedelta(days=30)
        
        # Platform bazlı günlük ciro
        platform_daily = self.db.query(
            extract('day', Order.created_at).label('day'),
            Order.platform,
            func.sum(Order.final_amount).label('revenue')
        ).filter(
            and_(
                Order.is_deleted == False,
                Order.source == OrderSource.ONLINE,
                Order.created_at >= days_30_ago
            )
        ).group_by(
            extract('day', Order.created_at),
            Order.platform
        ).all()
        
        # Platform bazlı gerçek kârlılık
        platform_profitability = self.db.query(
            Order.platform,
            func.sum(Order.final_amount).label('gross_sales'),
            func.sum(Order.discount_value).label('discounts'),
            func.sum(
                case(
                    (Order.platform == MarketplacePlatform.TRENDYOL, Order.final_amount * 0.15),
                    (Order.platform == MarketplacePlatform.HEPSIBURADA, Order.final_amount * 0.12),
                    else_=Order.final_amount * 0.05
                )
            ).label('commissions')
        ).filter(
            and_(
                Order.is_deleted == False,
                Order.source == OrderSource.ONLINE,
                Order.status != "cancelled",
                Order.created_at >= month_start
            )
        ).group_by(Order.platform).all()
        
        # İade Oranları (Platform bazlı)
        return_rates = self.db.query(
            Order.platform,
            func.count(Order.id).label('total_orders'),
            func.sum(
                case(
                    (Order.status == "cancelled", 1),
                    else_=0
                )
            ).label('cancelled_orders')
        ).filter(
            and_(
                Order.is_deleted == False,
                Order.source == OrderSource.ONLINE,
                Order.created_at >= month_start
            )
        ).group_by(Order.platform).all()
        
        return {
            "platform_daily": [
                {
                    "day": int(p[0]) if p[0] is not None else 1,
                    "platform": p[1].value if hasattr(p[1], 'value') else str(p[1] or "LOCAL"),
                    "revenue": round_money(float(p[2] or 0))
                }
                for p in platform_daily
            ],
            "platform_profitability": [
                {
                    "platform": p[0].value if hasattr(p[0], 'value') else str(p[0] or "LOCAL"),
                    "gross_sales": round_money(float(p[1] or 0)),
                    "discounts": round_money(float(p[2] or 0)),
                    "commissions": round_money(float(p[3] or 0)),
                    "net_profit": round_money(float(p[1] or 0) - float(p[2] or 0) - float(p[3] or 0))
                }
                for p in platform_profitability
            ],
            "return_rates": [
                {
                    "platform": r[0].value if hasattr(r[0], 'value') else str(r[0] or "LOCAL"),
                    "total_orders": int(r[1] or 0),
                    "cancelled_orders": int(r[2] or 0),
                    "return_rate": round_money(float(r[2] / r[1] * 100) if r[1] > 0 else 0.0)
                }
                for r in return_rates
            ],
        }
    
    def _get_staff_stats(self) -> Dict[str, Any]:
        """Personel İstatistikleri (SaleOrder ve Order birleşik)"""
        # Lazy import to avoid relationship mapping issues
        from src.features.orders.models import Order
        from src.features.sales.models import SaleOrder, OrderStatus
        from src.features.sales.services import get_sale_order_effective_amount_column
        from src.features.auth.models import User
        from src.shared.utils.currency import round_money
        
        now = datetime.now()
        month_start = datetime(now.year, now.month, 1)
        
        users = self.db.query(User).filter(User.is_deleted == False).all()
        staff_map = {}
        for u in users:
            staff_map[u.id] = {
                "id": u.id,
                "name": u.full_name or "Bilinmeyen",
                "transaction_count": 0,
                "total_sales": 0.0,
                "avg_basket": 0.0
            }
        
        # 1. POS Satışları (SaleOrder)
        effective_amt = get_sale_order_effective_amount_column()
        pos_user_stats = self.db.query(
            SaleOrder.user_id,
            func.count(SaleOrder.id).label('count'),
            func.sum(effective_amt).label('total')
        ).filter(
            and_(
                SaleOrder.is_deleted == False,
                SaleOrder.status == OrderStatus.COMPLETED,
                SaleOrder.created_at >= month_start,
                SaleOrder.user_id.isnot(None)
            )
        ).group_by(SaleOrder.user_id).all()

        for uid, cnt, tot in pos_user_stats:
            if uid in staff_map:
                staff_map[uid]["transaction_count"] += int(cnt or 0)
                staff_map[uid]["total_sales"] += float(tot or 0.0)
            elif uid:
                staff_map[uid] = {
                    "id": uid,
                    "name": f"Kasiyer {uid[:6]}",
                    "transaction_count": int(cnt or 0),
                    "total_sales": float(tot or 0.0),
                    "avg_basket": 0.0
                }

        # 2. E-Ticaret / Diğer Siparişler (Order)
        order_user_stats = self.db.query(
            Order.user_id,
            func.count(Order.id).label('count'),
            func.sum(Order.final_amount).label('total')
        ).filter(
            and_(
                Order.is_deleted == False,
                Order.status != "cancelled",
                Order.created_at >= month_start,
                Order.user_id.isnot(None)
            )
        ).group_by(Order.user_id).all()

        for uid, cnt, tot in order_user_stats:
            if uid in staff_map:
                staff_map[uid]["transaction_count"] += int(cnt or 0)
                staff_map[uid]["total_sales"] += float(tot or 0.0)
            elif uid:
                staff_map[uid] = {
                    "id": uid,
                    "name": f"Kullanıcı {uid[:6]}",
                    "transaction_count": int(cnt or 0),
                    "total_sales": float(tot or 0.0),
                    "avg_basket": 0.0
                }

        leaders = []
        for s in staff_map.values():
            if s["transaction_count"] > 0:
                s["total_sales"] = round_money(s["total_sales"])
                s["avg_basket"] = round_money(s["total_sales"] / s["transaction_count"])
                leaders.append(s)

        leaders.sort(key=lambda x: x["total_sales"], reverse=True)
        return {"staff_leaders": leaders}

