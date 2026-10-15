"""
DateTime Utilities
"""

from datetime import datetime, timezone
from typing import Optional


def get_utc_now() -> datetime:
    """
    UTC zamanını döndürür
    @returns: Current UTC datetime
    """
    return datetime.now(timezone.utc)


def to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Datetime'ı UTC'ye çevirir (zaten UTC ise değişmez)
    @param dt: Datetime object
    @returns: UTC datetime or None
    """
    if dt is None:
        return None
    
    if dt.tzinfo is None:
        # Naive datetime, assume it's UTC
        return dt.replace(tzinfo=timezone.utc)
    
    return dt.astimezone(timezone.utc)


def format_datetime(dt: Optional[datetime]) -> Optional[str]:
    """
    Datetime'ı ISO format string'e çevirir
    @param dt: Datetime object
    @returns: ISO format string or None
    """
    if dt is None:
        return None
    
    return to_utc(dt).isoformat()


