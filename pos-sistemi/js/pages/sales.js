// Sales sayfası modülü
console.log('🛒 Sales modülü yüklendi');

// ===== SALES YÖNETİMİ =====

// Sales içeriğini yükle
async function loadSalesContent() {
    console.log('🛒 Sales içeriği yükleniyor...');
    
    try {
        // Sales container'ını bul
        const salesContent = document.querySelector('.sales-content');
        if (!salesContent) {
            console.error('❌ Sales container bulunamadı');
            return;
        }
        // Yeni minimal satış sayfasını yaz ve çık
        const fresh = `
            <div class="sales-page">
                <div class="simple-search">
                    <div class="simple-search-input" id="simpleSearch">
                        <i class="fas fa-search"></i>
                        <input id="productSearchInput" type="text" placeholder="Ürün ara / Barkod ara" onfocus="document.getElementById('simpleSearch').classList.add('focus')" onblur="document.getElementById('simpleSearch').classList.remove('focus')" onkeyup="searchProductsForSale()" />
                    </div>
                </div>
                <div class="simple-sales-grid">
                    <div class="simple-cart" id="cartPanel">
                        <div class="simple-cart-header">
                            <span>Sepet</span>
                            <div class="simple-cart-actions">
                                <button class="icon-btn" title="Ekran" onclick="toggleCartView()"><i class="fas fa-desktop"></i></button>
                                <button class="icon-btn danger" title="Sepeti Temizle" onclick="clearSale()"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                        <div class="simple-cart-body" id="cartItems">
                            <div class="no-items">Sepet boş</div>
                        </div>
                    </div>
                    <div class="simple-payment" id="paymentPanel">
                        <div class="simple-payment-header">Ödeme</div>
                        <div class="simple-payment-body">
                            <div class="summary-row"><span>Ara Toplam</span><span id="subtotal">₺0.00</span></div>
                            <div class="summary-row"><span>KDV</span><span id="tax">₺0.00</span></div>
                            <div class="summary-row" id="discountRow" style="display:none"><span>İndirim</span><span id="discount">-₺0.00</span></div>
                            <div class="summary-row total"><span>Toplam</span><span id="grandTotal">₺0.00</span></div>
                        </div>
                        <div class="simple-actions">
                            <button class="btn-complete" onclick="completeSale()">Satışı Tamamla</button>
                            <div class="options-wrapper">
                                <button class="btn-options" onclick="showOptions(event)">Seçenekler</button>
                                <div class="options-menu" id="optionsMenu" style="display:none">
                                    <button onclick="setPaymentMethod('cash')"><i class="fas fa-money-bill-wave"></i> Nakit</button>
                                    <button onclick="setPaymentMethod('transfer')"><i class="fas fa-university"></i> Havale</button>
                                    <button onclick="applyDiscountPrompt()"><i class="fas fa-percentage"></i> İndirim</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        salesContent.innerHTML = fresh;
        console.log('✅ Sales (minimal) yüklendi');
        return;
        
        // Sales içeriğini oluştur (eski yapı - ulaşılamaz)
        const content = `
            <div class="sales-page">
                <!-- Modern Satış Header -->
                <div class="sales-header-modern">
                    <div class="header-left">
                        <div class="sale-info">
                            <h2>Yeni Satış</h2>
                            <div class="sale-details">
                                <span class="sale-id">Satış #${Date.now().toString().slice(-6)}</span>
                                <span class="sale-date">${new Date().toLocaleDateString('tr-TR')}</span>
                            </div>
                        </div>
                    </div>
                    <div class="header-right">
                        <button class="btn-modern btn-clear" onclick="clearSale()">
                            <i class="fas fa-trash-alt"></i>
                            <span>Temizle</span>
                        </button>
                        <button class="btn-modern btn-save" onclick="saveSale()">
                            <i class="fas fa-save"></i>
                            <span>Kaydet</span>
                        </button>
                    </div>
                </div>

                <!-- Gelişmiş Arama Barı -->
                <div class="search-section-modern">
                    <div class="search-container-modern">
                        <div class="search-input-modern">
                            <div class="search-icon-modern">
                                <i class="fas fa-search"></i>
                            </div>
                            <input type="text" id="productSearchInput" placeholder="Ürün ara... (barkod, isim veya kategori)" onkeyup="searchProductsForSale()" onfocus="showSearchSuggestions()" onblur="hideSearchSuggestions()">
                            <button class="btn-clear-search-modern" onclick="clearSearch()" style="display: none;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="search-filters">
                            <select id="categoryFilter" onchange="filterByCategory()">
                                <option value="">Tüm Kategoriler</option>
                            </select>
                            <select id="brandFilter" onchange="filterByBrand()">
                                <option value="">Tüm Markalar</option>
                            </select>
                        </div>
                        <div id="searchSuggestions" class="search-suggestions-modern">
                            <!-- Arama önerileri buraya gelecek -->
                        </div>
                    </div>
                </div>

                <div class="sales-layout-modern">
                    <!-- Sol Panel - Modern Sepet Kartı -->
                    <div class="sales-left-modern">
                        <div class="cart-card-modern">
                            <div class="cart-header-modern">
                                <div class="cart-title">
                                    <i class="fas fa-shopping-cart"></i>
                                    <h3>Sepet</h3>
                                </div>
                                <div class="cart-stats">
                                    <span class="cart-count" id="cartCount">0 ürün</span>
                                    <span class="cart-total" id="cartTotal">₺0.00</span>
                                </div>
                            </div>
                            <div class="cart-content-modern">
                                <div class="cart-items-modern" id="cartItems">
                                    <div class="no-items-modern">
                                        <div class="empty-cart-icon">
                                            <i class="fas fa-shopping-basket"></i>
                                        </div>
                                        <h4>Sepet Boş</h4>
                                        <p>Ürün arayıp sepete ekleyin</p>
                                        <div class="empty-cart-tips">
                                            <span>💡 İpucu: Barkod okuyucu kullanabilirsiniz</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Sağ Panel - Modern Ödeme Kartı -->
                    <div class="sales-right-modern">
                        <div class="payment-card-modern">
                            <div class="payment-header-modern">
                                <div class="payment-title">
                                    <i class="fas fa-credit-card"></i>
                                    <h3>Ödeme</h3>
                                </div>
                                <div class="payment-status">
                                    <span class="status-indicator" id="paymentStatus">Hazır</span>
                                </div>
                            </div>
                            <div class="payment-content-modern">
                                <!-- Ödeme Özeti -->
                                <div class="payment-summary-modern">
                                    <h5>
                                        <i class="fas fa-calculator"></i>
                                        Ödeme Özeti
                                    </h5>
                                    <div class="summary-rows-modern">
                                        <div class="summary-row-modern">
                                            <span>Ara Toplam:</span>
                                            <span id="subtotal">₺0.00</span>
                                        </div>
                                        <div class="summary-row-modern">
                                            <span>KDV (%18):</span>
                                            <span id="tax">₺0.00</span>
                                        </div>
                                        <div class="summary-row-modern total-modern">
                                            <span>Toplam:</span>
                                            <span id="grandTotal">₺0.00</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Aksiyon Butonları -->
                                <div class="action-buttons-modern">
                                    <button class="btn-modern btn-options" onclick="showOptions()">
                                        <i class="fas fa-cog"></i>
                                        <span>Seçenekler</span>
                                    </button>
                                    <button class="btn-modern btn-complete" onclick="completeSale()">
                                        <i class="fas fa-check"></i>
                                        <span>Satışı Tamamla</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Ödeme Seçenekleri Modal -->
                <div id="paymentOptionsModal" class="payment-modal" style="display: none;">
                    <div class="payment-modal-content">
                        <div class="payment-modal-header">
                            <h3>
                                <i class="fas fa-credit-card"></i>
                                Ödeme Seçenekleri
                            </h3>
                            <button class="close-modal" onclick="closePaymentOptions()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="payment-modal-body">
                            <!-- Ödeme Yöntemi -->
                            <div class="payment-method-section-modal">
                                <h5>
                                    <i class="fas fa-credit-card"></i>
                                    Ödeme Yöntemi
                                </h5>
                                <div class="payment-methods-modal">
                                    <label class="payment-option-modal">
                                        <input type="radio" name="paymentMethod" value="cash" checked>
                                        <div class="payment-option-content-modal">
                                            <div class="payment-icon-modal">
                                                <i class="fas fa-money-bill-wave"></i>
                                            </div>
                                            <span>Nakit</span>
                                        </div>
                                    </label>
                                    <label class="payment-option-modal">
                                        <input type="radio" name="paymentMethod" value="card">
                                        <div class="payment-option-content-modal">
                                            <div class="payment-icon-modal">
                                                <i class="fas fa-credit-card"></i>
                                            </div>
                                            <span>Kart</span>
                                        </div>
                                    </label>
                                    <label class="payment-option-modal">
                                        <input type="radio" name="paymentMethod" value="mixed">
                                        <div class="payment-option-content-modal">
                                            <div class="payment-icon-modal">
                                                <i class="fas fa-coins"></i>
                                            </div>
                                            <span>Karışık</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <!-- Ödeme Tutarı -->
                            <div class="amount-section-modal">
                                <h5>
                                    <i class="fas fa-money-bill"></i>
                                    Ödeme Tutarı
                                </h5>
                                <div class="amount-input-modal">
                                    <span class="currency-modal">₺</span>
                                    <input type="number" id="amountReceived" placeholder="0.00" step="0.01" onchange="calculateChange()" class="input-modal">
                                </div>
                                <div class="change-display-modal" id="changeDisplay" style="display: none;">
                                    <div class="change-info-modal">
                                        <i class="fas fa-coins"></i>
                                        <span>Para Üstü: <strong id="changeAmount">₺0.00</strong></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="payment-modal-footer">
                            <button class="btn-modern btn-cancel" onclick="closePaymentOptions()">
                                <i class="fas fa-times"></i>
                                <span>İptal</span>
                            </button>
                            <button class="btn-modern btn-confirm" onclick="confirmPayment()">
                                <i class="fas fa-check"></i>
                                <span>Onayla</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // İçeriği ekle
        salesContent.innerHTML = content;
        
        // Verileri yükle
        await loadCategoriesForSale();
        
        console.log('✅ Sales içeriği yüklendi');
        
    } catch (error) {
        console.error('❌ Sales içerik yükleme hatası:', error);
    }
}

// Satış için kategorileri yükle
async function loadCategoriesForSale() {
    console.log('📊 Satış kategorileri yükleniyor...');
    
    try {
        const categories = await window.posAPI.getCategories();
        const categoryList = document.getElementById('categoryList');
        
        if (categoryList) {
            categoryList.innerHTML = categories.map(cat => `
                <button class="category-btn" onclick="filterByCategory('${cat.id}')">
                    ${cat.name}
                </button>
            `).join('');
        }
        
        console.log('✅ Satış kategorileri yüklendi');
        
    } catch (error) {
        console.error('❌ Satış kategorileri yükleme hatası:', error);
    }
}

// Ürün arama
async function searchProductsForSale() {
    const searchTerm = document.getElementById('productSearchInput')?.value || '';
    const clearBtn = document.querySelector('.btn-clear-search');
    
    console.log('🔍 Ürün aranıyor:', searchTerm);
    
    // Clear butonunu göster/gizle
    if (clearBtn) {
        clearBtn.style.display = searchTerm.length > 0 ? 'block' : 'none';
    }
    
    if (searchTerm.length < 2) {
        hideSearchSuggestions();
        return;
    }
    
    try {
        const products = await window.posAPI.getProducts(searchTerm);
        showSearchSuggestions(products, searchTerm);
        
    } catch (error) {
        console.error('❌ Ürün arama hatası:', error);
    }
}

// Arama önerilerini göster
function showSearchSuggestions(products = [], searchTerm = '') {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (!suggestionsContainer) return;
    
    if (products.length === 0 && searchTerm.length >= 2) {
        suggestionsContainer.innerHTML = `
            <div class="suggestion-item no-results">
                <i class="fas fa-search"></i>
                <span>"${searchTerm}" için ürün bulunamadı</span>
            </div>
        `;
        suggestionsContainer.style.display = 'block';
        return;
    }
    
    if (products.length === 0) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    suggestionsContainer.innerHTML = products.map(product => `
        <div class="suggestion-item" onclick="addProductToSale(${product.id}, '${product.name}', ${product.price})">
            <div class="suggestion-info">
                <h6>${product.name}</h6>
                <p>${product.category_name || 'Kategori Yok'}</p>
            </div>
            <div class="suggestion-price">
                <span>₺${product.price.toFixed(2)}</span>
                <span class="stock-badge ${getStockStatus(product.stock)}">${product.stock}</span>
            </div>
        </div>
    `).join('');
    
    suggestionsContainer.style.display = 'block';
}

// Arama önerilerini gizle
function hideSearchSuggestions() {
    setTimeout(() => {
        const suggestionsContainer = document.getElementById('searchSuggestions');
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }
    }, 200);
}

// Arama temizle
function clearSearch() {
    const searchInput = document.getElementById('productSearchInput');
    const clearBtn = document.querySelector('.btn-clear-search');
    const suggestionsContainer = document.getElementById('searchSuggestions');
    
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    if (suggestionsContainer) suggestionsContainer.style.display = 'none';
}

// Stok durumu belirleme
function getStockStatus(stock) {
    if (stock === 0) return 'out-of-stock';
    if (stock <= 10) return 'low-stock';
    return 'in-stock';
}

// Kategoriye göre filtreleme
async function filterByCategory(categoryId) {
    console.log('🔍 Kategori filtresi:', categoryId);
    
    try {
        const products = await window.posAPI.getProducts('', categoryId);
        const searchResults = document.getElementById('searchResults');
        
        if (products.length === 0) {
            searchResults.innerHTML = '<div class="no-results">Bu kategoride ürün bulunamadı</div>';
            return;
        }
        
        searchResults.innerHTML = products.map(product => `
            <div class="product-item" onclick="addProductToSale(${product.id}, '${product.name}', ${product.price})">
                <div class="product-info">
                    <h5>${product.name}</h5>
                    <p>${product.category_name || 'Kategori Yok'}</p>
                </div>
                <div class="product-price">
                    <span>₺${product.price.toFixed(2)}</span>
                    <span class="stock-info">Stok: ${product.stock}</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('❌ Kategori filtreleme hatası:', error);
    }
}

// Sepet yönetimi
let cart = [];

// Ürünü sepete ekle
function addProductToSale(productId, productName, price) {
    console.log('🛒 Ürün sepete ekleniyor:', productId, productName, price);
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: productId,
            name: productName,
            price: price,
            quantity: 1
        });
    }
    
    updateCartDisplay();
}

// Sepet görünümünü güncelle
function updateCartDisplay() {
    const cartItems = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const subtotal = document.getElementById('subtotal');
    const tax = document.getElementById('tax');
    const grandTotal = document.getElementById('grandTotal');
    
    // Sepet sayısını güncelle
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount) {
        cartCount.textContent = `${totalItems} ürün`;
    }
    
    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="no-items">
                <i class="fas fa-shopping-basket"></i>
                <p>Sepet boş</p>
                <span>Ürün arayıp sepete ekleyin</span>
            </div>
        `;
        if (subtotal) subtotal.textContent = '₺0.00';
        if (tax) tax.textContent = '₺0.00';
        if (grandTotal) grandTotal.textContent = '₺0.00';
        return;
    }
    
    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="item-info">
                <h6>${item.name}</h6>
                <span class="item-price">₺${item.price.toFixed(2)}</span>
            </div>
            <div class="item-controls">
                <button class="qty-btn" onclick="updateQuantity(${item.id}, -1)">
                    <i class="fas fa-minus"></i>
                </button>
                <span class="qty-display">${item.quantity}</span>
                <button class="qty-btn" onclick="updateQuantity(${item.id}, 1)">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="remove-btn" onclick="removeFromCart(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    const subtotalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxAmount = subtotalAmount * 0.18;
    const totalAmount = subtotalAmount + taxAmount;
    
    if (subtotal) subtotal.textContent = `₺${subtotalAmount.toFixed(2)}`;
    if (tax) tax.textContent = `₺${taxAmount.toFixed(2)}`;
    if (grandTotal) grandTotal.textContent = `₺${totalAmount.toFixed(2)}`;
}

// Miktar güncelleme
function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            updateCartDisplay();
        }
    }
}

// Sepetten çıkar
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartDisplay();
}

// Sepeti temizle
function clearSale() {
    if (confirm('Sepeti temizlemek istediğinizden emin misiniz?')) {
        cart = [];
        updateCartDisplay();
        document.getElementById('productSearchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('customerNotes').value = '';
        document.getElementById('amountReceived').value = '';
        document.getElementById('changeAmount').value = '';
    }
}

// Satışı tamamla
async function completeSale() {
    if (cart.length === 0) {
        alert('Sepet boş! Lütfen ürün ekleyin.');
        return;
    }
    
    const customerName = document.getElementById('customerName')?.value || '';
    const customerPhone = document.getElementById('customerPhone')?.value || '';
    const customerNotes = document.getElementById('customerNotes')?.value || '';
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cash';
    const amountReceived = parseFloat(document.getElementById('amountReceived')?.value || 0);
    
    const subtotalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxAmount = subtotalAmount * 0.18;
    const totalAmount = subtotalAmount + taxAmount;
    
    if (amountReceived < totalAmount) {
        alert('Alınan tutar yetersiz!');
        return;
    }
    
    console.log('💳 Satış tamamlanıyor...');
    
    try {
        const saleData = {
            customer_name: customerName,
            customer_phone: customerPhone,
            notes: customerNotes,
            payment_method: paymentMethod,
            subtotal: subtotalAmount,
            tax: taxAmount,
            total: totalAmount,
            amount_received: amountReceived,
            change: amountReceived - totalAmount,
            items: cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                price: item.price
            }))
        };
        
        await window.posAPI.addSale(saleData);
        
        // Başarı mesajı
        alert(`Satış başarıyla tamamlandı!\nToplam: ₺${totalAmount.toFixed(2)}\nPara Üstü: ₺${(amountReceived - totalAmount).toFixed(2)}`);
        
        // Sepeti temizle
        clearSale();
        
        console.log('✅ Satış tamamlandı');
        
    } catch (error) {
        console.error('❌ Satış tamamlama hatası:', error);
        alert('Satış tamamlanırken hata oluştu!');
    }
}

// Para üstü hesaplama
function calculateChange() {
    const amountReceived = parseFloat(document.getElementById('amountReceived')?.value || 0);
    const grandTotal = document.getElementById('grandTotal')?.textContent || '₺0.00';
    const totalAmount = parseFloat(grandTotal.replace('₺', '').replace(',', ''));
    
    const changeAmount = amountReceived - totalAmount;
    const changeInput = document.getElementById('changeAmount');
    
    if (changeInput) {
        changeInput.value = changeAmount > 0 ? changeAmount.toFixed(2) : '0.00';
    }
}

// Seçenekler menüsü
function showOptions(e) {
    const menu = document.getElementById('optionsMenu');
    if (!menu) return;
    const isOpen = menu.style.display === 'block';
    menu.style.display = isOpen ? 'none' : 'block';
}

let currentPaymentMethod = 'cash';
let manualDiscount = 0;

function setPaymentMethod(method) {
    currentPaymentMethod = method;
    const menu = document.getElementById('optionsMenu');
    if (menu) menu.style.display = 'none';
}

function applyDiscountPrompt() {
    const input = prompt('İndirim tutarını girin (₺):', '0');
    if (input === null) return;
    const value = parseFloat(input.replace(',', '.')) || 0;
    manualDiscount = Math.max(0, value);
    const subtotalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxAmount = subtotalAmount * 0.18;
    let totalAmount = subtotalAmount + taxAmount - manualDiscount;
    if (totalAmount < 0) totalAmount = 0;
    const discountRow = document.getElementById('discountRow');
    const discountText = document.getElementById('discount');
    if (discountRow) discountRow.style.display = manualDiscount > 0 ? 'flex' : 'none';
    if (discountText) discountText.textContent = `-₺${manualDiscount.toFixed(2)}`;
    document.getElementById('subtotal').textContent = `₺${subtotalAmount.toFixed(2)}`;
    document.getElementById('tax').textContent = `₺${taxAmount.toFixed(2)}`;
    document.getElementById('grandTotal').textContent = `₺${totalAmount.toFixed(2)}`;
    const menu = document.getElementById('optionsMenu');
    if (menu) menu.style.display = 'none';
}

function toggleCartView() {
    // Basit bir placeholder davranış: grid oranını terse çevir
    const grid = document.querySelector('.simple-sales-grid');
    if (!grid) return;
    const isWide = grid.style.gridTemplateColumns === '1fr 2fr';
    grid.style.gridTemplateColumns = isWide ? '2fr 1fr' : '1fr 2fr';
}

// Ödeme seçeneklerini göster
function showPaymentOptions() {
    console.log('💳 Ödeme seçenekleri gösteriliyor...');
    const modal = document.getElementById('paymentOptionsModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Ödeme seçeneklerini kapat
function closePaymentOptions() {
    console.log('❌ Ödeme seçenekleri kapatılıyor...');
    const modal = document.getElementById('paymentOptionsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Ödeme onayla
function confirmPayment() {
    console.log('✅ Ödeme onaylanıyor...');
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked');
    const amount = document.getElementById('amountReceived').value;
    
    if (selectedMethod && amount) {
        console.log(`Ödeme yöntemi: ${selectedMethod.value}, Tutar: ${amount}`);
        closePaymentOptions();
        // TODO: Ödeme işlemi
    } else {
        alert('Lütfen ödeme yöntemi seçin ve tutar girin.');
    }
}

// Global fonksiyonları window'a ekle
window.loadSalesContent = loadSalesContent;
window.searchProductsForSale = searchProductsForSale;
window.showSearchSuggestions = showSearchSuggestions;
window.hideSearchSuggestions = hideSearchSuggestions;
window.clearSearch = clearSearch;
window.filterByCategory = filterByCategory;
window.addProductToSale = addProductToSale;
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
window.clearSale = clearSale;
window.completeSale = completeSale;
window.calculateChange = calculateChange;
window.showOptions = showOptions;
window.showPaymentOptions = showPaymentOptions;
window.closePaymentOptions = closePaymentOptions;
window.confirmPayment = confirmPayment;