// ===== ANA UYGULAMA BAŞLATMA - KORUNMUŞ DOSYA =====
// Bu dosya uygulamanın ana başlatma işlevlerini yönetir
// Tarih: 10.09.2025

console.log('📁 App modülü yüklendi');

// ===== UYGULAMA BAŞLATMA SİSTEMİ =====

// Global değişkenler
const POS = {
    charts: {},
    timeouts: {
        filterTimeout: null,
        searchTimeout: null
    },
    ui: {
        isInitialized: false
    },
    modules: {
        loaded: []
    }
};

// Uygulamayı başlat
async function initializeApp() {
    console.log('🚀 POS Uygulaması başlatılıyor...');
    
    try {
        // 1. Veritabanını başlat
        console.log('📊 Veritabanı başlatılıyor...');
        const dbResult = await initializeDatabase();
        if (!dbResult) {
            console.warn('⚠️ Veritabanı başlatılamadı, devam ediliyor...');
        }
        
        // 2. Sidebar durumunu geri yükle
        console.log('📱 Sidebar durumu geri yükleniyor...');
        restoreSidebarState();
        
        // 3. UI'yi işaretle
        POS.ui.isInitialized = true;
        
        // 4. Dashboard'u göster
        console.log('📄 Dashboard gösteriliyor...');
        showTab('dashboard');
        
        // 5. Başlatma tamamlandı
        console.log('🎉 POS Uygulaması başarıyla başlatıldı!');
        
        return true;
        
    } catch (error) {
        console.error('❌ Uygulama başlatma hatası:', error);
        return false;
    }
}

// Uygulama durumunu kontrol et
function checkAppStatus() {
    console.log('📊 Uygulama durumu kontrol ediliyor...');
    
    const status = {
        initialized: POS.ui.isInitialized,
        modules: POS.modules.loaded,
        timestamp: new Date().toISOString()
    };
    
    console.log('✅ Uygulama durumu:', status);
    return status;
}

// Uygulamayı yeniden başlat
async function restartApp() {
    console.log('🔄 Uygulama yeniden başlatılıyor...');
    
    try {
        // Mevcut durumu temizle
        POS.ui.isInitialized = false;
        POS.modules.loaded = [];
        
        // Yeniden başlat
        const result = await initializeApp();
        
        if (result) {
            console.log('✅ Uygulama başarıyla yeniden başlatıldı');
        } else {
            console.error('❌ Uygulama yeniden başlatılamadı');
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Uygulama yeniden başlatma hatası:', error);
        return false;
    }
}

// App modülünü global olarak erişilebilir yap
window.POS = POS;
window.initializeApp = initializeApp;
window.checkAppStatus = checkAppStatus;
window.restartApp = restartApp;

console.log('✅ App modülü hazır');

