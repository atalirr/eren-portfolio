"""
Orders Routers
FastAPI Routes

ÖNEMLİ: Route sıralaması kritik!
- Sabit path'li route'lar (örn: /statistics/*) EN ÜSTTE olmalı
- Dinamik path'li route'lar (örn: /{order_id}) EN ALTA olmalı
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from src.shared.database.session import get_db
from src.features.orders import schemas
from src.features.orders.services import OrderService


router = APIRouter()


# ============================================================================
# STATISTICS ROUTES - EN ÜSTTE (Sabit path'ler dinamik path'lerden önce)
# ============================================================================

@router.get("/statistics/payment-methods")
async def get_payment_method_statistics(
    db: Session = Depends(get_db)
):
    """Ödeme yöntemleri istatistiklerini getir"""
    service = OrderService(db)
    return service.get_payment_method_statistics()


@router.get("/statistics/weekly-trend", response_model=List[dict])
async def get_weekly_sales_trend(
    db: Session = Depends(get_db)
):
    """
    Haftalık satış trendini getir (Son 7 gün - POS ve Online ayrı)
    
    Returns:
        List[dict]: Her gün için {day: str, pos: float, online: float} formatında liste
    """
    try:
        service = OrderService(db)
        result = service.get_weekly_sales_trend()
        # Boş liste döndüğünden emin ol
        if not result:
            return []
        return result
    except Exception as e:
        import traceback
        print(f"[ERROR] Haftalık satış trendi yüklenirken hata: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Haftalık satış trendi yüklenirken hata oluştu: {str(e)}"
        )


@router.get("/statistics/daily-trend", response_model=List[dict])
async def get_daily_sales_trend(
    db: Session = Depends(get_db)
):
    """
    Günlük satış trendini getir (Bugün saatlik - POS ve Online ayrı)
    
    Returns:
        List[dict]: Her saat için {hour: str, pos: float, online: float} formatında liste
    """
    try:
        service = OrderService(db)
        result = service.get_daily_sales_trend()
        # Boş liste döndüğünden emin ol
        if not result:
            return []
        return result
    except Exception as e:
        import traceback
        print(f"[ERROR] Günlük satış trendi yüklenirken hata: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Günlük satış trendi yüklenirken hata oluştu: {str(e)}"
        )


@router.get("/code/{order_number}", response_model=schemas.OrderWithItems)
async def get_order_by_code(
    order_number: str,
    db: Session = Depends(get_db)
):
    """Sipariş numarasına göre sipariş getir"""
    from src.features.orders.models import Order
    order = db.query(Order).filter(
        Order.order_number == order_number,
        Order.is_deleted == False
    ).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sipariş bulunamadı: {order_number}"
        )
    return order


# ============================================================================
# CRUD ROUTES - Dinamik path'ler en altta
# ============================================================================

@router.get("", response_model=List[schemas.OrderWithItems])
async def get_orders(
    include_deleted: bool = False,
    include_items: bool = True,
    db: Session = Depends(get_db)
):
    """Tüm siparişleri getir (items dahil)"""
    try:
        service = OrderService(db)
        orders = service.get_all(include_deleted=include_deleted, include_items=include_items)
        return orders
    except Exception as e:
        import traceback
        print(f"[ERROR] Siparişler yüklenirken hata: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Siparişler yüklenirken hata oluştu: {str(e)}"
        )


@router.post("", response_model=schemas.OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: schemas.OrderCreate,
    user_id: str = Query(default="default-user-id", description="Kullanıcı ID"),  # TODO: Gerçek uygulamada JWT token'dan alınmalı
    db: Session = Depends(get_db)
):
    """Yeni sipariş oluştur (Zincirleme satış mantığı)"""
    try:
        service = OrderService(db)
        return service.process_sale(order_data, user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        print(f"[ERROR] Satış işlemi hatası: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Satış işlemi sırasında hata oluştu: {str(e)}"
        )


# Dinamik path'li route'lar EN SONDA olmalı
@router.get("/{order_id}", response_model=schemas.OrderWithItems)
async def get_order(
    order_id: str,
    db: Session = Depends(get_db)
):
    """ID'ye göre sipariş getir"""
    service = OrderService(db)
    order = service.get_by_id(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sipariş bulunamadı: {order_id}"
        )
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: str,
    db: Session = Depends(get_db)
):
    """Siparişi sil (soft delete)"""
    service = OrderService(db)
    success = service.delete(order_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sipariş bulunamadı: {order_id}"
        )


@router.patch("/{order_id}/approve", response_model=schemas.OrderResponse)
async def approve_credit_sale(
    order_id: str,
    user_id: str = Query(default="default-user-id", description="Kullanıcı ID"),
    db: Session = Depends(get_db)
):
    """Veresiye satışını onayla (grafiklere ve istatistiklere yansıt)"""
    try:
        service = OrderService(db)
        return service.approve_credit_sale(order_id, user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        print(f"[ERROR] Veresiye satış onaylama hatası: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Onaylama hatası: {str(e)}"
        )
