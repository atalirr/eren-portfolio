"""
Supplier Pydantic Schemas
Tedarikci Modulu - Veri Dogrulama Semalari
"""

from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class SupplierCreate(BaseModel):
    name: str = Field(..., description="Tedarikci adi")
    short_code: Optional[str] = Field(None, description="Kısa kod")
    category: Optional[str] = Field(None, description="Kategori")
    contact_name: Optional[str] = Field(None, description="Yetkili kisi")
    phone: Optional[str] = Field(None, description="Telefon")
    email: Optional[str] = Field(None, description="E-posta")
    tax_office: Optional[str] = Field(None, description="Vergi dairesi")
    tax_number: Optional[str] = Field(None, description="Vergi No / TCKN")
    address: Optional[str] = Field(None, description="Adres")
    iban: Optional[str] = Field(None, description="IBAN")
    bank_name: Optional[str] = Field(None, description="Banka adı")
    default_due_days: Optional[int] = Field(30, description="Standart vade günü")
    e_invoice_registered: bool = Field(False, description="e-Fatura mükellefiyeti")
    notes: Optional[str] = Field(None, description="Notlar")


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    short_code: Optional[str] = None
    category: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_office: Optional[str] = None
    tax_number: Optional[str] = None
    address: Optional[str] = None
    iban: Optional[str] = None
    bank_name: Optional[str] = None
    default_due_days: Optional[int] = None
    e_invoice_registered: Optional[bool] = None
    notes: Optional[str] = None


class SupplierResponse(BaseModel):
    id: str
    name: str
    short_code: Optional[str] = None
    category: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_office: Optional[str] = None
    tax_number: Optional[str] = None
    address: Optional[str] = None
    iban: Optional[str] = None
    bank_name: Optional[str] = None
    default_due_days: Optional[int] = None
    e_invoice_registered: bool = False
    balance: float = 0.0
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class SupplierTransactionCreate(BaseModel):
    type: str = Field(..., description="INVOICE, PAYMENT_CASH, PAYMENT_BANK, PAYMENT_CHECK, OPENING_BALANCE, ADJUSTMENT")
    document_no: Optional[str] = None
    description: Optional[str] = None
    amount: float = Field(..., description="Tutar")
    due_date: Optional[datetime] = None
    payment_method: Optional[str] = None


class SupplierTransactionResponse(BaseModel):
    id: str
    supplier_id: str
    type: str
    document_no: Optional[str] = None
    description: Optional[str] = None
    debit: float
    credit: float
    running_balance: float
    due_date: Optional[str] = None
    payment_method: Optional[str] = None
    transaction_date: str
    created_at: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)