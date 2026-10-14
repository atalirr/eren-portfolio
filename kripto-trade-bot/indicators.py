import pandas as pd
import numpy as np

def calculate_rsi(close, period=14):
    delta = close.diff()
    gain  = delta.where(delta > 0, 0).ewm(alpha=1/period, adjust=False).mean()
    loss  = (-delta.where(delta < 0, 0)).ewm(alpha=1/period, adjust=False).mean()
    rs    = gain / (loss + 1e-9)
    return 100 - (100 / (1 + rs))

def calculate_adx(df, period=14):
    high, low, close = df['high'], df['low'], df['close']
    up_move   = high.diff()
    down_move = -low.diff()  # prev_low - current_low: pozitif = düşen dipler (bearish)
    plus_dm   = up_move.where((up_move > down_move) & (up_move > 0), 0)
    minus_dm  = down_move.where((down_move > up_move) & (down_move > 0), 0)
    
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low  - close.shift()).abs()
    ], axis=1).max(axis=1)
    
    atr      = tr.ewm(alpha=1/period, adjust=False).mean()
    plus_di  = 100 * plus_dm.ewm(alpha=1/period, adjust=False).mean()  / (atr + 1e-9)
    minus_di = 100 * minus_dm.ewm(alpha=1/period, adjust=False).mean() / (atr + 1e-9)
    dx       = (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-9) * 100
    adx_val  = dx.ewm(alpha=1/period, adjust=False).mean()
    return adx_val, plus_di, minus_di, atr

def calculate_stoch_rsi(rsi, period=14):
    mn    = rsi.rolling(period).min()
    mx    = rsi.rolling(period).max()
    stoch = (rsi - mn) / (mx - mn + 1e-9) * 100
    k     = stoch.rolling(3).mean()
    d     = k.rolling(3).mean()
    return k, d

def compute_all_indicators(df):
    """
    Computes all standard technical indicators on a DataFrame with 'open', 'high', 'low', 'close', 'volume' columns.
    Modifies the DataFrame in-place and returns it.
    """
    close  = df['close']
    volume = df['volume']

    df['rsi'] = calculate_rsi(close, 14)
    df['stoch_k'], df['stoch_d'] = calculate_stoch_rsi(df['rsi'])
    df['ema9']             = close.ewm(span=9,   adjust=False).mean()
    df['ema20']            = close.ewm(span=20,  adjust=False).mean()
    df['ema50']            = close.ewm(span=50,  adjust=False).mean()
    df['ema200']           = close.ewm(span=200, adjust=False).mean()
    
    ema12                  = close.ewm(span=12, adjust=False).mean()
    ema26                  = close.ewm(span=26, adjust=False).mean()
    df['macd']             = ema12 - ema26
    df['macd_sig']         = df['macd'].ewm(span=9, adjust=False).mean()
    df['macd_hist']        = df['macd'] - df['macd_sig']
    
    sma20                  = close.rolling(20).mean()
    std20                  = close.rolling(20).std()
    df['bb_up']            = sma20 + 2 * std20
    df['bb_lo']            = sma20 - 2 * std20
    df['bb_pct']           = (close - df['bb_lo']) / (df['bb_up'] - df['bb_lo'] + 1e-9)
    
    sma30                  = close.rolling(30).mean()
    std30                  = close.rolling(30).std()
    df['z_score']          = (close - sma30) / (std30 + 1e-9)
    
    df['adx'], df['plus_di'], df['minus_di'], df['atr'] = calculate_adx(df, 14)
    df['atr_pct']          = df['atr'] / (close + 1e-9) * 100
    df['vol_ema']          = volume.ewm(span=20, adjust=False).mean()
    df['vol_ratio']        = volume / (df['vol_ema'] + 1e-9)
    
    return df
