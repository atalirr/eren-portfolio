"""
Dashboard Routers
FastAPI Routes - Dashboard Summary Endpoint
Gercek veritabani sorgulariyla canli dashboard istatistikleri
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta, date
from typing import Dict, Any

from src.shared.database.session import get_db
from src.features.transactions.models import Transaction, TransactionType
from src.features.inventory.models import Product
from src.features.sales.models import SaleOrder, SaleOrderItem, OrderStatus
from src.features.customers.models import Customer
from src.features.sales.services import calculate_unified_revenue
from src.shared.utils.currency import round_money


router = APIRouter()


@router.get("/test")
async def test_dashboard_route():
    """Test endpoint - Route'un calisip calismadigini kontrol et"""
    return {"status": "ok", "message": "Dashboard route calisiyor!"}


@router.get("/stats", response_model=Dict[str, Any])
async def get_dashboard_stats(
    db: Session = Depends(get_db)
):
    """
    Dashboard Summary - Tum metrikleri tek seferde getir.
    Gercek veritabani sorgulariyla canli veri dondurur.
    Single Source of Truth: Satis cirosu tamamlanan SaleOrder ve Order bazlidir;
    Tahsilat ve Virman islemleri ciroya dahil edilmez.
    """
    try:
        now = datetime.utcnow()
        today_start = datetime(now.year, now.month, now.day)
        yesterday_start = today_start - timedelta(days=1)

        # ── Gunluk Ciro & Islem Sayisi (Unified Sales Revenue) ──
        daily_revenue = 0.0
        transaction_count = 0
        try:
            today_rev_data = calculate_unified_revenue(db, start_date=today_start)
            daily_revenue = today_rev_data["total_revenue"]
            transaction_count = today_rev_data["total_order_count"]
        except Exception as e:
            print(f"[WARN] Dashboard daily revenue calc error: {e}")

        # ── Dunku Ciro ──
        yesterday_revenue = 0.0
        try:
            yesterday_rev_data = calculate_unified_revenue(db, start_date=yesterday_start, end_date=today_start)
            yesterday_revenue = yesterday_rev_data["total_revenue"]
        except Exception as e:
            print(f"[WARN] Dashboard yesterday revenue calc error: {e}")

        # ── Net Kasa (CASH bakiye) ──
        net_cash = 0.0
        try:
            income = db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(
                Transaction.type == TransactionType.INCOME,
                Transaction.is_deleted == False,
                Transaction.payment_source == "CASH"
            ).scalar() or 0
            expense = db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(
                Transaction.type == TransactionType.EXPENSE,
                Transaction.is_deleted == False,
                Transaction.payment_source == "CASH"
            ).scalar() or 0
            net_cash = round_money(float(income) - float(expense))
        except Exception as e:
            pass

        # ── Kritik Stok ──
        critical_stock = []
        try:
            critical_products = db.query(Product).filter(
                Product.is_deleted == False,
                Product.stock_quantity <= Product.critical_level
            ).order_by(Product.stock_quantity.asc()).limit(10).all()
            critical_stock = [
                {"id": p.id, "name": p.name, "stock": p.stock_quantity, "critical_level": p.critical_level}
                for p in critical_products
            ]
        except Exception as e:
            pass

        # ── Haftalik Trend (son 7 gun - Unified Sales Revenue) ──
        weekly_trend = []
        try:
            for i in range(6, -1, -1):
                day = today_start - timedelta(days=i)
                next_day = day + timedelta(days=1)
                day_data = calculate_unified_revenue(db, start_date=day, end_date=next_day)
                weekly_trend.append({
                    "date": day.strftime("%Y-%m-%d"),
                    "day_name": ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"][day.weekday()],
                    "revenue": day_data["total_revenue"]
                })
        except Exception as e:
            print(f"[WARN] Dashboard weekly trend calc error: {e}")

        # ── En Cok Satan Urunler (son 30 gun) ──
        top_products = []
        try:
            thirty_days_ago = today_start - timedelta(days=30)
            results = db.query(
                SaleOrderItem.product_name,
                func.sum(SaleOrderItem.quantity).label("total_qty"),
                func.sum(SaleOrderItem.quantity * SaleOrderItem.unit_price).label("total_revenue")
            ).join(SaleOrder, SaleOrder.id == SaleOrderItem.order_id).filter(
                SaleOrder.is_deleted == False,
                SaleOrder.status == OrderStatus.COMPLETED,
                SaleOrder.created_at >= thirty_days_ago
            ).group_by(SaleOrderItem.product_name).order_by(
                func.sum(SaleOrderItem.quantity).desc()
            ).limit(5).all()
            top_products = [
                {"name": r[0], "quantity": int(r[1] or 0), "revenue": round_money(float(r[2] or 0))}
                for r in results
            ]
        except Exception as e:
            print(f"[WARN] Dashboard top products calc error: {e}")

        # ── Ortalama Sepet Tutari (son 30 gun - Unified Sales Revenue) ──
        average_basket = 0.0
        try:
            thirty_days_ago = today_start - timedelta(days=30)
            thirty_days_data = calculate_unified_revenue(db, start_date=thirty_days_ago)
            average_basket = thirty_days_data["average_basket"]
        except Exception as e:
            print(f"[WARN] Dashboard average basket calc error: {e}")

        # ── Musteri Borclari ──
        supplier_debts = []
        try:
            debtors = db.query(Customer).filter(
                Customer.is_deleted == False,
                Customer.balance > 0
            ).order_by(Customer.balance.desc()).limit(5).all()
            supplier_debts = [
                {"name": f"{c.name} {c.last_name or ''}".strip(), "balance": round_money(c.balance)}
                for c in debtors
            ]
        except Exception as e:
            pass

        # ── Bugunun Odeme Dagilimi ──
        today_payments = []
        try:
            payments = db.query(
                Transaction.payment_method,
                func.sum(Transaction.amount).label("total")
            ).filter(
                Transaction.type == TransactionType.INCOME,
                Transaction.is_deleted == False,
                Transaction.created_at >= today_start,
                Transaction.category != "VIRMAN",
                Transaction.category != "Virman"
            ).group_by(Transaction.payment_method).all()
            today_payments = [
                {"method": str(p[0]) if p[0] else "CASH", "amount": round_money(float(p[1] or 0))}
                for p in payments
            ]
        except Exception as e:
            pass

        return {
            "daily_revenue": round_money(daily_revenue),
            "transaction_count": transaction_count,
            "net_cash": round_money(net_cash),
            "critical_stock": critical_stock,
            "weekly_trend": weekly_trend,
            "daily_trend": [],
            "top_products": top_products,
            "average_basket": round_money(average_basket),
            "yesterday_revenue": round_money(yesterday_revenue),
            "held_orders_count": 0,
            "today_payments": today_payments,
            "supplier_debts": supplier_debts,
        }

    except Exception as e:
        # Hata durumunda guvenli varsayilan degerler dondur
        print(f"[WARN] Dashboard stats hata: {e}")
        return {
            "daily_revenue": 0.0,
            "transaction_count": 0,
            "net_cash": 0.0,
            "critical_stock": [],
            "weekly_trend": [],
            "daily_trend": [],
            "top_products": [],
            "average_basket": 0.0,
            "yesterday_revenue": 0.0,
            "held_orders_count": 0,
            "today_payments": [],
            "supplier_debts": [],
        }
