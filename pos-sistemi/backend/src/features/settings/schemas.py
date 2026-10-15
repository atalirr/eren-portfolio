"""
Settings Schemas
"""

from typing import Optional
from pydantic import BaseModel


class SettingBase(BaseModel):
    key: str
    value: Optional[str] = None
    description: Optional[str] = None


class SettingCreate(SettingBase):
    pass


class SettingUpdate(BaseModel):
    value: str


class SettingResponse(SettingBase):
    id: str

    class Config:
        from_attributes = True
