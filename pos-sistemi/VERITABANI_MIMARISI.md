# 🗄️ VERİTABANI MİMARİSİ VE VERİ AKIŞI

## 📁 DOSYA YAPISI

### 1. **VERİTABANI BAĞLANTISI** (Connection Layer)
```
backend/src/shared/database/
├── base.py          → SQLAlchemy Base sınıfı
├── session.py       → Veritabanı bağlantı ve session yönetimi
└── __init__.py
```

**Ana Dosya: `backend/src/shared/database/session.py`**
- **Ne yapar?**
  - SQLite veritabanına bağlantı kurar
  - Session factory oluşturur (her istek için yeni session)
  - `get_db()` fonksiyonu ile dependency injection sağlar

**Önemli Fonksiyonlar:**
```python
# 1. Engine oluşturma (SQLite bağlantısı)
engine = create_engine(f"sqlite:///{settings.DATABASE_PATH}")

# 2. Session factory
SessionLocal = sessionmaker(bind=engine)

# 3. Her istek için session üreten fonksiyon
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db  # FastAPI'ye session'ı ver
    finally:
        db.close()  # İşlem bitince kapat
```

---

### 2. **MODEL KATMANI** (Data Models)
```
backend/src/features/{feature}/models.py
```

**Örnek: `backend/src/features/orders/models.py`**
- **Ne yapar?**
  - Veritabanı tablolarını Python sınıfları olarak tanımlar
  - SQLAlchemy ORM kullanır
  - Her model `BaseModel`'den türer

**Örnek Model:**
```python
class Order(BaseModel):  # BaseModel'den türer
    __tablename__ = "orders"  # Tablo adı
    
    # Kolonlar
    order_number = Column(String(50), nullable=False)
    total_amount = Column(Float, nullable=False)
    # ... diğer kolonlar
    
    # İlişkiler (Foreign Keys)
    user_id = Column(String(36), ForeignKey("users.id"))
    items = relationship("OrderItem", back_populates="order")
```

**BaseModel'den Gelen Ortak Kolonlar:**
- `id`: UUID (Primary Key)
- `created_at`: Oluşturulma zamanı
- `updated_at`: Güncelleme zamanı
- `is_synced`: Bulut senkronizasyon flag'i
- `is_deleted`: Soft delete flag'i

---

### 3. **REPOSITORY KATMANI** (Data Access Layer)
```
backend/src/features/{feature}/repository.py
```

**Örnek: `backend/src/features/orders/repository.py`**
- **Ne yapar?**
  - Veritabanı sorgularını yapar (CRUD işlemleri)
  - SQLAlchemy query'lerini kapsüller
  - Service katmanına temiz API sağlar

**Örnek Repository:**
```python
class OrderRepository:
    @staticmethod
    def get_all(db: Session, include_deleted: bool = False):
        """Tüm siparişleri getir"""
        query = db.query(Order)
        if not include_deleted:
            query = query.filter(Order.is_deleted == 0)
        return query.order_by(Order.created_at.desc()).all()
    
    @staticmethod
    def get_by_id(db: Session, order_id: str):
        """ID'ye göre sipariş getir"""
        return db.query(Order).filter(Order.id == order_id).first()
```

---

### 4. **SERVICE KATMANI** (Business Logic Layer)
```
backend/src/features/{feature}/services.py
```

**Örnek: `backend/src/features/orders/services.py`**
- **Ne yapar?**
  - İş mantığını (business logic) içerir
  - Repository'yi kullanır
  - Zincirleme işlemler yapar (örn: Satış → Stok düş → Kasa girişi)

**Örnek Service:**
```python
class OrderService:
    def __init__(self, db: Session):
        self.db = db  # Veritabanı session'ı
        self.repository = OrderRepository()
    
    def process_sale(self, order_data: OrderCreate, user_id: str):
        """
        SATIŞ İŞLEMİ - Zincirleme Reaksiyonlar:
        1. Order oluştur
        2. Stok düş
        3. Kasa girişi
        4. Log kaydı
        """
        # 1. Order oluştur
        order = Order(...)
        self.db.add(order)
        self.db.flush()
        
        # 2. Stok düş
        product.stock_quantity -= quantity
        stock_movement = StockMovement(...)
        self.db.add(stock_movement)
        
        # 3. Kasa girişi
        transaction = Transaction(...)
        self.db.add(transaction)
        
        # 4. Tüm değişiklikleri kaydet
        self.db.commit()
        return order
```

---

### 5. **ROUTER KATMANI** (API Endpoints)
```
backend/src/features/{feature}/routers.py
```

**Örnek: `backend/src/features/orders/routers.py`**
- **Ne yapar?**
  - HTTP endpoint'lerini tanımlar
  - Request/Response işlemlerini yönetir
  - Service katmanını çağırır

**Örnek Router:**
```python
router = APIRouter()

@router.get("/statistics/weekly-trend")
async def get_weekly_sales_trend(
    db: Session = Depends(get_db)  # ← Session'ı otomatik al
):
    """Haftalık satış trendini getir"""
    service = OrderService(db)  # Service'e session'ı ver
    result = service.get_weekly_sales_trend()
    return result
```

---

## 🔄 VERİ AKIŞI (Data Flow)

### ÖRNEK: Satış Yapma İşlemi

```
1. FRONTEND (React)
   ↓
   POST /api/orders
   { items: [...], total: 1000 }
   
2. ROUTER (routers.py)
   ↓
   @router.post("/orders")
   async def create_order(
       order_data: OrderCreate,
       db: Session = Depends(get_db)  ← Session al
   )
   
3. SERVICE (services.py)
   ↓
   service = OrderService(db)
   order = service.process_sale(order_data, user_id)
   
4. REPOSITORY (repository.py) - Opsiyonel
   ↓
   repository.create(db, order)
   
5. MODEL (models.py)
   ↓
   order = Order(...)
   db.add(order)
   db.commit()
   
6. VERİTABANI (SQLite)
   ↓
   INSERT INTO orders (...)
```

---

## 📊 VERİTABANI SORGULAMA ÖRNEKLERİ

### Basit Sorgu:
```python
# Tüm ürünleri getir
products = db.query(Product).filter(Product.is_deleted == 0).all()
```

### Filtreleme:
```python
# Bugünkü siparişler
today = datetime.now().replace(hour=0, minute=0, second=0)
orders = db.query(Order).filter(
    Order.created_at >= today,
    Order.status == "completed"
).all()
```

### Aggregation (Toplama):
```python
# Bugünkü toplam ciro
from sqlalchemy import func

total_revenue = db.query(func.sum(Order.final_amount)).filter(
    Order.created_at >= today,
    Order.status == "completed"
).scalar() or 0.0
```

### Join (İlişkili Tablolar):
```python
# Siparişleri items ile birlikte getir
from sqlalchemy.orm import joinedload

orders = db.query(Order).options(
    joinedload(Order.items)  # Eager loading
).filter(Order.is_deleted == 0).all()
```

---

## 🎯 ÖNEMLİ DOSYALAR VE GÖREVLERİ

| Dosya | Görev | Kullanım |
|-------|-------|----------|
| `session.py` | Veritabanı bağlantısı | Her istek için session üretir |
| `models.py` | Tablo tanımları | Veritabanı şeması |
| `repository.py` | Veri erişim katmanı | CRUD işlemleri |
| `services.py` | İş mantığı | Zincirleme işlemler |
| `routers.py` | API endpoint'leri | HTTP istekleri |
| `schemas.py` | Veri doğrulama | Request/Response modelleri |

---

## 🔍 VERİTABANI KONTROLÜ İÇİN KULLANILAN DOSYALAR

### 1. **Session Yönetimi:**
- `backend/src/shared/database/session.py`
  - `get_db()` → Her endpoint'te kullanılır
  - `init_db()` → Uygulama başlangıcında tabloları oluşturur

### 2. **Model Tanımları:**
- `backend/src/features/{feature}/models.py`
  - Her feature için kendi model dosyası var
  - Örnek: `orders/models.py`, `inventory/models.py`

### 3. **Sorgu İşlemleri:**
- `backend/src/features/{feature}/services.py`
  - `self.db.query(Model)` → Sorgu başlatır
  - `.filter()` → Filtreleme
  - `.all()` → Tüm sonuçları getir
  - `.first()` → İlk sonucu getir
  - `.count()` → Sayı getir

---

## 💡 ÖRNEK: Dashboard Stats Endpoint'i

```python
# backend/src/features/dashboard/routers.py

@router.get("/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db)  # ← Session al
):
    # Service'leri oluştur
    order_service = OrderService(db)
    transaction_service = TransactionService(db)
    product_service = ProductService(db)
    
    # Verileri çek
    today_orders = db.query(Order).filter(
        Order.created_at >= today_start,
        Order.status == "completed"
    ).count()
    
    today_revenue = db.query(func.sum(Order.final_amount)).filter(
        Order.created_at >= today_start
    ).scalar() or 0.0
    
    # Sonuç döndür
    return {
        "daily_revenue": today_revenue,
        "transaction_count": today_orders,
        ...
    }
```

---

## 🚀 SONUÇ

**Veri Akışı Özeti:**
1. **Frontend** → HTTP Request
2. **Router** → Endpoint yakalar, session alır
3. **Service** → İş mantığını çalıştırır
4. **Repository** → Veritabanı sorgularını yapar (opsiyonel)
5. **Model** → SQLAlchemy ORM ile veritabanına yazar
6. **Database** → SQLite'de saklanır

**Hangi Dosyada Ne Var:**
- **Bağlantı:** `session.py`
- **Tablo Tanımları:** `models.py`
- **Sorgular:** `services.py` veya `repository.py`
- **API:** `routers.py`




