"""
Inventory Statistics Routers
API Routes for Intelligent Dashboard Statistics
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.shared.database.session import get_db
from src.features.inventory.statistics_service import InventoryStatisticsService


router = APIRouter()


@router.get("/statistics/financial", response_model=dict)
async def get_financial_statistics(
    db: Session = Depends(get_db)
):
    """Finansal Envanter Değeri - Kart 1"""
    try:
        service = InventoryStatisticsService(db)
        return service.get_financial_inventory_value()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Finansal istatistikler alınamadı: {str(e)}"
        )


@router.get("/statistics/warnings", response_model=dict)
async def get_stock_warnings(
    db: Session = Depends(get_db)
):
    """Stok Uyarı Merkezi - Kart 2"""
    try:
        service = InventoryStatisticsService(db)
        return service.get_stock_warnings()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Stok uyarıları alınamadı: {str(e)}"
        )


@router.get("/statistics/turnover", response_model=dict)
async def get_inventory_turnover(
    db: Session = Depends(get_db)
):
    """Envanter Devir Hızı - Kart 3"""
    try:
        service = InventoryStatisticsService(db)
        return service.get_inventory_turnover_rate()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Devir hızı istatistikleri alınamadı: {str(e)}"
        )


@router.get("/statistics/dead-stock", response_model=dict)
async def get_dead_stock_list(
    db: Session = Depends(get_db)
):
    """Ölü Stok Listesi - Kart 4"""
    try:
        service = InventoryStatisticsService(db)
        return service.get_dead_stock_list()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ölü stok listesi alınamadı: {str(e)}"
        )


@router.get("/statistics/all", response_model=dict)
async def get_all_statistics(
    db: Session = Depends(get_db)
):
    """Tüm İstatistikleri Tek Seferde Getir"""
    try:
        service = InventoryStatisticsService(db)
        return service.get_all_statistics()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"İstatistikler alınamadı: {str(e)}"
        )


@router.get("/statistics/kpis")
async def get_inventory_kpis(db: Session = Depends(get_db)):
    """Envanter KPI'larını getir - Dashboard Üst Kartlar"""
    from src.features.inventory.models import Product
    from sqlalchemy import func
    
    total_products = db.query(func.count(Product.id)).filter(Product.is_active == True, Product.is_deleted == False).scalar()
    critical_stock = db.query(func.count(Product.id)).filter(
        Product.is_active == True, 
        Product.is_deleted == False, 
        Product.stock_quantity <= Product.critical_level,
        Product.stock_quantity > 0
    ).scalar()
    out_of_stock = db.query(func.count(Product.id)).filter(
        Product.is_active == True, 
        Product.is_deleted == False, 
        Product.stock_quantity == 0
    ).scalar()
    
    # Toplam envanter değeri (Satış ve Maliyet)
    inventory_value_sell = db.query(func.sum(Product.sell_price * Product.stock_quantity)).filter(Product.is_active == True, Product.is_deleted == False).scalar() or 0
    inventory_value_cost = db.query(func.sum(Product.buy_price * Product.stock_quantity)).filter(Product.is_active == True, Product.is_deleted == False).scalar() or 0

    return {
        "total_products": total_products,
        "critical_stock": critical_stock,
        "out_of_stock": out_of_stock,
        "inventory_sell": inventory_value_sell,
        "inventory_cost": inventory_value_cost
    }
