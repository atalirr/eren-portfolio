"""
Personnel Services
Personel Yönetimi İş Mantığı
"""

from typing import List, Optional
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from src.features.personnel.models import Employee, EmployeeAdvance
from src.features.auth.models import User
from src.features.sales.models import SaleOrder
from src.features.transactions.models import Transaction


class PersonnelService:
    """Personnel Service - Personel Yönetimi İş Mantığı"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_all_employees(self, include_inactive: bool = False) -> List[Employee]:
        """Tüm personelleri getir"""
        query = self.db.query(Employee)
        if not include_inactive:
            query = query.filter(Employee.is_active == True)
        return query.all()
    
    def get_employee_by_id(self, employee_id: str) -> Optional[Employee]:
        """ID'ye göre personel getir"""
        return self.db.query(Employee).filter(Employee.id == employee_id).first()
    
    def get_employee_by_user_id(self, user_id: str) -> Optional[Employee]:
        """User ID'ye göre personel getir"""
        return self.db.query(Employee).filter(Employee.user_id == user_id).first()
    
    def create_employee(self, user_id: str, salary: float, bonus_rate: float, pin: Optional[str], start_date: date) -> Employee:
        """Yeni personel oluştur"""
        # User'ın var olup olmadığını kontrol et
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"Kullanıcı bulunamadı: {user_id}")
        
        # Aynı user_id'ye sahip employee var mı kontrol et
        existing = self.get_employee_by_user_id(user_id)
        if existing:
            raise ValueError(f"Bu kullanıcı için zaten bir personel kaydı var")
        
        employee = Employee(
            user_id=user_id,
            salary=salary,
            bonus_rate=bonus_rate,
            pin=pin,
            start_date=start_date,
            is_active=True
        )
        self.db.add(employee)
        self.db.commit()
        self.db.refresh(employee)
        return employee
    
    def update_employee(self, employee_id: str, salary: Optional[float] = None, bonus_rate: Optional[float] = None, 
                       pin: Optional[str] = None, is_active: Optional[bool] = None) -> Employee:
        """Personel bilgilerini güncelle"""
        employee = self.get_employee_by_id(employee_id)
        if not employee:
            raise ValueError(f"Personel bulunamadı: {employee_id}")
        
        if salary is not None:
            employee.salary = salary
        if bonus_rate is not None:
            employee.bonus_rate = bonus_rate
        if pin is not None:
            employee.pin = pin
        if is_active is not None:
            employee.is_active = is_active
        
        self.db.commit()
        self.db.refresh(employee)
        return employee
    
    def delete_employee(self, employee_id: str) -> None:
        """Personel sil (soft delete - pasife alma)"""
        employee = self.get_employee_by_id(employee_id)
        if not employee:
            raise ValueError(f"Personel bulunamadı: {employee_id}")
        
        employee.is_active = False
        self.db.commit()
    
    def add_advance(self, employee_id: str, amount: float, advance_date: date, description: Optional[str] = None) -> EmployeeAdvance:
        """Personel avans ekle"""
        employee = self.get_employee_by_id(employee_id)
        if not employee:
            raise ValueError(f"Personel bulunamadı: {employee_id}")
        
        advance = EmployeeAdvance(
            employee_id=employee_id,
            amount=amount,
            date=advance_date,
            description=description
        )
        self.db.add(advance)
        self.db.commit()
        self.db.refresh(advance)
        return advance
    
    def get_advances(self, employee_id: str) -> List[EmployeeAdvance]:
        """Personel avanslarını getir"""
        return self.db.query(EmployeeAdvance).filter(
            EmployeeAdvance.employee_id == employee_id,
            EmployeeAdvance.is_deleted == False
        ).order_by(EmployeeAdvance.date.desc()).all()
    
    def get_employee_finance(self, employee_id: str) -> dict:
        """Personel finans bilgilerini getir (maaş, prim, toplam satış, tahmini hakediş, avanslar)"""
        employee = self.get_employee_by_id(employee_id)
        if not employee:
            raise ValueError(f"Personel bulunamadı: {employee_id}")
        
        # User bilgisini al
        user = self.db.query(User).filter(User.id == employee.user_id).first()
        if not user:
            raise ValueError(f"Kullanıcı bulunamadı: {employee.user_id}")
        
        # Personelin toplam satışlarını hesapla (SaleOrder tablosundan)
        total_sales = float(self.db.query(func.coalesce(func.sum(SaleOrder.final_amount), 0.0)).filter(
            SaleOrder.user_id == user.id,
            SaleOrder.is_deleted == False
        ).scalar() or 0.0)
        
        # Tahmini hakediş = Maaş + (Toplam Satış * Prim Oranı / 100)
        estimated_earnings = employee.salary + (total_sales * employee.bonus_rate / 100)
        
        # Avansları getir ve schema formatına çevir
        advances_list = self.get_advances(employee_id)
        advances_data = [
            {
                "id": adv.id,
                "employee_id": adv.employee_id,
                "amount": adv.amount,
                "advance_date": adv.date,  # Model'deki date field'ını advance_date olarak map et
                "description": adv.description,
                "created_at": adv.created_at,
                "updated_at": adv.updated_at,
            }
            for adv in advances_list
        ]
        
        return {
            "employee_id": employee_id,
            "salary": employee.salary,
            "bonus_rate": employee.bonus_rate,
            "total_sales": round(total_sales, 2),
            "estimated_earnings": round(estimated_earnings, 2),
            "advances": advances_data
        }
    
    def get_employee_stats(self, employee_id: str) -> dict:
        """Personel istatistiklerini getir (gerçek satış verileri ile)"""
        employee = self.get_employee_by_id(employee_id)
        if not employee:
            raise ValueError(f"Personel bulunamadı: {employee_id}")
        
        user_id = employee.user_id
        
        total_sales = float(self.db.query(func.coalesce(func.sum(SaleOrder.final_amount), 0.0)).filter(
            SaleOrder.user_id == user_id,
            SaleOrder.is_deleted == False
        ).scalar() or 0.0)
        
        total_transactions = int(self.db.query(func.count(SaleOrder.id)).filter(
            SaleOrder.user_id == user_id,
            SaleOrder.is_deleted == False
        ).scalar() or 0)
        
        average_basket = round(total_sales / total_transactions, 2) if total_transactions > 0 else 0.0
        
        # Son aylardaki satış dağılımı
        monthly_query = self.db.query(
            func.strftime('%Y-%m', SaleOrder.created_at).label("month"),
            func.sum(SaleOrder.final_amount).label("revenue"),
            func.count(SaleOrder.id).label("count")
        ).filter(
            SaleOrder.user_id == user_id,
            SaleOrder.is_deleted == False
        ).group_by("month").order_by("month").limit(6).all()
        
        sales_by_month = [
            {"month": row[0], "total": round(float(row[1] or 0), 2), "count": int(row[2] or 0)}
            for row in monthly_query
        ]
        
        return {
            "employee_id": employee_id,
            "total_sales": round(total_sales, 2),
            "total_transactions": total_transactions,
            "average_basket": average_basket,
            "sales_by_month": sales_by_month
        }

