/**
 * ATLI MEDİKAL — KLİNİK MEDİKAL E-TİCARET & MAĞAZA ETKİLEŞİM MOTORU
 * Canlı Türkçe Ürün Arama • 4 Kategorili Filtreleme • Hızlı İnceleme Modalı • Mobil Menü
 * Sürüm: 2.0.0 (Milestone 2)
 */

document.addEventListener('DOMContentLoaded', () => {
  initPreloader();
  initMobileMenu();
  initCategoryAndSearchFilter();
  initQuickViewModal();
  initCookieBanner();
  initStoreHoursBadge();
  initAnalyticsTracking();
});

/**
 * 0. Prestijli Açılış Animasyonu (Preloader)
 */
function initPreloader() {
  const preloader = document.getElementById('atliPreloader');
  if (!preloader) return;

  function dismiss() {
    if (preloader.classList.contains('atli-preloader--done')) return;
    preloader.classList.add('atli-preloader--done');
    setTimeout(() => {
      try {
        if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
      } catch (e) {}
    }, 600);
  }

  if (document.readyState === 'complete') {
    setTimeout(dismiss, 1000);
  } else {
    window.addEventListener('load', () => setTimeout(dismiss, 1000));
  }

  setTimeout(dismiss, 2200);
}

/**
 * 1. Mobil Hamburger Menü
 */
function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const bottomNav = document.querySelector('.site-header__bottom');
  if (!hamburger || !bottomNav) return;

  hamburger.addEventListener('click', () => {
    const isOpen = bottomNav.classList.toggle('active');
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  bottomNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      bottomNav.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
}

/**
 * 2. Kategori Filtreleme + Canlı Türkçe Arama (Debounced Search)
 */
function initCategoryAndSearchFilter() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const productCards = document.querySelectorAll('.product-card[data-category]');
  const navFilterLinks = document.querySelectorAll('[data-nav-filter]');
  const searchInput = document.getElementById('productSearchInput');
  const searchBtn = document.getElementById('productSearchBtn');
  const catalogSection = document.getElementById('urunler');
  const emptyState = document.getElementById('searchNoResults');
  const resetSearchBtn = document.getElementById('resetSearchBtn');

  if (!productCards.length) return;

  let currentCategory = 'all';
  let debounceTimer = null;
  const ITEMS_PER_PAGE = 12;
  let currentPage = 1;

  // Sayfalandırma (Pagination) Taşıyıcısı
  let paginationContainer = document.getElementById('catalogPagination');
  if (!paginationContainer && catalogSection) {
    paginationContainer = document.createElement('div');
    paginationContainer.id = 'catalogPagination';
    paginationContainer.className = 'tm-pagination';
    const grid = document.getElementById('productsGrid');
    if (grid && grid.parentNode) {
      grid.parentNode.insertBefore(paginationContainer, grid.nextSibling);
    }
  }

  const renderPagination = (totalItems, page) => {
    if (!paginationContainer) return;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (totalPages <= 1) {
      paginationContainer.innerHTML = '';
      paginationContainer.style.display = 'none';
      return;
    }

    paginationContainer.style.display = 'flex';

    let html = `
      <div class="tm-pagination__info">
        Toplam <strong>${totalItems}</strong> üründen 
        <strong>${(page - 1) * ITEMS_PER_PAGE + 1}-${Math.min(page * ITEMS_PER_PAGE, totalItems)}</strong> arası gösteriliyor
      </div>
      <div class="tm-pagination__controls">
        <button type="button" class="tm-page-btn tm-page-btn--prev" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">
          <i class="fas fa-chevron-left" aria-hidden="true"></i>
          <span>Önceki</span>
        </button>
        <div class="tm-page-numbers">
    `;

    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2)) {
        html += `
          <button type="button" class="tm-page-btn tm-page-btn--num ${p === page ? 'is-active' : ''}" data-page="${p}">
            ${p}
          </button>
        `;
      } else if (p === page - 3 || p === page + 3) {
        html += `<span class="tm-page-ellipsis">...</span>`;
      }
    }

    html += `
        </div>
        <button type="button" class="tm-page-btn tm-page-btn--next" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">
          <span>Sonraki</span>
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    `;

    paginationContainer.innerHTML = html;
  };

  if (paginationContainer) {
    paginationContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;
      const targetPage = parseInt(btn.getAttribute('data-page'), 10);
      if (targetPage && targetPage !== currentPage) {
        currentPage = targetPage;
        const query = searchInput ? searchInput.value : '';
        applyFilter(currentCategory, query, true, false);
      }
    });
  }

  // Çekirdek Filtreleme ve Arama Motoru
  const applyFilter = (category, query = '', shouldScroll = false, resetPage = true) => {
    if (resetPage) {
      currentPage = 1;
    }
    const normalizedQuery = (query || '').trim().toLocaleLowerCase('tr-TR');
    
    // Kategori butonlarının aktiflik durumunu güncelle
    filterButtons.forEach((btn) => {
      const isMatch = btn.getAttribute('data-filter') === category;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    });

    // Üst menü kategori vurgusunu güncelle
    document.querySelectorAll('.category-nav__item[data-nav-filter]').forEach((item) => {
      const isMatch = item.getAttribute('data-nav-filter') === category;
      item.classList.toggle('category-nav__item--highlight', isMatch);
    });

    // Filtreye uyan kartları tespit et
    const matchingCards = [];
    productCards.forEach((card) => {
      const cardCategory = card.getAttribute('data-category') || '';
      const cardText = `${card.getAttribute('data-sku') || ''} ${card.textContent}`.toLocaleLowerCase('tr-TR');

      const matchesCategory = category === 'all' || cardCategory === category;
      const matchesSearch = !normalizedQuery || cardText.includes(normalizedQuery);

      if (matchesCategory && matchesSearch) {
        matchingCards.push(card);
      }
    });

    const totalItems = matchingCards.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = 1;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;

    productCards.forEach((card) => {
      const idx = matchingCards.indexOf(card);
      if (idx !== -1 && idx >= startIndex && idx < endIndex) {
        card.classList.remove('is-hidden');
      } else {
        card.classList.add('is-hidden');
      }
    });

    // Sayfalandırma bileşenini güncelle
    renderPagination(totalItems, currentPage);

    // Boş sonuç (empty state) kontrolü
    if (emptyState) {
      emptyState.style.display = totalItems === 0 ? 'block' : 'none';
    }

    if (shouldScroll && catalogSection) {
      catalogSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Kategori sekme butonları
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentCategory = btn.getAttribute('data-filter') || 'all';
      if (searchInput) searchInput.value = '';
      applyFilter(currentCategory, '', false, true);
    });
  });

  // Üst menü, Hero mini kartlar ve Bento kutularındaki kategori linkleri
  navFilterLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const targetFilter = link.getAttribute('data-nav-filter');
      if (targetFilter) {
        currentCategory = targetFilter;
        if (searchInput) searchInput.value = '';
        applyFilter(currentCategory, '', false, true);
      }
    });
  });

  // Arama barı yazımı ana sayfadaki ürünleri işgal etmez;
  // Arama ve yönlendirme işlemleri theme-modern.js içindeki akıllı kategori motoru tarafından
  // doğrudan ilgili kategori sayfasına yönlendirilir.
  if (searchInput) {
    // Sadece temizleme butonuna basıldığında filtreyi sıfırla
    if (resetSearchBtn) {
      resetSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        currentCategory = 'all';
        applyFilter('all', '', false);
      });
    }
  }

  // Aramayı Temizle butonu
  if (resetSearchBtn) {
    resetSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      currentCategory = 'all';
      applyFilter('all', '', false);
    });
  }

  // Sayfa açıldığında varsayılan olarak ilk sayfayı ve sayfalandırmayı aktif et
  // Global erisim: arama ve kategori gecislerinde theme-modern tarafindan cagrilabilir
  window.applyMedicalCatalogFilter = applyFilter;

  applyFilter('all', '', false, true);
}

/**
 * 3. Ürün Hızlı İnceleme Modalı (Clinical Quick-View Modal)
 */
function initQuickViewModal() {
  const modal = document.getElementById('quickViewModal');
  const backdrop = document.getElementById('quickViewBackdrop');
  const content = document.getElementById('quickViewContent');
  const closeBtn = document.getElementById('quickViewCloseBtn');
  const productsGrid = document.getElementById('productsGrid');

  if (!modal || !backdrop || !content) return;

  let lastFocusedElement = null;

  // Modalı açma fonksiyonu
  const openQuickView = (productId, triggerEl) => {
    lastFocusedElement = triggerEl || document.activeElement;

    const product = typeof window.getAtliProductById === 'function'
      ? window.getAtliProductById(productId)
      : (window.ATLI_PRODUCTS || []).find(p => p.id === productId || p.sku === productId);

    if (!product) return;

    // Teknik Özellikler Tablosu Satırları
    let techRows = '';
    if (product.technicalDetails) {
      techRows = Object.entries(product.technicalDetails)
        .map(([key, val]) => `<tr><td>${key}</td><td>${val}</td></tr>`)
        .join('');
    }

        // Modernleştirilmiş Klinik Modal İçerik Şablonu
    const cleanDesc = (product.fullDescription || product.shortDescription || '')
      .replace(/\s+/g, ' ')
      .trim();

    // Beden Seçenekleri (Varsa şık chip haplar halinde)
    let sizePills = '';
    if (product.sizes) {
      const parts = String(product.sizes).split(/[\s·,-]+/).filter(Boolean);
      sizePills = `
        <div class="qv-sizes-wrap">
          <span class="qv-sizes-title"><i class="fas fa-ruler-combined" aria-hidden="true"></i> Beden Seçenekleri:</span>
          <div class="qv-sizes-list">
            ${parts.map(s => `<span class="qv-size-chip">${s}</span>`).join('')}
          </div>
        </div>`;
    }

    // Temizlenmiş Teknik Tablo
    let cleanTechRows = '';
    if (product.technicalDetails) {
      cleanTechRows = Object.entries(product.technicalDetails)
        .map(([key, val]) => {
          let cleanVal = String(val)
            .replace(/ÜTS|CE Tıbbi Cihaz Yönetmeliği Uyumlu|Sağlık Bakanlığı ÜTS Kayıtlı • /gi, '')
            .trim();
          if (cleanVal.startsWith('•')) cleanVal = cleanVal.substring(1).trim();
          if (!cleanVal) cleanVal = 'Klinik Standartlara Uygun';
          return `<tr><td>${key}</td><td>${cleanVal}</td></tr>`;
        })
        .join('');
    }

    const waLink = 'https://wa.me/905363527416?text=' + encodeURIComponent('Merhaba, ' + product.title + ' hakkında sipariş vermek ve bilgi almak istiyorum.');
    const callLink = 'tel:+905363527416';

    content.innerHTML = `
      <div class="qv-media-col">
        <div class="qv-image-box">
          <div class="qv-brand-logo" title="${product.brand || ''}">
            <img src="${product.brandLogo || 'images/logo.png'}" alt="${product.brand || ''}" class="brand-badge-img">
          </div>
          <img src="${product.image}" alt="${product.title}" onerror="this.onerror=null;this.src='images/logo.png';">
        </div>

        <div class="qv-delivery-badge">
          <i class="fas fa-truck-fast" aria-hidden="true"></i>
          <span>Ankara İçi Aynı Gün Kapıya Hızlı Teslimat</span>
        </div>

        <div class="qv-sgk-box">
          <i class="fas fa-file-medical-alt" aria-hidden="true"></i>
          <div>
            <strong>SGK Rapor ve Reçete Desteği</strong>
            <p>${product.sgkNote || 'Uzman hekim raporu ve medikal reçete danışmanlığı mevcuttur.'}</p>
          </div>
        </div>
      </div>

      <div class="qv-info-col">
        <div class="qv-cat-badge">
          <i class="fas fa-layer-group" style="margin-right: 5px;" aria-hidden="true"></i> ${product.categoryName || 'Medikal Sağlık Ürünü'}
        </div>

        <h2 class="qv-title" id="qvModalTitle">${product.title}</h2>

        <p class="qv-desc">${cleanDesc}</p>

        ${sizePills}

        ${cleanTechRows ? `
          <table class="qv-specs-table" aria-label="Teknik Özellikler">
            <tbody>${cleanTechRows}</tbody>
          </table>
        ` : ''}

        <div class="qv-actions-grid">
          <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="qv-btn-wa">
            <i class="fab fa-whatsapp" aria-hidden="true"></i> WhatsApp ile Sipariş Ver
          </a>
          <a href="${callLink}" class="qv-btn-call">
            <i class="fas fa-phone-alt" aria-hidden="true"></i> 0536 352 74 16
          </a>
        </div>
      </div>
    `;

    // Miktar artırma / azaltma butonları
    const qtyInput = document.getElementById('qvQtyInput');
    const qtyMinus = document.getElementById('qvQtyMinus');
    const qtyPlus = document.getElementById('qvQtyPlus');

    if (qtyMinus && qtyInput) {
      qtyMinus.addEventListener('click', () => {
        let val = parseInt(qtyInput.value, 10) || 1;
        if (val > 1) qtyInput.value = val - 1;
      });
    }

    if (qtyPlus && qtyInput) {
      qtyPlus.addEventListener('click', () => {
        let val = parseInt(qtyInput.value, 10) || 1;
        if (val < 10) qtyInput.value = val + 1;
      });
    }

    // Modal içi Sepete Ekle butonu
    const modalAddCartBtn = document.getElementById('qvAddToCartBtn');
    if (modalAddCartBtn) {
      modalAddCartBtn.addEventListener('click', () => {
        const qty = parseInt(qtyInput ? qtyInput.value : 1, 10) || 1;
        const event = new CustomEvent('atli:add-to-cart', {
          bubbles: true,
          detail: {
            id: product.id,
            title: product.title,
            price: product.price,
            image: product.image,
            quantity: qty,
            deliveryType: product.ankaraSameDay ? 'ankara_same_day' : 'cargo'
          }
        });
        document.dispatchEvent(event);

        // Kullanıcıya ekleme bildirimi
        modalAddCartBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Sepete Eklendi!';
        setTimeout(() => {
          modalAddCartBtn.innerHTML = '<i class="fas fa-shopping-bag" aria-hidden="true"></i> Sepete Ekle';
        }, 1500);
      });
    }

    // Modalı aç ve erişilebilirlik odak kontrolünü sağla
    modal.classList.add('show');
    backdrop.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');

    if (closeBtn) closeBtn.focus();
  };

  // Modalı kapatma fonksiyonu
  const closeQuickView = () => {
    modal.classList.remove('show');
    backdrop.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  };

    // Grid üzerindeki tıklamalar: Ürüne basınca direkt hızlı inceleme modu açılsın, WhatsApp butonuna basınca sipariş açılsın
  if (productsGrid) {
    productsGrid.addEventListener('click', (e) => {
      // Doğrudan WhatsApp sipariş butonuna tıklandıysa sipariş açılsın
      if (e.target.closest('[data-order-direct], .btn-order-direct, .card-btn--primary')) {
        return;
      }
      // Ürünün herhangi bir yerine (kart, resim, başlık veya buton) tıklandıysa direkt inceleme modalını aç
      const card = e.target.closest('.product-card');
      if (card) {
        e.preventDefault();
        const productId = card.getAttribute('data-id') || (e.target.closest('[data-id]') ? e.target.closest('[data-id]').getAttribute('data-id') : null);
        if (productId) {
          openQuickView(productId, card);
        }
      }
    });
  }

  // Kapatma butonları, backdrop ve klavye etkileşimi
  if (closeBtn) {
    closeBtn.addEventListener('click', closeQuickView);
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeQuickView);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeQuickView();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      closeQuickView();
    }
  });
}

/**
 * 4. KVKK ve Çerez Bilgilendirme Bandı
 */
function initCookieBanner() {
  const banner = document.getElementById('cookieBanner');
  const acceptBtn = document.getElementById('cookieAccept');
  const rejectBtn = document.getElementById('cookieReject');

  if (!banner) return;

  const STORAGE_KEY = 'atli_medikal_cookie_consent';

  window.openCookieBanner = function() {
    banner.style.display = 'block';
    banner.offsetHeight;
    banner.classList.add('show');
  };

  window.closeCookieBanner = function() {
    banner.classList.remove('show');
    setTimeout(() => {
      banner.style.display = 'none';
    }, 280);
  };

  let savedChoice = null;
  try {
    savedChoice = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    // ignore
  }

  // Eğer kullanıcı daha önce onay vermediyse sayfada yumuşakça göster
  if (!savedChoice) {
    setTimeout(() => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) {
          window.openCookieBanner();
        }
      } catch (e) {
        window.openCookieBanner();
      }
    }, 600);
  }

  const handleChoice = (choice) => {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch (e) {
      // ignore
    }
    window.closeCookieBanner();
  };

  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => handleChoice('accepted'));
  }
  if (rejectBtn) {
    rejectBtn.addEventListener('click', () => handleChoice('essential_only'));
  }
}

/**
 * 5. Canlı Mağaza Çalışma Saatleri Rozeti (Türkiye Yerel Saati - GMT+3)
 * Standart Çalışma Saatleri: Pazartesi – Cumartesi 08:30 – 18:30 | Pazar: Kapalı
 */
function initStoreHoursBadge() {
  const badge = document.getElementById('storeStatusBadge');
  if (!badge) return;

  const dot = badge.querySelector('.store-status-pill__dot') || badge;
  const text = badge.querySelector('.store-status-pill__text') || badge;

  function updateBadge() {
    try {
      const now = new Date();
      // Türkiye Saati (Europe/Istanbul - UTC+3 sabit)
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Istanbul',
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      });

      const parts = formatter.formatToParts(now);
      let weekday = '';
      let hour = 0;
      let minute = 0;

      for (const part of parts) {
        if (part.type === 'weekday') weekday = part.value;
        if (part.type === 'hour') hour = parseInt(part.value, 10);
        if (part.type === 'minute') minute = parseInt(part.value, 10);
      }

      const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
      const day = dayMap[weekday] !== undefined ? dayMap[weekday] : now.getDay();
      const currentMinutes = hour * 60 + minute;
      const openMinutes = 8 * 60 + 30;   // 08:30 (510 dk)
      const closeMinutes = 18 * 60 + 30; // 19:30 (1170 dk)

      // Pzt–Cmt (1-6) 08:30–19:30 arası Açık
      const isOpen = (day >= 1 && day <= 6) && (currentMinutes >= openMinutes && currentMinutes < closeMinutes);

      badge.classList.remove('status-open', 'status-closed');

      if (isOpen) {
        badge.classList.add('status-open');
        text.textContent = 'Şu An Açık • 19:30\'a kadar';
        badge.setAttribute('title', 'Atlı Medikal Aydınlıkevler mağazamız şu anda açık.');
      } else {
        badge.classList.add('status-closed');
        badge.setAttribute('title', 'Atlı Medikal Aydınlıkevler mağazamız mesai saatleri dışındadır.');

        if (day === 0) {
          text.textContent = 'Pazar Kapalı • Açılış: Pzt 08:30';
        } else if (day === 6 && currentMinutes >= closeMinutes) {
          text.textContent = 'Şu An Kapalı • Açılış: Pzt 08:30';
        } else if (currentMinutes >= closeMinutes) {
          text.textContent = 'Şu An Kapalı • Açılış: Yarın 08:30';
        } else {
          text.textContent = 'Şu An Kapalı • Açılış: Bugün 08:30';
        }
      }
    } catch (err) {
      // Beklenmeyen hata durumunda standart saatleri göster
      badge.classList.add('status-open');
      text.textContent = 'Pzt–Cmt 08:30–18:30';
    }
  }

  updateBadge();
  setInterval(updateBadge, 60000); // Dakikada bir dinamik kontrol et
}

/**
 * 6. Google Analytics 4 (GA4) Etkinlik Takibi (Telefon, WhatsApp ve Aksiyonlar)
 */
function initAnalyticsTracking() {
  document.addEventListener('click', (e) => {
    // Telefon Tıklamaları (Arama Dönüşümü)
    const telLink = e.target.closest('a[href^="tel:"]');
    if (telLink) {
      const phone = telLink.getAttribute('href').replace('tel:', '');
      try {
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'generate_lead', {
            event_category: 'Contact',
            event_label: `Phone Call: ${phone}`,
            method: 'Phone'
          });
        }
      } catch (err) {}
      return;
    }

    // WhatsApp Tıklamaları (WhatsApp Dönüşümü)
    const waLink = e.target.closest('a[href*="wa.me"], a[href*="whatsapp.com"]');
    if (waLink) {
      try {
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'generate_lead', {
            event_category: 'Contact',
            event_label: 'WhatsApp Click',
            method: 'WhatsApp'
          });
        }
      } catch (err) {}
      return;
    }
  });
}
