import sqlite3
import os
import sys

def main():
    try:
        from src.shared.config.settings import get_settings
        db_path = get_settings().DATABASE_PATH
    except Exception:
        db_path = os.path.expandvars(r"%APPDATA%\pos6\db.sqlite")
    
    print(f"Using database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Add columns to suppliers table
    print("Checking for missing columns in suppliers table...")
    cursor.execute("PRAGMA table_info(suppliers);")
    columns = [row[1] for row in cursor.fetchall()]
    
    new_columns = {
        "short_code": "VARCHAR(30)",
        "category": "VARCHAR(50)",
        "iban": "VARCHAR(50)",
        "bank_name": "VARCHAR(100)",
        "default_due_days": "INTEGER DEFAULT 30",
        "e_invoice_registered": "BOOLEAN DEFAULT 0"
    }
    
    for col, definition in new_columns.items():
        if col not in columns:
            try:
                cursor.execute(f"ALTER TABLE suppliers ADD COLUMN {col} {definition}")
                print(f"Added column {col} to suppliers table.")
            except Exception as e:
                print(f"Failed to add {col}: {e}")
                
    # 2. Create supplier_transactions table
    print("Creating supplier_transactions table if not exists...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS supplier_transactions (
        id VARCHAR(36) NOT NULL,
        supplier_id VARCHAR(36) NOT NULL,
        type VARCHAR(30) NOT NULL,
        document_no VARCHAR(100),
        description TEXT,
        debit FLOAT DEFAULT 0.0 NOT NULL,
        credit FLOAT DEFAULT 0.0 NOT NULL,
        running_balance FLOAT DEFAULT 0.0 NOT NULL,
        due_date DATETIME,
        payment_method VARCHAR(30),
        transaction_date DATETIME NOT NULL,
        created_at DATETIME,
        updated_at DATETIME,
        is_synced BOOLEAN DEFAULT 0 NOT NULL,
        is_deleted BOOLEAN DEFAULT 0 NOT NULL,
        PRIMARY KEY (id),
        FOREIGN KEY(supplier_id) REFERENCES suppliers (id)
    );
    """)
    
    # 3. Migrate opening balances
    import uuid
    from datetime import datetime
    
    print("Migrating opening balances for existing suppliers...")
    cursor.execute("SELECT id, balance FROM suppliers WHERE balance != 0;")
    suppliers_with_balance = cursor.fetchall()
    
    for s_id, balance in suppliers_with_balance:
        # Check if they already have an OPENING_BALANCE transaction
        cursor.execute("SELECT id FROM supplier_transactions WHERE supplier_id = ? AND type = 'OPENING_BALANCE'", (s_id,))
        if cursor.fetchone() is None:
            tx_id = str(uuid.uuid4())
            debit = balance if balance > 0 else 0
            credit = abs(balance) if balance < 0 else 0
            now_str = datetime.now().isoformat()
            
            cursor.execute("""
                INSERT INTO supplier_transactions (
                    id, supplier_id, type, description, debit, credit, running_balance, transaction_date, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (tx_id, s_id, "OPENING_BALANCE", "Açılış Bakiyesi (Sistem Geçişi)", debit, credit, balance, now_str, now_str, now_str))
            print(f"Added OPENING_BALANCE transaction for supplier {s_id} (balance: {balance})")
            
    conn.commit()
    conn.close()
    print("Migration completed successfully.")

if __name__ == "__main__":
    main()
