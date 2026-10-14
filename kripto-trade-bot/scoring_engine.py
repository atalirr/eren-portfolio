"""
ANTIGRAVITY AI - Adaptive Regime-Switching Scoring Engine v2.0
==============================================================
İyileştirmeler:
  - 9.  4H trend sonuçları 30 dakika cache'lenir (rate limit koruması)
  - 14. Order book imbalance (bid/ask dengesi) skora eklendi
"""

import ccxt
import pandas as pd
import numpy as np
import time
from indicators import calculate_rsi, compute_all_indicators

import threading
_4h_lock = threading.Lock()
_ob_lock = threading.Lock()


# ── 9. 4H TREND CACHE ─────────────────────────────────────────────────────────
_4h_cache: dict = {}          # {symbol: {"trend": "BULLISH", "ts": timestamp}}
CACHE_TTL_4H = 30 * 60        # 30 dakika

# ── 14. ORDER BOOK CACHE ──────────────────────────────────────────────────────
_ob_cache: dict = {}           # {symbol: {"imbalance": float, "ts": timestamp}}
CACHE_TTL_OB = 5 * 60         # 5 dakika


class TechnicalScoringEngine:
    def __init__(self, symbol='BTC/USDT', exchange=None, personality='SWING_TRADER'):
        # DÜZELTME: Thread-safety — her instance kendi CCXT bağlantısını oluşturur
        # Paylaşılan tek CCXT instance'ı 20 thread'den çağrıldığında
        # soket çakışması ve rate-limit doygunluğuna neden oluyordu
        if exchange is not None:
            self.exchange = ccxt.binance({
                'enableRateLimit': True,
                'options': {'defaultType': exchange.options.get('defaultType', 'spot') if hasattr(exchange, 'options') else 'spot'},
                'timeout': 30000,
                'rateLimit': 100,  # 50ms default -> 100ms (20 thread paylaşımı için güvenli)
            })
        else:
            self.exchange = ccxt.binance({
                'enableRateLimit': True,
                'options': {'defaultType': 'spot'},
                'timeout': 30000,
            })
        self.symbol      = symbol
        self.personality = personality

    # ================================================================
    #  VERİ ÇEKME
    # ================================================================
    def fetch_data(self, timeframe='1h', limit=200):
        try:
            bars = self.exchange.fetch_ohlcv(self.symbol, timeframe=timeframe, limit=limit)
            df   = pd.DataFrame(bars, columns=['time','open','high','low','close','volume'])
            return df
        except Exception:
            return pd.DataFrame()

    # ================================================================
    #  TEKNİK İNDİKATÖRLER
    # ================================================================
    @staticmethod
    def _rsi(close, period=14):
        return calculate_rsi(close, period)

    def _compute_all(self, df):
        return compute_all_indicators(df)

    # ================================================================
    #  REJİM TESPİTİ
    # ================================================================
    @staticmethod
    def detect_regime(last, df):
        adx      = float(last['adx'])      if not np.isnan(last['adx'])      else 0
        plus_di  = float(last['plus_di'])  if not np.isnan(last['plus_di'])  else 0
        minus_di = float(last['minus_di']) if not np.isnan(last['minus_di']) else 0
        atr_pct  = float(last['atr_pct'])  if not np.isnan(last['atr_pct'])  else 0
        recent_atr = float(df['atr_pct'].tail(20).mean()) if len(df) >= 20 else atr_pct
        if np.isnan(recent_atr): recent_atr = atr_pct
        if recent_atr > 3.0:     return 'HIGH_VOL'
        # v2.5: ADX eşiği 30->22 — standart teknik analiz eşiğine dönüldü
        if adx > 22:             return 'TRENDING_UP' if plus_di > minus_di else 'TRENDING_DOWN'
        return 'CHOPPY'

    # ================================================================
    #  REJİM PARAMETRELERİ
    # ================================================================
    def get_regime_params(self, regime):
        p = self.personality
        if p == 'AUTO':
            p = {'TRENDING_UP': 'SWING_TRADER', 'CHOPPY': 'SCALPER',
                 'HIGH_VOL': 'DEGEN', 'TRENDING_DOWN': 'SCALPER'}.get(regime, 'SWING_TRADER')
        if p == 'AGGRESSIVE_TRADER': return self._get_aggressive_params(regime)
        if p == 'SCALPER':    return self._get_scalper_params(regime)
        if p == 'DEGEN':      return self._get_degen_params(regime)
        return self._get_swing_params(regime)

    def _get_swing_params(self, regime):
        # v2.3 — TRENDING_DOWN'da alım yok, geniş ATR stop, ulaşılabilir TP
        # Backend'de 16 bar timeout eklendi — sürüklenen pozisyon kapanır
        return {
            'TRENDING_UP':   {'buy_thresh':68, 'sell_thresh':45, 'atr_mult':2.5, 'take_profit':5.0, 'can_buy':True,  'strategy':'MOMENTUM_SWING'},
            'TRENDING_DOWN': {'buy_thresh':78, 'sell_thresh':65, 'atr_mult':2.0, 'take_profit':3.0, 'can_buy':True,  'strategy':'OVERSOLD_BOUNCE'},
            'CHOPPY':        {'buy_thresh':66, 'sell_thresh':52, 'atr_mult':2.5, 'take_profit':5.0, 'can_buy':True,  'strategy':'MEAN_REVERSION'},
            'HIGH_VOL':      {'buy_thresh':70, 'sell_thresh':55, 'atr_mult':3.0, 'take_profit':8.0, 'can_buy':True,  'strategy':'WIDE_STOPS'},
        }[regime]

    def _get_scalper_params(self, regime):
        return {
            'TRENDING_UP':   {'buy_thresh':70, 'sell_thresh':50, 'atr_mult':2.0, 'take_profit':1.5, 'can_buy':True,  'strategy':'SCALP_MOMENTUM'},
            'TRENDING_DOWN': {'buy_thresh':999,'sell_thresh':65, 'atr_mult':1.5, 'take_profit':1.0, 'can_buy':False, 'strategy':'NO_TRADE'},
            'CHOPPY':        {'buy_thresh':75, 'sell_thresh':55, 'atr_mult':2.0, 'take_profit':1.2, 'can_buy':True,  'strategy':'SCALP_REVERSION'},
            'HIGH_VOL':      {'buy_thresh':85, 'sell_thresh':60, 'atr_mult':3.0, 'take_profit':2.0, 'can_buy':True,  'strategy':'SCALP_VOLATILITY'},
        }[regime]

    def _get_degen_params(self, regime):
        return {
            'TRENDING_UP':   {'buy_thresh':55, 'sell_thresh':30, 'atr_mult':6.0, 'take_profit':15.0, 'can_buy':True, 'strategy':'DEGEN_LONG'},
            'TRENDING_DOWN': {'buy_thresh':85, 'sell_thresh':45, 'atr_mult':4.0, 'take_profit':8.0,  'can_buy':True, 'strategy':'DEGEN_KNIFE_CATCH'},
            'CHOPPY':        {'buy_thresh':65, 'sell_thresh':35, 'atr_mult':5.0, 'take_profit':10.0, 'can_buy':True, 'strategy':'DEGEN_CHOP'},
            'HIGH_VOL':      {'buy_thresh':60, 'sell_thresh':30, 'atr_mult':8.0, 'take_profit':20.0, 'can_buy':True, 'strategy':'DEGEN_VOLATILITY'},
        }[regime]

    def _get_aggressive_params(self, regime):
        """
        AGGRESSIVE_TRADER — 1h timeframe day-trading parametreleri.
        Düşük eşikler, hızlı TP, sıkı stop. Tüm rejimlerde alım açık.
        Hedef: Çok sayıda küçük kârlı işlem ($0.50-$2 per trade).
        """
        return {
            'TRENDING_UP':   {'buy_thresh':58, 'sell_thresh':38, 'atr_mult':1.2, 'take_profit':2.5, 'can_buy':True, 'strategy':'AGG_MOMENTUM'},
            'TRENDING_DOWN': {'buy_thresh':70, 'sell_thresh':50, 'atr_mult':1.0, 'take_profit':1.5, 'can_buy':True,  'strategy':'AGG_COUNTER'},
            'CHOPPY':        {'buy_thresh':62, 'sell_thresh':42, 'atr_mult':1.3, 'take_profit':2.0, 'can_buy':True, 'strategy':'AGG_REVERSION'},
            'HIGH_VOL':      {'buy_thresh':65, 'sell_thresh':45, 'atr_mult':1.5, 'take_profit':3.0, 'can_buy':True, 'strategy':'AGG_VOLATILITY'},
        }[regime]

    # ================================================================
    #  SKOR FONKSİYONLARI
    # ================================================================
    def _score_trending_up(self, last, prev):
        score = 0
        if last['ema9']  > last['ema20']:  score += 10
        if last['ema20'] > last['ema50']:  score += 10
        if last['ema50'] > last['ema200']: score += 10
        h_now  = float(last['macd_hist'])  if not np.isnan(last['macd_hist'])  else 0
        h_prev = float(prev['macd_hist'])  if not np.isnan(prev['macd_hist'])  else 0
        if h_now > 0 and h_now > h_prev:  score += 25
        elif h_now > 0:                   score += 15
        elif h_now > h_prev:              score += 10
        rsi = float(last['rsi']) if not np.isnan(last['rsi']) else 50
        if 40 < rsi < 65:   score += 20
        elif 30 < rsi < 75: score += 10
        vr = float(last['vol_ratio']) if not np.isnan(last['vol_ratio']) else 1
        if vr > 1.5:   score += 15
        elif vr > 1.0: score += 8
        pdi = float(last['plus_di'])  if not np.isnan(last['plus_di'])  else 0
        mdi = float(last['minus_di']) if not np.isnan(last['minus_di']) else 0
        if pdi > mdi * 1.5: score += 10
        elif pdi > mdi:     score += 5
        return min(score, 100)

    def _score_trending_down(self, last, prev):
        score = 0
        rsi = float(last['rsi']) if not np.isnan(last['rsi']) else 50
        if rsi < 25:   score += 30
        elif rsi < 35: score += 20
        elif rsi < 45: score += 5
        sk = float(last['stoch_k']) if not np.isnan(last['stoch_k']) else 50
        sd = float(last['stoch_d']) if not np.isnan(last['stoch_d']) else 50
        if sk < 15 and sd < 15:    score += 25
        elif sk < 25 and sk > sd:  score += 15
        elif sk < 40 and sk > sd:  score += 5
        bb = float(last['bb_pct']) if not np.isnan(last['bb_pct']) else 0.5
        if bb < 0.05:   score += 20
        elif bb < 0.15: score += 12
        elif bb < 0.25: score += 5
        zs = float(last['z_score']) if not np.isnan(last['z_score']) else 0
        if zs < -2.0:   score += 15
        elif zs < -1.5: score += 10
        elif zs < -1.0: score += 5
        vr = float(last['vol_ratio']) if not np.isnan(last['vol_ratio']) else 1
        if vr > 2.0:   score += 10
        elif vr > 1.5: score += 5
        return min(score, 100)

    def _score_choppy(self, last, prev):
        score = 0
        zs = float(last['z_score']) if not np.isnan(last['z_score']) else 0
        if zs < -2.0:   score += 30
        elif zs < -1.5: score += 22
        elif zs < -1.0: score += 12
        elif zs < -0.5: score += 5
        bb = float(last['bb_pct']) if not np.isnan(last['bb_pct']) else 0.5
        if bb < 0.05:   score += 25
        elif bb < 0.15: score += 18
        elif bb < 0.25: score += 10
        elif bb < 0.35: score += 3
        rsi = float(last['rsi']) if not np.isnan(last['rsi']) else 50
        if rsi < 30:   score += 25
        elif rsi < 38: score += 18
        elif rsi < 45: score += 8
        sk = float(last['stoch_k']) if not np.isnan(last['stoch_k']) else 50
        sd = float(last['stoch_d']) if not np.isnan(last['stoch_d']) else 50
        if sk < 20 and sk > sd: score += 10
        elif sk < 30:           score += 5
        vr = float(last['vol_ratio']) if not np.isnan(last['vol_ratio']) else 1
        if vr > 1.5:   score += 10
        elif vr > 1.0: score += 3
        return min(score, 100)

    def _score_high_vol(self, last, prev):
        score = 0
        rsi = float(last['rsi']) if not np.isnan(last['rsi']) else 50
        if rsi < 25:   score += 25
        elif rsi < 32: score += 15
        elif rsi < 40: score += 5
        sk = float(last['stoch_k']) if not np.isnan(last['stoch_k']) else 50
        sd = float(last['stoch_d']) if not np.isnan(last['stoch_d']) else 50
        if sk < 10 and sd < 15:    score += 25
        elif sk < 20 and sk > sd:  score += 15
        zs = float(last['z_score']) if not np.isnan(last['z_score']) else 0
        if zs < -2.5:  score += 20
        elif zs < -2.0:score += 12
        elif zs < -1.5:score += 5
        h_now  = float(last['macd_hist'])  if not np.isnan(last['macd_hist'])  else 0
        h_prev = float(prev['macd_hist'])  if not np.isnan(prev['macd_hist'])  else 0
        if h_now > 0 and h_prev <= 0: score += 15
        elif h_now > h_prev:          score += 8
        vr = float(last['vol_ratio']) if not np.isnan(last['vol_ratio']) else 1
        if vr > 2.5:   score += 15
        elif vr > 1.5: score += 8
        return min(score, 100)

    # ================================================================
    #  9. 4H TREND — CACHE'Lİ
    # ================================================================
    def _get_4h_trend(self):
        global _4h_cache
        now    = time.time()
        with _4h_lock:
            cached = _4h_cache.get(self.symbol)
        if cached and (now - cached["ts"]) < CACHE_TTL_4H:
            return cached
        try:
            df4h    = self.fetch_data('4h', 60)
            if df4h.empty or len(df4h) < 30:
                # Yetersiz veri — dummy değerlerle cache'i zehirleme
                cached_old = _4h_cache.get(self.symbol)
                if cached_old:
                    return cached_old
                return {
                    "trend": "NEUTRAL", "rsi": 50.0, "bb_pct": 0.5,
                    "macd_pos": 0.0, "z_score": 0.0, "ts": now
                }
            else:
                df4h = compute_all_indicators(df4h)
                last4h = df4h.iloc[-1]
                rsi4h = float(last4h['rsi']) if not np.isnan(last4h['rsi']) else 50.0
                bb4h = float(last4h['bb_pct']) if not np.isnan(last4h['bb_pct']) else 0.5
                zs4h = float(last4h['z_score']) if not np.isnan(last4h['z_score']) else 0.0
                macd_pos = 1.0 if last4h['macd'] > last4h['macd_sig'] else 0.0
                
                e20 = last4h['ema20']
                e50 = last4h['ema50']
                if e20 > e50 and rsi4h > 45:   trend = 'BULLISH'
                elif e20 < e50 and rsi4h < 55: trend = 'BEARISH'
                else:                           trend = 'NEUTRAL'
                
                res = {
                    "trend": trend,
                    "rsi": round(rsi4h, 1),
                    "bb_pct": round(bb4h, 2),
                    "macd_pos": macd_pos,
                    "z_score": round(zs4h, 2),
                    "ts": now
                }
        except Exception:
            # DÜZELTME: Hata durumunda dummy değerlerle cache'i ZEHİRLEME
            # Eski cache varsa onu koru (stale veri > dummy veri)
            cached_old = _4h_cache.get(self.symbol)
            if cached_old:
                return cached_old
            return {
                "trend": "NEUTRAL", "rsi": 50.0, "bb_pct": 0.5,
                "macd_pos": 0.0, "z_score": 0.0, "ts": now
            }
        # Sadece başarılı gerçek veriyi cache'e yaz
        with _4h_lock:
            _4h_cache[self.symbol] = res
        return res

    # ================================================================
    #  14. ORDER BOOK IMBALANCE — CACHE'Lİ
    # ================================================================
    def _get_ob_imbalance(self):
        """
        Anlık alıcı/satıcı dengesini ölçer.
        imbalance > 0.60 -> alıcılar baskın -> +10 puan
        imbalance < 0.40 -> satıcılar baskın -> -5 puan
        """
        global _ob_cache
        now    = time.time()
        cached = _ob_cache.get(self.symbol)
        if cached and (now - cached["ts"]) < CACHE_TTL_OB:
            return cached["imbalance"]
        try:
            ob          = self.exchange.fetch_order_book(self.symbol, limit=10)
            bid_vol     = sum(b[1] for b in ob.get('bids', []))
            ask_vol     = sum(a[1] for a in ob.get('asks', []))
            total       = bid_vol + ask_vol
            imbalance   = bid_vol / total if total > 0 else 0.5
        except Exception:
            imbalance = 0.5
        _ob_cache[self.symbol] = {"imbalance": imbalance, "ts": now}
        return imbalance

    # ================================================================
    #  UZAMA CEZASI (v2.4)
    # ================================================================
    @staticmethod
    def _extension_penalty(last, price):
        """
        Fiyat ortalamadan ne kadar uzaklaştıysa o kadar puan kırar.
        Amaç: aşırı uzamış / aşırı alım bölgesinden (tepeden) alımı engellemek.
        Döndürülen değer skordan ÇIKARILIR (0 = ceza yok).
        """
        penalty = 0.0

        # 1) z-skor: fiyatın ortalamadan kaç standart sapma uzakta olduğu
        zs = float(last['z_score']) if not np.isnan(last['z_score']) else 0.0
        if zs > 2.5:    penalty += 25
        elif zs > 1.5:  penalty += 12
        elif zs > 1.0:  penalty += 5

        # 2) RSI: aşırı alım
        rsi = float(last['rsi']) if not np.isnan(last['rsi']) else 50.0
        if rsi > 78:    penalty += 20
        elif rsi > 72:  penalty += 12
        elif rsi > 68:  penalty += 5

        # 3) EMA20'den uzaklık: ortalamadan kopmuş giriş
        try:
            ema20 = float(last['ema20'])
            if ema20 > 0 and price > 0:
                dist = (price - ema20) / ema20 * 100
                if dist > 8:     penalty += 15
                elif dist > 4:   penalty += 8
                elif dist > 2.5: penalty += 3
        except Exception:
            pass

        return round(penalty, 1)

    # ================================================================
    #  ANA SKOR FONKSİYONU
    # ================================================================
    def calculate_score(self, btc_closes=None):
        # v2.3: AGGRESSIVE_TRADER -> 1h timeframe (hızlı giriş/çıkış)
        #        Diğer modlar -> 4h timeframe (güvenilir sinyaller)
        _tf = '1h' if self.personality == 'AGGRESSIVE_TRADER' else '4h'
        df = self.fetch_data(_tf, 200)
        if df.empty or len(df) < 50:
            return {
                "total_score": 0, "signal": "INSUFFICIENT_DATA",
                "regime": "UNKNOWN", "regime_params": {},
                "metrics": {"price": 0, "rsi": 0, "is_bullish": False,
                            "macd_pos": False, "volatility": 0, "btc_corr": 0.0}
            }
        try:
            df   = self._compute_all(df)
            last = df.iloc[-1]
            prev = df.iloc[-2]

            price = float(last['close'])
            rsi   = float(last['rsi']) if not np.isnan(last['rsi']) else 50

            # Rejim tespiti
            regime        = self.detect_regime(last, df)
            regime_params = self.get_regime_params(regime)

            # Rejime göre skor
            if regime == 'TRENDING_UP':   raw_score = self._score_trending_up(last, prev)
            elif regime == 'TRENDING_DOWN':raw_score = self._score_trending_down(last, prev)
            elif regime == 'CHOPPY':      raw_score = self._score_choppy(last, prev)
            else:                         raw_score = self._score_high_vol(last, prev)

            # 9. 4H trend onayı (cache'li)
            cached_4h = self._get_4h_trend()
            trend_4h = cached_4h["trend"]
            if trend_4h == 'BULLISH': raw_score += 10
            elif trend_4h == 'BEARISH': raw_score -= 10

            # 14. Order book imbalance bonusu
            ob_imbalance = self._get_ob_imbalance()
            if ob_imbalance > 0.60:   raw_score += 10   # Alıcılar baskın
            elif ob_imbalance < 0.40: raw_score -= 5    # Satıcılar baskın

            # ── v2.5: UZAMA CEZASI (DENGELENMİŞ) ──────────────────────────────
            # v2.4'teki tam ceza, TRENDING_UP'ta momentum paradoksu yaratıyordu.
            # Çözüm: TRENDING_UP'ta cezayı %50 azalt, diğer rejimlerde tam uygula.
            ext_penalty = self._extension_penalty(last, price)
            if regime == 'TRENDING_UP':
                ext_penalty *= 0.5  # Momentum rejiminde cezayı yarıya indir
            raw_score  -= ext_penalty

            total_score = round(float(np.clip(raw_score, 0, 100)), 2)
            if np.isnan(total_score) or np.isinf(total_score): total_score = 0

            buy_t  = regime_params['buy_thresh']
            signal = (
                "STRONG_BUY" if total_score >= buy_t else
                "BUY"        if total_score >= buy_t - 10 else
                "SELL"       if total_score <= 20 else
                "NEUTRAL"
            )

            returns    = df['close'].pct_change()
            volatility = round(float(np.clip(returns.std() * 100, 0, 100)), 1)
            if np.isnan(volatility): volatility = 0

            adx = float(last['adx'])      if not np.isnan(last['adx'])      else 0
            sk  = float(last['stoch_k'])  if not np.isnan(last['stoch_k'])  else 50
            bb  = float(last['bb_pct'])   if not np.isnan(last['bb_pct'])   else 0.5
            zs  = float(last['z_score'])  if not np.isnan(last['z_score'])  else 0
            vr  = float(last['vol_ratio'])if not np.isnan(last['vol_ratio'])else 1
            atr = float(last['atr_pct'])  if not np.isnan(last['atr_pct'])  else 0

            # Calculate correlation with BTC if btc_closes is provided
            btc_corr = 0.0
            if btc_closes is not None and not df.empty:
                try:
                    btc_vals = btc_closes.values
                    coin_vals = df['close'].tail(len(btc_vals)).values
                    if len(btc_vals) == len(coin_vals) and len(btc_vals) >= 10:
                        corr = np.corrcoef(btc_vals, coin_vals)[0, 1]
                        btc_corr = 0.0 if np.isnan(corr) else float(corr)
                except Exception:
                    pass

            return {
                "total_score":   total_score,
                "signal":        signal,
                "regime":        regime,
                "regime_params": regime_params,
                "metrics": {
                    "price":        price,
                    "rsi":          round(float(np.clip(rsi, 0, 100)), 1),
                    "stoch_k":      round(sk, 1),
                    "adx":          round(adx, 1),
                    "atr_pct":      round(atr, 2),
                    "z_score":      round(zs, 2),
                    "trend_4h":     trend_4h,
                    "rsi_4h":       cached_4h["rsi"],
                    "bb_pct_4h":    cached_4h["bb_pct"],
                    "macd_pos_4h":  cached_4h["macd_pos"],
                    "z_score_4h":   cached_4h["z_score"],
                    "vol_ratio":    round(vr, 2),
                    "bb_pct":       round(bb, 2),
                    "ob_imbalance": round(ob_imbalance, 2),
                    "ext_penalty":  ext_penalty,
                    "is_bullish":   bool(last['ema20'] > last['ema200']),
                    "macd_pos":     bool(last['macd'] > last['macd_sig']),
                    "volatility":   volatility,
                    "btc_corr":     round(btc_corr, 3),
                }
            }

        except Exception as e:
            import traceback
            print(f"DEBUG scoring error [{self.symbol}]: {e}")
            print(traceback.format_exc())
            return {
                "total_score": 0, "signal": "CALC_ERROR",
                "regime": "ERROR", "regime_params": {},
                "metrics": {"price": 0, "rsi": 0, "is_bullish": False,
                            "macd_pos": False, "volatility": 0, "btc_corr": 0.0}
            }
