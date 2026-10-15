"""
Personnel Routers
FastAPI Routes - Personel Yönetimi
"""

from typing import List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from src.shared.database.session import get_db
from src.features.personnel import schemas
from src.features.personnel.services import PersonnelService
from src.features.personnel.models import Employee

router = APIRouter(prefix="/personnel", tags=["Personnel"])


@router.get("/employees", response_model=List[schemas.EmployeeResponse])
async def get_all_employees(
    include_inactive: bool = Query(False, description="Pasif personelleri de dahil et"),
    db: Session = Depends(get_db)
):
    """Tüm personelleri getir"""
    service = PersonnelService(db)
    employees = service.get_all_employees(include_inactive=include_inactive)
    
    # User bilgilerini join ile getir
    result = []
    for emp in employees:
        from src.features.auth.models import User
        user = db.query(User).filter(User.id == emp.user_id).first()
        emp_dict = {
            "id": emp.id,
            "user_id": emp.user_id,
            "salary": emp.salary,
            "bonus_rate": emp.bonus_rate,
            "pin": emp.pin,
            "start_date": emp.start_date,
            "is_active": emp.is_active,
            "created_at": emp.created_at,
            "updated_at": emp.updated_at,
            "username": user.username if user else None,
            "full_name": user.full_name if user else None,
            "role": user.role if user else None,
        }
        result.append(emp_dict)
    
    return result


@router.get("/employees/{employee_id}", response_model=schemas.EmployeeResponse)
async def get_employee(
    employee_id: str,
    db: Session = Depends(get_db)
):
    """ID'ye göre personel getir"""
    service = PersonnelService(db)
    employee = service.get_employee_by_id(employee_id)
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Personel bulunamadı: {employee_id}"
        )
    
    # User bilgilerini join ile getir
    from src.features.auth.models import User
    user = db.query(User).filter(User.id == employee.user_id).first()
    
    return {
        "id": employee.id,
        "user_id": employee.user_id,
        "salary": employee.salary,
        "bonus_rate": employee.bonus_rate,
        "pin": employee.pin,
        "start_date": employee.start_date,
        "is_active": employee.is_active,
        "created_at": employee.created_at,
        "updated_at": employee.updated_at,
        "username": user.username if user else None,
        "full_name": user.full_name if user else None,
        "role": user.role if user else None,
    }


@router.post("/employees", response_model=schemas.EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    data: schemas.EmployeeCreate,
    db: Session = Depends(get_db)
):
    """Yeni personel oluştur"""
    service = PersonnelService(db)
    try:
        employee = service.create_employee(
            user_id=data.user_id,
            salary=data.salary,
            bonus_rate=data.bonus_rate,
            pin=data.pin,
            start_date=data.start_date
        )
        
        # User bilgilerini join ile getir
        from src.features.auth.models import User
        user = db.query(User).filter(User.id == employee.user_id).first()
        
        return {
            "id": employee.id,
            "user_id": employee.user_id,
            "salary": employee.salary,
            "bonus_rate": employee.bonus_rate,
            "pin": employee.pin,
            "start_date": employee.start_date,
            "is_active": employee.is_active,
            "created_at": employee.created_at,
            "updated_at": employee.updated_at,
            "username": user.username if user else None,
            "full_name": user.full_name if user else None,
            "role": user.role if user else None,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/employees/{employee_id}", response_model=schemas.EmployeeResponse)
async def update_employee(
    employee_id: str,
    data: schemas.EmployeeUpdate,
    db: Session = Depends(get_db)
):
    """Personel bilgilerini güncelle"""
    service = PersonnelService(db)
    try:
        employee = service.update_employee(
            employee_id=employee_id,
            salary=data.salary,
            bonus_rate=data.bonus_rate,
            pin=data.pin,
            is_active=data.is_active
        )
        
        # User bilgilerini join ile getir
        from src.features.auth.models import User
        user = db.query(User).filter(User.id == employee.user_id).first()
        
        return {
            "id": employee.id,
            "user_id": employee.user_id,
            "salary": employee.salary,
            "bonus_rate": employee.bonus_rate,
            "pin": employee.pin,
            "start_date": employee.start_date,
            "is_active": employee.is_active,
            "created_at": employee.created_at,
            "updated_at": employee.updated_at,
            "username": user.username if user else None,
            "full_name": user.full_name if user else None,
            "role": user.role if user else None,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/employees/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: str,
    db: Session = Depends(get_db)
):
    """Personel sil (soft delete - pasife alma)"""
    service = PersonnelService(db)
    try:
        service.delete_employee(employee_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/employees/{employee_id}/advances", response_model=schemas.EmployeeAdvanceResponse, status_code=status.HTTP_201_CREATED)
async def add_advance(
    employee_id: str,
    amount: float = Query(..., gt=0, description="Avans tutarı (TL)"),
    advance_date: date = Query(..., description="Avans tarihi"),
    description: str = Query(None, description="Avans açıklaması"),
    db: Session = Depends(get_db)
):
    """Personel avans ekle"""
    service = PersonnelService(db)
    try:
        advance = service.add_advance(
            employee_id=employee_id,
            amount=amount,
            advance_date=advance_date,
            description=description
        )
        # Model'den schema'ya mapping (date -> advance_date)
        return {
            "id": advance.id,
            "employee_id": advance.employee_id,
            "amount": advance.amount,
            "advance_date": advance.date,  # Model'deki date field'ını advance_date olarak map et
            "description": advance.description,
            "created_at": advance.created_at,
            "updated_at": advance.updated_at,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/employees/{employee_id}/advances", response_model=List[schemas.EmployeeAdvanceResponse])
async def get_advances(
    employee_id: str,
    db: Session = Depends(get_db)
):
    """Personel avanslarını getir"""
    service = PersonnelService(db)
    advances = service.get_advances(employee_id)
    # Model'den schema'ya mapping (date -> advance_date)
    return [
        {
            "id": adv.id,
            "employee_id": adv.employee_id,
            "amount": adv.amount,
            "advance_date": adv.date,  # Model'deki date field'ını advance_date olarak map et
            "description": adv.description,
            "created_at": adv.created_at,
            "updated_at": adv.updated_at,
        }
        for adv in advances
    ]


@router.get("/employees/{employee_id}/finance", response_model=schemas.EmployeeFinanceResponse)
async def get_employee_finance(
    employee_id: str,
    db: Session = Depends(get_db)
):
    """Personel finans bilgilerini getir"""
    service = PersonnelService(db)
    try:
        finance_data = service.get_employee_finance(employee_id)
        return finance_data
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/employees/{employee_id}/stats", response_model=schemas.EmployeeStatsResponse)
async def get_employee_stats(
    employee_id: str,
    db: Session = Depends(get_db)
):
    """Personel istatistiklerini getir"""
    service = PersonnelService(db)
    try:
        stats = service.get_employee_stats(employee_id)
        return stats
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

