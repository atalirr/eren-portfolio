// Dashboard sayfası modülü
console.log('📊 Dashboard modülü yüklendi');

// ===== DASHBOARD YÖNETİMİ =====

// Dashboard içeriğini yükle
async function loadDashboardContent() {
    console.log('📊 Dashboard içeriği yükleniyor...');
    
    try {
        // Dashboard container'ını bul
        const dashboardContent = document.querySelector('.dashboard-content');
        if (!dashboardContent) {
            console.error('❌ Dashboard container bulunamadı');
            return;
        }
        
        // Dashboard içeriğini oluştur
        const content = `
            <div class="dashboard-page">
                <!-- Dashboard İstatistikleri -->
                <div class="dashboard-stats">
                    <div class="stat-card visa-blue">
                        <div class="stat-icon">
                            <i class="fas fa-shopping-cart"></i>
                        </div>
                        <div class="stat-content">
                            <h3 id="totalSales">₺0</h3>
                            <p>Toplam Satış</p>
                            <div class="stat-trend">
                                <i class="fas fa-arrow-up"></i>
                                <span>+0%</span>
                            </div>
                        </div>
                    </div>
                    <div class="stat-card mc-red">
                        <div class="stat-icon">
                            <i class="fas fa-box"></i>
                        </div>
                        <div class="stat-content">
                            <h3 id="totalProducts">0</h3>
                            <p>Toplam Ürün</p>
                            <div class="stat-trend">
                                <i class="fas fa-minus"></i>
                                <span>0%</span>
                            </div>
                        </div>
                    </div>
                    <div class="stat-card mc-orange">
                        <div class="stat-icon">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div class="stat-content">
                            <h3 id="totalProfit">₺0</h3>
                            <p>Toplam Kar</p>
                            <div class="stat-trend">
                                <i class="fas fa-arrow-up"></i>
                                <span>+0%</span>
                            </div>
                        </div>
                    </div>
                    <div class="stat-card mc-yellow">
                        <div class="stat-icon">
                            <i class="fas fa-receipt"></i>
                        </div>
                        <div class="stat-content">
                            <h3 id="totalTransactions">0</h3>
                            <p>Toplam İşlem</p>
                            <div class="stat-trend">
                                <i class="fas fa-arrow-up"></i>
                                <span>+0%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Dashboard Grafikleri -->
                <div class="dashboard-charts">
                    <div class="chart-container">
                        <div class="chart-header">
                            <h3>Günlük Satış Trendi</h3>
                            <div class="chart-controls">
                                <select id="chartPeriod" onchange="updateDashboardChart()">
                                    <option value="7">Son 7 Gün</option>
                                    <option value="30" selected>Son 30 Gün</option>
                                    <option value="90">Son 90 Gün</option>
                                </select>
                            </div>
                        </div>
                        <canvas id="dashboardChart" width="400" height="200"></canvas>
                    </div>
                </div>

                <!-- Son Aktiviteler -->
                <div class="recent-activities">
                    <div class="activity-header">
                        <h3>Son Aktiviteler</h3>
                        <button class="btn-refresh" onclick="refreshActivities()">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                    <div class="activity-list" id="activityList">
                        <div class="no-data">Aktivite yükleniyor...</div>
                    </div>
                </div>

                <!-- Hızlı İşlemler -->
                <div class="quick-actions">
                    <h3>Hızlı İşlemler</h3>
                    <div class="action-buttons">
                        <button class="action-btn" onclick="showTab('sales')">
                            <i class="fas fa-shopping-cart"></i>
                            <span>Yeni Satış</span>
                        </button>
                        <button class="action-btn" onclick="showTab('products')">
                            <i class="fas fa-plus"></i>
                            <span>Ürün Ekle</span>
                        </button>
                        <button class="action-btn" onclick="showTab('reports')">
                            <i class="fas fa-chart-bar"></i>
                            <span>Rapor Görüntüle</span>
                        </button>
                        <button class="action-btn" onclick="showTab('charts')">
                            <i class="fas fa-chart-pie"></i>
                            <span>Grafikler</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // İçeriği ekle
        dashboardContent.innerHTML = content;
        
        // Dashboard verilerini yükle
        await loadDashboardData();
        await loadRecentActivities();
        await createDashboardChart();
        
        console.log('✅ Dashboard içeriği yüklendi');
        
    } catch (error) {
        console.error('❌ Dashboard içerik yükleme hatası:', error);
    }
}

// Dashboard verilerini yükle
async function loadDashboardData() {
    console.log('📊 Dashboard verileri yükleniyor...');
    
    try {
        const sales = await window.posAPI.getSales();
        const products = await window.posAPI.getProducts();
        
        // İstatistikleri hesapla
        const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
        const totalProducts = products.length;
        const totalTransactions = sales.length;
        const totalProfit = sales.reduce((sum, sale) => sum + (sale.total * 0.2), 0); // %20 kar varsayımı
        
        // İstatistikleri güncelle
        updateStatCard('totalSales', `₺${totalSales.toFixed(2)}`);
        updateStatCard('totalProducts', totalProducts.toString());
        updateStatCard('totalProfit', `₺${totalProfit.toFixed(2)}`);
        updateStatCard('totalTransactions', totalTransactions.toString());
        
        console.log('✅ Dashboard verileri yüklendi');
        
    } catch (error) {
        console.error('❌ Dashboard verileri yükleme hatası:', error);
    }
}

// İstatistik kartını güncelle
function updateStatCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

// Son aktiviteleri yükle
async function loadRecentActivities() {
    console.log('📊 Son aktiviteler yükleniyor...');
    
    try {
        const sales = await window.posAPI.getSales();
        const activityList = document.getElementById('activityList');
        
        if (!activityList) return;
        
        if (sales.length === 0) {
            activityList.innerHTML = '<div class="no-data">Henüz aktivite yok</div>';
            return;
        }
        
        // Son 5 satışı göster
        const recentSales = sales.slice(0, 5);
        
        activityList.innerHTML = recentSales.map(sale => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-shopping-cart"></i>
                </div>
                <div class="activity-content">
                    <h4>Yeni Satış</h4>
                    <p>${sale.customer_name || 'Müşteri Yok'} - ₺${sale.total.toFixed(2)}</p>
                    <span class="activity-time">${new Date(sale.created_at).toLocaleString('tr-TR')}</span>
                </div>
            </div>
        `).join('');
        
        console.log('✅ Son aktiviteler yüklendi');
        
    } catch (error) {
        console.error('❌ Son aktiviteler yükleme hatası:', error);
    }
}

// Dashboard grafiğini oluştur
async function createDashboardChart() {
    console.log('📊 Dashboard grafiği oluşturuluyor...');
    
    try {
        const ctx = document.getElementById('dashboardChart');
        if (!ctx) return;
        
        const sales = await window.posAPI.getSales();
        
        // Son 30 günün verilerini hazırla
        const last30Days = [];
        const today = new Date();
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            last30Days.push({
                date: date.toISOString().split('T')[0],
                sales: 0
            });
        }
        
        // Satış verilerini günlere dağıt
        sales.forEach(sale => {
            const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
            const dayData = last30Days.find(day => day.date === saleDate);
            if (dayData) {
                dayData.sales += sale.total;
            }
        });
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: last30Days.map(day => new Date(day.date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })),
                datasets: [{
                    label: 'Günlük Satış',
                    data: last30Days.map(day => day.sales),
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
        
        console.log('✅ Dashboard grafiği oluşturuldu');
        
    } catch (error) {
        console.error('❌ Dashboard grafiği oluşturma hatası:', error);
    }
}

// Dashboard grafiğini güncelle
function updateDashboardChart() {
    console.log('📊 Dashboard grafiği güncelleniyor...');
    createDashboardChart();
}

// Aktiviteleri yenile
function refreshActivities() {
    console.log('🔄 Aktiviteler yenileniyor...');
    loadRecentActivities();
}

// Global fonksiyonları window'a ekle
window.loadDashboardContent = loadDashboardContent;
window.updateDashboardChart = updateDashboardChart;
window.refreshActivities = refreshActivities;