"""
Settings Routers
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.shared.database.session import get_db
from src.features.settings.schemas import SettingResponse, SettingUpdate
from src.features.settings.services import SettingService

router = APIRouter()


@router.get("", response_model=List[SettingResponse])
async def get_settings(db: Session = Depends(get_db)):
    """Tüm ayarları getir"""
    service = SettingService(db)
    return service.get_all()


@router.get("/{key}", response_model=SettingResponse)
async def get_setting(key: str, db: Session = Depends(get_db)):
    """Anahtara göre ayar getir"""
    service = SettingService(db)
    setting = service.get_by_key(key)
    if not setting:
        raise HTTPException(status_code=404, detail="Ayar bulunamadı")
    return setting


@router.put("/{key}", response_model=SettingResponse)
async def update_setting(key: str, setting_update: SettingUpdate, db: Session = Depends(get_db)):
    """Ayar güncelle veya oluştur"""
    service = SettingService(db)
    return service.update_setting(key, setting_update.value)
