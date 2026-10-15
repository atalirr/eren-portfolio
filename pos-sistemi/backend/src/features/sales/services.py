"""
Sales Services
Satış Modülü - İş Mantığı ve Servisler
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import math
import random
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case, or_

from src.features.sales.models import (
    SaleOrder,
    SaleOrderItem,
    PaymentMethod,
    SalesPlatform,
    OrderStatus,
)
from src.features.sales.schemas import OrderCreateSchema
from src.features.inventory.models import Product
from src.features.inventory.stock_movement import StockMovement, StockMovementReason
from src.features.transactions.models import Transaction, TransactionType, TransactionSource
from src.features.customers.models import Customer
from src.shared.utils.currency import round_money, to_decimal


def get_sale_order_effective_amount_column():
    """Returns SQLAlchemy expression for effective final amount of SaleOrder (Issue C1 Zero-Safe)."""
    return func.coalesce(
        case(
            (SaleOrder.final_amount > 0.0, SaleOrder.final_amount),
            else_=SaleOrder.total_amount - func.coalesce(SaleOrder.discount_amount, 0.0)
        ),
        SaleOrder.total_amount,
        0.0
    )


def calculate_unified_revenue(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Calculates authoritative, non-duplicated commercial sales revenue (Single Source of Truth).
    
    Guarantees:
    - POS sales (SaleOrder) are included across all payment methods (Cash, Card, Transfer, Debt, Split).
    - Online/legacy completed sales (Order) are included without duplication.
    - Virman, Tahsilat, Cari transfers, and internal cash movements are 100% excluded.
    - Soft-deleted (is_deleted=True) and cancelled/refunded sales are excluded.
    - Discounts are deducted; net final amounts are returned.
    """
    from src.features.orders.models import Order
    
    # 1. POS Sales Revenue (SaleOrder)
    pos_filters = [
        SaleOrder.is_deleted == False,
        SaleOrder.status == OrderStatus.COMPLETED,
    ]
    if start_date:
        pos_filters.append(SaleOrder.created_at >= start_date)
    if end_date:
        pos_filters.append(SaleOrder.created_at <= end_date)

    effective_pos_amt = get_sale_order_effective_amount_column()
    pos_result = (
        db.query(
            func.coalesce(func.sum(effective_pos_amt), 0.0).label("pos_revenue"),
            func.count(SaleOrder.id).label("pos_count"),
        )
        .filter(and_(*pos_filters))
        .first()
    )
    pos_revenue = float(pos_result.pos_revenue or 0.0) if pos_result else 0.0
    pos_count = int(pos_result.pos_count or 0) if pos_result else 0

    # 2. Online / E-Commerce / Non-duplicated Orders (Order)
    order_filters = [
        Order.is_deleted == False,
        Order.status == "completed",
    ]
    if start_date:
        order_filters.append(Order.created_at >= start_date)
    if end_date:
        order_filters.append(Order.created_at <= end_date)

    order_result = (
        db.query(
            func.coalesce(func.sum(Order.final_amount), 0.0).label("order_revenue"),
            func.count(Order.id).label("order_count"),
        )
        .filter(and_(*order_filters))
        .first()
    )
    order_revenue = float(order_result.order_revenue or 0.0) if order_result else 0.0
    order_count = int(order_result.order_count or 0) if order_result else 0

    total_revenue = pos_revenue + order_revenue
    total_count = pos_count + order_count

    return {
        "pos_revenue": round_money(pos_revenue),
        "pos_order_count": pos_count,
        "online_revenue": round_money(order_revenue),
        "online_order_count": order_count,
        "total_revenue": round_money(total_revenue),
        "total_order_count": total_count,
        "average_basket": round_money(total_revenue / total_count) if total_count > 0 else 0.0,
    }


class SalesService:
    """Sales Service - Atomik Satış İşlemi"""

    def __init__(self, db: Session):
        self.db = db

    def _generate_order_number(self) -> str:
        """Sipariş numarası oluştur (her zaman benzersiz olacak şekilde)"""
        for _ in range(10):
            timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
            rand_suffix = random.randint(100, 999)
            order_number = f"#S-{timestamp}-{rand_suffix}"
            
            exists = (
                self.db.query(SaleOrder)
                .filter(SaleOrder.order_number == order_number)
                .first()
            )
            if not exists:
                return order_number
        
        fallback_suffix = random.randint(100000, 999999)
        return f"#S-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{fallback_suffix}"

    def process_sale(
        self, order_data: OrderCreateSchema, user_id: str = "default-user"
    ) -> SaleOrder:
        """SATIŞ İŞLEMİ - Atomik Transaction"""
        from src.features.inventory.models import Product as ProductModel

        # ADIM 1: Ürünleri ve Stokları Kontrol Et
        items_to_process = []
        raw_subtotal = 0.0
        
        for item_data in order_data.items:
            product = (
                self.db.query(ProductModel)
                .filter(ProductModel.id == item_data.product_id)
                .with_for_update()
                .first()
            )

            if not product:
                raise ValueError(f"Ürün bulunamadı: {item_data.product_id}")

            if product.is_deleted:
                raise ValueError(f"Silinmiş ürün satılamaz: {product.name}")

            if product.stock_quantity < item_data.quantity:
                raise ValueError(
                    f"Yetersiz stok: {product.name} (Mevcut: {product.stock_quantity}, İstenen: {item_data.quantity})"
                )

            item_unit_price = float(item_data.price if item_data.price is not None else product.sell_price)
            item_cost = float(product.buy_price or 0.0)
            item_tax_rate = float(product.tax_rate if product.tax_rate is not None else 18.0)
            item_discount = float(item_data.discount or 0.0)

            line_gross = item_unit_price * item_data.quantity
            raw_subtotal += line_gross

            items_to_process.append(
                {
                    "product": product,
                    "quantity": item_data.quantity,
                    "unit_price": item_unit_price,
                    "unit_cost": item_cost,
                    "tax_rate": item_tax_rate,
                    "discount": item_discount,
                    "line_gross": line_gross,
                }
            )

        # ADIM 2: Sipariş ve Kalemleri Oluştur
        order_number = self._generate_order_number()
        gross_total = sum(it["line_gross"] for it in items_to_process)
        order_discount_amount = float(order_data.discount_amount or 0.0)
        if order_discount_amount == 0.0 and order_data.discount_value:
            d_type = str(order_data.discount_type or "").upper()
            if d_type in ["PERCENT", "PERCENTAGE"]:
                order_discount_amount = round_money((gross_total * float(order_data.discount_value)) / 100.0)
            elif d_type in ["FIXED", "AMOUNT"]:
                order_discount_amount = round_money(float(order_data.discount_value))
        effective_final_amount = max(0.0, gross_total - order_discount_amount)

        sale_order = SaleOrder(
            order_number=order_number,
            customer_id=order_data.customer_id,
            user_id=user_id,
            total_amount=round_money(gross_total),
            total_profit=0.0,
            payment_method=order_data.payment_method,
            platform=order_data.platform,
            status=OrderStatus.COMPLETED,
            discount_type=order_data.discount_type,
            discount_value=order_data.discount_value,
            discount_amount=round_money(order_discount_amount),
            final_amount=round_money(effective_final_amount),
        )
        self.db.add(sale_order)
        self.db.flush()

        # ADIM 3: Kalemleri Kaydet ve KDV'siz Matrah Üzerinden Kâr Hesapla
        total_profit = 0.0
        for item_info in items_to_process:
            prod = item_info["product"]
            qty = item_info["quantity"]
            u_price = item_info["unit_price"]
            u_cost = item_info["unit_cost"]
            tax_r = item_info["tax_rate"]
            i_disc = item_info["discount"]
            l_gross = item_info["line_gross"]

            if raw_subtotal > 0 and order_discount_amount > 0:
                item_order_discount_share = (l_gross / raw_subtotal) * order_discount_amount
            else:
                item_order_discount_share = 0.0

            total_item_discount = i_disc + item_order_discount_share
            effective_item_revenue = max(0.0, l_gross - total_item_discount)
            net_tax_exclusive_base = effective_item_revenue / (1.0 + (tax_r / 100.0))
            total_line_cost = u_cost * qty
            line_profit = net_tax_exclusive_base - total_line_cost

            order_item = SaleOrderItem(
                order_id=sale_order.id,
                product_id=prod.id,
                product_name=prod.name,
                quantity=qty,
                unit_price=round_money(u_price),
                unit_cost=round_money(u_cost),
                tax_rate=tax_r,
                discount=round_money(total_item_discount),
            )
            self.db.add(order_item)
            total_profit += line_profit

        sale_order.total_profit = round_money(total_profit)

        # ADIM 4: Stok Düşümü ve Loglama
        for item_info in items_to_process:
            prod = item_info["product"]
            qty = item_info["quantity"]

            prod.stock_quantity -= qty
            movement = StockMovement(
                product_id=prod.id,
                user_id=user_id,
                quantity_change=-int(qty),
                reason=StockMovementReason.SALE,
                notes=f"Satış siparişi #{order_number}",
            )
            self.db.add(movement)

        # ADIM 5: Finansal Yansıma
        pm_val = order_data.payment_method.value if hasattr(order_data.payment_method, "value") else str(order_data.payment_method)
        if pm_val == PaymentMethod.DEBT.value:
            if not order_data.customer_id:
                raise ValueError("Veresiye satış için müşteri seçilmelidir.")

            customer = (
                self.db.query(Customer)
                .filter(Customer.id == order_data.customer_id)
                .first()
            )
            if not customer:
                raise ValueError("Müşteri bulunamadı.")

            customer.balance = (customer.balance or 0.0) + effective_final_amount
        elif pm_val == PaymentMethod.SPLIT.value:
            pass
        else:
            transaction = Transaction(
                type=TransactionType.INCOME,
                category="SALE_INCOME",
                amount=round_money(effective_final_amount),
                description=f"Satış geliri #{order_number}",
                payment_method=pm_val,
                source=TransactionSource.POS,
                reference_id=sale_order.id,
                user_id=user_id,
            )
            self.db.add(transaction)

        self.db.commit()
        self.db.refresh(sale_order)
        return sale_order

    def get_order_by_id(self, order_id: str) -> Optional[SaleOrder]:
        """ID'ye göre sipariş getir"""
        return (
            self.db.query(SaleOrder)
            .filter(SaleOrder.id == order_id, SaleOrder.is_deleted == False)
            .first()
        )

    def search_products(self, query: str) -> list[Product]:
        """Ürün arama"""
        if not query:
            return []

        query = query.strip()
        product = (
            self.db.query(Product)
            .filter(Product.barcode == query, Product.is_deleted == False)
            .first()
        )

        if product:
            return [product]

        products = (
            self.db.query(Product)
            .filter(
                Product.name.ilike(f"%{query}%"), Product.is_deleted == False
            )
            .limit(20)
            .all()
        )

        return products

    def get_stock_advisory(self, include_gemini: bool = True) -> Dict[str, Any]:
        """
        AI Destekli Stok & Tedarik Danışmanı Motoru (Milestone 2 - R2)
        
        - 30 ve 90 günlük satış hızları (V_30, V_90) tekil optimize aggregate SQL sorgusu ile hesaplanır.
        - Dinamik Güvenlik Stoğu (SS), Yeniden Sipariş Noktası (ROP) ve Önerilen Sipariş Miktarı (ROQ) deterministik formüllerle çıkarılır:
          * Daily demand: D = 0.7 * V_30 + 0.3 * V_90
          * Dynamic Safety Stock: SS = max(critical_stock_level, ceil(D * 7))
          * Reorder Point: ROP = ceil((D * 7) + SS)
          * Recommended Order Quantity: ROQ = max(0, ceil((D * 30) + SS - current_stock))
          * Days of inventory remaining: current_stock / D (or None if D=0)
        - STAR, VOLUME, DEAD_STOCK, CRITICAL_ORDER, HEALTHY akıllı sınıflandırmaları ve Türkçe eylem tavsiyeleri üretilir.
        """
        from src.features.inventory.models import Product as ProductModel, Category

        now = datetime.utcnow()
        cutoff_30d = now - timedelta(days=30)
        cutoff_90d = now - timedelta(days=90)

        # Net KDV'siz matrah ve maliyet hesap ifadeleri
        net_base_expr = (
            SaleOrderItem.quantity * SaleOrderItem.unit_price - func.coalesce(SaleOrderItem.discount, 0.0)
        ) / (1.0 + func.coalesce(SaleOrderItem.tax_rate, 18.0) / 100.0)
        cost_expr = SaleOrderItem.quantity * func.coalesce(SaleOrderItem.unit_cost, 0.0)

        # Tekil optimize sorgu: SaleOrderItem ve SaleOrder üzerinden tüm zamanlar, 30g ve 90g koşullu toplamları
        sales_subquery = (
            self.db.query(
                SaleOrderItem.product_id.label("product_id"),
                func.coalesce(func.sum(SaleOrderItem.quantity), 0).label("all_qty"),
                func.coalesce(
                    func.sum(
                        SaleOrderItem.quantity * SaleOrderItem.unit_price - func.coalesce(SaleOrderItem.discount, 0.0)
                    ),
                    0.0,
                ).label("all_revenue"),
                func.coalesce(func.sum(cost_expr), 0.0).label("all_cost"),
                func.coalesce(func.sum(net_base_expr - cost_expr), 0.0).label("all_profit"),
                func.coalesce(
                    func.sum(case((SaleOrder.created_at >= cutoff_30d, SaleOrderItem.quantity), else_=0)),
                    0,
                ).label("sold_30d"),
                func.coalesce(
                    func.sum(case((SaleOrder.created_at >= cutoff_90d, SaleOrderItem.quantity), else_=0)),
                    0,
                ).label("sold_90d"),
                func.max(SaleOrder.created_at).label("last_sale_date"),
            )
            .join(SaleOrder, SaleOrderItem.order_id == SaleOrder.id)
            .filter(
                SaleOrder.is_deleted == False,
                SaleOrder.status == OrderStatus.COMPLETED,
            )
            .group_by(SaleOrderItem.product_id)
            .subquery()
        )

        # Tüm aktif ürünleri kategori ve satış istatistikleriyle birleştir (N+1 sorgusunu ortadan kaldırır)
        query_results = (
            self.db.query(
                ProductModel,
                Category.name.label("category_name"),
                sales_subquery.c.all_qty,
                sales_subquery.c.all_revenue,
                sales_subquery.c.all_cost,
                sales_subquery.c.all_profit,
                sales_subquery.c.sold_30d,
                sales_subquery.c.sold_90d,
                sales_subquery.c.last_sale_date,
            )
            .outerjoin(Category, ProductModel.category_id == Category.id)
            .outerjoin(sales_subquery, ProductModel.id == sales_subquery.c.product_id)
            .filter(ProductModel.is_deleted == False)
            .all()
        )

        items = []
        for product, category_name, all_qty, all_rev, all_cost, all_profit, sold_30, sold_90, last_sale in query_results:
            current_stock = int(product.stock_quantity or 0)
            critical_stock_level = int(product.critical_level if (product.critical_level and product.critical_level > 0) else 10)
            sell_price = float(product.sell_price or 0.0)
            buy_price = float(product.buy_price or 0.0)

            total_sales_count = int(all_qty or 0)
            total_revenue = round_money(float(all_rev or 0.0))
            total_cost = round_money(float(all_cost or 0.0))
            total_profit = round_money(float(all_profit or 0.0))

            sold_30d = int(sold_30 or 0)
            sold_90d = int(sold_90 or 0)

            # 1. Hız ve Talep Hesaplamaları
            v_30 = sold_30d / 30.0
            v_90 = sold_90d / 90.0
            daily_demand = 0.7 * v_30 + 0.3 * v_90

            # 2. Dinamik Güvenlik Stoğu (SS) & Yeniden Sipariş Noktası (ROP)
            lead_time_days = 7
            buffer_lead = math.ceil(daily_demand * lead_time_days)
            safety_stock = max(critical_stock_level, buffer_lead)
            reorder_point = math.ceil((daily_demand * lead_time_days) + safety_stock)

            # 3. Önerilen Sipariş Miktarı (ROQ)
            cycle_days = 30
            target_stock = math.ceil((daily_demand * cycle_days) + safety_stock)
            recommended_order_qty = max(0, target_stock - current_stock)

            # 4. Kalan Stok Ömrü (Runway)
            if daily_demand > 0:
                days_remaining = round(current_stock / daily_demand, 1)
            else:
                days_remaining = None

            # 5. Kâr Marjı Hesabı
            if total_revenue > 0:
                margin = round((total_profit / total_revenue) * 100.0, 1)
            elif sell_price > 0:
                margin = round(((sell_price - buy_price) / sell_price) * 100.0, 1)
            else:
                margin = 0.0

            # 6. Akıllı Sınıflandırma ve Tavsiye Kuralları
            is_critical = bool(current_stock <= reorder_point and daily_demand > 0)
            is_dead_stock = bool(sold_90d == 0 and current_stock > 0)
            is_star = bool(v_30 >= 1.0 and margin >= 30.0)
            is_volume = bool(v_30 >= 1.0 and margin < 30.0)

            if is_critical:
                classification = "CRITICAL_ORDER"
                badge = {
                    "code": "CRITICAL_ORDER",
                    "label": "Acil Sipariş",
                    "color": "red",
                }
                advice = "Stok tükenme eşiğinin altında! Acilen önerilen miktarda sipariş geçin."
                runway_text = f" Yaklaşık {int(days_remaining)} gün sonra stok tükenecektir." if days_remaining is not None else ""
                rationale = (
                    f"Mevcut stok ({current_stock} adet), güvenlik eşiğinin ({reorder_point} ROP) altında.{runway_text} "
                    f"Günlük talep hızı: {daily_demand:.2f} adet. Önerilen sipariş: {recommended_order_qty} adet."
                )
            elif is_dead_stock:
                classification = "DEAD_STOCK"
                badge = {
                    "code": "DEAD_STOCK",
                    "label": "Ölü Stok Riski",
                    "color": "amber",
                }
                advice = "Son 90 günde satış yok / çok durgun. Kampanya veya indirimle nakde çevirin."
                tied_capital = round(current_stock * buy_price, 2)
                rationale = (
                    f"Son 90 günde hiç satış gerçekleşmedi. Rafta {current_stock} adet atıl stok "
                    f"(yaklaşık ₺{tied_capital:,.2f} bağlı maliyet) bulunmaktadır. Tasfiye veya promosyon önerilir."
                )
            elif is_star:
                classification = "STAR"
                badge = {
                    "code": "STAR",
                    "label": "Yıldız Ürün",
                    "color": "purple",
                }
                advice = "En çok kâr getiren lokomotif ürün. Stoksuz kalmayın, görünürlüğü ve çapraz satışı artırın."
                rationale = (
                    f"Yüksek talep hızı (30g günlük: {v_30:.1f} adet) ve yüksek brüt marj (%{margin:.1f}). "
                    f"İşletmenin kâr ve ciro lokomotifidir."
                )
            elif is_volume:
                classification = "VOLUME"
                badge = {
                    "code": "VOLUME",
                    "label": "Sürüm Ürünü",
                    "color": "blue",
                }
                advice = "Hızlı ciro sağlıyor. Tedarikçiden toplu alım iskontosu talep edin."
                rationale = (
                    f"Yüksek talep hızı (30g günlük: {v_30:.1f} adet) ancak kâr marjı (%{margin:.1f}) düşük. "
                    f"Tedarikçiden iskonto talep edilerek veya çapraz satışla kârlılık yükseltilebilir."
                )
            else:
                classification = "HEALTHY"
                badge = {
                    "code": "HEALTHY",
                    "label": "Dengeli Stok",
                    "color": "emerald",
                }
                advice = "Stok ve satış dengeli. Mevcut tedarik periyodunu koruyun."
                rationale = (
                    f"Mevcut stok ({current_stock} adet) güvenlik seviyesinin üzerinde, talep ve ikmal dengesi sağlıklı."
                )

            stock_status = (
                "critical" if current_stock <= critical_stock_level
                else "low" if current_stock <= critical_stock_level * 2
                else "ok"
            )

            trend = "up" if v_30 > v_90 else "down" if v_30 < v_90 else "stable"
            trend_percent = round(((v_30 - v_90) / v_90 * 100), 1) if v_90 > 0 else 0.0

            items.append({
                "id": product.id,
                "name": product.name,
                "brand": product.brand or "Belirtilmemiş",
                "category": category_name or "Kategori Yok",
                "barcode": product.barcode or "",
                "sku": product.sku or "",
                "salesCount": total_sales_count,
                "totalRevenue": total_revenue,
                "totalCost": total_cost,
                "profit": total_profit,
                "profitMargin": margin,
                "stock": current_stock,
                "stockStatus": stock_status,
                "criticalLevel": critical_stock_level,
                "buy_price": buy_price,
                "sell_price": sell_price,
                "sold_30d": sold_30d,
                "sold_90d": sold_90d,
                "v_30": round(v_30, 2),
                "v_90": round(v_90, 2),
                "daily_demand": round(daily_demand, 2),
                "safety_stock": safety_stock,
                "reorder_point": reorder_point,
                "recommended_order_qty": recommended_order_qty,
                "days_remaining": days_remaining,
                "classification": classification,
                "badge": badge,
                "advice": advice,
                "rationale": rationale,
                "is_critical": is_critical,
                "is_star": is_star,
                "is_dead_stock": is_dead_stock,
                "is_volume": is_volume,
                "trend": trend,
                "trendPercent": trend_percent,
            })

        priority_order = {"CRITICAL_ORDER": 0, "STAR": 1, "DEAD_STOCK": 2, "VOLUME": 3, "HEALTHY": 4}
        items.sort(key=lambda x: (priority_order.get(x["classification"], 5), -x["totalRevenue"]))

        total_products = len(items)
        star_count = sum(1 for x in items if x["classification"] == "STAR" or x["is_star"])
        critical_count = sum(1 for x in items if x["classification"] == "CRITICAL_ORDER" or x["is_critical"])
        dead_stock_count = sum(1 for x in items if x["classification"] == "DEAD_STOCK" or x["is_dead_stock"])
        volume_count = sum(1 for x in items if x["classification"] == "VOLUME")
        healthy_count = sum(1 for x in items if x["classification"] == "HEALTHY")
        total_reorder_qty = sum(x["recommended_order_qty"] for x in items)
        total_dead_stock_value = round(
            sum(x["stock"] * (x["buy_price"] or 0.0) for x in items if (x["classification"] == "DEAD_STOCK" or x["is_dead_stock"])),
            2,
        )

        summary = {
            "total_products": total_products,
            "star_count": star_count,
            "critical_count": critical_count,
            "dead_stock_count": dead_stock_count,
            "volume_count": volume_count,
            "healthy_count": healthy_count,
            "total_reorder_qty": total_reorder_qty,
            "total_dead_stock_value": total_dead_stock_value,
        }

        gemini_analysis = None
        if include_gemini:
            try:
                from src.shared.utils.gemini_advisory import get_gemini_api_key, generate_gemini_stock_insights
                api_key = get_gemini_api_key(self.db)
                if api_key:
                    gemini_analysis = generate_gemini_stock_insights(api_key, summary, items)
            except Exception as e:
                import traceback
                print(f"[ERROR] Gemini advisory generation failed: {str(e)}")
                print(traceback.format_exc())

        return {
            "summary": summary,
            "items": items,
            "gemini_analysis": gemini_analysis,
        }

    def get_product_sales_analysis(self) -> list[dict]:
        """
        Ürün bazlı satış analizi
        Raporlar sayfası için ürün bazlı satış istatistikleri ve AI tedarik danışmanı metrikleri
        """
        advisory = self.get_stock_advisory()
        return advisory["items"]
