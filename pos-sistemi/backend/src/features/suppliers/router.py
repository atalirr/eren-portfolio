"""
Supplier Router
Tedarikci API Endpointleri
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import uuid
import os
import csv

from src.shared.database.session import get_db
from src.features.suppliers.models import Supplier, SupplierTransaction


router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


def _to_dict(s):
    return {
        "id": s.id,
        "name": s.name,
        "short_code": s.short_code,
        "category": s.category,
        "contact_name": s.contact_name,
        "phone": s.phone,
        "email": s.email,
        "tax_office": s.tax_office,
        "tax_number": s.tax_number,
        "address": s.address,
        "iban": s.iban,
        "bank_name": s.bank_name,
        "default_due_days": s.default_due_days,
        "e_invoice_registered": s.e_invoice_registered,
        "balance": s.balance,
        "notes": s.notes,
        "created_at": str(s.created_at) if s.created_at else None,
        "updated_at": str(s.updated_at) if s.updated_at else None,
    }


def _transaction_to_dict(t):
    return {
        "id": t.id,
        "supplier_id": t.supplier_id,
        "type": t.type,
        "document_no": t.document_no,
        "description": t.description,
        "debit": t.debit,
        "credit": t.credit,
        "running_balance": t.running_balance,
        "due_date": str(t.due_date) if t.due_date else None,
        "payment_method": t.payment_method,
        "transaction_date": str(t.transaction_date) if t.transaction_date else None,
        "created_at": str(t.created_at) if t.created_at else None,
    }


@router.get("/summary")
def get_suppliers_summary(db: Session = Depends(get_db)):
    """Tedarikci KPI verileri"""
    now = datetime.now()
    thirty_days_later = now + timedelta(days=30)
    
    suppliers = db.query(Supplier).filter(Supplier.is_deleted == False).all()
    total_suppliers = len(suppliers)
    
    zero_balance_count = sum(1 for s in suppliers if s.balance == 0)
    debt_supplier_count = sum(1 for s in suppliers if s.balance > 0)
    total_debt = sum(s.balance for s in suppliers if s.balance > 0)
    
    # Overdue debt
    overdue_transactions = db.query(SupplierTransaction).join(Supplier).filter(
        Supplier.is_deleted == False,
        SupplierTransaction.type == "INVOICE",
        SupplierTransaction.due_date < now
    ).all()
    
    overdue_supplier_ids = set()
    for t in overdue_transactions:
        # Simplistic overdue calculation logic based on instruction
        overdue_supplier_ids.add(t.supplier_id)
        
    overdue_debt = 0
    for s in suppliers:
        if s.id in overdue_supplier_ids and s.balance > 0:
            overdue_debt += s.balance
            
    # Upcoming payments
    upcoming_transactions = db.query(SupplierTransaction).filter(
        SupplierTransaction.due_date >= now,
        SupplierTransaction.due_date <= thirty_days_later,
        SupplierTransaction.type == "INVOICE"
    ).all()
    
    upcoming_payments = sum(t.debit for t in upcoming_transactions)
    upcoming_invoice_count = len(upcoming_transactions)
    
    return {
        "total_debt": float(total_debt),
        "overdue_debt": float(overdue_debt),
        "overdue_supplier_count": len(overdue_supplier_ids),
        "upcoming_payments": float(upcoming_payments),
        "upcoming_invoice_count": upcoming_invoice_count,
        "total_suppliers": total_suppliers,
        "zero_balance_count": zero_balance_count,
        "debt_supplier_count": debt_supplier_count
    }


@router.get("/export")
def export_suppliers(db: Session = Depends(get_db)):
    """Tedarikcileri Excel/CSV'ye aktar"""
    suppliers = db.query(Supplier).filter(Supplier.is_deleted == False).all()
    data = [_to_dict(s) for s in suppliers]
    
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    exports_dir = os.path.join(base_dir, "exports")
    os.makedirs(exports_dir, exist_ok=True)
    
    file_path = os.path.join(exports_dir, f"suppliers_export_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv")
    if data:
        keys = list(data[0].keys())
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(data)
    else:
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            f.write("Tedarikçi bulunamadı")
            
    return FileResponse(file_path, filename="tedarikciler_ekstre.csv", media_type="text/csv")


@router.get("")
@router.get("/")
def get_suppliers(
    search: str = None, 
    category: str = None, 
    status: str = "all", 
    db: Session = Depends(get_db)
):
    """Tum tedarikcileri listele"""
    query = db.query(Supplier).filter(Supplier.is_deleted == False)
    if search:
        query = query.filter(Supplier.name.ilike(f"%{search}%"))
    if category:
        query = query.filter(Supplier.category == category)
        
    if status == 'debt':
        query = query.filter(Supplier.balance > 0)
    elif status == 'zero':
        query = query.filter(Supplier.balance == 0)
        
    suppliers = query.order_by(Supplier.created_at.desc()).all()
    return {"suppliers": [_to_dict(s) for s in suppliers]}


@router.get("/{supplier_id}")
def get_supplier(supplier_id: str, db: Session = Depends(get_db)):
    """Tekil tedarikci detayi"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.is_deleted == False).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikci bulunamadi")
    return _to_dict(supplier)


@router.post("")
@router.post("/")
def create_supplier(data: dict, db: Session = Depends(get_db)):
    """Yeni tedarikci olustur"""
    supplier = Supplier(
        id=str(uuid.uuid4()),
        name=data.get("name", ""),
        short_code=data.get("short_code"),
        category=data.get("category"),
        contact_name=data.get("contact_name"),
        phone=data.get("phone"),
        email=data.get("email"),
        tax_office=data.get("tax_office"),
        tax_number=data.get("tax_number"),
        address=data.get("address"),
        iban=data.get("iban"),
        bank_name=data.get("bank_name"),
        default_due_days=data.get("default_due_days", 30),
        e_invoice_registered=data.get("e_invoice_registered", False),
        notes=data.get("notes"),
        balance=0.0
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return _to_dict(supplier)


@router.put("/{supplier_id}")
def update_supplier(supplier_id: str, data: dict, db: Session = Depends(get_db)):
    """Tedarikci guncelle"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.is_deleted == False).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikci bulunamadi")
    
    fields = [
        "name", "short_code", "category", "contact_name", "phone", "email", 
        "tax_office", "tax_number", "address", "iban", "bank_name", 
        "default_due_days", "e_invoice_registered", "notes"
    ]
    for key in fields:
        if key in data:
            setattr(supplier, key, data[key])
    
    db.commit()
    db.refresh(supplier)
    return _to_dict(supplier)


@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: str, db: Session = Depends(get_db)):
    """Tedarikci sil (soft delete)"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikci bulunamadi")
    supplier.is_deleted = True
    db.commit()
    return {"message": "Tedarikci silindi"}


@router.get("/{supplier_id}/transactions")
def get_supplier_transactions(supplier_id: str, db: Session = Depends(get_db)):
    """Tedarikci islemleri"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.is_deleted == False).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikci bulunamadi")
        
    transactions = db.query(SupplierTransaction).filter(
        SupplierTransaction.supplier_id == supplier_id,
        SupplierTransaction.is_deleted == False
    ).order_by(SupplierTransaction.transaction_date.desc()).all()
    
    return {
        "supplier": _to_dict(supplier),
        "transactions": [_transaction_to_dict(t) for t in transactions]
    }


@router.post("/{supplier_id}/transactions")
def create_supplier_transaction(supplier_id: str, data: dict, db: Session = Depends(get_db)):
    """Yeni islem olustur"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.is_deleted == False).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikci bulunamadi")
        
    amount = data.get("amount", 0.0)
    tx_type = data.get("type")
    
    debit = 0.0
    credit = 0.0
    
    if tx_type == "INVOICE":
        debit = amount
        supplier.balance += amount
    else:
        credit = amount
        supplier.balance -= amount
        
    transaction = SupplierTransaction(
        id=str(uuid.uuid4()),
        supplier_id=supplier_id,
        type=tx_type,
        document_no=data.get("document_no"),
        description=data.get("description"),
        debit=debit,
        credit=credit,
        running_balance=supplier.balance,
        due_date=data.get("due_date"),
        payment_method=data.get("payment_method"),
        transaction_date=datetime.now()
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return _transaction_to_dict(transaction)


@router.post("/{supplier_id}/balance")
def adjust_balance(supplier_id: str, amount: float = 0, db: Session = Depends(get_db)):
    """Tedarikci bakiyesini ayarla"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.is_deleted == False).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikci bulunamadi")
    
    supplier.balance += amount
    
    tx = SupplierTransaction(
        id=str(uuid.uuid4()),
        supplier_id=supplier.id,
        type="ADJUSTMENT",
        description="Manuel bakiye ayarlama",
        debit=amount if amount > 0 else 0,
        credit=abs(amount) if amount < 0 else 0,
        running_balance=supplier.balance,
        transaction_date=datetime.now()
    )
    db.add(tx)
    db.commit()
    db.refresh(supplier)
    return _to_dict(supplier)