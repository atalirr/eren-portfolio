// Charts sayfası modülü

console.log('📊 Charts modülü yüklendi');

// ===== CHARTS YÖNETİMİ =====

// Charts içeriğini yükle
async function loadChartsContent() {
    console.log('📊 Charts içeriği yükleniyor...');
    
    try {
        // Charts container'ını bul
        const chartsContent = document.querySelector('.charts-content');
        if (!chartsContent) {
            console.error('❌ Charts container bulunamadı');
            return;
        }
        
        // Charts içeriğini oluştur
        const content = `
            <div class="charts-page">
                <!-- Filtreler (Başlıklar buraya taşındı) -->
                <div class="charts-filters">
                    <div class="filter-group">
                        <label for="timeFilter">Zaman</label>
                        <select id="timeFilter" class="filter-select" onchange="updateCharts()">
                            <option value="today">Bugün</option>
                            <option value="week">Bu Hafta</option>
                            <option value="month" selected>Bu Ay</option>
                            <option value="quarter">Bu Çeyrek</option>
                            <option value="year">Bu Yıl</option>
                            <option value="all">Tüm Zamanlar</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="typeFilter">Grafik</label>
                        <select id="typeFilter" class="filter-select" onchange="updateChartsTitles()">
                            <option value="all" selected>Tüm Grafikler</option>
                            <option value="salesTrend">Satış Trendi</option>
                            <option value="categoryDistribution">Kategori Dağılımı</option>
                            <option value="monthlySales">Aylık Satış</option>
                            <option value="productPerformance">Ürün Performansı</option>
                            <option value="profitAnalysis">Kar Analizi</option>
                            <option value="weeklyTrend">Haftalık Trend</option>
                        </select>
                    </div>
                </div>

                <!-- Grafik Kartları -->
                <div class="charts-grid">
                    <!-- Satış Trendi Grafiği -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <div class="chart-title"></div>
                            <button class="chart-refresh" onclick="refreshChart('salesTrend')">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        </div>
                        <div class="chart-container">
                            <canvas id="salesTrendChart"></canvas>
                        </div>
                        <div class="chart-stats" style="display:none"></div>
                    </div>

                    <!-- Kategori Dağılımı -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <div class="chart-title"></div>
                            <button class="chart-refresh" onclick="refreshChart('categoryDistribution')">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        </div>
                        <div class="chart-container">
                            <canvas id="categoryChart"></canvas>
                        </div>
                        <div class="chart-stats" style="display:none">
                            <div class="chart-stat">
                                <div class="chart-stat-value" id="categoryCount">0</div>
                                <div class="chart-stat-label">Kategori Sayısı</div>
                            </div>
                            <div class="chart-stat">
                                <div class="chart-stat-value" id="topCategory">-</div>
                                <div class="chart-stat-label">En Popüler</div>
                            </div>
                        </div>
                    </div>

                    <!-- Aylık Satış Grafiği -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <div class="chart-title"></div>
                            <button class="chart-refresh" onclick="refreshChart('monthlySales')">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        </div>
                        <div class="chart-container">
                            <canvas id="monthlySalesChart"></canvas>
                        </div>
                        <div class="chart-stats" style="display:none">
                            <div class="chart-stat">
                                <div class="chart-stat-value" id="monthlyTotal">₺0</div>
                                <div class="chart-stat-label">Aylık Toplam</div>
                            </div>
                            <div class="chart-stat">
                                <div class="chart-stat-value" id="monthlyAvg">₺0</div>
                                <div class="chart-stat-label">Ortalama</div>
                            </div>
                        </div>
                    </div>

                    <!-- Ürün Performansı -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <div class="chart-title"></div>
                            <button class="chart-refresh" onclick="refreshChart('productPerformance')">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        </div>
                        <div class="chart-container">
                            <canvas id="productPerformanceChart"></canvas>
                        </div>
                        <div class="chart-stats" style="display:none">
                            <div class="chart-stat">
                                <div class="chart-stat-value" id="productCount">0</div>
                                <div class="chart-stat-label">Toplam Ürün</div>
                            </div>
                            <div class="chart-stat">
                                <div class="chart-stat-value" id="topProduct">-</div>
                                <div class="chart-stat-label">En Çok Satan</div>
                            </div>
                        </div>
                    </div>

                    <!-- Kar Analizi -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <div class="chart-title"></div>
                            <button class="chart-refresh" onclick="refreshChart('profitAnalysis')">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        </div>
                        <div class="chart-container">
                            <canvas id="profitAnalysisChart"></canvas>
                        </div>
                        <div class="chart-stats" style="display:none">
                            <div class="chart-stat">
                                <div class="chart-stat-value" id="totalProfit">₺0</div>
                                <div class="chart-stat-label">Toplam Kar</div>
                            </div>
                            <div class="chart-stat">
                                <div class="chart-stat-value" id="profitMargin">0%</div>
                                <div class="chart-stat-label">Kar Marjı</div>
                            </div>
                        </div>
                    </div>

                    <!-- Haftalık Trend -->
                    <div class="chart-card">
                        <div class="chart-header">
                            <div class="chart-title"></div>
                            <button class="chart-refresh" onclick="refreshChart('weeklyTrend')">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        </div>
                        <div class="chart-container">
                            <canvas id="weeklyTrendChart"></canvas>
                        </div>
                        <div class="chart-stats">
                            <div class="chart-stat">
                                <div class="chart-stat-value" id="weeklyTotal">₺0</div>
                                <div class="chart-stat-label">Haftalık Toplam</div>
                            </div>
                            <div class="chart-stat">
                                <div class="chart-stat-value" id="weeklyGrowth">0%</div>
                                <div class="chart-stat-label">Büyüme</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // İçeriği ekle
        chartsContent.innerHTML = content;

        // Başlıkları filtreye taşıdık; kart içi başlıkları güncelleme
        window.updateChartsTitles = function updateChartsTitles() {
            const type = document.getElementById('typeFilter')?.value || 'all';
            const titles = {
                salesTrend: 'Satış Trendi',
                categoryDistribution: 'Kategori Dağılımı',
                monthlySales: 'Aylık Satış',
                productPerformance: 'Ürün Performansı',
                profitAnalysis: 'Kar Analizi',
                weeklyTrend: 'Haftalık Trend'
            };
            // Kart içi başlıkları boş bırakıyoruz; sadece filtrede gösteriliyor
            document.querySelectorAll('.chart-title').forEach(el => { el.textContent = ''; });
            // İsteğe göre tek bir kartı vurgulamak istersek burada ekleyebiliriz
            updateCharts?.();
        }
        
        // Grafikleri başlat
        await initializeCharts();
        
        console.log('✅ Charts içeriği yüklendi');
        
    } catch (error) {
        console.error('❌ Charts içerik yükleme hatası:', error);
    }
}

// Grafikleri başlat
async function initializeCharts() {
    console.log('📊 Grafikler başlatılıyor...');
    
    try {
        // Tüm grafikleri oluştur
        await createSalesTrendChart();
        await createCategoryChart();
        await createMonthlySalesChart();
        await createProductPerformanceChart();
        await createProfitAnalysisChart();
        await createWeeklyTrendChart();
        
        console.log('✅ Tüm grafikler başlatıldı');
        
    } catch (error) {
        console.error('❌ Grafik başlatma hatası:', error);
    }
}

// Satış trendi grafiği
async function createSalesTrendChart() {
    const ctx = document.getElementById('salesTrendChart');
    if (!ctx) return;
    
    const salesData = await window.posAPI.getSales();
    const chartData = processSalesTrendData(salesData);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Satış Miktarı',
                data: chartData.values,
                borderColor: '#0077a6',
                backgroundColor: 'rgba(0, 119, 166, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
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
                    ticks: {
                        callback: function(value) {
                            return '₺' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Kategori dağılımı grafiği
async function createCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    
    const categories = await window.posAPI.getCategories();
    const chartData = processCategoryData(categories);
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartData.labels,
            datasets: [{
                data: chartData.values,
                backgroundColor: [
                    '#0077a6',
                    '#eb001b',
                    '#ff5f00',
                    '#f79e1b',
                    '#1a1f71',
                    '#6b7280'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Aylık satış grafiği
async function createMonthlySalesChart() {
    const ctx = document.getElementById('monthlySalesChart');
    if (!ctx) return;
    
    const salesData = await window.posAPI.getSales();
    const chartData = processMonthlySalesData(salesData);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Aylık Satış',
                data: chartData.values,
                backgroundColor: '#ff5f00',
                borderColor: '#ff5f00',
                borderWidth: 1
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
                    ticks: {
                        callback: function(value) {
                            return '₺' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Ürün performansı grafiği
async function createProductPerformanceChart() {
    const ctx = document.getElementById('productPerformanceChart');
    if (!ctx) return;
    
    const products = await window.posAPI.getProducts();
    const chartData = processProductPerformanceData(products);
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Ürün Performansı',
                data: chartData.values,
                borderColor: '#f79e1b',
                backgroundColor: 'rgba(247, 158, 27, 0.2)',
                borderWidth: 2
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
                r: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Kar analizi grafiği
async function createProfitAnalysisChart() {
    const ctx = document.getElementById('profitAnalysisChart');
    if (!ctx) return;
    
    const salesData = await window.posAPI.getSales();
    const chartData = processProfitAnalysisData(salesData);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Kar Miktarı',
                data: chartData.values,
                borderColor: '#1a1f71',
                backgroundColor: 'rgba(26, 31, 113, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
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
                    ticks: {
                        callback: function(value) {
                            return '₺' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Haftalık trend grafiği
async function createWeeklyTrendChart() {
    const ctx = document.getElementById('weeklyTrendChart');
    if (!ctx) return;
    
    const salesData = await window.posAPI.getSales();
    const chartData = processWeeklyTrendData(salesData);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Haftalık Satış',
                data: chartData.values,
                backgroundColor: '#0077a6',
                borderColor: '#0077a6',
                borderWidth: 1
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
                    ticks: {
                        callback: function(value) {
                            return '₺' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Veri işleme fonksiyonları
function processSalesTrendData(salesData) {
    // Satış verilerini işle
    const labels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const values = [1200, 1900, 3000, 5000, 2000, 3000, 4500];
    
    return { labels, values };
}

function processCategoryData(categories) {
    // Kategori verilerini işle
    const labels = categories.map(cat => cat.name);
    const values = categories.map(() => Math.floor(Math.random() * 100) + 10);
    
    return { labels, values };
}

function processMonthlySalesData(salesData) {
    // Aylık satış verilerini işle
    const labels = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz'];
    const values = [15000, 18000, 22000, 19000, 25000, 28000];
    
    return { labels, values };
}

function processProductPerformanceData(products) {
    // Ürün performans verilerini işle
    const labels = ['Satış', 'Kar', 'Stok', 'Popülerlik', 'Fiyat'];
    const values = [80, 70, 60, 90, 75];
    
    return { labels, values };
}

function processProfitAnalysisData(salesData) {
    // Kar analizi verilerini işle
    const labels = ['1. Hafta', '2. Hafta', '3. Hafta', '4. Hafta'];
    const values = [5000, 7500, 6200, 8800];
    
    return { labels, values };
}

function processWeeklyTrendData(salesData) {
    // Haftalık trend verilerini işle
    const labels = ['1. Hafta', '2. Hafta', '3. Hafta', '4. Hafta'];
    const values = [12000, 15000, 18000, 22000];
    
    return { labels, values };
}

// Grafik güncelleme fonksiyonları
async function updateCharts() {
    console.log('📊 Grafikler güncelleniyor...');
    
    const timeFilter = document.getElementById('timeFilter')?.value || 'month';
    const typeFilter = document.getElementById('typeFilter')?.value || 'all';
    
    console.log('Filtreler:', { timeFilter, typeFilter });
    
    // Tüm grafikleri yeniden oluştur
    await initializeCharts();
}

async function refreshChart(chartType) {
    console.log(`📊 ${chartType} grafiği yenileniyor...`);
    
    // Belirli grafik türünü yenile
    switch(chartType) {
        case 'salesTrend':
            await createSalesTrendChart();
            break;
        case 'categoryDistribution':
            await createCategoryChart();
            break;
        case 'monthlySales':
            await createMonthlySalesChart();
            break;
        case 'productPerformance':
            await createProductPerformanceChart();
            break;
        case 'profitAnalysis':
            await createProfitAnalysisChart();
            break;
        case 'weeklyTrend':
            await createWeeklyTrendChart();
            break;
    }
}

// Tüm grafikleri yenile
async function refreshAllCharts() {
    console.log('📊 Tüm grafikler yenileniyor...');
    await initializeCharts();
}

// Global fonksiyonları window'a ekle
window.updateCharts = updateCharts;
window.refreshChart = refreshChart;
window.refreshAllCharts = refreshAllCharts;
window.loadChartsContent = loadChartsContent;
