"""
Check Router
Cekler API Endpointleri
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, date
import uuid

from src.shared.database.session import get_db
from src.features.checks.models import Check, CheckType, CheckStatus
from src.features.transactions.models import Transaction, TransactionType, PaymentMethod, TransactionSource


router = APIRouter(prefix="/api/checks", tags=["checks"])


def _check_to_dict(c: Check) -> dict:
    return {
        "id": c.id,
        "check_type": c.check_type.value if c.check_type else "INCOMING",
        "check_number": c.check_number,
        "bank_name": c.bank_name,
        "branch_name": c.branch_name,
        "account_number": c.account_number,
        "issuer": c.issuer,
        "customer_id": c.customer_id,
        "supplier_id": c.supplier_id,
        "customer_name": f"{c.customer.name} {c.customer.last_name or ''}".strip() if c.customer else None,
        "supplier_name": c.supplier.name if c.supplier else None,
        "issue_date": c.issue_date,
        "due_date": c.due_date,
        "amount": round(c.amount, 2),
        "status": c.status.value if c.status else "IN_PORTFOLIO",
        "notes": c.notes,
        "created_at": str(c.created_at) if c.created_at else None,
    }


@router.get("")
@router.get("/")
def get_checks(
    check_type: str = None,
    status: str = None,
    search: str = None,
    db: Session = Depends(get_db)
):
    """Cekleri listele"""
    query = db.query(Check).filter(Check.is_deleted == False)
    
    if check_type:
        query = query.filter(Check.check_type == check_type)
    if status:
        query = query.filter(Check.status == status)
    
    checks = query.order_by(Check.due_date.asc()).all()
    results = [_check_to_dict(c) for c in checks]
    
    if search:
        s = search.lower()
        results = [
            r for r in results if (
                s in r["check_number"].lower() or
                s in r["bank_name"].lower() or
                s in r["issuer"].lower() or
                (r.get("customer_name") and s in r["customer_name"].lower()) or
                (r.get("supplier_name") and s in r["supplier_name"].lower())
            )
        ]
    
    return {"checks": results}


@router.get("/stats")
def get_check_stats(db: Session = Depends(get_db)):
    """Cek portfoy istatistikleri"""
    all_checks = db.query(Check).filter(Check.is_deleted == False).all()
    
    in_portfolio = sum(c.amount for c in all_checks if c.status == CheckStatus.IN_PORTFOLIO and c.check_type == CheckType.INCOMING)
    outgoing_portfolio = sum(c.amount for c in all_checks if c.status == CheckStatus.IN_PORTFOLIO and c.check_type == CheckType.OUTGOING)
    collected = sum(c.amount for c in all_checks if c.status == CheckStatus.COLLECTED)
    bounced = sum(c.amount for c in all_checks if c.status == CheckStatus.BOUNCED)
    
    return {
        "incoming_in_portfolio": round(in_portfolio, 2),
        "outgoing_in_portfolio": round(outgoing_portfolio, 2),
        "total_collected": round(collected, 2),
        "total_bounced": round(bounced, 2),
        "total_count": len(all_checks),
    }


@router.get("/{check_id}")
def get_check(check_id: str, db: Session = Depends(get_db)):
    """Tekil cek detayi"""
    check = db.query(Check).filter(Check.id == check_id, Check.is_deleted == False).first()
    if not check:
        raise HTTPException(status_code=404, detail="Cek bulunamadi")
    return _check_to_dict(check)


@router.post("")
@router.post("/")
def create_check(data: dict, db: Session = Depends(get_db)):
    """Yeni cek kaydi olustur"""
    check_id = str(uuid.uuid4())
    check = Check(
        id=check_id,
        check_type=CheckType(data.get("check_type", "INCOMING")),
        check_number=data.get("check_number", ""),
        bank_name=data.get("bank_name", ""),
        branch_name=data.get("branch_name"),
        account_number=data.get("account_number"),
        issuer=data.get("issuer", ""),
        customer_id=data.get("customer_id"),
        supplier_id=data.get("supplier_id"),
        issue_date=data.get("issue_date", date.today().isoformat()),
        due_date=data.get("due_date", date.today().isoformat()),
        amount=float(data.get("amount", 0)),
        status=CheckStatus.IN_PORTFOLIO,
        notes=data.get("notes"),
    )
    db.add(check)
    db.commit()
    db.refresh(check)
    return _check_to_dict(check)


@router.patch("/{check_id}/status")
def update_check_status(check_id: str, data: dict, db: Session = Depends(get_db)):
    """Cek durumunu guncelle (Tahsil et, Ciro et, Karsiliksiz isaretle)"""
    check = db.query(Check).filter(Check.id == check_id, Check.is_deleted == False).first()
    if not check:
        raise HTTPException(status_code=404, detail="Cek bulunamadi")
    
    new_status = data.get("status")
    try:
        check.status = CheckStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Gecersiz durum: {new_status}")
    
    # Eger tahsil edildiyse kasaya/bankaya gelir isle
    if check.status == CheckStatus.COLLECTED and check.check_type == CheckType.INCOMING:
        target_source = data.get("payment_source", "BANK")
        tx = Transaction(
            id=str(uuid.uuid4()),
            type=TransactionType.INCOME,
            category="Cek Tahsilati",
            amount=check.amount,
            description=f"Cek No: {check.check_number} ({check.bank_name}) tahsilati",
            payment_source=target_source,
            payment_method=PaymentMethod.CARD,
            source=TransactionSource.POS,
            reference_id=check.id,
            user_id="system",
        )
        db.add(tx)
    
    db.commit()
    db.refresh(check)
    return _check_to_dict(check)


@router.delete("/{check_id}")
def delete_check(check_id: str, db: Session = Depends(get_db)):
    """Cek kaydini sil (soft delete)"""
    check = db.query(Check).filter(Check.id == check_id).first()
    if not check:
        raise HTTPException(status_code=404, detail="Cek bulunamadi")
    check.is_deleted = True
    db.commit()
    return {"message": "Cek silindi"}