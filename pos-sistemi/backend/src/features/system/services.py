"""
System Services
System Logs
"""

from typing import List
from sqlalchemy.orm import Session

from src.features.system.models import SystemLog


class SystemLogService:
    """System Log Service"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_recent_logs(self, limit: int = 50) -> List[SystemLog]:
        """Son logları getir (Dashboard canlı akış için)"""
        return self.db.query(SystemLog).filter(
            SystemLog.is_deleted == False
        ).order_by(SystemLog.created_at.desc()).limit(limit).all()
    
    def create_log(self, user_id: str, action_type: str, details: str) -> SystemLog:
        """Yeni log oluştur"""
        log = SystemLog(
            user_id=user_id,
            action_type=action_type,
            details=details
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log


