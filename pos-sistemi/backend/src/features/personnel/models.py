"""
Personnel Models
Personel Yönetimi Modelleri
"""

from sqlalchemy import Column, String, Float, Integer, Date, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship

from src.shared.models.base import BaseModel


class Employee(BaseModel):
    """
    Employee Model
    Personel Bilgileri (User modeline ek olarak maaş, prim, PIN gibi alanlar)
    """
    
    __tablename__ = "employees"
    
    # User ile ilişki (User modelindeki id'ye foreign key)
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        comment="Kullanıcı ID (FK) - User tablosuna referans"
    )
    
    # Maaş ve Prim Bilgileri
    salary = Column(
        Float,
        nullable=False,
        default=0.0,
        comment="Aylık maaş (TL)"
    )
    
    bonus_rate = Column(
        Float,
        nullable=False,
        default=0.0,
        comment="Prim oranı (%) - Satışlardan alacağı prim yüzdesi"
    )
    
    # PIN (Giriş Şifresi)
    pin = Column(
        String(10),
        nullable=True,
        comment="Giriş şifresi (PIN) - 4-10 haneli"
    )
    
    # İşe Başlama Tarihi
    start_date = Column(
        Date,
        nullable=False,
        comment="İşe başlama tarihi"
    )
    
    # Aktif / Pasif durumu
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="Aktif mi? (Silmek yerine pasife almak için kullanılır)"
    )
    
    # İlişkiler
    user = relationship("User", backref="employee")
    advances = relationship("EmployeeAdvance", back_populates="employee", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Employee(id={self.id}, user_id={self.user_id}, salary={self.salary})>"


class EmployeeAdvance(BaseModel):
    """
    Employee Advance Model
    Personel Avans Kayıtları
    """
    
    __tablename__ = "employee_advances"
    
    # Employee ile ilişki
    employee_id = Column(
        String(36),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        comment="Personel ID (FK)"
    )
    
    # Avans Bilgileri
    amount = Column(
        Float,
        nullable=False,
        comment="Avans tutarı (TL)"
    )
    
    date = Column(
        Date,
        nullable=False,
        comment="Avans tarihi"
    )
    
    description = Column(
        Text,
        nullable=True,
        comment="Avans açıklaması"
    )
    
    # İlişkiler
    employee = relationship("Employee", back_populates="advances")
    
    def __repr__(self) -> str:
        return f"<EmployeeAdvance(id={self.id}, employee_id={self.employee_id}, amount={self.amount})>"

