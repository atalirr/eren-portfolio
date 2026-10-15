"""
Finance Schemas
Finansal Veri Analitiği Pydantic Schemas
"""

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class RevenueSource(BaseModel):
    """Gelir Kaynağı"""
    name: str = Field(..., description="Kategori adı")
    value: float = Field(..., ge=0, description="Tutar")
    color: str = Field(..., description="Renk kodu (hex)")


class ProfitTrendItem(BaseModel):
    """Kâr Trend Verisi (Günlük)"""
    date: str = Field(..., description="Tarih (DD.MM formatında)")
    ciro: float = Field(..., ge=0, description="Ciro")
    maliyet: float = Field(..., ge=0, description="Maliyet (COGS)")
    giderler: float = Field(..., ge=0, description="Giderler (OpEx)")
    kar: float = Field(..., description="Net Kâr (Ciro - Maliyet - Giderler)")


class ExpenseAnalysisItem(BaseModel):
    """Gider Analizi Öğesi"""
    category: str = Field(..., description="Gider kategorisi")
    amount: float = Field(..., ge=0, description="Toplam tutar")


class FinanceDashboardResponse(BaseModel):
    """Dashboard Veri Yanıtı"""
    revenue_sources: List[RevenueSource] = Field(..., description="Gelir Kaynakları (Donut Chart)")
    profit_trend: List[ProfitTrendItem] = Field(..., description="Kâr ve Ciro Makası (Area Chart)")
    expense_analysis: List[ExpenseAnalysisItem] = Field(..., description="Gider Analizi (Top 5 Liste)")


class FinancialBalanceDetails(BaseModel):
    """Varlık/Borç Detayları"""
    cash_balance: float
    bank_balance: float
    receivables: float
    marketplace_balance: float
    customer_debts: float
    planned_expenses: float


class FinancialBalance(BaseModel):
    """Finansal Terazi"""
    assets: float = Field(..., description="Toplam Varlıklar")
    liabilities: float = Field(..., description="Toplam Yükümlülükler")
    ratio: float = Field(..., description="Oran (Varlık/Borç * 100)")
    status: str = Field(..., description="Durum: Güvenli, Riskli, Kritik")
    details: FinancialBalanceDetails


class CashRunway(BaseModel):
    """Nakit Ömrü"""
    monthly_fixed_expenses: float = Field(..., description="Aylık Sabit Giderler")
    daily_burn_rate: float = Field(..., description="Günlük Yakma Hızı")
    current_cash: float = Field(..., description="Mevcut Nakit (Kasa + Banka)")
    runway_days: float = Field(..., description="Nakit Ömrü (Gün)")
    status: str = Field(..., description="Durum: Güvenli, Dikkat, Kritik")


class FinancialHealthMetricsResponse(BaseModel):
    """Finansal Sağlık Göstergeleri"""
    financial_balance: FinancialBalance
    cash_runway: CashRunway


# ============================================
# MODÜL 1: GERÇEK KARLILIK (NET PROFITABILITY)
# ============================================

class PeriodInfo(BaseModel):
    """Dönem Bilgisi"""
    start: str = Field(..., description="Başlangıç tarihi (ISO format)")
    end: str = Field(..., description="Bitiş tarihi (ISO format)")


class NetProfitabilityResponse(BaseModel):
    """Gerçek Karlılık Analizi"""
    period: PeriodInfo
    revenue: float = Field(..., description="Toplam Ciro")
    cost_of_goods_sold: float = Field(..., description="Satılan Malın Maliyeti (COGS)")
    gross_profit: float = Field(..., description="Brüt Kar")
    gross_margin_percent: float = Field(..., description="Brüt Kar Marjı %")
    operational_expenses: float = Field(..., description="Operasyonel Giderler")
    net_profit: float = Field(..., description="Net Kar")
    net_margin_percent: float = Field(..., description="Net Kar Marjı %")
    warning: Optional[str] = Field(None, description="Uyarı mesajı (eğer marj düşükse)")
    pos_profit: Optional[float] = Field(0.0, description="Sadece POS Satışlarından Gelen Kar")


# ============================================
# MODÜL 2: AKILLI GİDER ANALİZİ (EXPENSE BREAKDOWN)
# ============================================

class ExpenseCategoryItem(BaseModel):
    """Gider Kategorisi Öğesi"""
    category: str = Field(..., description="Gider kategorisi")
    amount: float = Field(..., ge=0, description="Toplam tutar")
    percentage_of_revenue: float = Field(..., description="Ciroya oranı %")
    percentage_of_total_expenses: float = Field(..., description="Toplam giderlere oranı %")
    is_anomaly: bool = Field(..., description="Anomali var mı?")
    anomaly_reason: Optional[str] = Field(None, description="Anomali nedeni")


class ExpenseBreakdownResponse(BaseModel):
    """Akıllı Gider Analizi"""
    period: PeriodInfo
    total_revenue: float = Field(..., description="Toplam Ciro")
    total_expenses: float = Field(..., description="Toplam Giderler")
    expense_to_revenue_ratio: float = Field(..., description="Gider/Ciro Oranı %")
    categories: List[ExpenseCategoryItem] = Field(..., description="Gider kategorileri")


# ============================================
# MODÜL 3: GELİŞMİŞ TREND VE PROJEKSİYON
# ============================================

class TargetPeriod(BaseModel):
    """Hedef Dönem"""
    month: int = Field(..., ge=1, le=12, description="Ay (1-12)")
    year: int = Field(..., description="Yıl")


class PaceAnalysis(BaseModel):
    """Pace (Hız) Analizi"""
    current_time: str = Field(..., description="Şu anki saat (HH:MM)")
    current_cumulative_revenue: float = Field(..., description="Bugünün şu anki kümülatif cirosu")
    last_month_same_day_cumulative: float = Field(..., description="Geçen ayın aynı günlerinin kümülatif cirosu")
    last_week_same_day_cumulative: float = Field(..., description="Geçen haftanın aynı gününün kümülatif cirosu")
    pace_vs_last_month_percent: float = Field(..., description="Geçen aya göre pace %")
    pace_vs_last_week_percent: float = Field(..., description="Geçen haftaya göre pace %")
    status: str = Field(..., description="Durum: ahead, behind, on_track")


class MonthEndProjection(BaseModel):
    """Ay Sonu Tahmini"""
    current_revenue: float = Field(..., description="Mevcut ciro")
    days_completed: int = Field(..., ge=0, description="Tamamlanan gün sayısı")
    days_remaining: int = Field(..., ge=0, description="Kalan gün sayısı")
    last_7_days_avg: float = Field(..., description="Son 7 günlük ağırlıklı ortalama")
    weighted_avg: float = Field(..., description="Ağırlıklı ortalama (son günler daha önemli)")
    projected_revenue: float = Field(..., description="Tahmini toplam ciro")
    confidence: str = Field(..., description="Güven seviyesi: high, medium, low")


class Seasonality(BaseModel):
    """Mevsimsellik Analizi"""
    weekend_multiplier: float = Field(..., description="Hafta sonu çarpanı (hafta sonu / hafta içi)")
    weekday_avg: float = Field(..., description="Hafta içi günlük ortalama ciro")
    weekend_avg: float = Field(..., description="Hafta sonu günlük ortalama ciro")


class AdvancedProjectionResponse(BaseModel):
    """Gelişmiş Trend ve Projeksiyon"""
    target_period: TargetPeriod
    pace_analysis: PaceAnalysis
    month_end_projection: MonthEndProjection
    seasonality: Seasonality


# ============================================
# MODÜL 4: SATIŞ ISI HARİTASI (WEEKLY HEATMAP)
# ============================================

class WeeklySalesHeatmapResponse(BaseModel):
    """Haftalık Satış Isı Haritası (09:00–18:00)"""
    start: str = Field(..., description="Başlangıç (ISO)")
    end: str = Field(..., description="Bitiş (ISO)")
    hour_labels: List[str] = Field(..., description="Saat etiketleri (örn: 09:00)")
    days: List[str] = Field(..., description="Gün etiketleri (Pzt..Paz)")
    values: List[List[float]] = Field(..., description="values[hour_idx][day_idx] satış toplamı")


# ============================================
# MODÜL 5: CİRO & KÂR TRENDİ (CASHFLOW/PROFIT TREND)
# ============================================

class CashflowTrendPoint(BaseModel):
    """Trend noktası (gün/hafta/ay)"""
    key: str = Field(..., description="Dönem anahtarı (daily: YYYY-MM-DD, weekly: YYYY-Www, monthly: YYYY-MM)")
    revenue: float = Field(..., ge=0, description="Ciro (satış toplamı)")
    cogs: float = Field(..., ge=0, description="COGS (satılan mal maliyeti)")
    expenses: float = Field(..., ge=0, description="Operasyonel giderler")
    profit: float = Field(..., description="Net kâr (revenue - cogs - expenses)")


class CashflowTrendResponse(BaseModel):
    """Ciro & Kâr Trendi"""
    period: str = Field(..., description="daily | weekly | monthly")
    start: str = Field(..., description="Başlangıç (ISO)")
    end: str = Field(..., description="Bitiş (ISO)")
    points: List[CashflowTrendPoint] = Field(..., description="Trend verisi")


# ============================================
# SYSTEM: FINANCE DATA RESET
# ============================================

class ResetFinanceResponse(BaseModel):
    """Finance sayfasını besleyen verileri sıfırlama sonucu"""
    deleted: dict = Field(..., description="Silinen kayıt sayıları (tablo bazında)")
    customers_zeroed: int = Field(..., ge=0, description="Bakiyesi 0'a çekilen müşteri sayısı")
