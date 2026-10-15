"""
Analytics Routers
FastAPI Routes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import traceback

from src.shared.database.session import get_db
from src.features.analytics.services import AnalyticsService


router = APIRouter()


@router.get("/analytics/stats")
async def get_all_stats(
    db: Session = Depends(get_db)
):
    """Tüm analitik istatistikleri getir"""
    try:
        service = AnalyticsService(db)
        return service.get_all_stats()
    except Exception as e:
        print(f"[ERROR] Analytics hatasi: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analytics verileri alınamadı: {str(e)}"
        )

