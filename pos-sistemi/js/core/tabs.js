// ===== TAB YÖNETİMİ - KORUNMUŞ DOSYA =====
// Bu dosya tab işlevlerini yönetir ve değiştirilmemelidir
// Tarih: 10.09.2025

console.log('📁 Tab modülü yüklendi');

// ===== TAB YÖNETİMİ SİSTEMİ =====

// Tab management - Basit ve güvenilir
function showTab(tabName) {
    console.log('🔄 Tab değiştiriliyor:', tabName);
    
    // Tüm tab'ları gizle
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });
    
    // Seçilen tab'ı göster
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.style.display = 'block';
        selectedTab.classList.add('active');
        console.log('✅ Tab gösterildi:', tabName);
    } else {
        console.error('❌ Tab bulunamadı:', tabName);
        return;
    }
    
    // Nav item'ları güncelle
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-tab') === tabName) {
            item.classList.add('active');
        }
    });
    
    // Page title güncelle
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        const titles = {
            'dashboard': 'Dashboard',
            'sales': 'Satış',
            'products': 'Ürünler',
            'reports': 'Raporlar',
            'charts': 'Grafikler',
            'settings': 'Ayarlar'
        };
        pageTitle.textContent = titles[tabName] || 'Dashboard';
    }
    
    // Load tab specific content
    loadTabContent(tabName);
}

// Load tab specific content
async function loadTabContent(tabName) {
    console.log('📄 Tab içeriği yükleniyor:', tabName);
    
    try {
        // Tab modüllerini dinamik olarak yükle
        switch(tabName) {
            case 'dashboard':
                await loadDashboardModule();
                break;
            case 'sales':
                await loadSalesModule();
                break;
            case 'products':
                await loadProductsModule();
                break;
            case 'reports':
                await loadReportsModule();
                break;
            case 'charts':
                await loadChartsModule();
                break;
            case 'settings':
                await loadSettingsModule();
                break;
            default:
                console.warn('⚠️ Bilinmeyen tab:', tabName);
        }
    } catch (error) {
        console.error('❌ Tab içerik yükleme hatası:', error);
    }
}

// Tab modüllerini yükleme fonksiyonları
async function loadDashboardModule() {
    console.log('📊 Dashboard modülü yükleniyor...');
    if (typeof loadDashboardContent === 'function') {
        await loadDashboardContent();
    }
}

async function loadSalesModule() {
    console.log('🛒 Sales modülü yükleniyor...');
    if (typeof loadSalesContent === 'function') {
        await loadSalesContent();
    }
}

async function loadProductsModule() {
    console.log('📦 Products modülü yükleniyor...');
    if (typeof loadProductsContent === 'function') {
        await loadProductsContent();
    }
}

async function loadReportsModule() {
    console.log('📈 Reports modülü yükleniyor...');
    if (typeof loadReportsContent === 'function') {
        await loadReportsContent();
    }
}

async function loadChartsModule() {
    console.log('📊 Charts modülü yükleniyor...');
    if (typeof loadChartsContent === 'function') {
        await loadChartsContent();
    }
}

async function loadSettingsModule() {
    console.log('⚙️ Settings modülü yükleniyor...');
    // Settings modülü burada yüklenecek
}

// Tab modülünü global olarak erişilebilir yap
window.showTab = showTab;
window.loadTabContent = loadTabContent;
window.loadDashboardModule = loadDashboardModule;
window.loadSalesModule = loadSalesModule;
window.loadProductsModule = loadProductsModule;
window.loadReportsModule = loadReportsModule;
window.loadChartsModule = loadChartsModule;
window.loadSettingsModule = loadSettingsModule;

console.log('✅ Tab modülü hazır');
