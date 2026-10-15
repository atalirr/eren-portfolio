"""
Seed Script - Örnek Veriler
50 Ürün, 2 Kullanıcı, 100 Satış, 20 Kasa Hareketi
"""

import sys
from pathlib import Path

# Backend src klasörünü path'e ekle
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path / 'src'))

from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random
from passlib.context import CryptContext

from src.shared.database.session import SessionLocal, init_db
from src.features.auth.models import User
from src.features.settings.models import Setting
from src.features.inventory.models import Category, Product
from src.features.inventory.stock_movement import StockMovement, StockMovementReason
from src.features.orders.models import Order, OrderItem
from src.features.transactions.models import Transaction, TransactionType
from src.features.system.models import SystemLog


# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Şifre hash'le"""
    try:
        return pwd_context.hash(password)
    except Exception:
        return f"fake_hash_{password}"


def seed_database():
    """Veritabanını örnek verilerle doldur"""
    from src.shared.config.settings import get_settings
    settings = get_settings()
    if settings.ENVIRONMENT != "development":
        print(f"❌ HATA: Seed işlemi yalnızca 'development' ortamında çalıştırılabilir! (Mevcut ortam: {settings.ENVIRONMENT})")
        return

    print("🌱 Seed işlemi başlatılıyor...")
    
    # Database'i başlat
    init_db()
    
    db: Session = SessionLocal()
    
    try:
        # 1. Kullanıcıları oluştur
        print("👤 Kullanıcılar oluşturuluyor...")
        
        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            full_name="Admin Kullanıcı",
            role="ADMIN",
            is_active=True
        )
        
        cashier = User(
            username="kasiyer",
            password_hash=hash_password("kasiyer123"),
            full_name="Kasiyer Kullanıcı",
            role="CASHIER",
            is_active=True
        )
        
        db.add(admin)
        db.add(cashier)
        db.commit()
        db.refresh(admin)
        db.refresh(cashier)
        
        print(f"✅ 2 kullanıcı oluşturuldu: {admin.username}, {cashier.username}")
        
        # 2. Ayarları oluştur
        print("⚙️ Ayarlar oluşturuluyor...")
        
        settings = [
            Setting(key="store_name", value="POS 6 Mağaza", description="Mağaza adı"),
            Setting(key="tax_rate", value="20", description="KDV oranı (%)"),
            Setting(key="currency", value="TL", description="Para birimi"),
        ]
        
        for setting in settings:
            db.add(setting)
        db.commit()
        
        print(f"✅ {len(settings)} ayar oluşturuldu")
        
        # 3. Kategorileri oluştur
        print("📦 Kategoriler oluşturuluyor...")
        
        categories_data = [
            {"name": "İçecekler", "color": "#3B82F6"},
            {"name": "Atıştırmalık", "color": "#EF4444"},
            {"name": "Temel Gıda", "color": "#10B981"},
            {"name": "Temizlik", "color": "#8B5CF6"},
            {"name": "Kişisel Bakım", "color": "#F59E0B"},
        ]
        
        categories = []
        for cat_data in categories_data:
            category = Category(
                name=cat_data["name"],
                color=cat_data["color"],
                description=f"{cat_data['name']} kategorisi"
            )
            categories.append(category)
            db.add(category)
        db.commit()
        
        for cat in categories:
            db.refresh(cat)
        
        print(f"✅ {len(categories)} kategori oluşturuldu")
        
        # 4. Ürünleri oluştur (50 adet)
        print("🛍️ Ürünler oluşturuluyor...")
        
        products_data = [
            # İçecekler
            ("Coca Cola 330ml", 5.50, 3.50, 100),
            ("Fanta 330ml", 5.50, 3.50, 100),
            ("Sprite 330ml", 5.50, 3.50, 100),
            ("Su 500ml", 2.00, 1.00, 200),
            ("Ayran 250ml", 3.00, 1.50, 150),
            ("Çay", 4.00, 1.00, 100),
            ("Kahve", 8.00, 2.00, 80),
            ("Meyve Suyu 200ml", 4.50, 2.00, 120),
            ("Enerji İçeceği", 7.00, 3.50, 90),
            ("Soda", 3.00, 1.20, 100),
            
            # Atıştırmalık
            ("Çikolata", 6.00, 3.00, 150),
            ("Bisküvi", 4.50, 2.00, 180),
            ("Cips", 8.00, 4.00, 120),
            ("Kraker", 5.00, 2.50, 140),
            ("Şeker", 3.50, 1.50, 200),
            ("Sakız", 2.50, 1.00, 250),
            ("Çekirdek", 7.00, 3.50, 100),
            ("Fındık", 25.00, 15.00, 50),
            ("Badem", 30.00, 18.00, 40),
            ("Leblebi", 6.00, 3.00, 80),
            
            # Temel Gıda
            ("Ekmek", 2.50, 1.00, 100),
            ("Süt 1L", 12.00, 8.00, 80),
            ("Yumurta", 15.00, 10.00, 60),
            ("Peynir 500g", 45.00, 30.00, 40),
            ("Zeytin 500g", 25.00, 15.00, 50),
            ("Bal 500g", 80.00, 50.00, 30),
            ("Makarna 500g", 8.00, 4.00, 100),
            ("Pirinç 1kg", 25.00, 15.00, 70),
            ("Bulgur 1kg", 18.00, 10.00, 60),
            ("Şeker 1kg", 15.00, 8.00, 90),
            
            # Temizlik
            ("Şampuan", 25.00, 15.00, 60),
            ("Sabun", 8.00, 4.00, 100),
            ("Deterjan 1kg", 35.00, 20.00, 50),
            ("Yumuşatıcı", 30.00, 18.00, 45),
            ("Bulaşık Deterjanı", 20.00, 12.00, 70),
            ("Tuvalet Kağıdı 8'li", 45.00, 28.00, 40),
            ("Kağıt Havlu", 35.00, 22.00, 50),
            ("Çöp Poşeti", 15.00, 8.00, 80),
            ("Sünger", 5.00, 2.00, 120),
            ("Temizlik Bezi", 12.00, 6.00, 90),
            
            # Kişisel Bakım
            ("Diş Fırçası", 15.00, 8.00, 80),
            ("Diş Macunu", 18.00, 10.00, 70),
            ("Deodorant", 35.00, 20.00, 55),
            ("Jel", 25.00, 15.00, 65),
            ("Krem", 40.00, 25.00, 50),
            ("Sıvı Sabun", 20.00, 12.00, 75),
            ("Islak Mendil", 18.00, 10.00, 85),
            ("Bebek Bezi", 120.00, 80.00, 30),
            ("Şampuan 500ml", 30.00, 18.00, 60),
            ("Saç Kremi", 28.00, 16.00, 55),
        ]
        
        products = []
        for i, (name, sell_price, buy_price, stock) in enumerate(products_data):
            category = categories[i // 10]  # Her 10 ürün bir kategori
            product = Product(
                category_id=category.id,
                name=name,
                barcode=f"86901234567{i:02d}",
                sku=f"SKU-{i+1:03d}",
                sell_price=sell_price,
                buy_price=buy_price,
                stock_quantity=stock,
                critical_level=10,
                unit="adet",
                description=f"{name} ürünü"
            )
            products.append(product)
            db.add(product)
        db.commit()
        
        for product in products:
            db.refresh(product)
        
        print(f"✅ 50 ürün oluşturuldu")
        
        # 5. Geçmiş satışları oluştur (100 adet)
        print("💰 Geçmiş satışlar oluşturuluyor...")
        
        users = [admin, cashier]
        start_date = datetime.now() - timedelta(days=30)
        
        for i in range(100):
            # Rastgele tarih (son 30 gün içinde)
            days_ago = random.randint(0, 30)
            sale_date = start_date + timedelta(days=days_ago, hours=random.randint(8, 20))
            
            # Rastgele kullanıcı
            user = random.choice(users)
            
            # Sipariş numarası
            order_number = f"#{1001 + i:04d}"
            
            # Rastgele ürünler seç (1-5 arası)
            num_items = random.randint(1, 5)
            selected_products = random.sample(products, min(num_items, len(products)))
            
            # Order items oluştur
            order_items = []
            total_amount = 0.0
            
            for product in selected_products:
                quantity = random.randint(1, 5)
                # Ürün stoku yeterliyse işlem yap
                if product.stock_quantity >= quantity:
                    subtotal = product.sell_price * quantity
                    total_amount += subtotal
                    
                    item = OrderItem(
                        product_id=product.id,
                        quantity=quantity,
                        unit_sell_price=product.sell_price,
                        unit_buy_price=product.buy_price,
                        discount=0.0,
                        subtotal=subtotal
                    )
                    order_items.append(item)
                    
                    # Stok düş
                    product.stock_quantity -= quantity
                    
                    # Stock movement oluştur
                    stock_movement = StockMovement(
                        product_id=product.id,
                        user_id=user.id,
                        quantity_change=-quantity,
                        reason=StockMovementReason.SALE,
                        notes=f"Sipariş: {order_number}"
                    )
                    db.add(stock_movement)
            
            if order_items:
                # İndirim (bazen)
                discount_type = random.choice([None, "PERCENT", "FIXED"])
                discount_value = 0.0
                if discount_type == "PERCENT":
                    discount_value = random.randint(5, 20)  # %5-20
                elif discount_type == "FIXED":
                    discount_value = random.randint(5, 50)  # 5-50 TL
                
                discount_amount = 0.0
                if discount_type == "PERCENT":
                    discount_amount = total_amount * (discount_value / 100)
                elif discount_type == "FIXED":
                    discount_amount = discount_value
                
                final_amount = total_amount - discount_amount
                
                # Order oluştur
                order = Order(
                    order_number=order_number,
                    user_id=user.id,
                    total_amount=total_amount,
                    discount_type=discount_type,
                    discount_value=discount_value,
                    final_amount=final_amount,
                    payment_method=random.choice(["CASH", "CARD"]),
                    status="completed",
                    created_at=sale_date,
                    updated_at=sale_date
                )
                order.items = order_items
                db.add(order)
                
                # Transaction oluştur (gelir)
                transaction = Transaction(
                    type=TransactionType.INCOME,
                    category="Satış Geliri",
                    amount=final_amount,
                    description=f"Sipariş: {order_number}",
                    user_id=user.id,
                    related_order_id=order.id,
                    created_at=sale_date,
                    updated_at=sale_date
                )
                db.add(transaction)
                
                # System log
                system_log = SystemLog(
                    user_id=user.id,
                    action_type="SALE",
                    details=f"{user.full_name} satış yaptı - {order_number} - {final_amount:.2f} TL",
                    created_at=sale_date,
                    updated_at=sale_date
                )
                db.add(system_log)
        
        db.commit()
        print(f"✅ 100 geçmiş satış oluşturuldu")
        
        # 6. Kasa hareketleri oluştur (20 adet - giderler)
        print("💸 Kasa hareketleri oluşturuluyor...")
        
        expense_categories = [
            "Kira",
            "Elektrik",
            "Su",
            "Doğalgaz",
            "Telefon",
            "İnternet",
            "Kargo",
            "Temizlik",
            "Bakım",
            "Diğer"
        ]
        
        for i in range(20):
            days_ago = random.randint(0, 30)
            expense_date = start_date + timedelta(days=days_ago)
            user = random.choice(users)
            category = random.choice(expense_categories)
            amount = random.randint(50, 500)
            description = f"{category} gideri"
            
            transaction = Transaction(
                type=TransactionType.EXPENSE,
                category=category,
                amount=amount,
                description=description,
                user_id=user.id,
                created_at=expense_date,
                updated_at=expense_date
            )
            db.add(transaction)
            
            # System log
            system_log = SystemLog(
                user_id=user.id,
                action_type="EXPENSE",
                details=f"{user.full_name} kasadan {amount:.2f} TL aldı - {category}: {description}",
                created_at=expense_date,
                updated_at=expense_date
            )
            db.add(system_log)
        
        db.commit()
        print(f"✅ 20 kasa hareketi oluşturuldu")
        
        print("\n🎉 Seed işlemi tamamlandı!")
        print(f"✅ 2 Kullanıcı")
        print(f"✅ {len(settings)} Ayar")
        print(f"✅ {len(categories)} Kategori")
        print(f"✅ 50 Ürün")
        print(f"✅ 100 Geçmiş Satış")
        print(f"✅ 20 Kasa Hareketi")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Hata: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()


