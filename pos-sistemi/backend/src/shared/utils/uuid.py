"""
UUID Utilities
"""

import uuid
from typing import Optional


def generate_uuid() -> str:
    """
    UUIDv4 string oluşturur
    @returns: UUID string (örn: "550e8400-e29b-41d4-a716-446655440000")
    """
    return str(uuid.uuid4())


def is_valid_uuid(value: str) -> bool:
    """
    UUID string'inin geçerli olup olmadığını kontrol eder
    @param value: Kontrol edilecek string
    @returns: True if valid UUID, False otherwise
    """
    try:
        uuid.UUID(value)
        return True
    except (ValueError, TypeError):
        return False


def parse_uuid(value: Optional[str]) -> Optional[str]:
    """
    UUID string'ini parse eder, geçersizse None döner
    @param value: Parse edilecek string
    @returns: Valid UUID string or None
    """
    if not value:
        return None
    
    if is_valid_uuid(value):
        return value
    
    return None


