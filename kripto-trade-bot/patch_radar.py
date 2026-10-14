import shutil

# Temiz backup'tan basliyoruz
shutil.copy('radar_loop_server_backup.py', 'radar_loop.py')
content = open('radar_loop.py', encoding='utf-8').read()

# ---- 1. BEAR mode: DOWN tokenlar + 30 buyuk hacimli coin ----
old1 = (
    '            if _macro_mode == "BEAR":\n'
    '                valid_symbols = [s for s in DOWN_TOKENS if s in tickers]\n'
    '                state_manager.add_log(f"RADAR [{_mode_label}]: BEAR Piyasas\u0131 Korumas\u0131 aktif \u2014 Sadece DOWN tokenlar taran\u0131yor: {len(valid_symbols)} adet")'
)
new1 = (
    '            if _macro_mode == "BEAR":\n'
    '                down_syms = [s for s in DOWN_TOKENS if s in tickers]\n'
    '                bear_normal = sorted(\n'
    '                    [s for s, d in tickers.items()\n'
    '                     if s.endswith(\'/USDT\') and not is_blacklisted(s)\n'
    '                     and _get_vol(d) >= 5_000_000],\n'
    '                    key=lambda x: _get_vol(tickers[x]), reverse=True\n'
    '                )[:30]\n'
    '                valid_symbols = down_syms + [s for s in bear_normal if s not in down_syms]\n'
    '                state_manager.add_log(f"RADAR [{_mode_label}]: BEAR Modu \u2014 {len(down_syms)} DOWN + {len(bear_normal)} coin (skor +15)")'
)
assert old1 in content, "PATCH 1 FAILED: target not found"
content = content.replace(old1, new1, 1)

# ---- 2. Gece modu + BEAR +15 + CHOPPY +12 + LOSS cooldown ----
old2 = '                    if can_buy and ai_score >= dyn_buy_thresh and state.get("side") != "buy" and not is_buy_blocked:'
new2 = (
    '                    # Gece Sessizlik Modu 01:00-06:00 TR\n'
    '                    _tr_hour = state_manager.get_tr_now().hour\n'
    '                    if 1 <= _tr_hour < 6:\n'
    '                        is_buy_blocked = True\n'
    '\n'
    '                    # BEAR modunda +15 skor esigi\n'
    '                    if _macro_mode == "BEAR" and not is_buy_blocked:\n'
    '                        dyn_buy_thresh += 15\n'
    '\n'
    '                    # CHOPPY rejiminde +12 skor esigi\n'
    '                    if regime_name == "CHOPPY" and not is_buy_blocked:\n'
    '                        dyn_buy_thresh += 12\n'
    '\n'
    '                    if can_buy and ai_score >= dyn_buy_thresh and state.get("side") != "buy" and not is_buy_blocked:'
)
assert old2 in content, "PATCH 2 FAILED: target not found"
content = content.replace(old2, new2, 1)

# ---- 3. Zarar sonrasi 4 saat cooldown ----
old3 = (
    '                                last_sell_times[curr_symbol] = time.time()\n'
    '                                del state_manager.bot_settings["fleet_state"][curr_symbol]'
)
new3 = (
    '                                if pnl < 0:\n'
    '                                    last_sell_times[curr_symbol] = time.time() + 14400\n'
    '                                    state_manager.add_log(f"LOSS-COOLDOWN: {curr_symbol} 4 saat alim engeli (PnL:${pnl:.2f})")\n'
    '                                else:\n'
    '                                    last_sell_times[curr_symbol] = time.time()\n'
    '                                del state_manager.bot_settings["fleet_state"][curr_symbol]'
)
assert old3 in content, "PATCH 3 FAILED: target not found"
content = content.replace(old3, new3, 1)

open('radar_loop.py', 'w', encoding='utf-8').write(content)
print(f"BASARILI - {content.count(chr(10))} satir yazildi")
