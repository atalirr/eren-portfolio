"""
Check / Cheque Models
Cekler Modulu - Check Model (Parasut Uyumlu)
"""

from sqlalchemy import Column, String, Float, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from src.shared.models.base import BaseModel


class CheckType(str, enum.Enum):
    """Cek tipi"""
    INCOMING = "INCOMING"  # Alinan Cek (Musteri ceki)
    OUTGOING = "OUTGOING"  # Verilen Cek (Kendi cekimiz)


class CheckStatus(str, enum.Enum):
    """Cek durumu"""
    IN_PORTFOLIO = "IN_PORTFOLIO"  # Portfoyde / Kasada
    COLLECTED = "COLLECTED"        # Tahsil Edildi
    TRANSFERRED = "TRANSFERRED"    # Ciro Edildi (Baskasina devredildi)
    BOUNCED = "BOUNCED"            # Karsiliksiz


class Check(BaseModel):
    """
    Check Model
    Musteri ve tedarikci ceklerinin takibi
    """
    
    __tablename__ = "checks"
    
    check_type = Column(SQLEnum(CheckType), nullable=False, default=CheckType.INCOMING, comment="Cek tipi")
    check_number = Column(String(50), nullable=False, comment="Cek Seri No")
    bank_name = Column(String(100), nullable=False, comment="Banka Adi")
    branch_name = Column(String(100), nullable=True, comment="Sube Adi")
    account_number = Column(String(50), nullable=True, comment="Hesap No")
    issuer = Column(String(200), nullable=False, comment="Kesideci (Borclu Sahis/Firma)")
    
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=True, comment="Musteri ID (Alinan cek icin)")
    supplier_id = Column(String(36), ForeignKey("suppliers.id"), nullable=True, comment="Tedarikci ID (Verilen cek icin)")
    
    issue_date = Column(String(20), nullable=False, comment="Duzenleme Tarihi (YYYY-MM-DD)")
    due_date = Column(String(20), nullable=False, comment="Vade Tarihi (YYYY-MM-DD)")
    amount = Column(Float, nullable=False, default=0.0, comment="Cek Tutari")
    
    status = Column(SQLEnum(CheckStatus), nullable=False, default=CheckStatus.IN_PORTFOLIO, comment="Cek Durumu")
    notes = Column(Text, nullable=True, comment="Aciklama / Notlar")
    
    # Relationships
    customer = relationship("Customer", lazy="joined")
    supplier = relationship("Supplier", lazy="joined")