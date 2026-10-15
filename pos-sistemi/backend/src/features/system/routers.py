"""
System Routers
FastAPI Routes
"""

from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.shared.database.session import get_db
from src.features.system.models import SystemLog
from src.features.system.services import SystemLogService


import urllib.request
import json
from src.features.settings.services import SettingService


router = APIRouter()


@router.get("/system-logs", response_model=List[dict])
async def get_system_logs(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Sistem loglarını getir (Dashboard canlı akış için)"""
    service = SystemLogService(db)
    logs = service.get_recent_logs(limit=limit)
    return [
        {
            "id": log.id,
            "action_type": log.action_type,
            "details": log.details,
            "created_at": log.created_at.isoformat(),
            "user_id": log.user_id,
        }
        for log in logs
    ]


@router.get("/remote-content")
def get_remote_content(db: Session = Depends(get_db)):
    """Uzaktaki duyuruları ve dinamik sayfa içeriklerini çek (Veri kaybı olmadan uzaktan yönetim için)"""
    settings_service = SettingService(db)
    url_setting = settings_service.get_by_key("remote_content_url")
    
    # Varsayılan fallback URL'niz (istediğiniz zaman buraya güncel JSON'u koyabilirsiniz)
    url = url_setting.value if url_setting else "https://raw.githubusercontent.com/erena/pos-remote/main/content.json"
    
    if not url or not url.startswith("http"):
        return {
            "status": "disabled",
            "announcements": [],
            "dynamic_pages": {}
        }
        
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) POS6-Client'}
        )
        # 3 saniye timeout (çevrimdışı/offline modda arayüzün kilitlenmemesi için)
        with urllib.request.urlopen(req, timeout=3.0) as response:
            data = response.read()
            return json.loads(data.decode('utf-8'))
    except Exception as e:
        return {
            "status": "offline",
            "announcements": [],
            "dynamic_pages": {},
            "error_msg": str(e)
        }


