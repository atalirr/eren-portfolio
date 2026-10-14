import os
import time
import json
import math
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from rich.console import Console

import state_manager
import trade_executor
import radar_loop
from scoring_engine import TechnicalScoringEngine
from telegram_module import notifier

console = Console()
console.print("[bold cyan]BACKEND BAŞLIYOR...[/bold cyan]")

_telegram_listener_started = False
backtest_running = False
BACKTEST_RESULTS_FILE = "backtest_results.json"
SIGNAL_LOG_FILE = "signal_log.json"

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _telegram_listener_started
    await trade_executor.init_exchanges()
    
    # Botun açıldığını Telegram'a bildir
    mode = "LIVE" if trade_executor.has_keys else "SIMULATED"
    notifier.send_message(f"🤖 *ANTIGRAVITY AI BAŞLATILDI*\n\n🔹 Mod: `{mode}`\n🔹 Durum: `AKTİF`\n🔹 Piyasalar: `BAĞLANDI` \n🔹 PID: `{os.getpid()}`\n\n_Bol kazançlar dilerim!_")
    
    # Görevleri Başlat
    asyncio.create_task(radar_loop.run_market_radar())
    asyncio.create_task(trade_executor.circuit_breaker_monitor())
    asyncio.create_task(radar_loop.signal_tracker_task())
    asyncio.create_task(radar_loop.copy_trader_task())
    asyncio.create_task(radar_loop.macro_refresh_task())
    asyncio.create_task(radar_loop.scanner_refresh_task())
    asyncio.create_task(radar_loop.daily_report_task())
    asyncio.create_task(radar_loop.weekly_report_task())
    asyncio.create_task(radar_loop.billing_reminder_task())
    asyncio.create_task(radar_loop.auto_train_ml_task())
    
    # Telegram Komut Dinleyici
    if not _telegram_listener_started:
        asyncio.create_task(notifier.handle_commands(radar_loop.telegram_command_handler))
        _telegram_listener_started = True
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# ============================================================
# API ENDPOINT'LERİ
# ============================================================
@app.get("/get-status")
async def get_status():
    try:
        tickers = await trade_executor.fetch_all_tickers_24hr()
        start_bal      = state_manager.db.get("start_balance", 50000.0)  # TL cinsinden
        realized_pnl   = state_manager.db.get("total_pnl", 0.0)          # USDT cinsinden
        unrealized_pnl = 0.0
        allocated      = 0.0
        rate           = trade_executor.get_usdt_try_rate()               # 1 USDT = X TL

        for symbol, state in state_manager.bot_settings["fleet_state"].items():
            if symbol in tickers:
                curr_price = tickers[symbol].get('last', 0)
                if curr_price and curr_price > 0:
                    entry           = state.get('entry', 0)
                    qty             = state.get('qty', 0)
                    unrealized_pnl += (curr_price - entry) * qty
                    allocated      += entry * qty

        # Cüzdan ve Varlık Bilgilerini Çek
        wallet_data = await get_wallet()
        full_wallet = wallet_data.get("managed", []) + wallet_data.get("other", [])
        usdt_bal = wallet_data.get("balances", {}).get("USDT", 0)

        # TOPLAM DEĞER HESABI — start_bal TL, PnL USD → TL'ye çevir
        pnl_try            = (realized_pnl + unrealized_pnl) * rate
        virtual_total_val  = round(start_bal + pnl_try, 2)
        allocated          = sum(item.get("value", 0) for item in wallet_data.get("managed", []))

        roi = round(((virtual_total_val - start_bal) / start_bal) * 100, 2) if start_bal > 0 else 0
        state_manager.last_total_val = virtual_total_val

        # Radar Snapshot
        picks = list(state_manager.radar_data["top_picks"])
        progress = state_manager.radar_data["progress"]
        radar_snapshot = {"top_picks": picks, "progress": progress}

        # Günlük İstatistikler
        today = state_manager.get_tr_now().strftime("%Y-%m-%d")
        daily_logs = [t for t in state_manager.db.get("trade_log", []) if t.get("date") == today]
        daily_buys = [t for t in daily_logs if t.get("side") == "BUY"]
        daily_sells = [t for t in daily_logs if t.get("side") in ["SELL", "SELL-ALL", "PARTIAL-SELL"]]
        daily_wins = [t for t in daily_sells if t.get("pnl", 0) > 0]
        daily_win_rate = round((len(daily_wins) / len(daily_sells) * 100), 1) if daily_sells else 0
        best_daily = round(max([t.get("pnl", 0) for t in daily_sells], default=0), 2)
        daily_pnl  = sum(t.get("pnl", 0) for t in daily_sells)

        return trade_executor.clean_data({
            "bot_active":         state_manager.bot_settings["active"],
            "personality":        state_manager.bot_settings.get("personality", "SWING_TRADER"),
            "radar":              radar_snapshot,
            "logs":               state_manager.system_logs,
            "career_roi":         roi,
            "active_units":       len(full_wallet),
            "allocated_capital":  round(allocated, 2),
            "total_val":          virtual_total_val,
            "start_bal":          start_bal,
            "realized_pnl":       round(realized_pnl * rate, 2),        # TL
            "realized_pnl_usd":   round(realized_pnl, 2),               # USD (bilgi amaçlı)
            "daily_pnl":          round(daily_pnl * rate, 2),           # TL
            "daily_pnl_usd":      round(daily_pnl, 2),                  # USD (bilgi amaçlı)
            "daily_buys":         len(daily_buys),
            "daily_sells":        len(daily_sells),
            "daily_win_rate":     daily_win_rate,
            "best_daily_pnl":     round(best_daily * rate, 2),          # TL
            "unrealized_pnl":     round(unrealized_pnl * rate, 2),      # TL
            "trailing_stop_pct":  radar_loop.DEFAULT_TRAILING_STOP,
            "max_positions":      radar_loop.MAX_OPEN_POSITIONS,
            "market_halt":        state_manager.bot_settings.get("market_halt", False),
            "circuit_breaker":    trade_executor.circuit_breaker_active,
            "risk_per_trade_pct": radar_loop.RISK_PER_TRADE_PCT * 100,
            "full_wallet":        full_wallet,
            "wallet":             {"USDT": usdt_bal},
            "usdt_try_rate":      trade_executor.get_usdt_try_rate()
        })
    except Exception as e:
        from rich.markup import escape as _rich_escape
        console.print(f"[bold red]Telemetry Hatası:[/bold red] {_rich_escape(str(e))}")
        picks = list(state_manager.radar_data["top_picks"])
        progress = state_manager.radar_data["progress"]
        radar_snapshot = {"top_picks": picks, "progress": progress}
        return trade_executor.clean_data({
            "error": str(e), "bot_active": state_manager.bot_settings["active"],
            "radar": radar_snapshot, "logs": state_manager.system_logs,
            "career_roi": 0, "active_units": len(state_manager.bot_settings["fleet_state"]),
            "total_val": state_manager.last_total_val, "start_bal": state_manager.db.get("start_balance", 50000.0),
            "trailing_stop_pct": radar_loop.DEFAULT_TRAILING_STOP,
            "usdt_try_rate": trade_executor.get_usdt_try_rate()
        })

@app.get("/demo-balance")
async def get_demo_balance():
    try:
        if not trade_executor.has_keys: return {"total_usdt": 0.0, "assets": {}}
        balance = await asyncio.to_thread(trade_executor.exchange.fetch_balance)
        return {"total_usdt": balance['total'].get('USDT', 0), "assets": balance['total']}
    except:
        return {"total_usdt": 0.0, "assets": {}}

@app.get("/trade-history/{symbol}")
async def get_trade_history(symbol: str):
    clean_symbol = symbol.replace("-", "/")
    return [t for t in state_manager.db.get("trade_log", []) if t.get("symbol") == clean_symbol][:50]

@app.get("/backtest/{symbol}")
async def backtest(symbol: str):
    import backtest_runner
    clean_symbol        = symbol.replace("-", "/")
    current_personality = state_manager.bot_settings.get("personality", "SWING_TRADER")
    backtest_runner.PERSONALITY = current_personality
    try:
        df = await asyncio.to_thread(backtest_runner.fetch_ohlcv, clean_symbol, 90)
    except Exception as e:
        return {"error": f"fetch_failed: {e}"}
    if df is None or df.empty or len(df) < 50:
        return {"error": "no_data"}
    try:
        df     = await asyncio.to_thread(backtest_runner.compute_indicators, df)
        result = await asyncio.to_thread(backtest_runner.run_backtest, clean_symbol, df)
        if not result or not result.get("trades"):
            return trade_executor.clean_data({"final_balance": 50000, "profit_pct": 0, "win_rate": 0, "total_trades": 0, "trades": []})
        trades     = result["trades"]
        total_pnl  = result["total_pnl"]
        _rate      = trade_executor.get_usdt_try_rate()
        _bt_start  = state_manager.db.get("start_balance", 50000.0)
        total_pnl_try = total_pnl * _rate
        profit_pct = round((total_pnl_try / max(_bt_start, 1)) * 100, 2)
        ui_trades  = []
        for t in trades:
            exit_t = t.get("exit_time", "")
            time_lbl = str(exit_t)[:16] if exit_t else ""
            pnl_usd = t.get("pnl", 0)
            pnl_try = pnl_usd * _rate
            ui_trades.append({"time": time_lbl, "type": t.get("reason","WIN" if pnl_usd>0 else "LOSS"),
                               "price": t.get("exit", 0), "profit": round(pnl_try, 2)})
        return trade_executor.clean_data({"final_balance": round(_bt_start + total_pnl_try, 2), "profit_pct": profit_pct,
                           "win_rate": result["win_rate"], "total_trades": result["total_trades"],
                           "trades": ui_trades[-50:], "personality": current_personality,
                           "regime_stats": result.get("regime_stats", {})})
    except Exception as e:
        return {"error": f"simulation_failed: {e}"}

@app.get("/get-wallet")
async def get_wallet():
    try:
        tickers      = await trade_executor.fetch_all_tickers_24hr()
        managed_list = []
        other_list   = []
        fleet        = state_manager.bot_settings["fleet_state"]
        usdt_bal     = 0.0
        
        if trade_executor.has_keys:
            try:
                balance = await asyncio.to_thread(trade_executor.exchange.fetch_balance)
                usdt_bal = balance['total'].get('USDT', 0.0)
                for k, v in balance['total'].items():
                    if v > 0 and k != 'USDT':
                        symbol = k + "/USDT"
                        if symbol in tickers:
                            price = tickers[symbol].get('last')
                            if price is None: continue
                            val = v * price
                            if val > 1.0:
                                ad = {"asset": k, "qty": v, "value": round(val,2), "price": price}
                                if symbol in fleet:
                                    entry  = fleet[symbol].get('entry', 0)
                                    et     = fleet[symbol].get('time', time.time())
                                    mq     = fleet[symbol].get('qty', v)
                                    fq     = min(v, mq)
                                    cost   = entry * fq
                                    pnl    = (price - entry) * fq if entry > 0 else 0
                                    secs   = int(time.time() - et)
                                    h, m   = secs//3600, (secs%3600)//60
                                    ad.update({"is_managed": True, "cost": round(cost,2),
                                               "pnl": round(pnl,2),
                                               "pnl_pct": round((pnl/cost)*100,2) if cost>0 else 0,
                                               "hold_time": f"{h}h {m}m" if h>0 else f"{m}m",
                                               "hard_stop": fleet[symbol].get("hard_stop", 0),
                                               "source": fleet[symbol].get("source", "SWING_TRADER")})
                                    managed_list.append(ad)
                                else:
                                    ad["is_managed"] = False
                                    other_list.append(ad)
            except Exception:
                pass

        if not managed_list:
            for symbol, state in fleet.items():
                if symbol in tickers:
                    price = tickers[symbol].get('last', 0)
                    if price and price > 0:
                        entry = state.get('entry', 0)
                        qty   = state.get('qty', 0)
                        cost  = round(entry * qty, 2)
                        value = round(price * qty, 2)
                        pnl   = round((price - entry) * qty, 2) if entry > 0 else 0
                        secs  = int(time.time() - state.get('time', state.get('time', time.time())))
                        h, m  = secs//3600, (secs%3600)//60
                        managed_list.append({
                            "asset":      symbol.split("/")[0],
                            "qty":        round(qty, 8),
                            "value":      value,
                            "cost":       cost,
                            "price":      round(price, 8),
                            "is_managed": True,
                            "pnl":        pnl,
                            "pnl_pct":    round((pnl/cost)*100, 2) if cost > 0 else 0,
                            "hold_time":  f"{h}h {m}m" if h > 0 else f"{m}m",
                            "hard_stop":  state.get("hard_stop", 0),
                            "source":     state.get("source", "SWING_TRADER"),
                        })
        total_pnl  = state_manager.db.get("total_pnl", 0.0)
        _rate      = trade_executor.get_usdt_try_rate()
        _start_bal = state_manager.db.get("start_balance", 50000.0)
        unrealized_pnl = sum(x.get("pnl", 0) for x in managed_list)
        total_val  = _start_bal + (float(total_pnl) + unrealized_pnl) * _rate   # TL cinsinden toplam değer (unrealized dahil)
        used       = sum(v["entry"] * v.get("qty", 0) for v in state_manager.bot_settings["fleet_state"].values())

        return {
            "managed":   sorted(managed_list, key=lambda x: x['value'], reverse=True),
            "other":     sorted(other_list,   key=lambda x: x['value'], reverse=True),
            "wallet":    {"total": round(total_val, 2), "used": round(used * _rate, 2), "free": round(max(total_val - used * _rate, 0), 2)},
            "total_pnl": round(total_pnl * _rate, 2),  # TL cinsinden realized PnL
            "balances":  {"USDT": usdt_bal if trade_executor.has_keys else (total_val / _rate) - used},
            "usdt_try_rate": trade_executor.get_usdt_try_rate()
        }
    except Exception as e:
        console.print("[dim]Cüzdan hatası:[/dim]", str(e))
        return {"managed": [], "other": [], "usdt_try_rate": trade_executor.get_usdt_try_rate()}

@app.websocket("/ws/ticker/{symbol}")
async def websocket_endpoint(websocket: WebSocket, symbol: str):
    await websocket.accept()
    clean_symbol = symbol.replace("-", "/")
    engine       = TechnicalScoringEngine(clean_symbol, exchange=trade_executor.public_exchange)
    errors       = 0
    try:
        while errors < 10:
            try:
                ticker = await asyncio.to_thread(trade_executor.public_exchange.fetch_ticker, clean_symbol)
                if not ticker or ticker.get('last') is None:
                    raise ValueError(f"Geçersiz ticker: {clean_symbol}")
                report = await asyncio.to_thread(engine.calculate_score)
                active = [v for v in state_manager.bot_settings["fleet_state"].values() if str(v.get('side','')).upper() in ['BUY', 'LONG'] or 'entry' in v]
                alloc  = sum(p.get('entry',0)*p.get('qty',0) for p in active)
                _r     = trade_executor.get_usdt_try_rate()
                _sb    = state_manager.db.get("start_balance", 50000.0)
                roi    = round((state_manager.db.get("total_pnl", 0.0) * _r / max(_sb, 1)) * 100, 2)
                picks  = list(state_manager.radar_data["top_picks"][:20])
                today  = state_manager.get_tr_now().strftime("%Y-%m-%d")
                daily_pnl = sum(t.get("pnl", 0) for t in state_manager.db.get("trade_log", []) if t.get("date") == today and t.get("side") in ["SELL", "SELL-ALL", "PARTIAL-SELL"])

                data = trade_executor.clean_data({
                    "symbol": symbol, "last": ticker.get('last'),
                    "ai_score": report, "bot_active": state_manager.bot_settings["active"],
                    "personality": state_manager.bot_settings.get("personality","SWING_TRADER"),
                    "radar": picks, "logs": state_manager.system_logs, "career_roi": roi,
                    "active_units": len(active), "allocated_capital": round(alloc * _r, 2), # TL
                    "realized_pnl": round(state_manager.db.get("total_pnl", 0.0) * _r, 2), # TL
                    "daily_pnl": round(daily_pnl * _r, 2), # TL
                    "is_in_position": clean_symbol in state_manager.bot_settings["fleet_state"],
                    "timestamp": state_manager.get_tr_now().strftime("%H:%M:%S"),
                    "volatility": report.get('metrics',{}).get('volatility',0),
                    "trailing_stop_pct": radar_loop.DEFAULT_TRAILING_STOP,
                    "market_halt": state_manager.bot_settings.get("market_halt", False),
                    "max_positions": radar_loop.MAX_OPEN_POSITIONS,
                    "open_positions": len(state_manager.bot_settings["fleet_state"]),
                })
                await websocket.send_text(json.dumps(data))
                errors = 0
            except Exception as e:
                errors += 1
                await asyncio.sleep(min(5*(2**(errors//2)), 30))
            await asyncio.sleep(3)
    except Exception:
        pass
    finally:
        try: await websocket.close()
        except: pass

@app.post("/set-personality")
async def set_personality(request: dict):
    new_mode = request.get("personality", "SWING_TRADER")
    if new_mode in ["SWING_TRADER", "AGGRESSIVE_TRADER"]:
        state_manager.bot_settings["personality"] = new_mode
        state_manager.save_fleet_state(state_manager.bot_settings["fleet_state"])
        state_manager.add_log(f"API-SWITCH: Mod değişti -> {new_mode}")
        return {"status": "success", "personality": new_mode}
    return {"status": "error", "message": "Geçersiz mod"}

@app.get("/swing-status")
async def get_swing_status():
    trades    = state_manager.db.get("trade_log", [])
    wins      = [t for t in trades if t.get("pnl", 0) > 0]
    total_pnl = sum(t.get("pnl", 0) for t in trades)
    
    return {
        "total_trades": len(trades),
        "wins": len(wins),
        "win_rate": round(len(wins)/max(len(trades),1)*100, 1) if trades else 0,
        "total_pnl": round(total_pnl, 2),
        "personality": state_manager.bot_settings.get("personality", "SWING_TRADER"),
        "updated_at": state_manager.get_tr_now().strftime("%H:%M:%S")
    }

@app.post("/set-risk")
async def set_risk(request: dict):
    if "risk_pct"      in request: radar_loop.RISK_PER_TRADE_PCT  = max(0.005, min(0.05, float(request["risk_pct"])/100))
    if "max_positions" in request: radar_loop.MAX_OPEN_POSITIONS   = max(1, min(20, int(request["max_positions"])))
    if "hard_stop_pct" in request: radar_loop.HARD_STOP_PCT        = max(0.01, min(0.20, float(request["hard_stop_pct"])/100))
    state_manager.add_log(f"Risk güncellendi: %{radar_loop.RISK_PER_TRADE_PCT*100:.1f} risk, max {radar_loop.MAX_OPEN_POSITIONS} poz, %{radar_loop.HARD_STOP_PCT*100:.0f} stop")
    return {"status": "success", "risk_pct": radar_loop.RISK_PER_TRADE_PCT*100,
            "max_positions": radar_loop.MAX_OPEN_POSITIONS, "hard_stop_pct": radar_loop.HARD_STOP_PCT*100}

@app.post("/toggle-bot")
async def toggle_bot(request: dict):
    new_state = request.get('active', False)
    state_manager.bot_settings["active"] = new_state
    state_manager.save_settings()
    if not new_state:
        state_manager.add_log(f"BOT-DISENGAGED: {len(state_manager.bot_settings['fleet_state'])} pozisyon açık kaldı")
    else:
        state_manager.add_log("BOT-ENGAGED: Neural core aktif")
    return {"status": "success", "bot_active": state_manager.bot_settings["active"]}

@app.post("/sell-all")
async def sell_all_positions():
    state_manager.bot_settings["active"] = False
    symbols_to_sell = list(state_manager.bot_settings["fleet_state"].keys())
    sold, errors    = [], []

    async def _sell_one(symbol):
        state = state_manager.bot_settings["fleet_state"].get(symbol, {})
        qty   = state.get("qty", 0)
        entry = state.get("entry", 0)
        try:
            tickers = await trade_executor.fetch_all_tickers_24hr()
            curr_price = tickers.get(symbol, {}).get('last', entry) or entry
            if not trade_executor.has_keys or not trade_executor.exchange.markets:
                state_manager.add_log(f"SIMULATED SELL-ALL: {symbol} @ ${curr_price:.6f}")
            else:
                if qty > 0:
                    qty_p = trade_executor.exchange.amount_to_precision(symbol, qty)
                    await asyncio.to_thread(trade_executor.exchange.create_market_order, symbol, 'sell', qty_p)
            gross_pnl = (curr_price - entry) * qty
            commission = (entry + curr_price) * qty * 0.001
            pnl = gross_pnl - commission

            state_manager.db["total_pnl"] = round(state_manager.db.get("total_pnl", 0) + pnl, 2)
            state_manager.db["_daily_realized_pnl"] = round(
                state_manager.db.get("_daily_realized_pnl", 0.0) + pnl, 2)
            if pnl > 0:
                _v_share = pnl * 0.20
                state_manager.db["profit_vault"] = round(state_manager.db.get("profit_vault", 0.0) + _v_share, 2)
                state_manager.db["profit_vault_count"] = state_manager.db.get("profit_vault_count", 0) + 1

            trade_entry = {
                "time": state_manager.get_tr_now().strftime("%H:%M:%S"),
                "date": state_manager.get_tr_now().strftime("%Y-%m-%d"),
                "symbol": symbol, 
                "side": "SELL-ALL", 
                "price": curr_price, 
                "qty": qty,
                "pnl": round(pnl, 2),
                "reason": "MANUAL-SELL-ALL",
                "source": state.get("source", "SWING_TRADER")
            }
            state_manager.db.setdefault("trade_log",[]).insert(0, trade_entry)
            state_manager.db["trade_log"] = state_manager.db["trade_log"][:100]
            state_manager.append_trade_history(trade_entry)
            radar_loop.last_sell_times[symbol] = time.time()
            state_manager.add_log(f"SELL-ALL: {symbol} kapatıldı. PNL: ${pnl:.2f}")
            sold.append(symbol)
        except Exception as e:
            errors.append(f"{symbol}: {str(e)}")
            state_manager.add_log(f"SELL-ALL-WARN: {symbol} — {str(e)[:60]}")
        finally:
            state_manager.bot_settings["fleet_state"].pop(symbol, None)

    await asyncio.gather(*[_sell_one(s) for s in symbols_to_sell])
    state_manager.save_db(state_manager.db)
    state_manager.save_fleet_state(state_manager.bot_settings["fleet_state"])
    state_manager.save_settings()
    state_manager.add_log(f"BOT-DISENGAGED: SELL ALL tamamlandı — {len(sold)} pozisyon kapatıldı")
    return {"status": "success", "sold": sold, "errors": errors}

@app.get("/macro-status")
async def get_macro_status():
    if not radar_loop._MACRO_AVAILABLE:
        return {"available": False, "mode": "NEUTRAL", "note": "macro_filter.py yüklü değil"}
    try:
        from macro_filter import get_macro_state, get_macro_params
        state  = get_macro_state()
        params = get_macro_params(state["mode"])
        return {
            "available":   True,
            "mode":        state["mode"],
            "score":       state["score"],
            "signals":     state["signals"],
            "btc_price":   state["btc_price"],
            "updated_at":  state["updated_at"],
            "active_params": {
                "max_positions":  params["max_open_positions"],
                "risk_pct":       params["risk_per_trade_pct"] * 100,
                "ml_threshold":   params["ml_threshold"],
                "cooldown_h":     params["cooldown_seconds"] // 3600,
                "score_bonus":    params["score_bonus"],
                "tp_bonus":       params["tp_bonus_pct"],
                "description":    params["description"],
            }
        }
    except Exception as e:
        return {"available": True, "mode": radar_loop._macro_mode, "error": str(e)}

@app.get("/scan-status")
async def get_scan_status():
    if not radar_loop._SCANNER_AVAILABLE:
        return {"available": False, "note": "coin_scanner.py yüklü değil"}
    try:
        from coin_scanner import get_scan_state
        state = radar_loop._scanner_state if radar_loop._scanner_state else get_scan_state()
        return {
            "available":      True,
            "top_coins":      state.get("top_coins", [])[:20],
            "total_scanned":  state.get("total_scanned", 0),
            "btc_ret_4h":     state.get("btc_ret_4h", 0),
            "btc_ret_24h":    state.get("btc_ret_24h", 0),
            "scan_seconds":   state.get("scan_seconds", 0),
            "updated_at":     state.get("updated_at", ""),
            "coin_count":     len(state.get("top_coins", [])),
            "top_details":    state.get("details", [])[:10],
        }
    except Exception as e:
        return {"available": True, "error": str(e), "top_coins": radar_loop._scanner_coins[:20]}

@app.post("/scan-refresh")
async def trigger_scan_refresh():
    if not radar_loop._SCANNER_AVAILABLE:
        return {"error": "coin_scanner.py yüklü değil"}
    try:
        await asyncio.to_thread(radar_loop.refresh_scanner_coins, True)
        return {
            "status":     "ok",
            "coin_count": len(radar_loop._scanner_coins),
            "top_coins":  radar_loop._scanner_coins[:10],
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/copy-status")
async def get_copy_status():
    config   = {}
    signals  = []
    tracked  = {}
    try:
        import copy_trader as ct
        config  = ct.load_config() or {}
        signals = []
        if os.path.exists(ct.SIGNAL_FILE):
            with open(ct.SIGNAL_FILE) as f:
                signals = json.load(f)[:10]
        tracked = ct.load_tracked_positions()
    except ImportError:
        pass
    return {
        "active":           bool(config),
        "trader_id":        config.get("portfolio_id", ""),
        "trader_name":      config.get("name", ""),
        "set_at":           config.get("set_at", ""),
        "tracked_positions": tracked,
        "recent_signals":   signals,
    }

@app.post("/copy-set-trader")
async def set_copy_trader(data: dict):
    portfolio_id = data.get("portfolio_id", "").strip()
    name         = data.get("name", "").strip()
    if not portfolio_id:
        return {"error": "portfolio_id gerekli"}
    try:
        import copy_trader as ct
        ct.save_config(portfolio_id, name)
        return {"status": "ok", "portfolio_id": portfolio_id, "name": name}
    except Exception as e:
        return {"error": str(e)}

@app.get("/model-stats")
async def get_model_stats():
    bt_data, signal_data = {}, {}
    if os.path.exists(BACKTEST_RESULTS_FILE):
        try:
            with open(BACKTEST_RESULTS_FILE, encoding="utf-8") as f: bt_data = json.load(f)
        except: pass
    if os.path.exists(SIGNAL_LOG_FILE):
        try:
            with open(SIGNAL_LOG_FILE, encoding="utf-8") as f: signal_data = json.load(f)
        except: pass

    results    = bt_data.get("results", [])
    bt_summary = {}
    if results:
        all_trades = [t for r in results for t in r.get("trades", [])]
        wins       = [t for t in all_trades if t.get("pnl", 0) > 0]
        total_pnl  = sum(r.get("total_pnl", 0) for r in results)
        win_rate   = len(wins)/len(all_trades)*100 if all_trades else 0
        profitable = sum(1 for r in results if r.get("total_pnl", 0) > 0)
        avg_pf     = sum(r.get("profit_factor", 0) for r in results)/len(results)
        avg_dd     = sum(r.get("max_drawdown", 0) for r in results)/len(results)
        bt_summary = {
            "date": bt_data.get("date","—"), "total_trades": len(all_trades),
            "win_rate": round(win_rate,1), "total_pnl": round(total_pnl,2),
            "profit_factor": round(avg_pf,2), "max_drawdown": round(avg_dd,2),
            "profitable_pct": round(profitable/len(results)*100,1),
            "symbols_tested": len(results), "config": bt_data.get("config",{}),
            "per_symbol": [
                {"symbol": r["symbol"], "trades": r["total_trades"],
                 "win_rate": r["win_rate"], "pnl": r["total_pnl"],
                 "pf": r["profit_factor"], "drawdown": r["max_drawdown"]}
                for r in sorted(results, key=lambda x: x["total_pnl"], reverse=True)
            ],
        }

    signals     = signal_data if isinstance(signal_data, list) else []
    sig_summary = {}
    for hours in [4, 24]:
        key     = f"{hours}h"
        checked = [s for s in signals if key in s.get("checks", {})]
        if checked:
            wins_s  = [s for s in checked if s["checks"][key]["outcome"] == "WIN"]
            avg_pnl = sum(s["checks"][key]["pnl_pct"] for s in checked)/len(checked)
            sig_summary[key] = {
                "win_rate": round(len(wins_s)/len(checked)*100,1),
                "count": len(checked), "avg_pnl": round(avg_pnl,2),
            }

    ml_status = {
        "available":  radar_loop.ml_model is not None,
        "loaded":     radar_loop.ml_model is not None,
        "file":       radar_loop.ML_FILTER_FILE,
        "threshold":  radar_loop.ML_THRESHOLD,
        "xgb_ready":  radar_loop._ML_AVAILABLE,
    }

    return trade_executor.clean_data({
        "backtest": bt_summary, "signals": sig_summary,
        "total_signals": len(signals), "bt_running": backtest_running,
        "ml_filter": ml_status,
        "risk_settings": {
            "risk_per_trade_pct": radar_loop.RISK_PER_TRADE_PCT*100,
            "max_open_positions": radar_loop.MAX_OPEN_POSITIONS,
            "hard_stop_pct":      radar_loop.HARD_STOP_PCT*100,
            "cooldown_hours":     radar_loop.COOLDOWN_SECONDS/3600,
        },
    })

@app.post("/run-backtest")
async def run_backtest_async():
    global backtest_running
    if backtest_running: return {"status": "already_running"}
    backtest_running = True
    state_manager.add_log("BACKTEST: Başlatıldı")

    async def _run():
        global backtest_running
        try:
            current_personality = state_manager.bot_settings.get("personality", "SWING_TRADER")
            proc = await asyncio.create_subprocess_exec(
                "python", "backtest_runner.py", current_personality,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()
            if proc.returncode == 0:
                state_manager.add_log("BACKTEST: Tamamlandı [OK]")
            else:
                err = stderr.decode(errors='replace')[:200] if stderr else "bilinmeyen hata"
                state_manager.add_log(f"BACKTEST-ERR: {err}")
        except Exception as e:
            state_manager.add_log(f"BACKTEST-ERR: {str(e)[:100]}")
        finally:
            backtest_running = False

    asyncio.create_task(_run())
    return {"status": "started"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
