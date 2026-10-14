import React from 'react';

/**
 * HataYakalayici (ErrorBoundary)
 * Uygulama içinde oluşabilecek beklenmedik JavaScript hatalarını yakalar
 * ve uygulamanın tamamen çökmesini (beyaz ekran) engeller.
 */
class HataYakalayici extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Bir sonraki render'da hata ekranını göstermek için state'i güncelle
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Hatayı bir log servisine gönderebilirsin (isteğe bağlı)
        console.error("Hata Yakalandı:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            // Hata oluştuğunda gösterilecek premium arayüz
            return (
                <div style={styles.container}>
                    <div style={styles.card}>
                        <div style={styles.icon}>⚠️</div>
                        <h1 style={styles.title}>Eyvah! Bir Hata Oluştu</h1>
                        <p style={styles.text}>
                            Uygulama beklenmedik bir durumla karşılaştı. Endişelenme, verilerin güvende!
                        </p>
                        
                        <div style={styles.errorBox}>
                            <p style={styles.errorLabel}>Hata Detayı:</p>
                            <code style={styles.errorCode}>
                                {this.state.error && this.state.error.toString()}
                            </code>
                        </div>

                        <div style={styles.buttonGroup}>
                            <button 
                                onClick={() => window.location.reload()} 
                                style={styles.primaryButton}
                            >
                                Sayfayı Yenile
                            </button>
                            <button 
                                onClick={() => this.setState({ hasError: false })} 
                                style={styles.secondaryButton}
                            >
                                Geri Dönmeyi Dene
                            </button>
                        </div>
                        
                        <p style={styles.footerText}>
                            Hata devam ederse lütfen geliştirici ile iletişime geçin.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Inline stiller (Premium Görünüm)
const styles = {
    container: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px',
    },
    card: {
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '40px',
        maxWidth: '500px',
        textAlign: 'center',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
    },
    icon: {
        fontSize: '64px',
        marginBottom: '20px',
    },
    title: {
        color: '#f8fafc',
        fontSize: '28px',
        fontWeight: 'bold',
        marginBottom: '10px',
        background: 'linear-gradient(to right, #ffd6ff, #e7c6ff)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    text: {
        color: '#94a3b8',
        fontSize: '16px',
        lineHeight: '1.6',
        marginBottom: '30px',
    },
    errorBox: {
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '12px',
        padding: '15px',
        marginBottom: '30px',
        textAlign: 'left',
        borderLeft: '4px solid #ef4444',
    },
    errorLabel: {
        color: '#ef4444',
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: '5px',
    },
    errorCode: {
        color: '#cbd5e1',
        fontSize: '14px',
        wordBreak: 'break-all',
    },
    buttonGroup: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
        flexWrap: 'wrap',
    },
    primaryButton: {
        background: 'linear-gradient(to right, #818cf8, #6366f1)',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'transform 0.2s',
        boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
    },
    secondaryButton: {
        background: 'rgba(255, 255, 255, 0.1)',
        color: '#f8fafc',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '12px 24px',
        borderRadius: '12px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    footerText: {
        marginTop: '30px',
        color: '#64748b',
        fontSize: '12px',
    }
};

export default HataYakalayici;
