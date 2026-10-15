"""
Invoice Router
Fatura API Endpointleri
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date
import uuid

from src.shared.database.session import get_db
from src.features.invoices.models import Invoice, InvoiceItem, InvoiceType, InvoiceStatus
from src.features.inventory.models import Product
from src.features.inventory.stock_movement import StockMovement, StockMovementReason
from src.features.suppliers.models import Supplier


router = APIRouter(prefix="/api/invoices", tags=["invoices"])


def _generate_invoice_number(db: Session) -> str:
    """Otomatik fatura numarasi uret: FTR-YYYYMMDD-XXX"""
    today = date.today().strftime("%Y%m%d")
    prefix = f"FTR-{today}-"
    last = db.query(Invoice).filter(
        Invoice.invoice_number.like(f"{prefix}%")
    ).order_by(Invoice.invoice_number.desc()).first()
    
    if last:
        try:
            last_num = int(last.invoice_number.split("-")[-1])
            return f"{prefix}{str(last_num + 1).zfill(3)}"
        except ValueError:
            pass
    return f"{prefix}001"


def _calculate_item(item_data: dict) -> dict:
    """Fatura kalemi hesapla"""
    qty = float(item_data.get("quantity", 1))
    unit_price = float(item_data.get("unit_price", 0))
    vat_rate = float(item_data.get("vat_rate", 20))
    discount_rate = float(item_data.get("discount_rate", 0))
    
    subtotal = qty * unit_price
    discount_amount = subtotal * (discount_rate / 100)
    taxable = subtotal - discount_amount
    vat_amount = taxable * (vat_rate / 100)
    line_total = taxable + vat_amount
    
    return {
        "vat_amount": round(vat_amount, 2),
        "discount_amount": round(discount_amount, 2),
        "line_total": round(line_total, 2),
    }


def _invoice_to_dict(inv: Invoice) -> dict:
    """Invoice nesnesini dict'e cevir"""
    customer_name = None
    supplier_name = None
    
    if inv.customer:
        customer_name = f"{inv.customer.name} {inv.customer.last_name or ''}".strip()
    if inv.supplier:
        supplier_name = inv.supplier.name
    
    items = []
    for item in (inv.items or []):
        items.append({
            "id": item.id,
            "invoice_id": item.invoice_id,
            "product_id": item.product_id,
            "description": item.description,
            "quantity": item.quantity,
            "unit": item.unit,
            "unit_price": item.unit_price,
            "vat_rate": item.vat_rate,
            "vat_amount": item.vat_amount,
            "discount_rate": item.discount_rate,
            "discount_amount": item.discount_amount,
            "line_total": item.line_total,
        })
    
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "invoice_type": inv.invoice_type.value if inv.invoice_type else "SALES",
        "customer_id": inv.customer_id,
        "supplier_id": inv.supplier_id,
        "invoice_date": inv.invoice_date,
        "due_date": inv.due_date,
        "subtotal": inv.subtotal,
        "total_vat": inv.total_vat,
        "total_discount": inv.total_discount,
        "total_amount": inv.total_amount,
        "status": inv.status.value if inv.status else "DRAFT",
        "notes": inv.notes,
        "payment_method": inv.payment_method,
        "created_at": str(inv.created_at) if inv.created_at else None,
        "customer_name": customer_name,
        "supplier_name": supplier_name,
        "items": items,
    }


@router.get("")
@router.get("/")
def get_invoices(
    invoice_type: str = None,
    status: str = None,
    search: str = None,
    db: Session = Depends(get_db)
):
    """Faturalari listele"""
    query = db.query(Invoice).filter(Invoice.is_deleted == False)
    
    if invoice_type:
        query = query.filter(Invoice.invoice_type == invoice_type)
    if status:
        query = query.filter(Invoice.status == status)
    
    invoices = query.order_by(Invoice.created_at.desc()).all()
    results = [_invoice_to_dict(inv) for inv in invoices]
    
    if search:
        search_lower = search.lower()
        results = [r for r in results if (
            search_lower in r["invoice_number"].lower() or
            (r.get("customer_name") and search_lower in r["customer_name"].lower()) or
            (r.get("supplier_name") and search_lower in r["supplier_name"].lower())
        )]
    
    return {"invoices": results}


@router.get("/stats")
def get_invoice_stats(db: Session = Depends(get_db)):
    """Fatura istatistikleri"""
    all_invoices = db.query(Invoice).filter(Invoice.is_deleted == False).all()
    
    sales = [i for i in all_invoices if i.invoice_type == InvoiceType.SALES]
    purchases = [i for i in all_invoices if i.invoice_type == InvoiceType.PURCHASE]
    
    total_sales_amount = sum(i.total_amount for i in sales)
    total_purchase_amount = sum(i.total_amount for i in purchases)
    total_vat = sum(i.total_vat for i in all_invoices)
    
    paid_count = len([i for i in all_invoices if i.status == InvoiceStatus.PAID])
    draft_count = len([i for i in all_invoices if i.status == InvoiceStatus.DRAFT])
    sent_count = len([i for i in all_invoices if i.status == InvoiceStatus.SENT])
    
    return {
        "total_count": len(all_invoices),
        "sales_count": len(sales),
        "purchase_count": len(purchases),
        "total_sales_amount": round(total_sales_amount, 2),
        "total_purchase_amount": round(total_purchase_amount, 2),
        "total_vat": round(total_vat, 2),
        "paid_count": paid_count,
        "draft_count": draft_count,
        "sent_count": sent_count,
    }


@router.get("/{invoice_id}")
def get_invoice(invoice_id: str, db: Session = Depends(get_db)):
    """Tekil fatura detayi"""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.is_deleted == False).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Fatura bulunamadi")
    return _invoice_to_dict(invoice)


@router.post("")
@router.post("/")
def create_invoice(data: dict, db: Session = Depends(get_db)):
    """Yeni fatura olustur"""
    try:
        invoice_type = data.get("invoice_type", "SALES")
        items_data = data.get("items", [])
        
        if not items_data:
            raise HTTPException(status_code=400, detail="En az bir fatura kalemi gereklidir")
        
        invoice_id = str(uuid.uuid4())
        invoice_number = _generate_invoice_number(db)
        
        # Kalemleri hesapla
        subtotal = 0.0
        total_vat = 0.0
        total_discount = 0.0
        total_amount = 0.0
        invoice_items = []
        
        for item_data in items_data:
            calc = _calculate_item(item_data)
            qty = float(item_data.get("quantity", 1))
            unit_price = float(item_data.get("unit_price", 0))
            
            item_subtotal = qty * unit_price
            subtotal += item_subtotal
            total_vat += calc["vat_amount"]
            total_discount += calc["discount_amount"]
            total_amount += calc["line_total"]
            
            item = InvoiceItem(
                id=str(uuid.uuid4()),
                invoice_id=invoice_id,
                product_id=item_data.get("product_id"),
                description=item_data.get("description", ""),
                quantity=qty,
                unit=item_data.get("unit", "adet"),
                unit_price=unit_price,
                vat_rate=float(item_data.get("vat_rate", 20)),
                vat_amount=calc["vat_amount"],
                discount_rate=float(item_data.get("discount_rate", 0)),
                discount_amount=calc["discount_amount"],
                line_total=calc["line_total"],
            )
            invoice_items.append(item)
        
        invoice = Invoice(
            id=invoice_id,
            invoice_number=invoice_number,
            invoice_type=InvoiceType(invoice_type),
            customer_id=data.get("customer_id"),
            supplier_id=data.get("supplier_id"),
            invoice_date=data.get("invoice_date", date.today().isoformat()),
            due_date=data.get("due_date"),
            subtotal=round(subtotal, 2),
            total_vat=round(total_vat, 2),
            total_discount=round(total_discount, 2),
            total_amount=round(total_amount, 2),
            status=InvoiceStatus.DRAFT,
            notes=data.get("notes"),
            payment_method=data.get("payment_method"),
            items=invoice_items,
        )
        
        db.add(invoice)
        
        # Alis faturasi ise stok artir ve tedarikci bakiyesini guncelle
        if invoice_type == "PURCHASE":
            for item_data in items_data:
                product_id = item_data.get("product_id")
                if product_id:
                    product = db.query(Product).filter(Product.id == product_id).first()
                    if product:
                        qty = int(item_data.get("quantity", 1))
                        product.stock_quantity += qty
                        product.is_synced = False
                        
                        # Stok hareketi kaydet
                        movement = StockMovement(
                            id=str(uuid.uuid4()),
                            product_id=product_id,
                            quantity_change=qty,
                            reason=StockMovementReason.RESTOCK,
                            notes=f"Alis Faturasi: {invoice_number}",
                        )
                        db.add(movement)
                        
                        # Alis fiyatini guncelle
                        new_buy_price = float(item_data.get("unit_price", 0))
                        if new_buy_price > 0:
                            product.buy_price = new_buy_price
            
            # Tedarikci bakiyesini artir
            supplier_id = data.get("supplier_id")
            if supplier_id:
                supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
                if supplier:
                    supplier.balance += round(total_amount, 2)
        
        db.commit()
        db.refresh(invoice)
        return _invoice_to_dict(invoice)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{invoice_id}/status")
def update_invoice_status(invoice_id: str, data: dict, db: Session = Depends(get_db)):
    """Fatura durumunu guncelle"""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.is_deleted == False).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Fatura bulunamadi")
    
    new_status = data.get("status", "DRAFT")
    try:
        invoice.status = InvoiceStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Gecersiz durum: {new_status}")
    
    db.commit()
    db.refresh(invoice)
    return _invoice_to_dict(invoice)


@router.delete("/{invoice_id}")
def delete_invoice(invoice_id: str, db: Session = Depends(get_db)):
    """Fatura sil (soft delete) ve stok / cari bakiye etkilerini geri al (H1 Fix)"""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Fatura bulunamadi")
    
    if invoice.is_deleted:
        return {"message": "Fatura zaten silinmis"}

    try:
        # Alış faturası ise stokları geri düş ve tedarikçi bakiyesini azalt
        if invoice.invoice_type == InvoiceType.PURCHASE:
            for item in invoice.items:
                if item.product_id:
                    product = db.query(Product).filter(Product.id == item.product_id).first()
                    if product:
                        qty = int(item.quantity)
                        product.stock_quantity -= qty
                        product.is_synced = False
                        
                        # Stok çıkış hareketi kaydet (iade/iptal)
                        movement = StockMovement(
                            id=str(uuid.uuid4()),
                            product_id=product.id,
                            quantity_change=-qty,
                            reason=StockMovementReason.ADJUSTMENT,
                            notes=f"Alış Faturası Silindi: {invoice.invoice_number}",
                        )
                        db.add(movement)
            
            # Tedarikçi borcunu geri al
            if invoice.supplier_id:
                supplier = db.query(Supplier).filter(Supplier.id == invoice.supplier_id).first()
                if supplier:
                    supplier.balance -= round(float(invoice.total_amount or 0.0), 2)

        invoice.is_deleted = True
        db.commit()
        return {"message": "Fatura ve ilgili stok/bakiye etkileri başarıyla silindi"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Fatura silinirken hata oluştu: {str(e)}")