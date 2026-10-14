import React, { useState, useEffect } from 'react';
import { Terminal, Trash2, X, Bug, Info, RefreshCw } from 'lucide-react';

/**
 * DebugPanel
 * Sadece geliştirme ortamında çalışan, uygulama durumunu ve 
 * hataları takip etmeni sağlayan yardımcı panel.
 */
const DebugPanel = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [logs, setLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('logs');

    // Console loglarını yakala
    useEffect(() => {
        if (!import.meta.env.DEV) return;

        const originalLog = console.log;
        const originalError = console.error;

        console.log = (...args) => {
            setLogs(prev => [...prev.slice(-19), { type: 'log', text: args.join(' '), time: new Date().toLocaleTimeString() }]);
            originalLog.apply(console, args);
        };

        console.error = (...args) => {
            setLogs(prev => [...prev.slice(-19), { type: 'error', text: args.join(' '), time: new Date().toLocaleTimeString() }]);
            originalError.apply(console, args);
        };

        return () => {
            console.log = originalLog;
            console.error = originalError;
        };
    }, []);

    if (!import.meta.env.DEV) return null;

    const clearStorage = () => {
        if (window.confirm('Tüm yerel veriler (localStorage) silinecek. Emin misin?')) {
            localStorage.clear();
            window.location.reload();
        }
    };

    return (
        <>
            {/* Küçük Açma Butonu */}
            {!isVisible && (
                <button 
                    onClick={() => setIsVisible(true)}
                    style={styles.toggleBtn}
                    title="Hata Ayıklama Panelini Aç"
                >
                    <Bug size={18} />
                </button>
            )}

            {/* Ana Panel */}
            {isVisible && (
                <div style={styles.panel}>
                    <div style={styles.header}>
                        <div style={styles.headerTitle}>
                            <Bug size={16} />
                            <span>Geliştirici Paneli</span>
                        </div>
                        <button onClick={() => setIsVisible(false)} style={styles.closeBtn}>
                            <X size={18} />
                        </button>
                    </div>

                    <div style={styles.tabs}>
                        <button 
                            onClick={() => setActiveTab('logs')} 
                            style={activeTab === 'logs' ? styles.activeTab : styles.tab}
                        >
                            <Terminal size={14} /> Loglar
                        </button>
                        <button 
                            onClick={() => setActiveTab('tools')} 
                            style={activeTab === 'tools' ? styles.activeTab : styles.tab}
                        >
                            <RefreshCw size={14} /> Araçlar
                        </button>
                        <button 
                            onClick={() => setActiveTab('info')} 
                            style={activeTab === 'info' ? styles.activeTab : styles.tab}
                        >
                            <Info size={14} /> Sistem
                        </button>
                    </div>

                    <div style={styles.content}>
                        {activeTab === 'logs' && (
                            <div style={styles.logList}>
                                {logs.length === 0 ? (
                                    <p style={styles.emptyText}>Henüz log yok...</p>
                                ) : (
                                    logs.map((log, i) => (
                                        <div key={i} style={log.type === 'error' ? styles.errorLog : styles.logItem}>
                                            <span style={styles.logTime}>[{log.time}]</span> {log.text}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'tools' && (
                            <div style={styles.toolGrid}>
                                <button onClick={clearStorage} style={styles.actionBtn}>
                                    <Trash2 size={16} /> Verileri Temizle (Reset)
                                </button>
                                <button onClick={() => window.location.reload()} style={styles.actionBtn}>
                                    <RefreshCw size={16} /> Uygulamayı Yeniden Başlat
                                </button>
                            </div>
                        )}

                        {activeTab === 'info' && (
                            <div style={styles.infoList}>
                                <div><strong>Mod:</strong> {import.meta.env.MODE}</div>
                                <div><strong>Ekran:</strong> {window.innerWidth}x{window.innerHeight}</div>
                                <div><strong>Tarayıcı:</strong> {navigator.userAgent.substring(0, 30)}...</div>
                                <div><strong>Zaman:</strong> {new Date().toLocaleTimeString()}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

const styles = {
    toggleBtn: {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: '#6366f1',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        transition: 'transform 0.2s',
    },
    panel: {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '320px',
        height: '400px',
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        zIndex: 9999,
        overflow: 'hidden',
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '12px',
    },
    header: {
        padding: '12px',
        background: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #334155',
    },
    headerTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontWeight: 'bold',
        color: '#818cf8',
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        color: '#64748b',
        cursor: 'pointer',
    },
    tabs: {
        display: 'flex',
        background: '#0f172a',
        padding: '0 5px',
    },
    tab: {
        flex: 1,
        padding: '8px',
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        cursor: 'pointer',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
    },
    activeTab: {
        flex: 1,
        padding: '8px',
        background: '#1e293b',
        border: 'none',
        borderTop: '2px solid #6366f1',
        color: '#f8fafc',
        cursor: 'pointer',
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
    },
    content: {
        flex: 1,
        padding: '10px',
        overflowY: 'auto',
    },
    logList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    logItem: {
        padding: '4px',
        borderBottom: '1px solid #334155',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
    },
    errorLog: {
        padding: '4px',
        borderBottom: '1px solid #334155',
        color: '#fca5a5',
        background: 'rgba(153, 27, 27, 0.2)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
    },
    logTime: {
        color: '#64748b',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: '40px',
        color: '#64748b',
    },
    toolGrid: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    actionBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px',
        background: '#334155',
        border: '1px solid #475569',
        borderRadius: '8px',
        color: 'white',
        cursor: 'pointer',
        fontSize: '11px',
        textAlign: 'left',
    },
    infoList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        color: '#94a3b8',
    }
};

export default DebugPanel;
