// Reports sayfası modülü
console.log('📊 Reports modülü yüklendi');

// ===== REPORTS YÖNETİMİ =====

// Reports içeriğini yükle
async function loadReportsContent() {
    console.log('📊 Reports içeriği yükleniyor...');
    
    try {
        // Reports container'ını bul
        const reportsContent = document.querySelector('.reports-content');
        if (!reportsContent) {
            console.error('❌ Reports container bulunamadı');
            return;
        }
        
        // Reports içeriğini oluştur
        const content = `
            <div class="reports-page">
                <!-- Modern Raporlar Header -->
                <div class="reports-header-modern">
                    <div class="header-left">
                        <div class="reports-info">
                            <h2>Raporlar ve Analizler</h2>
                            <div class="reports-details">
                                <span class="report-date">${new Date().toLocaleDateString('tr-TR')}</span>
                                <span class="report-time">${new Date().toLocaleTimeString('tr-TR')}</span>
                            </div>
                        </div>
                    </div>
                    <div class="header-right">
                        <button class="btn-modern btn-export" onclick="exportReports()">
                            <i class="fas fa-download"></i>
                            <span>Dışa Aktar</span>
                        </button>
                        <button class="btn-modern btn-refresh" onclick="refreshReports()">
                            <i class="fas fa-sync-alt"></i>
                            <span>Yenile</span>
                        </button>
                    </div>
                </div>

                <!-- Modern İstatistik Kartları -->
                <div class="stats-grid-modern">
                    <div class="stat-card-modern">
                        <div class="stat-header-modern">
                            <div class="stat-icon-modern">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="stat-title-modern">
                                <h4>Toplam Satış</h4>
                                <span class="stat-period">Bu ay</span>
                            </div>
                        </div>
                        <div class="stat-content-modern">
                            <div class="stat-value-modern" id="totalSales">₺0.00</div>
                            <div class="stat-change-modern positive">
                                <i class="fas fa-arrow-up"></i>
                                <span id="salesChange">+0%</span>
                            </div>
                        </div>
                    </div>
                    <div class="stat-card-modern">
                        <div class="stat-header-modern">
                            <div class="stat-icon-modern">
                                <i class="fas fa-shopping-cart"></i>
                            </div>
                            <div class="stat-title-modern">
                                <h4>Toplam Sipariş</h4>
                                <span class="stat-period">Bu ay</span>
                            </div>
                        </div>
                        <div class="stat-content-modern">
                            <div class="stat-value-modern" id="totalOrders">0</div>
                            <div class="stat-change-modern positive">
                                <i class="fas fa-arrow-up"></i>
                                <span id="ordersChange">+0%</span>
                            </div>
                        </div>
                    </div>
                    <div class="stat-card-modern">
                        <div class="stat-header-modern">
                            <div class="stat-icon-modern">
                                <i class="fas fa-boxes"></i>
                            </div>
                            <div class="stat-title-modern">
                                <h4>Toplam Ürün</h4>
                                <span class="stat-period">Stokta</span>
                            </div>
                        </div>
                        <div class="stat-content-modern">
                            <div class="stat-value-modern" id="totalProducts">0</div>
                            <div class="stat-change-modern neutral">
                                <i class="fas fa-minus"></i>
                                <span id="productsChange">0%</span>
                            </div>
                        </div>
                    </div>
                    <div class="stat-card-modern">
                        <div class="stat-header-modern">
                            <div class="stat-icon-modern">
                                <i class="fas fa-bullhorn"></i>
                            </div>
                            <div class="stat-title-modern">
                                <h4>Reklam Bütçesi</h4>
                                <span class="stat-period">Bu ay</span>
                            </div>
                        </div>
                        <div class="stat-content-modern">
                            <div class="stat-value-modern" id="adBudget">₺0.00</div>
                            <div class="stat-change-modern negative">
                                <i class="fas fa-arrow-down"></i>
                                <span id="budgetChange">-0%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modern Filtreler -->
                <div class="filters-section-modern">
                    <div class="filter-group-modern">
                        <label for="dateFrom">Başlangıç Tarihi:</label>
                        <input type="date" id="dateFrom" onchange="filterReports()" class="input-modern">
                    </div>
                    <div class="filter-group-modern">
                        <label for="dateTo">Bitiş Tarihi:</label>
                        <input type="date" id="dateTo" onchange="filterReports()" class="input-modern">
                    </div>
                    <div class="filter-group-modern">
                        <label for="categoryFilter">Kategori:</label>
                        <select id="categoryFilter" onchange="filterReports()" class="input-modern">
                            <option value="">Tüm Kategoriler</option>
                        </select>
                    </div>
                    <div class="filter-group-modern">
                        <label for="searchFilter">Arama:</label>
                        <input type="text" id="searchFilter" placeholder="Ürün ara..." onkeyup="filterReports()" class="input-modern">
                    </div>
                </div>

                <!-- Modern Raporlar Tablosu -->
                <div class="reports-table-container-modern">
                    <div class="table-header-modern">
                        <h4>
                            <i class="fas fa-table"></i>
                            Detaylı Rapor
                        </h4>
                        <div class="table-actions-modern">
                            <button class="btn-modern btn-sort" onclick="sortTable('name')">
                                <i class="fas fa-sort"></i>
                                <span>Sırala</span>
                            </button>
                        </div>
                    </div>
                    <div class="table-wrapper">
                        <table class="reports-table" id="reportsTable">
                            <thead>
                                <tr>
                                    <th>Barkod</th>
                                    <th>Ürün Adı</th>
                                    <th>Marka</th>
                                    <th>Beden</th>
                                    <th>Adet</th>
                                    <th>Alış Fiyatı</th>
                                    <th>Satış Fiyatı</th>
                                    <th>Kar</th>
                                    <th>İşlemler</th>
                                </tr>
                            </thead>
                            <tbody id="reportsTableBody">
                                <tr class="loading-row">
                                    <td colspan="9">
                                        <div class="loading-spinner">
                                            <i class="fas fa-spinner fa-spin"></i>
                                            <span>Raporlar yükleniyor...</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Sayfalama -->
                <div class="pagination-container">
                    <div class="pagination-info">
                        <span id="paginationInfo">1-10 / 0 kayıt</span>
                    </div>
                    <div class="pagination-controls">
                        <button class="btn-pagination" onclick="previousPage()" disabled>
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <span class="page-numbers" id="pageNumbers">1</span>
                        <button class="btn-pagination" onclick="nextPage()" disabled>
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // İçeriği ekle
        reportsContent.innerHTML = content;
        
        // Raporları yükle
        await loadReportsData();
        
        console.log('✅ Reports içeriği yüklendi');
        
    } catch (error) {
        console.error('❌ Reports içerik yükleme hatası:', error);
    }
}

// Rapor verilerini yükle
async function loadReportsData() {
    console.log('📊 Rapor verileri yükleniyor...');
    
    try {
        const [sales, products, categories] = await Promise.all([
            window.posAPI.getSales(),
            window.posAPI.getProducts(),
            window.posAPI.getCategories()
        ]);
        
        const tbody = document.getElementById('reportsTableBody');
        const categoryFilter = document.getElementById('categoryFilter');
        
        if (!tbody) return;
        
        // Kategori filtresini doldur
        if (categoryFilter && categories) {
            categoryFilter.innerHTML = '<option value="">Tüm Kategoriler</option>' +
                categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
        }
        
        // İstatistik kartlarını güncelle
        updateStatisticsCards(sales, products);
        
        // Ürün raporu verilerini hazırla
        const productReports = await generateProductReports(products, sales);
        
        if (productReports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="no-data">Henüz ürün verisi yok</td></tr>';
            return;
        }
        
        // Tablo verilerini göster
        tbody.innerHTML = productReports.map(product => `
            <tr>
                <td>${product.barcode || 'N/A'}</td>
                <td>${product.name}</td>
                <td>${product.brand || 'N/A'}</td>
                <td>${product.size || 'N/A'}</td>
                <td>${product.quantity}</td>
                <td>₺${product.cost_price.toFixed(2)}</td>
                <td>₺${product.price.toFixed(2)}</td>
                <td class="profit ${product.profit >= 0 ? 'positive' : 'negative'}">
                    ₺${product.profit.toFixed(2)}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-small" onclick="viewProductDetails(${product.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-small" onclick="editProduct(${product.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        console.log('✅ Rapor verileri yüklendi');
        
    } catch (error) {
        console.error('❌ Rapor verileri yükleme hatası:', error);
    }
}

// Ürün raporları oluştur
async function generateProductReports(products, sales) {
    const productReports = [];
    
    for (const product of products) {
        // Satış verilerinden bu ürünün satış miktarını hesapla
        const productSales = sales.filter(sale => 
            sale.items && sale.items.some(item => item.product_id === product.id)
        );
        
        const totalQuantity = productSales.reduce((sum, sale) => {
            const item = sale.items.find(item => item.product_id === product.id);
            return sum + (item ? item.quantity : 0);
        }, 0);
        
        const profit = (product.price - product.cost_price) * totalQuantity;
        
        productReports.push({
            id: product.id,
            barcode: product.barcode,
            name: product.name,
            brand: product.brand,
            size: product.size,
            quantity: totalQuantity,
            cost_price: product.cost_price || 0,
            price: product.price,
            profit: profit
        });
    }
    
    return productReports;
}

// İstatistik kartlarını güncelle
function updateStatisticsCards(sales, products) {
    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalOrders = sales.length;
    const totalProducts = products.length;
    const adBudget = 5000; // Örnek reklam bütçesi
    
    // Satış değişimi (örnek)
    const salesChange = 12.5;
    const ordersChange = 8.3;
    const productsChange = 0;
    const budgetChange = -5.2;
    
    // DOM elementlerini güncelle
    const totalSalesEl = document.getElementById('totalSales');
    const totalOrdersEl = document.getElementById('totalOrders');
    const totalProductsEl = document.getElementById('totalProducts');
    const adBudgetEl = document.getElementById('adBudget');
    
    const salesChangeEl = document.getElementById('salesChange');
    const ordersChangeEl = document.getElementById('ordersChange');
    const productsChangeEl = document.getElementById('productsChange');
    const budgetChangeEl = document.getElementById('budgetChange');
    
    if (totalSalesEl) totalSalesEl.textContent = `₺${totalSales.toFixed(2)}`;
    if (totalOrdersEl) totalOrdersEl.textContent = totalOrders.toString();
    if (totalProductsEl) totalProductsEl.textContent = totalProducts.toString();
    if (adBudgetEl) adBudgetEl.textContent = `₺${adBudget.toFixed(2)}`;
    
    if (salesChangeEl) salesChangeEl.textContent = `+${salesChange}%`;
    if (ordersChangeEl) ordersChangeEl.textContent = `+${ordersChange}%`;
    if (productsChangeEl) productsChangeEl.textContent = `${productsChange}%`;
    if (budgetChangeEl) budgetChangeEl.textContent = `${budgetChange}%`;
}

// Tablo başlıklarını güncelle
function updateTableHeaders(reportType) {
    const thead = document.getElementById('reportTableHead');
    const title = document.getElementById('reportTitle');
    
    if (!thead || !title) return;
    
    switch(reportType) {
        case 'sales':
            title.textContent = 'Satış Raporu';
            thead.innerHTML = `
                <tr>
                    <th>Tarih</th>
                    <th>Satış ID</th>
                    <th>Müşteri</th>
                    <th>Tutar</th>
                    <th>Ödeme</th>
                    <th>Durum</th>
                </tr>
            `;
            break;
        case 'products':
            title.textContent = 'Ürün Raporu';
            thead.innerHTML = `
                <tr>
                    <th>Ürün Adı</th>
                    <th>Kategori</th>
                    <th>Satılan Miktar</th>
                    <th>Toplam Tutar</th>
                    <th>Kar</th>
                    <th>Durum</th>
                </tr>
            `;
            break;
        case 'categories':
            title.textContent = 'Kategori Raporu';
            thead.innerHTML = `
                <tr>
                    <th>Kategori</th>
                    <th>Satış Sayısı</th>
                    <th>Toplam Tutar</th>
                    <th>Ortalama</th>
                    <th>Kar</th>
                    <th>Durum</th>
                </tr>
            `;
            break;
        case 'profit':
            title.textContent = 'Kar Raporu';
            thead.innerHTML = `
                <tr>
                    <th>Tarih</th>
                    <th>Satış ID</th>
                    <th>Satış Tutarı</th>
                    <th>Maliyet</th>
                    <th>Kar</th>
                    <th>Kar Marjı</th>
                </tr>
            `;
            break;
    }
}

// Özet kartlarını güncelle
function updateSummaryCards(totalSales, totalTransactions, totalProfit, profitMargin) {
    const totalSalesEl = document.getElementById('totalSales');
    const totalTransactionsEl = document.getElementById('totalTransactions');
    const totalProfitEl = document.getElementById('totalProfit');
    const profitMarginEl = document.getElementById('profitMargin');
    
    if (totalSalesEl) totalSalesEl.textContent = `₺${totalSales.toFixed(2)}`;
    if (totalTransactionsEl) totalTransactionsEl.textContent = totalTransactions.toString();
    if (totalProfitEl) totalProfitEl.textContent = `₺${totalProfit.toFixed(2)}`;
    if (profitMarginEl) profitMarginEl.textContent = `${profitMargin.toFixed(1)}%`;
}

// Ödeme yöntemi metni
function getPaymentMethodText(method) {
    switch(method) {
        case 'cash': return 'Nakit';
        case 'card': return 'Kart';
        case 'mixed': return 'Karışık';
        default: return 'Bilinmiyor';
    }
}

// Raporları güncelle
function updateReports() {
    const dateRange = document.getElementById('dateRange')?.value;
    const customDateGroup = document.getElementById('customDateGroup');
    const customDateGroup2 = document.getElementById('customDateGroup2');
    
    if (dateRange === 'custom') {
        customDateGroup.style.display = 'block';
        customDateGroup2.style.display = 'block';
    } else {
        customDateGroup.style.display = 'none';
        customDateGroup2.style.display = 'none';
    }
    
    loadReportsData();
}

// Rapor oluştur
function generateReport() {
    console.log('📊 Rapor oluşturuluyor...');
    loadReportsData();
}

// Raporu dışa aktar
function exportReport() {
    console.log('📤 Rapor dışa aktarılıyor...');
    // Dışa aktarma işlemi burada yapılacak
}

// Raporu yenile
function refreshReport() {
    console.log('🔄 Rapor yenileniyor...');
    loadReportsData();
}

// Sayfa navigasyonu
function previousReportPage() {
    console.log('⬅️ Önceki sayfa');
    // Sayfa navigasyonu burada yapılacak
}

function nextReportPage() {
    console.log('➡️ Sonraki sayfa');
    // Sayfa navigasyonu burada yapılacak
}

// Raporları filtrele
function filterReports() {
    console.log('🔍 Raporlar filtreleniyor...');
    loadReportsData();
}

// Tabloyu sırala
function sortTable(column) {
    console.log('📊 Tablo sıralanıyor:', column);
    // Sıralama işlemi burada yapılacak
}

// Sayfa navigasyonu
function previousPage() {
    console.log('⬅️ Önceki sayfa');
    // Sayfa navigasyonu burada yapılacak
}

function nextPage() {
    console.log('➡️ Sonraki sayfa');
    // Sayfa navigasyonu burada yapılacak
}

// Raporları dışa aktar
function exportReports() {
    console.log('📤 Raporlar dışa aktarılıyor...');
    // Dışa aktarma işlemi burada yapılacak
}

// Raporları yenile
function refreshReports() {
    console.log('🔄 Raporlar yenileniyor...');
    loadReportsData();
}

// Ürün detaylarını görüntüle
function viewProductDetails(productId) {
    console.log('👁️ Ürün detayları görüntüleniyor:', productId);
    // Ürün detayları burada açılacak
}

// Ürünü düzenle
function editProduct(productId) {
    console.log('✏️ Ürün düzenleniyor:', productId);
    // Ürün düzenleme burada açılacak
}

// Global fonksiyonları window'a ekle
window.loadReportsContent = loadReportsContent;
window.loadReportsData = loadReportsData;
window.filterReports = filterReports;
window.sortTable = sortTable;
window.previousPage = previousPage;
window.nextPage = nextPage;
window.exportReports = exportReports;
window.refreshReports = refreshReports;
window.viewProductDetails = viewProductDetails;
window.editProduct = editProduct;
