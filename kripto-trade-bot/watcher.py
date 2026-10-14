"""
ANTIGRAVITY AI — Terminal İzleme Ekranı v2.0
=============================================
İyileştirme #8: Rejim bazlı dinamik eşikler (sabit score>60 yerine)
"""
import ccxt
import time
import pandas as pd
from rich.console import Console
from rich.table import Table
from rich.live import Live
from scoring_engine import TechnicalScoringEngine

exchange = ccxt.binance({
    'enableRateLimit': True,
    'options': {'defaultType': 'spot'},
    'timeout': 30000
})
# Türkiye bölgesi için fallback endpoint
WATCHER_ENDPOINTS = [
    'https://api.binance.com/api/v3',
    'https://api.binance.me/api/v3',
    'https://api1.binance.com/api/v3',
]

def _try_load_markets():
    for ep in WATCHER_ENDPOINTS:
        try:
            exchange.urls['api']['public'] = ep
            exchange.urls['api']['private'] = ep
            exchange.load_markets()
            console.print(f"[green]Watcher bağlandı: {ep.split('/')[2]}[/green]")
            return True
        except Exception:
            continue
    console.print("[red]Watcher: Binance'e bağlanılamadı[/red]")
    return False

console = Console()


def gozcu_calis(sembol="BTC/USDT"):
    console.print(f"[bold cyan]--- {sembol} ANTIGRAVITY AI Gözcü v2.0 ---[/bold cyan]")
    engine = TechnicalScoringEngine(sembol, exchange=exchange)

    def generate_table(ticker_data, depth_data, ai_report):
        score         = ai_report.get('total_score', 0)
        regime        = ai_report.get('regime', 'UNKNOWN')
        regime_params = ai_report.get('regime_params', {})
        buy_thresh    = regime_params.get('buy_thresh', 80)
        sell_thresh   = regime_params.get('sell_thresh', 50)
        take_profit   = regime_params.get('take_profit', 5.0)
        atr_mult      = regime_params.get('atr_mult', 3.0)
        strategy      = regime_params.get('strategy', '?')
        can_buy       = regime_params.get('can_buy', True)
        metrics       = ai_report.get('metrics', {})

        # Renk mantığı — rejim eşiğine göre
        if score >= buy_thresh:
            signal_color = "green"
            signal_label = "BUY SİNYALİ"
        elif score <= sell_thresh:
            signal_color = "red"
            signal_label = "SATIŞ BÖLGESİ"
        else:
            signal_color = "yellow"
            signal_label = "BEKLE"

        regime_colors = {
            'TRENDING_UP':   'green',
            'TRENDING_DOWN': 'red',
            'CHOPPY':        'yellow',
            'HIGH_VOL':      'magenta',
            'UNKNOWN':       'white',
        }
        rc = regime_colors.get(regime, 'white')

        imbalance = depth_data['imbalance']
        sentiment = depth_data['sentiment']
        sc = "green" if sentiment == "BULLISH" else "red" if sentiment == "BEARISH" else "yellow"

        table = Table(
            title=f"ANTIGRAVITY AI WATCHER v2.0 — {sembol}",
            border_style="bright_blue"
        )
        table.add_column("Özellik", style="cyan", justify="right", width=24)
        table.add_column("Değer",   style="bold white", width=30)

        table.add_row("Son Fiyat",         f"[bold yellow]{ticker_data['last']} USDT[/bold yellow]")
        table.add_row("AI SKOR",           f"[{signal_color}]{score} / 100[/{signal_color}]")
        table.add_row("SİNYAL",            f"[{signal_color}]{signal_label}[/{signal_color}]")
        table.add_row("─" * 20,            "─" * 28)
        table.add_row("PİYASA REJİMİ",     f"[{rc}]{regime}[/{rc}]")
        table.add_row("Strateji",          strategy)
        table.add_row("Alım Eşiği",        f"[green]{buy_thresh}[/green]")
        table.add_row("Satış Eşiği",       f"[red]{sell_thresh}[/red]")
        table.add_row("Take Profit",       f"[green]+%{take_profit}[/green]")
        table.add_row("ATR Çarpanı",       f"{atr_mult}x")
        table.add_row("Alım Yapılabilir?", f"[green]EVET[/green]" if can_buy else f"[red]HAYIR[/red]")
        table.add_row("─" * 20,            "─" * 28)
        table.add_row("RSI (14)",          f"[bold]{metrics.get('rsi', '-'):.1f}[/bold]")
        table.add_row("ADX",               f"{metrics.get('adx', '-'):.1f}")
        table.add_row("ATR%",              f"%{metrics.get('atr_pct', '-'):.2f}")
        table.add_row("Z-Score",           f"{metrics.get('z_score', '-'):.2f}")
        table.add_row("Hacim Oranı",       f"{metrics.get('vol_ratio', '-'):.2f}x")
        table.add_row("Bollinger %B",      f"{metrics.get('bb_pct', '-'):.2f}")
        table.add_row("OB İmbalance",      f"{metrics.get('ob_imbalance', 0.5):.2f} ({sentiment})")
        table.add_row("4H Trend",          metrics.get('trend_4h', 'NEUTRAL'))
        table.add_row("─" * 20,            "─" * 28)
        table.add_row("24s Yüksek/Düşük",  f"[green]{ticker_data['high']}[/green] / [red]{ticker_data['low']}[/red]")
        table.add_row("Order Book Dengesi",f"[{sc}]{sentiment} (%{imbalance*100:.0f} Alıcı)[/{sc}]")
        table.add_row("Son Güncelleme",    f"[dim]{time.strftime('%H:%M:%S')}[/dim]")

        return table

    try:
        with Live(auto_refresh=False) as live:
            while True:
                try:
                    ticker     = exchange.fetch_ticker(sembol)
                    ai_report  = engine.calculate_score()
                    ob         = exchange.fetch_order_book(sembol, limit=10)
                    bid_vol    = sum(b[1] for b in ob['bids'])
                    ask_vol    = sum(a[1] for a in ob['asks'])
                    total_vol  = bid_vol + ask_vol
                    imbalance  = bid_vol / total_vol if total_vol > 0 else 0.5
                    depth_data = {
                        "imbalance": imbalance,
                        "sentiment": "BULLISH" if imbalance > 0.6 else "BEARISH" if imbalance < 0.4 else "NEUTRAL",
                    }
                    live.update(generate_table(ticker, depth_data, ai_report), refresh=True)
                    time.sleep(3)
                except Exception as e:
                    console.print("[red]Döngü hatası:[/red]", e)
                    time.sleep(5)
    except Exception as e:
        console.print("[bold red]Watcher hatası:[/bold red]", e)


if __name__ == "__main__":
    import sys
    symbol = sys.argv[1] if len(sys.argv) > 1 else "BTC/USDT"
    gozcu_calis(symbol)
