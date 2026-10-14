// TRADE AI — App.jsx (v9 redesign)
import { useState, useEffect, useRef, useCallback } from 'react';
import { LayoutDashboard, Cpu, Zap, FlaskConical, Target } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// ── HELPERS ──────────────────────────────────────────────────────────────────
const toTL   = (usd, rate = 38.0) => {
  const tl = (usd || 0) * rate;
  const absTl = Math.abs(tl);
  const decimals = absTl < 100 ? 2 : 0;
  return tl.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
// Zaten TL olan değerleri formatla (backend'den gelen TL değerler için)
const fmtTL  = (tl) => {
  const absTl = Math.abs(tl || 0);
  const decimals = absTl < 100 ? 2 : 0;
  return (tl || 0).toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmt2     = (v) => (v || 0).toFixed(2);
const fmtUSD   = (v) => `$${fmt2(v)}`;
const pnlColor  = (v) => (v >= 0 ? 'var(--success-color)' : 'var(--danger-color)');
const pnlPrefix = (v) => (v >= 0 ? '+' : '');

// ── POSITION ITEM ─────────────────────────────────────────────────────────────
const PositionItem = ({ asset, rate }) => {
  const pnl = asset.pnl ?? 0;
  const pnlClass = pnl > 0 ? 'pos-profit' : pnl < 0 ? 'pos-loss' : '';
  return (
    <div className={`position-item ${pnlClass}`}>
      <div className="position-left">
        <div className="position-symbol">
          {asset.asset}/USDT
          <span className="position-qty">{(asset.qty ?? 0).toLocaleString()}</span>
        </div>
        <div className="position-cost">Maliyet: <strong>₺{toTL(asset.cost, rate)}</strong> <span className="tl-val" style={{ fontSize: '0.72rem', opacity: 0.7 }}>({fmtUSD(asset.cost)})</span></div>
      </div>
      <div className="position-right">
        <div className="position-pnl" style={{ color: pnlColor(pnl) }}>
          {pnlPrefix(pnl)}{asset.pnl_pct}%
        </div>
        <div className="position-value">
          ₺{toTL(asset.value, rate)}
          <span className="tl-val" style={{ fontSize: '0.72rem', opacity: 0.7, display: 'block', textAlign: 'right' }}>{fmtUSD(asset.value)}</span>
        </div>
      </div>
    </div>
  );
};

// ── MACRO BADGE ───────────────────────────────────────────────────────────────
const MacroStatusBadge = ({ macroStatus }) => {
  if (!macroStatus) return null;
  const score  = macroStatus.score ?? macroStatus.macro_score ?? 0;
  const trend  = macroStatus.trend || macroStatus.regime || '';
  const raw    = trend ? trend.toUpperCase() : score > 0.2 ? 'BULLISH' : score < -0.2 ? 'BEARISH' : 'NEUTRAL';
  const color  = raw.includes('BULL') ? 'var(--success-color)' :
                 raw.includes('BEAR') ? 'var(--danger-color)'  : '#f59e0b';
  return (
    <div className="macro-badge" style={{ color, borderColor: color + '44' }}>
      <div className="macro-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      MACRO {raw}
    </div>
  );
};

// ── RADAR COIN ────────────────────────────────────────────────────────────────
const RadarCoin = ({ coin, rank }) => {
  const symbol = typeof coin === 'string' ? coin : coin?.symbol || coin?.asset || '?';
  const score  = typeof coin === 'object' ? coin?.score : null;
  return (
    <div className="radar-item">
      <span className="radar-rank">#{rank}</span>
      <span className="radar-symbol">{symbol}</span>
      {score != null && (
        <span className="radar-score" style={{ color: score > 70 ? 'var(--success-color)' : '#f59e0b' }}>
          {score}
        </span>
      )}
    </div>
  );
};

// ── DAILY SUMMARY CARD ────────────────────────────────────────────────────────
const DailySummaryCard = ({ ticker, rate }) => {
  const pnl = ticker.daily_pnl || 0;
  return (
    <div className="status-card swing-status-card" style={{ marginBottom: '0.6rem', borderTop: '3px solid var(--accent-color)' }}>
      <div className="status-card-header">
        <div className="status-card-title" style={{ color: 'var(--accent-color)' }}>
          <Target size={14} />
          GÜNLÜK ÖZET (00:00)
        </div>
        <div className="session-badge badge-swing">🟢 RAPOR AKTİF</div>
      </div>
      <div className="status-metrics">
        {[
          { label: 'GÜNLÜK PNL',   value: `${pnlPrefix(pnl)}₺${fmtTL(pnl)} (${fmtUSD(pnl / rate)})`, color: pnlColor(pnl) },
          { label: 'İŞLEM SAYISI', value: `${(ticker.daily_buys || 0) + (ticker.daily_sells || 0)}` },
          {
            label: 'BAŞARI ORANI',
            value: `%${ticker.daily_win_rate || 0}`,
            color: (ticker.daily_win_rate || 0) > 0 ? 'var(--success-color)' : 'var(--text-primary)'
          },
          {
            label: 'EN İYİ İŞLEM',
            value: `₺${fmtTL(ticker.best_daily_pnl || 0)} (${fmtUSD((ticker.best_daily_pnl || 0) / rate)})`,
            color: (ticker.best_daily_pnl || 0) > 0 ? 'var(--success-color)' : (ticker.best_daily_pnl || 0) < 0 ? 'var(--danger-color)' : 'var(--text-primary)'
          },
          { label: 'GÜN DURUMU',   value: pnl >= 0 ? '🟢 KÂRDA' : '🔴 ZARARDA' },
        ].map((m, i) => (
          <div key={i} className="metric-cell">
            <div className="metric-label">{m.label}</div>
            <div className="metric-value" style={{ color: m.color || 'var(--text-primary)' }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── APP ───────────────────────────────────────────────────────────────────────
function App() {
  // ── INITIAL STATE ─────────────────────────────────────────────
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem('botState');
      if (saved) {
        const p = JSON.parse(saved);
        return {
          radar:           p.radar           || { progress: 0, top_picks: [] },
          logs:            p.logs            || [],
          bot_active:      p.bot_active      || false,
          career_roi:      p.career_roi      || 0,
          active_units:    p.active_units    || 0,
          realized_pnl:    p.realized_pnl    || 0,
          daily_pnl:       p.daily_pnl       || 0,
          unrealized_pnl:  p.unrealized_pnl  || 0,
          total_val:       p.total_val       || 10000,
          start_bal:       p.start_bal       || 10000,
          trailing_stop_pct: p.trailing_stop_pct || 2.0,
          volatility:      p.volatility      || 0,
          personality:     p.personality     || 'SWING_TRADER',
        };
      }
    } catch (e) { console.log('Storage read error', e); }
    return {
      radar: { progress: 0, top_picks: [] },
      logs: [], bot_active: false,
      career_roi: 0, active_units: 0,
      realized_pnl: 0, daily_pnl: 0, daily_buys: 0, daily_sells: 0, 
      daily_win_rate: 0, best_daily_pnl: 0, unrealized_pnl: 0,
      total_val: 10000, start_bal: 10000,
      trailing_stop_pct: 2.0, volatility: 0, personality: 'SWING_TRADER',
    };
  };

  const getInitialWallet = () => {
    try {
      const saved = localStorage.getItem('walletAssets');
      if (saved) {
        const p = JSON.parse(saved);
        return { managed: Array.isArray(p.managed) ? p.managed : [], other: Array.isArray(p.other) ? p.other : [] };
      }
    } catch (e) { console.log('Wallet storage read error', e); }
    return { managed: [], other: [] };
  };

  const getInitialEquityHistory = () => {
    try {
      const saved = localStorage.getItem('equityHistory');
      if (saved) { const p = JSON.parse(saved); return Array.isArray(p) ? p : []; }
    } catch (e) { console.log('Equity history read error', e); }
    return [];
  };

  // ── STATE ──────────────────────────────────────────────────────
  const [ticker, setTicker]               = useState(getInitialState);
  const [equityHistory, setEquityHistory] = useState(getInitialEquityHistory);
  const [connected, setConnected]         = useState(false);
  const [activeSymbol, setActiveSymbol]   = useState('BTC-USDT');
  const [currentTab, setCurrentTab]       = useState('dashboard');
  const [backtestData, setBacktestData]   = useState(null);
  const [loadingBacktest, setLoadingBacktest] = useState(false);
  const [walletAssets, setWalletAssets]   = useState(getInitialWallet);
  const [modelStats, setModelStats]       = useState(null);
  const [btRunning, setBtRunning]         = useState(false);
  const [macroStatus, setMacroStatus]     = useState(null);
  const [swingStatus, setSwingStatus]     = useState(null);
  const [scanStatus, setScanStatus]       = useState({ top_coins: [] });
  const [usdToTry, setUsdToTry]           = useState(32.50);
  const ws = useRef(null);

  // ── LOCALSTORAGE SYNC ──────────────────────────────────────────
  useEffect(() => { try { localStorage.setItem('botState',      JSON.stringify(ticker));         } catch {} }, [ticker]);
  useEffect(() => { try { localStorage.setItem('equityHistory', JSON.stringify(equityHistory));  } catch {} }, [equityHistory]);
  useEffect(() => { try { localStorage.setItem('walletAssets',  JSON.stringify(walletAssets));  } catch {} }, [walletAssets]);

  // ── WEBSOCKET ──────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) return;
    ws.current = new WebSocket(`ws://51.20.2.214:5000/ws/ticker/${activeSymbol}`);
    ws.current.onopen  = () => setConnected(true);
    ws.current.onclose = (e) => {
      setConnected(false);
      if (e.wasClean === false) setTimeout(() => connectWS(), 5000);
    };
    ws.current.onerror  = () => {};
    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data || data.error) return;
        const nd = { ...data };
        if (Array.isArray(data.radar)) nd.radar = { top_picks: data.radar, progress: 100 };
        setTicker(prev => ({ ...prev, ...nd }));
      } catch {}
    };
  }, [activeSymbol]);

  // ── DATA POLLING ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const api = (path) => fetch(`http://51.20.2.214:5000/${path}`, { signal: AbortSignal.timeout(5000) });

    const fetchStatus = async () => {
      try {
        const res  = await api('get-status');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data) return;
        setTicker(prev => ({
          ...prev,
          radar:         (data.radar?.top_picks?.length > 0) ? data.radar : (prev.radar || { progress: 0, top_picks: [] }),
          logs:          data.logs            ?? [],
          bot_active:    !!data.bot_active,
          career_roi:    data.career_roi      ?? 0,
          active_units:  data.active_units    ?? 0,
          realized_pnl:  data.realized_pnl    ?? 0,
          daily_pnl:     data.daily_pnl       ?? 0,
          daily_buys:    data.daily_buys      ?? 0,
          daily_sells:   data.daily_sells     ?? 0,
          daily_win_rate: data.daily_win_rate  ?? 0,
          best_daily_pnl: data.best_daily_pnl  ?? 0,
          unrealized_pnl: data.unrealized_pnl ?? 0,
          total_val:     data.total_val       ?? prev.total_val ?? 10000,
          start_bal:     data.start_bal       ?? prev.start_bal ?? 10000,
          trailing_stop_pct: data.trailing_stop_pct ?? prev.trailing_stop_pct ?? 2.0,
          volatility:    data.volatility      ?? prev.volatility ?? 0,
          personality:   data.personality     ?? prev.personality,
        }));
        if (data.usdt_try_rate) {
          setUsdToTry(data.usdt_try_rate);
        }
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setEquityHistory(prev => {
          const newVal = data.total_val || 10000;
          if (prev.length > 50 && prev[prev.length - 1]?.value === newVal) return prev;
          return [...prev, { time: timeStr, value: newVal }].slice(-100);
        });
      } catch {}
    };

    const fetchWallet = async () => {
      try {
        const res = await api('get-wallet');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data || data.error) return;
        setWalletAssets(data);
        if (data.usdt_try_rate) {
          setUsdToTry(data.usdt_try_rate);
        }
      } catch {}
    };

    const fetchModelStats = async () => {
      try {
        const res = await api('model-stats');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data) return;
        setModelStats(data);
        setBtRunning(!!data.bt_running);
      } catch {}
    };

    const fetchMacroStatus = async () => {
      try {
        const res = await api('macro-status');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data) return;
        setMacroStatus(data);
      } catch {}
    };

    const fetchScanStatus = async () => {
      try {
        const res = await api('scan-status');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data) return;
        setScanStatus(data);
      } catch {}
    };

    const fetchSwingStatus = async () => {
      try {
        const res = await api('swing-status');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data) return;
        setSwingStatus(data);
      } catch {}
    };

    // İlk yükleme
    fetchStatus(); fetchWallet(); fetchModelStats();
    fetchMacroStatus(); fetchScanStatus(); fetchSwingStatus();

    const interval = setInterval(() => {
      fetchStatus(); fetchWallet(); fetchModelStats();
      fetchMacroStatus(); fetchScanStatus(); fetchSwingStatus();
    }, 5000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [activeSymbol]);

  useEffect(() => {
    connectWS();
    return () => { if (ws.current) ws.current.close(); };
  }, [connectWS]);

  // ── BACKTEST ───────────────────────────────────────────────────
  const runBacktest = async () => {
    setLoadingBacktest(true);
    try {
      const res = await fetch(`http://51.20.2.214:5000/backtest/${activeSymbol}?t=${Date.now()}`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) { setBacktestData({ error: 'Backend not available' }); return; }
      setBacktestData(await res.json());
    } catch {
      setBacktestData({ error: 'Simulation unavailable — backend offline' });
    } finally { setLoadingBacktest(false); }
  };

  // ── COMPUTED ───────────────────────────────────────────────────
  // Not: unrealizedPnLSum wallet'tan USD olarak gelir → TL'ye çevrilir
  const unrealizedPnLSum  = walletAssets?.managed?.reduce((acc, a) => acc + (a.pnl || 0), 0) || 0;
  const unrealizedPnLTRY  = unrealizedPnLSum * usdToTry;  // TL karşılığı
  // realized_pnl backend'den TL olarak gelir
  const realizedPnL       = ticker?.realized_pnl || 0;        // TL
  const totalPnL          = realizedPnL + unrealizedPnLTRY;   // TL
  const startBal          = ticker?.start_bal || 50000;        // TL
  const currentTotalVal   = ticker?.total_val || startBal;     // TL (backend hesaplar)
  const topCoins          = scanStatus?.top_coins?.length > 0
                              ? scanStatus.top_coins
                              : (ticker?.radar?.top_picks || []);
  const capitalAllocated  = walletAssets?.managed?.reduce((acc, a) => acc + (a.cost || 0), 0) || 0;
  const swingUnrealized   = walletAssets?.managed?.reduce((acc, a) => acc + (a.pnl || 0), 0) || 0;

  // ── WALLET ────────────────────────────────────────────────────
  const totalVal = (walletAssets?.total_pnl || 0) * usdToTry + (ticker?.start_bal || 50000);

  // ── RENDER ─────────────────────────────────────────────────────
  return (
    <div className="app-container">

      {/* ══ HEADER ══════════════════════════════════════════════════ */}
      <header className="header glass-panel">
        <div className="logo-section">
          <div style={{ position: 'relative' }}>
            <Cpu size={26} color="var(--accent-color)" />
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{ position: 'absolute', inset: 0, filter: 'blur(9px)', background: 'var(--accent-color)', borderRadius: '50%', zIndex: -1 }}
            />
          </div>
          <h1 className="logo-text">TRADE <span style={{ color: 'var(--accent-color)' }}>AI</span></h1>
          <div className="version-badge">v8.0-PROFESSIONAL</div>
        </div>

        <div className="header-center">
          <MacroStatusBadge macroStatus={macroStatus} />
        </div>

        <div className="header-right">
          <div className="exchange-rate-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '4px 8px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.05)', marginRight: '1rem' }}>
            <span>💵 1 USDT = {usdToTry.toFixed(2)} ₺</span>
          </div>
          {!connected && <div className="cached-warning">⚠ Using cached data</div>}
          <div className="status-badge">
            <div className="status-dot" style={{ background: connected ? '#10b981' : '#ef4444' }} />
            <span>{connected ? 'LIVE' : 'CACHED'}</span>
          </div>
        </div>
      </header>

      {/* ══ SIDEBAR ═════════════════════════════════════════════════ */}
      <aside className="sidebar glass-panel">
        <nav className="sidebar-nav">
          {[
            { id: 'dashboard',   icon: <LayoutDashboard size={17} />, label: 'DASHBOARD'  },
            { id: 'backtest',    icon: <Zap size={17} />,             label: 'SIMULATION' },
            { id: 'performance', icon: <FlaskConical size={17} />,    label: 'MODEL'      },
          ].map(({ id, icon, label }) => (
            <div key={id} className={`nav-item ${currentTab === id ? 'active' : ''}`} onClick={() => setCurrentTab(id)}>
              {icon}<span>{label}</span>
            </div>
          ))}
        </nav>


        {/* Mode badge */}
        <div className="sidebar-footer">
          <div className="personality-badge" style={{ color: '#a5b4fc', borderColor: 'rgba(99,102,241,0.3)' }}>
            📈 SWING TRADER
          </div>
        </div>
      </aside>

      {/* ══ MAIN CONTENT ════════════════════════════════════════════ */}
      <main className="main-content">

        {/* Top KPI row */}
        <div className="kpi-row">
          {[
            {
              label: 'GÜNLÜK GERÇEKLEŞEN P&L',
              value: `${pnlPrefix(ticker?.daily_pnl || 0)}₺${fmtTL(ticker?.daily_pnl || 0)}`,
              color: pnlColor(ticker?.daily_pnl || 0),
              sub: `${fmtUSD((ticker?.daily_pnl || 0) / usdToTry)} karşılığı`,
            },
            {
              label: 'AÇIK POZİSYON P&L',
              value: `${pnlPrefix(unrealizedPnLTRY)}₺${fmtTL(unrealizedPnLTRY)}`,
              color: pnlColor(unrealizedPnLTRY),
              sub: `${fmtUSD(unrealizedPnLSum)} karşılığı (${walletAssets?.managed?.length || 0} pozisyon)`,
            },
            {
              label: 'KULLANILAN SERMAYE',
              value: `₺${toTL(capitalAllocated, usdToTry)}`,
              color: 'var(--text-primary)',
              sub: `${fmtUSD(capitalAllocated)} (${walletAssets?.managed?.length || 0} aktif pozisyon)`,
            },
          ].map((k, i) => (
            <div key={i} className="glass-panel kpi-card">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Control bar */}
        <div className="glass-panel control-bar">
          <div className="control-left">
            {currentTab === 'backtest' && (
              <div className="symbol-selector">
                <label className="selector-label">Symbol:</label>
                <select className="market-select" value={activeSymbol} onChange={e => setActiveSymbol(e.target.value)}>
                  {['BTC-USDT','ETH-USDT','SOL-USDT','BNB-USDT','XRP-USDT','ADA-USDT','AVAX-USDT'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            {currentTab === 'dashboard' && (
              <>
                <span className="control-title">📈 SWING TRADER</span>

                <div className="control-divider" />

                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className={`bot-toggle-btn ${ticker?.bot_active ? 'running' : 'stopped'}`}
                  onClick={async () => {
                    await fetch('http://51.20.2.214:5000/toggle-bot', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ active: !ticker?.bot_active }),
                    });
                  }}>
                  <div className="btn-dot" />
                  {ticker?.bot_active ? 'BOT ÇALIŞIYOR · DURDUR' : 'BOT DURDU · BAŞLAT'}
                </motion.button>


                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="panic-btn"
                  onClick={async () => {
                    if (window.confirm('TÜM POZİSYONLAR SATILSIN MI? (PANIC SELL)')) {
                      await fetch('http://51.20.2.214:5000/sell-all', { method: 'POST' });
                    }
                  }}>
                  SELL ALL & STOP
                </motion.button>
              </>
            )}
          </div>

          {currentTab === 'backtest' && (
            <button className="run-sim-btn" onClick={runBacktest} disabled={loadingBacktest}>
              {loadingBacktest ? '⟳ SIMULATING…' : '▶ RUN SIMULATION'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <AnimatePresence mode="wait">

          {/* ── DASHBOARD ─────────────────────────────────────────── */}
          {currentTab === 'dashboard' && (
            <motion.section key="dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="chart-section">

              {/* 3-stat row */}
              <div className="stat-row">
                {[
                  { label: 'CAREER ROI',   value: `%${ticker?.career_roi || '0.00'}`,              color: 'var(--success-color)', sub: 'Total return' },
                  { label: 'ACTIVE UNITS', value: `${walletAssets?.managed?.length || 0}`,          color: 'var(--text-primary)',  sub: 'Managed assets' },
                  { label: 'VOLATILITY',   value: `${(ticker?.volatility ?? 0).toFixed(1)} / 100`,  color: 'var(--text-primary)', sub: 'Market index' },
                ].map((s, i) => (
                  <div key={i} className="glass-panel stat-card">
                    <div className="kpi-label">{s.label}</div>
                    <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                    <div className="kpi-sub">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Daily Summary Card Section */}
              <div style={{ marginBottom: '0.6rem' }}>
                <DailySummaryCard ticker={ticker} rate={usdToTry} />
              </div>

              {/* Portfolio */}
              <div className="glass-panel portfolio-card swing-card" style={{ borderRadius: 'var(--radius)' }}>
                <div className="portfolio-header">
                  <div className="portfolio-title swing-title">
                    <div className="dot dot-swing" />SWING PORTFOLIO
                  </div>
                  <span className="portfolio-count">{walletAssets?.managed?.length || 0} Units</span>
                </div>
                <div className="position-list">
                  {(walletAssets?.managed?.length || 0) > 0
                    ? walletAssets.managed.map((asset, i) => <PositionItem key={i} asset={asset} rate={usdToTry} />)
                    : <div className="empty-state">Swing Trader fırsat bekliyor…</div>}
                </div>
              </div>

              {/* Swing Trader Status */}
              {swingStatus && (
                <div className="status-card swing-status-card">
                  <div className="status-card-header">
                    <div className="status-card-title">
                      <div className="dot dot-swing" />
                      SWING TRADER ACTIVE — 4H STRATEGY
                    </div>
                    <div className="session-badge badge-swing">🟢 {swingStatus.personality}</div>
                  </div>
                  <div className="status-metrics">
                    {[
                      { label: 'TOPLAM İŞLEM',  value: swingStatus.total_trades },
                      { label: 'BAŞARI ORANI',  value: `%${swingStatus.win_rate}`, color: 'var(--success-color)' },
                      { label: 'SWING PNL',     value: `₺${toTL(swingStatus.total_pnl, usdToTry)} (${fmtUSD(swingStatus.total_pnl)})`, color: pnlColor(swingStatus.total_pnl || 0) },
                      { label: 'AÇIK PNL',      value: `₺${toTL(swingUnrealized, usdToTry)} (${fmtUSD(swingUnrealized)})`, color: pnlColor(swingUnrealized) },
                      { label: 'PİYASA YÖNÜ',   value: (swingStatus.total_pnl || 0) > 0 ? '🟢 BULLISH' : '⚪ NEUTRAL' },
                    ].map((m, i) => (
                      <div key={i} className="metric-cell">
                        <div className="metric-label">{m.label}</div>
                        <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Equity chart */}
              <div className="chart-card">
                <div className="chart-card-header">
                  <span className="chart-card-label">PORTFÖY DEĞERİ</span>
                  <span className="chart-card-value" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span>₺{fmtTL(currentTotalVal)}</span>
                    <span style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 500 }}>{fmtUSD(currentTotalVal / usdToTry)}</span>
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={equityHistory}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--accent-color)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis domain={[d => Math.floor(d * 0.999), d => Math.ceil(d * 1.001)]} hide />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '0.74rem' }}
                      itemStyle={{ color: 'var(--accent-color)', fontWeight: 'bold' }}
                      formatter={v => [`₺${fmtTL(v)} (${fmtUSD(v / usdToTry)})`, 'Net Varlık']}
                    />
                    <Area type="monotone" dataKey="value" stroke="var(--accent-color)" fill="url(#colorVal)"
                      strokeWidth={2.5} animationDuration={1000} isAnimationActive={equityHistory.length > 1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

            </motion.section>
          )}

          {/* ── BACKTEST / SIMULATION ────────────────────────────── */}
          {currentTab === 'backtest' && (
            <motion.section key="back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="chart-section">
              {backtestData && !backtestData.error ? (
                <>
                  <div className="stat-row">
                    {[
                      { label: 'FINAL BALANCE', value: `₺${toTL(backtestData.final_balance, usdToTry)}` },
                      { label: 'NET ROI',        value: `%${backtestData.profit_pct}`, color: pnlColor(backtestData.profit_pct || 0) },
                      { label: 'WIN RATE',       value: `%${backtestData.win_rate}` },
                      { label: 'TOTAL TRADES',   value: backtestData.total_trades },
                    ].map((k, i) => (
                      <div key={i} className="glass-panel kpi-card" style={{ borderTop: '2px solid var(--accent-color)' }}>
                        <div className="kpi-label">{k.label}</div>
                        <div className="kpi-value" style={{ color: k.color || 'var(--text-primary)', fontSize: '1.3rem' }}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="glass-panel trade-table-wrapper">
                    <table className="trade-table">
                      <thead>
                        <tr><th>TIME</th><th>TYPE</th><th>PRICE</th><th>PROFIT</th></tr>
                      </thead>
                      <tbody>
                        {backtestData.trades?.map((t, ti) => (
                          <tr key={ti}>
                            <td>{t.time}</td>
                            <td style={{ color: t.type?.includes('🟢') ? 'var(--success-color)' : 'var(--danger-color)' }}>{t.type}</td>
                            <td>${t.price?.toLocaleString()}</td>
                            <td style={{ color: t.profit != null ? pnlColor(t.profit) : 'var(--text-primary)' }}>
                              {t.profit != null ? `₺${toTL(t.profit, usdToTry)} (${fmtUSD(t.profit)})` : '---'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : backtestData?.error
                ? <div className="center-message error-text">⚠ {backtestData.error}</div>
                : <div className="center-message muted-text">Simülasyon başlatmak için "RUN SIMULATION" butonuna bas.</div>}
            </motion.section>
          )}

          {/* ── MODEL / PERFORMANCE ──────────────────────────────── */}
          {currentTab === 'performance' && (
            <motion.section key="perf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="chart-section">
              <div className="glass-panel control-bar" style={{ borderTop: '2px solid var(--accent-color)' }}>
                <div>
                  <div className="control-title">MODEL PERFORMANCE ANALİZİ</div>
                  <div className="kpi-sub" style={{ marginTop: '4px' }}>
                    {modelStats?.backtest?.date ? `Son test: ${modelStats.backtest.date}` : 'Henüz backtest çalıştırılmadı'}
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  disabled={btRunning}
                  className={`run-sim-btn ${btRunning ? 'running' : ''}`}
                  onClick={async () => { setBtRunning(true); await fetch('http://51.20.2.214:5000/run-backtest', { method: 'POST' }); }}>
                  {btRunning
                    ? <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                          style={{ width: 10, height: 10, border: '2px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%' }} />
                        ÇALIŞIYOR…</>
                    : '▶ BACKTEST BAŞLAT'}
                </motion.button>
              </div>

              {modelStats?.backtest?.total_trades > 0 ? (() => {
                const wr = modelStats.backtest.win_rate;
                const pf = modelStats.backtest.profit_factor;
                const pp = modelStats.backtest.profitable_pct;
                const pers = ticker?.personality;
                const [targetWR, targetPF] =
                  pers === 'SCALPER' ? [65, 1.2] : pers === 'DEGEN' ? [40, 2.0] : [55, 1.5];
                const score = Math.round(
                  (Math.min(wr / targetWR * 100, 100) * 0.40) +
                  (Math.min(pf / targetPF * 100, 100) * 0.35) +
                  (pp * 0.25)
                );
                const [scoreLabel, scoreColor] =
                  score >= 80 ? ['✅ GÜÇLÜ', 'var(--success-color)'] :
                  score >= 60 ? ['⚠️ ORTA', '#f59e0b'] :
                                ['❌ ZAYIF', 'var(--danger-color)'];
                return (
                  <>
                    <div className="stat-row">
                      {[
                        { label: 'WIN RATE',      value: `${wr}%`,    color: wr >= targetWR ? 'var(--success-color)' : wr >= targetWR - 5 ? '#f59e0b' : 'var(--danger-color)', sub: `hedef ≥ ${targetWR}%` },
                        { label: 'TOPLAM PNL',    value: `$${modelStats.backtest.total_pnl > 0 ? '+' : ''}${modelStats.backtest.total_pnl}`, color: modelStats.backtest.total_pnl >= 0 ? 'var(--success-color)' : 'var(--danger-color)', sub: `${modelStats.backtest.total_trades} işlem` },
                        { label: 'PROFIT FACTOR', value: pf,          color: pf >= targetPF ? 'var(--success-color)' : pf >= targetPF - 0.2 ? '#f59e0b' : 'var(--danger-color)', sub: `hedef ≥ ${targetPF}` },
                        { label: 'KÂRLI SEMBOL',  value: `${pp}%`,    color: pp >= 50 ? 'var(--success-color)' : '#f59e0b', sub: `${modelStats.backtest.symbols_tested} sembol` },
                      ].map((k, i) => (
                        <div key={i} className="glass-panel kpi-card" style={{ borderTop: `2px solid ${k.color}` }}>
                          <div className="kpi-label">{k.label}</div>
                          <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
                          {k.sub && <div className="kpi-sub">{k.sub}</div>}
                        </div>
                      ))}
                    </div>

                    <div className="glass-panel" style={{ padding: '1.25rem' }}>
                      <div className="kpi-label" style={{ marginBottom: '1rem' }}>MODEL SAĞLIK SKORU ({pers || 'SWING_TRADER'})</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ fontSize: '3rem', fontWeight: '900', color: scoreColor, lineHeight: 1 }}>{score}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: scoreColor, marginBottom: '0.5rem' }}>{scoreLabel}</div>
                          <div className="budget-bar-track">
                            <motion.div animate={{ width: `${score}%` }} transition={{ duration: 1 }}
                              style={{ height: '100%', background: scoreColor, borderRadius: '4px' }} />
                          </div>
                          <div className="kpi-sub" style={{ marginTop: '6px' }}>
                            Win Rate %{wr} · Profit Factor {pf} · Kârlı Sembol %{pp}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '1.25rem' }}>
                      <div className="kpi-label" style={{ marginBottom: '1rem' }}>SEMBOL BAZLI SONUÇLAR</div>
                      <div style={{ overflowX: 'auto' }}>
                        <table className="trade-table">
                          <thead>
                            <tr>
                              <th>SEMBOL</th>
                              <th style={{ textAlign: 'right' }}>İŞLEM</th>
                              <th style={{ textAlign: 'right' }}>WIN%</th>
                              <th style={{ textAlign: 'right' }}>PNL</th>
                              <th style={{ textAlign: 'right' }}>P.FACTOR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modelStats.backtest.per_symbol?.map((r, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: '700' }}>{r.symbol.replace('/USDT', '')}</td>
                                <td style={{ textAlign: 'right', opacity: 0.7 }}>{r.trades}</td>
                                <td style={{ textAlign: 'right', color: r.win_rate >= 55 ? 'var(--success-color)' : r.win_rate >= 50 ? '#f59e0b' : 'var(--danger-color)' }}>{r.win_rate}%</td>
                                <td style={{ textAlign: 'right', color: r.pnl >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: '700' }}>${r.pnl > 0 ? '+' : ''}{r.pnl}</td>
                                <td style={{ textAlign: 'right', opacity: 0.8 }}>{r.pf}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {modelStats?.signals && Object.keys(modelStats.signals).length > 0 && (
                      <div className="portfolio-grid">
                        {Object.entries(modelStats.signals).map(([key, s]) => (
                          <div key={key} className="glass-panel kpi-card" style={{ borderTop: `2px solid ${s.win_rate >= 55 ? 'var(--success-color)' : '#f59e0b'}` }}>
                            <div className="kpi-label">SİNYAL DOĞRULUĞU ({key})</div>
                            <div className="kpi-value" style={{ color: s.win_rate >= 55 ? 'var(--success-color)' : '#f59e0b', fontSize: '1.7rem' }}>{s.win_rate}%</div>
                            <div className="kpi-sub">Ort. {s.avg_pnl > 0 ? '+' : ''}{s.avg_pnl}% · {s.count} sinyal</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })() : (
                <div className="glass-panel center-message" style={{ flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ fontSize: '2rem' }}>🧪</div>
                  <div style={{ fontWeight: '700' }}>Henüz backtest verisi yok</div>
                  <div className="kpi-sub" style={{ textAlign: 'center', maxWidth: '300px' }}>
                    "BACKTEST BAŞLAT" butonuna bas. Bot çalışıyor olmalı ve internet bağlantısı gerekiyor. ~10 dakika sürer.
                  </div>
                </div>
              )}
            </motion.section>
          )}

        </AnimatePresence>
      </main>

      {/* ══ RIGHT PANEL ══════════════════════════════════════════════ */}
      <aside className="right-panel glass-panel">
        {/* Portfolio Summary */}
        <div className="glass-panel portfolio-summary">
          <div className="kpi-label">PORTFÖY ÖZETİ</div>
          <div className="portfolio-total">
            ₺{fmtTL(currentTotalVal)}
            <div style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '2px', fontWeight: 600 }}>
              {fmtUSD(currentTotalVal / usdToTry)}
            </div>
          </div>
          <div className="portfolio-divider" />
          <div className="pnl-row">
            <span className="kpi-sub">TOPLAM P&L (ANLIK)</span>
            <span className="pnl-live" style={{ color: pnlColor(totalPnL) }}>
              {pnlPrefix(totalPnL)}₺{fmtTL(totalPnL)}
              <span style={{ fontSize: '0.75rem', opacity: 0.8, marginLeft: '4px' }}>({fmtUSD(totalPnL / usdToTry)})</span>
            </span>
          </div>
          <div className="pnl-row" style={{ marginTop: '0.4rem' }}>
            <span className="kpi-sub">GERÇEKLEŞEN</span>
            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: pnlColor(realizedPnL) }}>
              ₺{fmtTL(realizedPnL)} <span style={{ opacity: 0.7 }}>({fmtUSD(realizedPnL / usdToTry)})</span>
            </span>
          </div>
          <div className="pnl-row" style={{ marginTop: '0.25rem' }}>
            <span className="kpi-sub">BEKLEYEN (AÇIK)</span>
            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: pnlColor(unrealizedPnLTRY) }}>
              ₺{fmtTL(unrealizedPnLTRY)} <span style={{ opacity: 0.7 }}>({fmtUSD(unrealizedPnLSum)})</span>
            </span>
          </div>
        </div>

        {/* Live Telemetry */}
        <div className="telemetry-section">
          <div className="telemetry-header">
            <div className="dot" style={{ background: '#10b981', boxShadow: '0 0 8px #10b981', width: 7, height: 7 }} />
            SYSTEM_LIVE_TELEMETRY
          </div>
          <div className="telemetry-log custom-scrollbar">
            {ticker?.logs?.slice().reverse().map((line, idx) => {
              const isBuy    = line.includes('BUY')  || line.includes('OPPORTUNITY');
              const isSell   = line.includes('SELL') || line.includes('EOD-CLOSE');
              const isProfit = line.includes('PROFIT') || (line.includes('PnL') && !line.includes('$-'));
              const isLoss   = line.includes('LOSS')  || line.includes('$-') || line.includes('FAIL');
              const isScan   = line.includes('SCANNING') || line.includes('RADAR');
              const color    = (isProfit || isBuy) ? '#10b981' : (isLoss || isSell) ? '#f87171' : isScan ? '#60a5fa' : '#d1d5db';
              const icon     = isBuy ? '🚀' : isProfit ? '📈' : isLoss ? '📉' : isSell ? '⚠️' : isScan ? '📡' : '›';
              const borderL  = (isProfit || isBuy) ? '2px solid #10b981' : (isLoss || isSell) ? '2px solid #f87171' : 'none';
              return (
                <motion.div key={idx} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                  className="log-line"
                  style={{ color, borderLeft: borderL, fontWeight: (isProfit || isBuy) ? '700' : '400', background: isProfit ? 'rgba(16,185,129,0.04)' : 'transparent' }}>
                  <span className="log-icon">{icon}</span>
                  <span>{line}</span>
                </motion.div>
              );
            })}

            <div className="log-cursor">
              <span style={{ color: '#10b981', fontWeight: 900 }}>$</span>
              <motion.div animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }}
                style={{ width: 6, height: 12, background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            </div>

            {(!ticker?.logs || ticker.logs.length === 0) && (
              <div className="log-empty">Initializing neural link…</div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default App;
