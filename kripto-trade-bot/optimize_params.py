"""
ANTIGRAVITY AI — Karakter Karşılaştırma Optimizasyonu v2.0
==========================================================
İyileştirme #12: 10 sembolle test (eskiden 3 sembol)
Walk-forward analiz eklendi (ilk %70 eğitim, son %30 test)
"""

import json
import time
from datetime import datetime
import backtest_runner

PERSONALITIES = ["SCALPER", "SWING_TRADER", "DEGEN", "AUTO"]

# 12. 10 sembolle test (eskiden BTC/ETH/SOL'du)
OPT_SYMBOLS = [
    "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT",
    "ADA/USDT", "AVAX/USDT", "DOGE/USDT", "LINK/USDT", "DOT/USDT"
]
LOOKBACK_DAYS = backtest_runner.LOOKBACK_DAYS


def test_personality(personality, symbol_dfs, walkforward=False):
    """
    Bir karakter için tüm sembolleri test et.
    walkforward=True: son %30 veriyi out-of-sample test olarak kullan.
    """
    backtest_runner.PERSONALITY = personality
    total_pnl = 0.0
    win_rates = []
    pf_list   = []
    trade_cnt = 0
    oos_pnl   = 0.0   # Out-of-sample PnL

    for sym, df in symbol_dfs:
        if walkforward and len(df) > 100:
            split  = int(len(df) * 0.70)
            df_is  = df.iloc[:split].reset_index(drop=True)   # In-sample (eğitim)
            df_oos = df.iloc[split:].reset_index(drop=True)   # Out-of-sample (test)
        else:
            df_is  = df
            df_oos = None

        result = backtest_runner.run_backtest(sym, df_is)
        if result and result["total_trades"] >= 3:
            total_pnl += result["total_pnl"]
            win_rates.append(result["win_rate"])
            pf_list.append(result["profit_factor"])
            trade_cnt += result["total_trades"]

        if df_oos is not None and len(df_oos) > 100:
            r_oos = backtest_runner.run_backtest(sym, df_oos)
            if r_oos:
                oos_pnl += r_oos["total_pnl"]

    avg_wr   = sum(win_rates) / len(win_rates) if win_rates else 0
    avg_pf   = sum(pf_list)   / len(pf_list)   if pf_list   else 0
    combined = total_pnl + (avg_wr - 50) * 3 + (avg_pf - 1) * 20
    return combined, avg_wr, avg_pf, total_pnl, trade_cnt, oos_pnl


def main():
    print(f"\n  VERİ ÇEKİLİYOR ({len(OPT_SYMBOLS)} sembol)...\n")
    symbol_dfs = []
    for sym in OPT_SYMBOLS:
        try:
            print(f"  {sym}...", end=" ", flush=True)
            df = backtest_runner.fetch_ohlcv(sym, LOOKBACK_DAYS)
            df = backtest_runner.compute_indicators(df)
            df = df.dropna().reset_index(drop=True)
            symbol_dfs.append((sym, df))
            print(f"OK ({len(df)} bar)")
            time.sleep(0.3)
        except Exception as e:
            print(f"HATA: {e}")

    if not symbol_dfs:
        print("Veri çekilemedi.")
        return

    print(f"\n  {len(PERSONALITIES)} karakter x {len(symbol_dfs)} sembol test ediliyor...\n")
    print(f"  {'KARAKTER':>15} {'WIN%':>7} {'PF':>6} {'IN-SAMPLE':>12} {'OUT-OF-SAMPLE':>14}  SKOR")
    print("  " + "─" * 70)

    scores = []
    for p in PERSONALITIES:
        s, wr, pf, pnl, cnt, oos = test_personality(p, symbol_dfs, walkforward=True)
        scores.append((s, p, wr, pf, pnl, cnt, oos))
        marker = " <<< EN IYI" if s == max(x[0] for x in scores) else ""
        print(f"  {p:>15}  {wr:>6.1f}%  {pf:>5.2f}  {pnl:>+11.2f}$  {oos:>+13.2f}$  {s:>7.1f}{marker}")

    scores.sort(reverse=True)
    best = scores[0]

    print("\n" + "=" * 72)
    print(f"  EN IYI KARAKTER: {best[1]}")
    print(f"  Win Rate       : {best[2]:.1f}%")
    print(f"  Profit Factor  : {best[3]:.2f}")
    print(f"  In-Sample PnL  : ${best[4]:+.2f}")
    print(f"  Out-of-Sample  : ${best[6]:+.2f}  (gercek performans tahmin)")
    print("=" * 72)
    print(f"""
  Dashboard'dan '{best[1]}' karakterini seç.
  Ya da API: POST /set-personality  Body: {{"personality": "{best[1]}"}}
""")

    with open("optimization_result.json", "w", encoding="utf-8") as f:
        json.dump({
            "date":             datetime.now().strftime("%Y-%m-%d %H:%M"),
            "mode":             "personality_comparison_walkforward",
            "symbols_tested":   len(symbol_dfs),
            "best_personality": best[1],
            "best_win_rate":    best[2],
            "best_pf":          best[3],
            "best_pnl":         best[4],
            "best_oos_pnl":     best[6],
            "all_results": [
                {"personality": s[1], "score": s[0], "win_rate": s[2],
                 "pf": s[3], "pnl": s[4], "oos_pnl": s[6]}
                for s in scores
            ]
        }, f, indent=2, ensure_ascii=False)
    print("  Detaylar kaydedildi -> optimization_result.json\n")


if __name__ == "__main__":
    main()
