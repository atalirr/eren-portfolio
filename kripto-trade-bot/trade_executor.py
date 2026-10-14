import os
import time
import math
import asyncio
import requests as _requests
import ccxt
import numpy as np
from rich.console import Console
import state_manager

console = Console()

_usdt_try_rate = 0.0  # Başlangıçta 0 — ilk ticker çekiminde güncellenecek

def get_usdt_try_rate() -> float:
    """Güncel USDT/TRY kurunu döner. Henüz çekilememişse Binance'ten anında çeker."""
    global _usdt_try_rate
    if _usdt_try_rate <= 0:
        # İlk çağrıda kuru hemen çek (fallback'e düşmemek için)
        try:
            import requests as _req
            resp = _req.get('https://api.binance.com/api/v3/ticker/price?symbol=USDTTRY', timeout=5)
            _usdt_try_rate = float(resp.json().get('price', 0))
            if _usdt_try_rate > 0:
                state_manager.add_log(f"KUR: USDT/TRY = {_usdt_try_rate:.2f} (başlangıç)")
        except Exception:
            _usdt_try_rate = 38.0  # Son çare fallback
            state_manager.add_log("KUR-UYARI: Kur çekilemedi, geçici fallback kullanılıyor")
    return _usdt_try_rate

async def refresh_usdt_try_rate():
    """Binance'ten güncel USDT/TRY kurunu çek."""
    global _usdt_try_rate
    try:
        ticker = await asyncio.to_thread(public_exchange.fetch_ticker, "USDT/TRY")
        new_rate = ticker.get("last", 0)
        if new_rate > 0:
            _usdt_try_rate = new_rate
            state_manager.add_log(f"KUR: USDT/TRY = {_usdt_try_rate:.2f}")
    except Exception as e:
        state_manager.add_log(f"KUR-HATA: USDT/TRY güncellenemedi: {e}")

RISK_PER_TRADE_PCT   = 0.010
MIN_TRADE_TRY        = 500.0
MAX_TRADE_TRY        = 10000.0
CIRCUIT_BREAKER_PCT  = 0.04

circuit_breaker_active = False
btc_price_1h_ago     = 0.0

api_key      = os.getenv('BINANCE_API_KEY', '').strip()
api_secret   = os.getenv('BINANCE_SECRET_KEY', '').strip()
paper_trading= os.getenv('PAPER_TRADING', 'false').lower() == 'true'
has_keys     = bool(api_key and api_secret) and not paper_trading

BINANCE_ENDPOINTS = [
    'https://api.binance.com/api/v3',
    'https://api.binance.me/api/v3',
    'https://api1.binance.com/api/v3',
    'https://api2.binance.com/api/v3',
    'https://api3.binance.com/api/v3',
]
current_endpoint_idx = 0

# public_exchange: Piyasa verisi için
public_exchange = ccxt.binance({
    'enableRateLimit': True,
    'options': {'defaultType': 'spot'},
    'timeout': 30000,
})

# exchange: Emir göndermek için (simülasyonda kullanılmaz)
exchange = ccxt.binance({
    'apiKey': api_key if has_keys else None,
    'secret': api_secret if has_keys else None,
    'enableRateLimit': True,
    'options': {'defaultType': 'spot'},
    'timeout': 30000,
})

def rotate_endpoint(ex):
    global current_endpoint_idx
    current_endpoint_idx = (current_endpoint_idx + 1) % len(BINANCE_ENDPOINTS)
    new_url = BINANCE_ENDPOINTS[current_endpoint_idx]
    ex.urls['api']['public'] = new_url
    ex.urls['api']['private'] = new_url
    return new_url

_cached_tickers_data = {}
_last_ticker_time = 0
TICKER_CACHE_TTL = 20

async def fetch_all_tickers_24hr():
    global _cached_tickers_data, _last_ticker_time, current_endpoint_idx, _usdt_try_rate
    
    now = time.time()
    if _cached_tickers_data and (now - _last_ticker_time) < TICKER_CACHE_TTL:
        return _cached_tickers_data

    for attempt in range(len(BINANCE_ENDPOINTS)):
        url = f"{BINANCE_ENDPOINTS[current_endpoint_idx]}/ticker/24hr"
        try:
            resp = await asyncio.to_thread(_requests.get, url, timeout=15)
            
            if resp.status_code == 418:
                console.print(f"[bold red]RATE-LIMIT: {url} IP engellendi (418). Endpoint değiştiriliyor...[/bold red]")
                current_endpoint_idx = (current_endpoint_idx + 1) % len(BINANCE_ENDPOINTS)
                await asyncio.sleep(2)
                continue
                
            resp.raise_for_status()
            raw = resp.json()
            tickers = {}
            for t in raw:
                sym = t.get("symbol", "")
                if sym == "USDTTRY":
                    try:
                        _new_rate = float(t.get("lastPrice") or 0)
                        if _new_rate > 0:
                            _usdt_try_rate = _new_rate
                    except Exception as _e:
                        state_manager.add_log(f"KUR-PARSE-HATA: USDTTRY parse edilemedi: {_e}")
                if not sym.endswith("USDT"): continue
                ccxt_sym = f"{sym[:-4]}/USDT"
                tickers[ccxt_sym] = {
                    "symbol": ccxt_sym,
                    "last": float(t.get("lastPrice") or 0),
                    "quoteVolume": float(t.get("quoteVolume") or 0),
                    "percentage": float(t.get("priceChangePercent") or 0),
                }
            
            _cached_tickers_data = tickers
            _last_ticker_time = now
            return tickers
            
        except Exception as e:
            console.print(f"[yellow]Ticker çekme hatası ({BINANCE_ENDPOINTS[current_endpoint_idx]}):[/yellow]", str(e)[:50])
            current_endpoint_idx = (current_endpoint_idx + 1) % len(BINANCE_ENDPOINTS)
            await asyncio.sleep(1)

    return _cached_tickers_data or {}

_cached_funding_data = {}
_last_funding_time = 0
FUNDING_CACHE_TTL = 300  # 5 dakika

async def fetch_all_funding_rates():
    global _cached_funding_data, _last_funding_time
    
    now = time.time()
    if _cached_funding_data and (now - _last_funding_time) < FUNDING_CACHE_TTL:
        return _cached_funding_data

    url = "https://fapi.binance.com/fapi/v1/premiumIndex"
    try:
        resp = await asyncio.to_thread(_requests.get, url, timeout=10)
        resp.raise_for_status()
        raw = resp.json()
        rates = {}
        for item in raw:
            sym = item.get("symbol", "")
            if sym.endswith("USDT"):
                ccxt_sym = f"{sym[:-4]}/USDT"
                rates[ccxt_sym] = float(item.get("lastFundingRate") or 0)
        
        _cached_funding_data = rates
        _last_funding_time = now
        return rates
    except Exception as e:
        console.print("[yellow]Funding rate çekme hatası:[/yellow]", str(e)[:50])
        return _cached_funding_data or {}

async def init_exchanges():
    for i, ep in enumerate(BINANCE_ENDPOINTS):
        try:
            public_exchange.urls['api']['public'] = ep
            public_exchange.urls['api']['private'] = ep
            await asyncio.to_thread(public_exchange.load_markets)
            console.print(f"[bold green]Market verisi yüklendi ({ep.split('/')[2]})[/bold green]")
            break
        except Exception as e:
            console.print(f"[dim]Endpoint {ep.split('/')[2]} başarısız:[/dim]", str(e)[:40])
            if i == len(BINANCE_ENDPOINTS) - 1:
                console.print("[bold red]TÜM ENDPOINT'LER BAŞARISIZ[/bold red]")

    if has_keys:
        try:
            await asyncio.to_thread(exchange.load_markets)
            console.print("[green]Emir exchange'i hazır[/green]")
        except Exception as e:
            console.print(f"[yellow]Emir exchange yüklenemedi (simülasyon devam eder):[/yellow]", str(e)[:40])

if has_keys:
    console.print("[bold red]API ANAHTARI MEVCUT — Gerçek emir gönderme aktif[/bold red]")
else:
    console.print("[bold yellow]PAPER TRADING — Simülasyon modu (API anahtarı yok)[/bold yellow]")

def clean_data(obj):
    if isinstance(obj, dict):  return {k: clean_data(v) for k, v in obj.items()}
    if isinstance(obj, list):  return [clean_data(i) for i in obj]
    if isinstance(obj, (np.integer, np.floating)): return float(obj)
    if isinstance(obj, (np.bool_, bool)): return bool(obj)
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)): return 0
    return obj

def calculate_position_size(price: float, atr_pct: float, risk_override: float = None, conf_mult: float = 1.0) -> float:
    start_bal_try = state_manager.db.get("start_balance", 50000.0)  # TL cinsinden
    realized_usd  = state_manager.db.get("total_pnl", 0.0)          # USDT cinsinden
    rate          = get_usdt_try_rate()
    realized_try  = realized_usd * rate
    
    # Kumbara (kilitli kâr) bakiyesini toplam değerden düş
    vault_usd     = state_manager.db.get("profit_vault", 0.0)
    vault_try     = vault_usd * rate
    
    total_val_try = max(start_bal_try + realized_try - vault_try, MIN_TRADE_TRY * 2)
    fleet         = state_manager.bot_settings.get("fleet_state", {})
    used_usd      = sum(v.get("entry", 0) * v.get("qty", 0) for v in fleet.values())
    used_try      = used_usd * rate
    
    # Serbest nakit bakiye hesabı (TL) — kumbara zaten toplam değerden düşüldü
    free_cash_try = max(0.0, total_val_try - used_try)
    
    min_limit = max(MIN_TRADE_TRY, 11.0 * rate)
    if free_cash_try < min_limit:
        state_manager.add_log(f"INSUFFICIENT-FUNDS: Serbest bakiye yetersiz ({free_cash_try:.2f} ₺ < {min_limit:.2f} ₺)")
        return 0.0
    
    active_risk   = risk_override if risk_override is not None else RISK_PER_TRADE_PCT
    # Scale risk amount by the confidence multiplier
    risk_amount_try = total_val_try * active_risk * conf_mult
    
    stop_dist     = max(atr_pct / 100.0, 0.01)
    position_try  = risk_amount_try / stop_dist
    
    # Scale maximum limit by confidence multiplier
    max_limit = MAX_TRADE_TRY * conf_mult
    
    position_try = max(min_limit, min(max_limit, position_try))
    # Serbest nakit bakiyeyi ASLA aşamaz!
    position_try = min(position_try, free_cash_try)
    
    price_try = price * rate
    return position_try / price_try if price_try > 0 else 0

async def circuit_breaker_monitor():
    global circuit_breaker_active, btc_price_1h_ago
    while True:
        try:
            ticker  = await asyncio.to_thread(public_exchange.fetch_ticker, "BTC/USDT")
            btc_now = ticker.get("last", 0)
            if btc_price_1h_ago > 0 and btc_now > 0:
                drop = (btc_price_1h_ago - btc_now) / btc_price_1h_ago
                if drop >= CIRCUIT_BREAKER_PCT and not circuit_breaker_active:
                    circuit_breaker_active = True
                    state_manager.bot_settings["market_halt"] = True
                    state_manager.add_log(f"CIRCUIT-BREAKER: BTC {drop*100:.1f}% düştü — alımlar durduruldu!")
                elif drop < CIRCUIT_BREAKER_PCT * 0.5 and circuit_breaker_active:
                    circuit_breaker_active = False
                    state_manager.bot_settings["market_halt"] = False
                    state_manager.add_log("CIRCUIT-BREAKER: Piyasa toparlandı — alımlar yeniden aktif")
            btc_price_1h_ago = btc_now
        except Exception as e:
            state_manager.add_log(f"CIRCUIT-BREAKER-ERROR: {e}")
            btc_price_1h_ago = 0.0
        await asyncio.sleep(3600)


async def execute_order_smart(symbol: str, side: str, qty: float) -> tuple[bool, float]:
    """
    Akıllı Limit Emir (Chase & Fill) Yürütme Algoritması.
    Simülasyon modunda anlık alış/satış fiyatından işlem yapar (True, price).
    Canlı modda limit emir gönderir, 15 saniye takip eder, satım doldurulamazsa piyasa emrine döner.
    """
    tickers = await fetch_all_tickers_24hr()
    price = tickers.get(symbol, {}).get("last", 0.0)
    if price <= 0:
        return False, 0.0

    if qty is None or qty <= 0:
        state_manager.add_log(f"ORDER-SKIP: {symbol} {side} geçersiz miktar ({qty})")
        return False, 0.0

    # Minimum $10 emir kontrolü (Binance MIN_NOTIONAL kuralı)
    notional = qty * price
    if notional < 10.0:
        state_manager.add_log(f"ORDER-SKIP: {symbol} {side} min notional altı (${notional:.2f} < $10)")
        return False, 0.0

    if not has_keys:
        # Simülasyon modunda slippage ekleyerek daha gerçekçi fiyat
        slippage = 0.001  # %0.1 spread simülasyonu
        sim_price = price * (1 + slippage) if side == 'buy' else price * (1 - slippage)
        state_manager.add_log(f"SIMULATED {side.upper()} SMART: {symbol} @ ${sim_price:.6f} (Miktar: {qty:.6f})")
        return True, sim_price

    # Canlı mod
    try:
        order_book = await asyncio.to_thread(public_exchange.fetch_order_book, symbol, limit=5)
        bids = order_book.get("bids", [])
        asks = order_book.get("asks", [])
        if not bids or not asks:
            # Emir defteri boşsa piyasa emri ver
            state_manager.add_log(f"ORDER_BOOK_EMPTY: {symbol} için tahta boş. Market emrine geçiliyor.")
            qty_p = exchange.amount_to_precision(symbol, qty)
            order = await asyncio.to_thread(exchange.create_market_order, symbol, side, qty_p)
            return True, float(order.get("price") or order.get("average") or price)

        b1, a1 = bids[0][0], asks[0][0]
        qty_p = exchange.amount_to_precision(symbol, qty)

        if side == "buy":
            # Best bid'in %10 üstü (Spread arası öncelik)
            p = b1 + 0.10 * (a1 - b1)
            p = float(exchange.price_to_precision(symbol, p))
            
            # Kayma Koruması (%0.2 tavan)
            if p > a1 * 1.002:
                p = a1 * 1.002
                p = float(exchange.price_to_precision(symbol, p))
                
            state_manager.add_log(f"LIMIT BUY PLACE: {symbol} @ ${p:.6f} (Market: ${a1:.6f})")
            order = await asyncio.to_thread(exchange.create_limit_buy_order, symbol, qty_p, p)
            
            # 15 saniye izle
            for _ in range(30):
                await asyncio.sleep(0.5)
                o_status = await asyncio.to_thread(exchange.fetch_order, order["id"], symbol)
                if o_status.get("status") == "closed":
                    avg_p = float(o_status.get("average") or o_status.get("price") or p)
                    return True, avg_p
            
            # Dolmadıysa iptal et (Alım kaçtıysa girmemek daha güvenlidir)
            try:
                await asyncio.to_thread(exchange.cancel_order, order["id"], symbol)
                state_manager.add_log(f"LIMIT BUY TIMEOUT: {symbol} dolmadı, iptal edildi.")
            except Exception as _cancel_err:
                state_manager.add_log(f"CANCEL-HATA: {symbol} BUY iptal edilemedi: {_cancel_err}")
            
            # Kısmi dolum kontrolü
            o_final = await asyncio.to_thread(exchange.fetch_order, order["id"], symbol)
            filled = float(o_final.get("filled", 0.0))
            if filled > 0:
                avg_p = float(o_final.get("average") or o_final.get("price") or p)
                state_manager.add_log(f"LIMIT BUY PARTIAL FILL: {symbol} kısmi dolum: {filled:.6f} @ ${avg_p:.6f}")
                return True, avg_p
            return False, 0.0

        else: # sell
            # Best ask'ın %10 altı (Spread arası öncelik)
            p = a1 - 0.10 * (a1 - b1)
            p = float(exchange.price_to_precision(symbol, p))
            
            # Kayma Koruması (%0.2 taban)
            if p < b1 * 0.998:
                p = b1 * 0.998
                p = float(exchange.price_to_precision(symbol, p))
                
            state_manager.add_log(f"LIMIT SELL PLACE: {symbol} @ ${p:.6f} (Market: ${b1:.6f})")
            order = await asyncio.to_thread(exchange.create_limit_sell_order, symbol, qty_p, p)
            
            # 15 saniye izle
            for _ in range(30):
                await asyncio.sleep(0.5)
                o_status = await asyncio.to_thread(exchange.fetch_order, order["id"], symbol)
                if o_status.get("status") == "closed":
                    avg_p = float(o_status.get("average") or o_status.get("price") or p)
                    return True, avg_p
            
            # Dolmadıysa emri iptal et
            try:
                await asyncio.to_thread(exchange.cancel_order, order["id"], symbol)
                state_manager.add_log(f"LIMIT SELL TIMEOUT: {symbol} iptal edildi, market emrine geçiliyor.")
            except Exception as _cancel_err:
                state_manager.add_log(f"CANCEL-HATA: {symbol} SELL iptal edilemedi: {_cancel_err}")
            
            # Kalan miktarı öğren
            o_final = await asyncio.to_thread(exchange.fetch_order, order["id"], symbol)
            filled = float(o_final.get("filled", 0.0))
            remaining = float(o_final.get("remaining", qty))
            
            if remaining > 0:
                # Satış emri dolmak ZORUNDADIR (Stop Loss / Take Profit garantisi)
                # Kalan miktar için Market Order (Piyasa Emri) veriyoruz
                state_manager.add_log(f"LIMIT SELL TIMEOUT: {symbol} doldurulamadı. Kalan {remaining:.6f} için market emrine geçiliyor!")
                rem_p = exchange.amount_to_precision(symbol, remaining)
                m_order = await asyncio.to_thread(exchange.create_market_order, symbol, 'sell', rem_p)
                m_price = float(m_order.get("price") or m_order.get("average") or price)
                
                # Ağırlıklı ortalama satış fiyatı hesapla
                avg_p = (filled * float(o_final.get("average") or p) + remaining * m_price) / qty
                return True, avg_p
            
            avg_p = float(o_final.get("average") or o_final.get("price") or p)
            return True, avg_p

    except Exception as e:
        state_manager.add_log(f"SMART-ORDER-ERROR: {symbol} {side.upper()} başarısız: {e}")
        # Hata durumunda satış işleminin iptal olmaması için market emriyle çıkış yapmayı dene
        if side == "sell":
            try:
                state_manager.add_log(f"SMART-ORDER-FALLBACK: {symbol} SELL acil market emri veriliyor.")
                qty_p = exchange.amount_to_precision(symbol, qty)
                order = await asyncio.to_thread(exchange.create_market_order, symbol, 'sell', qty_p)
                return True, float(order.get("price") or order.get("average") or price)
            except Exception as ex:
                state_manager.add_log(f"SMART-ORDER-FALLBACK-CRITICAL: {symbol} acil market emri de başarısız: {ex}")
        return False, 0.0
