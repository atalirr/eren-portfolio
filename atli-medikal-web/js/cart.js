/**
 * ATLI MEDİKAL — ALIŞVERİŞ SEPETİ YÖNETİCİSİ (CART MANAGER STATE MACHINE)
 * Sürüm: 3.0.0 (Milestone 3)
 * Persistent localStorage: 'atli_medikal_cart_v1'
 * Serbest Kargo Eşiği: 1.000 ₺
 */

(function (window) {
  'use strict';

  const STORAGE_KEY = 'atli_medikal_cart_v1';
  const FREE_SHIPPING_THRESHOLD = 1000;
  const FLAT_SHIPPING_FEE = 150;

  class CartManager {
    constructor() {
      this.items = [];
      this.freeShippingThreshold = FREE_SHIPPING_THRESHOLD;
      this.flatShippingFee = FLAT_SHIPPING_FEE;
      this.isDrawerOpen = false;
    }

    /**
     * Başlatıcı: LocalStorage'dan yükler ve olay dinleyicilerini bağlar
     */
    init() {
      this.loadFromStorage();
      this.bindEvents();
      this.render();
    }

    /**
     * LocalStorage'dan Sepet Durumunu Yükleme
     */
    loadFromStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.items = parsed.map(item => ({
              id: String(item.id || item.sku || ''),
              title: String(item.title || ''),
              price: Number(item.price) || 0,
              image: String(item.image || 'images/logo.png'),
              quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
              deliveryType: item.deliveryType || 'ankara_same_day'
            })).filter(item => item.id && item.price > 0);
          } else if (parsed && Array.isArray(parsed.items)) {
            this.items = parsed.items;
          }
        }
      } catch (err) {
        console.warn('Atlı Medikal: LocalStorage sepet verisi okunamadı, sıfırlandı.', err);
        this.items = [];
      }
    }

    /**
     * LocalStorage'a Kaydetme
     */
    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
      } catch (err) {
        console.warn('Atlı Medikal: LocalStorage sepet kaydedilemedi.', err);
      }
    }

    /**
     * Finansal Hesaplamalar
     */
    getSubtotal() {
      return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    getShipping(subtotal) {
      if (this.items.length === 0) return 0;
      return (subtotal !== undefined ? subtotal : this.getSubtotal()) >= this.freeShippingThreshold ? 0 : this.flatShippingFee;
    }

    getTotal() {
      const subtotal = this.getSubtotal();
      return subtotal + this.getShipping(subtotal);
    }

    getItemCount() {
      return this.items.reduce((count, item) => count + item.quantity, 0);
    }

    /**
     * Tam Durum Nesnesi (CartState)
     */
    getState() {
      const subtotal = this.getSubtotal();
      const shipping = this.getShipping(subtotal);
      const total = subtotal + shipping;
      const itemCount = this.getItemCount();

      return {
        items: this.items.map(i => ({ ...i })),
        subtotal,
        shipping,
        shippingFee: shipping,
        total,
        grandTotal: total,
        itemCount,
        freeShippingThreshold: this.freeShippingThreshold,
        shippingThreshold: this.freeShippingThreshold,
        isFreeShipping: subtotal >= this.freeShippingThreshold,
        missingForFreeShipping: Math.max(0, this.freeShippingThreshold - subtotal)
      };
    }

    /**
     * Sepete Ürün Ekleme
     */
    addItem(product, quantity = 1) {
      if (!product || !product.id) return;

      const qty = Math.max(1, parseInt(quantity, 10) || 1);
      const existing = this.items.find(item => item.id === product.id || item.id === product.sku);

      if (existing) {
        existing.quantity += qty;
      } else {
        this.items.push({
          id: String(product.id || product.sku),
          title: String(product.title),
          price: Number(product.price) || 0,
          image: String(product.image || 'images/logo.png'),
          quantity: qty,
          deliveryType: product.ankaraSameDay ? 'ankara_same_day' : (product.deliveryType || 'standard_cargo')
        });
      }

      this.persist();
      this.render();
      this.openDrawer();
      this.notifyListeners();

      // Google Analytics 4 (GA4) add_to_cart Event
      try {
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'add_to_cart', {
            currency: 'TRY',
            value: Number(product.price) * qty,
            items: [{
              item_id: String(product.id || product.sku),
              item_name: String(product.title),
              price: Number(product.price),
              quantity: qty
            }]
          });
        }
      } catch (gaErr) {}
    }

    /**
     * Adet Güncelleme (+ / - / doğrudan giriş)
     */
    updateQuantity(productId, quantity) {
      const targetId = String(productId);
      const itemIndex = this.items.findIndex(item => item.id === targetId);
      if (itemIndex === -1) return;

      const newQty = parseInt(quantity, 10);
      if (isNaN(newQty) || newQty <= 0) {
        this.removeItem(targetId);
        return;
      }

      // Max 10 adet sınırı
      this.items[itemIndex].quantity = Math.min(10, Math.max(1, newQty));

      this.persist();
      this.render();
      this.notifyListeners();
    }

    /**
     * Sepetten Tekil Ürün Kaldırma
     */
    removeItem(productId) {
      const targetId = String(productId);
      this.items = this.items.filter(item => item.id !== targetId);

      this.persist();
      this.render();
      this.notifyListeners();
    }

    /**
     * Sepeti Tamamen Temizleme
     */
    clearCart() {
      this.items = [];
      this.persist();
      this.render();
      this.notifyListeners();
    }

    /**
     * Çekmeceyi Açma
     */
    openDrawer() {
      const drawer = document.getElementById('cartDrawer');
      const backdrop = document.getElementById('cartBackdrop');
      if (!drawer) return;

      drawer.classList.add('show', 'is-open', 'open', 'active');
      drawer.setAttribute('aria-hidden', 'false');

      if (backdrop) {
        backdrop.classList.add('show', 'is-open');
        backdrop.setAttribute('aria-hidden', 'false');
      }

      document.body.classList.add('drawer-open');
      document.body.style.overflow = 'hidden';
      this.isDrawerOpen = true;

      // Odak yönetimi
      const closeBtn = document.getElementById('cartCloseBtn');
      if (closeBtn) closeBtn.focus();
    }

    /**
     * Çekmeceyi Kapatma
     */
    closeDrawer() {
      const drawer = document.getElementById('cartDrawer');
      const backdrop = document.getElementById('cartBackdrop');
      if (!drawer) return;

      drawer.classList.remove('show', 'is-open', 'open', 'active');
      drawer.setAttribute('aria-hidden', 'true');

      if (backdrop) {
        backdrop.classList.remove('show', 'is-open');
        backdrop.setAttribute('aria-hidden', 'true');
      }

      document.body.classList.remove('drawer-open');
      document.body.style.overflow = '';
      this.isDrawerOpen = false;
    }

    /**
     * Siparişi Tamamla Aksiyonu (Checkout Modalı Açma)
     */
    proceedToCheckout() {
      if (this.items.length === 0) {
        alert('Sepetinizde ürün bulunmamaktadır. Lütfen medikal ürün kataloğumuzdan ürün seçiniz.');
        return;
      }

      this.closeDrawer();

      if (window.CheckoutManager && typeof window.CheckoutManager.openModal === 'function') {
        window.CheckoutManager.openModal();
      } else {
        const checkoutModal = document.getElementById('checkoutModal');
        if (checkoutModal) {
          checkoutModal.classList.add('show', 'is-open');
        }
      }
    }

    /**
     * Olay Bildirimi (Broadcast)
     */
    notifyListeners() {
      const state = this.getState();
      const event = new CustomEvent('atli:cart-updated', {
        bubbles: true,
        detail: state
      });
      document.dispatchEvent(event);
    }

    /**
     * UI Render Motoru (Drawer, Sayaç, Liste, Fiyatlar, İlerleme Çubuğu)
     */
    render() {
      const state = this.getState();

      // 1. Üst Başlık Sepet Sayaç Rozeti
      const cartCountEls = document.querySelectorAll('#cartCount, .cart-count, [data-cart-count]');
      cartCountEls.forEach(el => {
        el.textContent = state.itemCount;
        el.style.display = state.itemCount > 0 ? 'inline-flex' : 'inline-flex';
        el.classList.add('pulse');
        setTimeout(() => el.classList.remove('pulse'), 300);
      });

      // 2. Ücretsiz Kargo İlerleme Çubuğu (#freeShippingBar)
      const shippingBar = document.getElementById('freeShippingBar') || document.querySelector('.free-shipping-bar');
      const shippingProgressFill = document.querySelector('.free-shipping-bar__progress-fill');
      const shippingText = document.querySelector('.free-shipping-bar__text');

      if (shippingBar) {
        const percent = Math.min(100, Math.round((state.subtotal / this.freeShippingThreshold) * 100));

        if (shippingProgressFill) {
          shippingProgressFill.style.width = `${percent}%`;
          if (percent >= 100) {
            shippingProgressFill.classList.add('is-completed');
          } else {
            shippingProgressFill.classList.remove('is-completed');
          }
        }

        if (shippingText) {
          if (state.subtotal >= this.freeShippingThreshold) {
            shippingText.innerHTML = `<strong>Tebrikler!</strong> 1.000 ₺ üzeri <span class="free-badge">Ücretsiz Ankara Aynı Gün Teslimat</span> kazandınız.`;
          } else {
            const diff = (this.freeShippingThreshold - state.subtotal).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            shippingText.innerHTML = `Ücretsiz kargo &amp; kurulum için <strong>${diff} ₺</strong> daha ürün ekleyin.`;
          }
        }
      }

      // 3. Sepet Ürün Listesi (#cartItemsList) ve Boş Durum (#cartEmptyState)
      const itemsList = document.getElementById('cartItemsList') || document.querySelector('.cart-items-list');
      const emptyState = document.getElementById('cartEmptyState') || document.querySelector('.cart-empty');
      const cartFooter = document.getElementById('cartFooter') || document.querySelector('.cart-drawer__footer');

      if (this.items.length === 0) {
        if (itemsList) itemsList.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        if (cartFooter) cartFooter.style.display = 'none';
      } else {
        if (emptyState) emptyState.style.display = 'none';
        if (cartFooter) cartFooter.style.display = 'block';

        if (itemsList) {
          itemsList.innerHTML = this.items.map(item => `
            <div class="cart-item" data-cart-item data-id="${item.id}">
              <div class="cart-item__media">
                <img src="${item.image}" alt="${item.title}" class="cart-item__img" onerror="this.onerror=null;this.src='images/logo.png';">
              </div>
              <div class="cart-item__details">
                <div class="cart-item__top">
                  <h4 class="cart-item__title">${item.title}</h4>
                  <button type="button" class="cart-item__remove" data-item-remove data-id="${item.id}" aria-label="Ürünü sepetten çıkar">
                    <i class="fas fa-trash-alt" aria-hidden="true"></i>
                  </button>
                </div>
                <div class="cart-item__meta">
                  <span class="cart-item__unit-price">${item.price.toLocaleString('tr-TR')} ₺</span>
                  <span class="cart-item__kdv">KDV Dahil</span>
                </div>
                <div class="cart-item__bottom">
                  <div class="cart-item__stepper">
                    <button type="button" class="qty-minus cart-item__minus" data-qty-minus data-id="${item.id}" aria-label="Adet Azalt">−</button>
                    <input type="number" class="cart-item__qty" data-qty-input data-id="${item.id}" value="${item.quantity}" min="1" max="10" aria-label="Ürün adedi">
                    <button type="button" class="qty-plus cart-item__plus" data-qty-plus data-id="${item.id}" aria-label="Adet Artır">+</button>
                  </div>
                  <div class="cart-item__line-total">${(item.price * item.quantity).toLocaleString('tr-TR')} ₺</div>
                </div>
              </div>
            </div>
          `).join('');
        }
      }

      // 4. Alt Toplam, Kargo ve Genel Toplam Etiketleri
      const subtotalEls = document.querySelectorAll('#cartSubtotal, .cart-subtotal, [data-cart-subtotal]');
      subtotalEls.forEach(el => {
        el.textContent = `${state.subtotal.toLocaleString('tr-TR')} ₺`;
      });

      const shippingEls = document.querySelectorAll('#cartShippingFee, .cart-shipping, [data-cart-shipping]');
      shippingEls.forEach(el => {
        if (state.items.length === 0) {
          el.textContent = '0 ₺';
        } else if (state.shipping === 0) {
          el.innerHTML = '<span class="text-success font-bold">ÜCRETSİZ</span>';
        } else {
          el.textContent = `${state.shipping.toLocaleString('tr-TR')} ₺`;
        }
      });

      const grandTotalEls = document.querySelectorAll('#cartGrandTotal, .cart-grand-total, [data-cart-total]');
      grandTotalEls.forEach(el => {
        el.textContent = `${state.total.toLocaleString('tr-TR')} ₺`;
      });

      // 5. WhatsApp Hızlı Sipariş Linkini Güncelle
      const waDrawerBtn = document.getElementById('cartWaQuickOrder');
      if (waDrawerBtn && window.PaymentGatewayAdapter) {
        waDrawerBtn.href = window.PaymentGatewayAdapter.generateWhatsAppUrl({
          items: state.items,
          subtotal: state.subtotal,
          shipping: state.shipping,
          grandTotal: state.total,
          paymentMethod: 'whatsapp'
        });
      }
    }

    /**
     * Olay Bağlayıcıları (Global Delegasyon)
     */
    bindEvents() {
      // 1. Dokümandaki "Sepete Ekle" Butonları (.btn-add-cart / data-add-to-cart)
      document.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.btn-add-cart, [data-add-to-cart]');
        if (addBtn) {
          // Eğer Quick View modalı içindeki buton ise, main.js özel event fırlatıyor, çift eklemeyi önle
          if (addBtn.id === 'qvAddToCartBtn') return;

          e.preventDefault();
          const id = addBtn.getAttribute('data-id');
          if (id) {
            const product = typeof window.getAtliProductById === 'function'
              ? window.getAtliProductById(id)
              : (window.ATLI_PRODUCTS || []).find(p => p.id === id || p.sku === id);

            if (product) {
              this.addItem(product, 1);
            }
          }
        }
      });

      // 2. Quick View Modalı Custom Event ('atli:add-to-cart')
      document.addEventListener('atli:add-to-cart', (e) => {
        if (e.detail) {
          this.addItem(e.detail, e.detail.quantity || 1);
        }
      });

      // 3. Sepet Açma / Kapatma Tetikleyicileri
      document.addEventListener('click', (e) => {
        // Sepet İkonu / Butonu
        const toggleBtn = e.target.closest('#cartToggleBtn, .btn-cart-toggle, [data-cart-toggle]');
        if (toggleBtn) {
          e.preventDefault();
          this.openDrawer();
          return;
        }

        // Sepet Kapatma Butonu
        const closeBtn = e.target.closest('#cartCloseBtn, .cart-drawer__close, [data-cart-close]');
        if (closeBtn) {
          e.preventDefault();
          this.closeDrawer();
          return;
        }

        // Backdrop Tıklaması
        const backdrop = e.target.closest('#cartBackdrop');
        if (backdrop && this.isDrawerOpen) {
          e.preventDefault();
          this.closeDrawer();
          return;
        }

        // Sepeti Boşalt Butonu
        const clearBtn = e.target.closest('#cartClearBtn, [data-cart-clear]');
        if (clearBtn) {
          e.preventDefault();
          if (confirm('Sepetinizdeki tüm ürünleri çıkarmak istediğinize emin misiniz?')) {
            this.clearCart();
          }
          return;
        }

        // Siparişi Tamamla Butonu
        const checkoutBtn = e.target.closest('#cartCheckoutBtn, .btn-cart-checkout, [data-cart-checkout]');
        if (checkoutBtn) {
          e.preventDefault();
          this.proceedToCheckout();
          return;
        }

        // Alışverişe Devam Et / Alışverişe Başla
        const continueBtn = e.target.closest('#cartContinueShopping, .btn-cart-continue');
        if (continueBtn) {
          e.preventDefault();
          this.closeDrawer();
          const targetSec = document.getElementById('urunler');
          if (targetSec) targetSec.scrollIntoView({ behavior: 'smooth' });
          return;
        }
      });

      // 4. Çekmece İçi Delegasyon: Artır (+), Azalt (-), Sil, Değiştir
      const drawer = document.getElementById('cartDrawer');
      if (drawer) {
        drawer.addEventListener('click', (e) => {
          // Adet Artır (+)
          const plusBtn = e.target.closest('.qty-plus, [data-qty-plus], .cart-item__plus');
          if (plusBtn) {
            e.preventDefault();
            const id = plusBtn.getAttribute('data-id');
            const item = this.items.find(i => i.id === id);
            if (item) {
              this.updateQuantity(id, item.quantity + 1);
            }
            return;
          }

          // Adet Azalt (-)
          const minusBtn = e.target.closest('.qty-minus, [data-qty-minus], .cart-item__minus');
          if (minusBtn) {
            e.preventDefault();
            const id = minusBtn.getAttribute('data-id');
            const item = this.items.find(i => i.id === id);
            if (item) {
              this.updateQuantity(id, item.quantity - 1);
            }
            return;
          }

          // Ürün Kaldır (Sil)
          const removeBtn = e.target.closest('.cart-item__remove, [data-item-remove]');
          if (removeBtn) {
            e.preventDefault();
            const id = removeBtn.getAttribute('data-id');
            if (id) {
              this.removeItem(id);
            }
            return;
          }
        });

        // Sayı Girişi Değişikliği (Input change/blur)
        drawer.addEventListener('change', (e) => {
          const qtyInput = e.target.closest('.cart-item__qty, [data-qty-input]');
          if (qtyInput) {
            const id = qtyInput.getAttribute('data-id');
            const val = parseInt(qtyInput.value, 10);
            this.updateQuantity(id, isNaN(val) ? 1 : val);
          }
        });
      }

      // 5. Klavye Escape İle Kapatma
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isDrawerOpen) {
          this.closeDrawer();
        }
      });

      // 6. Çoklu Sekme (Multi-Tab) Eşzamanlama
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.loadFromStorage();
          this.render();
        }
      });
    }
  }

  // Örneği küresel olarak window.CartManager üzerinden dışa aktar
  const instance = new CartManager();
  window.CartManager = instance;

  // DOM hazır olduğunda başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => instance.init());
  } else {
    instance.init();
  }
})(window);
