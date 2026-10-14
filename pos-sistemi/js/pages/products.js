// Products sayfası modülü
console.log('📦 Products modülü yüklendi');

// ===== PRODUCTS YÖNETİMİ =====

// Products içeriğini yükle
async function loadProductsContent() {
    console.log('📦 Products içeriği yükleniyor...');
    
    try {
        // Products container'ını bul
        const productsContent = document.querySelector('.products-content');
        if (!productsContent) {
            console.error('❌ Products container bulunamadı');
            return;
        }
        
        // Products içeriğini oluştur
        const content = `
            <div class="products-page">
                <!-- Ürün Yönetimi Header -->
                <div class="products-header">
                    <div class="header-actions">
                        <button class="btn-primary" onclick="openAddProductModal()">
                            <i class="fas fa-plus"></i>
                            Yeni Ürün Ekle
                        </button>
                        <button class="btn-secondary" onclick="exportProducts()">
                            <i class="fas fa-download"></i>
                            Dışa Aktar
                        </button>
                    </div>
                </div>

                <!-- Arama ve Filtreler -->
                <div class="products-filters">
                    <div class="search-group">
                        <input type="text" id="productSearch" placeholder="Ürün ara..." onkeyup="searchProducts()">
                        <button class="btn-search" onclick="searchProducts()">
                            <i class="fas fa-search"></i>
                        </button>
                    </div>
                    <div class="filter-group">
                        <select id="categoryFilter" onchange="filterByCategory()">
                            <option value="">Tüm Kategoriler</option>
                        </select>
                        <select id="stockFilter" onchange="filterByStock()">
                            <option value="">Tüm Stoklar</option>
                            <option value="in-stock">Stokta Var</option>
                            <option value="low-stock">Düşük Stok</option>
                            <option value="out-of-stock">Stokta Yok</option>
                        </select>
                    </div>
                </div>

                <!-- Ürün Tablosu -->
                <div class="products-table-container">
                    <table class="products-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Ürün Adı</th>
                                <th>Kategori</th>
                                <th>Fiyat</th>
                                <th>Stok</th>
                                <th>Durum</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody id="productsTableBody">
                            <tr>
                                <td colspan="7" class="no-data">Ürün yükleniyor...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Pagination -->
                <div class="pagination">
                    <button class="btn-pagination" onclick="previousPage()">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <span id="pageInfo">Sayfa 1 / 1</span>
                    <button class="btn-pagination" onclick="nextPage()">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>

            <!-- Ürün Ekleme Modal -->
            <div id="addProductModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Yeni Ürün Ekle</h3>
                        <button class="modal-close" onclick="closeAddProductModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="addProductForm">
                            <div class="form-group">
                                <label for="productName">Ürün Adı *</label>
                                <input type="text" id="productName" required>
                            </div>
                            <div class="form-group">
                                <label for="productCategory">Kategori *</label>
                                <select id="productCategory" required>
                                    <option value="">Kategori Seçin</option>
                                </select>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="productPrice">Fiyat (₺) *</label>
                                    <input type="number" id="productPrice" step="0.01" required>
                                </div>
                                <div class="form-group">
                                    <label for="productStock">Stok Miktarı *</label>
                                    <input type="number" id="productStock" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="productDescription">Açıklama</label>
                                <textarea id="productDescription" rows="3"></textarea>
                            </div>
                            <div class="form-group">
                                <label for="productBarcode">Barkod</label>
                                <input type="text" id="productBarcode">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="closeAddProductModal()">İptal</button>
                        <button class="btn-primary" onclick="saveProduct()">Kaydet</button>
                    </div>
                </div>
            </div>
        `;
        
        // İçeriği ekle
        productsContent.innerHTML = content;
        
        // Verileri yükle
        await loadProductsData();
        await loadCategories();
        
        console.log('✅ Products içeriği yüklendi');
        
    } catch (error) {
        console.error('❌ Products içerik yükleme hatası:', error);
    }
}

// Ürün verilerini yükle
async function loadProductsData() {
    console.log('📊 Ürün verileri yükleniyor...');
    
    try {
        const products = await window.posAPI.getProducts();
        const tbody = document.getElementById('productsTableBody');
        
        if (!tbody) return;
        
        if (products.length === 0) {
            console.log('ℹ️ Ürün yok, örnek veriler eklenecek...');
            await seedSampleProductsAndSales();
            const reloaded = await window.posAPI.getProducts();
            if (!reloaded || reloaded.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="no-data">Henüz ürün eklenmemiş</td></tr>';
                return;
            }
            renderProductsTable(reloaded, tbody);
            // Grafikler sayfasını tazele
            if (window.updateCharts) {
                try { window.updateCharts(); } catch (e) { console.warn('Charts güncellenemedi:', e); }
            }
            console.log('✅ Örnek veriler eklendi');
            return;
        }
        renderProductsTable(products, tbody);
        
        console.log('✅ Ürün verileri yüklendi');
        
    } catch (error) {
        console.error('❌ Ürün verileri yükleme hatası:', error);
    }
}

// Tabloyu render eden yardımcı fonksiyon
function renderProductsTable(products, tbody) {
    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>${product.category_name || 'Kategori Yok'}</td>
            <td>₺${Number(product.price).toFixed(2)}</td>
            <td>${product.stock}</td>
            <td>
                <span class="stock-status ${getStockStatus(product.stock)}">
                    ${getStockStatusText(product.stock)}
                </span>
            </td>
            <td>
                <button class="btn-edit" onclick="editProduct(${product.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-delete" onclick="deleteProduct(${product.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Ürünler boşsa örnek ürün ve satış verisi ekle
async function seedSampleProductsAndSales() {
    try {
        const samples = [
            { name: 'Cerrahi Maske 50li', barcode: 'MSK-0001', price: 89.90, cost: 45.00, stock: 120, brand: 'MediCare', size: '' },
            { name: 'Eldiven Nitril M', barcode: 'ELD-0002', price: 149.90, cost: 80.00, stock: 80, brand: 'SafeTouch', size: 'M' },
            { name: 'Dezenfektan 1L', barcode: 'DZF-0003', price: 129.90, cost: 70.00, stock: 60, brand: 'CleanPro', size: '1L' },
            { name: 'Bandaj Elastik', barcode: 'BDJ-0004', price: 39.90, cost: 18.00, stock: 150, brand: 'Flexi', size: '10cm' }
        ];

        const inserted = [];
        for (const s of samples) {
            const payload = {
                name: s.name,
                barcode: s.barcode,
                category_id: 1,
                price: s.price,
                cost: s.cost,
                stock: s.stock,
                min_stock: 5,
                description: '',
                size: s.size,
                brand: s.brand
            };
            let res;
            if (window.posAPI && window.posAPI.addProduct) res = await window.posAPI.addProduct(payload);
            else if (window.addProduct) res = await window.addProduct(payload);
            if (res && res.id) inserted.push({ id: res.id, ...payload });
        }

        if (inserted.length >= 2) {
            const saleItems = [
                { product_id: inserted[0].id, product_name: inserted[0].name, quantity: 2, unit_price: inserted[0].price, total_price: 2 * inserted[0].price },
                { product_id: inserted[1].id, product_name: inserted[1].name, quantity: 1, unit_price: inserted[1].price, total_price: inserted[1].price }
            ];
            const total = saleItems.reduce((sum, i) => sum + i.total_price, 0);
            const salePayload = {
                customer_name: '',
                customer_phone: '',
                total_amount: total,
                discount_amount: 0,
                tax_amount: 0,
                payment_method: 'cash',
                items: saleItems
            };
            if (window.posAPI && window.posAPI.addSale) await window.posAPI.addSale(salePayload);
            else if (window.addSale) await window.addSale(salePayload);
        }
    } catch (e) {
        console.warn('Örnek veriler eklenirken hata:', e);
    }
}

// Kategorileri yükle
async function loadCategories() {
    console.log('📊 Kategoriler yükleniyor...');
    
    try {
        const categories = await window.posAPI.getCategories();
        const categorySelect = document.getElementById('categoryFilter');
        const productCategorySelect = document.getElementById('productCategory');
        
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Tüm Kategoriler</option>' + 
                categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
        }
        
        if (productCategorySelect) {
            productCategorySelect.innerHTML = '<option value="">Kategori Seçin</option>' + 
                categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
        }
        
        console.log('✅ Kategoriler yüklendi');
        
    } catch (error) {
        console.error('❌ Kategoriler yükleme hatası:', error);
    }
}

// Stok durumu belirleme
function getStockStatus(stock) {
    if (stock === 0) return 'out-of-stock';
    if (stock <= 10) return 'low-stock';
    return 'in-stock';
}

function getStockStatusText(stock) {
    if (stock === 0) return 'Stokta Yok';
    if (stock <= 10) return 'Düşük Stok';
    return 'Stokta Var';
}

// Ürün arama
function searchProducts() {
    const searchTerm = document.getElementById('productSearch')?.value || '';
    console.log('🔍 Ürün aranıyor:', searchTerm);
    // Arama işlemi burada yapılacak
}

// Kategoriye göre filtreleme
function filterByCategory() {
    const categoryId = document.getElementById('categoryFilter')?.value || '';
    console.log('🔍 Kategori filtresi:', categoryId);
    // Filtreleme işlemi burada yapılacak
}

// Stoka göre filtreleme
function filterByStock() {
    const stockFilter = document.getElementById('stockFilter')?.value || '';
    console.log('🔍 Stok filtresi:', stockFilter);
    // Filtreleme işlemi burada yapılacak
}

// Ürün ekleme modal'ını aç
function openAddProductModal() {
    const modal = document.getElementById('addProductModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Ürün ekleme modal'ını kapat
function closeAddProductModal() {
    const modal = document.getElementById('addProductModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('addProductForm')?.reset();
    }
}

// Ürün kaydet
async function saveProduct() {
    console.log('💾 Ürün kaydediliyor...');
    
    try {
        const productData = {
            name: document.getElementById('productName')?.value,
            category_id: document.getElementById('productCategory')?.value,
            price: parseFloat(document.getElementById('productPrice')?.value),
            stock: parseInt(document.getElementById('productStock')?.value),
            description: document.getElementById('productDescription')?.value,
            barcode: document.getElementById('productBarcode')?.value
        };
        
        if (!productData.name || !productData.category_id || !productData.price || !productData.stock) {
            alert('Lütfen tüm zorunlu alanları doldurun!');
            return;
        }
        
        await window.posAPI.addProduct(productData);
        await loadProductsData();
        closeAddProductModal();
        
        console.log('✅ Ürün kaydedildi');
        
    } catch (error) {
        console.error('❌ Ürün kaydetme hatası:', error);
        alert('Ürün kaydedilirken hata oluştu!');
    }
}

// Ürün düzenle
function editProduct(productId) {
    console.log('✏️ Ürün düzenleniyor:', productId);
    // Düzenleme işlemi burada yapılacak
}

// Ürün sil
async function deleteProduct(productId) {
    if (!confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
        return;
    }
    
    console.log('🗑️ Ürün siliniyor:', productId);
    
    try {
        await window.posAPI.deleteProduct(productId);
        await loadProductsData();
        console.log('✅ Ürün silindi');
    } catch (error) {
        console.error('❌ Ürün silme hatası:', error);
        alert('Ürün silinirken hata oluştu!');
    }
}

// Ürünleri dışa aktar
function exportProducts() {
    console.log('📤 Ürünler dışa aktarılıyor...');
    // Dışa aktarma işlemi burada yapılacak
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

// Global fonksiyonları window'a ekle
window.loadProductsContent = loadProductsContent;
window.searchProducts = searchProducts;
window.filterByCategory = filterByCategory;
window.filterByStock = filterByStock;
window.openAddProductModal = openAddProductModal;
window.closeAddProductModal = closeAddProductModal;
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.exportProducts = exportProducts;
window.previousPage = previousPage;
window.nextPage = nextPage;