"""
FastAPI App Factory
"""

from fastapi import FastAPI, Request, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, ResponseValidationError
import os
import traceback

from src.shared.database.session import init_db
from src.shared.config.settings import get_settings

# SQLAlchemy Mapper'ların doğru yüklenmesini garanti etmek için tüm modelleri en üst seviyede import et
# Bu sayede dairesel import çakışması olmadan OrderItem, Product vb. ilişkileri çözülür.
from src.features.auth.models import User  # noqa
from src.features.settings.models import Setting  # noqa
from src.features.inventory.models import Product, Category  # noqa
from src.features.inventory.stock_movement import StockMovement  # noqa
from src.features.orders.models import Order, OrderItem  # noqa
from src.features.sales.models import SaleOrder, SaleOrderItem  # noqa
from src.features.transactions.models import Transaction, TransactionSource, TransactionType, PaymentMethod  # noqa
from src.features.system.models import SystemLog  # noqa
from src.features.customers.models import Customer  # noqa
from src.features.personnel.models import Employee, EmployeeAdvance  # noqa
from src.features.ecommerce.models import MarketplaceConfig, ProductMapping  # noqa
from src.features.invoices.models import Invoice, InvoiceItem  # noqa
from src.features.suppliers.models import Supplier, SupplierTransaction  # noqa
from src.features.checks.models import Check  # noqa

settings = get_settings()



def create_app() -> FastAPI:
    """
    FastAPI uygulaması oluşturur
    @returns: FastAPI app instance
    """
    app = FastAPI(
        title="POS 6 API",
        description="Offline-First Desktop POS System Backend",
        version="1.0.0",
        redirect_slashes=False,  # Redirect yerine doğrudan 404/yanıt ver — CORS header kaybolmasın
    )
    
    # ── CORS Middleware ──────────────────────────────────────────────────────
    # Starlette'te add_middleware LIFO sırasıyla uygulanır: en son eklenen
    # en dışta (request'i ilk işleyen) olur. CORSMiddleware en dışta olması
    # gerekir ki HER yanıta (500 dahil) Access-Control-Allow-Origin header'ı eklensin.
    # Bu yüzden CORSMiddleware'i en SON add_middleware ile ekliyoruz.

    # ── Fail-safe inner middleware ────────────────────────────────────────────
    # Bu middleware FastAPI exception handler'larından kaçan sürpriz hataları yakalar.
    # CORS middleware'inden IÇERIDE olduğu için yanıtı CORSMiddleware sarar.
    from starlette.middleware.base import BaseHTTPMiddleware

    class CatchAllMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            try:
                response = await call_next(request)
                return response
            except Exception as exc:
                error_trace = traceback.format_exc()
                print(f"\n{'!'*60}")
                print(f"[FATAL MIDDLEWARE ERROR] {str(exc)}")
                print(error_trace)
                print(f"{'!'*60}\n")
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "detail": f"Internal server error: {str(exc)}",
                        "type": type(exc).__name__,
                    },
                )

    app.add_middleware(CatchAllMiddleware)

    # CORS en dışta — tüm yanıtlara (hata dahil) header ekler
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
    
    # Global Exception Handler - Tüm hataları yakala ve CORS header'ları ile döndür
    @app.exception_handler(RequestValidationError)
    async def request_validation_exception_handler(request: Request, exc: RequestValidationError):
        """Request validation errors - always include CORS headers."""
        print(f"[ERROR] RequestValidationError: {exc.errors()}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": exc.errors()},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            },
        )

    @app.exception_handler(ResponseValidationError)
    async def response_validation_exception_handler(request: Request, exc: ResponseValidationError):
        """Response model validation errors (often show up as 500) - include CORS + debug."""
        print(f"[ERROR] ResponseValidationError: {exc.errors()}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Response validation error", "errors": exc.errors()},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """HTTPException handler - CORS header'larını her zaman gönder"""
        print(f"[ERROR] HTTPException: {exc.status_code} - {exc.detail}")
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )
    
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Global exception handler - CORS header'larını her zaman gönder"""
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ERROR] Global exception handler: {str(exc)}")
        print(f"[ERROR] Traceback: {error_trace}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": f"Internal server error: {str(exc)}",
                "type": type(exc).__name__
            },
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )
    
    # Startup event: Database'i başlat
    @app.on_event("startup")
    async def startup_event():
        init_db()
    
    # Shutdown event
    @app.on_event("shutdown")
    async def shutdown_event():
        pass
    
    # ============================================================================
    # STATIC FILES SERVING - Route'lardan ÖNCE mount edilmeli
    # ============================================================================
    # Static files serving (uploads klasörü için)
    # backend/src/core/app.py -> backend/ -> backend/uploads
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    uploads_dir = os.path.join(base_dir, "uploads")
    uploads_dir = os.path.abspath(uploads_dir)
    
    if os.path.exists(uploads_dir):
        app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
        print(f"[INFO] [OK] Static files serving aktif: {uploads_dir}")
    else:
        os.makedirs(uploads_dir, exist_ok=True)
        app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
        print(f"[INFO] [OK] Uploads klasörü oluşturuldu ve static files serving aktif: {uploads_dir}")
    
    # ============================================================================
    # API ROUTES - ÖNEMLİ: Sabit path'li route'lar dinamik path'lerden ÖNCE eklenmeli
    # ============================================================================
    
    # TÜM ROUTER'LARI İMPORT ET (Dashboard EN ÜSTTE olmalı - sabit path'ler için)
    from src.features.dashboard import routers as dashboard_router
    from src.features.inventory import routers as inventory_router
    from src.features.inventory import statistics_routers as inventory_statistics_router
    from src.features.orders import routers as orders_router
    from src.features.transactions import routers as transactions_router
    from src.features.system import routers as system_router
    from src.features.analytics import routers as analytics_router
    from src.features.customers import routers as customers_router
    from src.features.sales import routers as sales_router
    from src.features.ecommerce import routers as ecommerce_router
    from src.features.finance import routers as finance_router
    from src.features.personnel import routers as personnel_router
    from src.features.settings import routers as settings_router
    
    # Dashboard router'ı EN ÜSTE EKLE (sabit path'ler dinamik path'lerden önce)
    # Router'da route: "/stats", prefix: "/api/dashboard" -> Sonuç: "/api/dashboard/stats"
    app.include_router(dashboard_router.router, prefix="/api/dashboard", tags=["dashboard"])
    print("[INFO] [OK] Dashboard router başarıyla yüklendi: /api/dashboard/stats")
    
    app.include_router(inventory_router.router, prefix="/api/inventory", tags=["inventory"])
    app.include_router(inventory_statistics_router.router, prefix="/api/inventory", tags=["inventory_stats"])
    # Debug: invoice parse endpoint yüklendi mi?
    try:
        has_invoice_parse = any(
            getattr(r, "path", "") == "/api/inventory/invoice/parse" and "POST" in getattr(r, "methods", set())
            for r in app.routes
        )
        print(f"[INFO] Inventory invoice parse route: {'OK' if has_invoice_parse else 'MISSING'} (/api/inventory/invoice/parse)")
    except Exception:
        pass
    app.include_router(orders_router.router, prefix="/api/orders", tags=["orders"])
    app.include_router(transactions_router.router, prefix="/api/transactions", tags=["transactions"])
    app.include_router(system_router.router, prefix="/api/system", tags=["system"])
    app.include_router(analytics_router.router, prefix="/api", tags=["analytics"])
    app.include_router(customers_router.router, prefix="/api", tags=["customers"])
    app.include_router(sales_router.router, prefix="/api", tags=["sales"])
    app.include_router(ecommerce_router.router, prefix="/api/ecommerce", tags=["ecommerce"])
    app.include_router(finance_router.router, prefix="/api/finance", tags=["finance"])
    # Debug: Finance weekly heatmap route yüklendi mi?
    try:
        has_finance_heatmap = any(
            getattr(r, "path", "") == "/api/finance/sales-heatmap/weekly" and "GET" in getattr(r, "methods", set())
            for r in app.routes
        )
        print(
            f"[INFO] Finance weekly heatmap route: {'OK' if has_finance_heatmap else 'MISSING'} "
            f"(/api/finance/sales-heatmap/weekly)"
        )
    except Exception:
        pass
    # Debug: Finance cashflow trend route yüklendi mi?
    try:
        has_finance_cashflow_trend = any(
            getattr(r, "path", "") == "/api/finance/cashflow-trend" and "GET" in getattr(r, "methods", set())
            for r in app.routes
        )
        print(
            f"[INFO] Finance cashflow trend route: {'OK' if has_finance_cashflow_trend else 'MISSING'} "
            f"(/api/finance/cashflow-trend)"
        )
    except Exception:
        pass
    app.include_router(personnel_router.router, prefix="/api", tags=["personnel"])
    app.include_router(settings_router.router, prefix="/api/settings", tags=["settings"])
    
    # Fatura, Tedarikci ve Cek router'lari (Parasut entegrasyonu)
    from src.features.invoices.router import router as invoices_router
    from src.features.suppliers.router import router as suppliers_router
    from src.features.checks.router import router as checks_router
    app.include_router(invoices_router, tags=["invoices"])
    app.include_router(suppliers_router, tags=["suppliers"])
    app.include_router(checks_router, tags=["checks"])
    print("[INFO] [OK] Invoice, Supplier & Check routers yuklendi: /api/invoices, /api/suppliers, /api/checks")
    
    return app
