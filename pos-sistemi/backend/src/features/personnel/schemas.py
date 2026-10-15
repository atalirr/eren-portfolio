"""
Personnel Pydantic Schemas
Personel Yönetimi için Pydantic şemaları
"""

from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class EmployeeBase(BaseModel):
    """Employee base schema"""
    user_id: str = Field(..., description="Kullanıcı ID (UUID)")
    salary: float = Field(..., ge=0, description="Aylık maaş (TL)")
    bonus_rate: float = Field(..., ge=0, le=100, description="Prim oranı (%)")
    pin: Optional[str] = Field(None, max_length=10, description="Giriş şifresi (PIN)")
    start_date: date = Field(..., description="İşe başlama tarihi")


class EmployeeCreate(EmployeeBase):
    """Employee create schema"""
    pass


class EmployeeUpdate(BaseModel):
    """Employee update schema"""
    salary: Optional[float] = Field(None, ge=0, description="Aylık maaş (TL)")
    bonus_rate: Optional[float] = Field(None, ge=0, le=100, description="Prim oranı (%)")
    pin: Optional[str] = Field(None, max_length=10, description="Giriş şifresi (PIN)")
    is_active: Optional[bool] = Field(None, description="Aktif mi?")


class EmployeeResponse(EmployeeBase):
    """Employee response schema"""
    id: str = Field(..., description="UUID")
    is_active: bool = Field(..., description="Aktif mi?")
    created_at: datetime
    updated_at: datetime
    
    # User bilgileri (join ile gelecek)
    username: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class EmployeeAdvanceBase(BaseModel):
    """Employee Advance base schema"""
    employee_id: str = Field(..., description="Personel ID (UUID)")
    amount: float = Field(..., gt=0, description="Avans tutarı (TL)")
    advance_date: date = Field(..., description="Avans tarihi")
    description: Optional[str] = Field(None, description="Avans açıklaması")


class EmployeeAdvanceCreate(EmployeeAdvanceBase):
    """Employee Advance create schema"""
    pass


class EmployeeAdvanceResponse(EmployeeAdvanceBase):
    """Employee Advance response schema"""
    id: str = Field(..., description="UUID")
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class EmployeeFinanceResponse(BaseModel):
    """Employee Finance response schema"""
    employee_id: str
    salary: float
    bonus_rate: float
    total_sales: float = Field(default=0.0, description="Toplam satış (TL)")
    estimated_earnings: float = Field(default=0.0, description="Tahmini hakediş (TL)")
    advances: List[EmployeeAdvanceResponse] = Field(default_factory=list)


class EmployeeStatsResponse(BaseModel):
    """Employee Stats response schema"""
    employee_id: str
    total_sales: float = Field(default=0.0, description="Toplam satış (TL)")
    total_transactions: int = Field(default=0, description="Toplam işlem sayısı")
    average_basket: float = Field(default=0.0, description="Ortalama sepet tutarı (TL)")
    sales_by_month: List[dict] = Field(default_factory=list, description="Aylık satış verileri")

