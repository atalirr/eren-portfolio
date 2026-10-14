import json

with open('backtest_results.json', encoding='utf-8') as f:
    data = json.load(f)

print("Tarih:", data["date"])
cfg = data["config"]
print("Config: buy=%d, sell=%d, trail=%.1f" % (cfg["buy_thresh"], cfg["sell_thresh"], cfg["trailing_stop"]))
print()
print("%-12s %6s %7s %10s %9s %10s %9s %9s %9s" % (
    "SEMBOL", "ISLEM", "WIN%", "PNL", "AVG WIN%", "AVG LOSS%", "P.FACTOR", "MAX DD", "AVG HOLD"))
print("-" * 85)

total_trades = 0
total_wins = 0
total_pnl = 0

for r in data["results"]:
    trades = r["total_trades"]
    wins = round(trades * r["win_rate"] / 100)
    total_trades += trades
    total_wins += wins
    total_pnl += r["total_pnl"]
    pnl_str = ("+%.2f" if r["total_pnl"] >= 0 else "%.2f") % r["total_pnl"]
    print("%-12s %6d %6.1f%% %10s %8.2f%% %9.2f%% %9.2f %9.2f %8.1fh" % (
        r["symbol"], trades, r["win_rate"], pnl_str,
        r["avg_win_pct"], r["avg_loss_pct"],
        r["profit_factor"], r["max_drawdown"], r["avg_hold_h"]))

print("-" * 85)
overall_wr = total_wins / total_trades * 100
pnl_str = ("+%.2f" if total_pnl >= 0 else "%.2f") % total_pnl
print("%-12s %6d %6.1f%% %10s" % ("TOPLAM", total_trades, overall_wr, pnl_str))

print()
print("=== WIN/LOSS ORAN ANALIZI (Edge tespiti) ===")
for r in data["results"]:
    ratio = abs(r["avg_win_pct"] / r["avg_loss_pct"]) if r["avg_loss_pct"] != 0 else 0
    profitable = "KARLI" if r["total_pnl"] > 0 else "ZARARLI"
    print("%-12s Win/Loss: %.2fx  (kazaninca +%.2f%%, kaybedince %.2f%%)  --> %s" % (
        r["symbol"], ratio, r["avg_win_pct"], r["avg_loss_pct"], profitable))

print()
print("=== NEDEN WIN RATE DUSUK AMA KARLI? ===")
for r in data["results"]:
    expected_value = (r["win_rate"]/100) * r["avg_win_pct"] + ((100-r["win_rate"])/100) * r["avg_loss_pct"]
    print("%-12s Beklenen deger per islem: %+.3f%%" % (r["symbol"], expected_value))
