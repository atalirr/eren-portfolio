"""
ANTIGRAVITY AI — Katman 5: Dinamik Risk Motoru
================================================
Pozisyon başına ve portföy genelinde risk yönetimini üstlenir.

ÖZELLİKLER:
  1. ATR-Adaptif Trailing Stop
     — Sabit %2.5 yerine mevcut volatiliteye göre trailing width belirler
     — Düşük vol  -> sıkı trailing (kârı koru)
     — Yüksek vol -> geniş trailing (erken tetiklenmeyi önle)

  2. Kısmi Kar Alma (Partial TP)
     — TP1 hedefine ulaşınca pozisyonun %50'sini sat, kalan %50 çalışsın
     — Kalanlar için stop -> break-even seviyesine çek

  3. Portföy Isısı (Portfolio Heat)
     — Gün içi kayıp %X'i geçince yeni alım durdur
     — Toplam açık pozisyon USDT değeri limiti

  4. Volatilite Filtresi
     — ATR çok yüksekse (örn. %6+ saatlik) pozisyon küçült veya alma

  5. Zaman Bazlı Çıkış
     — Pozisyon MAX_HOLD_BARS'ı geçtiyse ve kârda değilse çık

KULLANIM:
  from risk_engine import (
      RiskEngine, calc_atr_trailing_stop,
      check_portfolio_heat, should_reduce_size
  )
  engine = RiskEngine(portfolio_value=50000)
  trailing = engine.get_trailing_stop(entry, peak, atr_pct, macro_mode)
  heat     = engine.check_heat(daily_pnl, fleet_state)
"""

import time
from typing import Dict, Optional, Tuple

# ── AYARLAR ──────────────────────────────────────────────────────────────────

# ATR-Adaptif Trailing Stop
ATR_TRAIL_MIN   = 1.5   # ATR düşükse trailing bu kadar dar olabilir (%)
ATR_TRAIL_MAX   = 5.0   # ATR yüksekse bu kadar genişler
ATR_TRAIL_MULT  = 1.8   # Trailing = ATR_PCT × bu çarpan
ATR_LOW_THRESH  = 1.0   # ATR bu değerin altında -> "düşük vol" modda
ATR_HIGH_THRESH = 4.0   # ATR bu değerin üstünde -> "yüksek vol" mod

# Kısmi Kar Alma
PARTIAL_TP_ENABLED  = True
PARTIAL_TP_RATIO    = 0.60   # v3.0: %50 -> %60 (daha fazla kâr kilitle)
PARTIAL_TP_TRIGGER  = 3.0    # v3.0: %3.5 -> %3.0 (daha erken kısmi çıkış)
PARTIAL_TP_BEAR     = 2.0    # v3.0: %2.5 -> %2.0 (BEAR'de hızlı kâr al)
PARTIAL_TP_BULL     = 4.0    # v3.0: %5.0 -> %4.0 (BULL'da da makul eşik)

# Portföy Isısı
HEAT_DAILY_LOSS_LIMIT  = -0.025   # Günlük -%2.5 kayıpta yeni alım durdur
HEAT_DAILY_LOSS_REDUCE = -0.020   # Günlük -%2.0'de pozisyon boyutunu yarıya indir (v2.5: gevşetildi)
HEAT_MAX_EXPOSURE_PCT  = 0.80     # Portföyün %80'inden fazlası pozisyonda olamaz (v2.5: gevşetildi)

# Volatilite Filtresi
VOL_FILTER_ENABLED   = True
VOL_TOO_HIGH_PCT     = 6.0    # ATR % bu değerin üstündeyse al ama küçült
VOL_EXTREME_PCT      = 10.0   # ATR % bu değerin üstündeyse hiç alma

# Zaman Bazlı Çıkış
MAX_HOLD_BARS        = 20     # 4h × 20 = ~3.3 gün
MAX_HOLD_SECS        = MAX_HOLD_BARS * 4 * 3600


# ── 1. ATR-ADAPTİF TRAİLİNG STOP ─────────────────────────────────────────────

def calc_atr_trailing_stop(
    atr_pct:    float,
    macro_mode: str = "NEUTRAL",
) -> float:
    """
    Mevcut volatiliteye göre trailing stop genişliğini hesapla.

    Dönüş: trailing_stop_pct (örn. 2.8 -> %2.8 düşünce çık)
    """
    base = atr_pct * ATR_TRAIL_MULT

    # Makro moda göre çarpan
    if macro_mode == "BULL":
        base *= 1.1   # BULL'da biraz daha geniş trailing (trendi koru)
    elif macro_mode == "BEAR":
        base *= 0.85  # BEAR'da daha sıkı (kâr hızlı al)

    # Min/Max sınırları
    return round(max(ATR_TRAIL_MIN, min(ATR_TRAIL_MAX, base)), 2)


def get_trailing_stop_price(
    entry:      float,
    peak:       float,
    atr_pct:    float,
    macro_mode: str = "NEUTRAL",
) -> float:
    """
    Trailing stop tetik fiyatını döndür.
    Pozisyon: peak'ten bu kadar geri dönünce sat.
    """
    trail_pct = calc_atr_trailing_stop(atr_pct, macro_mode)
    trigger   = peak * (1.0 - trail_pct / 100.0)
    # Hiçbir zaman entry altına düşmesin (zararı sınırla)
    return max(trigger, entry * 0.98)


# ── 2. KISMİ KAR ALMA ─────────────────────────────────────────────────────────

def check_partial_tp(
    entry:      float,
    price:      float,
    qty:        float,
    state:      dict,
    macro_mode: str = "NEUTRAL",
) -> Optional[dict]:
    """
    Kısmi kar alma koşulu oluştu mu?
    Oluştuysa: {"action": "PARTIAL_SELL", "qty": float, "pct": float} döndür
    Oluşmadıysa: None döndür

    state: fleet_state[symbol] — partial_sold flag'ini izlemek için
    """
    if not PARTIAL_TP_ENABLED:
        return None

    # Zaten kısmi satış yapıldıysa tekrar yapma
    if state.get("partial_sold"):
        return None

    profit_pct = (price - entry) / entry * 100 if entry > 0 else 0

    # Makro moda göre TP1 eşiği
    if state.get("source") == "AGGRESSIVE_TRADER":
        trigger = 1.5  # Agresif modda çok hızlı %50 kâr al
    elif macro_mode == "BULL":
        trigger = PARTIAL_TP_BULL
    elif macro_mode == "BEAR":
        trigger = PARTIAL_TP_BEAR
    else:
        trigger = PARTIAL_TP_TRIGGER

    if profit_pct >= trigger:
        sell_qty = round(qty * PARTIAL_TP_RATIO, 8)
        return {
            "action":   "PARTIAL_SELL",
            "qty":      sell_qty,
            "keep_qty": round(qty - sell_qty, 8),
            "profit_pct": round(profit_pct, 2),
            "trigger":  trigger,
            "reason":   f"Kısmi TP: +{profit_pct:.1f}% ≥ {trigger}% eşiği",
        }
    return None


# ── 3. PORTFÖY ISISI ─────────────────────────────────────────────────────────

class PortfolioHeat:
    """
    Portföy ısısını takip et — fazla kayıp/maruz kalma varsa durdur.
    """
    def __init__(self):
        self.blocked_until: float = 0.0

    def check(
        self,
        daily_pnl:     float,
        portfolio_val:  float,
        fleet_state:    dict,
        entry_prices:   dict,  # {symbol: entry_price}
    ) -> dict:
        """
        Alım yapılabilir mi?
        Döndürür: {can_buy, reason, size_multiplier}
        size_multiplier: 1.0 = normal, 0.5 = yarı boyut, 0.0 = alma
        """
        # Manuel blok süresi dolmadıysa
        if time.time() < self.blocked_until:
            mins = (self.blocked_until - time.time()) / 60
            return {
                "can_buy":         False,
                "size_multiplier": 0.0,
                "reason":          f"Portföy soğuma: {mins:.0f}dk kaldı",
            }

        import trade_executor
        rate = trade_executor.get_usdt_try_rate()
        daily_loss_pct = daily_pnl / portfolio_val if portfolio_val > 0 else 0

        # Toplam maruz kalma (TL cinsinden)
        total_allocated = sum(
            entry_prices.get(sym, 0) * state.get("qty", 0)
            for sym, state in fleet_state.items()
        ) * rate
        exposure_pct = total_allocated / portfolio_val if portfolio_val > 0 else 0

        # Günlük kayıp limit
        if daily_loss_pct <= HEAT_DAILY_LOSS_LIMIT:
            self.blocked_until = time.time() + 2 * 3600  # 2 saat dur
            return {
                "can_buy":         False,
                "size_multiplier": 0.0,
                "reason":          f"Günlük kayıp limiti: {daily_loss_pct:.1%} (limit:{HEAT_DAILY_LOSS_LIMIT:.1%})",
            }

        # Maruz kalma limiti
        if exposure_pct >= HEAT_MAX_EXPOSURE_PCT:
            return {
                "can_buy":         False,
                "size_multiplier": 0.0,
                "reason":          f"Max maruz kalma: %{exposure_pct:.0%} (limit:%{HEAT_MAX_EXPOSURE_PCT:.0%})",
            }

        # Uyarı zonu — boyutu küçült
        if daily_loss_pct <= HEAT_DAILY_LOSS_REDUCE:
            return {
                "can_buy":         True,
                "size_multiplier": 0.5,
                "reason":          f"Uyarı: günlük kayıp {daily_loss_pct:.1%} — yarı boyut",
            }

        return {
            "can_buy":         True,
            "size_multiplier": 1.0,
            "reason":          "Normal",
        }


# ── 4. VOLATİLİTE FİLTRESİ ────────────────────────────────────────────────────

def check_volatility_filter(
    atr_pct:    float,
    macro_mode: str = "NEUTRAL",
) -> dict:
    """
    ATR çok yüksekse pozisyon alma veya küçült.
    BEAR modunda daha katı eşikler.
    """
    if not VOL_FILTER_ENABLED:
        return {"ok": True, "size_multiplier": 1.0, "reason": "Filtre kapalı"}

    extreme = VOL_EXTREME_PCT
    high    = VOL_TOO_HIGH_PCT

    if macro_mode == "BEAR":
        extreme *= 0.8
        high    *= 0.8

    if atr_pct >= extreme:
        return {
            "ok":              False,
            "size_multiplier": 0.0,
            "reason":          f"ATR aşırı yüksek: %{atr_pct:.1f} ≥ %{extreme:.1f} — alma",
        }
    elif atr_pct >= high:
        return {
            "ok":              True,
            "size_multiplier": 0.5,
            "reason":          f"ATR yüksek: %{atr_pct:.1f} — yarı boyut",
        }
    else:
        return {
            "ok":              True,
            "size_multiplier": 1.0,
            "reason":          f"ATR normal: %{atr_pct:.1f}",
        }


# ── 5. ZAMAN BAZLI ÇIKIŞ ─────────────────────────────────────────────────────

def check_time_exit(
    symbol: str,
    state:  dict,
    price:  float,
) -> Optional[dict]:
    """
    Pozisyon çok uzun süredir açıksa ve kârda değilse çık.
    DOWN leveraged tokenlar için erime etkisinden ötürü maks 36 saat tutulur.
    """
    entry_time = state.get("time", 0)
    entry      = state.get("entry", 0)
    elapsed    = time.time() - entry_time

    is_down = "DOWN" in symbol
    limit = 36 * 3600 if is_down else MAX_HOLD_SECS

    if elapsed < limit:
        return None

    profit_pct = (price - entry) / entry * 100 if entry > 0 else 0

    # DOWN tokenları kâr durumundan bağımsız 36 saat sonra çıkar
    if profit_pct < 2.0 or is_down:
        return {
            "action":  "TIME_EXIT",
            "elapsed_h": round(elapsed / 3600, 1),
            "profit_pct": round(profit_pct, 2),
            "reason":  f"Zaman çıkışı (DOWN Token Koruma): {elapsed/3600:.0f}h açık, kâr {profit_pct:+.1f}%",
        }
    return None


# ── ANA RİSK MOTORU SINIFI ────────────────────────────────────────────────────

class RiskEngine:
    """
    Tüm risk kontrollerini bir arada yöneten ana sınıf.
    Backend başlangıcında bir kez örnekle, tüm döngüde kullan.
    """

    def __init__(self, portfolio_value: float = 50000.0):
        self.portfolio_value = portfolio_value
        self.heat = PortfolioHeat()

    def update_portfolio(self, value: float):
        """Portföy değeri değişince güncelle."""
        self.portfolio_value = value

    def get_trailing_stop(
        self,
        entry:      float,
        peak:       float,
        atr_pct:    float,
        macro_mode: str = "NEUTRAL",
    ) -> Tuple[float, float]:
        """
        (trailing_stop_pct, trailing_stop_price) döndür.
        """
        pct   = calc_atr_trailing_stop(atr_pct, macro_mode)
        price = get_trailing_stop_price(entry, peak, atr_pct, macro_mode)
        return pct, price

    def pre_buy_check(
        self,
        atr_pct:     float,
        daily_pnl:   float,
        fleet_state: dict,
        macro_mode:  str = "NEUTRAL",
    ) -> dict:
        """
        Alım öncesi toplu kontrol.
        Döndürür: {can_buy, size_multiplier, reason}
        """
        # 1. Volatilite kontrolü
        vol = check_volatility_filter(atr_pct, macro_mode)
        if not vol["ok"]:
            return {"can_buy": False, "size_multiplier": 0.0, "reason": vol["reason"]}

        # 2. Portföy ısısı
        entry_prices = {
            sym: s.get("entry", 0)
            for sym, s in fleet_state.items()
        }
        heat = self.heat.check(daily_pnl, self.portfolio_value, fleet_state, entry_prices)
        if not heat["can_buy"]:
            return {"can_buy": False, "size_multiplier": 0.0, "reason": heat["reason"]}

        # v2.5: Çarpan stacking düzeltmesi — min(vol,heat) yerine çarpım
        # Eski: 0.5 × 0.5 = 0.25 (çok agresif ceza)
        # Yeni: min(vol, heat) ile en az 0.5x garanti
        combined = min(vol["size_multiplier"], heat["size_multiplier"])

        return {
            "can_buy":         True,
            "size_multiplier": combined,
            "reason":          f"vol:{vol['size_multiplier']:.1f} ∧ heat:{heat['size_multiplier']:.1f} = {combined:.1f}",
        }

    def post_buy_state(
        self,
        entry:   float,
        qty:     float,
        atr_pct: float,
    ) -> dict:
        """
        Pozisyon açılınca state'e ek alanlar ekle.
        """
        trail_pct, trail_price = self.get_trailing_stop(entry, entry, atr_pct)
        return {
            "atr_trail_pct":  trail_pct,
            "partial_sold":   False,
            "partial_qty":    qty,        # Kısmi satıştan sonra güncellenir
        }

    def check_exits(
        self,
        symbol:     str,
        state:      dict,
        price:      float,
        atr_pct:    float,
        macro_mode: str = "NEUTRAL",
    ) -> Optional[dict]:
        """
        Satış koşullarını kontrol et.
        Döndürür: {action, qty, reason} veya None
        """
        entry = state.get("entry", 0)
        peak  = state.get("peak", price)
        qty   = state.get("qty", 0)

        # 1. Kısmi kar alma
        partial = check_partial_tp(entry, price, qty, state, macro_mode)
        if partial:
            return partial

        # 2. Zaman bazlı çıkış
        time_exit = check_time_exit(symbol, state, price)
        if time_exit:
            return {**time_exit, "qty": qty}

        return None


# ── GLOBAL INSTANCE (backend.py tarafından kullanılır) ───────────────────────
_risk_engine: Optional[RiskEngine] = None

def get_risk_engine(portfolio_value: float = 50000.0) -> RiskEngine:
    """Singleton risk engine döndür."""
    global _risk_engine
    if _risk_engine is None:
        _risk_engine = RiskEngine(portfolio_value)
    return _risk_engine


# ── CLI TEST ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n  RISK ENGINE TEST")
    print("  " + "─" * 50)

    engine = RiskEngine(portfolio_value=50000)

    # Trailing stop örnekleri
    for atr in [0.8, 1.5, 2.5, 4.0, 6.0]:
        for mode in ["BULL", "NEUTRAL", "BEAR"]:
            pct = calc_atr_trailing_stop(atr, mode)
            print(f"  ATR={atr:.1f}% [{mode:<8}] -> trailing %{pct}")

    print()
    # Portföy ısısı testi
    heat = engine.heat.check(
        daily_pnl    = -1500,   # TL cinsinden (~$40)
        portfolio_val = 50000,
        fleet_state  = {"BTC/USDT": {"qty": 0.001, "entry": 80000}},
        entry_prices = {"BTC/USDT": 80000},
    )
    print(f"  Heat check (daily_pnl=-120): can_buy={heat['can_buy']} | {heat['reason']}")

    # Kısmi kar alma
    partial = check_partial_tp(80000, 82800, 0.01, {}, "NEUTRAL")
    print(f"  Partial TP test (+3.5%): {partial}")

    # Volatilite filtresi
    for atr in [2.0, 5.0, 7.0, 11.0]:
        v = check_volatility_filter(atr)
        print(f"  Vol filter ATR={atr}%: ok={v['ok']} mult={v['size_multiplier']} | {v['reason']}")
