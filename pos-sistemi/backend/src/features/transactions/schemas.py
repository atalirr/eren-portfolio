"""
Transactions Pydantic Schemas
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from src.features.transactions.models import TransactionType, TransactionSource, PaymentMethod


class TransactionBase(BaseModel):
    """Transaction base schema"""
    type: TransactionType = Field(..., description="İşlem tipi: INCOME, EXPENSE")
    category: Optional[str] = Field(None, max_length=100, description="Kategori")
    amount: float = Field(..., description="Tutar")
    description: Optional[str] = Field(None, description="Açıklama")
    payment_source: Optional[str] = Field('CASH', description="Ödeme kaynağı: CASH, BANK")
    related_order_id: Optional[str] = Field(None, description="İlgili sipariş ID (UUID)")
    source: Optional[TransactionSource] = Field(None, description="İşlem kaynağı: POS, INVOICE, ECOMMERCE, MANUAL")
    payment_method: Optional[PaymentMethod] = Field(None, description="Ödeme yöntemi: CASH, CARD, TRANSFER")
    reference_id: Optional[str] = Field(None, description="İlgili kayıt ID'si (sipariş, fatura vb.)")



class TransactionCreate(BaseModel):
    """Transaction create schema"""
    type: TransactionType
    category: Optional[str] = None
    amount: float = Field(..., ge=0)
    description: Optional[str] = None

class TransactionCreateRequest(BaseModel):
    """Schema for manual transaction entry (Income/Expense)"""
    amount: float = Field(..., ge=0)
    category: str
    description: str
    user_id: str = "default-user"


class TransactionResponse(TransactionBase):
    """Transaction response schema"""
    id: str = Field(..., description="UUID")
    user_id: Optional[str] = Field(None, description="Kullanıcı ID (UUID)")
    platform: Optional[str] = Field(None, description="Pazaryeri/kanal: LOCAL, TRENDYOL vb.")
    related_order_id: Optional[str] = Field(None, description="İlgili sipariş ID")
    created_at: datetime
    updated_at: datetime
    is_synced: bool
    is_deleted: bool
    
    model_config = ConfigDict(from_attributes=True)



class TransferRequest(BaseModel):
    """Transfer request schema"""
    amount: float = Field(..., gt=0, description="Transfer tutarı")
    from_source: str = Field(..., description="Kaynak: CASH veya BANK")
    to_source: str = Field(..., description="Hedef: CASH veya BANK")
    description: Optional[str] = Field("", description="Açıklama")
    user_id: str = Field("default-user", description="Kullanıcı ID")