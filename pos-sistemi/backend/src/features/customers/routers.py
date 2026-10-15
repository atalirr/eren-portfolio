"""
Customers Routers
FastAPI Routes
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from src.shared.database.session import get_db
from src.features.customers import schemas
from src.features.customers.services import CustomerService


router = APIRouter()


@router.get("/customers", response_model=List[schemas.CustomerResponse])
async def get_customers(
    include_deleted: bool = False,
    search: Optional[str] = Query(None, description="Arama terimi (isim, telefon, email)"),
    db: Session = Depends(get_db)
):
    """Tüm müşterileri getir"""
    service = CustomerService(db)
    return service.get_all(include_deleted=include_deleted, search=search)


@router.get("/customers/debts", response_model=List[schemas.CustomerResponse])
async def get_customer_debts(
    db: Session = Depends(get_db)
):
    """Borcu olan müşterileri getir (balance > 0)"""
    service = CustomerService(db)
    all_customers = service.get_all(include_deleted=False)
    # Sadece borcu olan müşterileri döndür (balance > 0)
    return [c for c in all_customers if c.balance > 0]


@router.get("/customers/{customer_id}", response_model=schemas.CustomerResponse)
async def get_customer(
    customer_id: str,
    db: Session = Depends(get_db)
):
    """ID'ye göre müşteri getir"""
    service = CustomerService(db)
    customer = service.get_by_id(customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Müşteri bulunamadı: {customer_id}"
        )
    return customer


@router.get("/customers/{customer_id}/balance", response_model=schemas.CustomerBalanceResponse)
async def get_customer_balance(
    customer_id: str,
    db: Session = Depends(get_db)
):
    """Müşteri bakiyesi bilgilerini getir"""
    service = CustomerService(db)
    balance = service.get_balance(customer_id)
    if not balance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Müşteri bulunamadı: {customer_id}"
        )
    return balance


@router.post("/customers", response_model=schemas.CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer_data: schemas.CustomerCreate,
    db: Session = Depends(get_db)
):
    """Yeni müşteri oluştur"""
    service = CustomerService(db)
    return service.create(customer_data)


@router.put("/customers/{customer_id}", response_model=schemas.CustomerResponse)
async def update_customer(
    customer_id: str,
    customer_data: schemas.CustomerUpdate,
    db: Session = Depends(get_db)
):
    """Müşteriyi güncelle"""
    service = CustomerService(db)
    customer = service.update(customer_id, customer_data)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Müşteri bulunamadı: {customer_id}"
        )
    return customer


@router.post("/customers/{customer_id}/balance", response_model=schemas.CustomerResponse)
async def update_customer_balance(
    customer_id: str,
    amount: float = Query(..., description="Bakiye değişimi (borç için pozitif, ödeme için negatif)"),
    db: Session = Depends(get_db)
):
    """Müşteri bakiyesini güncelle"""
    service = CustomerService(db)
    customer = service.update_balance(customer_id, amount)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Müşteri bulunamadı: {customer_id}"
        )
    return customer


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: str,
    db: Session = Depends(get_db)
):
    """Müşteriyi sil (soft delete)"""
    service = CustomerService(db)
    success = service.delete(customer_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Müşteri bulunamadı: {customer_id}"
        )
    return None


@router.post("/customers/{customer_id}/deliver", response_model=schemas.CustomerResponse)
async def mark_delivery_done(
    customer_id: str,
    body: schemas.DeliveryRequest,
    db: Session = Depends(get_db)
):
    """
    Müşteriye teslimat yapıldı olarak işaretle.
    - Stokta ürün varsa stoktan düş ve satışı kasaya kaydet.
    - Stokta yoksa manuel fiyatla kasaya kaydet.
    - Sonraki teslimat tarihini otomatik hesapla.
    """
    service = CustomerService(db)
    result = service.record_delivery(
        customer_id=customer_id,
        manual_price=body.manual_price,
        payment_method=body.payment_method or "CASH"
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Müşteri bulunamadı: {customer_id}"
        )
    return result























