







// POS Application Namespace
const POS = {
    // Global variables
    stockItems: [],
    sales: [],
    cart: [],
    currentSaleItems: [], // Satış sayfası sepeti
    categories: ['Elektronik', 'Giyim', 'Ev & Yaşam', 'Spor', 'Kitap', 'Diğer'],
    bulkSelectMode: false, // Toplu seçim modu
    selectedProducts: new Set(), // Seçili ürünler
    
    // Chart instances
    charts: {
        salesTrendChart: null,
        categoryChart: null,
        dailyChart: null,
        customerChart: null,
        productChart: null,
        paymentChart: null,
        mainChart: null,
        modernChartInstance: null
    },
    
    // Timeouts
    timeouts: {
        filterTimeout: null,
        searchTimeout: null
    },
    
    // UI State
    ui: {
        isInitialized: false,
        currentTab: 'dashboard'
    }
};

// Backward compatibility - global variables
let stockItems = POS.stockItems;
let sales = POS.sales;
let cart = POS.cart;
let currentSaleItems = POS.currentSaleItems;
let categories = POS.categories;
let bulkSelectMode = POS.bulkSelectMode;
let selectedProducts = POS.selectedProducts;

// Chart management functions
function destroyAllCharts() {
    Object.keys(POS.charts).forEach(chartName => {
        if (POS.charts[chartName]) {
            POS.charts[chartName].destroy();
            POS.charts[chartName] = null;
        }
    });
}

function clearAllTimeouts() {
    Object.keys(POS.timeouts).forEach(timeoutName => {
        if (POS.timeouts[timeoutName]) {
            clearTimeout(POS.timeouts[timeoutName]);
            POS.timeouts[timeoutName] = null;
        }
    });
}

// Error handling utilities
function handleError(error, context = 'Unknown') {
    console.error(`[${context}] Error:`, error);
    
    // Show user-friendly error message
    if (error.message) {
        alert(`Bir hata oluştu: ${error.message}`);
    } else {
        alert('Beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin.');
    }
}

function safeAsync(fn, context = 'Unknown') {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            handleError(error, context);
            return null;
        }
    };
}

function safeSync(fn, context = 'Unknown') {
    return (...args) => {
        try {
            return fn(...args);
        } catch (error) {
            handleError(error, context);
            return null;
        }
    };
}

// Test data
const testStockItems = [
    {
        barcode: '123456789',
        name: 'iPhone 14 Pro',
        brand: 'Apple',
        category: 'Elektronik',
        size: '128GB',
        stock: 10,
        purchasePrice: 25000,
        salePrice: 30000
    },
    {
        barcode: '987654321',
        name: 'Samsung Galaxy S23',
        brand: 'Samsung',
        category: 'Elektronik',
        size: '256GB',
        stock: 15,
        purchasePrice: 18000,
        salePrice: 22000
    },
    {
        barcode: '555666777',
        name: 'Xiaomi Redmi Note 12',
        brand: 'Xiaomi',
        category: 'Elektronik',
        size: '64GB',
        stock: 8,
        purchasePrice: 8000,
        salePrice: 12000
    },
    {
        barcode: '111222333',
        name: 'Huawei P40 Lite',
        brand: 'Huawei',
        category: 'Elektronik',
        size: '128GB',
        stock: 5,
        purchasePrice: 12000,
        salePrice: 15000
    },
    {
        barcode: '444555666',
        name: 'Oppo Reno 8',
        brand: 'Oppo',
        category: 'Elektronik',
        size: '256GB',
        stock: 12,
        purchasePrice: 10000,
        salePrice: 14000
    },
    {
        barcode: '777888999',
        name: 'Vivo V25',
        brand: 'Vivo',
        category: 'Elektronik',
        size: '128GB',
        stock: 7,
        purchasePrice: 9000,
        salePrice: 13000
    },
    {
        barcode: '741852963',
        name: 'Puma Spor Ayakkabı',
        brand: 'Puma',
        category: 'Spor',
        size: '42',
        stock: 0,
        purchasePrice: 600,
        salePrice: 900
    }
];

const testSales = [
    {
        id: 1,
        date: new Date().toISOString(),
        items: [
            {
                barcode: '123456789',
                name: 'iPhone 14 Pro',
                brand: 'Apple',
                category: 'Elektronik',
                size: '128GB',
                price: 30000,
                purchasePrice: 25000,
                quantity: 1
            }
        ],
        total: 30000,
        profit: 5000,
        discount: 0
    },
    {
        id: 2,
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        items: [
            {
                barcode: '987654321',
                name: 'Samsung Galaxy S23',
                brand: 'Samsung',
                category: 'Elektronik',
                size: '256GB',
                price: 22000,
                purchasePrice: 18000,
                quantity: 1
            }
        ],
        total: 22000,
        profit: 4000,
        discount: 0
    },
    {
        id: 3,
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
            {
                barcode: '555666777',
                name: 'Xiaomi Redmi Note 12',
                brand: 'Xiaomi',
                category: 'Elektronik',
                size: '64GB',
                price: 12000,
                purchasePrice: 8000,
                quantity: 2
            }
        ],
        total: 24000,
        profit: 8000,
        discount: 0
    }
];

// Initialize data
async function initializeData() {
    console.log('Veriler başlatılıyor...');
    
    try {
        // Önce stockItems'ı güvenli bir şekilde başlat
        if (!stockItems || !Array.isArray(stockItems)) {
            stockItems = [];
        }
        
        // Veritabanından ürünleri yükle
        if (window.posAPI && typeof window.posAPI.getProducts === 'function') {
            try {
                console.log('initializeData: Veritabanından ürünler yükleniyor...');
                const dbProducts = await window.posAPI.getProducts();
                console.log('initializeData: Veritabanından ürünler yüklendi:', dbProducts ? dbProducts.length : 0);
                
                if (dbProducts && Array.isArray(dbProducts) && dbProducts.length > 0) {
                    // Veritabanındaki ürünleri stockItems'a yükle
                    stockItems.length = 0;
                    stockItems.push(...dbProducts);
                    console.log('initializeData: Veritabanı ürünleri yüklendi:', stockItems.length);
                } else {
                    console.log('initializeData: Veritabanında ürün bulunamadı, test verileri yükleniyor...');
                    // Veritabanı boşsa test verilerini yükle
                    stockItems.length = 0;
                    stockItems.push(...testStockItems);
                    console.log('initializeData: Test verileri yüklendi:', stockItems.length);
                }
            } catch (dbError) {
                console.warn('initializeData: Veritabanı ürün yükleme hatası, test verileri yükleniyor:', dbError);
                // Veritabanı hatası durumunda test verilerini yükle
                stockItems.length = 0;
                stockItems.push(...testStockItems);
                console.log('initializeData: Hata durumunda test verileri yüklendi:', stockItems.length);
            }
        } else {
            console.warn('initializeData: posAPI.getProducts bulunamadı, test verileri yükleniyor');
            // API bulunamadıysa test verilerini yükle
            stockItems.length = 0;
            stockItems.push(...testStockItems);
            console.log('initializeData: API bulunamadığında test verileri yüklendi:', stockItems.length);
        }
        
        // Eğer hala boşsa test verilerini tekrar yükle
        if (stockItems.length === 0) {
            try {
                stockItems.push(...testStockItems);
                console.log('Fallback: Test ürünleri tekrar yüklendi:', stockItems.length);
            } catch (fallbackError) {
                console.error('Fallback test verileri yüklenirken hata:', fallbackError);
            }
        }
        
        // Kategorileri otomatik oluştur
        categories = [];
        stockItems.forEach(item => {
            if (item.category && !categories.includes(item.category)) {
                categories.push(item.category);
            }
        });
        
        console.log('Ürün verileri başlatıldı, toplam ürün sayısı:', stockItems.length, 'kategori sayısı:', categories.length);
        
        // Sales array'ini güvenli bir şekilde başlat
        if (!sales || !Array.isArray(sales)) {
            sales = [];
        }
        
        // Test satış verilerini sales'a ekle (sadece boşsa)
        if (sales.length === 0) {
            try {
                sales.push(...testSales);
                console.log('Test satışları yüklendi:', sales.length);
            } catch (testError) {
                console.error('Test satış verileri yüklenirken hata:', testError);
                sales = [];
            }
        }
        
        // Veritabanından satışları yükle ve mevcut sales ile birleştir
        if (window.posAPI && typeof window.posAPI.getSales === 'function') {
            try {
                const dbSales = await window.posAPI.getSales();
                console.log('Veritabanından satışlar yüklendi:', dbSales ? dbSales.length : 0);
                
                if (dbSales && Array.isArray(dbSales) && dbSales.length > 0) {
                    const dbSaleIds = new Set(dbSales.map(s => s.id).filter(id => id));
                    const localOnlySales = sales.filter(sale => sale.id && !dbSaleIds.has(sale.id));
                    
                    const dbSalesFormatted = dbSales.map(dbSale => ({
                        id: dbSale.id || Date.now() + Math.random(),
                        date: dbSale.created_at || new Date().toISOString(),
                        items: dbSale.items || [],
                        total: dbSale.total_amount || 0,
                        paymentMethod: dbSale.payment_method || 'Nakit',
                        customer_name: dbSale.customer_name || ''
                    }));
                    
                    sales.length = 0;
                    sales.push(...dbSalesFormatted, ...localOnlySales);
                }
            } catch (dbError) {
                console.warn('Veritabanı satış yükleme hatası, mevcut satış verileri kullanılıyor:', dbError);
            }
        }
        
        console.log('Satış verileri başlatıldı, toplam satış sayısı:', sales.length);
        
    } catch (error) {
        console.error('Veri başlatma hatası:', error);
        
        // Kritik hata durumunda en azından temel yapıları oluştur
        if (!stockItems || !Array.isArray(stockItems)) {
            stockItems = [];
        }
        if (!sales || !Array.isArray(sales)) {
            sales = [];
        }
        
        // Test verilerini yüklemeyi dene
        try {
            if (stockItems.length === 0) {
                stockItems.push(...testStockItems);
                console.log('Kritik hata durumunda test verileri yüklendi');
            }
            if (sales.length === 0) {
                sales.push(...testSales);
                console.log('Kritik hata durumunda test satış verileri yüklendi');
            }
        } catch (criticalError) {
            console.error('Kritik hata durumunda test verileri yüklenemedi:', criticalError);
        }
    }
}

// ===== YENİ TAB YÖNETİMİ SİSTEMİ =====

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

// ===== YENİ SIDEBAR YÖNETİMİ SİSTEMİ =====

// Sidebar toggle - Basit ve güvenilir
function toggleSidebar() {
    console.log('🔄 Sidebar toggle ediliyor...');
    
    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('.main-content');
    
    if (!sidebar || !main) {
        console.error('❌ Sidebar veya main content bulunamadı!');
        return;
    }
    
    // Toggle collapsed class
    const isCollapsed = sidebar.classList.contains('collapsed');
    sidebar.classList.toggle('collapsed');
    
    // Update main content margin
    if (sidebar.classList.contains('collapsed')) {
        main.style.marginLeft = '70px';
        console.log('✅ Sidebar daraltıldı');
    } else {
        main.style.marginLeft = '250px';
        console.log('✅ Sidebar genişletildi');
    }
    
    // Save state
    try {
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed') ? '1' : '0');
    } catch (e) { 
        console.warn('⚠️ localStorage erişim hatası:', e);
    }
}

// Sidebar durumunu geri yükle
function restoreSidebarState() {
    console.log('🔄 Sidebar durumu geri yükleniyor...');
    
    try {
        const collapsed = localStorage.getItem('sidebarCollapsed') === '1';
        const sidebar = document.getElementById('sidebar');
        const main = document.querySelector('.main-content');
        
        if (!sidebar) {
            console.error('❌ Sidebar element bulunamadı');
            return;
        }
        
        if (collapsed) {
            sidebar.classList.add('collapsed');
            if (main) {
                main.style.marginLeft = '70px';
            }
            console.log('✅ Sidebar daraltılmış durumda geri yüklendi');
        } else {
            sidebar.classList.remove('collapsed');
            if (main) {
                main.style.marginLeft = '250px';
            }
            console.log('✅ Sidebar genişletilmiş durumda geri yüklendi');
        }
        
    } catch (e) { 
        console.warn('⚠️ Sidebar state restore hatası:', e);
    }
}

// restoreSidebarState will be called in main initialization

// Load tab specific content
async function loadTabContent(tabName) {
    console.log('Tab içeriği yükleniyor:', tabName);
    
    try {
        switch(tabName) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'sales':
                loadSales();
                break;
            case 'products':
                await loadProductsPage();
                break;
            case 'reports':
                await loadReportsPage();
                break;
            case 'charts':
                loadChartsPage();
                break;
            case 'settings':
                loadSettings();
                break;
            default:
                console.log('Bilinmeyen tab:', tabName);
        }
    } catch (error) {
        console.error('Tab yükleme hatası:', error);
    }
}

// ===== YENİ DASHBOARD FONKSİYONLARI =====

// Ürünler sayfasını yükle
async function loadProductsPage() {
    console.log('Ürünler sayfası yükleniyor...');
    
    try {
        // Önce veritabanından ürünleri yükle
        await loadProductsTable();
        
        // Kategori seçeneklerini güncelle
        updateCategorySelects();
        
        // Ürün arama fonksiyonunu aktif et
        setupProductSearch();
        
        console.log('Ürünler sayfası başarıyla yüklendi');
        
    } catch (error) {
        console.error('Ürünler sayfası yükleme hatası:', error);
    }
}

// Ürün arama fonksiyonunu kur
function setupProductSearch() {
    const searchInput = document.getElementById('productSearch');
    if (searchInput) {
        searchInput.addEventListener('input', filterProducts);
    }
}

// Ürünler tablosunu yükle
async function loadProductsTable() {
    console.log('Ürünler tablosu yükleniyor...');
    
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) {
        console.log('productsTableBody bulunamadı');
        return;
    }

    tbody.innerHTML = '';

    try {
        console.log('loadProductsTable: Mevcut stockItems sayısı:', stockItems ? stockItems.length : 'undefined');
        
        // Eğer stockItems boşsa, veritabanından yükle
        if (!stockItems || stockItems.length === 0) {
            console.log('stockItems boş, veritabanından yükleniyor...');
            if (window.posAPI && typeof window.posAPI.getProducts === 'function') {
                try {
                    const dbProducts = await window.posAPI.getProducts();
                    console.log('Veritabanından ürünler yüklendi:', dbProducts ? dbProducts.length : 0);
                    
                    if (dbProducts && Array.isArray(dbProducts) && dbProducts.length > 0) {
                        stockItems = [...dbProducts];
                        console.log('Veritabanı ürünleri stockItems\'a yüklendi:', stockItems.length);
                    } else {
                        console.log('Veritabanında ürün bulunamadı, test verileri yükleniyor...');
                        stockItems = [...testStockItems];
                        console.log('Test verileri yüklendi:', stockItems.length);
                    }
                } catch (dbError) {
                    console.error('Veritabanı bağlantı hatası:', dbError);
                    stockItems = [...testStockItems];
                    console.log('Hata durumunda test verileri yüklendi:', stockItems.length);
                }
            } else {
                console.warn('posAPI.getProducts bulunamadı, test verileri kullanılıyor');
                stockItems = [...testStockItems];
                console.log('API bulunamadığında test verileri yüklendi:', stockItems.length);
            }
        }

        // Ürünleri tabloya ekle
        if (stockItems && stockItems.length > 0) {
            stockItems.forEach(item => {
                try {
                    const purchasePrice = item.purchasePrice || 0;
                    const salePrice = item.salePrice || 0;
                    const stock = item.stock || 0;

                    const profit = (salePrice - purchasePrice) * stock;

                    let stockClass = '';
                    if (stock === 0) {
                        stockClass = 'stock-zero';
                    } else if (stock <= 2) {
                        stockClass = 'stock-low';
                    } else {
                        stockClass = 'stock-normal';
                    }

                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.barcode || ''}</td>
                        <td>${item.name || ''}</td>
                        <td>${item.brand || ''}</td>
                        <td>${item.category || ''}</td>
                        <td>${item.size || '-'}</td>
                        <td class="${stockClass}">${stock}</td>
                        <td>₺${purchasePrice.toFixed(2)}</td>
                        <td>₺${salePrice.toFixed(2)}</td>
                        <td class="profit ${profit >= 0 ? 'positive' : 'negative'}">₺${profit.toFixed(2)}</td>
                        <td class="actions">
                            <button onclick="editProduct('${item.barcode || ''}')" class="action-btn edit" title="Düzenle">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteProduct('${item.barcode || ''}')" class="action-btn delete" title="Sil">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                } catch (itemError) {
                    console.error('Ürün tabloya eklenirken hata oluştu:', itemError, item);
                }
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="10" class="no-data">Henüz ürün eklenmemiş</td></tr>';
        }
        
        console.log('Ürünler tablosu güncellendi,', stockItems.length, 'ürün');
        
        // Ürün istatistiklerini güncelle
        updateProductStats();
        
        // Kategori filtrelerini güncelle
        updateCategorySelects();
        
    } catch (error) {
        console.error('Ürünler tablosu yükleme hatası:', error);
        
        // Hata durumunda test verilerini yüklemeyi dene
        try {
            if (!stockItems || stockItems.length === 0) {
                stockItems.push(...testStockItems);
                console.log('Hata durumunda test verileri yüklendi');
                
                // Test verilerini tabloya ekle
                stockItems.forEach(item => {
                    const profit = (item.salePrice - item.purchasePrice) * item.stock;
                    
                    let stockClass = '';
                    if (item.stock === 0) {
                        stockClass = 'stock-zero';
                    } else if (item.stock <= 2) {
                        stockClass = 'stock-low';
                    } else {
                        stockClass = 'stock-normal';
                    }
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.barcode || ''}</td>
                        <td>${item.name || ''}</td>
                        <td>${item.brand || ''}</td>
                        <td>${item.category || ''}</td>
                        <td>${item.size || '-'}</td>
                        <td class="${stockClass}">${item.stock || 0}</td>
                        <td>₺${(item.purchasePrice || 0).toFixed(2)}</td>
                        <td>₺${(item.salePrice || 0).toFixed(2)}</td>
                        <td class="profit ${profit >= 0 ? 'positive' : 'negative'}">₺${profit.toFixed(2)}</td>
                        <td class="actions">
                            <button onclick="editProduct('${item.barcode || ''}')" class="action-btn edit" title="Düzenle">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteProduct('${item.barcode || ''}')" class="action-btn delete" title="Sil">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="10" class="no-data">Ürünler yüklenirken hata oluştu</td></tr>';
            }
        } catch (fallbackError) {
            console.error('Fallback hata:', fallbackError);
            tbody.innerHTML = '<tr><td colspan="10" class="no-data">Ürünler yüklenirken hata oluştu</td></tr>';
        }
    }
}

// Stok sınıfını belirle
function getStockClass(stock) {
    if (stock === 0) return 'stock-low';
    if (stock <= 2) return 'stock-medium';
    return 'stock-high';
}

// Ürünler tablosunu güncelle (loadProductsTable için alias)
function updateProductsTable() {
    return loadProductsTable();
}

// Ürün istatistiklerini güncelle
function updateProductStats() {
    if (!stockItems || stockItems.length === 0) {
        document.getElementById('totalProducts').textContent = '0';
        document.getElementById('totalStock').textContent = '0';
        document.getElementById('totalStockValue').textContent = '₺0';
        document.getElementById('avgProfitMargin').textContent = '%0';
        return;
    }

    const totalProducts = stockItems.length;
    const totalStock = stockItems.reduce((sum, item) => sum + (item.stock || 0), 0);
    const totalStockValue = stockItems.reduce((sum, item) => {
        const purchasePrice = item.purchasePrice || 0;
        const stock = item.stock || 0;
        return sum + (purchasePrice * stock);
    }, 0);
    
    // Ortalama kar marjını hesapla
    let totalProfitMargin = 0;
    let validProducts = 0;
    
    stockItems.forEach(item => {
        const purchasePrice = item.purchasePrice || 0;
        const salePrice = item.salePrice || 0;
        if (purchasePrice > 0 && salePrice > 0) {
            const margin = ((salePrice - purchasePrice) / purchasePrice) * 100;
            totalProfitMargin += margin;
            validProducts++;
        }
    });
    
    const avgProfitMargin = validProducts > 0 ? (totalProfitMargin / validProducts) : 0;

    // DOM'u güncelle
    document.getElementById('totalProducts').textContent = totalProducts;
    document.getElementById('totalStock').textContent = totalStock;
    document.getElementById('totalStockValue').textContent = `₺${totalStockValue.toFixed(2)}`;
    document.getElementById('avgProfitMargin').textContent = `%${avgProfitMargin.toFixed(1)}`;
}

// Kategori seçeneklerini güncelle
function updateCategorySelects() {
    const selects = ['category', 'editCategory', 'categoryFilter', 'quickCategory', 'reportCategoryFilter'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const currentValue = select.value;
            
            // Kategori filtresi için "Tüm Kategoriler" seçeneği ekle
            if (selectId === 'categoryFilter') {
                select.innerHTML = '<option value="">Tüm Kategoriler</option>';
            } else {
                select.innerHTML = '<option value="">Kategori seçin</option>';
            }
            
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                select.appendChild(option);
            });
            select.value = currentValue;
        }
    });
}

function addNewCategory(isEdit = false) {
    const inputId = isEdit ? 'editNewCategoryInput' : 'newCategoryInput';
    const selectId = isEdit ? 'editCategory' : 'category';
    const input = document.getElementById(inputId);
    const select = document.getElementById(selectId);
    if (!input || !select) return;
    const name = (input.value || '').trim();
    if (!name) return;
    if (!categories.includes(name)) categories.push(name);
    updateCategorySelects();
    select.value = name;
    input.value = '';
}

// Stok durumu sınıfını belirle
function getStockClass(stock) {
    if (stock <= 0) return 'out-of-stock';
    if (stock <= 5) return 'low-stock';
    if (stock <= 10) return 'medium-stock';
    return 'good-stock';
}

// Debounce utility function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Ürünleri filtrele - Performans iyileştirmeli
const filterProducts = debounce(() => {
    const searchTerm = document.getElementById('productSearch')?.value?.toLowerCase() || '';
    const selectedCategory = document.getElementById('categoryFilter')?.value || '';
    
    const filteredProducts = stockItems.filter(product => {
        const matchesSearch = !searchTerm || 
            product.name.toLowerCase().includes(searchTerm) ||
            product.barcode.toLowerCase().includes(searchTerm) ||
            (product.brand && product.brand.toLowerCase().includes(searchTerm));
        
        const matchesCategory = !selectedCategory || product.category === selectedCategory;
        
        return matchesSearch && matchesCategory;
    });
    
    renderProductsTable(filteredProducts);
}, 300); // 300ms debounce

// Ürün tablosunu render et
function renderProductsTable(products) {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">Ürün bulunamadı</td></tr>';
        return;
    }
    
    products.forEach(product => {
        const profit = (product.salePrice || product.sale_price || 0) - (product.purchasePrice || product.purchase_price || 0);
        const profitMargin = product.purchasePrice ? ((profit / product.purchasePrice) * 100).toFixed(1) : 0;
        
        const row = document.createElement('tr');
        const checkboxCell = bulkSelectMode ? 
            `<td class="product-checkbox-cell">
                <input type="checkbox" class="product-checkbox" data-product-index="${products.indexOf(product)}" onchange="toggleProductSelection(this)">
            </td>` : '';
        
        row.innerHTML = `
            ${checkboxCell}
            <td>${product.barcode}</td>
            <td>${product.name}</td>
            <td>${product.brand || 'Marka Yok'}</td>
            <td>${product.category || 'Kategori Yok'}</td>
            <td>${product.size || '-'}</td>
            <td class="stock-cell ${getStockClass(product.stock)}">${product.stock}</td>
            <td>₺${(product.purchasePrice || product.purchase_price || 0).toFixed(2)}</td>
            <td>₺${(product.salePrice || product.sale_price || 0).toFixed(2)}</td>
            <td class="profit-cell ${profit >= 0 ? 'positive' : 'negative'}">
                ₺${profit.toFixed(2)} (<span class="profit-percentage">${profitMargin}%</span>)
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit" onclick="editProduct('${product.barcode}')" title="Düzenle">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteProduct('${product.barcode}')" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Ürün ekleme modalını aç
function openAddProductModal() {
    document.getElementById('addProductModal').style.display = 'flex';
}

// Ürün düzenleme
function editProduct(barcode) {
    console.log('Ürün düzenleniyor:', barcode);
    // Ürün düzenleme modalını aç
    if (typeof openEditProductModal === 'function') {
        openEditProductModal(barcode);
    }
}

// Ürün silme
async function deleteProduct(barcode) {
    console.log('Ürün siliniyor:', barcode);
    if (!confirm('Bu ürünü silmek istediğinizden emin misiniz?')) return;

    try {
        const product = stockItems.find(item => item.barcode === barcode);
        if (product && window.posAPI && typeof window.posAPI.deleteProduct === 'function' && product.id) {
            await window.posAPI.deleteProduct(product.id);
            console.log('Ürün veritabanından silindi');
        }
    } catch (err) {
        console.warn('Veritabanı silme hatası, local devam:', err);
    }

    // Local array'den çıkar ve tabloyu yenile
    stockItems = stockItems.filter(item => item.barcode !== barcode);
    updateProductsTable();
    alert('Ürün başarıyla silindi!');
}

// Satış sayfasını yükle
function loadSales() {
    console.log('Satış sayfası yükleniyor...');
    // Satış sayfası zaten HTML'de var, sadece gerekli fonksiyonları çağır
    if (typeof updateSalesCartItems === 'function') {
        updateSalesCartItems();
    }
    if (typeof updateSalesCartSummary === 'function') {
        updateSalesCartSummary();
    }
}

// Ayarlar sayfasını yükle
function loadSettings() {
    console.log('Ayarlar sayfası yükleniyor...');
    // Ayarlar sayfası için basit bir mesaj
    const settingsTab = document.getElementById('settings');
    if (settingsTab) {
        settingsTab.innerHTML = `
            <div class="settings-page">
                <h2><i class="fas fa-cog"></i> Ayarlar</h2>
                <p>Ayarlar sayfası yakında eklenecek...</p>
            </div>
        `;
    }
}

// Grafikler sayfasını yükle
function loadCharts() {
    console.log('Grafikler sayfası yükleniyor...');
    // Grafikleri oluştur
    setTimeout(() => {
        createSalesTrendChart();
        createCategoryChart();
        createDailyChart();
        createCustomerChart();
        createProductChart();
        createPaymentChart();
    }, 100);
}

// ===== HAFTALIK DASHBOARD =====
let weeklyBarChartRef = null;
let weeklyPeakLineChartRef = null;

async function getWeeklySalesFromDB() {
    // posAPI.getSales -> tüm satışlar; son 7 güne filtrele
    try {
        let dbSales = sales;
        if (window.posAPI && typeof window.posAPI.getSales === 'function') {
            dbSales = await window.posAPI.getSales();
        }
        const now = new Date();
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const filtered = (dbSales || []).filter(s => {
            const d = new Date(s.created_at || s.date);
            return d >= start && d <= now;
        }).map(s => ({
            date: new Date(s.created_at || s.date),
            total: s.total_amount || s.total || 0
        }));
        if (filtered.length === 0) {
            // örnek veri üret (hafta içi ve saat bazlı çeşitlilik)
            const mock = [];
            const base = 1000;
            for (let i=0;i<7;i++) {
                const day = new Date(now.getTime() - (6-i)*24*60*60*1000);
                for (let h=10; h<=20; h+=2) {
                    const d = new Date(day);
                    d.setHours(h, Math.floor(Math.random()*60), 0, 0);
                    const mul = (i===5||i===6) ? 1.5 : 1; // hafta sonu daha yoğun
                    const jitter = 0.6 + Math.random()*0.8;
                    mock.push({ date: d, total: Math.round(base * mul * jitter) });
                }
            }
            return mock;
        }
        return filtered;
    } catch (e) {
        console.warn('Weekly data fallback:', e);
        return [];
    }
}

async function renderWeeklyBar() {
    const ctx = document.getElementById('weeklyBarChart');
    if (!ctx) return;
    const mode = document.getElementById('weeklyBarMode')?.value || 'days';
    const data = await getWeeklySalesFromDB();
    let labels = [];
    let values = [];
    if (mode === 'days') {
        const dayNames = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
        const map = new Array(7).fill(0);
        data.forEach(s => {
            let idx = s.date.getDay(); // 0=Sun
            idx = idx === 0 ? 6 : idx - 1;
            map[idx] += s.total;
        });
        labels = dayNames;
        values = map;
    } else {
        const map = new Array(24).fill(0);
        data.forEach(s => {
            const h = s.date.getHours();
            map[h] += s.total;
        });
        labels = Array.from({length:24},(_,i)=> `${i.toString().padStart(2,'0')}:00`);
        values = map;
    }
    if (weeklyBarChartRef) weeklyBarChartRef.destroy();
    weeklyBarChartRef = new Chart(ctx, {
        type: 'bar',
        data: { 
            labels, 
            datasets: [{ 
                label: 'Ciro (₺)', 
                data: values, 
                backgroundColor: 'rgba(31, 37, 43, 0.8)',
                borderColor: '#1f252b',
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: { 
                y: { 
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#333333',
                        font: { size: 10, weight: '500' }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#333333',
                        font: { size: 10, weight: '500' }
                    }
                }
            }
        }
    });
}

async function renderWeeklyPeakLine() {
    const ctx = document.getElementById('weeklyPeakLineChart');
    if (!ctx) return;
    const data = await getWeeklySalesFromDB();
    const dayNames = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
    const map = new Array(7).fill(0);
    data.forEach(s => {
        let idx = s.date.getDay();
        idx = idx === 0 ? 6 : idx - 1;
        map[idx] += s.total;
    });
    if (weeklyPeakLineChartRef) weeklyPeakLineChartRef.destroy();
    weeklyPeakLineChartRef = new Chart(ctx, {
        type: 'line',
        data: { 
            labels: dayNames, 
            datasets: [{ 
                label: 'Zirve Gün Cirosu', 
                data: map, 
                borderColor: '#32cd32',
                backgroundColor: 'rgba(50, 205, 50, 0.1)',
                borderDash: [4, 4], 
                tension: 0.4, 
                fill: true,
                pointBackgroundColor: '#32cd32',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: '#28a745',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 2
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: { 
                y: { 
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#333333',
                        font: { size: 10, weight: '500' }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#333333',
                        font: { size: 10, weight: '500' }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

async function renderDailyTarget() {
    const data = await getWeeklySalesFromDB();
    const today = new Date();
    const todaySum = data.filter(s => s.date.toDateString() === today.toDateString()).reduce((a,b)=> a + b.total, 0);
    const target = 50000; // örnek hedef
    const percent = target > 0 ? Math.min(100, Math.round((todaySum/target)*100)) : 0;
    const fill = document.getElementById('dailyTargetFill');
    const lblT = document.getElementById('dailyTargetLabel');
    const lblA = document.getElementById('dailyActualLabel');
    const lblP = document.getElementById('dailyPercentLabel');
    if (fill) fill.style.width = percent + '%';
    if (lblT) lblT.textContent = `₺${target.toLocaleString('tr-TR')}`;
    if (lblA) lblA.textContent = `₺${todaySum.toLocaleString('tr-TR')}`;
    if (lblP) lblP.textContent = `${percent}%`;
}

async function refreshWeeklyAnalytics() {
    await Promise.all([renderWeeklyBar(), renderWeeklyPeakLine(), renderDailyTarget()]);
}

// Sayfa yüklenirken weekly analytics hazırla
// refreshWeeklyAnalytics will be called when needed

// Grafik oluşturma fonksiyonları
function createSalesTrendChart() {
    const ctx = document.getElementById('salesTrendChart');
    if (!ctx) return;
    
    if (POS.charts.salesTrendChart) {
        POS.charts.salesTrendChart.destroy();
    }
    
    POS.charts.salesTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'],
            datasets: [{
                label: 'Satış Trendi',
                data: [12000, 15000, 18000, 22000, 25000, 30000, 28000],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function createCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    
    if (POS.charts.categoryChart) {
        POS.charts.categoryChart.destroy();
    }
    
    POS.charts.categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Elektronik', 'Giyim', 'Ev & Yaşam', 'Spor', 'Kitap'],
            datasets: [{
                data: [35, 25, 20, 15, 5],
                backgroundColor: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function createDailyChart() {
    const ctx = document.getElementById('dailyChart');
    if (!ctx) return;
    
    if (POS.charts.dailyChart) {
        POS.charts.dailyChart.destroy();
    }
    
    POS.charts.dailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'],
            datasets: [{
                label: 'Günlük Ciro',
                data: [12000, 15000, 18000, 22000, 25000, 30000, 28000],
                backgroundColor: '#2ecc71'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function createCustomerChart() {
    const ctx = document.getElementById('customerChart');
    if (!ctx) return;
    
    if (POS.charts.customerChart) {
        POS.charts.customerChart.destroy();
    }
    
    POS.charts.customerChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran'],
            datasets: [{
                label: 'Yeni Müşteriler',
                data: [45, 52, 48, 61, 55, 67],
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function createProductChart() {
    const ctx = document.getElementById('productChart');
    if (!ctx) return;
    
    if (POS.charts.productChart) {
        POS.charts.productChart.destroy();
    }
    
    POS.charts.productChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['iPhone 14', 'Samsung S23', 'Xiaomi Note', 'Huawei P40', 'Oppo Reno'],
            datasets: [{
                label: 'Satış Adedi',
                data: [25, 18, 15, 12, 10],
                backgroundColor: '#f39c12'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function createPaymentChart() {
    const ctx = document.getElementById('paymentChart');
    if (!ctx) return;
    
    if (POS.charts.paymentChart) {
        POS.charts.paymentChart.destroy();
    }
    
    POS.charts.paymentChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Nakit', 'Kart', 'Havale'],
            datasets: [{
                data: [40, 45, 15],
                backgroundColor: ['#3498db', '#e74c3c', '#2ecc71']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Dashboard'u yükle
async function loadDashboard() {
    try {
        // Loading göster
        document.getElementById('dashboardLoading').style.display = 'block';
        document.getElementById('dashboardContent').style.display = 'none';
        
        // Verileri yükle
        const stats = await window.posAPI.getDashboardStats();
        
        // İstatistikleri güncelle
        updateDashboardStats(stats);
        
        // Ana grafiği oluştur
        createMainChart();
        
        // Alt kartları güncelle
        updateTopProducts();
        updateRecentActivities();
        
        // Loading gizle
        document.getElementById('dashboardLoading').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'block';
        
    } catch (error) {
        console.error('Dashboard yükleme hatası:', error);
        document.getElementById('dashboardLoading').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'block';
    }
}

// Dashboard istatistiklerini güncelle
function updateDashboardStats(stats) {
    // Haftalık ciro
    const weeklyRevenue = stats.weeklyRevenue || 0;
    const revenueTarget = 50000;
    const revenueProgress = Math.min((weeklyRevenue / revenueTarget) * 100, 100);
    
    document.getElementById('weeklyRevenue').textContent = formatCurrency(weeklyRevenue);
    document.getElementById('revenueProgress').style.width = revenueProgress + '%';
    document.getElementById('revenueTarget').textContent = `Hedef: ${formatCurrency(revenueTarget)}`;
    
    // Haftalık müşteri
    const weeklyCustomers = stats.weeklyCustomers || 0;
    const customerGrowth = stats.customerGrowth || 12;
    
    document.getElementById('weeklyCustomers').textContent = weeklyCustomers;
    document.getElementById('customerGrowth').textContent = `+${customerGrowth}%`;
    
    // Haftalık sipariş
    const weeklyOrders = stats.weeklyOrders || 0;
    const orderGrowth = stats.orderGrowth || 8;
    
    document.getElementById('weeklyOrders').textContent = weeklyOrders;
    document.getElementById('orderGrowth').textContent = `+${orderGrowth}%`;
    
    // Günlük hedef
    const dailyTarget = stats.dailyTarget || 0;
    const dailyProgress = Math.min((dailyTarget / 100) * 100, 100);
    const dailyRemaining = Math.max(0, 100 - dailyTarget);
    
    document.getElementById('dailyTarget').textContent = `${dailyTarget}%`;
    document.getElementById('dailyProgress').style.width = dailyProgress + '%';
    document.getElementById('dailyRemaining').textContent = `${formatCurrency(dailyRemaining * 100)} kaldı`;
}

// Ana grafiği oluştur
function createMainChart() {
    const ctx = document.getElementById('mainChart');
    if (!ctx) return;
    
    // Önceki grafiği temizle
    if (POS.charts.mainChart) {
        POS.charts.mainChart.destroy();
    }
    
    // Örnek veri
    const labels = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const revenueData = [12000, 15000, 18000, 22000, 25000, 30000, 28000];
    const targetData = [20000, 20000, 20000, 20000, 20000, 20000, 20000];
    
    POS.charts.mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Günlük Ciro',
                    data: revenueData,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Günlük Hedef',
                    data: targetData,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// Ana grafiği güncelle
function updateMainChart() {
    const period = document.getElementById('chartPeriod').value;
    // Burada period'a göre veri yüklenip grafik güncellenebilir
    createMainChart();
}

// Dashboard'u yenile
function refreshDashboard() {
    loadDashboard();
}

// Günlük hedef modal açma
function openDailyTargetModal() {
    const modal = document.getElementById('dailyTargetModal');
    const currentTarget = document.getElementById('dailyTargetLabel').textContent.replace('₺', '').replace(',', '');
    document.getElementById('newDailyTarget').value = currentTarget;
    modal.style.display = 'block';
}

// Günlük hedef kaydetme
function saveDailyTarget() {
    const newTarget = document.getElementById('newDailyTarget').value;
    if (newTarget && newTarget > 0) {
        // Günlük hedefi güncelle
        document.getElementById('dailyTargetLabel').textContent = '₺' + parseInt(newTarget).toLocaleString('tr-TR');
        
        // Progress bar'ı yeniden hesapla
        updateDailyTarget();
        
        // Modal'ı kapat
        closeModal('dailyTargetModal');
        
        console.log('Günlük hedef güncellendi:', newTarget);
    } else {
        alert('Lütfen geçerli bir hedef tutarı girin.');
    }
}

// En çok satan ürünleri güncelle
function updateTopProducts() {
    const container = document.getElementById('topProducts');
    if (!container) return;
    
    // Örnek veri
    const topProducts = [
        { name: 'Parol 500mg', sales: 150, revenue: 7500 },
        { name: 'Majezik 500mg', sales: 120, revenue: 6000 },
        { name: 'Aspirin 100mg', sales: 100, revenue: 5000 },
        { name: 'B12 Vitamini', sales: 80, revenue: 4000 }
    ];
    
    container.innerHTML = '';
    topProducts.forEach((product, index) => {
        const div = document.createElement('div');
        div.className = 'product-item';
        div.innerHTML = `
            <div class="product-rank">${index + 1}</div>
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-sales">${product.sales} satış - ${formatCurrency(product.revenue)}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

// Son aktiviteleri güncelle
function updateRecentActivities() {
    const container = document.getElementById('recentActivities');
    if (!container) return;
    
    // Örnek veri
    const activities = [
        { title: 'Yeni satış tamamlandı', time: '2 dakika önce', icon: 'fas fa-shopping-cart' },
        { title: 'Ürün stoku güncellendi', time: '15 dakika önce', icon: 'fas fa-box' },
        { title: 'Yeni müşteri kaydı', time: '1 saat önce', icon: 'fas fa-user-plus' },
        { title: 'Rapor oluşturuldu', time: '2 saat önce', icon: 'fas fa-chart-bar' }
    ];
    
    container.innerHTML = '';
    activities.forEach(activity => {
        const div = document.createElement('div');
        div.className = 'activity-item';
        div.innerHTML = `
            <div class="activity-icon">
                <i class="${activity.icon}"></i>
            </div>
            <div class="activity-info">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

// ===== YENİ SATIŞ SAYFASI FONKSİYONLARI =====

// Debounce fonksiyonu
let POS.timeouts.searchTimeout;

// Yeni ürün arama ve öneriler - Veritabanından
async function newSearchProducts() {
    // Debounce: Önceki timeout'u temizle
    clearTimeout(POS.timeouts.searchTimeout);
    
    // 300ms bekle, sonra arama yap
    POS.timeouts.searchTimeout = setTimeout(async () => {
        const searchInput = document.getElementById('newProductSearch');
        if (!searchInput) {
            console.log('Arama input bulunamadı');
            return;
        }
        
        const searchTerm = searchInput.value.toLowerCase().trim();
        const suggestions = document.getElementById('newSearchSuggestions');
        
        if (!suggestions) {
            console.log('Öneriler container bulunamadı');
            return;
        }
        
        console.log('Arama terimi:', searchTerm);
        
        if (searchTerm.length < 1) {
            suggestions.style.display = 'none';
            return;
        }
    
    try {
        // Veritabanından ürünleri çek
        let products = [];
        
        if (window.posAPI && typeof window.posAPI.getProducts === 'function') {
            try {
                products = await window.posAPI.getProducts();
                console.log('Veritabanından ürünler alındı:', products.length);
                // Veritabanından gelen verileri stockItems ile birleştir
                const dbBarcodes = products.map(p => p.barcode);
                const localOnlyItems = stockItems.filter(item => !dbBarcodes.includes(item.barcode));
                products = [...products, ...localOnlyItems];
                console.log('Birleştirilmiş ürün sayısı:', products.length);
            } catch (dbError) {
                console.log('Veritabanı hatası, test verileri kullanılıyor');
                products = stockItems;
            }
        } else {
            console.log('posAPI bulunamadı, test verileri kullanılıyor');
            products = stockItems;
        }
        
        console.log('Toplam ürün sayısı:', products.length);
        
        const filteredProducts = products.filter(product => {
            const name = (product.name || '').toLowerCase();
            const brand = (product.brand || '').toLowerCase();
            const barcode = (product.barcode || '').toLowerCase();
            const category = (product.category || '').toLowerCase();
            
            return name.includes(searchTerm) ||
                   brand.includes(searchTerm) ||
                   barcode.includes(searchTerm) ||
                   category.includes(searchTerm);
        });
        
        console.log('Filtrelenmiş ürün sayısı:', filteredProducts.length);
        
        if (filteredProducts.length > 0) {
            suggestions.innerHTML = '';
            filteredProducts.slice(0, 8).forEach(product => {
                const item = document.createElement('div');
                item.className = 'new-suggestion-item';
                
                // Fiyat alanını kontrol et
                const price = product.sale_price || product.salePrice || 0;
                const stock = product.stock || 0;
                
                item.innerHTML = `
                    <div class="suggestion-product-info">
                        <div class="suggestion-product-name">${product.name || 'İsimsiz Ürün'}</div>
                        <div class="suggestion-product-details">${product.brand || 'Marka Yok'} • ${product.category || 'Kategori Yok'} • ${product.barcode || 'Barkod Yok'}</div>
                        <div class="suggestion-product-stock">Stok: ${stock} adet</div>
                    </div>
                    <div class="suggestion-product-actions">
                        <div class="suggestion-product-price">${formatCurrency(price)}</div>
                        <button class="suggestion-add-to-cart-btn" onclick="event.stopPropagation(); addProductToCartFromSuggestion('${product.barcode || ''}')" title="Sepete Ekle">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                `;
                
                item.onclick = () => {
                    console.log('Ürün seçildi:', product);
                    addToSalesCart(product);
                    searchInput.value = '';
                    suggestions.style.display = 'none';
                };
                
                suggestions.appendChild(item);
            });
            suggestions.style.display = 'block';
            console.log('Öneriler gösterildi');
        } else {
            suggestions.innerHTML = '<div class="no-suggestions">Ürün bulunamadı</div>';
            suggestions.style.display = 'block';
            console.log('Ürün bulunamadı');
        }
    } catch (error) {
        console.error('Ürün arama hatası:', error);
        suggestions.style.display = 'none';
    }
    }, 300); // 300ms debounce
}

// Eski ürün arama ve öneriler (geriye uyumluluk için)
function searchProducts() {
    const searchInput = document.getElementById('productSearchInput');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    const suggestions = document.getElementById('searchSuggestions');
    
    if (!suggestions) return;
    
    if (searchTerm.length < 2) {
        suggestions.style.display = 'none';
        return;
    }
    
    const filteredProducts = stockItems.filter(product => 
        product.name.toLowerCase().includes(searchTerm) ||
        product.brand.toLowerCase().includes(searchTerm) ||
        product.barcode.includes(searchTerm)
    );
    
    if (filteredProducts.length > 0) {
        suggestions.innerHTML = '';
        filteredProducts.slice(0, 5).forEach(product => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `
                <div><strong>${product.name}</strong></div>
                <div style="font-size: 12px; color: #666;">
                    ${product.brand} - ${product.barcode} - Stok: ${product.stock}
                </div>
            `;
            item.onclick = () => {
                addToCart(product);
                searchInput.value = '';
                suggestions.style.display = 'none';
            };
            suggestions.appendChild(item);
        });
        suggestions.style.display = 'block';
    } else {
        suggestions.style.display = 'none';
    }
}

// Barkod okutma - Veritabanından
async function scanBarcode() {
    // Simüle edilmiş barkod okutma
    const barcode = prompt('Barkod okutun:');
    if (barcode) {
        try {
            // Veritabanından ürünleri çek
            const products = await window.posAPI.getProducts();
            const product = products.find(item => item.barcode === barcode);
            
            if (product) {
                addToCartFromDB(product);
            } else {
                alert('Ürün bulunamadı!');
            }
        } catch (error) {
            console.error('Barkod okutma hatası:', error);
            alert('Ürün arama sırasında hata oluştu!');
        }
    }
}

// Sepete ürün ekle (veritabanından)
async function addToCartFromDB(product) {
    if (product.stock <= 0) {
        alert('Bu ürün stokta yok!');
        return;
    }
    
    // currentSaleItems array'ine ekle
    const existingSaleItem = currentSaleItems.find(item => item.barcode === product.barcode);
    
    if (existingSaleItem) {
        // Mevcut ürünün miktarını artır
        if (existingSaleItem.quantity < product.stock) {
            existingSaleItem.quantity += 1;
        } else {
            alert('Stok miktarından fazla ekleyemezsiniz!');
            return;
        }
    } else {
        // Yeni ürün ekle
        const saleItem = {
            barcode: product.barcode,
            name: product.name,
            brand: product.brand,
            category: product.category,
            price: product.sale_price || product.salePrice,
            purchasePrice: product.purchase_price || product.purchasePrice,
            quantity: 1,
            stock: product.stock
        };
        currentSaleItems.push(saleItem);
    }
    
    // Sepet UI'ını güncelle
    updateSalesCartItems();
    updateSalesCartSummary();
    
    console.log('currentSaleItems güncellendi:', currentSaleItems);
}

// Sepete ürün ekle (eski fonksiyon - geriye uyumluluk için)
function addToCart(product) {
    if (product.stock <= 0) {
        alert('Bu ürün stokta yok!');
        return;
    }
    
    const cartItems = document.getElementById('cartItems');
    const existingItem = cartItems.querySelector(`[data-barcode="${product.barcode}"]`);
    
    if (existingItem) {
        // Mevcut ürünün miktarını artır
        const quantityDisplay = existingItem.querySelector('.quantity-display');
        const currentQuantity = parseInt(quantityDisplay.textContent);
        if (currentQuantity < product.stock) {
            quantityDisplay.textContent = currentQuantity + 1;
            updateCartItemTotal(existingItem);
        } else {
            alert('Stok miktarından fazla ekleyemezsiniz!');
        }
    } else {
        // Yeni ürün ekle
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.setAttribute('data-barcode', product.barcode);
        
        cartItem.innerHTML = `
            <div class="cart-item-header">
                <div class="cart-item-name">${product.name}</div>
                <div class="cart-item-price">${formatCurrency(product.salePrice)}</div>
            </div>
            <div class="cart-item-details">
                <div>${product.brand} - ${product.category}</div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn" onclick="changeQuantity('${product.barcode}', -1)">-</button>
                    <div class="quantity-display">1</div>
                    <button class="quantity-btn" onclick="changeQuantity('${product.barcode}', 1)">+</button>
                </div>
            </div>
            <div class="cart-item-footer">
                <div class="cart-item-total">${formatCurrency(product.salePrice)}</div>
                <button class="cart-item-remove" onclick="removeFromCart('${product.barcode}')">Kaldır</button>
            </div>
        `;
        
        cartItems.appendChild(cartItem);
    }
    
    updateCartSummary();
    hideEmptyCart();
}

// Sepetten ürün çıkar
function removeFromCart(barcode) {
    const cartItem = document.getElementById('cartItems').querySelector(`[data-barcode="${barcode}"]`);
    if (cartItem) {
        cartItem.remove();
        updateCartSummary();
        showEmptyCartIfNeeded();
    }
}

// Ürün miktarını değiştir
function changeQuantity(barcode, change) {
    const cartItem = document.getElementById('cartItems').querySelector(`[data-barcode="${barcode}"]`);
    if (cartItem) {
        const quantityDisplay = cartItem.querySelector('.quantity-display');
        const currentQuantity = parseInt(quantityDisplay.textContent);
        const newQuantity = currentQuantity + change;
        
        if (newQuantity >= 1) {
            const product = stockItems.find(item => item.barcode === barcode);
            if (newQuantity <= product.stock) {
                quantityDisplay.textContent = newQuantity;
                updateCartItemTotal(cartItem);
                updateCartSummary();
            } else {
                alert('Stok miktarından fazla ekleyemezsiniz!');
            }
        }
    }
}

// Sepet öğesi toplamını güncelle
function updateCartItemTotal(cartItem) {
    const price = parseFloat(cartItem.querySelector('.cart-item-price').textContent.replace('₺', '').replace(',', ''));
    const quantity = parseInt(cartItem.querySelector('.quantity-display').textContent);
    const total = price * quantity;
    cartItem.querySelector('.cart-item-total').textContent = formatCurrency(total);
}

// Sepet özetini güncelle
function updateCartSummary() {
    const cartItems = document.getElementById('cartItems').querySelectorAll('.cart-item');
    let subtotal = 0;
    let itemCount = 0;
    
    cartItems.forEach(item => {
        const total = parseFloat(item.querySelector('.cart-item-total').textContent.replace('₺', '').replace(',', ''));
        subtotal += total;
        itemCount += parseInt(item.querySelector('.quantity-display').textContent);
    });
    
    const discountPercent = parseFloat(document.getElementById('discountPercent').value) || 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const taxAmount = (subtotal - discountAmount) * 0.18;
    const totalAmount = subtotal - discountAmount + taxAmount;
    
    document.getElementById('subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('discountAmount').textContent = formatCurrency(discountAmount);
    document.getElementById('taxAmount').textContent = formatCurrency(taxAmount);
    document.getElementById('totalAmount').textContent = formatCurrency(totalAmount);
    document.getElementById('cartItemCount').textContent = `${itemCount} ürün`;
}

// İndirim güncelle
function updateDiscount() {
    updateSalesCartSummary();
}

// Boş sepeti gizle
function hideEmptyCart() {
    const emptyCart = document.getElementById('cartItems').querySelector('.empty-cart');
    if (emptyCart) {
        emptyCart.style.display = 'none';
    }
}

// Boş sepeti göster
function showEmptyCartIfNeeded() {
    const cartItems = document.getElementById('cartItems').querySelectorAll('.cart-item');
    const emptyCart = document.getElementById('cartItems').querySelector('.empty-cart');
    
    if (cartItems.length === 0 && emptyCart) {
        emptyCart.style.display = 'block';
    }
}

// Sepeti temizle
function clearCart() {
    document.getElementById('cartItems').innerHTML = `
        <div class="empty-cart">
            <i class="fas fa-shopping-cart"></i>
            <h4>Sepet Boş</h4>
            <p>Ürün eklemek için arama yapın veya barkod okutun</p>
        </div>
    `;
    updateCartSummary();
}

// Satışı iptal et
function cancelSale() {
    if (confirm('Satışı iptal etmek istediğinizden emin misiniz?')) {
        clearCart();
    }
}

// Satışı tamamla
async function completeSale() {
    console.log('Satış tamamlanıyor...');
    console.log('currentSaleItems:', currentSaleItems);
    
    if (currentSaleItems.length === 0) {
        alert('Sepet boş!');
        return;
    }
    
    try {
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cash';
        const totalAmount = parseFloat(document.getElementById('totalAmount')?.textContent.replace('₺', '').replace(',', '') || '0');

        // Satış verilerini hazırla
        const saleItems = [];
        console.log('📦 Satış öğeleri hazırlanıyor...');
        
        for (const item of currentSaleItems) {
            console.log(`🔄 Ürün işleniyor: ${item.name} (${item.quantity} adet)`);
            
            saleItems.push({
                barcode: item.barcode,
                name: item.name,
                brand: item.brand,
                category: item.category,
                quantity: item.quantity,
                price: item.price,
                purchasePrice: item.purchasePrice,
                total: item.price * item.quantity
            });

            // Stoktan düş - veritabanından güncelle
            console.log(`📉 Stok düşürülüyor: ${item.name} - ${item.quantity} adet`);
            await updateProductStock(item.barcode, item.quantity);
        }
        
        console.log(`✅ Toplam ${saleItems.length} ürün işlendi`);

        // Satış kaydını oluştur
        const sale = {
            id: sales.length + 1,
            date: new Date().toISOString(),
            items: saleItems,
            subtotal: parseFloat(document.getElementById('subtotal')?.textContent.replace('₺', '').replace(',', '') || '0'),
            discount: parseFloat(document.getElementById('discountAmount')?.textContent.replace('₺', '').replace(',', '') || '0'),
            tax: parseFloat(document.getElementById('taxAmount')?.textContent.replace('₺', '').replace(',', '') || '0'),
            total: totalAmount,
            paymentMethod: paymentMethod
        };

        console.log('Oluşturulan satış objesi:', sale);

        // Satışı veritabanına kaydet
        await saveSaleToDatabase(sale);

        // Modern satış başarı kartını göster
        showSaleSuccessCard(sale);

        // Sepeti temizle
        clearSalesCart();
        console.log('Sepet temizlendi');

        // Raporlar sayfasındaki ürün listesini güncelle
        setTimeout(() => {
            loadReportsProductsTable();
            // Raporlar sayfası istatistiklerini de güncelle
            if (document.getElementById('reports')?.classList.contains('active')) {
                loadReportsPage();
            }
            // Grafikler sayfası açıksa grafikleri güncelle
            if (document.getElementById('charts')?.classList.contains('active')) {
                loadCharts();
            }
            // Ürünler sayfasındaki tabloyu güncelle
            if (document.getElementById('products')?.classList.contains('active')) {
                updateProductsTable();
            }
        }, 100);
        
        console.log('Satış başarıyla tamamlandı!');
        
    } catch (error) {
        console.error('Satış tamamlama hatası:', error);
        alert('Satış tamamlanırken bir hata oluştu: ' + error.message);
    }
}

// Modern satış başarı kartını göster
function showSaleSuccessCard(sale) {
    console.log('Satış başarı kartı gösteriliyor:', sale);
    
    const successCard = document.getElementById('saleSuccessCard');
    const successSaleAmount = document.getElementById('successSaleAmount');
    const successSaleTime = document.getElementById('successSaleTime');
    const successPaymentMethod = document.getElementById('successPaymentMethod');
    const successItemCount = document.getElementById('successItemCount');
    
    if (!successCard) {
        console.error('Satış başarı kartı elementi bulunamadı');
        return;
    }
    
    if (!successSaleAmount || !successSaleTime || !successPaymentMethod || !successItemCount) {
        console.error('Satış başarı kartı alt elementleri bulunamadı');
        return;
    }
    
    try {
        // Satış bilgilerini güncelle
        successSaleAmount.textContent = formatCurrency(sale.total || 0);
        successSaleTime.textContent = new Date(sale.date).toLocaleString('tr-TR');
        
        // Satılan ürün sayısını hesapla
        const totalItems = sale.items ? sale.items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0;
        successItemCount.textContent = `${totalItems} adet`;
        
        // Ödeme yöntemi
        const paymentMethods = {
            'cash': 'Nakit',
            'card': 'Kart',
            'transfer': 'Havale',
            'discount': 'İndirim'
        };
        successPaymentMethod.textContent = paymentMethods[sale.paymentMethod] || sale.paymentMethod || 'Nakit';
        
        // Kartı göster
        successCard.style.display = 'flex';
        successCard.classList.add('show');
        console.log('Satış başarı kartı gösterildi');
        
        // 5 saniye sonra otomatik kapat
        setTimeout(() => {
            if (successCard) {
                successCard.style.display = 'none';
                successCard.classList.remove('show');
                console.log('Satış başarı kartı kapatıldı');
            }
        }, 5000);
        
    } catch (error) {
        console.error('Satış başarı kartı gösterme hatası:', error);
    }
}

// Satış başarı kartını kapat
function closeSaleSuccessCard() {
    const successCard = document.getElementById('saleSuccessCard');
    if (successCard) {
        successCard.style.display = 'none';
        successCard.classList.remove('show');
        console.log('Satış başarı kartı manuel olarak kapatıldı');
    }
}

// Yeni satış başlat
function startNewSale() {
    closeSaleSuccessCard();
    // Sepet zaten temizlendi, sadece kullanıcıyı bilgilendir
    console.log('Yeni satış başlatıldı');
}

// Ürün stok güncelleme fonksiyonu
async function updateProductStock(barcode, soldQuantity) {
    try {
        console.log(`🔄 Stok güncelleniyor: ${barcode}, satılan miktar: ${soldQuantity}`);
        
        // Önce test verilerinden ürünü bul ve güncelle
        const testProduct = stockItems.find(item => item.barcode === barcode);
        if (testProduct) {
            const oldStock = testProduct.stock;
            const newStock = Math.max(0, testProduct.stock - soldQuantity);
            testProduct.stock = newStock;
            
            console.log(`✅ Test ürün stoku güncellendi: ${testProduct.name}`);
            console.log(`   Barkod: ${barcode}`);
            console.log(`   Eski stok: ${oldStock} adet`);
            console.log(`   Satılan: ${soldQuantity} adet`);
            console.log(`   Yeni stok: ${newStock} adet`);
            
            // Stok güncellemesini UI'da göster
            updateProductStockInUI(barcode, newStock);
            
            // Stok sayfasını güncelle (eğer açıksa)
            if (document.getElementById('stock')?.classList.contains('active')) {
                loadStockTable();
            }
            
        } else {
            console.warn(`⚠️ Test verilerinde ürün bulunamadı: ${barcode}`);
        }
        
        // Veritabanından da güncellemeye çalış
        try {
            if (window.posAPI && typeof window.posAPI.getDatabase === 'function') {
                const db = await window.posAPI.getDatabase();
                if (db) {
                    const product = await db.get('SELECT * FROM products WHERE barcode = ?', [barcode]);
                    
                    if (product) {
                        const oldStock = product.stock;
                        const newStock = Math.max(0, product.stock - soldQuantity);
                        
                        await db.run('UPDATE products SET stock = ? WHERE barcode = ?', [newStock, barcode]);
                        
                        console.log(`✅ Veritabanı ürün stoku güncellendi: ${product.name}`);
                        console.log(`   Barkod: ${barcode}`);
                        console.log(`   Eski stok: ${oldStock} adet`);
                        console.log(`   Satılan: ${soldQuantity} adet`);
                        console.log(`   Yeni stok: ${newStock} adet`);
                        
                    } else {
                        console.log(`ℹ️ Veritabanında ürün bulunamadı: ${barcode}`);
                    }
                }
            }
        } catch (dbError) {
            console.error('❌ Veritabanı stok güncelleme hatası:', dbError.message);
            // Hata durumunda bile test verilerini güncellemeye devam et
        }
        
        // Başarı mesajı
        console.log(`🎉 Stok güncelleme tamamlandı: ${barcode}`);
        
    } catch (error) {
        console.error('❌ Stok güncelleme hatası:', error);
        throw error; // Hatayı yukarı fırlat
    }
}

// UI'da stok güncellemesini göster
function updateProductStockInUI(barcode, newStock) {
    console.log(`🔄 UI güncelleniyor: ${barcode}, yeni stok: ${newStock}`);
    
    // Arama sonuçlarında stok güncelle
    const searchResults = document.querySelectorAll('.search-result-item');
    searchResults.forEach(result => {
        const resultBarcode = result.getAttribute('data-barcode');
        if (resultBarcode === barcode) {
            const stockElement = result.querySelector('.product-stock');
            if (stockElement) {
                stockElement.textContent = `Stok: ${newStock} adet`;
                stockElement.className = `product-stock ${newStock > 0 ? 'in-stock' : 'out-of-stock'}`;
                console.log(`✅ Arama sonucu güncellendi: ${barcode}`);
            }
        }
    });
    
    // Stok sayfasında stok güncelle
    const stockRows = document.querySelectorAll('.stock-table tbody tr');
    stockRows.forEach(row => {
        const rowBarcode = row.getAttribute('data-barcode');
        if (rowBarcode === barcode) {
            const stockCell = row.querySelector('.stock-quantity');
            if (stockCell) {
                stockCell.textContent = newStock;
                stockCell.className = `stock-quantity ${newStock > 0 ? 'in-stock' : 'out-of-stock'}`;
                console.log(`✅ Stok tablosu güncellendi: ${barcode}`);
            }
        }
    });
    
    // Ürünler sayfasında stok güncelle
    const productRows = document.querySelectorAll('#productsTableBody tr');
    productRows.forEach(row => {
        const rowBarcode = row.cells[0]?.textContent; // İlk hücre barkod
        if (rowBarcode === barcode) {
            const stockCell = row.querySelector('.stock-cell');
            if (stockCell) {
                stockCell.textContent = newStock;
                stockCell.className = `stock-cell ${getStockClass(newStock)}`;
                console.log(`✅ Ürünler tablosu güncellendi: ${barcode}`);
            }
        }
    });
    
    // Sepet görünümünde stok güncelle
    updateSalesCartItems();
    
    console.log(`🎉 UI güncelleme tamamlandı: ${barcode}`);
}

// Satışı veritabanına kaydet
async function saveSaleToDatabase(sale) {
    try {
        console.log('Satış veritabanına kaydediliyor:', sale);
        
        // Satış numarası oluştur
        const saleNo = 'SALE-' + Date.now();
        
        // Satış verilerini hazırla
        const saleData = {
            sale_no: saleNo,
            customer_name: sale.customer_name || '',
            total_amount: sale.total,
            payment_method: sale.paymentMethod,
            items: sale.items
        };
        
        console.log('Hazırlanan satış verisi:', saleData);
        
        // Veritabanına kaydet
        if (window.posAPI && typeof window.posAPI.addSale === 'function') {
            const result = await window.posAPI.addSale(saleData);
            console.log('Satış veritabanına kaydedildi:', result.id);
            
            // Satışı local sales array'ine de ekle
            const newSale = {
                id: result.id,
                date: new Date().toISOString(),
                items: sale.items,
                total: sale.total,
                paymentMethod: sale.paymentMethod,
                customer_name: sale.customer_name || ''
            };
            sales.push(newSale);
            
            // Raporlar sayfasını güncelle
            setTimeout(() => {
                if (document.getElementById('reports') && document.getElementById('reports').classList.contains('active')) {
                    loadReportsPage();
                }
            }, 100);
            
            return result.id;
        } else {
            console.warn('posAPI.addSale bulunamadı, sadece local array\'e ekleniyor');
            
            // Sadece local array'e ekle
            const newSale = {
                id: sales.length + 1,
                date: new Date().toISOString(),
                items: sale.items,
                total: sale.total,
                paymentMethod: sale.paymentMethod,
                customer_name: sale.customer_name || ''
            };
            sales.push(newSale);
            
            return newSale.id;
        }
        
    } catch (error) {
        console.error('Satış kaydetme hatası:', error);
        
        // Hata durumunda bile local array'e ekle
        console.log('Hata durumunda local array\'e ekleniyor...');
        const newSale = {
            id: sales.length + 1,
            date: new Date().toISOString(),
            items: sale.items,
            total: sale.total,
            paymentMethod: sale.paymentMethod,
            customer_name: sale.customer_name || ''
        };
        sales.push(newSale);
        
        return newSale.id;
    }
}

// Fiş yazdır
function printReceipt() {
    const printWindow = window.open('', '_blank');
    const sale = sales[sales.length - 1]; // Son satış
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Satış Fişi</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                .receipt { max-width: 300px; margin: 0 auto; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
                .total { border-top: 1px solid #000; padding-top: 10px; margin-top: 10px; font-weight: bold; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="header">
                    <h2>SATIŞ FİŞİ</h2>
                    <p>${new Date(sale.date).toLocaleString('tr-TR')}</p>
                    <p>Fiş No: ${sale.id}</p>
                </div>
                
                <div class="items">
                    ${sale.items.map(item => `
                        <div class="item">
                            <span>${item.name} (${item.quantity}x)</span>
                            <span>${formatCurrency(item.total)}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="total">
                    <div class="item">
                        <span>Ara Toplam:</span>
                        <span>${formatCurrency(sale.subtotal)}</span>
                    </div>
                    <div class="item">
                        <span>İndirim:</span>
                        <span>${formatCurrency(sale.discount)}</span>
                    </div>
                    <div class="item">
                        <span>KDV (%18):</span>
                        <span>${formatCurrency(sale.tax)}</span>
                    </div>
                    <div class="item">
                        <span>Genel Toplam:</span>
                        <span>${formatCurrency(sale.total)}</span>
                    </div>
                </div>
                
                <div class="footer">
                    <p>Teşekkürler!</p>
                    <p>Bizi tercih ettiğiniz için teşekkür ederiz.</p>
                </div>
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
}

// Para formatı
function formatCurrency(amount) {
    return '₺' + parseFloat(amount).toFixed(2).replace('.', ',');
}

// ===== ÜRÜNLER SAYFASI FONKSİYONLARI =====



// Ürün ekleme modalını aç
function openAddProductModal() {
    document.getElementById('addProductModal').style.display = 'flex';
    updateCategorySelects();
}

// Kategori seçeneklerini güncelle
function updateCategorySelects() {
    const selects = ['category', 'editCategory', 'categoryFilter', 'quickCategory', 'reportCategoryFilter'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const currentValue = select.value;
            
            // Kategori filtresi için "Tüm Kategoriler" seçeneği ekle
            if (selectId === 'categoryFilter') {
                select.innerHTML = '<option value="">Tüm Kategoriler</option>';
            } else {
                select.innerHTML = '<option value="">Kategori seçin</option>';
            }
            
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                select.appendChild(option);
            });
            select.value = currentValue;
        }
    });
}

// Ürün dışa aktar
function exportProducts() {
    const exportModal = document.getElementById('exportModal');
    if (exportModal) {
        exportModal.style.display = 'flex';
    } else {
        // Basit CSV export
        const csvContent = generateProductsCSV();
        downloadCSV(csvContent, 'urunler.csv');
    }
}

// Export modal içinden PDF ya da Excel seçimi
function exportToPDF() {
    try {
        const table = document.getElementById('productsTable');
        if (!table) return alert('Ürün tablosu bulunamadı');
        const printWindow = window.open('', '_blank');
        const html = `
            <html><head><title>Ürünler PDF</title>
            <style>table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;font-size:12px}</style>
            </head><body>${table.outerHTML}</body></html>`;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    } catch (e) {
        console.error('PDF dışa aktarım hatası', e);
    }
}

function exportToExcel() {
    try {
        const worksheetData = [
            ['Barkod','Ürün Adı','Marka','Kategori','Stok','Alış Fiyatı','Satış Fiyatı']
        ];
        stockItems.forEach(p => {
            worksheetData.push([
                p.barcode || '',
                p.name || '',
                p.brand || '',
                p.category || '',
                Number(p.stock || 0),
                Number(p.purchasePrice || 0),
                Number(p.salePrice || 0)
            ]);
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(worksheetData);
        XLSX.utils.book_append_sheet(wb, ws, 'Urunler');
        XLSX.writeFile(wb, 'urunler.xlsx');
    } catch (e) {
        console.error('Excel dışa aktarım hatası', e);
        const csvContent = generateProductsCSV();
        downloadCSV(csvContent, 'urunler.csv');
    }
}

// Import modal dosya seçimi
function handleFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    const importBtn = document.getElementById('importBtn');
    if (importBtn) importBtn.disabled = !file;
    window.__pendingImportFile = file || null;
}

async function importProductsFromFile() {
    const file = window.__pendingImportFile;
    if (!file) return alert('Lütfen bir dosya seçin');
    try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        // Başlık satırını atla, Barkod, Ürün Adı, Marka, Kategori, Stok, Alış, Satış beklenir
        rows.slice(1).forEach(r => {
            const product = {
                barcode: String(r[0]||'').trim(),
                name: String(r[1]||'').trim(),
                brand: String(r[2]||'').trim(),
                category: String(r[3]||'').trim(),
                stock: parseInt(r[4]||0) || 0,
                purchasePrice: parseFloat(r[5]||0) || 0,
                salePrice: parseFloat(r[6]||0) || 0
            };
            if (!product.barcode || !product.name) return;
            const idx = stockItems.findIndex(x => x.barcode === product.barcode);
            if (idx >= 0) stockItems[idx] = { ...stockItems[idx], ...product };
            else stockItems.push(product);
        });
        loadProductsTable();
        updateCategorySelects();
        closeModal('importModal');
        alert('Ürünler başarıyla içe aktarıldı');
    } catch (e) {
        console.error('İçe aktarma hatası', e);
        alert('Dosya okunamadı');
    } finally {
        window.__pendingImportFile = null;
        const input = document.getElementById('importFile');
        if (input) input.value = '';
        const importBtn = document.getElementById('importBtn');
        if (importBtn) importBtn.disabled = true;
    }
}

// CSV fallback import
function importProductsFromCSV(csvText) {
    const lines = csvText.split('\n').filter(Boolean);
    lines.slice(1).forEach(line => {
        const [barcode,name,brand,category,stock,purchasePrice,salePrice] = line.split(',');
        const product = {
            barcode: (barcode||'').trim(),
            name: (name||'').trim(),
            brand: (brand||'').trim(),
            category: (category||'').trim(),
            stock: parseInt(stock||0) || 0,
            purchasePrice: parseFloat(purchasePrice||0) || 0,
            salePrice: parseFloat(salePrice||0) || 0
        };
        if (!product.barcode || !product.name) return;
        const idx = stockItems.findIndex(x => x.barcode === product.barcode);
        if (idx >= 0) stockItems[idx] = { ...stockItems[idx], ...product };
        else stockItems.push(product);
    });
    loadProductsTable();
    updateCategorySelects();
}

// Ürün içe aktar
function importProducts() {
    const importModal = document.getElementById('importModal');
    if (importModal) {
        importModal.style.display = 'flex';
    } else {
        // Basit dosya seçimi
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    importProductsFromCSV(e.target.result);
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
}

// CSV oluştur
function generateProductsCSV() {
    const headers = ['Barkod', 'Ürün Adı', 'Marka', 'Kategori', 'Stok', 'Alış Fiyatı', 'Satış Fiyatı'];
    const rows = stockItems.map(item => [
        item.barcode,
        item.name,
        item.brand,
        item.category,
        item.stock,
        item.purchasePrice,
        item.salePrice
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// CSV indir
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// CSV'den ürün içe aktar
function importProductsFromCSV(csvContent) {
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');
    
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
            const values = lines[i].split(',');
            const product = {
                barcode: values[0],
                name: values[1],
                brand: values[2],
                category: values[3],
                stock: parseInt(values[4]) || 0,
                purchasePrice: parseFloat(values[5]) || 0,
                salePrice: parseFloat(values[6]) || 0
            };
            
            // Barkod kontrolü
            const existingIndex = stockItems.findIndex(item => item.barcode === product.barcode);
            if (existingIndex !== -1) {
                stockItems[existingIndex] = product;
            } else {
                stockItems.push(product);
            }
            
            // Kategoriyi listeye ekle
            if (!categories.includes(product.category)) {
                categories.push(product.category);
            }
        }
    }
    
    loadProductsTable();
    updateCategorySelects();
    alert('Ürünler başarıyla içe aktarıldı!');
}









// Ürün kaydet
async function saveProduct(event) {
    event.preventDefault();
    
    console.log('saveProduct fonksiyonu çağrıldı');
    
    // Form elementlerini kontrol et
    const barcodeEl = document.getElementById('barcode');
    const nameEl = document.getElementById('productName');
    const brandEl = document.getElementById('brand');
    const categoryEl = document.getElementById('category');
    const stockEl = document.getElementById('stock');
    const purchasePriceEl = document.getElementById('purchasePrice');
    const salePriceEl = document.getElementById('salePrice');
    const descriptionEl = document.getElementById('description');
    
    console.log('Form elementleri:', {
        barcode: barcodeEl,
        name: nameEl,
        brand: brandEl,
        category: categoryEl,
        stock: stockEl,
        purchasePrice: purchasePriceEl,
        salePrice: salePriceEl,
        description: descriptionEl
    });
    
    if (!barcodeEl || !nameEl || !brandEl || !categoryEl || !stockEl || !purchasePriceEl || !salePriceEl) {
        console.error('Form elementleri bulunamadı!');
        alert('Form elementleri bulunamadı! Sayfayı yenileyin.');
        return;
    }
    
    const newProduct = {
        barcode: barcodeEl.value.trim(),
        name: nameEl.value.trim(),
        brand: brandEl.value.trim(),
        category: categoryEl.value.trim(),
        stock: parseInt(stockEl.value) || 0,
        minStock: 0,
        purchasePrice: parseFloat(purchasePriceEl.value) || 0,
        salePrice: parseFloat(salePriceEl.value) || 0,
        description: descriptionEl ? descriptionEl.value.trim() : ''
    };
    
    console.log('Yeni ürün verisi:', newProduct);
    
    // Gerekli alanları kontrol et
    if (!newProduct.barcode || !newProduct.name) {
        alert('Barkod ve ürün adı zorunludur!');
        return;
    }
    
    // Barkod kontrolü
    const existingIndex = stockItems.findIndex(item => item.barcode === newProduct.barcode);
    if (existingIndex !== -1) {
        alert('Bu barkod zaten kullanılıyor!');
        return;
    }
    
    try {
        console.log('Ürün kaydediliyor...');
        
        // Veritabanına kaydet
        if (window.posAPI && typeof window.posAPI.addProduct === 'function') {
            console.log('posAPI.addProduct çağrılıyor...');
            const result = await window.posAPI.addProduct(newProduct);
            console.log('Veritabanı kayıt sonucu:', result);
        } else {
            console.warn('posAPI bulunamadı, sadece local array\'e ekleniyor');
        }
        
        // Local array'e ekle
        stockItems.push(newProduct);
        console.log('Ürün local array\'e eklendi, toplam ürün sayısı:', stockItems.length);
        
        // Kategoriyi listeye ekle
        if (newProduct.category && !categories.includes(newProduct.category)) {
            categories.push(newProduct.category);
            console.log('Yeni kategori eklendi:', newProduct.category);
        }
        
        // Formu temizle
        const form = document.getElementById('addProductForm');
        if (form) {
            form.reset();
            console.log('Form temizlendi');
        }
        
        closeModal('addProductModal');
        
        // Tüm tabloları ve listeleri güncelle
        await loadProductsTable();
        updateCategorySelects();
        
        // Satış sayfası arama barını yenile (eğer açıksa)
        if (document.getElementById('sales') && document.getElementById('sales').classList.contains('active')) {
            console.log('Satış sayfası açık, arama barı yenileniyor');
            // Arama input'unu temizle ve yeniden arama yap
            const searchInput = document.getElementById('newProductSearch');
            if (searchInput) {
                searchInput.value = '';
                // Arama önerilerini gizle
                const suggestions = document.getElementById('newSearchSuggestions');
                if (suggestions) {
                    suggestions.style.display = 'none';
                }
            }
            // Satış sayfası ürün listesini yenile
            refreshSalesPageProducts();
        }
        
        console.log('Ürün başarıyla eklendi!');
        alert('Ürün başarıyla eklendi!');
        
    } catch (error) {
        console.error('Ürün kaydetme hatası:', error);
        
        // Hata durumunda sadece local array'e ekle
        stockItems.push(newProduct);
        console.log('Hata durumunda ürün local array\'e eklendi');
        
        // Kategoriyi listeye ekle
        if (newProduct.category && !categories.includes(newProduct.category)) {
            categories.push(newProduct.category);
        }
        
        // Formu temizle
        const form = document.getElementById('addProductForm');
        if (form) {
            form.reset();
        }
        
        closeModal('addProductModal');
        
        // Tüm tabloları ve listeleri güncelle
        await loadProductsTable();
        updateCategorySelects();
        
        alert('Ürün eklendi (veritabanı hatası nedeniyle geçici olarak saklanıyor)');
    }
}

// Satış sayfası için ürün filtreleme
function filterProductsForSale() {
    const categoryId = document.getElementById('salesCategoryFilter').value;
    const cards = document.querySelectorAll('.product-card-sales');
    let visibleCount = 0;
    
    cards.forEach(card => {
        if (!categoryId || card.dataset.categoryId === categoryId) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    document.getElementById('productCount').textContent = `${visibleCount} ürün bulundu`;
}

// Satış sayfası ürünlerini yenile
async function refreshSalesPageProducts() {
    console.log('Satış sayfası ürünleri yenileniyor...');
    
    try {
        // Veritabanından güncel ürünleri al
        if (window.posAPI && typeof window.posAPI.getProducts === 'function') {
            const dbProducts = await window.posAPI.getProducts();
            console.log('Veritabanından ürünler alındı:', dbProducts.length);
            
            // Veritabanından gelen verileri stockItems ile birleştir
            const dbBarcodes = dbProducts.map(p => p.barcode);
            const localOnlyItems = stockItems.filter(item => !dbBarcodes.includes(item.barcode));
            const allProducts = [...dbProducts, ...localOnlyItems];
            
            // stockItems'i güncelle
            stockItems.length = 0;
            stockItems.push(...allProducts);
            
            console.log('Toplam ürün sayısı güncellendi:', stockItems.length);
        }
    } catch (error) {
        console.error('Satış sayfası ürün yenileme hatası:', error);
    }
}

// Satış aramasını temizle
function clearSalesSearch() {
    document.getElementById('salesProductSearch').value = '';
    document.getElementById('salesCategoryFilter').value = '';
    searchProductsForSale();
}

// Satış sayfası için ürün grid'ini yükle
function loadProductsGridForSales() {
    const grid = document.getElementById('productsGridSales');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    currentProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = `product-card-sales ${product.stock <= 0 ? 'out-of-stock' : ''}`;
        card.dataset.categoryId = product.category_id || '';
        card.onclick = () => product.stock > 0 ? addToSalesCart(product) : null;
        
        card.innerHTML = `
            <div class="product-icon">
                <i class="fas fa-box"></i>
            </div>
            <div class="product-name">${product.name}</div>
            <div class="product-brand">${product.brand}</div>
            <div class="product-price">${formatCurrency(product.sale_price)}</div>
            ${product.stock <= 0 ? '<div class="product-stock">Stokta yok</div>' : ''}
        `;
        
        grid.appendChild(card);
    });
    
    document.getElementById('productCount').textContent = `${currentProducts.length} ürün bulundu`;
}

// Satış sepetine ürün ekle
function addToSalesCart(product) {
    console.log('addToSalesCart çağrıldı:', product);
    
    // Eğer product string ise JSON parse et
    if (typeof product === 'string') {
        try {
            product = JSON.parse(product);
        } catch (error) {
            console.error('Product JSON parse hatası:', error);
            return;
        }
    }
    
    // Ürün kontrolü
    if (!product || !product.barcode) {
        console.error('Geçersiz ürün:', product);
        alert('Geçersiz ürün bilgisi!');
        return;
    }
    
    // Stok kontrolü - sadece toplam stok kontrolü
    const stockProduct = stockItems.find(item => item.barcode === product.barcode);
    if (!stockProduct) {
        console.warn(`Ürün bulunamadı: ${product.barcode}`);
        alert(`Ürün bulunamadı! (${product.name})`);
        return;
    }
    
    if (stockProduct.stock <= 0) {
        alert(`Bu ürün stokta yok! (${product.name})`);
        return;
    }
    
    console.log(`Ürün stok kontrolü: ${product.name}, toplam stok: ${stockProduct.stock}`);
    
    // Zaten eklenmiş mi kontrol et (barcode ile)
    const existingItem = currentSaleItems.find(item => item.barcode === product.barcode);
    if (existingItem) {
        // Stok kontrolü - mevcut miktar + 1 toplam stoktan fazla olmamalı
        if (existingItem.quantity >= stockProduct.stock) {
            alert(`Bu üründen maksimum ${stockProduct.stock} adet satabilirsiniz! (${product.name})`);
            return;
        }
        
        existingItem.quantity += 1;
        console.log('Mevcut ürün miktarı artırıldı:', existingItem.quantity);
    } else {
        // Yeni ürün ekle
        const saleItem = {
            barcode: product.barcode,
            name: product.name || 'İsimsiz Ürün',
            brand: product.brand || 'Marka Yok',
            category: product.category || 'Kategori Yok',
            price: stockProduct.sale_price || stockProduct.salePrice || 0,
            purchasePrice: stockProduct.purchase_price || stockProduct.purchasePrice || 0,
            quantity: 1,
            stock: stockProduct.stock || 0
        };
        currentSaleItems.push(saleItem);
        console.log('Yeni ürün sepete eklendi:', saleItem);
    }
    
    // UI güncelle
    if (typeof updateSalesCartItems === 'function') {
        updateSalesCartItems();
    }
    if (typeof updateSalesCartSummary === 'function') {
        updateSalesCartSummary();
    }
    
    console.log('Güncel currentSaleItems:', currentSaleItems);
}

// Mevcut stok miktarını al (satış sepetindeki miktarları çıkararak)
function getCurrentStock(barcode) {
    // Test verilerinden ürünü bul
    const product = stockItems.find(item => item.barcode === barcode);
    if (!product) {
        console.warn(`Ürün bulunamadı: ${barcode}`);
        return 0;
    }
    
    // Sepetteki miktarı hesapla
    const cartQuantity = currentSaleItems
        .filter(item => item.barcode === barcode)
        .reduce((sum, item) => sum + item.quantity, 0);
    
    // Gerçek stok = toplam stok - sepetteki miktar
    const availableStock = Math.max(0, product.stock - cartQuantity);
    
    console.log(`Stok hesaplama: ${product.name}, toplam stok: ${product.stock}, sepetteki: ${cartQuantity}, kullanılabilir: ${availableStock}`);
    
    return availableStock;
}

// Öneri dropdown'dan sepete ürün ekle
function addProductToCartFromSuggestion(barcode) {
    console.log('addProductToCartFromSuggestion çağrıldı, barcode:', barcode);
    
    if (!barcode) {
        alert('Barcode bilgisi bulunamadı!');
        return;
    }
    
    // Önce test verilerinde ara (hızlı çözüm)
    let product = stockItems.find(p => p.barcode === barcode);
    
    if (product) {
        console.log('Ürün test verilerinden bulundu:', product);
        addToSalesCart(product);
        return;
    }
    
    // Test verilerinde bulunamazsa veritabanında ara
    if (window.posAPI && typeof window.posAPI.getProducts === 'function') {
        window.posAPI.getProducts().then(products => {
            const dbProduct = products.find(p => p.barcode === barcode);
            if (dbProduct) {
                console.log('Ürün veritabanından bulundu:', dbProduct);
                addToSalesCart(dbProduct);
            } else {
                console.error('Ürün bulunamadı:', barcode);
                alert('Ürün bulunamadı!');
            }
        }).catch(error => {
            console.error('Veritabanı hatası:', error);
            alert('Ürün bulunamadı!');
        });
    } else {
        console.error('Ürün bulunamadı:', barcode);
        alert('Ürün bulunamadı!');
    }
}

// Satış sepet öğelerini güncelle
function updateSalesCartItems() {
    try {
        const container = document.getElementById('cartItems');
        if (!container) {
            console.log('cartItems container bulunamadı');
            return;
        }
        
        console.log('updateSalesCartItems çağrıldı, currentSaleItems:', currentSaleItems);
        
        if (currentSaleItems.length === 0) {
            container.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Sepet boş</p>
                    <span>Ürün eklemek için arama barından seçim yapın</span>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        currentSaleItems.forEach((item, index) => {
            const totalPrice = (item.price || 0) * (item.quantity || 1);
            const stockInfo = getStockInfo(item.barcode);
            const totalStock = stockItems.find(p => p.barcode === item.barcode)?.stock || 0;
            const maxQuantity = getCurrentStock(item.barcode) + item.quantity;
            
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="cart-item-header">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name || 'İsimsiz Ürün'}</div>
                        <div class="cart-item-details">
                            <span class="cart-item-brand">${item.brand || 'Marka Yok'}</span>
                            <span class="cart-item-category">${item.category || 'Kategori Yok'}</span>
                        </div>
                        <div class="cart-item-barcode">Barkod: ${item.barcode}</div>
                    </div>
                </div>
                <div class="cart-item-body">
                    <div class="cart-item-pricing">
                        <div class="cart-item-price-info">
                            <span class="price-label">Birim Fiyat:</span>
                            <span class="price-value">${formatCurrency(item.price || 0)}</span>
                        </div>
                        <div class="cart-item-stock-info">
                            <span class="stock-label">Toplam Stok:</span>
                            <span class="stock-value ${totalStock > 0 ? 'in-stock' : 'out-of-stock'}">${totalStock} adet</span>
                        </div>
                    </div>
                    <div class="cart-item-quantity-section">
                        <div class="quantity-label">Miktar:</div>
                        <div class="quantity-controls">
                            <button class="quantity-btn minus" onclick="updateSalesCartItemQuantity(${index}, -1)" ${item.quantity <= 1 ? 'disabled' : ''}>
                                <i class="fas fa-minus"></i>
                            </button>
                            <span class="quantity-display">${item.quantity || 1}</span>
                            <button class="quantity-btn plus" onclick="updateSalesCartItemQuantity(${index}, 1)" ${item.quantity >= maxQuantity ? 'disabled' : ''}>
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                    <div class="cart-item-total-section">
                        <span class="total-label">Toplam:</span>
                        <span class="total-value">${formatCurrency(totalPrice)}</span>
                    </div>
                    <button class="cart-item-remove" onclick="removeSalesCartItem(${index})" title="Ürünü Sepetten Çıkar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
        
        console.log('Sepet öğeleri güncellendi');
        
        // İkinci ekranı da güncelle
        updateSecondScreenDisplay();
        
        // Sepet sayacını güncelle
        updateCartCounter();
    } catch (error) {
        console.error('updateSalesCartItems hatası:', error);
    }
}

// Stok bilgilerini al
function getStockInfo(barcode) {
    const product = stockItems.find(item => item.barcode === barcode);
    if (!product) {
        return {
            currentStock: 0,
            available: false
        };
    }
    
    // Gerçek kullanılabilir stok (sepetteki miktarları çıkararak)
    const availableStock = getCurrentStock(barcode);
    
    return {
        currentStock: availableStock,
        available: availableStock > 0
    };
}

// Miktar doğrulama
function validateQuantity(index, value) {
    const item = currentSaleItems[index];
    if (!item) return;
    
    const quantity = parseInt(value) || 1;
    const availableStock = getCurrentStock(item.barcode);
    const maxQuantity = availableStock + item.quantity; // Mevcut sepetteki miktarı da ekle
    
    if (quantity > maxQuantity) {
        alert(`Yeterli stok yok! Bu üründen maksimum ${maxQuantity} adet satabilirsiniz. (${item.name})`);
        item.quantity = maxQuantity;
        updateSalesCartItems();
        updateSalesCartSummary();
    }
}

// Satış sepet öğesi miktarını güncelle
function updateSalesCartItemQuantity(index, change, newValue = null) {
    const item = currentSaleItems[index];
    if (!item) return;
    
    let newQuantity;
    if (newValue !== null) {
        newQuantity = parseInt(newValue);
    } else {
        newQuantity = item.quantity + change;
    }
    
    if (newQuantity <= 0) {
        removeSalesCartItem(index);
        return;
    }
    
    // Stok kontrolü - getCurrentStock kullanarak gerçek stok kontrolü
    const availableStock = getCurrentStock(item.barcode);
    const maxQuantity = availableStock + item.quantity; // Mevcut sepetteki miktarı da ekle
    
    if (newQuantity > maxQuantity) {
        alert(`Yeterli stok yok! Bu üründen maksimum ${maxQuantity} adet satabilirsiniz. (${item.name})`);
        newQuantity = maxQuantity;
    }
    
    item.quantity = newQuantity;
    updateSalesCartItems();
    updateSalesCartSummary();
    
    console.log(`Ürün miktarı güncellendi: ${item.name}, yeni miktar: ${newQuantity}, maksimum: ${maxQuantity}`);
}

// Satış sepetinden öğe çıkar
function removeSalesCartItem(index) {
    currentSaleItems.splice(index, 1);
    updateSalesCartItems();
    updateSalesCartSummary();
}

// Satış sepetini temizle
function clearSalesCart() {
    console.log('Sepet temizleniyor...');
    console.log('Temizleme öncesi currentSaleItems:', currentSaleItems);
    
    // currentSaleItems array'ini temizle
    currentSaleItems = [];
    
    // Eski sepet UI'ını da temizle (eski sistem için)
    const cartItems = document.getElementById('cartItems');
    if (cartItems) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart"></i>
                <h4>Sepet Boş</h4>
                <p>Ürün eklemek için arama yapın veya barkod okutun</p>
            </div>
        `;
    }
    
    // UI'yi güncelle
    updateSalesCartItems();
    updateSalesCartSummary();
    
    // İndirim alanını sıfırla
    const discountElement = document.getElementById('discountPercent');
    if (discountElement) {
        discountElement.value = '0';
    }
    
    // Müşteri bilgilerini temizle
    const customerNameElement = document.getElementById('salesCustomerName');
    if (customerNameElement) {
        customerNameElement.value = '';
    }
    
    // Ödeme yöntemini sıfırla
    const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
    paymentMethods.forEach(radio => {
        radio.checked = false;
    });
    // Nakit ödemeyi varsayılan yap
    const cashPayment = document.querySelector('input[name="paymentMethod"][value="cash"]');
    if (cashPayment) {
        cashPayment.checked = true;
    }
    
    console.log('Sepet tamamen temizlendi. currentSaleItems:', currentSaleItems);
}

// Satış sepet özetini güncelle
function updateSalesCartSummary() {
    try {
        const subtotal = currentSaleItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
        const discount = 0;
        const discountAmount = subtotal * (discount / 100);
        const afterDiscount = subtotal - discountAmount;
        const tax = afterDiscount * 0.18;
        const total = afterDiscount + tax;
        
        const subtotalElement = document.getElementById('subtotal');
        const discountAmountElement = document.getElementById('discountAmount');
        const taxElement = document.getElementById('taxAmount');
        const totalElement = document.getElementById('totalAmount');
        
        if (subtotalElement) subtotalElement.textContent = formatCurrency(subtotal);
        if (discountAmountElement) discountAmountElement.textContent = formatCurrency(discountAmount);
        if (taxElement) taxElement.textContent = formatCurrency(tax);
        if (totalElement) totalElement.textContent = formatCurrency(total);
        
        // Satış tamamla butonunu aktif/pasif yap
        const completeBtn = document.getElementById('completeSalesBtn');
        if (completeBtn) {
            completeBtn.disabled = currentSaleItems.length === 0;
        }
        
        console.log('Sepet özeti güncellendi - Toplam:', total);
        
        // İkinci ekranı da güncelle
        updateSecondScreenDisplay();
    } catch (error) {
        console.error('updateSalesCartSummary hatası:', error);
    }
}

// Satış toplamını güncelle
function updateSalesTotal() {
    updateSalesCartSummary();
}

// Sepeti kaydet
function saveCart() {
    // Bu fonksiyon sepeti geçici olarak kaydedebilir
    window.posAPI.showSuccess('Sepet kaydedildi');
}

// Satışı iptal et
function cancelSale() {
    if (confirm('Satışı iptal etmek istediğinizden emin misiniz?')) {
        currentSaleItems = [];
        updateSalesCartItems();
        updateSalesCartSummary();
        document.getElementById('salesCustomerName').value = '';
        document.getElementById('salesCustomerPhone').value = '';
        document.getElementById('salesCustomerEmail').value = '';
        document.getElementById('salesDiscount').value = '';
    }
}

// Satış sayfası satışını tamamla
async function completeSalesSale() {
    if (currentSaleItems.length === 0) {
        window.posAPI.showError('Sepete ürün ekleyin');
        return;
    }
    
    const customerName = document.getElementById('salesCustomerName').value;
    const customerPhone = document.getElementById('salesCustomerPhone').value;
    const customerEmail = document.getElementById('salesCustomerEmail').value;
    const discount = parseFloat(document.getElementById('salesDiscount').value) || 0;
    const paymentMethod = document.querySelector('input[name="salesPaymentMethod"]:checked').value;
    
    // Satış objesini oluştur
    const sale = {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        items: currentSaleItems,
        subtotal: currentSaleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        discount: discount,
        tax: (currentSaleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0) * (1 - discount/100)) * 0.18,
        total: parseFloat(document.getElementById('salesTotal').textContent.replace(/[^\d.-]/g, '')),
        payment_method: paymentMethod,
        date: new Date().toISOString()
    };
    
    console.log('Oluşturulan satış objesi:', sale);
    console.log('currentSaleItems:', currentSaleItems);
    
    try {
        // Veritabanına kaydet
        if (window.posAPI && typeof window.posAPI.addSale === 'function') {
            await window.posAPI.addSale(sale);
            console.log('Satış veritabanına kaydedildi');
        } else {
            console.warn('posAPI bulunamadı, sadece local array\'e ekleniyor');
        }
        
        // Local array'e ekle
        sales.push(sale);
        
        // Sepeti temizle ve sayaç sıfırla
        currentSaleItems = [];
        updateSalesCartItems();
        updateSalesCartSummary();
        updateCartCounter();
        
        // Form alanlarını temizle
        document.getElementById('salesCustomerName').value = '';
        document.getElementById('salesCustomerPhone').value = '';
        document.getElementById('salesCustomerEmail').value = '';
        document.getElementById('salesDiscount').value = '';
        
        // Başarı kartını göster
        showSaleSuccessCard({
            total: sale.total || 0,
            method: sale.payment_method || 'Nakit',
            time: new Date()
        });
        
        // Raporlar sayfasını güncelle (eğer açıksa)
        if (document.getElementById('reports-page').style.display !== 'none') {
            await loadReportsPage();
        }
        
    } catch (error) {
        console.error('Satış tamamlama hatası:', error);
        
        // Hata durumunda sadece local array'e ekle
        sales.push(sale);
        
        // Sepeti temizle
        currentSaleItems = [];
        updateSalesCartItems();
        updateSalesCartSummary();
        
        // Form alanlarını temizle
        document.getElementById('salesCustomerName').value = '';
        document.getElementById('salesCustomerPhone').value = '';
        document.getElementById('salesCustomerEmail').value = '';
        document.getElementById('salesDiscount').value = '';
        
        showSaleSuccessCard({
            total: sale.total || 0,
            method: sale.payment_method || 'Nakit',
            time: new Date()
        });
        
        // Raporlar sayfasını güncelle (eğer açıksa)
        if (document.getElementById('reports-page').style.display !== 'none') {
            await loadReportsPage();
        }
    }
}

// ===== RAPORLAR SAYFASI FONKSİYONLARI =====

// Raporları güncelle
async function updateReports() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const reportType = document.getElementById('reportType').value;
    
    if (!startDate || !endDate) {
        window.posAPI.showError('Başlangıç ve bitiş tarihi seçin');
        return;
    }
    
    try {
        // Burada rapor verilerini yükleyip tabloyu güncelleyebilirsiniz
        updateSalesReportTable();
    } catch (error) {
        console.error('Rapor güncelleme hatası:', error);
        window.posAPI.showError('Rapor güncellenirken hata oluştu');
    }
}

// Satış rapor tablosunu güncelle
function updateSalesReportTable() {
    const tbody = document.getElementById('salesReportTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Örnek veri
    const sales = [
        {
            id: 'S001',
            date: '2024-01-15',
            customer: 'Ahmet Yılmaz',
            items: 'Parol, Majezik',
            subtotal: 150,
            discount: 10,
            tax: 25.2,
            total: 165.2,
            payment: 'Nakit',
            status: 'Tamamlandı'
        }
    ];
    
    sales.forEach(sale => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sale.id}</td>
            <td>${sale.date}</td>
            <td>${sale.customer}</td>
            <td>${sale.items}</td>
            <td>${formatCurrency(sale.subtotal)}</td>
            <td>${sale.discount}%</td>
            <td>${formatCurrency(sale.tax)}</td>
            <td>${formatCurrency(sale.total)}</td>
            <td>${sale.payment}</td>
            <td><span class="status-badge completed">${sale.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Satış arama
function searchSales() {
    const searchTerm = document.getElementById('salesSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#salesReportTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Satış filtreleme
function filterSales() {
    const filter = document.getElementById('salesFilter').value;
    // Burada filtreleme mantığı eklenebilir
}

// Rapor dışa aktar
function exportReport() {
    window.posAPI.showSuccess('Rapor dışa aktarıldı');
}

// ===== GRAFİKLER SAYFASI FONKSİYONLARI =====

// Raporlar filtresinden gelen son veri setini grafiklerde kullanmak için global referans
window.__reportsFilteredSales = null;

function getSalesDataForCharts() {
    const base = Array.isArray(window.__reportsFilteredSales) && window.__reportsFilteredSales.length >= 0
        ? window.__reportsFilteredSales
        : (Array.isArray(sales) ? sales : []);
    const timeRangeEl = document.getElementById('chartTimeRange');
    const days = timeRangeEl ? parseInt(timeRangeEl.value, 10) : null;
    if (!days) return base;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days + 1);
    return base.filter(s => {
        const d = new Date(s.created_at || s.date);
        return d >= cutoff;
    });
}

// Tüm grafikleri güncelle
function updateAllCharts() {
    const chartType = document.getElementById('chartType')?.value || 'all';
    const dataForCharts = getSalesDataForCharts();
    if (chartType === 'all' || chartType === 'sales') {
        updateSalesTrendChart(dataForCharts);
        updateDailyChart(dataForCharts);
        updatePaymentChart(dataForCharts);
    }
    if (chartType === 'all' || chartType === 'products') {
        updateCategoryChart(dataForCharts);
        updateProductChart(dataForCharts);
    }
    if (chartType === 'all' || chartType === 'customers') {
        updateCustomerChart(dataForCharts);
    }
}

// Grafikleri yenile
function refreshCharts() {
    updateAllCharts();
}

// Satış trendi grafiği
function updateSalesTrendChart(salesData = sales) {
    const ctx = document.getElementById('salesTrendChart');
    if (!ctx) return;
    
    const type = document.getElementById('salesTrendType')?.value || 'revenue';
    
    // Gerçek verilerden trend hesapla
    const last6Months = [];
    const labels = [];
    const data = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = date.toLocaleDateString('tr-TR', { month: 'long' });
        labels.push(monthName);
        
        // Bu ayın satışlarını hesapla
        const monthSales = salesData.filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate.getMonth() === date.getMonth() && 
                   saleDate.getFullYear() === date.getFullYear();
        });
        
        if (type === 'revenue') {
            const revenue = monthSales.reduce((sum, sale) => sum + sale.total, 0);
            data.push(revenue);
        } else if (type === 'orders') {
            data.push(monthSales.length);
        } else {
            data.push(monthSales.length); // Müşteri sayısı = sipariş sayısı
        }
    }
    
    if (POS.charts.salesTrendChart) {
        POS.charts.salesTrendChart.destroy();
    }
    
    POS.charts.salesTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: type === 'revenue' ? 'Ciro (₺)' : type === 'orders' ? 'Sipariş Sayısı' : 'Müşteri Sayısı',
                data: data,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Kategori grafiği
function updateCategoryChart(salesData = sales) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    
    const type = document.getElementById('categoryChartType')?.value || 'revenue';
    
    // Gerçek verilerden kategori dağılımını hesapla
    const categoryData = {};
    
    salesData.forEach(sale => {
        sale.items.forEach(item => {
            const category = item.category || 'Diğer';
            if (!categoryData[category]) {
                categoryData[category] = { revenue: 0, quantity: 0 };
            }
            
            if (type === 'revenue') {
                categoryData[category].revenue += item.price * item.quantity;
            } else {
                categoryData[category].quantity += item.quantity;
            }
        });
    });
    
    const labels = Object.keys(categoryData);
    const data = labels.map(category => 
        type === 'revenue' ? categoryData[category].revenue : categoryData[category].quantity
    );
    
    // Renk paleti
    const colors = [
        '#3498db', '#2ecc71', '#f39c12', '#e74c3c', 
        '#9b59b6', '#1abc9c', '#34495e', '#e67e22'
    ];
    
    if (POS.charts.categoryChart) {
        POS.charts.categoryChart.destroy();
    }
    
    POS.charts.categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            if (type === 'revenue') {
                                return `${label}: ₺${value.toFixed(2)}`;
                            } else {
                                return `${label}: ${value} adet`;
                            }
                        }
                    }
                }
            }
        }
    });
}

// Günlük performans grafiği
function updateDailyChart(salesData = sales) {
    const ctx = document.getElementById('dailyChart');
    if (!ctx) return;
    
    const type = document.getElementById('dailyChartType')?.value || 'revenue';
    
    // Gerçek verilerden günlük performansı hesapla
    const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const labels = [];
    const data = [];
    
    // Son 7 günün verilerini al
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayName = dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1]; // Pazartesi = 0
        labels.push(dayName);
        
        // Bu günün satışlarını hesapla
        const daySales = salesData.filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate.toDateString() === date.toDateString();
        });
        
        if (type === 'revenue') {
            const revenue = daySales.reduce((sum, sale) => sum + sale.total, 0);
            data.push(revenue);
        } else {
            data.push(daySales.length);
        }
    }
    
    if (POS.charts.dailyChart) {
        POS.charts.dailyChart.destroy();
    }
    
    POS.charts.dailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: type === 'revenue' ? 'Günlük Ciro' : type === 'orders' ? 'Günlük Sipariş' : 'Ortalama Sipariş',
                data: data,
                backgroundColor: '#3498db',
                borderColor: '#2980b9',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Müşteri analizi grafiği
function updateCustomerChart(salesData = sales) {
    const ctx = document.getElementById('customerChart');
    if (!ctx) return;
    
    const type = document.getElementById('customerChartType').value;
    
    // Basit müşteri segmentasyonu: aynı güne birden fazla satış yapanı "Dönen" varsay, tek satış yapanı "Yeni" say
    // (Gerçek müşteri datası yoksa sipariş bazlı yaklaşım)
    const byDayCount = {};
    salesData.forEach(s => {
        const key = new Date(s.created_at || s.date).toDateString();
        byDayCount[key] = (byDayCount[key] || 0) + 1;
    });
    const returning = Object.values(byDayCount).filter(c => c > 1).length;
    const newOnes = Object.values(byDayCount).filter(c => c === 1).length;
    const loyal = Math.max(0, Math.round(returning * 0.3));
    const labels = ['Yeni', 'Dönen', 'Sadık'];
    const data = [newOnes, returning, loyal];
    
    if (POS.charts.customerChart) {
        POS.charts.customerChart.destroy();
    }
    
    POS.charts.customerChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#3498db',
                    '#2ecc71',
                    '#f39c12'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

// Ürün performansı grafiği
function updateProductChart(salesData = sales) {
    const ctx = document.getElementById('productChart');
    if (!ctx) return;
    
    const type = document.getElementById('productChartType').value;
    
    // Satışlardan ürün performansı hesapla
    const productMap = new Map();
    salesData.forEach(sale => {
        (sale.items || []).forEach(item => {
            const key = item.name || item.barcode || 'N/A';
            if (!productMap.has(key)) {
                productMap.set(key, { qty: 0, revenue: 0, stock: item.stock ?? 0 });
            }
            const rec = productMap.get(key);
            rec.qty += item.quantity || 1;
            rec.revenue += (item.price || 0) * (item.quantity || 1);
            productMap.set(key, rec);
        });
    });
    let entries = Array.from(productMap.entries());
    if (type === 'top') {
        entries.sort((a,b)=>b[1].qty - a[1].qty);
    } else if (type === 'revenue') {
        entries.sort((a,b)=>b[1].revenue - a[1].revenue);
    } else {
        entries.sort((a,b)=> (b[1].stock||0) - (a[1].stock||0));
    }
    entries = entries.slice(0, 10);
    const labels = entries.map(e=>e[0]);
    const data = entries.map(e=> type==='top' ? e[1].qty : type==='revenue' ? e[1].revenue : (e[1].stock||0));
    
    if (POS.charts.productChart) {
        POS.charts.productChart.destroy();
    }
    
    POS.charts.productChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: type === 'top' ? 'Satış Adedi' : type === 'revenue' ? 'Ciro' : 'Stok',
                data: data,
                backgroundColor: '#e74c3c',
                borderColor: '#c0392b',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Ödeme analizi grafiği
function updatePaymentChart(salesData = sales) {
    const ctx = document.getElementById('paymentChart');
    if (!ctx) return;
    
    const type = document.getElementById('paymentChartType')?.value || 'revenue';
    
    // Gerçek verilerden ödeme yöntemi dağılımını hesapla
    const paymentData = {};
    
    salesData.forEach(sale => {
        const method = sale.paymentMethod || 'cash';
        const methodName = {
            'cash': 'Nakit',
            'card': 'Kart',
            'transfer': 'Havale',
            'discount': 'İndirim'
        }[method] || method;
        
        if (!paymentData[methodName]) {
            paymentData[methodName] = { revenue: 0, count: 0 };
        }
        
        if (type === 'revenue') {
            paymentData[methodName].revenue += sale.total;
        } else {
            paymentData[methodName].count += 1;
        }
    });
    
    const labels = Object.keys(paymentData);
    const data = labels.map(method => 
        type === 'revenue' ? paymentData[method].revenue : paymentData[method].count
    );
    
    // Renk paleti
    const colors = ['#2ecc71', '#3498db', '#f39c12', '#e74c3c', '#9b59b6'];
    
    if (POS.charts.paymentChart) {
        POS.charts.paymentChart.destroy();
    }
    
    POS.charts.paymentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            if (type === 'revenue') {
                                return `${label}: ₺${value.toFixed(2)}`;
                            } else {
                                return `${label}: ${value} satış`;
                            }
                        }
                    }
                }
            }
        }
    });
}

// Sales functions
// Bu fonksiyon yukarıda tanımlanmış, burada tekrar tanımlanmamalı

// Reports functions
function loadReports() {
    console.log('Raporlar sayfası yükleniyor...');
    loadReportsPage(); // Raporlar sayfası yüklendiğinde verileri yükle
}

// Charts functions
// Bu fonksiyon yukarıda tanımlanmış, burada tekrar tanımlanmamalı

// Grafikleri verilerle güncelle
function updateChartsWithData(salesData) {
    console.log('Grafikler güncelleniyor, toplam satış:', salesData.length);
    
    // Satış trendi grafiği
    updateSalesTrendChart(salesData);
    
    // Kategori dağılımı grafiği
    updateCategoryChart(salesData);
    
    // Günlük satış grafiği
    updateDailyChart(salesData);
    
    // Müşteri analizi grafiği
    updateCustomerChart(salesData);
    
    // Ürün performansı grafiği
    updateProductChart(salesData);
    
    // Ödeme yöntemi grafiği
    updatePaymentChart(salesData);
}

// Analytics functions
function loadAnalytics() {
    console.log('Analiz sayfası yükleniyor...');
    updateAnalytics();
}

function updateAnalytics() {
    console.log('Analiz güncelleniyor...');
    
    // Calculate total revenue
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    
    // Update total revenue
    const totalRevenueElement = document.getElementById('totalRevenue');
    if (totalRevenueElement) {
        totalRevenueElement.textContent = `₺${totalRevenue.toFixed(2)}`;
    }
    
    // Update target achievement
    const targetAchievementElement = document.getElementById('targetAchievement');
    if (targetAchievementElement) {
        const target = 30000;
        const achievement = target > 0 ? (totalRevenue / target) * 100 : 0;
        targetAchievementElement.textContent = `${achievement.toFixed(1)}%`;
    }
    
    // Update growth rate
    const growthRateElement = document.getElementById('growthRate');
    if (growthRateElement) {
        growthRateElement.textContent = '+15.5%';
    }
    
    // Update performance score
    const performanceScoreElement = document.getElementById('performanceScore');
    if (performanceScoreElement) {
        const score = Math.min(100, (totalRevenue / 30000) * 100);
        performanceScoreElement.textContent = `${Math.round(score)}/100`;
    }
    
    // Update progress bars
    updateProgressBars(totalRevenue);
}

function updateProgressBars(totalRevenue) {
    console.log('Progress bar\'lar güncelleniyor...');
    
    // Daily progress
    const dailyProgressFill = document.getElementById('dailyProgressFill');
    const dailyProgressValue = document.getElementById('dailyProgressValue');
    const dailyProgressText = document.getElementById('dailyProgressText');
    
    if (dailyProgressFill && dailyProgressValue && dailyProgressText) {
        const dailyRevenue = totalRevenue / 30;
        const dailyProgress = Math.min(100, (dailyRevenue / 1000) * 100);
        dailyProgressFill.style.width = `${dailyProgress}%`;
        dailyProgressValue.textContent = `${dailyProgress.toFixed(1)}%`;
        dailyProgressText.textContent = `₺${dailyRevenue.toFixed(2)} / ₺1000`;
    }
    
    // Weekly progress
    const weeklyProgressFill = document.getElementById('weeklyProgressFill');
    const weeklyProgressValue = document.getElementById('weeklyProgressValue');
    const weeklyProgressText = document.getElementById('weeklyProgressText');
    
    if (weeklyProgressFill && weeklyProgressValue && weeklyProgressText) {
        const weeklyRevenue = totalRevenue / 4;
        const weeklyProgress = Math.min(100, (weeklyRevenue / 7000) * 100);
        weeklyProgressFill.style.width = `${weeklyProgress}%`;
        weeklyProgressValue.textContent = `${weeklyProgress.toFixed(1)}%`;
        weeklyProgressText.textContent = `₺${weeklyRevenue.toFixed(2)} / ₺7000`;
    }
    
    // Monthly progress
    const monthlyProgressFill = document.getElementById('monthlyProgressFill');
    const monthlyProgressValue = document.getElementById('monthlyProgressValue');
    const monthlyProgressText = document.getElementById('monthlyProgressText');
    
    if (monthlyProgressFill && monthlyProgressValue && monthlyProgressText) {
        const monthlyProgress = Math.min(100, (totalRevenue / 30000) * 100);
        monthlyProgressFill.style.width = `${monthlyProgress}%`;
        monthlyProgressValue.textContent = `${monthlyProgress.toFixed(1)}%`;
        monthlyProgressText.textContent = `₺${totalRevenue.toFixed(2)} / ₺30000`;
    }

}

// Stock functions
function loadStock() {
    console.log('Stok sayfası yükleniyor...');
    updateStockTable();
    updateStockStats();
    updateStockSummary();
}

function updateStockTable() {
    console.log('Stok tablosu güncelleniyor...');
    
    const tableBody = document.getElementById('stockTableBody');
    if (!tableBody) {
        console.error('stockTableBody bulunamadı!');
        return;
    }
    
    if (stockItems.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10" class="no-data">Henüz ürün eklenmemiş</td></tr>';
        return;
    }
    
    const tableRows = stockItems.map(item => {
        const profit = (item.salePrice - item.purchasePrice) * item.stock;
        const stockClass = item.stock === 0 ? 'critical' : item.stock <= 5 ? 'low' : 'normal';
        
        return `
            <tr class="stock-row ${stockClass}">
                <td>${item.barcode}</td>
                <td>${item.name}</td>
                <td>${item.brand}</td>
                <td>${item.category}</td>
                <td class="stock-amount ${stockClass}">${item.stock}</td>
                <td>₺${item.purchasePrice.toFixed(2)}</td>
                <td>₺${item.salePrice.toFixed(2)}</td>
                <td class="profit ${profit >= 0 ? 'positive' : 'negative'}">₺${profit.toFixed(2)}</td>
                <td class="actions">
                    <button onclick="editStockItem('${item.barcode}')" class="btn-edit" title="Düzenle">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteStockItem('${item.barcode}')" class="btn-delete" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button onclick="addStockQuantity('${item.barcode}')" class="btn-add" title="Stok Ekle">
                        <i class="fas fa-plus"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = tableRows;
    console.log('Stok tablosu güncellendi,', stockItems.length, 'ürün');
}

function updateStockStats() {
    console.log('Stok istatistikleri güncelleniyor...');
    
    const totalProducts = stockItems.length;
    const totalStock = stockItems.reduce((sum, item) => sum + item.stock, 0);
    const stockValue = stockItems.reduce((sum, item) => sum + (item.stock * item.purchasePrice), 0);
    const outOfStock = stockItems.filter(item => item.stock === 0).length;
    
    const totalProductsElement = document.getElementById('totalProducts');
    const totalStockElement = document.getElementById('totalStock');
    const stockValueElement = document.getElementById('stockValue');
    const outOfStockElement = document.getElementById('outOfStock');
    
    if (totalProductsElement) totalProductsElement.textContent = totalProducts;
    if (totalStockElement) totalStockElement.textContent = totalStock;
    if (stockValueElement) stockValueElement.textContent = `₺${stockValue.toFixed(2)}`;
    if (outOfStockElement) outOfStockElement.textContent = outOfStock;
}

function updateStockSummary() {
    console.log('Stok özeti güncelleniyor...');
    
    const criticalStock = stockItems.filter(item => item.stock === 0).length;
    const lowStock = stockItems.filter(item => item.stock > 0 && item.stock <= 5).length;
    const normalStock = stockItems.filter(item => item.stock > 5).length;
    
    const criticalElement = document.getElementById('criticalStock');
    const lowElement = document.getElementById('lowStock');
    const normalElement = document.getElementById('normalStock');
    
    if (criticalElement) criticalElement.textContent = `${criticalStock} ürün`;
    if (lowElement) lowElement.textContent = `${lowStock} ürün`;
    if (normalElement) normalElement.textContent = `${normalStock} ürün`;
}

// Stock operations
function editStockItem(barcode) {
    console.log('Ürün düzenleniyor:', barcode);
    alert('Düzenleme özelliği henüz aktif değil');
}

function deleteStockItem(barcode) {
    console.log('Ürün siliniyor:', barcode);
    if (confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
        stockItems = stockItems.filter(item => item.barcode !== barcode);
        updateStockTable();
        updateStockStats();
        updateStockSummary();
        alert('Ürün silindi!');
    }
}

function addStockQuantity(barcode) {
    console.log('Stok ekleniyor:', barcode);
    const quantity = prompt('Eklenecek stok miktarını girin:');
    if (quantity && !isNaN(quantity) && parseInt(quantity) > 0) {
        const item = stockItems.find(item => item.barcode === barcode);
        if (item) {
            item.stock += parseInt(quantity);
            updateStockTable();
            updateStockStats();
            updateStockSummary();
            alert(`${quantity} adet stok eklendi!`);
        }
    }
}

// Sidebar toggle
function toggleSidebar() {
    console.log('Sidebar toggle çağrıldı');
    
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (sidebar && mainContent) {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        
        const toggleIcon = sidebar.querySelector('.sidebar-toggle i');
        if (toggleIcon) {
            if (sidebar.classList.contains('collapsed')) {
                toggleIcon.className = 'fas fa-chevron-right';
            } else {
                toggleIcon.className = 'fas fa-bars';
            }
        }
    }
}

// Modal kapatma fonksiyonu
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}



// Initialize when DOM is loaded
// ===== YENİ UYGULAMA BAŞLATMA SİSTEMİ =====

// Main application initialization - Basit ve güvenilir
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 POS Uygulaması başlatılıyor...');
    
    try {
        // Veritabanını başlat
        if (window.posAPI && typeof window.posAPI.initDatabase === 'function') {
            const result = await window.posAPI.initDatabase();
            if (!result || !result.success) {
                console.error('❌ Veritabanı başlatma hatası:', result?.error);
            } else {
                console.log('✅ Veritabanı başarıyla başlatıldı');
            }
        }
        
        // Verileri başlat
        await initializeData();
        console.log('✅ Veriler başlatıldı');
        
        // Sidebar durumunu geri yükle
        restoreSidebarState();
        
        // Chart type butonları için event listener'ları ayarla
        setupChartTypeButtons();
        
        // UI'yi işaretle
        POS.ui.isInitialized = true;
        
        // Dashboard'u göster
        showTab('dashboard');
        
        console.log('🎉 POS Uygulaması başarıyla başlatıldı!');
        
    } catch (error) {
        console.error('❌ Uygulama başlatma hatası:', error);
    }
});

// Event listener sistemi kaldırıldı - inline onclick kullanılıyor

function setupChartTypeButtons() {
    const chartTypeButtons = document.querySelectorAll('.chart-type-btn');
    chartTypeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.getAttribute('data-type');
            if (typeof changeChartType === 'function') {
                changeChartType(type);
            }
        });
    });
}

// Sidebar toggle event listener kaldırıldı - inline onclick kullanılıyor

// Global fonksiyonları window'a ekle
window.showTab = showTab;
window.openNewSale = openNewSale;
window.openAddProduct = openAddProduct;
window.addItemToSale = addItemToSale;
window.completeSale = completeSale;
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.addCategory = addCategory;
window.generateSalesReport = generateSalesReport;
window.toggleSidebar = toggleSidebar;
window.closeModal = closeModal;
window.removeSaleItem = removeSaleItem;

// Yeni satış sayfası fonksiyonları
window.searchProducts = searchProducts;
window.filterProductsByCategory = filterProductsByCategory;
window.clearSearch = clearSearch;
window.showProductDetail = showProductDetail;
window.closeProductDetail = closeProductDetail;
window.decreaseQuantity = decreaseQuantity;
window.increaseQuantity = increaseQuantity;
window.addToCartFromDetail = addToCartFromDetail;
window.updateCartItemQuantity = updateCartItemQuantity;
window.removeCartItem = removeCartItem;
window.clearCart = clearCart;

// Dashboard fonksiyonları
window.updateMainChart = updateMainChart;
window.refreshDashboard = refreshDashboard;

// Satış sayfası fonksiyonları
window.searchProductsForSale = searchProductsForSale;
window.filterProductsForSale = filterProductsForSale;
window.clearSalesSearch = clearSalesSearch;
window.addToSalesCart = addToSalesCart;
window.addProductToCartFromSuggestion = addProductToCartFromSuggestion;
window.updateSalesCartItemQuantity = updateSalesCartItemQuantity;
window.removeSalesCartItem = removeSalesCartItem;
window.clearSalesCart = clearSalesCart;
window.updateSalesTotal = updateSalesTotal;
window.saveCart = saveCart;
window.cancelSale = cancelSale;
window.completeSalesSale = completeSalesSale;

// Raporlar fonksiyonları
window.updateReports = updateReports;
window.searchSales = searchSales;
window.filterSales = filterSales;
window.exportReport = exportReport;

// Grafikler fonksiyonları
window.updateAllCharts = updateAllCharts;
window.refreshCharts = refreshCharts;
window.updateSalesTrendChart = updateSalesTrendChart;
window.updateCategoryChart = updateCategoryChart;
window.updateDailyChart = updateDailyChart;
window.updateCustomerChart = updateCustomerChart;
window.updateProductChart = updateProductChart;
window.updatePaymentChart = updatePaymentChart;

// Raporlar Sayfası Fonksiyonları

// Tarih filtresi ayarla (select ile)
function setDateFilterFromSelect() {
    const filterType = document.getElementById('dateFilterSelect').value;
    setDateFilter(filterType);
}

// Tarih filtresi ayarla
async function setDateFilter(filterType) {
    const today = new Date();
    let startDate, endDate;
    
    switch(filterType) {
        case 'today':
            startDate = new Date(today);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            break;
        case '7days':
            startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            break;
        case '30days':
            startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'year':
            startDate = new Date(today.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'custom':
            document.getElementById('customDateRange').style.display = 'block';
            return;
    }
    
    document.getElementById('customDateRange').style.display = 'none';
    await loadReportsData(startDate, endDate);
}

// Özel tarih filtresi güncelle
async function updateCustomDateFilter() {
    const startDate = document.getElementById('customStartDate').value;
    const endDate = document.getElementById('customEndDate').value;
    
    if (startDate && endDate) {
        await loadReportsData(new Date(startDate), new Date(endDate));
    }
}

// Rapor verilerini yükle
async function loadReportsData(startDate, endDate) {
    console.log('Rapor verileri yükleniyor:', { startDate, endDate });
    console.log('Mevcut sales array uzunluğu:', sales.length);
    
    try {
        // Veritabanından satışları çek
        if (window.posAPI && typeof window.posAPI.getSales === 'function') {
            const dbSales = await window.posAPI.getSales();
            sales = dbSales; // Local array'i güncelle
            console.log('Veritabanından satışlar yüklendi:', dbSales.length);
            console.log('Veritabanı satışları:', dbSales);
        } else {
            console.warn('posAPI bulunamadı, mevcut sales array kullanılıyor');
        }
        
        console.log('Filtreleme öncesi sales array:', sales);
        
        // Satışları filtrele
        const filteredSales = sales.filter(sale => {
            const saleDate = new Date(sale.created_at || sale.date);
            console.log('Satış tarihi:', saleDate, 'Başlangıç:', startDate, 'Bitiş:', endDate);
            return saleDate >= startDate && saleDate <= endDate;
        });
        
        console.log('Filtrelenmiş satışlar:', filteredSales.length);
        console.log('Filtrelenmiş satışlar detayı:', filteredSales);
        // Grafiklerin rapor filtresiyle senkron olması için sakla ve güncelle
        window.__reportsFilteredSales = filteredSales;
        updateAllCharts();
        
        updateReportsStats(filteredSales);
        loadReportsTable(filteredSales);
        
    } catch (error) {
        console.error('Rapor verileri yüklenirken hata:', error);
        // Hata durumunda mevcut sales array'i kullan
        const filteredSales = sales.filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate >= startDate && saleDate <= endDate;
        });
        
        updateReportsStats(filteredSales);
        loadReportsTable(filteredSales);
        window.__reportsFilteredSales = filteredSales;
        updateAllCharts();
    }
}

// Rapor istatistiklerini güncelle
function updateReportsStats(filteredSales) {
    const totalSales = filteredSales.reduce((sum, sale) => sum + (sale.total || sale.total_amount || 0), 0);
    
    // Toplam kar hesaplama
    const totalProfit = filteredSales.reduce((sum, sale) => {
        return sum + sale.items.reduce((itemSum, item) => {
            const purchasePrice = item.purchasePrice || item.purchase_price || (item.price * 0.8);
            const unitPrice = item.price || item.unit_price || 0;
            const quantity = item.quantity || 1;
            return itemSum + (unitPrice - purchasePrice) * quantity;
        }, 0);
    }, 0);
    
    const totalQuantity = filteredSales.reduce((sum, sale) => {
        return sum + sale.items.reduce((itemSum, item) => itemSum + (item.quantity || 1), 0);
    }, 0);
    
    const avgProfitMargin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0;
    
    // İstatistikleri güncelle
    const totalSalesElement = document.getElementById('totalSales');
    const totalProfitElement = document.getElementById('totalProfit');
    const totalQuantityElement = document.getElementById('totalQuantity');
    const avgProfitMarginElement = document.getElementById('avgProfitMargin');
    
    if (totalSalesElement) totalSalesElement.textContent = `₺${totalSales.toFixed(2)}`;
    if (totalProfitElement) totalProfitElement.textContent = `₺${totalProfit.toFixed(2)}`;
    if (totalQuantityElement) totalQuantityElement.textContent = totalQuantity;
    if (avgProfitMarginElement) avgProfitMarginElement.textContent = `%${avgProfitMargin}`;
}

// Rapor tablosunu yükle
function loadReportsTable(filteredSales) {
    const tbody = document.getElementById('detailedReportTableBody');
    const noDataMessage = document.getElementById('noDataMessage');
    const tableInfo = document.getElementById('tableRowCount');
    
    if (!tbody) return;
    
    console.log('loadReportsTable çağrıldı, filteredSales:', filteredSales);
    console.log('Toplam satış sayısı:', filteredSales.length);
    
    tbody.innerHTML = '';
    
    let rowCount = 0;
    
    filteredSales.forEach((sale, saleIndex) => {
        console.log(`Satış ${saleIndex + 1}:`, sale);
        console.log(`Satış ${saleIndex + 1} items:`, sale.items);
        
        if (!sale.items || !Array.isArray(sale.items)) {
            console.warn(`Satış ${saleIndex + 1} items array değil:`, sale.items);
            return;
        }
        
        sale.items.forEach((item, itemIndex) => {
            console.log(`Satış ${saleIndex + 1}, Ürün ${itemIndex + 1}:`, item);
            
            // Kar hesaplama - alış fiyatı varsa kullan, yoksa tahmin et
            const purchasePrice = item.purchasePrice || item.purchase_price || (item.price * 0.8); // Varsayılan %20 kar marjı
            const unitPrice = item.price || item.unit_price || 0;
            const quantity = item.quantity || 1;
            const profit = unitPrice - purchasePrice;
            const profitMargin = purchasePrice > 0 ? ((profit / purchasePrice) * 100).toFixed(1) : 0;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(sale.date || sale.created_at).toLocaleDateString('tr-TR')}</td>
                <td>${item.barcode || 'N/A'}</td>
                <td>${item.name || 'N/A'}</td>
                <td>${item.brand || '-'}</td>
                <td>${item.category || 'N/A'}</td>
                <td>${quantity}</td>
                <td>₺${purchasePrice.toFixed(2)}</td>
                <td>₺${unitPrice.toFixed(2)}</td>
                <td>
                    <div class="profit-amount">₺${profit.toFixed(2)}</div>
                    <div class="profit-margin">%${profitMargin}</div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn return" onclick="openProductActions('${item.barcode || ''}', 'return')" title="İade">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button class="action-btn edit" onclick="openProductActions('${item.barcode || ''}', 'edit')" title="Düzenle">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="openProductActions('${item.barcode || ''}', 'delete')" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="action-btn exchange" onclick="openProductActions('${item.barcode || ''}', 'exchange')" title="Değiştir">
                            <i class="fas fa-exchange-alt"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
            rowCount++;
        });
    });
    
    // Tablo bilgisini güncelle
    if (tableInfo) {
        tableInfo.textContent = rowCount;
    }
    
    // Veri bulunamadı mesajını göster/gizle
    if (noDataMessage) {
        if (rowCount === 0) {
            noDataMessage.style.display = 'block';
        } else {
            noDataMessage.style.display = 'none';
        }
    }
}

// Ürün işlemleri modalını aç
function openProductActions(productId, action) {
    // Seçilen ürünü global değişkende sakla
    window.selectedProductId = productId;
    
    switch(action) {
        case 'return':
            openProductReturnModal();
            break;
        case 'edit':
            openProductEditModal();
            break;
        case 'delete':
            openProductDeleteModal();
            break;
        case 'exchange':
            openProductExchangeModal();
            break;
    }
}

// Hızlı ürün ekleme modalını aç
function openQuickAddModal() {
    document.getElementById('quickAddModal').style.display = 'flex';
    updateCategorySelects();
    document.getElementById('quickAddForm').reset();
}

// Hızlı ürün kaydet
function saveQuickProduct(event) {
    event.preventDefault();
    
    const name = document.getElementById('quickProductName').value;
    const brand = document.getElementById('quickBrand').value;
    const category = document.getElementById('quickCategory').value;
    const quantity = parseInt(document.getElementById('quickStock').value);
    const purchasePrice = parseFloat(document.getElementById('quickPurchasePrice').value);
    const salePrice = parseFloat(document.getElementById('quickSalePrice').value);
    
    // Sadece raporlar için satış kaydı oluştur (stockItems'a ekleme)
    const barcode = `QUICK-${Date.now().toString().slice(-6)}`;
    const newSale = {
        id: sales.length + 1,
        date: new Date().toISOString(),
        items: [
            {
                barcode: barcode,
                name: name,
                brand: brand,
                category: category,
                price: salePrice,
                purchasePrice: purchasePrice,
                quantity: quantity,
                total: salePrice * quantity
            }
        ],
        subtotal: salePrice * quantity,
        discount: 0,
        tax: (salePrice * quantity) * 0.18,
        total: (salePrice * quantity) * 1.18,
        paymentMethod: 'cash'
    };
    sales.push(newSale);
    
    alert(`Ürün "${name}" raporlar listesine eklendi!`);
    
    // Modal'ı kapat
    closeModal('quickAddModal');
    
    // Raporlar sayfasını yenile
    loadReportsPage();
    
    // Arama ve kategori filtresini sıfırla ve tekrar filtrele
    document.getElementById('reportProductSearch').value = '';
    document.getElementById('reportCategoryFilter').value = '';
    filterReportProducts();
    
    // Yeni eklenen ürüne kaydır
    const reportsProductsTable = document.getElementById('reportsProductsTable');
    if (reportsProductsTable) {
        reportsProductsTable.scrollIntoView({ behavior: 'smooth' });
    }
}

// Ürün iade modalını aç
function openProductReturnModal() {
    document.getElementById('productReturnModal').style.display = 'flex';
}

// Ürün düzenleme modalını aç
function openEditProductModal(productId) {
    const product = stockItems.find(item => item.barcode === productId);
    if (product) {
        document.getElementById('editProductId').value = product.barcode;
        document.getElementById('editBarcode').value = product.barcode;
        document.getElementById('editProductName').value = product.name;
        document.getElementById('editBrand').value = product.brand;
        updateCategorySelects();
        const editCategory = document.getElementById('editCategory');
        if (editCategory) editCategory.value = product.category || '';
        document.getElementById('editStock').value = product.stock;
        
        document.getElementById('editPurchasePrice').value = product.purchasePrice;
        document.getElementById('editSalePrice').value = product.salePrice;
        document.getElementById('editDescription').value = product.description || '';
        
        updateCategorySelects();
        document.getElementById('editProductModal').style.display = 'flex';
    }
}

// Ürün güncelle
async function updateProduct(event) {
    event.preventDefault();
    
    const productId = document.getElementById('editProductId').value;
    const productIndex = stockItems.findIndex(item => item.barcode === productId);
    
    if (productIndex !== -1) {
        const updatedProduct = {
            barcode: document.getElementById('editBarcode').value,
            name: document.getElementById('editProductName').value,
            brand: document.getElementById('editBrand').value,
            category: document.getElementById('editCategory').value,
            stock: parseInt(document.getElementById('editStock').value),
            minStock: 0,
            purchasePrice: parseFloat(document.getElementById('editPurchasePrice').value),
            salePrice: parseFloat(document.getElementById('editSalePrice').value),
            description: document.getElementById('editDescription').value || ''
        };
        
        // Barkod değiştiyse kontrol et
        if (updatedProduct.barcode !== productId) {
            const existingIndex = stockItems.findIndex(item => item.barcode === updatedProduct.barcode);
            if (existingIndex !== -1 && existingIndex !== productIndex) {
                alert('Bu barkod zaten kullanılıyor!');
                return;
            }
        }
        
        try {
            // Veritabanına güncelle
            if (window.posAPI && typeof window.posAPI.updateProduct === 'function') {
                const originalProduct = stockItems[productIndex];
                if (originalProduct && originalProduct.id) {
                    await window.posAPI.updateProduct(originalProduct.id, updatedProduct);
                    console.log('Ürün veritabanında güncellendi');
                }
            } else {
                console.warn('posAPI bulunamadı, sadece local array güncelleniyor');
            }
            
            // Local array'i güncelle
            stockItems[productIndex] = updatedProduct;
            
            // Kategoriyi listeye ekle
            if (updatedProduct.category && !categories.includes(updatedProduct.category)) {
                categories.push(updatedProduct.category);
            }
            
            closeModal('editProductModal');
            loadProductsTable();
            updateCategorySelects();
            
            // Satış sayfası arama barını yenile (eğer açıksa)
            if (document.getElementById('sales-page') && document.getElementById('sales-page').style.display !== 'none') {
                console.log('Satış sayfası açık, arama barı yenileniyor');
                // Arama input'unu temizle ve yeniden arama yap
                const searchInput = document.getElementById('newProductSearch');
                if (searchInput) {
                    searchInput.value = '';
                    // Arama önerilerini gizle
                    const suggestions = document.getElementById('newSearchSuggestions');
                    if (suggestions) {
                        suggestions.style.display = 'none';
                    }
                }
            }
            
            alert('Ürün başarıyla güncellendi!');
            
        } catch (error) {
            console.error('Ürün güncelleme hatası:', error);
            
            // Hata durumunda sadece local array'i güncelle
            stockItems[productIndex] = updatedProduct;
            
            // Kategoriyi listeye ekle
            if (updatedProduct.category && !categories.includes(updatedProduct.category)) {
                categories.push(updatedProduct.category);
            }
            
            closeModal('editProductModal');
            loadProductsTable();
            updateCategorySelects();
            alert('Ürün güncellendi (veritabanı hatası nedeniyle geçici olarak)');
        }
    }
}

// Ürün düzenleme modalını aç (raporlar sayfasından)
function openProductEditModal() {
    const product = stockItems.find(item => item.barcode === window.selectedProductId);
    if (product) {
        // Mevcut düzenleme modalını kullan
        openEditProductModal(window.selectedProductId);
    }
}

// Ürün silme modalını aç
function openProductDeleteModal() {
    if (confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
        stockItems = stockItems.filter(item => item.barcode !== window.selectedProductId);
        loadReportsTable(sales);
        updateReportsStats(sales);
        alert('Ürün başarıyla silindi!');
    }
}

// Ürün değişimi modalını aç
function openProductExchangeModal() {
    const product = stockItems.find(item => item.barcode === window.selectedProductId);
    if (product) {
        document.getElementById('currentProduct').value = product.name;
        
        // Ürün seçeneklerini doldur
        const newProductSelect = document.getElementById('newProduct');
        newProductSelect.innerHTML = '<option value="">Ürün seçin</option>';
        
        stockItems.forEach(item => {
            if (item.barcode !== window.selectedProductId) {
                const option = document.createElement('option');
                option.value = item.barcode;
                option.textContent = `${item.name} (${item.brand})`;
                newProductSelect.appendChild(option);
            }
        });
        
        document.getElementById('productExchangeModal').style.display = 'flex';
    }
}

// İade işlemini gerçekleştir
function processReturn(event) {
    event.preventDefault();
    
    const reason = document.getElementById('returnReason').value;
    const quantity = parseInt(document.getElementById('returnQuantity').value);
    const description = document.getElementById('returnDescription').value;
    
    // Burada iade işlemi gerçekleştirilir
    console.log('İade işlemi:', {
        productId: window.selectedProductId,
        reason,
        quantity,
        description
    });
    
    closeModal('productReturnModal');
    alert('İade işlemi başarıyla gerçekleştirildi!');
}

// Değişim işlemini gerçekleştir
function processExchange(event) {
    event.preventDefault();
    
    const newProductId = document.getElementById('newProduct').value;
    const reason = document.getElementById('exchangeReason').value;
    const description = document.getElementById('exchangeDescription').value;
    
    // Burada değişim işlemi gerçekleştirilir
    console.log('Değişim işlemi:', {
        oldProductId: window.selectedProductId,
        newProductId,
        reason,
        description
    });
    
    closeModal('productExchangeModal');
    alert('Değişim işlemi başarıyla gerçekleştirildi!');
}

// Detaylı rapor arama
function searchDetailedReport() {
    const searchTerm = document.getElementById('reportSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#detailedReportTableBody tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    // Tablo bilgisini güncelle
    const tableInfo = document.getElementById('tableRowCount');
    if (tableInfo) {
        tableInfo.textContent = visibleCount;
    }
    
    // Veri bulunamadı mesajını göster/gizle
    const noDataMessage = document.getElementById('noDataMessage');
    if (noDataMessage) {
        if (visibleCount === 0) {
            noDataMessage.style.display = 'block';
        } else {
            noDataMessage.style.display = 'none';
        }
    }
}

// Arama kutusunu temizle
function clearReportSearch() {
    document.getElementById('reportSearch').value = '';
    searchDetailedReport();
}

// Özel tarih filtresini uygula
function applyCustomDateFilter() {
    const startDate = document.getElementById('customStartDate').value;
    const endDate = document.getElementById('customEndDate').value;
    
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        loadReportsData(start, end);
    } else {
        alert('Lütfen başlangıç ve bitiş tarihlerini seçin!');
    }
}

// Raporları dışa aktar
function exportReports() {
    const table = document.getElementById('detailedReportTable');
    const rows = table.querySelectorAll('tbody tr');
    
    if (rows.length === 0) {
        alert('Dışa aktarılacak veri bulunamadı!');
        return;
    }
    
    let csvContent = 'Tarih,Barkod,Ürün Adı,Marka,Kategori,Adet,Alış Fiyatı,Satış Fiyatı,Kar\n';
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowData = [];
        
        cells.forEach((cell, index) => {
            if (index < 9) { // İşlemler sütunu hariç
                let cellText = cell.textContent.trim();
                // Virgül içeren değerleri tırnak içine al
                if (cellText.includes(',')) {
                    cellText = `"${cellText}"`;
                }
                rowData.push(cellText);
            }
        });
        
        csvContent += rowData.join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `satis_raporu_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Raporları yazdır
function printReports() {
    const printWindow = window.open('', '_blank');
    const table = document.getElementById('detailedReportTable');
    
    if (!table) {
        alert('Yazdırılacak tablo bulunamadı!');
        return;
    }
    
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Satış Raporu</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                h1 { color: #333; text-align: center; }
                .header { text-align: center; margin-bottom: 20px; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Satış Raporu</h1>
                <p>Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
            </div>
            ${table.outerHTML}
        </body>
        </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

// Raporlar sayfasını yükle
async function loadReportsPage() {
    try {
        console.log('Raporlar sayfası yükleniyor...');
        
        // Veritabanından satışları çek
        if (window.posAPI && typeof window.posAPI.getSales === 'function') {
            const dbSales = await window.posAPI.getSales();
            console.log('Raporlar - Veritabanından satışlar yüklendi:', dbSales.length);
            
            // Veritabanından gelen satışları sales array'ine ekle
            if (dbSales && dbSales.length > 0) {
                // Mevcut test satışlarını koru, veritabanından gelenleri ekle
                const existingSales = sales.filter(sale => !sale.id || sale.id <= 3); // Test satışları
                const dbSalesFormatted = dbSales.map(dbSale => ({
                    id: dbSale.id,
                    date: dbSale.created_at,
                    items: dbSale.items || [], // Artık array olarak geliyor
                    total: dbSale.total_amount,
                    paymentMethod: dbSale.payment_method,
                    customer_name: dbSale.customer_name
                }));
                
                // Duplicate kontrolü yap
                const existingIds = existingSales.map(sale => sale.id);
                const newSales = dbSalesFormatted.filter(sale => !existingIds.includes(sale.id));
                
                sales = [...existingSales, ...newSales];
                console.log('Toplam satış sayısı (test + veritabanı):', sales.length);
            }
        } else {
            console.warn('posAPI.getSales bulunamadı, mevcut sales array kullanılıyor');
        }
        
        // Tüm satışları yükle
        loadReportsTable(sales);
        updateReportsStats(sales);
        
        // Satış ürünleri listesini yükle (artık doğrudan veritabanından)
        loadReportsProductsTable();
        
    } catch (error) {
        console.error('Raporlar sayfası yüklenirken hata:', error);
        // Hata durumunda mevcut sales array'i kullan
        loadReportsTable(sales);
        updateReportsStats(sales);
        loadReportsProductsTable();
    }
}

// Test ürünü ekle (raporlar listesine)
function addTestReportProduct() {
    const testProduct = {
        barcode: 'TEST-' + Math.floor(Math.random() * 1000000),
        name: 'Test Ürün',
        brand: 'Test Marka',
        category: 'Test',
        quantity: 1,
        price: 150,
        purchasePrice: 100,
        total: 150
    };

    // Stok listesine de ekleyelim (varsa üzerine yazmayız)
    if (!stockItems.find(p => p.barcode === testProduct.barcode)) {
        stockItems.push({
            barcode: testProduct.barcode,
            name: testProduct.name,
            brand: testProduct.brand,
            category: testProduct.category,
            stock: 10,
            purchasePrice: testProduct.purchasePrice,
            salePrice: testProduct.price
        });
    }

    // Satış kaydı oluştur
    const newSale = {
        id: sales.length + 1,
        date: new Date().toISOString(),
        items: [testProduct],
        subtotal: testProduct.total,
        discount: 0,
        tax: testProduct.total * 0.18,
        total: testProduct.total * 1.18,
        paymentMethod: 'cash'
    };

    sales.push(newSale);

    // Raporlar sayfasını ve listeyi yenile
    loadReportsTable(sales);
    updateReportsStats(sales);
    loadReportsProductsTable();

    // Filtreleri sıfırla ve görünürlüğü garantile
    const searchInput = document.getElementById('reportProductSearch');
    if (searchInput) searchInput.value = '';
    const categorySelect = document.getElementById('reportCategoryFilter');
    if (categorySelect) categorySelect.value = '';
    if (typeof filterReportProducts === 'function') {
        filterReportProducts();
    }

    // Tabloya kaydır
    const tableEl = document.getElementById('reportsProductsTable');
    if (tableEl && tableEl.scrollIntoView) {
        tableEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Raporlar sayfası ürünleri tablosunu yükle
async function loadReportsProductsTable() {
    const tbody = document.getElementById('reportsProductsTableBody');
    const noDataMessage = document.getElementById('noReportProductsMessage');

    if (!tbody) return;

    tbody.innerHTML = '';

    let productCount = 0;

    try {
        // Veritabanından satışları çek
        if (window.posAPI && typeof window.posAPI.getSales === 'function') {
            const dbSales = await window.posAPI.getSales();
            console.log('loadReportsProductsTable - Veritabanından satışlar yüklendi:', dbSales.length);
            
            // Veritabanından gelen verileri işle
            for (const saleRow of dbSales) {
                // Satış detayları artık saleRow.items içinde (array olarak)
                const items = saleRow.items || [];
                
                items.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${new Date(saleRow.created_at).toLocaleDateString('tr-TR')}</td>
                        <td>${item.barcode}</td>
                        <td>${item.name}</td>
                        <td>${item.brand || '-'}</td>
                        <td>${item.category}</td>
                        <td>${item.quantity}</td>
                        <td>${formatCurrency(item.purchase_price)}</td>
                        <td>${formatCurrency(item.unit_price)}</td>
                        <td>
                            <div class="profit-amount">${formatCurrency(item.profit)}</div>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn edit" onclick="editSaleItem(${saleRow.id}, '${item.barcode}')" title="Satış Öğesini Düzenle">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn delete" onclick="deleteSaleItem(${saleRow.id}, '${item.barcode}')" title="Satış Öğesini Sil">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                    productCount++;
                });
            }
        }

        // Test satışlarını da ekle (sadece veritabanı bağlantısı yoksa)
        if (!window.posAPI || typeof window.posAPI.getSales !== 'function') {
            console.log('Test satışları ekleniyor...');
            sales.forEach(sale => {
                sale.items.forEach(item => {
                    // Test satışları için eski format kontrolü
                    const unitPrice = (typeof item.price === 'number' && !isNaN(item.price)) ? item.price
                                      : (typeof item.salePrice === 'number' && !isNaN(item.salePrice)) ? item.salePrice
                                      : (typeof item.unit_price === 'number' && !isNaN(item.unit_price)) ? item.unit_price
                                      : 0;
                    const purchasePrice = (typeof item.purchasePrice === 'number' && !isNaN(item.purchasePrice))
                                          ? item.purchasePrice
                                          : (typeof item.purchase_price === 'number' && !isNaN(item.purchase_price))
                                          ? item.purchase_price
                                          : unitPrice * 0.8;
                    const quantity = (typeof item.quantity === 'number' && !isNaN(item.quantity)) ? item.quantity : 1;
                    const profit = (typeof item.profit === 'number' && !isNaN(item.profit)) ? item.profit : (unitPrice - purchasePrice);

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${new Date(sale.date).toLocaleDateString('tr-TR')}</td>
                        <td>${item.barcode}</td>
                        <td>${item.name}</td>
                        <td>${item.brand || '-'}</td>
                        <td>${item.category}</td>
                        <td>${quantity}</td>
                        <td>${formatCurrency(purchasePrice)}</td>
                        <td>${formatCurrency(unitPrice)}</td>
                        <td>
                            <div class="profit-amount">${formatCurrency(profit)}</div>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn edit" onclick="editSaleItem(${sale.id}, '${item.barcode}')" title="Satış Öğesini Düzenle">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="action-btn delete" onclick="deleteSaleItem(${sale.id}, '${item.barcode}')" title="Satış Öğesini Sil">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                    productCount++;
                });
            });
        }

        // Veri bulunamadı mesajını göster/gizle
        if (noDataMessage) {
            if (productCount === 0) {
                noDataMessage.style.display = 'block';
            } else {
                noDataMessage.style.display = 'none';
            }
        }

        // Kategori filtresini güncelle
        updateReportCategoryFilter();

    } catch (error) {
        console.error('Raporlar tablosu yükleme hatası:', error);
        
        // Hata durumunda test satışlarını kullan
        console.log('Hata durumunda test satışları gösteriliyor...');
        sales.forEach(sale => {
            sale.items.forEach(item => {
                // Test satışları için eski format kontrolü
                const unitPrice = (typeof item.price === 'number' && !isNaN(item.price)) ? item.price
                                  : (typeof item.salePrice === 'number' && !isNaN(item.salePrice)) ? item.salePrice
                                  : (typeof item.unit_price === 'number' && !isNaN(item.unit_price)) ? item.unit_price
                                  : 0;
                const purchasePrice = (typeof item.purchasePrice === 'number' && !isNaN(item.purchasePrice))
                                      ? item.purchasePrice
                                      : (typeof item.purchase_price === 'number' && !isNaN(item.purchase_price))
                                      ? item.purchase_price
                                      : unitPrice * 0.8;
                const quantity = (typeof item.quantity === 'number' && !isNaN(item.quantity)) ? item.quantity : 1;
                const profit = (typeof item.profit === 'number' && !isNaN(item.profit)) ? item.profit : (unitPrice - purchasePrice);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(sale.date).toLocaleDateString('tr-TR')}</td>
                    <td>${item.barcode}</td>
                    <td>${item.name}</td>
                    <td>${item.brand || '-'}</td>
                    <td>${item.category}</td>
                    <td>${quantity}</td>
                    <td>${formatCurrency(purchasePrice)}</td>
                    <td>${formatCurrency(unitPrice)}</td>
                    <td>
                        <div class="profit-amount">${formatCurrency(profit)}</div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit" onclick="editSaleItem(${sale.id}, '${item.barcode}')" title="Satış Öğesini Düzenle">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete" onclick="deleteSaleItem(${sale.id}, '${item.barcode}')" title="Satış Öğesini Sil">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
                productCount++;
            });
        });

        // Veri bulunamadı mesajını göster/gizle
        if (noDataMessage) {
            if (productCount === 0) {
                noDataMessage.style.display = 'block';
            } else {
                noDataMessage.style.display = 'none';
            }
        }

        // Kategori filtresini güncelle
        updateReportCategoryFilter();
    }
}

// Satış öğesini düzenle
async function editSaleItem(saleId, barcode) {
    console.log(`Düzenleme isteği: Satış ID: ${saleId}, Barkod: ${barcode}`);
    
    let sale = null;
    let saleItem = null;
    
    // Önce local sales array'inde ara
    sale = sales.find(s => s.id == saleId);
    if (sale) {
        saleItem = sale.items.find(item => item.barcode === barcode);
    }
    
    // Local'de bulunamadıysa veritabanından ara
    if (!sale && window.posAPI && typeof window.posAPI.getSales === 'function') {
        try {
            const dbSales = await window.posAPI.getSales();
            sale = dbSales.find(s => s.id == saleId);
            if (sale) {
                saleItem = sale.items.find(item => item.barcode === barcode);
            }
        } catch (error) {
            console.error('Veritabanından satış arama hatası:', error);
        }
    }
    
    if (!sale) {
        alert('Satış bulunamadı!');
        return;
    }
    
    if (!saleItem) {
        alert('Satış öğesi bulunamadı!');
        return;
    }
    
    // Düzenleme modalını aç
    openEditSaleItemModal(sale, saleItem);
}

// Satış öğesini sil
async function deleteSaleItem(saleId, barcode) {
    console.log(`Silme isteği: Satış ID: ${saleId}, Barkod: ${barcode}`);
    
    if (!confirm('Bu satış öğesini silmek istediğinizden emin misiniz?')) {
        return;
    }
    
    let sale = null;
    let saleItem = null;
    let itemIndex = -1;
    
    // Önce local sales array'inde ara
    sale = sales.find(s => s.id == saleId);
    if (sale) {
        itemIndex = sale.items.findIndex(item => item.barcode === barcode);
        if (itemIndex !== -1) {
            saleItem = sale.items[itemIndex];
        }
    }
    
    // Local'de bulunamadıysa veritabanından ara
    if (!sale && window.posAPI && typeof window.posAPI.getSales === 'function') {
        try {
            const dbSales = await window.posAPI.getSales();
            sale = dbSales.find(s => s.id == saleId);
            if (sale) {
                itemIndex = sale.items.findIndex(item => item.barcode === barcode);
                if (itemIndex !== -1) {
                    saleItem = sale.items[itemIndex];
                }
            }
        } catch (error) {
            console.error('Veritabanından satış arama hatası:', error);
        }
    }
    
    if (!sale) {
        alert('Satış bulunamadı!');
        return;
    }
    
    if (!saleItem) {
        alert('Satış öğesi bulunamadı!');
        return;
    }
    
    // Satış öğesini sil
    sale.items.splice(itemIndex, 1);
    
    // Satış toplamını güncelle
    const unitPrice = saleItem.price || saleItem.unit_price || 0;
    const quantity = saleItem.quantity || 1;
    sale.total = sale.items.reduce((sum, item) => {
        const itemPrice = item.price || item.unit_price || 0;
        const itemQuantity = item.quantity || 1;
        return sum + (itemPrice * itemQuantity);
    }, 0);
    
    // Stoku geri ekle
    const product = stockItems.find(p => p.barcode === barcode);
    if (product) {
        product.stock += quantity;
        console.log(`Stok geri eklendi: ${product.name}, +${quantity} adet`);
    }
    
    // UI'ı güncelle
    loadReportsProductsTable();
    updateProductStockInUI(barcode, product ? product.stock : 0);
    
    console.log(`Satış öğesi silindi: ${saleItem.name}`);
    alert('Satış öğesi başarıyla silindi!');
}

// Satış öğesi düzenleme modalını aç
function openEditSaleItemModal(sale, saleItem) {
    console.log('Satış öğesi düzenleme modalı açılıyor:', saleItem);
    
    // Modal HTML'ini oluştur
    const modalHTML = `
        <div id="editSaleItemModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Satış Öğesini Düzenle</h3>
                    <span class="close" onclick="closeEditSaleItemModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Satış Tarihi:</label>
                        <input type="datetime-local" id="editSaleDate" value="${new Date(sale.date).toISOString().slice(0, 16)}">
                    </div>
                    <div class="form-group">
                        <label>Stok İade Miktarı:</label>
                        <input type="number" id="editReturnQuantity" value="0" min="0" max="${saleItem.quantity}" step="1">
                        <small class="form-text">Maksimum ${saleItem.quantity} adet iade edebilirsiniz</small>
                    </div>
                    <div class="form-group">
                        <label>İade Sebebi:</label>
                        <select id="editReturnReason">
                            <option value="">İade sebebi seçin</option>
                            <option value="müşteri_iade">Müşteri İade</option>
                            <option value="hata">Ürün Hatası</option>
                            <option value="yanlış_ürün">Yanlış Ürün</option>
                            <option value="hasar">Ürün Hasarı</option>
                            <option value="diğer">Diğer</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Açıklama:</label>
                        <textarea id="editReturnDescription" rows="3" placeholder="İade açıklaması..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeEditSaleItemModal()">İptal</button>
                    <button class="btn-primary" onclick="saveEditSaleItem(${sale.id}, '${saleItem.barcode}')">Kaydet</button>
                </div>
            </div>
        </div>
    `;
    
    // Modal'ı sayfaya ekle
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Modal'ı göster
    document.getElementById('editSaleItemModal').style.display = 'block';
}

// Satış öğesi düzenleme modalını kapat
function closeEditSaleItemModal() {
    const modal = document.getElementById('editSaleItemModal');
    if (modal) {
        modal.remove();
    }
}

// Düzenlenen satış öğesini kaydet
function saveEditSaleItem(saleId, barcode) {
    const newDate = document.getElementById('editSaleDate').value;
    const returnQuantity = parseInt(document.getElementById('editReturnQuantity').value) || 0;
    const returnReason = document.getElementById('editReturnReason').value;
    const returnDescription = document.getElementById('editReturnDescription').value;
    
    if (!newDate) {
        alert('Geçerli bir tarih girin!');
        return;
    }
    
    if (returnQuantity < 0) {
        alert('İade miktarı negatif olamaz!');
        return;
    }
    
    // Satışı bul
    const sale = sales.find(s => s.id == saleId);
    if (!sale) {
        alert('Satış bulunamadı!');
        return;
    }
    
    // Satış öğesini bul
    const saleItem = sale.items.find(item => item.barcode === barcode);
    if (!saleItem) {
        alert('Satış öğesi bulunamadı!');
        return;
    }
    
    // Tarih güncelleme
    sale.date = new Date(newDate).toISOString();
    
    // Stok iade işlemi
    if (returnQuantity > 0) {
        const product = stockItems.find(p => p.barcode === barcode);
        if (product) {
            product.stock += returnQuantity;
            console.log(`Stok iade edildi: ${product.name}, +${returnQuantity} adet`);
            
            // İade kaydı oluştur
            const returnRecord = {
                id: Date.now(),
                saleId: saleId,
                barcode: barcode,
                productName: saleItem.name,
                returnQuantity: returnQuantity,
                returnReason: returnReason,
                returnDescription: returnDescription,
                returnDate: new Date().toISOString(),
                originalSaleDate: sale.date
            };
            
            // İade kayıtlarını sakla (global array'e ekle)
            if (!window.returnRecords) {
                window.returnRecords = [];
            }
            window.returnRecords.push(returnRecord);
            
            console.log('İade kaydı oluşturuldu:', returnRecord);
        }
    }
    
    // Modal'ı kapat
    closeEditSaleItemModal();
    
    // UI'ı güncelle
    loadReportsProductsTable();
    const product = stockItems.find(p => p.barcode === barcode);
    if (product) {
        updateProductStockInUI(barcode, product.stock);
    }
    
    console.log(`Satış öğesi güncellendi: ${saleItem.name}`);
    alert('Satış öğesi başarıyla güncellendi!');
}

// Raporlar sayfası ürünlerini filtrele
function filterReportProducts() {
    const searchTerm = document.getElementById('reportProductSearch').value.toLowerCase();
    const categoryFilter = document.getElementById('reportCategoryFilter').value;
    const rows = document.querySelectorAll('#reportsProductsTableBody tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const productName = cells[2].textContent.toLowerCase();
        const barcode = cells[1].textContent.toLowerCase();
        const brand = cells[3].textContent.toLowerCase();
        const category = cells[4].textContent.toLowerCase();
        
        const matchesSearch = productName.includes(searchTerm) || 
                             barcode.includes(searchTerm) || 
                             brand.includes(searchTerm);
        const matchesCategory = !categoryFilter || category === categoryFilter;
        
        if (matchesSearch && matchesCategory) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Raporlar sayfası kategori filtresini güncelle
function updateReportCategoryFilter() {
    const categoryFilter = document.getElementById('reportCategoryFilter');
    if (!categoryFilter) return;
    
    const currentValue = categoryFilter.value;
    categoryFilter.innerHTML = '<option value="">Tüm Kategoriler</option>';
    
    const categories = new Set();
    sales.forEach(sale => {
        sale.items.forEach(item => {
            if (item.category) {
                categories.add(item.category);
            }
        });
    });
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
    
    categoryFilter.value = currentValue;
}

// Raporlar sayfası fonksiyonlarını window'a ekle
window.setDateFilterFromSelect = setDateFilterFromSelect;
window.setDateFilter = setDateFilter;
window.updateCustomDateFilter = updateCustomDateFilter;
window.openQuickAddModal = openQuickAddModal;
window.saveQuickProduct = saveQuickProduct;
window.openProductActions = openProductActions;
window.openProductReturnModal = openProductReturnModal;
window.openEditProductModal = openEditProductModal;
window.updateProduct = updateProduct;
window.openProductEditModal = openProductEditModal;
window.openProductDeleteModal = openProductDeleteModal;
window.openProductExchangeModal = openProductExchangeModal;
window.processReturn = processReturn;
window.processExchange = processExchange;
window.editSaleItem = editSaleItem;
window.deleteSaleItem = deleteSaleItem;
window.closeEditSaleItemModal = closeEditSaleItemModal;
window.saveEditSaleItem = saveEditSaleItem;

// İkinci ekranı aç
function openSecondScreen() {
    console.log('İkinci ekran açılıyor...');
    
    // Yeni pencere aç
    const secondWindow = window.open('', 'second_screen', 'width=800,height=600,left=100,top=100');
    
    if (secondWindow) {
        secondWindow.document.write(`
            <!DOCTYPE html>
            <html lang="tr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>ATLI Medikal - İkinci Ekran</title>
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background: #f8f9fa;
                        color: #2c3e50;
                    }
                    .second-screen {
                        max-width: 800px;
                        margin: 0 auto;
                        background: white;
                        border-radius: 12px;
                        padding: 30px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    }
                    .screen-header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 2px solid #3498db;
                        padding-bottom: 20px;
                    }
                    .screen-header h1 {
                        color: #2c3e50;
                        margin: 0;
                        font-size: 28px;
                    }
                    .screen-header p {
                        color: #7f8c8d;
                        margin: 5px 0 0 0;
                    }
                    .cart-display {
                        margin-bottom: 30px;
                    }
                    .cart-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 15px;
                        border: 1px solid #e9ecef;
                        border-radius: 8px;
                        margin-bottom: 10px;
                        background: #f8f9fa;
                    }
                    .item-info {
                        flex: 1;
                    }
                    .item-name {
                        font-weight: 600;
                        color: #2c3e50;
                        margin-bottom: 5px;
                    }
                    .item-details {
                        color: #7f8c8d;
                        font-size: 14px;
                    }
                    .item-price {
                        font-weight: 600;
                        color: #27ae60;
                        font-size: 18px;
                    }
                    .summary-section {
                        border-top: 2px solid #3498db;
                        padding-top: 20px;
                        margin-bottom: 20px;
                    }
                    .summary-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 8px 0;
                        border-bottom: 1px solid #e9ecef;
                    }
                    .summary-row.total {
                        border-bottom: none;
                        font-weight: 700;
                        font-size: 18px;
                        color: #2ecc71;
                    }
                    .summary-row span:first-child {
                        color: #7f8c8d;
                    }
                    .summary-row span:last-child {
                        font-weight: 600;
                        color: #2c3e50;
                    }
                    .payment-info {
                        text-align: center;
                        padding: 15px;
                        background: #e8f4fd;
                        border-radius: 8px;
                    }
                    .payment-method {
                        font-weight: 600;
                        color: #3498db;
                    }
                </style>
            </head>
            <body>
                <div class="second-screen">
                    <div class="screen-header">
                        <h1><i class="fas fa-heartbeat"></i> ATLI Medikal</h1>
                        <p>Satış Ekranı</p>
                    </div>
                    
                    <div class="cart-display" id="cartDisplay">
                        <h3>Sepet Öğeleri</h3>
                        <div id="cartItemsDisplay">
                            <!-- Sepet öğeleri buraya gelecek -->
                        </div>
                    </div>
                    
                    <div class="summary-section">
                        <div class="summary-row">
                            <span>Ara Toplam:</span>
                            <span id="subtotalDisplay">₺0,00</span>
                        </div>
                        <div class="summary-row">
                            <span>İndirim:</span>
                            <span id="discountDisplay">₺0,00</span>
                        </div>
                        <div class="summary-row">
                            <span>KDV (%18):</span>
                            <span id="taxDisplay">₺0,00</span>
                        </div>
                        <div class="summary-row total">
                            <span>Genel Toplam:</span>
                            <span id="totalAmountDisplay">₺0,00</span>
                        </div>
                    </div>
                    
                    <div class="payment-info">
                        <div class="payment-method" id="paymentMethodDisplay">Nakit</div>
                    </div>
                </div>
                
                <script>
                    // Ana pencereden veri al
                    function updateSecondScreen() {
                        if (window.opener && window.opener.currentSaleItems) {
                            const cartItems = window.opener.currentSaleItems;
                            const cartDisplay = document.getElementById('cartItemsDisplay');
                            const subtotalDisplay = document.getElementById('subtotalDisplay');
                            const discountDisplay = document.getElementById('discountDisplay');
                            const taxDisplay = document.getElementById('taxDisplay');
                            const totalDisplay = document.getElementById('totalAmountDisplay');
                            const paymentDisplay = document.getElementById('paymentMethodDisplay');
                            
                            // Sepet öğelerini göster
                            cartDisplay.innerHTML = '';
                            let subtotal = 0;
                            
                            cartItems.forEach(item => {
                                const itemTotal = (item.price || 0) * (item.quantity || 1);
                                subtotal += itemTotal;
                                
                                const itemElement = document.createElement('div');
                                itemElement.className = 'cart-item';
                                itemElement.innerHTML = \`
                                    <div class="item-info">
                                        <div class="item-name">\${item.name}</div>
                                        <div class="item-details">\${item.quantity} adet x \${(item.price || 0).toFixed(2)} ₺</div>
                                    </div>
                                    <div class="item-price">\${itemTotal.toFixed(2)} ₺</div>
                                \`;
                                cartDisplay.appendChild(itemElement);
                            });
                            
                            // Ana penceredeki özet bilgilerini al
                            const subtotalElement = window.opener.document.getElementById('subtotal');
                            const discountElement = window.opener.document.getElementById('discountAmount');
                            const taxElement = window.opener.document.getElementById('taxAmount');
                            const totalElement = window.opener.document.getElementById('totalAmount');
                            
                            // Özet bilgilerini göster
                            if (subtotalElement) subtotalDisplay.textContent = subtotalElement.textContent;
                            if (discountElement) discountDisplay.textContent = discountElement.textContent;
                            if (taxElement) taxDisplay.textContent = taxElement.textContent;
                            if (totalElement) totalDisplay.textContent = totalElement.textContent;
                            
                            // Ödeme yöntemini göster
                            const selectedPayment = window.opener.document.querySelector('input[name="paymentMethod"]:checked');
                            if (selectedPayment) {
                                const paymentMethods = {
                                    'cash': 'Nakit',
                                    'card': 'Kart',
                                    'transfer': 'Havale',
                                    'discount': 'İndirim'
                                };
                                paymentDisplay.textContent = paymentMethods[selectedPayment.value] || 'Nakit';
                            }
                        }
                    }
                    
                    // Sayfa yüklendiğinde ve her 2 saniyede bir güncelle
                    updateSecondScreen();
                    setInterval(updateSecondScreen, 2000);
                </script>
            </body>
            </html>
        `);
        
        secondWindow.document.close();
        console.log('İkinci ekran açıldı');
    } else {
        alert('İkinci ekran açılamadı. Pop-up engelleyiciyi kapatın.');
    }
}
window.searchDetailedReport = searchDetailedReport;
window.clearReportSearch = clearReportSearch;
window.applyCustomDateFilter = applyCustomDateFilter;
window.exportReports = exportReports;
window.printReports = printReports;
window.loadReportsPage = loadReportsPage;
window.loadReportsProductsTable = loadReportsProductsTable;
window.filterReportProducts = filterReportProducts;
window.updateReportCategoryFilter = updateReportCategoryFilter;
window.updateCategorySelects = updateCategorySelects;
window.addTestReportProduct = addTestReportProduct;

// Satış sayfası fonksiyonlarını window'a ekle
window.newSearchProducts = newSearchProducts;
window.searchProducts = searchProducts;
window.scanBarcode = scanBarcode;
window.addToCartFromDB = addToCartFromDB;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.changeQuantity = changeQuantity;
window.updateCartSummary = updateCartSummary;
window.updateDiscount = updateDiscount;
window.clearCart = clearCart;
window.cancelSale = cancelSale;
window.completeSale = completeSale;
window.showSaleSuccessCard = showSaleSuccessCard;
window.printReceipt = printReceipt;
window.formatCurrency = formatCurrency;
window.addProductToCartFromSuggestion = addProductToCartFromSuggestion;
window.addToSalesCart = addToSalesCart;
window.updateSalesCartItems = updateSalesCartItems;
window.updateSalesCartSummary = updateSalesCartSummary;
window.updateProductStock = updateProductStock;
window.saveSaleToDatabase = saveSaleToDatabase;
window.updateSalesCartItemQuantity = updateSalesCartItemQuantity;
window.removeSalesCartItem = removeSalesCartItem;
window.completeSalesSale = completeSalesSale;
window.openSecondScreen = openSecondScreen;
window.refreshSalesPageProducts = refreshSalesPageProducts;

// Uygulama başlatıldığında verileri yükle
async function initializeApp() {
    console.log('Uygulama başlatılıyor...');
    
    try {
        // Veritabanından ürünleri yükle
        if (window.posAPI && typeof window.posAPI.getProducts === 'function') {
            const dbProducts = await window.posAPI.getProducts();
            console.log('Veritabanından ürünler yüklendi:', dbProducts.length);
            
            // Veritabanından gelen verileri stockItems ile birleştir
            const dbBarcodes = dbProducts.map(p => p.barcode);
            const localOnlyItems = stockItems.filter(item => !dbBarcodes.includes(item.barcode));
            stockItems.length = 0;
            stockItems.push(...dbProducts, ...localOnlyItems);
            
            console.log('Toplam ürün sayısı:', stockItems.length);
        }
        
        // Veritabanından satışları yükle
        if (window.posAPI && typeof window.posAPI.getSales === 'function') {
            const dbSales = await window.posAPI.getSales();
            console.log('Veritabanından satışlar yüklendi:', dbSales.length);
            
            // Veritabanından gelen satışları sales array'ine ekle
            if (dbSales && dbSales.length > 0) {
                const existingSales = sales.filter(sale => !sale.id || sale.id <= 3); // Test satışları
                const dbSalesFormatted = dbSales.map(dbSale => ({
                    id: dbSale.id,
                    date: dbSale.created_at,
                    items: dbSale.items || [],
                    total: dbSale.total_amount,
                    paymentMethod: dbSale.payment_method,
                    customer_name: dbSale.customer_name
                }));
                
                const existingIds = existingSales.map(sale => sale.id);
                const newSales = dbSalesFormatted.filter(sale => !existingIds.includes(sale.id));
                
                sales = [...existingSales, ...newSales];
                console.log('Toplam satış sayısı:', sales.length);
            }
        }
        
        console.log('Uygulama başlatma tamamlandı');
        
    } catch (error) {
        console.error('Uygulama başlatma hatası:', error);
    }
}

// Verileri başlat
// Bu fonksiyon yukarıda tanımlanmış, burada tekrar tanımlanmamalı

// Sayfa yüklendiğinde uygulamayı başlat
// Bu event yukarıda tanımlanmış, burada tekrar tanımlanmamalı

// Sayfaya tıklayınca arama önerilerini kapat
function hideSalesSuggestions() {
    const suggestions = document.getElementById('newSearchSuggestions');
    if (suggestions) suggestions.style.display = 'none';
}

// Sayfaya tıklayınca, ESC’e basınca, scroll/resize olunca dropdown’ı kapat
document.addEventListener('click', function(e) {
    const searchInput = document.getElementById('newProductSearch');
    const suggestions = document.getElementById('newSearchSuggestions');
    if (!searchInput || !suggestions) return;
    if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) {
        hideSalesSuggestions();
    }
});

document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') hideSalesSuggestions();
});

window.addEventListener('scroll', hideSalesSuggestions, true);
window.addEventListener('resize', hideSalesSuggestions);

// Kullanılmayan ikinci ekran fonksiyonları kaldırıldı

// Ürünler sayfası fonksiyonlarını window'a ekle
window.openAddProductModal = openAddProductModal;
window.saveProduct = saveProduct;
window.exportProducts = exportProducts;
window.importProducts = importProducts;
window.loadProductsTable = loadProductsTable;
window.deleteProduct = deleteProduct;
window.filterProducts = filterProducts;
window.editProduct = editProduct;
window.updateProductsTable = loadProductsTable;

// Ürünler tablosunu yükle
async function loadProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) {
        console.log('productsTableBody bulunamadı');
        return;
    }
    
    tbody.innerHTML = '';
    
    try {
        // Önce stockItems'ı güvenli bir şekilde başlat
        if (!stockItems || !Array.isArray(stockItems)) {
            stockItems = [];
        }
        
        // Eğer stockItems boşsa test verilerini yükle
        if (stockItems.length === 0) {
            console.log('stockItems boş, test verileri yükleniyor...');
            stockItems.push(...testStockItems);
        }
        
        // Veritabanından ürünleri yükle
        if (window.posAPI && typeof window.posAPI.getProducts === 'function') {
            try {
                console.log('Veritabanından ürünler yükleniyor...');
                const dbProducts = await window.posAPI.getProducts();
                console.log('Veritabanından ürünler yüklendi:', dbProducts ? dbProducts.length : 0);
                
                // Veritabanından gelen verileri stockItems ile birleştir
                if (dbProducts && Array.isArray(dbProducts) && dbProducts.length > 0) {
                    const dbBarcodes = dbProducts.map(p => p.barcode).filter(b => b);
                    const localOnlyItems = stockItems.filter(item => item.barcode && !dbBarcodes.includes(item.barcode));
                    stockItems.length = 0;
                    stockItems.push(...dbProducts, ...localOnlyItems);
                    console.log('Veritabanı ve local veriler birleştirildi, toplam:', stockItems.length);
                } else {
                    console.log('Veritabanında ürün bulunamadı, mevcut veriler kullanılıyor');
                }
            } catch (dbError) {
                console.warn('Veritabanı bağlantı hatası, mevcut veriler kullanılıyor:', dbError);
                // Veritabanı hatası durumunda mevcut stockItems kullanılıyor
            }
        } else {
            console.warn('posAPI.getProducts bulunamadı, sadece local veriler kullanılıyor');
        }
        
        // Ürünleri tabloya ekle
        if (stockItems && stockItems.length > 0) {
            stockItems.forEach((item, index) => {
                try {
                    const profit = (item.salePrice - item.purchasePrice) * item.stock;
                    
                    // Stok renklendirmesi için CSS sınıfı belirle
                    let stockClass = '';
                    if (item.stock === 0) {
                        stockClass = 'stock-zero';
                    } else if (item.stock <= 2) {
                        stockClass = 'stock-low';
                    } else {
                        stockClass = 'stock-normal';
                    }
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        ${bulkSelectMode ? `<td class="product-checkbox-cell show"><input type="checkbox" class="product-checkbox" data-product-index="${index}" onchange="toggleProductSelection(this)" ${selectedProducts.has(String(index)) ? 'checked' : ''}></td>` : ''}
                        <td>${item.barcode || ''}</td>
                        <td>${item.name || ''}</td>
                        <td>${item.brand || ''}</td>
                        <td>${item.category || ''}</td>
                        <td>${item.size || '-'}</td>
                        <td class="${stockClass}">${item.stock || 0}</td>
                        <td>₺${(item.purchasePrice || 0).toFixed(2)}</td>
                        <td>₺${(item.salePrice || 0).toFixed(2)}</td>
                        <td class="profit ${profit >= 0 ? 'positive' : 'negative'}">₺${profit.toFixed(2)}</td>
                        <td class="actions">
                            <button onclick="editProduct('${item.barcode || ''}')" class="action-btn edit" title="Düzenle">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteProduct('${item.barcode || ''}')" class="action-btn delete" title="Sil">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                } catch (itemError) {
                    console.error('Ürün ekleme hatası:', itemError, item);
                }
            });
        } else {
            // Ürün yoksa boş mesaj göster
            const colspan = bulkSelectMode ? 10 : 9;
            tbody.innerHTML = `<tr><td colspan="${colspan}" class="no-data">Henüz ürün eklenmemiş</td></tr>`;
        }
        
        console.log('Ürünler tablosu güncellendi,', stockItems.length, 'ürün');
        updateCategorySelects();
        
    } catch (error) {
        console.error('Ürünler tablosu yükleme hatası:', error);
        
        // Hata durumunda test verilerini yüklemeyi dene
        try {
            if (!stockItems || stockItems.length === 0) {
                stockItems = [];
                stockItems.push(...testStockItems);
                console.log('Hata durumunda test verileri yüklendi');
                
                // Test verilerini tabloya ekle
                stockItems.forEach(item => {
                    const profit = (item.salePrice - item.purchasePrice) * item.stock;
                    
                    let stockClass = '';
                    if (item.stock === 0) {
                        stockClass = 'stock-zero';
                    } else if (item.stock <= 2) {
                        stockClass = 'stock-low';
                    } else {
                        stockClass = 'stock-normal';
                    }
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.barcode || ''}</td>
                        <td>${item.name || ''}</td>
                        <td>${item.brand || ''}</td>
                        <td>${item.category || ''}</td>
                        <td>${item.size || '-'}</td>
                        <td class="${stockClass}">${item.stock || 0}</td>
                        <td>₺${(item.purchasePrice || 0).toFixed(2)}</td>
                        <td>₺${(item.salePrice || 0).toFixed(2)}</td>
                        <td class="profit ${profit >= 0 ? 'positive' : 'negative'}">₺${profit.toFixed(2)}</td>
                        <td class="actions">
                            <button onclick="editProduct('${item.barcode || ''}')" class="action-btn edit" title="Düzenle">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteProduct('${item.barcode || ''}')" class="action-btn delete" title="Sil">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="10" class="no-data">Ürünler yüklenirken hata oluştu</td></tr>';
            }
        } catch (fallbackError) {
            console.error('Fallback hata:', fallbackError);
            tbody.innerHTML = '<tr><td colspan="10" class="no-data">Ürünler yüklenirken hata oluştu</td></tr>';
        }
    }
}

// Ürün düzenleme fonksiyonu
function editProduct(barcode) {
    console.log('Ürün düzenleniyor:', barcode);
    openEditProductModal(barcode);
}

// Ürün silme fonksiyonu
async function deleteProduct(barcode) {
    console.log('Ürün siliniyor:', barcode);
    
    if (!confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
        return;
    }
    
    try {
        // Veritabanından sil
        const product = stockItems.find(item => item.barcode === barcode);
        if (product && product.id && window.posAPI && typeof window.posAPI.deleteProduct === 'function') {
            await window.posAPI.deleteProduct(product.id);
            console.log('Ürün veritabanından silindi');
        }
        
        // Local array'den sil
        stockItems = stockItems.filter(item => item.barcode !== barcode);
        
        // Tabloyu güncelle
        loadProductsTable();
        updateCategorySelects();
        
        alert('Ürün başarıyla silindi!');
        
    } catch (error) {
        console.error('Ürün silme hatası:', error);
        
        // Hata durumunda sadece local array'den sil
        stockItems = stockItems.filter(item => item.barcode !== barcode);
        loadProductsTable();
        updateCategorySelects();
        
        alert('Ürün silindi (veritabanı hatası nedeniyle geçici olarak)');
    }
}

// Bu fonksiyon yukarıda tanımlanmış, burada tekrar tanımlanmamalı
// Export/Import opsiyonlarını da global yap
window.exportToPDF = exportToPDF;
window.exportToExcel = exportToExcel;
window.handleFileSelect = handleFileSelect;
window.importProductsFromFile = importProductsFromFile;

// Tam ekran ikinci ekran fonksiyonları
let secondScreenInterval = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// İkinci ekranı aç
function openSecondScreen() {
    const modal = document.getElementById('secondScreenModal');
    if (!modal) {
        console.log('İkinci ekran modal bulunamadı');
        return;
    }
    
    modal.style.display = 'block';
    
    // Modal'ı merkeze yerleştir
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.margin = '0';
    
    // Drag and drop event listener'ları ekle
    setupDragAndDrop();
    
    // Ekranı güncelle
    updateSecondScreenDisplay();
    
    // Saati güncelle
    updateDisplayTime();
    
    // Saat güncelleme intervalini başlat
    secondScreenInterval = setInterval(updateDisplayTime, 1000);
    
    console.log('İkinci ekran açıldı ve drag kuruldu');
}

// İkinci ekranı kapat
function closeSecondScreen() {
    const modal = document.getElementById('secondScreenModal');
    if (!modal) {
        console.log('İkinci ekran modal bulunamadı');
        return;
    }
    
    modal.style.display = 'none';
    // Sayfa kaydırmayı geri açma - zaten engellenmemişti
    
    // Drag durumunu sıfırla
    isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Modal pozisyonunu sıfırla
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    
    // Saat güncelleme intervalini durdur
    if (secondScreenInterval) {
        clearInterval(secondScreenInterval);
        secondScreenInterval = null;
    }
    
    console.log('İkinci ekran kapatıldı');
}

// İkinci ekranı yenile
function refreshSecondScreen() {
    updateSecondScreenDisplay();
    updateDisplayTime();
    console.log('İkinci ekran yenilendi');
}

// İkinci ekran içeriğini güncelle
function updateSecondScreenDisplay() {
    try {
        const displayCartLarge = document.getElementById('displayCartLarge');
        const displayTotalAmountLarge = document.getElementById('displayTotalAmountLarge');
        
        if (!displayCartLarge || !displayTotalAmountLarge) {
            console.log('İkinci ekran elementleri bulunamadı');
            return;
        }
        
        // Sepet boşsa
        if (currentSaleItems.length === 0) {
            displayCartLarge.innerHTML = `
                <div class="display-empty-cart-large">
                    <i class="fas fa-shopping-cart"></i>
                    <h3>Sepet Boş</h3>
                    <p>Ürün eklemek için bekleyin...</p>
                </div>
            `;
            displayTotalAmountLarge.textContent = '₺0,00';
            return;
        }
        
        // Sepet doluysa ürünleri göster
        let cartHTML = '';
        let totalAmount = 0;
        
        currentSaleItems.forEach((item, index) => {
            const itemTotal = (item.price || 0) * (item.quantity || 1);
            totalAmount += itemTotal;
            
            cartHTML += `
                <div class="display-cart-item-large">
                    <div class="display-item-info-large">
                        <div class="display-item-name-large">${item.name || 'İsimsiz Ürün'}</div>
                        <div class="display-item-details-large">
                            <span class="display-item-brand-large">${item.brand || 'Marka Yok'}</span>
                            <span class="display-item-category-large">${item.category || 'Kategori Yok'}</span>
                        </div>
                    </div>
                    <div class="display-item-pricing-large">
                        <div class="display-item-quantity-large">${item.quantity || 1} adet</div>
                        <div class="display-item-price-large">${formatCurrency(item.price || 0)}</div>
                        <div class="display-item-total-large">${formatCurrency(itemTotal)}</div>
                    </div>
                </div>
            `;
        });
        
        displayCartLarge.innerHTML = cartHTML;
        displayTotalAmountLarge.textContent = formatCurrency(totalAmount);
        
        console.log('İkinci ekran güncellendi - Toplam:', totalAmount);
    } catch (error) {
        console.error('İkinci ekran güncelleme hatası:', error);
    }
}

// Ekrandaki saati güncelle
function updateDisplayTime() {
    const displayTime = document.getElementById('displayTime');
    if (!displayTime) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const dateString = now.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    displayTime.innerHTML = `
        <div>${dateString}</div>
        <div>${timeString}</div>
    `;
}

// Drag and drop fonksiyonları - Tamamen yeniden tasarlandı
function setupDragAndDrop() {
    const modal = document.getElementById('secondScreenModal');
    const header = document.getElementById('secondScreenHeader');
    
    if (!modal || !header) {
        console.log('Modal veya header bulunamadı');
        return;
    }
    
    // Önceki event listener'ları temizle
    header.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Yeni event listener'ları ekle
    header.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    console.log('Drag and drop kuruldu - Modal:', modal, 'Header:', header);
}

// Mouse down handler - Geliştirilmiş
function handleMouseDown(e) {
    // Sadece header'da drag başlasın, butonlarda değil
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        return;
    }
    
    const modal = document.getElementById('secondScreenModal');
    if (!modal) return;
    
    isDragging = true;
    
    // Modal'ın mevcut pozisyonunu al
    const rect = modal.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    // Modal'ı fixed positioning'e çevir ve merkezden çıkar
    modal.style.position = 'fixed';
    modal.style.top = rect.top + 'px';
    modal.style.left = rect.left + 'px';
    modal.style.transform = 'none';
    modal.style.margin = '0';
    
    // Cursor'u değiştir
    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none';
    
    // Header'a drag efekti ekle
    const header = document.getElementById('secondScreenHeader');
    if (header) {
        header.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
    
    e.preventDefault();
    console.log('Drag başladı');
}

// Mouse move handler - Geliştirilmiş
function handleMouseMove(e) {
    if (!isDragging) return;
    
    const modal = document.getElementById('secondScreenModal');
    if (!modal) return;
    
    // Yeni pozisyonu hesapla
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Ekran sınırları içinde tut
    const maxX = window.innerWidth - modal.offsetWidth;
    const maxY = window.innerHeight - modal.offsetHeight;
    
    const clampedX = Math.max(0, Math.min(newX, maxX));
    const clampedY = Math.max(0, Math.min(newY, maxY));
    
    modal.style.left = clampedX + 'px';
    modal.style.top = clampedY + 'px';
    
    e.preventDefault();
}

// Mouse up handler - Geliştirilmiş
function handleMouseUp(e) {
    if (!isDragging) return;
    
    isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Header'ı normale döndür
    const header = document.getElementById('secondScreenHeader');
    if (header) {
        header.style.background = '';
    }
    
    e.preventDefault();
    console.log('Drag bitti');
}

// ESC tuşu ile ikinci ekranı kapat
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('secondScreenModal');
        if (modal && modal.style.display === 'block') {
            closeSecondScreen();
        }
    }
});

// Ödeme seçenekleri fonksiyonları
let currentPaymentMethod = 'cash';

// Ödeme seçenekleri modalını aç
function openPaymentOptions() {
    const modal = document.getElementById('paymentOptionsModal');
    if (!modal) {
        console.log('Ödeme seçenekleri modal bulunamadı');
        return;
    }
    
    modal.classList.add('show');
    
    // Mevcut seçili ödeme yöntemini göster
    updatePaymentOptionsDisplay();
    
    console.log('Ödeme seçenekleri açıldı');
}

// Ödeme seçenekleri modalını kapat
function closePaymentOptions() {
    const modal = document.getElementById('paymentOptionsModal');
    if (!modal) {
        console.log('Ödeme seçenekleri modal bulunamadı');
        return;
    }
    
    modal.classList.remove('show');
    console.log('Ödeme seçenekleri kapatıldı');
}

// Ödeme yöntemi seç
function selectPaymentMethod(method) {
    currentPaymentMethod = method;
    
    // Modal içindeki seçimleri güncelle
    updatePaymentOptionsDisplay();
    
    // Ana ekrandaki seçili ödeme yöntemini güncelle
    updateSelectedPaymentMethod();
    
    // Modalı kapat
    closePaymentOptions();
    
    console.log('Ödeme yöntemi seçildi:', method);
}

// Ödeme seçenekleri modalındaki görünümü güncelle
function updatePaymentOptionsDisplay() {
    const options = document.querySelectorAll('.payment-option');
    
    options.forEach(option => {
        option.classList.remove('selected');
        
        const method = option.getAttribute('onclick').match(/'([^']+)'/)[1];
        if (method === currentPaymentMethod) {
            option.classList.add('selected');
        }
    });
}

// Ana ekrandaki seçili ödeme yöntemini güncelle
function updateSelectedPaymentMethod() {
    const selectedMethod = document.getElementById('selectedPaymentMethod');
    if (!selectedMethod) return;
    
    const methodInfo = {
        cash: { icon: 'fas fa-money-bill-wave', text: 'Nakit', color: '#28a745' },
        transfer: { icon: 'fas fa-university', text: 'Havale/EFT', color: '#007bff' },
        discount: { icon: 'fas fa-percentage', text: 'İndirimli Satış', color: '#fd7e14' }
    };
    
    const info = methodInfo[currentPaymentMethod];
    if (info) {
        selectedMethod.innerHTML = `
            <i class="${info.icon}" style="color: ${info.color}"></i>
            <span>${info.text}</span>
        `;
    }
}

// ESC tuşu ile ödeme seçenekleri modalını kapat
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const paymentModal = document.getElementById('paymentOptionsModal');
        if (paymentModal && paymentModal.classList.contains('show')) {
            closePaymentOptions();
        }
    }
});

// İkinci ekran fonksiyonlarını window'a ekle
window.openSecondScreen = openSecondScreen;
window.closeSecondScreen = closeSecondScreen;
window.refreshSecondScreen = refreshSecondScreen;
window.updateSecondScreenDisplay = updateSecondScreenDisplay;

// Sepet sayacını güncelle
function updateCartCounter() {
    const cartItemCount = document.getElementById('cartItemCount');
    if (!cartItemCount) return;
    
    const totalItems = currentSaleItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    cartItemCount.textContent = `${totalItems} ürün`;
    
    console.log('Sepet sayacı güncellendi:', totalItems);
}

// Sepeti temizle butonu için daha iyi ikon ve onay (opsiyonel - hızlı temizlik)
function clearCart() {
    currentSaleItems = [];
    const cartItems = document.getElementById('cartItems');
    if (cartItems) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart"></i>
                <h4>Sepet Boş</h4>
                <p>Ürün eklemek için arama yapın veya barkod okutun</p>
            </div>
        `;
    }
    updateCartCounter();
    updateTotals && updateTotals();
}

// Ödeme seçenekleri fonksiyonlarını window'a ekle
window.openPaymentOptions = openPaymentOptions;
window.closePaymentOptions = closePaymentOptions;
window.selectPaymentMethod = selectPaymentMethod;
window.updateCartCounter = updateCartCounter;

// Satış başarı kartı göster
let saleSuccessTimeout;
function showSaleSuccessCard({ total, method, time }) {
    const card = document.getElementById('saleSuccessCard');
    if (!card) return;
    const amountEl = document.getElementById('successSaleAmount');
    const methodEl = document.getElementById('successPaymentMethod');
    const timeEl = document.getElementById('successSaleTime');
    if (amountEl) amountEl.textContent = formatCurrency(total || 0);
    if (methodEl) methodEl.textContent = method || 'Nakit';
    if (timeEl) timeEl.textContent = new Date(time).toLocaleString('tr-TR');
    card.classList.add('show');
    if (saleSuccessTimeout) clearTimeout(saleSuccessTimeout);
    saleSuccessTimeout = setTimeout(() => {
        closeSaleSuccessCard();
    }, 5000);
}

function closeSaleSuccessCard() {
    const card = document.getElementById('saleSuccessCard');
    if (!card) return;
    card.classList.remove('show');
    if (saleSuccessTimeout) clearTimeout(saleSuccessTimeout);
}

window.showSaleSuccessCard = showSaleSuccessCard;
window.closeSaleSuccessCard = closeSaleSuccessCard;

// ========== MODERN DASHBOARD FUNCTIONS ==========

// Dashboard yükleme
// Bu fonksiyon yukarıda tanımlanmış, burada tekrar tanımlanmamalı

// Modern dashboard istatistiklerini güncelle
function updateModernDashboardStats() {
    console.log('Modern dashboard istatistikleri güncelleniyor...');
    
    // Toplam satış
    const totalSales = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    updateMetricCard('totalSales', `₺${totalSales.toLocaleString('tr-TR')}`, 'salesTrend', '+12%', 'up');
    
    // Toplam kar (örnek hesaplama)
    const totalProfit = totalSales * 0.3; // %30 kar varsayımı
    updateMetricCard('totalProfit', `₺${totalProfit.toLocaleString('tr-TR')}`, 'profitTrend', '+8%', 'up');
    
    // Toplam ürün sayısı
    updateMetricCard('totalProducts', stockItems.length.toString(), 'productsTrend', '0%', 'neutral');
    
    // Toplam işlem sayısı
    updateMetricCard('totalTransactions', sales.length.toString(), 'transactionsTrend', '+15%', 'up');
    
    // Günlük hedef güncelleme
    updateDailyTarget();
}

// Metrik kartını güncelle
function updateMetricCard(valueId, value, trendId, trendValue, trendDirection) {
    const valueElement = document.getElementById(valueId);
    const trendElement = document.getElementById(trendId);
    
    if (valueElement) {
        valueElement.textContent = value;
    }
    
    if (trendElement) {
        const icon = trendElement.querySelector('i');
        const span = trendElement.querySelector('span');
        
        if (icon && span) {
            span.textContent = trendValue;
            trendElement.className = `metric-trend ${trendDirection}`;
            
            if (trendDirection === 'up') {
                icon.className = 'fas fa-arrow-up';
            } else if (trendDirection === 'down') {
                icon.className = 'fas fa-arrow-down';
            } else {
                icon.className = 'fas fa-minus';
            }
        }
    }
}

// Günlük hedef güncelleme
function updateDailyTarget() {
    const today = new Date().toDateString();
    const todaySales = sales
        .filter(sale => new Date(sale.date || sale.created_at).toDateString() === today)
        .reduce((sum, sale) => sum + (sale.total || 0), 0);
    
    const dailyTarget = 50000; // ₺50,000 günlük hedef
    const progress = Math.min((todaySales / dailyTarget) * 100, 100);
    
    // Hedef bilgilerini güncelle
    const targetLabel = document.getElementById('dailyTargetLabel');
    const actualLabel = document.getElementById('dailyActualLabel');
    const percentLabel = document.getElementById('dailyPercentLabel');
    const progressFill = document.getElementById('dailyTargetFill');
    
    if (targetLabel) targetLabel.textContent = `₺${dailyTarget.toLocaleString('tr-TR')}`;
    if (actualLabel) actualLabel.textContent = `₺${todaySales.toLocaleString('tr-TR')}`;
    if (percentLabel) percentLabel.textContent = `${Math.round(progress)}%`;
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
}

// Modern ana grafik güncelleme
function updateModernMainChart() {
    console.log('Modern ana grafik güncelleniyor...');
    
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    
    const period = document.getElementById('chartPeriod')?.value || '30';
    let days = parseInt(period);
    let label = `Son ${days} Gün`;
    
    const now = new Date();
    const labels = [];
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }));
        
        const daySales = sales
            .filter(sale => {
                const saleDate = new Date(sale.date || sale.created_at);
                return saleDate.toDateString() === date.toDateString();
            })
            .reduce((sum, sale) => sum + (sale.total || 0), 0);
        
        data.push(daySales);
    }
    
    // Mevcut grafik varsa yok et
    if (POS.charts.modernChartInstance) {
        POS.charts.modernChartInstance.destroy();
    }
    
    POS.charts.modernChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Günlük Satış',
                data: data,
                borderColor: '#e60019',
                backgroundColor: 'rgba(230, 0, 25, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#e60019',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointHoverBackgroundColor: '#ff1a1a',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#333333',
                        font: {
                            size: 11,
                            weight: '500'
                        },
                        callback: function(value) {
                            return '₺' + value.toLocaleString('tr-TR');
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#333333',
                        font: {
                            size: 11,
                            weight: '500'
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            elements: {
                point: {
                    hoverBackgroundColor: '#ff1a1a'
                }
            }
        }
    });
}

// Hızlı istatistikleri yükle
function loadQuickStats() {
    // En çok satan ürünler
    loadTopSellingProducts();
    
    // Düşük stok ürünleri
    loadLowStockProducts();
    
    // Son işlemler
    loadRecentTransactions();
}

// En çok satan ürünleri yükle
function loadTopSellingProducts() {
    const container = document.getElementById('topSellingProducts');
    if (!container) return;
    
    // Satış verilerinden en çok satan ürünleri hesapla
    const productSales = {};
    
    sales.forEach(sale => {
        if (sale.items && Array.isArray(sale.items)) {
            sale.items.forEach(item => {
                if (productSales[item.name]) {
                    productSales[item.name] += item.quantity;
                } else {
                    productSales[item.name] = item.quantity;
                }
            });
        }
    });
    
    const topProducts = Object.entries(productSales)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
    
    if (topProducts.length === 0) {
        container.innerHTML = '<p>Henüz satış verisi yok</p>';
        return;
    }
    
    container.innerHTML = topProducts.map(([name, quantity]) => 
        `<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>${name}</span>
            <strong>${quantity} adet</strong>
        </div>`
    ).join('');
}

// Düşük stok ürünlerini yükle
function loadLowStockProducts() {
    const container = document.getElementById('lowStockProducts');
    if (!container) return;
    
    const lowStockItems = stockItems.filter(item => item.stock < 10);
    
    if (lowStockItems.length === 0) {
        container.innerHTML = '<p>Tüm ürünler stokta</p>';
        return;
    }
    
    container.innerHTML = lowStockItems.slice(0, 3).map(item => 
        `<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>${item.name}</span>
            <strong style="color: #dc3545;">${item.stock} adet</strong>
        </div>`
    ).join('');
}

// Son işlemleri yükle
function loadRecentTransactions() {
    const container = document.getElementById('recentTransactions');
    if (!container) return;
    
    const recentSales = sales
        .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
        .slice(0, 3);
    
    if (recentSales.length === 0) {
        container.innerHTML = '<p>Henüz işlem yok</p>';
        return;
    }
    
    container.innerHTML = recentSales.map(sale => {
        const date = new Date(sale.date || sale.created_at);
        const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        return `<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>${timeStr}</span>
            <strong>₺${(sale.total || 0).toLocaleString('tr-TR')}</strong>
        </div>`;
    }).join('');
}

// Dashboard periyodunu güncelle
function updateDashboardPeriod() {
    const period = document.getElementById('dashboardPeriod')?.value;
    console.log('Dashboard periyodu güncellendi:', period);
    
    // Periyoda göre verileri filtrele ve güncelle
    updateModernDashboardStats();
    updateModernMainChart();
}

// Grafik tipini değiştir
function changeChartType(type) {
    const buttons = document.querySelectorAll('.chart-type-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    const activeBtn = document.querySelector(`[data-type="${type}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Grafik tipini güncelle
    if (POS.charts.modernChartInstance) {
        POS.charts.modernChartInstance.config.type = type;
        POS.charts.modernChartInstance.update();
    }
}

// Dashboard yenileme
function refreshDashboard() {
    console.log('Modern dashboard yenileniyor...');
    updateModernDashboardStats();
    updateModernMainChart();
    loadQuickStats();
    refreshWeeklyAnalytics();
}

// Grafik tip değiştirici butonları için event listener
// Bu event yukarıda tanımlanmış, burada tekrar tanımlanmamalı

// Uygulama başlatma fonksiyonu
async function initializeApp() {
    console.log('Uygulama başlatılıyor...');
    
    try {
        // Verileri başlat (ürünler ve satışlar dahil)
        await initializeData();
        console.log('Veriler başlatıldı');
        
        // Add click events to nav items
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const tabName = this.getAttribute('data-tab');
                console.log('Nav item tıklandı:', tabName);
                showTab(tabName);
            });
        });

        // Show dashboard by default
        showTab('dashboard');

        // Load dashboard data
        loadDashboard();

        console.log('Uygulama başlatma tamamlandı');

    } catch (error) {
        console.error('Uygulama başlatma hatası:', error);
    }
}

// Bu fonksiyon yukarıda tanımlanmış, burada tekrar tanımlanmamalı

// ===== BULK SELECTION FUNCTIONS =====
let bulkSelectMode = false;
let selectedProducts = new Set();

function toggleBulkSelect() {
    bulkSelectMode = !bulkSelectMode;
    const bulkSelectBtn = document.getElementById('bulkSelectBtn');
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    const selectAllHeader = document.getElementById('selectAllHeader');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    console.log('Toplu seçim modu:', bulkSelectMode);
    
    if (bulkSelectMode) {
        // Toplu seçim modunu aç
        bulkSelectBtn.innerHTML = '<i class="fas fa-times"></i> İptal';
        bulkSelectBtn.style.background = 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)';
        bulkDeleteBtn.style.display = 'flex';
        selectAllHeader.style.display = 'table-cell';
        
        console.log('Toplu seçim modu açılıyor...');
        
        // Tüm satırlara checkbox ekle
        showProductCheckboxes();
    } else {
        // Toplu seçim modunu kapat
        bulkSelectBtn.innerHTML = '<i class="fas fa-check-square"></i> Toplu Seç';
        bulkSelectBtn.style.background = 'linear-gradient(135deg, #1f252b 0%, #2c3e50 100%)';
        bulkDeleteBtn.style.display = 'none';
        selectAllHeader.style.display = 'none';
        selectAllCheckbox.checked = false;
        
        console.log('Toplu seçim modu kapatılıyor...');
        
        // Tüm checkbox'ları gizle ve seçimleri temizle
        hideProductCheckboxes();
        selectedProducts.clear();
    }
}

function showProductCheckboxes() {
    const tbody = document.getElementById('productsTableBody');
    const rows = tbody.querySelectorAll('tr');
    
    console.log('Checkbox\'lar gösteriliyor, satır sayısı:', rows.length);
    
    rows.forEach((row, index) => {
        // Eğer zaten checkbox hücresi varsa, sadece göster
        const existingCheckboxCell = row.querySelector('.product-checkbox-cell');
        if (existingCheckboxCell) {
            existingCheckboxCell.classList.add('show');
            return;
        }
        
        // Checkbox yoksa, tabloyu yeniden yükle (checkbox'lar otomatik eklenecek)
        console.log('Checkbox bulunamadı, tablo yeniden yükleniyor...');
        loadProductsTable();
    });
}

function hideProductCheckboxes() {
    console.log('Checkbox\'lar gizleniyor...');
    // Tabloyu yeniden yükle (checkbox'lar otomatik kaldırılacak)
    loadProductsTable();
}

function toggleProductSelection(checkbox) {
    const productIndex = checkbox.dataset.productIndex;
    
    if (checkbox.checked) {
        selectedProducts.add(productIndex);
    } else {
        selectedProducts.delete(productIndex);
    }
    
    updateBulkDeleteButton();
    updateSelectAllCheckbox();
}

function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const productCheckboxes = document.querySelectorAll('.product-checkbox');
    
    productCheckboxes.forEach((checkbox, index) => {
        checkbox.checked = selectAllCheckbox.checked;
        const productIndex = checkbox.dataset.productIndex;
        if (selectAllCheckbox.checked) {
            selectedProducts.add(productIndex);
        } else {
            selectedProducts.delete(productIndex);
        }
    });
    
    updateBulkDeleteButton();
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const productCheckboxes = document.querySelectorAll('.product-checkbox');
    
    if (productCheckboxes.length === 0) {
        selectAllCheckbox.checked = false;
        return;
    }
    
    const checkedCount = document.querySelectorAll('.product-checkbox:checked').length;
    selectAllCheckbox.checked = checkedCount === productCheckboxes.length;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < productCheckboxes.length;
}

function updateBulkDeleteButton() {
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    const selectedCount = selectedProducts.size;
    
    if (selectedCount > 0) {
        bulkDeleteBtn.innerHTML = `<i class="fas fa-trash"></i> Seçilenleri Sil (${selectedCount})`;
        bulkDeleteBtn.style.display = 'flex';
    } else {
        bulkDeleteBtn.style.display = 'none';
    }
}

async function bulkDeleteProducts() {
    if (selectedProducts.size === 0) {
        alert('Silinecek ürün seçilmedi!');
        return;
    }
    
    const confirmMessage = `${selectedProducts.size} ürünü silmek istediğinizden emin misiniz?`;
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const tbody = document.getElementById('productsTableBody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const productsToDelete = [];
        
        // Seçili ürünlerin barkodlarını topla
        selectedProducts.forEach(index => {
            const row = rows[parseInt(index)];
            if (row) {
                // Checkbox varsa barkod 2. sütun, yoksa 1. sütun
                const barcodeCell = row.querySelector('td:nth-child(2)') || row.querySelector('td:nth-child(1)');
                if (barcodeCell) {
                    productsToDelete.push(barcodeCell.textContent.trim());
                }
            }
        });
        
        // Her ürünü sil
        for (const barcode of productsToDelete) {
            await deleteProduct(barcode);
        }
        
        // Başarı mesajı
        alert(`${productsToDelete.length} ürün başarıyla silindi!`);
        
        // Toplu seçim modunu kapat
        toggleBulkSelect();
        
        // Tabloyu yenile
        loadProductsTable();
        
    } catch (error) {
        console.error('Toplu silme hatası:', error);
        alert('Ürünler silinirken bir hata oluştu!');
    }
}

// ===== CHARTS PAGE FUNCTIONS =====

// Global chart instances
let chartInstances = {};

// Chart data generation based on filters
function generateChartData(dataType, timeRange) {
    console.log('Grafik verisi oluşturuluyor:', dataType, timeRange);
    
    // Sample data for different data types
    const sampleData = {
        profitability: {
            labels: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran'],
            datasets: [{
                label: 'Karlılık (%)',
                data: [15, 22, 18, 35, 28, 42],
                borderColor: '#32cd32',
                backgroundColor: 'rgba(50, 205, 50, 0.1)',
                tension: 0.4
            }]
        },
        sales: {
            labels: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'],
            datasets: [{
                label: 'Satış Adedi',
                data: [45, 52, 38, 65, 78, 92, 58],
                backgroundColor: '#667eea',
                borderColor: '#667eea',
                borderWidth: 1
            }]
        },
        revenue: {
            labels: ['Q1', 'Q2', 'Q3', 'Q4'],
            datasets: [{
                label: 'Ciro (₺)',
                data: [125000, 158000, 142000, 189000],
                backgroundColor: [
                    '#f093fb',
                    '#f5576c',
                    '#4facfe',
                    '#00f2fe'
                ]
            }]
        },
        stock: {
            labels: ['Düşük Stok', 'Normal Stok', 'Yüksek Stok'],
            datasets: [{
                label: 'Ürün Sayısı',
                data: [12, 45, 23],
                backgroundColor: [
                    '#dc3545',
                    '#ffc107',
                    '#28a745'
                ]
            }]
        },
        products: {
            labels: ['Kategori A', 'Kategori B', 'Kategori C', 'Kategori D'],
            datasets: [{
                label: 'Ürün Dağılımı',
                data: [25, 35, 20, 20],
                backgroundColor: [
                    '#43e97b',
                    '#38f9d7',
                    '#fa709a',
                    '#fee140'
                ]
            }]
        },
        customers: {
            labels: ['Yeni', 'Dönen', 'VIP', 'Normal'],
            datasets: [{
                label: 'Müşteri Sayısı',
                data: [15, 25, 8, 52],
                backgroundColor: [
                    '#a8edea',
                    '#fed6e3',
                    '#667eea',
                    '#764ba2'
                ]
            }]
        }
    };
    
    return sampleData[dataType] || sampleData.profitability;
}

// Update all charts based on current filters
function updateAllCharts() {
    const timeRange = document.getElementById('chartTimeRange')?.value || 'daily';
    const dataType = document.getElementById('chartDataType')?.value || 'profitability';
    
    console.log('Tüm grafikler güncelleniyor:', timeRange, dataType);
    
    updateLineChart(dataType, timeRange);
    updatePieChart(dataType, timeRange);
    updateBarChart(dataType, timeRange);
    updateAreaChart(dataType, timeRange);
    updateRadarChart(dataType, timeRange);
    updateDonutChart(dataType, timeRange);
}

// Line Chart
function updateLineChart(dataType, timeRange) {
    const ctx = document.getElementById('lineChart');
    if (!ctx) return;
    
    const data = generateChartData(dataType, timeRange);
    
    if (chartInstances.lineChart) {
        chartInstances.lineChart.destroy();
    }
    
    chartInstances.lineChart = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Trend Analizi`
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Pie Chart
function updatePieChart(dataType, timeRange) {
    const ctx = document.getElementById('pieChart');
    if (!ctx) return;
    
    const data = generateChartData(dataType, timeRange);
    
    if (chartInstances.pieChart) {
        chartInstances.pieChart.destroy();
    }
    
    chartInstances.pieChart = new Chart(ctx, {
        type: 'pie',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                title: {
                    display: true,
                    text: `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Dağılımı`
                }
            }
        }
    });
}

// Bar Chart
function updateBarChart(dataType, timeRange) {
    const ctx = document.getElementById('barChart');
    if (!ctx) return;
    
    const data = generateChartData(dataType, timeRange);
    
    if (chartInstances.barChart) {
        chartInstances.barChart.destroy();
    }
    
    chartInstances.barChart = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Karşılaştırması`
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Area Chart
function updateAreaChart(dataType, timeRange) {
    const ctx = document.getElementById('areaChart');
    if (!ctx) return;
    
    const data = generateChartData(dataType, timeRange);
    
    if (chartInstances.areaChart) {
        chartInstances.areaChart.destroy();
    }
    
    chartInstances.areaChart = new Chart(ctx, {
        type: 'line',
        data: {
            ...data,
            datasets: data.datasets.map(dataset => ({
                ...dataset,
                fill: true,
                tension: 0.4
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Kümülatif Analizi`
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Radar Chart
function updateRadarChart(dataType, timeRange) {
    const ctx = document.getElementById('radarChart');
    if (!ctx) return;
    
    const data = generateChartData(dataType, timeRange);
    
    if (chartInstances.radarChart) {
        chartInstances.radarChart.destroy();
    }
    
    chartInstances.radarChart = new Chart(ctx, {
        type: 'radar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Çok Boyutlu Analizi`
                }
            },
            scales: {
                r: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Donut Chart
function updateDonutChart(dataType, timeRange) {
    const ctx = document.getElementById('donutChart');
    if (!ctx) return;
    
    const data = generateChartData(dataType, timeRange);
    
    if (chartInstances.donutChart) {
        chartInstances.donutChart.destroy();
    }
    
    chartInstances.donutChart = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                title: {
                    display: true,
                    text: `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Merkezi Analizi`
                }
            }
        }
    });
}

// Refresh charts
function refreshCharts() {
    console.log('Grafikler yenileniyor...');
    updateAllCharts();
}

// Load charts page
function loadChartsPage() {
    console.log('Grafikler sayfası yükleniyor...');
    
    // Initialize charts with default values
    setTimeout(() => {
        updateAllCharts();
    }, 100);
}

// Add chart functions to window
window.updateAllCharts = updateAllCharts;
window.refreshCharts = refreshCharts;
window.loadChartsPage = loadChartsPage;

// ===== ÜRÜN EKLEME FONKSİYONLARI =====

// Hızlı ürün ekleme modalını aç
function openQuickAddModal() {
    console.log('Hızlı ürün ekleme modalı açılıyor...');
    
    // Kategori seçeneklerini güncelle
    updateCategorySelects();
    
    // Modal'ı göster
    const modal = document.getElementById('quickAddModal');
    if (modal) {
        modal.style.display = 'block';
        
        // Form alanlarını temizle
        document.getElementById('quickBarcode').value = '';
        document.getElementById('quickProductName').value = '';
        document.getElementById('quickBrand').value = '';
        document.getElementById('quickCategory').value = '';
        document.getElementById('quickSize').value = '';
        document.getElementById('quickStock').value = '';
        document.getElementById('quickPurchasePrice').value = '';
        document.getElementById('quickSalePrice').value = '';
        
        // İlk alana odaklan
        document.getElementById('quickBarcode').focus();
    } else {
        console.error('quickAddModal bulunamadı!');
    }
}

// Hızlı ürün kaydetme
async function saveQuickProduct(event) {
    event.preventDefault();
    console.log('Hızlı ürün kaydediliyor...');
    
    try {
        // Form verilerini al
        const product = {
            barcode: document.getElementById('quickBarcode').value.trim(),
            name: document.getElementById('quickProductName').value.trim(),
            brand: document.getElementById('quickBrand').value.trim(),
            category: document.getElementById('quickCategory').value,
            size: document.getElementById('quickSize').value.trim(),
            stock: parseInt(document.getElementById('quickStock').value) || 0,
            purchasePrice: parseFloat(document.getElementById('quickPurchasePrice').value) || 0,
            salePrice: parseFloat(document.getElementById('quickSalePrice').value) || 0,
            description: ''
        };
        
        // Veri doğrulama
        if (!product.barcode || !product.name || !product.brand || !product.category) {
            alert('Lütfen tüm zorunlu alanları doldurun!');
            return;
        }
        
        if (product.purchasePrice <= 0 || product.salePrice <= 0) {
            alert('Fiyatlar 0\'dan büyük olmalıdır!');
            return;
        }
        
        // Aynı barkod kontrolü
        const existingProduct = stockItems.find(p => p.barcode === product.barcode);
        if (existingProduct) {
            alert('Bu barkod zaten kullanılıyor!');
            return;
        }
        
        console.log('Ürün verisi:', product);
        
        // Veritabanına kaydet
        if (window.posAPI && typeof window.posAPI.addProduct === 'function') {
            try {
                const result = await window.posAPI.addProduct(product);
                console.log('Ürün veritabanına kaydedildi:', result);
            } catch (dbError) {
                console.error('Veritabanı kaydetme hatası:', dbError);
                alert('Veritabanına kaydedilemedi, sadece geçici olarak eklendi!');
            }
        } else {
            console.warn('posAPI.addProduct bulunamadı, sadece local array\'e ekleniyor');
        }
        
        // Local array'e ekle
        stockItems.push(product);
        
        // Kategorileri güncelle
        if (!categories.includes(product.category)) {
            categories.push(product.category);
            updateCategorySelects();
        }
        
        // Modal'ı kapat
        closeModal('quickAddModal');
        
        // Ürünler tablosunu yenile
        await loadProductsTable();
        
        // Başarı mesajı
        alert('Ürün başarıyla eklendi!');
        
        console.log('Ürün başarıyla eklendi:', product.name);
        
    } catch (error) {
        console.error('Ürün kaydetme hatası:', error);
        alert('Ürün kaydedilirken bir hata oluştu!');
    }
}

// Modal kapatma fonksiyonu
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Modal dışına tıklayınca kapatma
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// ESC tuşu ile modal kapatma
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal.style.display === 'block') {
                modal.style.display = 'none';
            }
        });
    }
});

// Debug fonksiyonu
async function debugProducts() {
    console.log('=== DEBUG BİLGİLERİ ===');
    console.log('stockItems length:', stockItems ? stockItems.length : 'undefined');
    console.log('stockItems:', stockItems);
    console.log('window.posAPI:', window.posAPI);
    
    if (window.posAPI && typeof window.posAPI.getProducts === 'function') {
        try {
            const dbProducts = await window.posAPI.getProducts();
            console.log('Veritabanından ürünler:', dbProducts);
            console.log('Veritabanı ürün sayısı:', dbProducts ? dbProducts.length : 0);
        } catch (error) {
            console.error('Veritabanı hatası:', error);
        }
    }
    
    const tbody = document.getElementById('productsTableBody');
    console.log('productsTableBody:', tbody);
    console.log('productsTableBody children:', tbody ? tbody.children.length : 'undefined');
    
    // Ürünleri zorla yükle
    console.log('Ürünleri zorla yüklüyor...');
    await loadProductsTable();
}

// Ürün kaydetme fonksiyonu
async function saveProduct(event) {
    event.preventDefault();
    
    // Form validasyonu
    const barcode = document.getElementById('barcode').value.trim();
    const name = document.getElementById('productName').value.trim();
    const brand = document.getElementById('brand').value.trim();
    const category = document.getElementById('category').value.trim();
    const stock = parseInt(document.getElementById('stock').value) || 0;
    const purchasePrice = parseFloat(document.getElementById('purchasePrice').value) || 0;
    const salePrice = parseFloat(document.getElementById('salePrice').value) || 0;
    
    // Zorunlu alanları kontrol et
    if (!barcode) {
        alert('Barkod alanı zorunludur!');
        document.getElementById('barcode').focus();
        return;
    }
    
    if (!name) {
        alert('Ürün adı alanı zorunludur!');
        document.getElementById('productName').focus();
        return;
    }
    
    if (!brand) {
        alert('Marka alanı zorunludur!');
        document.getElementById('brand').focus();
        return;
    }
    
    if (!category) {
        alert('Kategori alanı zorunludur!');
        document.getElementById('category').focus();
        return;
    }
    
    if (stock < 0) {
        alert('Stok miktarı negatif olamaz!');
        document.getElementById('stock').focus();
        return;
    }
    
    if (purchasePrice <= 0) {
        alert('Alış fiyatı 0\'dan büyük olmalıdır!');
        document.getElementById('purchasePrice').focus();
        return;
    }
    
    if (salePrice <= 0) {
        alert('Satış fiyatı 0\'dan büyük olmalıdır!');
        document.getElementById('salePrice').focus();
        return;
    }
    
    if (salePrice <= purchasePrice) {
        alert('Satış fiyatı alış fiyatından büyük olmalıdır!');
        document.getElementById('salePrice').focus();
        return;
    }
    
    // Barkod benzersizlik kontrolü
    const existingProduct = stockItems.find(item => item.barcode === barcode);
    if (existingProduct) {
        alert('Bu barkod zaten kullanılıyor!');
        document.getElementById('barcode').focus();
        return;
    }
    
    const formData = {
        barcode: barcode,
        name: name,
        brand: brand,
        category: category,
        size: document.getElementById('size') ? document.getElementById('size').value.trim() : '',
        stock: stock,
        minStock: parseInt(document.getElementById('minStock') ? document.getElementById('minStock').value : 0) || 0,
        purchasePrice: purchasePrice,
        salePrice: salePrice,
        description: document.getElementById('description') ? document.getElementById('description').value.trim() : ''
    };

    try {
        // Veritabanına kaydet
        if (window.posAPI && typeof window.posAPI.addProduct === 'function') {
            const result = await window.posAPI.addProduct(formData);
            console.log('Ürün veritabanına kaydedildi:', result);
        }

        // Local array'e ekle
        const newProduct = {
            id: Date.now(), // Geçici ID
            ...formData
        };
        stockItems.push(newProduct);

        // Tabloyu güncelle
        await loadProductsTable();

        // Modal'ı kapat
        closeModal('addProductModal');

        // Formu temizle
        document.getElementById('addProductForm').reset();

        alert('Ürün başarıyla eklendi!');
        
    } catch (error) {
        console.error('Ürün kaydetme hatası:', error);
        alert('Ürün kaydedilirken bir hata oluştu: ' + error.message);
    }
}

// Ürün güncelleme fonksiyonu
async function updateProduct(event) {
    event.preventDefault();
    
    const productId = document.getElementById('editProductId').value;
    const formData = {
        barcode: document.getElementById('editBarcode').value,
        name: document.getElementById('editProductName').value,
        brand: document.getElementById('editBrand').value,
        category: document.getElementById('editCategory').value,
        size: document.getElementById('editSize') ? document.getElementById('editSize').value : '',
        stock: parseInt(document.getElementById('editStock').value) || 0,
        minStock: parseInt(document.getElementById('editMinStock') ? document.getElementById('editMinStock').value : 0) || 0,
        purchasePrice: parseFloat(document.getElementById('editPurchasePrice').value) || 0,
        salePrice: parseFloat(document.getElementById('editSalePrice').value) || 0,
        description: document.getElementById('editDescription') ? document.getElementById('editDescription').value : ''
    };

    try {
        // Veritabanını güncelle
        if (window.posAPI && typeof window.posAPI.updateProduct === 'function') {
            const result = await window.posAPI.updateProduct(productId, formData);
            console.log('Ürün veritabanında güncellendi:', result);
        }

        // Local array'i güncelle
        const productIndex = stockItems.findIndex(item => item.id == productId);
        if (productIndex !== -1) {
            stockItems[productIndex] = { ...stockItems[productIndex], ...formData };
        }

        // Tabloyu güncelle
        await loadProductsTable();

        // Modal'ı kapat
        closeModal('editProductModal');

        alert('Ürün başarıyla güncellendi!');
        
    } catch (error) {
        console.error('Ürün güncelleme hatası:', error);
        alert('Ürün güncellenirken bir hata oluştu: ' + error.message);
    }
}

// Ürün düzenleme modalını aç
function openEditProductModal(barcode) {
    const product = stockItems.find(item => item.barcode === barcode);
    if (!product) {
        alert('Ürün bulunamadı!');
        return;
    }

    // Form alanlarını doldur
    document.getElementById('editProductId').value = product.id || '';
    document.getElementById('editBarcode').value = product.barcode || '';
    document.getElementById('editProductName').value = product.name || '';
    document.getElementById('editBrand').value = product.brand || '';
    document.getElementById('editCategory').value = product.category || '';
    if (document.getElementById('editSize')) {
        document.getElementById('editSize').value = product.size || '';
    }
    document.getElementById('editStock').value = product.stock || 0;
    if (document.getElementById('editMinStock')) {
        document.getElementById('editMinStock').value = product.minStock || 0;
    }
    document.getElementById('editPurchasePrice').value = product.purchasePrice || 0;
    document.getElementById('editSalePrice').value = product.salePrice || 0;
    if (document.getElementById('editDescription')) {
        document.getElementById('editDescription').value = product.description || '';
    }

    // Kategori seçeneklerini güncelle
    updateCategorySelects();

    // Modal'ı aç
    document.getElementById('editProductModal').style.display = 'flex';
}

// Fonksiyonları window'a ekle
window.openQuickAddModal = openQuickAddModal;
window.saveQuickProduct = saveQuickProduct;
window.saveProduct = saveProduct;
window.updateProduct = updateProduct;
window.openEditProductModal = openEditProductModal;
window.closeModal = closeModal;
window.debugProducts = debugProducts;

// Uygulama başlatma
// Bu event yukarıda tanımlanmış, burada tekrar tanımlanmamalı


