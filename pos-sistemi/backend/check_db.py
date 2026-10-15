"""
DB kolon kontrol scripti - backend ile aynı ortamda çalıştır:
  cd backend && python check_db.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import inspect as sa_inspect, text
from src.shared.database.session import engine

inspector = sa_inspect(engine)
tables = inspector.get_table_names()
print(f"Tablolar: {tables}\n")

for table in ['products', 'categories']:
    if table in tables:
        cols = [c['name'] for c in inspector.get_columns(table)]
        print(f"{table} kolonlari ({len(cols)}): {cols}")

# Model beklentileri
model_product_cols = [
    'id', 'created_at', 'updated_at', 'is_synced', 'is_deleted',
    'category_id', 'name', 'barcode', 'sku', 'brand',
    'sell_price', 'buy_price', 'stock_quantity', 'critical_level',
    'unit', 'description', 'image_url',
    'parent_id', 'color', 'size', 'material',
    'tax_rate', 'is_active',
]
if 'products' in tables:
    existing = [c['name'] for c in inspector.get_columns('products')]
    missing = [c for c in model_product_cols if c not in existing]
    if missing:
        print(f"\n[!!] EKSIK KOLONLAR: {missing}")
    else:
        print("\n[OK] Tum kolonlar mevcut")
