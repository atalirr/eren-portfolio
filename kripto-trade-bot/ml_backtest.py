"""
ANTIGRAVITY AI — ML-Enhanced Backtest v1.0
============================================
Teknik indikatörlerden öğrenen bir sinyal filtresi eğitir,
sonra ML filtresi ile filtresiz backtest'i karşılaştırır.

Çalıştırma: python ml_backtest.py

Gereksinim: pip install xgboost scikit-learn ccxt pandas numpy
"""

import sys
import subprocess

# ── Bağımlılık Kontrolü ───────────────────────────────────────────────────────
def ensure_packages():
    missing = []
    try:
        import xgboost
    except ImportError:
        missing.append("xgboost")
    try:
        import sklearn
    except ImportError:
        missing.append("scikit-learn")
    if missing:
        print(f"  Eksik kütüphaneler kuruluyor: {missing}")
        subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing + ["-q"])
        print("  Kurulum tamamlandı.\n")

ensure_packages()

import ccxt
import pandas as pd
import numpy as np
import time
import json
import warnings
from datetime import datetime, timedelta, timezone

import xgboost as xgb
from sklearn.model_selection import cross_val_score
from sklearn.metrics import (
    classification_report, roc_auc_score, confusion_matrix
)

warnings.filterwarnings("ignore")

# ── AYARLAR ───────────────────────────────────────────────────────────────────
SYMBOLS = [
    "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT",
    "XRP/USDT", "ADA/USDT", "AVAX/USDT", "DOGE/USDT",
    "DOT/USDT", "LINK/USDT"
]
TIMEFRAME     = "4h"
LOOKBACK_DAYS = 365
COMMISSION    = 0.001        # %0.1 her yön

# Walk-forward bölümü: ilk N gün eğitim, kalan test
TRAIN_DAYS    = 255          # ~7 ay eğitim
TEST_DAYS     = 110          # ~3.5 ay test

# Etiket parametreleri (4h: 1 bar = 4 saat)
WIN_TARGET    = 6.0          # % — 4h'de ulaşılabilir hedef (1h'de 3.5% -> 4h'de 6.0%)
LOSS_STOP     = 3.0          # % — geniş stop (4h volatilitesi daha yüksek)
LABEL_WINDOW  = 12           # 12 bar × 4h = 48 saat içinde sonucu belirle

# ML filtre eşiği
ML_THRESHOLD  = 0.58         # Bu olasılığın üzerindeyse al

# Temel strateji parametreleri (v2.4 — 4h timeframe)
BASE_PARAMS = {
    "TRENDING_UP":   {"buy":68, "sell":45, "atr_mult":2.5, "tp":8.0,  "can_buy":True},
    "TRENDING_DOWN": {"buy":999,"sell":65, "atr_mult":2.0, "tp":5.0,  "can_buy":False},
    "CHOPPY":        {"buy":76, "sell":52, "atr_mult":2.5, "tp":6.0,  "can_buy":True},
    "HIGH_VOL":      {"buy":80, "sell":55, "atr_mult":3.0, "tp":12.0, "can_buy":True},
}
CAPITAL_PER_TRADE = 100.0
MAX_HOLD_BARS     = 18       # 18 × 4h = 72 saat

REGIME_CODE = {"TRENDING_UP":0, "TRENDING_DOWN":1, "CHOPPY":2, "HIGH_VOL":3}

exchange = ccxt.binance({
    "enableRateLimit": True,
    "options": {"defaultType": "spot"},
    "timeout": 30000,
})


# ── VERİ ÇEKME ────────────────────────────────────────────────────────────────
def fetch_ohlcv(symbol: str, days: int) -> pd.DataFrame:
    since = exchange.parse8601(
        (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT00:00:00Z")
    )
    bars = []
    while True:
        chunk = exchange.fetch_ohlcv(symbol, TIMEFRAME, since=since, limit=1000)
        if not chunk:
            break
        bars.extend(chunk)
        since = chunk[-1][0] + 1
        if len(chunk) < 1000:
            break
        time.sleep(0.3)
    df = pd.DataFrame(bars, columns=["time", "open", "high", "low", "close", "volume"])
    df["time"] = pd.to_datetime(df["time"], unit="ms")
    return df


# ── İNDİKATÖRLER ─────────────────────────────────────────────────────────────
def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    close, high, low, volume = df["close"], df["high"], df["low"], df["volume"]

    # RSI
    delta = close.diff()
    gain  = delta.where(delta > 0, 0).rolling(14).mean()
    loss  = (-delta.where(delta < 0, 0)).rolling(14).mean()
    df["rsi"] = 100 - (100 / (1 + gain / (loss + 1e-9)))

    # Stochastic RSI
    mn = df["rsi"].rolling(14).min()
    mx = df["rsi"].rolling(14).max()
    stoch = (df["rsi"] - mn) / (mx - mn + 1e-9) * 100
    df["stoch_k"] = stoch.rolling(3).mean()
    df["stoch_d"] = df["stoch_k"].rolling(3).mean()

    # EMA ailesi
    for span in [9, 20, 50, 200]:
        df[f"ema{span}"] = close.ewm(span=span, adjust=False).mean()

    # MACD
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    df["macd"]      = ema12 - ema26
    df["macd_sig"]  = df["macd"].ewm(span=9, adjust=False).mean()
    df["macd_hist"] = df["macd"] - df["macd_sig"]

    # Bollinger Bands
    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    df["bb_pct"] = (close - (sma20 - 2*std20)) / (4*std20 + 1e-9)

    # Z-Score (30 bar)
    sma30 = close.rolling(30).mean()
    std30 = close.rolling(30).std()
    df["z_score"] = (close - sma30) / (std30 + 1e-9)

    # ADX + ATR
    plus_dm  = high.diff()
    minus_dm = low.diff().abs()
    plus_dm  = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0)
    minus_dm = minus_dm.where((minus_dm > plus_dm.abs()) & (minus_dm > 0), 0)
    tr = pd.concat([high-low, (high-close.shift()).abs(), (low-close.shift()).abs()], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1/14, adjust=False).mean()
    plus_di  = 100 * plus_dm.ewm(alpha=1/14, adjust=False).mean() / (atr + 1e-9)
    minus_di = 100 * minus_dm.ewm(alpha=1/14, adjust=False).mean() / (atr + 1e-9)
    dx = (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-9) * 100
    df["adx"]      = dx.ewm(alpha=1/14, adjust=False).mean()
    df["plus_di"]  = plus_di
    df["minus_di"] = minus_di
    df["atr"]      = atr
    df["atr_pct"]  = atr / (close + 1e-9) * 100

    # Volume
    df["vol_ema"]   = volume.ewm(span=20, adjust=False).mean()
    df["vol_ratio"] = volume / (df["vol_ema"] + 1e-9)

    # Ekstra özellikler
    df["ema_align"]  = ((df["ema9"]>df["ema20"]).astype(int) +
                        (df["ema20"]>df["ema50"]).astype(int) +
                        (df["ema50"]>df["ema200"]).astype(int))
    df["dist_ema20"] = (close - df["ema20"]) / (df["ema20"] + 1e-9) * 100
    df["ret_1h"]     = close.pct_change(1) * 100
    df["ret_4h"]     = close.pct_change(4) * 100
    df["ret_12h"]    = close.pct_change(12) * 100

    return df


# ── REJİM TESPİTİ ─────────────────────────────────────────────────────────────
def detect_regime(df: pd.DataFrame, i: int) -> str:
    row = df.iloc[i]
    adx      = float(row["adx"])     if not np.isnan(row["adx"])     else 0
    plus_di  = float(row["plus_di"]) if not np.isnan(row["plus_di"]) else 0
    minus_di = float(row["minus_di"])if not np.isnan(row["minus_di"])else 0
    recent_atr = float(df["atr_pct"].iloc[max(0,i-20):i+1].mean()) if i >= 20 else float(row["atr_pct"])
    if np.isnan(recent_atr): recent_atr = 0
    if recent_atr > 3.0: return "HIGH_VOL"
    if adx > 30:         return "TRENDING_UP" if plus_di > minus_di else "TRENDING_DOWN"
    return "CHOPPY"


# ── SKOR HESAPLAMA ─────────────────────────────────────────────────────────────
def compute_score(df: pd.DataFrame, i: int, regime: str) -> float:
    row      = df.iloc[i]
    prev_row = df.iloc[i-1]
    rsi  = float(row["rsi"])      if not np.isnan(row["rsi"])      else 50
    sk   = float(row["stoch_k"])  if not np.isnan(row["stoch_k"])  else 50
    sd   = float(row["stoch_d"])  if not np.isnan(row["stoch_d"])  else 50
    bb   = float(row["bb_pct"])   if not np.isnan(row["bb_pct"])   else 0.5
    zs   = float(row["z_score"])  if not np.isnan(row["z_score"])  else 0
    vr   = float(row["vol_ratio"])if not np.isnan(row["vol_ratio"])else 1
    h_now  = float(row["macd_hist"])  if not np.isnan(row["macd_hist"])  else 0
    h_prev = float(prev_row["macd_hist"]) if not np.isnan(prev_row["macd_hist"]) else 0
    pdi  = float(row["plus_di"])  if not np.isnan(row["plus_di"])  else 0
    mdi  = float(row["minus_di"]) if not np.isnan(row["minus_di"]) else 0
    score = 0
    if regime == "TRENDING_UP":
        if row["ema9"]  > row["ema20"]:  score += 10
        if row["ema20"] > row["ema50"]:  score += 10
        if row["ema50"] > row["ema200"]: score += 10
        if h_now > 0 and h_now > h_prev: score += 25
        elif h_now > 0:                  score += 15
        elif h_now > h_prev:             score += 10
        if 40 < rsi < 65:   score += 20
        elif 30 < rsi < 75: score += 10
        if vr > 1.5:   score += 15
        elif vr > 1.0: score += 8
        if pdi > mdi * 1.5: score += 10
        elif pdi > mdi:     score += 5
    elif regime == "TRENDING_DOWN":
        if rsi < 25:    score += 30
        elif rsi < 35:  score += 20
        elif rsi < 45:  score += 5
        if sk < 15 and sd < 15:     score += 25
        elif sk < 25 and sk > sd:   score += 15
        if bb < 0.05:   score += 20
        elif bb < 0.15: score += 12
        if zs < -2.0:   score += 15
        elif zs < -1.5: score += 10
        if vr > 2.0:    score += 10
    elif regime == "CHOPPY":
        if zs < -2.0:   score += 30
        elif zs < -1.5: score += 22
        elif zs < -1.0: score += 12
        if bb < 0.05:   score += 25
        elif bb < 0.15: score += 18
        elif bb < 0.25: score += 10
        if rsi < 30:    score += 25
        elif rsi < 38:  score += 18
        elif rsi < 45:  score += 8
        if sk < 20 and sk > sd: score += 10
        if vr > 1.5:    score += 10
    else:  # HIGH_VOL
        if rsi < 25:    score += 25
        elif rsi < 32:  score += 15
        if sk < 10 and sd < 15: score += 25
        elif sk < 20:   score += 15
        if zs < -2.5:   score += 20
        elif zs < -2.0: score += 12
        if h_now > 0 and h_prev <= 0: score += 15
        elif h_now > h_prev:          score += 8
        if vr > 2.5:   score += 15
        elif vr > 1.5: score += 8
    return min(float(score), 100.0)


# ── ÖZELLİK VEKTÖRLERİ ───────────────────────────────────────────────────────
FEATURE_NAMES = [
    "rsi","stoch_k","stoch_d","bb_pct","z_score","vol_ratio",
    "adx","atr_pct","macd_hist","ema_align","dist_ema20",
    "ret_1h","ret_4h","ret_12h","regime_code","raw_score",
]

def get_features(df: pd.DataFrame, i: int, regime: str, score: float) -> list:
    row = df.iloc[i]
    def g(col): return float(row[col]) if not np.isnan(row[col]) else 0.0
    return [
        g("rsi"), g("stoch_k"), g("stoch_d"), g("bb_pct"), g("z_score"),
        g("vol_ratio"), g("adx"), g("atr_pct"), g("macd_hist"),
        g("ema_align"), g("dist_ema20"), g("ret_1h"), g("ret_4h"), g("ret_12h"),
        float(REGIME_CODE.get(regime, 2)), score,
    ]


# ── ETİKETLEME ────────────────────────────────────────────────────────────────
def label_signal(df: pd.DataFrame, i: int) -> int:
    """
    WIN=1 eğer sonraki LABEL_WINDOW bar içinde fiyat WIN_TARGET% artarsa
    ve bu süre içinde LOSS_STOP% düşmezse.
    """
    entry = df["close"].iloc[i]
    win_price  = entry * (1 + WIN_TARGET  / 100)
    stop_price = entry * (1 - LOSS_STOP   / 100)
    for j in range(i+1, min(i+1+LABEL_WINDOW, len(df))):
        h = df["high"].iloc[j]
        l = df["low"].iloc[j]
        if l <= stop_price: return 0   # Stop önce vuruldu
        if h >= win_price:  return 1   # Hedef vuruldu
    return 0   # Ne hedef ne stop — timeout, LOSS say


# ── VERİ SETİ OLUŞTURMA ───────────────────────────────────────────────────────
def build_dataset(symbol: str, df: pd.DataFrame, start_bar: int, end_bar: int):
    """
    [start_bar, end_bar) aralığında tüm buy sinyali adaylarını topla.
    Her adayı: features + label.
    """
    X, y, meta = [], [], []
    for i in range(max(200, start_bar), min(end_bar, len(df) - LABEL_WINDOW - 1)):
        regime = detect_regime(df, i)
        params = BASE_PARAMS.get(regime, {})
        if not params.get("can_buy", False):
            continue
        score = compute_score(df, i, regime)
        # Temel eşiğin biraz altından al (ML filtreleyecek)
        if score < params["buy"] - 10:
            continue
        feat  = get_features(df, i, regime, score)
        lbl   = label_signal(df, i)
        X.append(feat)
        y.append(lbl)
        meta.append({"symbol": symbol, "bar": i, "regime": regime,
                     "score": score, "price": df["close"].iloc[i]})
    return X, y, meta


# ── ML MODELİ EĞİTİMİ ────────────────────────────────────────────────────────
def train_ml_model(X_train, y_train):
    n_pos = sum(y_train)
    n_neg = len(y_train) - n_pos
    scale = n_neg / n_pos if n_pos > 0 else 1.0

    model = xgb.XGBClassifier(
        n_estimators     = 300,
        max_depth        = 4,
        learning_rate    = 0.04,
        subsample        = 0.8,
        colsample_bytree = 0.8,
        min_child_weight = 3,
        scale_pos_weight = scale,
        eval_metric      = "logloss",
        random_state     = 42,
        verbosity        = 0,
    )
    model.fit(np.array(X_train, dtype=np.float32), np.array(y_train))
    return model


# ── ML FİLTRELİ BACKTEST ─────────────────────────────────────────────────────
def run_backtest_with_ml(symbol: str, df: pd.DataFrame,
                          start_bar: int, end_bar: int,
                          ml_model=None) -> dict:
    position    = None
    trades      = []
    balance     = 0.0
    last_exit   = None

    for i in range(max(200, start_bar), min(end_bar, len(df))):
        row   = df.iloc[i]
        price = row["close"]
        if price <= 0: continue

        regime = detect_regime(df, i)
        params = BASE_PARAMS.get(regime, {})
        score  = compute_score(df, i, regime)

        # ── ALIM ──────────────────────────────────────────────────────────────
        if (position is None
                and params.get("can_buy", False)
                and score >= params["buy"]):
            # Cooldown: son çıkıştan 6 bar geçmeli
            if last_exit is not None and (i - last_exit) < 6:
                continue
            # ML filtresi
            if ml_model is not None:
                feat  = get_features(df, i, regime, score)
                proba = ml_model.predict_proba(
                    np.array([feat], dtype=np.float32))[0][1]
                if proba < ML_THRESHOLD:
                    continue
            atr_val = float(row["atr_pct"]) if not np.isnan(row["atr_pct"]) else 1.5
            position = {
                "entry":   price,
                "peak":    price,
                "qty":     CAPITAL_PER_TRADE / (price * (1 + COMMISSION)),
                "bar":     i,
                "regime":  regime,
                "atr_pct": atr_val,
            }

        # ── SATIŞ ─────────────────────────────────────────────────────────────
        elif position is not None:
            if price > position["peak"]:
                position["peak"] = price

            drop        = (position["peak"] - price) / position["peak"] * 100
            profit_pct  = (price - position["entry"]) / position["entry"] * 100
            hold_bars   = i - position["bar"]
            cur_atr     = float(row["atr_pct"]) if not np.isnan(row["atr_pct"]) else position["atr_pct"]
            avg_atr     = (position["atr_pct"] + cur_atr) / 2
            trail       = max(1.5, min(10.0, avg_atr * params.get("atr_mult", 2.5)))

            reason = None
            if profit_pct >= params.get("tp", 5.0):
                reason = "TAKE"
            elif drop >= trail:
                reason = "ATR"
            elif hold_bars >= MAX_HOLD_BARS:
                reason = "TIMEOUT"
            elif score < params.get("sell", 52):
                reason = "SCORE"

            if reason:
                sp  = price * (1 - COMMISSION)
                bp  = position["entry"] * (1 + COMMISSION)
                pnl = (sp - bp) * position["qty"]
                balance += pnl
                trades.append({
                    "pnl": round(pnl, 2),
                    "pnl_pct": round((sp-bp)/bp*100, 2),
                    "hold": hold_bars,
                    "reason": reason,
                    "regime": regime,
                })
                last_exit = i
                position  = None

    if not trades:
        return None

    wins   = [t for t in trades if t["pnl"] > 0]
    losses = [t for t in trades if t["pnl"] <= 0]
    wr     = len(wins) / len(trades) * 100
    aw     = np.mean([t["pnl_pct"] for t in wins])   if wins   else 0
    al     = np.mean([t["pnl_pct"] for t in losses]) if losses else 0
    exp    = (wr/100 * aw) - ((1-wr/100) * abs(al))
    rr     = abs(aw/al) if al else 999

    return {
        "symbol":     symbol,
        "n_trades":   len(trades),
        "win_rate":   round(wr, 1),
        "total_pnl":  round(balance, 2),
        "expectancy": round(exp, 3),
        "rr":         round(rr, 2),
        "trades":     trades,
    }


# ── YAZDIRMA ─────────────────────────────────────────────────────────────────
def print_comparison(base_results, ml_results):
    print("\n" + "=" * 95)
    print("  KARŞILAŞTIRMA: Temel Strateji vs ML Filtreli")
    print("=" * 95)
    print("  %-12s │ %6s %6s %10s %8s %7s │ %6s %6s %10s %8s %7s" % (
        "", "İŞLEM", "WIN%", "PNL", "R/R", "BEKL.",
        "İŞLEM", "WIN%", "PNL", "R/R", "BEKL."))
    print("  %-12s │ %36s │ %36s" % ("SEMBOL", "── TEMEL ──────────────────────", "── ML FİLTRELİ ──────────────────"))
    print("-" * 95)

    base_total_pnl = 0; ml_total_pnl = 0
    base_total_n = 0;   ml_total_n = 0
    all_base_wins = 0;  all_ml_wins = 0

    symbols = sorted(set([r["symbol"] for r in base_results] + [r["symbol"] for r in ml_results]))
    for sym in symbols:
        b = next((r for r in base_results if r["symbol"] == sym), None)
        m = next((r for r in ml_results   if r["symbol"] == sym), None)
        bs = f"{b['n_trades']:6d} {b['win_rate']:5.1f}% {b['total_pnl']:+9.2f}$ {b['rr']:5.2f}  {b['expectancy']:+6.2f}%" if b else " "*37
        ms = f"{m['n_trades']:6d} {m['win_rate']:5.1f}% {m['total_pnl']:+9.2f}$ {m['rr']:5.2f}  {m['expectancy']:+6.2f}%" if m else " "*37
        arrow = "↑" if m and b and m["total_pnl"] > b["total_pnl"] else ("↓" if m and b else " ")
        print(f"  {sym:<12} │ {bs} │ {ms}  {arrow}")
        if b:
            base_total_pnl += b["total_pnl"]
            base_total_n   += b["n_trades"]
            all_base_wins  += sum(1 for t in b["trades"] if t["pnl"]>0)
        if m:
            ml_total_pnl += m["total_pnl"]
            ml_total_n   += m["n_trades"]
            all_ml_wins  += sum(1 for t in m["trades"] if t["pnl"]>0)

    base_wr_all = all_base_wins/base_total_n*100 if base_total_n else 0
    ml_wr_all   = all_ml_wins/ml_total_n*100     if ml_total_n   else 0
    print("-" * 95)
    print("  %-12s │ %6d %5.1f%% %+9.2f$                │ %6d %5.1f%% %+9.2f$" % (
        "TOPLAM", base_total_n, base_wr_all, base_total_pnl,
        ml_total_n, ml_wr_all, ml_total_pnl))
    print("=" * 95)

    delta = ml_total_pnl - base_total_pnl
    print(f"\n  ML Filtresi Etkisi: {delta:+.2f}$ ({'+' if delta>0 else ''}{delta/abs(base_total_pnl)*100:.1f}%)")
    if ml_total_pnl > 0:
        print("  [BAŞARILI] ML filtresi pozitif PnL üretti — canlı uygulamaya hazır!")
    elif ml_total_pnl > base_total_pnl:
        print("  [İYİLEŞME] ML filtresi zararı azalttı — daha fazla veriyle iyileşecek.")
    else:
        print("  [YETERSIZ] ML filtresi yardımcı olmadı — feature engineering gerekiyor.")


def print_feature_importance(model):
    print("\n  ÖNEMLİ SİNYALLER (hangi indikatör ne kadar etkili):")
    imp = dict(zip(FEATURE_NAMES, model.feature_importances_))
    imp = sorted(imp.items(), key=lambda x: -x[1])
    for feat, val in imp[:10]:
        bar = "█" * int(val * 60)
        print(f"  {feat:>14}: {bar} {val:.3f}")


# ── ANA AKIŞ ─────────────────────────────────────────────────────────────────
def main():
    print("\n" + "=" * 70)
    print("  ANTIGRAVITY AI — ML-ENHANCED BACKTEST v1.0")
    print("=" * 70)
    print(f"  Eğitim: İlk {TRAIN_DAYS} gün  |  Test: Son {TEST_DAYS} gün")
    print(f"  WIN hedefi: +{WIN_TARGET}%  |  STOP: -{LOSS_STOP}%  |  ML eşiği: {ML_THRESHOLD}")
    print(f"  Semboller: {len(SYMBOLS)}\n")

    # ── 1. VERİ ÇEKME ─────────────────────────────────────────────────────────
    all_data = {}
    for sym in SYMBOLS:
        print(f"  [{sym}] veri çekiliyor...", end=" ", flush=True)
        try:
            df = fetch_ohlcv(sym, LOOKBACK_DAYS)
            df = compute_indicators(df)
            all_data[sym] = df.dropna().reset_index(drop=True)
            n  = len(all_data[sym])
            print(f"{n} mum OK")
            time.sleep(0.3)
        except Exception as e:
            print(f"HATA: {e}")

    if not all_data:
        print("  Veri çekilemedi."); return

    # Bar sayısına göre split noktası (gün -> bar)
    # Her günde 6 bar (4h), tahminen
    bars_per_day = 6
    train_bars   = TRAIN_DAYS * bars_per_day   # ~6120
    test_start   = train_bars

    # ── 2. EĞİTİM VERİSİ ─────────────────────────────────────────────────────
    print(f"\n  Eğitim verisi hazırlanıyor (bar 0–{train_bars})...")
    X_all, y_all = [], []
    for sym, df in all_data.items():
        X, y, _ = build_dataset(sym, df, 0, train_bars)
        X_all.extend(X)
        y_all.extend(y)
        print(f"  [{sym}] {len(X)} aday sinyal — WIN: {sum(y)}/{len(y)} "
              f"({sum(y)/len(y)*100:.1f}%)" if y else f"  [{sym}] sinyal yok")

    if len(X_all) < 50:
        print("  Yeterli eğitim verisi yok — daha fazla tarihsel veri gerekli.")
        return

    X_arr = np.array(X_all, dtype=np.float32)
    y_arr = np.array(y_all, dtype=np.int32)
    print(f"\n  Toplam eğitim örneği: {len(X_arr)} — WIN oranı: {y_arr.mean()*100:.1f}%")

    # ── 3. MODEL EĞİTİMİ ─────────────────────────────────────────────────────
    print(f"\n  XGBoost modeli eğitiliyor...")
    model = train_ml_model(X_arr, y_arr)

    # Cross-validation (eğitim seti üzerinde)
    try:
        cv = cross_val_score(
            xgb.XGBClassifier(n_estimators=100, max_depth=4,
                               learning_rate=0.05, verbosity=0,
                               random_state=42, eval_metric="logloss"),
            X_arr, y_arr, cv=5, scoring="roc_auc"
        )
        print(f"  CV ROC-AUC: {cv.mean():.3f} ± {cv.std():.3f}")
        if cv.mean() < 0.52:
            print("  UYARI: Model neredeyse rastgele tahmin yapıyor.")
            print("  Daha fazla veri veya farklı özellikler gerekebilir.")
    except Exception:
        pass

    print_feature_importance(model)

    # ── 4. BACKTEST (TEST DÖNEMİ) ─────────────────────────────────────────────
    print(f"\n  Backtest çalışıyor (bar {test_start}+, yani son {TEST_DAYS} gün)...")
    base_results = []
    ml_results   = []
    for sym, df in all_data.items():
        b = run_backtest_with_ml(sym, df, test_start, len(df), ml_model=None)
        m = run_backtest_with_ml(sym, df, test_start, len(df), ml_model=model)
        if b: base_results.append(b)
        if m: ml_results.append(m)

    if not base_results:
        print("  Test döneminde işlem oluşmadı."); return

    # ── 5. SONUÇLAR ───────────────────────────────────────────────────────────
    print_comparison(base_results, ml_results)

    # Modeli kaydet
    model.save_model("signal_filter.json")
    meta = {
        "trained_at":     datetime.now().strftime("%Y-%m-%d %H:%M"),
        "feature_names":  FEATURE_NAMES,
        "ml_threshold":   ML_THRESHOLD,
        "win_target_pct": WIN_TARGET,
        "loss_stop_pct":  LOSS_STOP,
        "label_window":   LABEL_WINDOW,
        "train_samples":  len(X_arr),
        "feature_importance": {n: round(float(v), 4)
                                for n, v in zip(FEATURE_NAMES, model.feature_importances_)},
    }
    with open("signal_filter_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n  Model kaydedildi: signal_filter.json")
    print(f"  Metadata: signal_filter_meta.json")
    print(f"\n  SONRAKI ADIM: backend.py signal_filter.json dosyasını yükleyip")
    print(f"  her alım sinyalini ML modeline sorabilir. Eklememi ister misin?\n")


if __name__ == "__main__":
    main()
