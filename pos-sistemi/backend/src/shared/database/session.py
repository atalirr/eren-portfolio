"""
Database Session Factory
"""


from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from src.shared.database.base import Base
from src.shared.config.settings import get_settings

settings = get_settings()


# SQLite engine oluştur
engine = create_engine(
    f"sqlite:///{settings.DATABASE_PATH}",
    connect_args={"check_same_thread": False},  # SQLite için gerekli
    echo=settings.ENVIRONMENT == "development",  # Dev modunda SQL logları
)

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """SQLite foreign key kısıtlamalarını etkinleştir (M1 Fix)"""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Database tablolarını oluşturur"""
    # Tabloları oluştur
    Base.metadata.create_all(bind=engine)
    
    # SQLite'de yeni kolonlar eklemek için ALTER TABLE
    # Mevcut tablolara eksik kolonları ekle
    from sqlalchemy import text, inspect
    
    inspector = inspect(engine)
    
    # Products tablosuna eksik kolonları ekle
    if 'products' in inspector.get_table_names():
        with engine.begin() as conn:
            columns = [col['name'] for col in inspector.get_columns('products')]
            
            if 'brand' not in columns:
                try:
                    conn.execute(text("ALTER TABLE products ADD COLUMN brand VARCHAR(100)"))
                    print("[OK] 'brand' kolonu products tablosuna eklendi")
                except Exception as e:
                    print(f"[WARN] 'brand' kolonu eklenirken hata: {e}")
            
            if 'is_active' not in columns:
                try:
                    conn.execute(text("ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT 1"))
                    print("[OK] 'is_active' kolonu products tablosuna eklendi")
                except Exception as e:
                    print(f"[WARN] 'is_active' kolonu eklenirken hata: {e}")

            # Variant + late-added columns
            for col_name, col_type, col_default in [
                ('parent_id',  'VARCHAR(36)',  'NULL'),
                ('color',      'VARCHAR(50)',  'NULL'),
                ('size',       'VARCHAR(50)',  'NULL'),
                ('material',   'VARCHAR(100)', 'NULL'),
                ('tax_rate',   'FLOAT',        '18.0'),
                ('sku',        'VARCHAR(100)', 'NULL'),
                ('critical_level', 'INTEGER',  '10'),
            ]:
                if col_name not in columns:
                    try:
                        default_clause = f" DEFAULT {col_default}" if col_default != 'NULL' else ''
                        conn.execute(text(
                            f"ALTER TABLE products ADD COLUMN {col_name} {col_type}{default_clause}"
                        ))
                        print(f"[OK] '{col_name}' kolonu products tablosuna eklendi")
                    except Exception as e:
                        print(f"[WARN] '{col_name}' kolonu eklenirken hata: {e}")
    
    # Employees tablosuna eksik kolonları ekle
    if 'employees' in inspector.get_table_names():
        with engine.begin() as conn:
            columns = [col['name'] for col in inspector.get_columns('employees')]
            
            if 'is_active' not in columns:
                try:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN is_active BOOLEAN DEFAULT 1"))
                    print("[OK] 'is_active' kolonu employees tablosuna eklendi")
                except Exception as e:
                    print(f"[WARN] 'is_active' kolonu employees tablosuna eklenirken hata: {e}")
    
    # Transactions tablosuna eksik kolonları ekle
    if 'transactions' in inspector.get_table_names():
        with engine.begin() as conn:
            columns = [col['name'] for col in inspector.get_columns('transactions')]
            
            for col_name, col_type, default in [
                ('payment_source', 'VARCHAR(20)', "'CASH'"),
                ('payment_method', 'VARCHAR(20)', "NULL"),
                ('source', 'VARCHAR(20)', "NULL"),
                ('platform', 'VARCHAR(20)', "NULL"),
                ('reference_id', 'VARCHAR(36)', "NULL")
            ]:
                if col_name not in columns:
                    try:
                        default_clause = f" DEFAULT {default}" if default != "NULL" else ""
                        conn.execute(text(f"ALTER TABLE transactions ADD COLUMN {col_name} {col_type}{default_clause}"))
                        print(f"[OK] '{col_name}' kolonu transactions tablosuna eklendi")
                    except Exception as e:
                        print(f"[WARN] '{col_name}' kolonu eklenirken hata: {e}")
    
    # Orders tablosuna eksik sütunları ekle
    if 'orders' in inspector.get_table_names():
        with engine.begin() as conn:
            columns = [col['name'] for col in inspector.get_columns('orders')]
            
            for col_name, col_type in [
                ('source', 'VARCHAR(20)'),
                ('platform', 'VARCHAR(20)'),
                ('marketplace_status', 'VARCHAR(20)'),
                ('marketplace_order_id', 'VARCHAR(200)')
            ]:
                if col_name not in columns:
                    try:
                        conn.execute(text(f"ALTER TABLE orders ADD COLUMN {col_name} {col_type}"))
                        print(f"[OK] '{col_name}' kolonu orders tablosuna eklendi")
                    except Exception as e:
                        print(f"[WARN] '{col_name}' kolonu eklenirken hata: {e}")

    # Categories tablosuna eksik kolonları ekle
    if 'categories' in inspector.get_table_names():
        with engine.begin() as conn:
            columns = [col['name'] for col in inspector.get_columns('categories')]
            
            for col_name, col_type, default in [
                ('color', 'VARCHAR(20)', "'#3B82F6'"),
                ('is_synced', 'BOOLEAN', '0'),
                ('is_deleted', 'BOOLEAN', '0')
            ]:
                if col_name not in columns:
                    try:
                        conn.execute(text(f"ALTER TABLE categories ADD COLUMN {col_name} {col_type} DEFAULT {default}"))
                        print(f"[OK] '{col_name}' kolonu categories tablosuna eklendi")
                    except Exception as e:
                        print(f"[WARN] '{col_name}' kolonu eklenirken hata: {e}")

    # Customers tablosuna eksik kolonları ekle
    if 'customers' in inspector.get_table_names():
        with engine.begin() as conn:
            columns = [col['name'] for col in inspector.get_columns('customers')]
            if 'due_date' not in columns:
                try:
                    conn.execute(text("ALTER TABLE customers ADD COLUMN due_date VARCHAR(20)"))
                    print("[OK] 'due_date' kolonu customers tablosuna eklendi")
                except Exception as e:
                    print(f"[WARN] 'due_date' kolonu eklenirken hata: {e}")
            
            for col_name, col_type, col_default in [
                ('last_name',          'VARCHAR(200)', 'NULL'),
                ('needed_material',    'VARCHAR(300)', 'NULL'),
                ('product_id',         'VARCHAR(36)',  'NULL'),
                ('quantity',           'INTEGER',      '1'),
                ('unit_price',         'FLOAT',        'NULL'),
                ('period_days',        'INTEGER',      '30'),
                ('last_delivery_date', 'VARCHAR(10)',  'NULL'),
                ('next_delivery_date', 'VARCHAR(10)',  'NULL'),
            ]:
                if col_name not in columns:
                    try:
                        default_clause = f" DEFAULT {col_default}" if col_default != 'NULL' else ''
                        conn.execute(text(
                            f"ALTER TABLE customers ADD COLUMN {col_name} {col_type}{default_clause}"
                        ))
                        print(f"[OK] '{col_name}' kolonu customers tablosuna eklendi")
                    except Exception as e:
                        print(f"[WARN] '{col_name}' kolonu eklenirken hata: {e}")


    # Sale_orders tablosuna eksik kolonları ekle
    if 'sale_orders' in inspector.get_table_names():
        with engine.begin() as conn:
            columns = [col['name'] for col in inspector.get_columns('sale_orders')]
            if 'due_date' not in columns:
                try:
                    conn.execute(text("ALTER TABLE sale_orders ADD COLUMN due_date VARCHAR(20)"))
                    print("[OK] 'due_date' kolonu sale_orders tablosuna eklendi")
                except Exception as e:
                    print(f"[WARN] 'due_date' kolonu sale_orders tablosuna eklenirken hata: {e}")
            
            # İndirim kolonları kontrolü ve eklenmesi
            for col_name, col_type, default in [
                ('discount_type', 'VARCHAR(20)', "NULL"),
                ('discount_value', 'FLOAT', "0.0"),
                ('discount_amount', 'FLOAT', "0.0"),
                ('final_amount', 'FLOAT', "0.0"),
                ('user_id', 'VARCHAR(36)', "NULL"),
            ]:
                if col_name not in columns:
                    try:
                        default_clause = f" DEFAULT {default}" if default != "NULL" else ""
                        conn.execute(text(f"ALTER TABLE sale_orders ADD COLUMN {col_name} {col_type}{default_clause}"))
                        print(f"[OK] '{col_name}' kolonu sale_orders tablosuna eklendi")
                    except Exception as e:
                        print(f"[WARN] '{col_name}' kolonu eklenirken hata: {e}")

            # Legacy final_amount = 0.0 olan kayitlari guvenli bicimde backfill et (Issue C1)
            try:
                conn.execute(text("""
                    UPDATE sale_orders
                    SET final_amount = total_amount - COALESCE(discount_amount, 0.0)
                    WHERE (final_amount = 0.0 OR final_amount IS NULL) AND total_amount > 0.0
                """))
            except Exception as e:
                print(f"[WARN] sale_orders final_amount backfill hatasi: {e}")

    # Sale_order_items tablosuna eksik kolonları ekle
    if 'sale_order_items' in inspector.get_table_names():
        with engine.begin() as conn:
            columns = [col['name'] for col in inspector.get_columns('sale_order_items')]
            if 'tax_rate' not in columns:
                try:
                    conn.execute(text("ALTER TABLE sale_order_items ADD COLUMN tax_rate FLOAT DEFAULT 18.0"))
                    print("[OK] 'tax_rate' kolonu sale_order_items tablosuna eklendi")
                except Exception as e:
                    print(f"[WARN] 'tax_rate' kolonu sale_order_items tablosuna eklenirken hata: {e}")
            
            if 'discount' not in columns:
                try:
                    conn.execute(text("ALTER TABLE sale_order_items ADD COLUMN discount FLOAT DEFAULT 0.0"))
                    print("[OK] 'discount' kolonu sale_order_items tablosuna eklendi")
                except Exception as e:
                    print(f"[WARN] 'discount' kolonu sale_order_items tablosuna eklenirken hata: {e}")

    # Order_items tablosuna eksik kolonları ekle
    if 'order_items' in inspector.get_table_names():
        with engine.begin() as conn:
            columns = [col['name'] for col in inspector.get_columns('order_items')]
            if 'tax_rate' not in columns:
                try:
                    conn.execute(text("ALTER TABLE order_items ADD COLUMN tax_rate FLOAT DEFAULT 18.0"))
                    print("[OK] 'tax_rate' kolonu order_items tablosuna eklendi")
                except Exception as e:
                    print(f"[WARN] 'tax_rate' kolonu order_items tablosuna eklenirken hata: {e}")

    print(f"[OK] Database tablolari olusturuldu: {settings.DATABASE_PATH}")


def get_db() -> Generator[Session, None, None]:
    """
    Database session generator (Dependency Injection icin)
    @yields: Database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
