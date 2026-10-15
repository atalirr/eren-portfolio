"""
E-Commerce Routers
FastAPI Routes for E-Commerce Feature
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from src.shared.database.session import get_db
from src.features.ecommerce import schemas
from src.features.ecommerce.models import MarketplaceConfig, ProductMapping
from src.features.ecommerce.simulation_service import SimulationService
from src.features.orders.models import Order, OrderSource, MarketplacePlatform, MarketplaceStatus

router = APIRouter(tags=["E-Commerce"])


# ============================================
# MarketplaceConfig Routes
# ============================================

@router.get("/marketplace-configs", response_model=List[schemas.MarketplaceConfigResponse])
async def get_marketplace_configs(db: Session = Depends(get_db)):
    """Tüm pazaryeri ayarlarını getir"""
    return db.query(MarketplaceConfig).filter(MarketplaceConfig.is_deleted == False).all()


@router.get("/marketplace-configs/{config_id}", response_model=schemas.MarketplaceConfigResponse)
async def get_marketplace_config(config_id: str, db: Session = Depends(get_db)):
    """ID'ye göre pazaryeri ayarı getir"""
    config = db.query(MarketplaceConfig).filter(
        and_(MarketplaceConfig.id == config_id, MarketplaceConfig.is_deleted == False)
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Pazaryeri ayarı bulunamadı")
    return config


@router.post("/marketplace-configs", response_model=schemas.MarketplaceConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_marketplace_config(
    config_data: schemas.MarketplaceConfigCreate,
    db: Session = Depends(get_db)
):
    """Yeni pazaryeri ayarı oluştur"""
    config = MarketplaceConfig(**config_data.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.put("/marketplace-configs/{config_id}", response_model=schemas.MarketplaceConfigResponse)
async def update_marketplace_config(
    config_id: str,
    config_data: schemas.MarketplaceConfigUpdate,
    db: Session = Depends(get_db)
):
    """Pazaryeri ayarı güncelle"""
    config = db.query(MarketplaceConfig).filter(
        and_(MarketplaceConfig.id == config_id, MarketplaceConfig.is_deleted == False)
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Pazaryeri ayarı bulunamadı")
    
    update_data = config_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)
    
    db.commit()
    db.refresh(config)
    return config


@router.delete("/marketplace-configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_marketplace_config(config_id: str, db: Session = Depends(get_db)):
    """Pazaryeri ayarı sil"""
    config = db.query(MarketplaceConfig).filter(
        and_(MarketplaceConfig.id == config_id, MarketplaceConfig.is_deleted == False)
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Pazaryeri ayarı bulunamadı")
    
    config.is_deleted = True
    db.commit()


# ============================================
# ProductMapping Routes
# ============================================

@router.get("/product-mappings", response_model=List[schemas.ProductMappingResponse])
async def get_product_mappings(
    product_id: str = None,
    marketplace_config_id: str = None,
    db: Session = Depends(get_db)
):
    """Ürün eşleştirmelerini getir"""
    query = db.query(ProductMapping).filter(ProductMapping.is_deleted == False)
    if product_id:
        query = query.filter(ProductMapping.product_id == product_id)
    if marketplace_config_id:
        query = query.filter(ProductMapping.marketplace_config_id == marketplace_config_id)
    return query.all()


@router.post("/product-mappings", response_model=schemas.ProductMappingResponse, status_code=status.HTTP_201_CREATED)
async def create_product_mapping(
    mapping_data: schemas.ProductMappingCreate,
    db: Session = Depends(get_db)
):
    """Yeni ürün eşleştirmesi oluştur"""
    mapping = ProductMapping(**mapping_data.model_dump())
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping


@router.put("/product-mappings/{mapping_id}", response_model=schemas.ProductMappingResponse)
async def update_product_mapping(
    mapping_id: str,
    mapping_data: schemas.ProductMappingUpdate,
    db: Session = Depends(get_db)
):
    """Ürün eşleştirmesi güncelle"""
    mapping = db.query(ProductMapping).filter(
        and_(ProductMapping.id == mapping_id, ProductMapping.is_deleted == False)
    ).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Ürün eşleştirmesi bulunamadı")
    
    update_data = mapping_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(mapping, key, value)
    
    db.commit()
    db.refresh(mapping)
    return mapping


# ============================================
# Simulation Routes
# ============================================

@router.post("/simulate/order")
async def simulate_order(
    request: schemas.SimulationRequest,
    db: Session = Depends(get_db)
):
    """Simülasyon siparişi oluştur"""
    service = SimulationService(db)
    if request.count == 1:
        order = service.simulate_incoming_order(request.platform)
        if not order:
            raise HTTPException(status_code=400, detail="Yeterli ürün bulunamadı")
        return {"message": "Sipariş oluşturuldu", "order_id": order.id, "order_number": order.order_number}
    else:
        orders = service.simulate_batch_orders(request.count, request.platform)
        return {"message": f"{len(orders)} sipariş oluşturuldu", "count": len(orders)}


# ============================================
# Analytics Routes
# ============================================

@router.get("/analytics/revenue")
async def get_online_revenue(db: Session = Depends(get_db)):
    """Online satış gelirini getir"""
    try:
        # Online satış geliri
        total_revenue = db.query(func.sum(Order.final_amount)).filter(
            and_(
                Order.source == OrderSource.ONLINE,
                Order.is_deleted == False
            )
        ).scalar()
        total_revenue = float(total_revenue) if total_revenue else 0.0
        
        # POS satış geliri
        pos_revenue = db.query(func.sum(Order.final_amount)).filter(
            and_(
                Order.source == OrderSource.POS,
                Order.is_deleted == False
            )
        ).scalar()
        pos_revenue = float(pos_revenue) if pos_revenue else 0.0
        
        # NULL source'lu siparişler (eski veriler) POS olarak sayılır
        null_source_revenue = db.query(func.sum(Order.final_amount)).filter(
            and_(
                Order.source.is_(None),
                Order.is_deleted == False
            )
        ).scalar()
        null_source_revenue = float(null_source_revenue) if null_source_revenue else 0.0
        pos_revenue += null_source_revenue
        
        total = total_revenue + pos_revenue
        online_percentage = (total_revenue / total * 100) if total > 0 else 0
        
        return {
            "online_revenue": total_revenue,
            "pos_revenue": pos_revenue,
            "total_revenue": total,
            "online_percentage": round(online_percentage, 2)
        }
    except Exception as e:
        # Hata durumunda varsayılan değerler döndür
        return {
            "online_revenue": 0.0,
            "pos_revenue": 0.0,
            "total_revenue": 0.0,
            "online_percentage": 0.0
        }


@router.get("/analytics/platform-distribution")
async def get_platform_distribution(db: Session = Depends(get_db)):
    """Platform bazlı satış dağılımı"""
    try:
        results = db.query(
            Order.platform,
            func.sum(Order.final_amount).label("revenue"),
            func.count(Order.id).label("count")
        ).filter(
            and_(
                Order.source == OrderSource.ONLINE,
                Order.is_deleted == False,
                Order.platform.isnot(None)
            )
        ).group_by(Order.platform).all()
        
        return [
            {
                "platform": r.platform.value if r.platform else "UNKNOWN",
                "revenue": float(r.revenue or 0),
                "count": r.count
            }
            for r in results
        ]
    except Exception as e:
        # Hata durumunda boş liste döndür
        return []


@router.get("/analytics/sales-trend")
async def get_sales_trend(days: int = 30, db: Session = Depends(get_db)):
    """Online satış trendi"""
    from datetime import datetime, timedelta
    from sqlalchemy import func
    
    try:
        start_date = datetime.now() - timedelta(days=days)
        
        # SQLite için tarih formatı
        # SQLite'da strftime kullanarak tarih çıkarıyoruz
        results = db.query(
            func.strftime('%Y-%m-%d', Order.created_at).label("date"),
            func.sum(Order.final_amount).label("revenue"),
            func.count(Order.id).label("count")
        ).filter(
            and_(
                Order.source == OrderSource.ONLINE,
                Order.is_deleted == False,
                Order.created_at >= start_date
            )
        ).group_by("date").order_by("date").all()
        
        return [
            {
                "date": str(r.date),
                "revenue": float(r.revenue or 0),
                "count": r.count
            }
            for r in results
        ]
    except Exception as e:
        # Hata durumunda boş liste döndür
        return []


@router.get("/orders/pending")
async def get_pending_orders(db: Session = Depends(get_db)):
    """Kargolanmayı bekleyen siparişler"""
    orders = db.query(Order).filter(
        and_(
            Order.source == OrderSource.ONLINE,
            Order.marketplace_status.in_([MarketplaceStatus.NEW, MarketplaceStatus.PREPARING]),
            Order.is_deleted == False
        )
    ).order_by(Order.created_at.desc()).limit(20).all()
    
    return [
        {
            "id": o.id,
            "order_number": o.order_number,
            "platform": o.platform.value if o.platform else None,
            "marketplace_status": o.marketplace_status.value if o.marketplace_status else None,
            "final_amount": o.final_amount,
            "created_at": o.created_at.isoformat()
        }
        for o in orders
    ]

