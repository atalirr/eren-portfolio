"""
Transactions Routers
FastAPI Routes
"""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from src.shared.database.session import get_db
from src.features.transactions import schemas
from src.features.transactions.services import TransactionService


# Router'ı oluştur - Prefix'i boş bırakıyoruz, app.py'de /api/transactions olarak eklenecek
router = APIRouter()


@router.get("", response_model=List[schemas.TransactionResponse])
@router.get("/", response_model=List[schemas.TransactionResponse])
async def get_transactions(
    include_deleted: bool = False,
    db: Session = Depends(get_db)
):
    """Tüm kasa hareketlerini getir"""
    service = TransactionService(db)
    return service.get_all(include_deleted=include_deleted)


@router.get("/balance", response_model=dict)
async def get_balance(
    include_transfers: bool = Query(False, description="Virman işlemleri dahil edilsin mi"),
    payment_source: Optional[str] = Query(None, description="Ödeme kaynağı filtresi: CASH veya BANK"),
    db: Session = Depends(get_db)
):
    """Kasa bakiyesini hesapla"""
    service = TransactionService(db)
    if payment_source and payment_source not in ['CASH', 'BANK']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="payment_source 'CASH' veya 'BANK' olmalıdır"
        )
    balance = service.get_balance(include_transfers=include_transfers, payment_source=payment_source)
    return {"balance": balance}


@router.post("/expense", response_model=schemas.TransactionResponse, status_code=status.HTTP_201_CREATED)
async def add_expense(
    request: schemas.TransactionCreateRequest,
    payment_source: str = Query('CASH', description="Ödeme kaynağı: CASH, BANK"),
    payment_method: Optional[str] = Query(None, description="Ödeme yöntemi: CASH, CARD, TRANSFER"),
    supplier_id: Optional[str] = Query(None, description="Tedarikçi ID (M2 Cari Senkronizasyonu)"),
    db: Session = Depends(get_db)
):
    """Gider girişi"""
    service = TransactionService(db)
    if request.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gider tutarı sıfırdan büyük olmalıdır"
        )
    return service.add_expense(request.amount, request.category, request.description, request.user_id, payment_source, payment_method, supplier_id=supplier_id)


@router.post("/income", response_model=schemas.TransactionResponse, status_code=status.HTTP_201_CREATED)
async def add_income(
    request: schemas.TransactionCreateRequest,
    payment_source: str = Query('CASH', description="Ödeme kaynağı: CASH, BANK"),
    payment_method: Optional[str] = Query(None, description="Ödeme yöntemi: CASH, CARD, TRANSFER"),
    customer_id: Optional[str] = Query(None, description="Müşteri ID"),
    sale_order_id: Optional[str] = Query(None, description="SaleOrder ID (veresiye tahsilat için müşteri otomatik tespit edilir)"),
    db: Session = Depends(get_db)
):
    """Gelir girişi (Tahsilat vb.)"""

    service = TransactionService(db)
    if request.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gelir tutarı sıfırdan büyük olmalıdır"
        )
    return service.add_income(request.amount, request.category, request.description, request.user_id, payment_source, payment_method, customer_id, sale_order_id)


@router.get("/summary/daily", response_model=dict)
async def get_daily_summary(
    date: Optional[str] = Query(None, description="Tarih (YYYY-MM-DD)"),
    include_transfers: bool = Query(False, description="Virman işlemleri dahil edilsin mi"),
    payment_source: Optional[str] = Query(None, description="Ödeme kaynağı filtresi: CASH veya BANK"),
    db: Session = Depends(get_db)
):
    """Günlük kasa özeti"""
    service = TransactionService(db)
    date_obj = datetime.strptime(date, "%Y-%m-%d") if date else None
    return service.get_daily_summary(date_obj, include_transfers=include_transfers, payment_source=payment_source)


@router.get("/statistics/categories", response_model=dict)
async def get_category_statistics(
    days: int = Query(30, ge=1, le=365, description="Son kaç gün"),
    include_transfers: bool = Query(False, description="Virman işlemleri dahil edilsin mi"),
    payment_source: Optional[str] = Query(None, description="Ödeme kaynağı filtresi: CASH veya BANK"),
    db: Session = Depends(get_db)
):
    """Kategori bazlı istatistikler"""
    service = TransactionService(db)
    return service.get_category_statistics(days, include_transfers=include_transfers, payment_source=payment_source)


@router.get("/trend/weekly", response_model=List[dict])
async def get_weekly_trend(
    weeks: int = Query(4, ge=1, le=52, description="Son kaç hafta"),
    include_transfers: bool = Query(False, description="Virman işlemleri dahil edilsin mi"),
    payment_source: Optional[str] = Query(None, description="Ödeme kaynağı filtresi: CASH veya BANK"),
    db: Session = Depends(get_db)
):
    """Haftalık trend verisi"""
    service = TransactionService(db)
    return service.get_weekly_trend(weeks, include_transfers=include_transfers, payment_source=payment_source)


@router.get("/trend/daily", response_model=List[dict])
async def get_daily_trend(
    days: int = Query(7, ge=1, le=90, description="Son kaç gün"),
    include_transfers: bool = Query(False, description="Virman işlemleri dahil edilsin mi"),
    payment_source: Optional[str] = Query(None, description="Ödeme kaynağı filtresi: CASH veya BANK"),
    db: Session = Depends(get_db)
):
    """Günlük trend verisi"""
    service = TransactionService(db)
    return service.get_daily_trend(days, include_transfers=include_transfers, payment_source=payment_source)


@router.get("/trend/monthly", response_model=List[dict])
async def get_monthly_trend(
    months: int = Query(6, ge=1, le=24, description="Son kaç ay"),
    include_transfers: bool = Query(False, description="Virman işlemleri dahil edilsin mi"),
    payment_source: Optional[str] = Query(None, description="Ödeme kaynağı filtresi: CASH veya BANK"),
    db: Session = Depends(get_db)
):
    """Aylık trend verisi"""
    service = TransactionService(db)
    return service.get_monthly_trend(months, include_transfers=include_transfers, payment_source=payment_source)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: str,
    db: Session = Depends(get_db)
):
    """Transaction'ı sil (soft delete)"""
    service = TransactionService(db)
    if not service.delete(transaction_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"İşlem bulunamadı: {transaction_id}"
        )


@router.post("/{transaction_id}/refund", response_model=dict)
async def refund_sale_transaction(
    transaction_id: str,
    user_id: str = Query("default-user"),
    db: Session = Depends(get_db),
):
    """Satış iadesi"""
    service = TransactionService(db)
    try:
        return service.refund_sale(transaction_id=transaction_id, user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/transfer", response_model=dict, status_code=status.HTTP_201_CREATED)
async def transfer(
    request: schemas.TransferRequest,
    db: Session = Depends(get_db)
):
    """Virman işlemi"""
    service = TransactionService(db)
    try:
        expense_transaction, income_transaction = service.transfer(
            request.amount, 
            request.from_source, 
            request.to_source, 
            request.description or "", 
            request.user_id
        )
        return {
            "expense_transaction": expense_transaction,
            "income_transaction": income_transaction,
            "message": "Virman işlemi başarıyla tamamlandı"
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{transaction_id}", response_model=schemas.TransactionResponse)
async def get_transaction(
    transaction_id: str,
    db: Session = Depends(get_db)
):
    """ID'ye göre işlem getir"""
    service = TransactionService(db)
    transaction = service.get_by_id(transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="İşlem bulunamadı")
    return transaction
