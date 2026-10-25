/**
 * ATLI MEDİKAL — MODERN SADE TEMA (theme-modern.js)
 * 1) ☰ Sol üst çerçevesiz menü ikonu & daraltılmış yan menü
 * 2) Yan menü veya kategori kartından kategori seçilince tam sayfa Kategori Görünümü + "← Ana Sayfaya Dön" ve Tarayıcı Geri Tuşu desteği
 * 3) Header'ın hemen altında kesintisiz akan hareketli güvence şeridi
 * 4) Ana sayfada TENS & EMS Kampanya Vitrini
 * 5) Öne Çıkan 4 Medikal Kategori Kartı (Ortopedik Korse Grubu, Dizlik & Alt Ekstremite, Varis Çorabı, Lenfödem Setleri)
 * 6) Markalarımız şeridi
 * 7) Tam ve eksiksiz 178 ürünlük katalog gridi
 * 8) Hakkımızda bölümü (25+ Yıl Deneyim)
 */
(function () {
  'use strict';

  const MANUAL_DEALS = ['ERL-004', 'BGT-001', 'ERL-005', 'BGT-020', 'ERL-022'];
  const DEAL_COUNT = 5;
  const ROTATE_MS = 3500;
  const PHONE = '+905363527416';
  const WA = 'https://wa.me/905363527416';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const products = () => window.ATLI_PRODUCTS || [];
  const byId = (id) => products().find((p) => p.id === id || p.sku === id);
  const tl = (n) => Number(n).toLocaleString('tr-TR') + ' ₺';
  const offPct = (p) => (p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) =>
    String(s || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
      .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/İ/g, 'i');

  const CATEGORIES = [
    {
      key: 'korse',
      name: 'Ortopedik Korse Grubu',
      desc: 'Abdominal karın korseleri, çelik balenli lumbosakral bel korseleri, dorsolomber ve torakolomber korseler, kifoz ve gebelik korseleri.'
    },
    {
      key: 'dizlik',
      name: 'Dizlik & Alt Ekstremite',
      desc: 'Örme patella ve ligament destekli dizlikler, menteşeli ve açı ayarlı dizlikler, patella tendon bandı, baldırlık ve uylukluk ortezleri.'
    },
    {
      key: 'el-kol-omuz',
      name: 'El Bilek, Kol & Omuz',
      desc: 'El bilek atelleri, başparmak destekli ateller, mallet finger ve parmak kırığı atelleri, ortopedik kol askıları, velpo bandajı ve omuzluklar.'
    },
    {
      key: 'boyunluk',
      name: 'Boyunluk Grubu',
      desc: 'Nelson boyunluk, Philadelphia çenelikli boyunluk, Chin-up çene destekli boyunluk, sünger ve plastik ortopedik boyunluklar.'
    },
    {
      key: 'ayak-bilek',
      name: 'Ayak, Bileklik & Silikon',
      desc: 'Örme silikon destekli ayak bilekliği, malleol destekli bileklikler, AFO, yürüme botu, halluks valgus gece ateli ve silikon topukluklar.'
    },
    {
      key: 'corap',
      name: 'Varis & Basınçlı Çorap',
      desc: 'Diz altı, diz üstü ve külotlu basınçlı medikal varis çorapları (CCL1 / CCL2), anti-emboli çorapları ve gümüş diyabet çorapları.'
    },
    {
      key: 'lenfodem-bandaj',
      name: 'Lenfödem Bandaj Setleri',
      desc: 'Bagiten kısa çekişli kompresyon bandajları (6, 8, 10, 12 cm), böbrek ped, mikromasaj pedleri, bandaj altı tübüler çorap ve süngerler.'
    },
    {
      key: 'lenfodem-giysi',
      name: 'Lenfödem Bası Giysileri',
      desc: 'Kişiye özel ve standart anatomik ölçülü düz örme (flat-knit) lenfödem bası eldiveni, kolluk, çorap ve bası giysileri.'
    },
    {
      key: 'metal',
      name: 'Metal Grubu',
      desc: 'Tekerlekli sandalyeler, hasta karyolaları, walker, rolatör, baston, kanedyen ve medikal metal destek ürünleri.'
    }
  ];

  function openQuickView(id) {
    const btn = $(`#productsGrid [data-quick-view][data-id="${id}"]`);
    if (btn) btn.click();
    else {
      const card = $(`#productsGrid [data-id="${id}"]`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ---------------- HER KATEGORİYE ÖZEL CANLI MEDİKAL ANİMASYONLAR ---------------- */
  function getCategoryAnimationSVG(key) {
    if (key === 'metal') {
      return `
        <svg class="tm-cat-svg tm-cat-svg--metal" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <style>
            @keyframes wheelSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes metalWave { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
          </style>
          <path d="M82 20 L82 46 L108 46" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M72 16 L84 20" stroke="#0284C7" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M108 46 L116 66" stroke="#0F172A" stroke-width="3" stroke-linecap="round"/>
          <g style="transform-origin: 82px 52px; animation: wheelSpin 4s linear infinite;">
            <circle cx="82" cy="52" r="16" stroke="#0284C7" stroke-width="3" fill="none"/>
            <line x1="82" y1="36" x2="82" y2="68" stroke="#00D4AA" stroke-width="2"/>
            <line x1="66" y1="52" x2="98" y2="52" stroke="#00D4AA" stroke-width="2"/>
          </g>
          <circle cx="116" cy="66" r="6" stroke="#0284C7" stroke-width="2.5" fill="#0284C7" fill-opacity="0.2"/>
          <path d="M136 36 L156 36 M142 46 L168 46 M136 56 L154 56" stroke="#00D4AA" stroke-width="2.8" stroke-linecap="round" style="animation: metalWave 1.8s ease-in-out infinite;"/>
        </svg>`;
    }
    if (key === 'korse') {
      return `
        <svg class="tm-cat-svg tm-cat-svg--korse" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <style>
            @keyframes spinePulse { 0%,100% { opacity:0.35; transform: scaleY(0.96); } 50% { opacity:0.85; transform: scaleY(1.04); } }
            @keyframes balenGlow { 0%,100% { stroke:#0284C7; } 50% { stroke:#00D4AA; } }
          </style>
          <path d="M100 8 L100 72" stroke="#0F172A" stroke-width="2.5" stroke-dasharray="4 3" opacity="0.4"/>
          <g style="transform-origin: 100px 40px; animation: spinePulse 3s ease-in-out infinite;">
            <rect x="88" y="12" width="24" height="9" rx="3" fill="#0F172A" fill-opacity="0.15" stroke="#0F172A" stroke-width="1.8"/>
            <rect x="86" y="24" width="28" height="10" rx="3.5" fill="#0F172A" fill-opacity="0.2" stroke="#0F172A" stroke-width="1.8"/>
            <rect x="84" y="37" width="32" height="11" rx="4" fill="#0F172A" fill-opacity="0.25" stroke="#0284C7" stroke-width="2"/>
            <rect x="82" y="51" width="36" height="12" rx="4.5" fill="#0F172A" fill-opacity="0.2" stroke="#0F172A" stroke-width="1.8"/>
            <rect x="80" y="65" width="40" height="10" rx="4" fill="#0F172A" fill-opacity="0.15" stroke="#0F172A" stroke-width="1.8"/>
          </g>
          <path class="tm-balen tm-balen--left" d="M60 14 C52 38, 52 54, 60 70" stroke="#0284C7" stroke-width="3.5" stroke-linecap="round" style="animation: balenGlow 3s ease-in-out infinite;"/>
          <path class="tm-balen tm-balen--right" d="M140 14 C148 38, 148 54, 140 70" stroke="#0284C7" stroke-width="3.5" stroke-linecap="round" style="animation: balenGlow 3s ease-in-out infinite;"/>
          <path d="M42 22 C32 40, 32 50, 42 64" stroke="#00D4AA" stroke-width="3" stroke-linecap="round"/>
          <path d="M158 22 C168 40, 168 50, 158 64" stroke="#00D4AA" stroke-width="3" stroke-linecap="round"/>
        </svg>`;
    }
    if (key === 'dizlik') {
      return `
        <svg class="tm-cat-svg tm-cat-svg--dizlik" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <style>
            @keyframes patellaPulse { 0%,100% { transform: scale(0.92); opacity: 0.7; } 50% { transform: scale(1.1); opacity: 1; } }
            @keyframes ligamentFlex { 0%,100% { stroke-width: 3px; } 50% { stroke-width: 4.5px; stroke: #0284C7; } }
          </style>
          <path d="M78 8 C80 32, 76 50, 78 72" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M122 8 C120 32, 124 50, 122 72" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M64 16 C68 35, 66 48, 64 66" stroke="#0284C7" stroke-width="3.2" stroke-linecap="round" style="animation: ligamentFlex 2.5s ease-in-out infinite;"/>
          <path d="M136 16 C132 35, 134 48, 136 66" stroke="#0284C7" stroke-width="3.2" stroke-linecap="round" style="animation: ligamentFlex 2.5s ease-in-out infinite;"/>
          <g style="transform-origin: 100px 40px; animation: patellaPulse 2.5s ease-in-out infinite;">
            <circle cx="100" cy="40" r="16" fill="#00D4AA" fill-opacity="0.2" stroke="#00D4AA" stroke-width="2.8"/>
            <circle cx="100" cy="40" r="7" fill="#00D4AA" fill-opacity="0.5"/>
          </g>
        </svg>`;
    }
    if (key === 'el-kol-omuz') {
      return `
        <svg class="tm-cat-svg tm-cat-svg--bileklik" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <style>
            @keyframes wristGlow { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
          </style>
          <path d="M40 50 C60 48, 90 46, 120 40 C140 36, 155 30, 170 34" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M40 68 C65 66, 95 64, 125 58 C145 54, 160 50, 168 56" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round"/>
          <rect x="75" y="32" width="55" height="38" rx="8" fill="#0284C7" fill-opacity="0.15" stroke="#0284C7" stroke-width="2.5" style="animation: wristGlow 2.5s ease-in-out infinite;"/>
          <path d="M85 36 L120 36 M85 46 L120 46 M85 56 L120 56 M85 66 L120 66" stroke="#00D4AA" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M125 36 C135 24, 145 22, 155 25" stroke="#0284C7" stroke-width="3" stroke-linecap="round"/>
        </svg>`;
    }
    if (key === 'corap') {
      return `
        <svg class="tm-cat-svg tm-cat-svg--corap" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <style>
            @keyframes flowUp { 0% { stroke-dashoffset: 40; } 100% { stroke-dashoffset: 0; } }
          </style>
          <path d="M85 10 C85 35, 78 52, 75 62 C73 70, 80 74, 90 74 C100 74, 115 72, 122 72 C128 72, 134 66, 130 58 C124 48, 110 38, 105 25 C102 18, 100 10, 100 10 Z" fill="#0284C7" fill-opacity="0.15" stroke="#0284C7" stroke-width="2.6"/>
          <path d="M82 22 L102 22 M80 34 L106 34 M78 46 L112 46 M76 58 L122 58" stroke="#00D4AA" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="6 4" style="animation: flowUp 2s linear infinite;"/>
        </svg>`;
    }
    if (key === 'boyunluk') {
      return `
        <svg class="tm-cat-svg tm-cat-svg--boyunluk" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M60 25 C75 16, 125 16, 140 25 C146 38, 142 56, 134 62 C118 68, 82 68, 66 62 C58 56, 54 38, 60 25 Z" fill="#0284C7" fill-opacity="0.12" stroke="#0284C7" stroke-width="2.8"/>
          <path d="M85 32 C95 36, 105 36, 115 32" stroke="#00D4AA" stroke-width="3" stroke-linecap="round"/>
          <circle cx="100" cy="46" r="6" fill="#00D4AA" fill-opacity="0.3" stroke="#00D4AA" stroke-width="2"/>
        </svg>`;
    }
    if (key === 'ayak-bilek') {
      return `
        <svg class="tm-cat-svg tm-cat-svg--ayak" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M78 12 L78 44 C76 56, 85 64, 100 64 L142 64 C148 64, 150 58, 144 54 L114 46 C106 44, 102 36, 102 24 L102 12" stroke="#0F172A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="90" cy="44" r="10" stroke="#0284C7" stroke-width="2.5" fill="#0284C7" fill-opacity="0.15"/>
          <circle cx="90" cy="44" r="4" fill="#00D4AA"/>
        </svg>`;
    }
    if (key === 'lenfodem-bandaj' || key === 'lenfodem-giysi') {
      return `
        <svg class="tm-cat-svg tm-cat-svg--lenfodem" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M55 20 C70 12, 130 12, 145 20 L135 60 C120 68, 80 68, 65 60 Z" fill="#0284C7" fill-opacity="0.1" stroke="#0284C7" stroke-width="2.5"/>
          <path d="M58 28 L142 36 M61 42 L139 50 M64 54 L136 62" stroke="#00D4AA" stroke-width="2.5" stroke-linecap="round"/>
        </svg>`;
    }
    return `
      <svg class="tm-cat-svg tm-cat-svg--all" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <style>
          @keyframes ecgPulse { 0% { stroke-dashoffset: 300; } 100% { stroke-dashoffset: 0; } }
        </style>
        <path d="M20 42 L55 42 L66 22 L76 62 L88 12 L98 56 L108 34 L118 42 L180 42" stroke="#0284C7" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="300" style="animation: ecgPulse 2.4s ease-in-out infinite;"/>
        <circle cx="160" cy="42" r="5" fill="#00D4AA"/>
      </svg>`;
  }

  function buildCategoryPageBanner() {
    const catalog = $('#urunler .container');
    if (!catalog || $('#tmCatBanner')) return;

    const banner = document.createElement('div');
    banner.className = 'tm-cat-banner';
    banner.id = 'tmCatBanner';
    banner.innerHTML = `
      <div class="tm-cat-banner__Info">
        <div class="tm-cat-banner__left">
          <button type="button" class="tm-back-btn" id="tmBackHomeBtn" aria-label="Ana Sayfaya Dön" title="Ana Sayfaya Dön">
            <i class="fas fa-arrow-left" aria-hidden="true"></i>
          </button>
          <div class="tm-cat-banner__titles">
            <h1 class="tm-cat-banner__title" id="tmCatTitle">Tüm Ürünler</h1>
            
          </div>
        </div>
        <div class="tm-cat-banner__visual" id="tmCatVisual" aria-hidden="true">
          ${getCategoryAnimationSVG('korse')}
        </div>
      </div>`;

    catalog.insertBefore(banner, catalog.firstChild);

    $('#tmBackHomeBtn', banner).addEventListener('click', () => {
      exitCategoryPage(true);
    });

    const brandLink = $('.site-header__brand');
    if (brandLink) {
      brandLink.addEventListener('click', (e) => {
        if (document.body.classList.contains('tm-category-mode')) {
          e.preventDefault();
          exitCategoryPage(true);
        }
      });
    }

    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.tmCat) {
        enterCategoryPage(e.state.tmCat, false);
      } else {
        exitCategoryPage(false);
      }
    });
  }

  function enterCategoryPage(key, pushHistory = true) {
    // Arama kutusu ve arama durumunu temizle
    const searchInput = $('#productSearchInput');
    if (searchInput) searchInput.value = '';
    document.body.classList.remove('tm-searching');
    document.body.classList.add('tm-category-mode');
    buildCategoryPageBanner();

    const f = $(`.filter-btn[data-filter="${key}"]`);
    if (f) f.click();

    const catObj = CATEGORIES.find((c) => c.key === key);
    const count = key === 'all' ? products().length : products().filter((p) => p.category === key).length;

    const titleEl = $('#tmCatTitle');
    const descEl = $('#tmCatDesc');
    const visEl = $('#tmCatVisual');

    if (titleEl) titleEl.textContent = catObj ? catObj.name : 'Tüm Ürün Grupları';
    if (descEl) descEl.textContent = "";
    if (visEl) {
      visEl.innerHTML = getCategoryAnimationSVG(key);
    }

    document.body.classList.add('tm-category-mode');
    updateBestsellerVisibility();

    if (pushHistory && window.history && window.history.pushState) {
      try {
        window.history.pushState({ tmCat: key }, '', `#kategori-${key}`);
      } catch (_) {}
    }
  }

  function exitCategoryPage(pushHistory = true) {
    document.body.classList.remove('tm-category-mode');
    const allBtn = $('.filter-btn[data-filter="all"]');
    if (allBtn) allBtn.click();
    updateBestsellerVisibility();

    if (pushHistory && window.history && window.history.pushState) {
      try {
        window.history.pushState({ tmCat: null }, '', window.location.pathname);
      } catch (_) {}
    }
  }

  /* ---------------- 1. HEADER ALTINDA HAREKETLİ GÜVENCE ŞERİDİ ---------------- */
  function buildHeaderMarquee() {
    const header = $('.site-header');
    if (!header || $('#tmHeaderMarquee')) return;

    const items = [
      { icon: 'fa-truck-fast', text: 'Ankara İçi Aynı Gün Adrese Teslimat & Kurulum' },
            { icon: 'fa-file-lines', text: 'SGK Medikal Malzeme Raporu Desteği' },
      { icon: 'fa-phone-volume', text: '0536 352 74 16 • 7/24 Kesintisiz Danışma' },
      { icon: 'fa-hospital', text: 'Aydınlıkevler Merkez Mağaza Stoktan Teslim' }
    ];

    const marquee = document.createElement('div');
    marquee.className = 'tm-marquee';
    marquee.id = 'tmHeaderMarquee';
    marquee.setAttribute('aria-label', 'Atlı Medikal Hizmet Güvenceleri');

    const htmlContent = items
      .map(
        (it) => `
      <span class="tm-marquee__item">
        <i class="fas ${it.icon}" aria-hidden="true"></i>
        <span>${it.text}</span>
      </span>`
      )
      .join('');

    marquee.innerHTML = `
      <div class="tm-marquee__track">
        <div class="tm-marquee__group">
          ${htmlContent}
        </div>
        <div class="tm-marquee__group" aria-hidden="true">
          ${htmlContent}
        </div>
      </div>`;

    header.insertAdjacentElement('afterend', marquee);
  }

  /* ---------------- 2. KAMPANYA VİTRİNİ (ÇİFT POSTERLİ DÖNEN VİTRİN) ---------------- */
  function buildDeals() {
    const main = $('main');
    if (!main || $('#kampanyalar')) return;

    const sec = document.createElement('section');
    sec.className = 'tm-deals tm-deals--fullbanner';
    sec.id = 'kampanyalar';
    sec.setAttribute('aria-label', 'Atlı Medikal Kampanya Vitrini');

    const banners = [
      {
        id: 'tens',
        img: 'images/products/banner-tens-ems-kampanya.png',
        alt: 'Fizik Tedavi ve Masaj Evinizde - TENS ve EMS Cihazı 4.000 TL Kampanya',
        link: 'https://wa.me/905363527416?text=' + encodeURIComponent('Merhaba, TENS ve EMS Masaj Cihazı 4.000 TL Kampanyanız hakkında bilgi ve sipariş almak istiyorum.')
      },
      {
        id: 'cleanped',
        img: 'images/products/banner-cleanped-emici-kulot.png?v=20261025_1848',
        alt: 'Cleanped Emici Külot Hasta Bezi 600 TL yerine 475 TL Süper Fırsat',
        link: 'https://wa.me/905363527416?text=' + encodeURIComponent('Merhaba, Cleanped Emici Külot (L Beden 30 Adet) 475 TL Kampanyanız hakkında bilgi ve sipariş vermek istiyorum.')
      }
    ];

    sec.innerHTML = `
      <div class="container">
        <div class="tm-full-banner-card" id="tmBannerCard">
          <div class="tm-slider-wrapper" id="tmBannerSlider">
            ${banners.map((b, idx) => `
              <div class="tm-banner-slide ${idx === 0 ? 'is-active' : ''}" data-index="${idx}">
                <a href="${b.link}" target="_blank" rel="noopener noreferrer" class="tm-full-banner-link" aria-label="${b.alt}">
                  <img src="${b.img}" alt="${b.alt}" class="tm-full-banner-img">
                </a>
              </div>
            `).join('')}
          </div>

          <!-- Slider Kontrolleri -->
          <button class="tm-banner-arrow tm-banner-arrow--prev" id="bannerPrev" aria-label="Önceki Kampanya">
            <i class="fas fa-chevron-left"></i>
          </button>
          <button class="tm-banner-arrow tm-banner-arrow--next" id="bannerNext" aria-label="Sonraki Kampanya">
            <i class="fas fa-chevron-right"></i>
          </button>

          <!-- Slider Noktaları (Dots) -->
          <div class="tm-banner-dots" id="bannerDots">
            ${banners.map((_, idx) => `
              <button class="tm-dot-btn ${idx === 0 ? 'is-active' : ''}" data-go="${idx}" aria-label="Kampanya ${idx + 1}"></button>
            `).join('')}
          </div>
        </div>
      </div>`;

    main.insertBefore(sec, main.firstChild);

    // Otomatik Dönen Vitrin Mantığı (Süpürme / Wipe efektiyle döner)
    let currentSlide = 0;
    const slides = sec.querySelectorAll('.tm-banner-slide');
    const dots = sec.querySelectorAll('.tm-dot-btn');
    let timer = null;
    let isAnimating = false;

    function goToSlide(n, dirOverride) {
      const nextIdx = (n + slides.length) % slides.length;
      if (nextIdx === currentSlide || isAnimating) return;
      isAnimating = true;

      const dir = dirOverride || (n >= currentSlide ? 'next' : 'prev');
      const prevSlideEl = slides[currentSlide];
      const nextSlideEl = slides[nextIdx];

      // Gelen slaytı başlangıç süpürme konumuna hazırla (animasyonsuz)
      nextSlideEl.classList.remove('is-leaving', 'sweep-out-left', 'sweep-out-right', 'sweep-from-left', 'sweep-from-right');
      prevSlideEl.classList.remove('is-leaving', 'sweep-out-left', 'sweep-out-right', 'sweep-from-left', 'sweep-from-right');

      nextSlideEl.classList.add(dir === 'next' ? 'sweep-from-right' : 'sweep-from-left');
      // Reflow zorla ki tarayıcı başlangıç pozisyonunu algılasın
      void nextSlideEl.offsetWidth;

      // Süpürme geçişini başlat
      prevSlideEl.classList.remove('is-active');
      prevSlideEl.classList.add('is-leaving', dir === 'next' ? 'sweep-out-left' : 'sweep-out-right');

      nextSlideEl.classList.remove('sweep-from-right', 'sweep-from-left');
      nextSlideEl.classList.add('is-active');

      if (dots[currentSlide]) dots[currentSlide].classList.remove('is-active');
      if (dots[nextIdx]) dots[nextIdx].classList.add('is-active');

      currentSlide = nextIdx;

      setTimeout(() => {
        prevSlideEl.classList.remove('is-leaving', 'sweep-out-left', 'sweep-out-right');
        isAnimating = false;
      }, 950);
    }

    function startTimer() {
      stopTimer();
      timer = setInterval(() => {
        goToSlide(currentSlide + 1, 'next');
      }, 7500); // 7.5 saniyede bir süpürme efektiyle döner
    }

    function stopTimer() {
      if (timer) clearInterval(timer);
    }

    const prevBtn = sec.querySelector('#bannerPrev');
    const nextBtn = sec.querySelector('#bannerNext');

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        goToSlide(currentSlide - 1, 'prev');
        startTimer();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        goToSlide(currentSlide + 1, 'next');
        startTimer();
      });
    }

    dots.forEach((dot, idx) => {
      dot.addEventListener('click', (e) => {
        e.preventDefault();
        goToSlide(idx);
        startTimer();
      });
    });

    const card = sec.querySelector('#tmBannerCard');
    if (card) {
      card.addEventListener('mouseenter', stopTimer);
      card.addEventListener('mouseleave', startTimer);
    }

    startTimer();
  }

  /* ---------------- 3. ÖNEMLİ KATEGORİLER YÖNLENDİRME KARTLARI (BİYOMEKANİK MİKRO ANİMASYONLU) ---------------- */
  function buildCategoryCardsSection() {
    if ($('#tmImportantCategories')) return;
    const catalogContainer = $('#urunler .container');
    const grid = $('#productsGrid');
    if (!catalogContainer) return;

    const importantCats = [
      {
        key: 'korse',
        title: 'Ortopedik Korse Grubu',
        image: 'images/categories/cat_korse_animated.svg'
      },
      {
        key: 'dizlik',
        title: 'Dizlik & Alt Ekstremite',
        image: 'images/categories/cat_dizlik_animated.svg'
      },
      {
        key: 'el-kol-omuz',
        title: 'El Bilek, Kol & Omuz',
        image: 'images/categories/cat_bileklik_animated.svg'
      },
      {
        key: 'corap',
        title: 'Varis & Basınçlı Çorap',
        image: 'images/categories/cat_varis_animated.svg'
      }
    ];

    const wrap = document.createElement('div');
    wrap.className = 'tm-important-categories';
    wrap.id = 'tmImportantCategories';
    wrap.setAttribute('aria-label', 'Öne Çıkan Medikal Kategoriler');
    wrap.innerHTML = `
      <div class="tm-important-categories__frame">
        <div class="tm-important-categories__head">
          <h2 class="tm-important-categories__title">Öne Çıkan Medikal Kategoriler</h2>
        </div>

        <div class="tm-important-categories__grid">
          ${importantCats.map(c => `
            <a href="#urunler" class="tm-cat-card tm-cat-card--full" data-target-filter="${c.key}">
              <!-- İleri Düzey Biyomekanik Model Sahnesi (Saf Beyaz Zemin) -->
              <div class="tm-cat-card__pose-stage" aria-hidden="true">
                <img src="${c.image}" alt="${c.title}" class="tm-cat-card__img" loading="lazy">
              </div>

              <!-- Alt Bilgi Paneli: Sadece Başlık ve İncele Butonu -->
              <div class="tm-cat-card__bottom">
                <h3 class="tm-cat-card__title">${c.title}</h3>
                <div class="tm-cat-card__action">
                  <span>Kategori Ürünlerini İncele</span>
                  <i class="fas fa-arrow-right"></i>
                </div>
              </div>
            </a>
          `).join('')}
        </div>
      </div>
    `;

    const catSection = document.getElementById('tmImportantCategories');
    if (catSection && catSection.parentNode) {
      catSection.parentNode.insertBefore(wrap, catSection);
    } else if (grid) {
      catalogContainer.insertBefore(wrap, grid);
    } else {
      catalogContainer.insertBefore(wrap, catalogContainer.firstChild);
    }

    wrap.addEventListener('click', (e) => {
      const card = e.target.closest('[data-target-filter]');
      if (card) {
        e.preventDefault();
        const fKey = card.dataset.targetFilter;
        enterCategoryPage(fKey);
        const uSec = $('#urunler');
        if (uSec) uSec.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  /* ---------------- 4. MARKALARIMIZ BÖLÜMÜ (TEK SATIR AKAN ŞERİT / HOVER PAUSE) ---------------- */
  function buildBrandsSection() {
    if ($('#markalarimiz')) return;
    const catalogContainer = $('#urunler .container');
    const grid = $('#productsGrid');
    if (!catalogContainer) return;

    const brands = [
      { name: 'BAGİTEN', logo: 'images/brands/bagiten.png' },
      { name: 'Cleanped', logo: 'images/brands/cleanped.svg' },
      { name: 'HEAL POINT', logo: 'images/brands/healpoint.png' },
      { name: 'Freshlife', logo: 'images/brands/freshlife.png' },
      { name: 'OrthoBG', logo: 'images/brands/orthobg.svg' },
      { name: 'medi', logo: 'images/brands/medi.svg' },
      { name: 'HARTMANN', logo: 'images/brands/hartmann.svg' },
      { name: 'Canped', logo: 'images/brands/canped.svg' },
      { name: 'Joly', logo: 'images/brands/joly.svg' },
      { name: 'TENA', logo: 'images/brands/tena.svg' },
      { name: 'FREELY', logo: 'images/brands/freely.svg' },
      { name: 'OMRON', logo: 'images/brands/omron.svg' },
      { name: 'RESPIROX', logo: 'images/brands/respirox.svg' }
    ];

    const wrap = document.createElement('div');
    wrap.className = 'tm-brands';
    wrap.id = 'markalarimiz';
    wrap.setAttribute('aria-label', 'Markalarımız');
    wrap.innerHTML = `
      <div class="tm-brands__frame">
        <div class="tm-brands__ticker-wrap">
          <div class="tm-brands__ticker-track">
            ${[...brands, ...brands].map(b => `
              <div class="tm-brand-item" title="${b.name}">
                <img src="${b.logo}" alt="${b.name}" class="tm-brand-item__img" loading="lazy">
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const catSection = document.getElementById('tmImportantCategories');
    if (catSection && catSection.parentNode) {
      catSection.parentNode.insertBefore(wrap, catSection);
    } else if (grid) {
      catalogContainer.insertBefore(wrap, grid);
    } else {
      catalogContainer.insertBefore(wrap, catalogContainer.firstChild);
    }
  }

  /* ---------------- 5. KATALOG VE ÜRÜNLER GÖRÜNÜRLÜĞÜ ---------------- */
  function updateBestsellerVisibility() {
    const grid = $('#productsGrid');
    const filterSec = $('.product-filters') || $('.filter-buttons');
    if (!grid) return;

    // Ürün kataloğu ve filtre butonları her zaman görünürdür!
    grid.style.display = '';
    if (filterSec) filterSec.style.display = '';

    $$('.product-card', grid).forEach((card) => {
      card.classList.remove('tm-hidden-on-home', 'tm-home-popular');
      card.style.order = '';
    });
  }

  /* ---------------- 6. HAKKIMIZDA BÖLÜMÜ ---------------- */
  function buildAboutSection() {
    if ($('#hakkimizda')) return;
    const catalog = $('#urunler');
    const targetParent = catalog ? catalog.parentNode : $('main');
    if (!targetParent) return;

    const about = document.createElement('section');
    about.className = 'tm-about';
    about.id = 'hakkimizda';
    about.setAttribute('aria-label', 'Hakkımızda');
    about.innerHTML = `
      <div class="container">
        <div class="tm-about__grid">
          <div class="tm-about__text">
            <span class="tm-about__eyebrow">KURUMSAL HİKAYEMİZ • 1999'DAN BUGÜNE</span>
            <h2 class="tm-about__title">Hakkımızda • 25 Yıllık Medikal Cihaz ve Hasta Bakım Uzmanlığı</h2>
            <p class="tm-about__lead">
              <strong>Atlı Medikal</strong> olarak 1999 yılından bu yana Ankara Aydınlıkevler'deki merkez mağazamızda, evde hasta bakımından solunum tedavisine, ortopediden mobilite çözümlerine kadar binlerce aileye güvenilir tıbbi cihaz tedariği sağlıyoruz.
            </p>
            <p class="tm-about__para">
              Hastaneden eve taburcu süreçlerinde doğru cihaz seçimi, SGK rapor ve geri ödeme danışmanlığı, Ankara içi aynı gün kendi teknik ekibimizle adrese teslimat ve yatak başında uygulamalı kullanım eğitimi ile yalnızca ürün satışı değil, uçtan uca medikal destek sunuyoruz.
            </p>
          </div>

          <div class="tm-about__stats">
            <div class="tm-stat-card">
              <strong class="tm-stat-card__num">25<span>+</span></strong>
              <span class="tm-stat-card__label">Yıllık Kesintisiz Hizmet</span>
              <p class="tm-stat-card__sub">1999'dan bu yana Ankara'nın güvenilir medikal adresi</p>
            </div>
            <div class="tm-stat-card">
              <strong class="tm-stat-card__num">15.000<span>+</span></strong>
              <span class="tm-stat-card__label">Hizmet Verilen Hasta</span>
              <p class="tm-stat-card__sub">Ankara ve çevre illerde memnuniyet garantili hasta desteği</p>
            </div>
            <div class="tm-stat-card">
              <strong class="tm-stat-card__num">500<span>+</span></strong>
              <span class="tm-stat-card__label">Geniş Ürün Çeşidi</span>
              <p class="tm-stat-card__sub">Hasta yatağından oksijen cihazına, ortopediden sarf malzemelerine</p>
            </div>
            <div class="tm-stat-card tm-stat-card--accent">
              <strong class="tm-stat-card__num">%100</strong>
              <span class="tm-stat-card__label">Orijinal &amp; Belgeli</span>
              <p class="tm-stat-card__sub">Sağlık Bakanlığı onaylı, CE belgeli, garantili tıbbi cihazlar</p>
            </div>
          </div>
        </div>
      </div>`;

    if (catalog && catalog.nextSibling) {
      targetParent.insertBefore(about, catalog.nextSibling);
    } else {
      targetParent.appendChild(about);
    }
  }

  /* ---------------- 7. SOL ÜST ÇERÇEVESİZ MENÜ İKONU & SADE YAN MENÜ ---------------- */
  function buildDrawer() {
    const top = $('.site-header__top');
    if (!top || $('#tmMenuBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tm-menu-btn';
    btn.id = 'tmMenuBtn';
    btn.setAttribute('aria-label', 'Menüyü aç');
    btn.setAttribute('aria-controls', 'tmDrawer');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('title', 'Ürün Grupları Menüsü');
    btn.innerHTML = '<span class="tm-menu-btn__bars" aria-hidden="true"><span></span><span></span><span></span></span>';

    top.insertBefore(btn, top.firstChild);

    const counts = {};
    products().forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });

    const backdrop = document.createElement('div');
    backdrop.className = 'tm-backdrop';
    backdrop.id = 'tmBackdrop';

    const drawer = document.createElement('aside');
    drawer.className = 'tm-drawer';
    drawer.id = 'tmDrawer';
    drawer.setAttribute('aria-label', 'Ana Menü');
    drawer.setAttribute('aria-hidden', 'true');

    drawer.innerHTML = `
      <div class="tm-drawer__head">
        <div class="tm-drawer__brand">ATLI <span>MEDİKAL</span></div>
        <button type="button" class="tm-close" id="tmDrawerClose" aria-label="Kapat">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>

      <div class="tm-drawer__body">
        <div class="tm-label">ÜRÜN GRUPLARI</div>
        <ul class="tm-links">
          <li>
            <button type="button" data-tm-cat="all">
              <span><i class="fas fa-th-large" style="margin-right:8px; opacity:0.7;" aria-hidden="true"></i> Tüm Ürünler</span>
              <small>${products().length}</small>
            </button>
          </li>
          ${CATEGORIES.map(
            (c) => `
            <li>
              <button type="button" data-tm-cat="${c.key}">
                <span>${c.name}</span>
                <small>${counts[c.key] || 0}</small>
              </button>
            </li>`
          ).join('')}
        </ul>


      </div>`;

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    const open = () => {
      drawer.classList.add('is-open');
      backdrop.classList.add('is-open');
      document.body.classList.add('tm-lock');
      drawer.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
    };

    const close = () => {
      drawer.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      document.body.classList.remove('tm-lock');
      drawer.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
    };

    btn.addEventListener('click', open);
    $('#tmDrawerClose').addEventListener('click', close);
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    drawer.addEventListener('click', (e) => {
      const cbtn = e.target.closest('[data-tm-cat]');
      if (cbtn) {
        const catKey = cbtn.dataset.tmCat;
        close();
        const sInp = $('#productSearchInput');
        if (sInp) sInp.value = '';
        document.body.classList.remove('tm-searching');
        enterCategoryPage(catKey, true);
        const uSec = $('#urunler');
        if (uSec) uSec.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }


  /* ---------------- AKILLI ARAMA, ÜRÜN ADI & KATEGORİ TANIMA MOTORU ---------------- */
  const CATEGORY_INTENT_MAP = [
    {
      key: 'metal',
      patterns: ['metal', 'metal grubu', 'tekerlekli', 'sandalye', 'tekerlekli sandalye', 'walker', 'rolator', 'yurutec', 'baston', 'kanedyen', 'karyola', 'hasta yatagi', 'hasta karyolasi']
    },
    {
      key: 'korse',
      patterns: ['kor', 'korse', 'korseler', 'korsesi', 'bel korsesi', 'lumbosakral', 'balenli', 'omurga', 'karin korsesi', 'karin', 'torakolomber', 'postur', 'durus', 'celik balen', 'korse falan']
    },
    {
      key: 'dizlik',
      patterns: ['diz', 'dizlik', 'dizlikler', 'dizligi', 'meniskus', 'patella', 'ligament', 'menteseli', 'diz destegi', 'aci ayarli', 'diz']
    },
    {
      key: 'el-kol-omuz',
      patterns: ['kol askisi', 'kol aski', 'velpo', 'omuz', 'atel', 'ateli', 'splint', 'splinti', 'el bilek', 'karpal tunel', 'mallet finger', 'de quervain', 'basparmak']
    },
    {
      key: 'boyunluk',
      patterns: ['boyunluk', 'boyunluklar', 'nelson', 'servikal', 'boyun fitigi', 'cenelikli', 'boyun']
    },
    {
      key: 'ayak-bilek',
      patterns: ['ayak', 'ayak bilek', 'bileklik', 'topuk dikeni', 'halluks', 'hallux', 'valgus', 'silikon tabanlik', 'malleol', 'ayak destegi']
    },
    {
      key: 'corap',
      patterns: ['varis', 'corap', 'corabi', 'varis corabi', 'basincli corap', 'ccl1', 'ccl2', 'ccl3', 'kulotlu varis', 'dizustu varis', 'dizalti varis']
    },
    {
      key: 'lenfodem-bandaj',
      patterns: ['bandaj', 'kompresyon bandaji', 'kisa cekisli', 'lenfodem bandaj', 'lenfodem set', 'kopuk bandaj']
    },
    {
      key: 'lenfodem-giysi',
      patterns: ['basi giysisi', 'basi eldiveni', 'lenfodem', 'lipodem', 'eldiven', 'kolluk', 'basi kollugu']
    }
  ];

  function detectCategoryIntent(query) {
    const q = norm(query).trim();
    if (!q || q.length < 2) return null;

    // 1. Doğrudan kelime ve kategori anahtarı eşleşmesi
    for (const item of CATEGORY_INTENT_MAP) {
      for (const pat of item.patterns) {
        if (q === pat || q.includes(pat) || pat.includes(q)) {
          return item.key;
        }
      }
    }

    // 2. Kategori isimleriyle doğrudan eşleşme
    for (const c of CATEGORIES) {
      const cNorm = norm(c.name);
      if (cNorm.includes(q) || q.includes(norm(c.key))) {
        return c.key;
      }
    }

    // 3. Ürün isimlerinden kategori tespiti
    const matchedProduct = products().find((p) => {
      const pTitle = norm(p.title);
      return pTitle.includes(q);
    });
    if (matchedProduct && matchedProduct.category) {
      return matchedProduct.category;
    }

    return null;
  }

  function initSmartHeaderSearch() {
    const searchInput = $('#productSearchInput');
    const searchBtn = $('#productSearchBtn');
    if (!searchInput) return;

    // Arama kutusunun altına şık, modern açılır öneri menüsü yerleştir
    const searchWrap = searchInput.closest('.site-header__search') || searchInput.parentElement;
    let dropdown = $('#tmSearchSuggestions');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'tmSearchSuggestions';
      dropdown.className = 'tm-search-dropdown';
      dropdown.hidden = true;
      searchWrap.appendChild(dropdown);
    }

    function executeSearch(rawQuery) {
      dropdown.hidden = true;
      const q = (rawQuery || '').trim();
      if (!q) return;

      const intentCategory = detectCategoryIntent(q);
      if (intentCategory) {
        // "kor" veya "korse" yazıldığında doğrudan kategoriye yönlendir
        enterCategoryPage(intentCategory, true);
        return;
      }

      // Genel arama modunu başlat
      buildCategoryPageBanner();
      document.body.classList.add('tm-category-mode', 'tm-searching');

      const titleEl = $('#tmCatTitle');
      const descEl = $('#tmCatDesc');
      const visEl = $('#tmCatVisual');
      if (titleEl) titleEl.textContent = `"${q}" Arama Sonuçları`;
      if (descEl) descEl.textContent = `"${q}" terimi için medikal ürün kataloğu tarandı.`;
      if (visEl) visEl.innerHTML = `<i class="fas fa-search" style="font-size: 38px; color: #00D4AA;"></i>`;

      if (window.applyMedicalCatalogFilter) {
        window.applyMedicalCatalogFilter('all', q, true, true);
      }

      const catalog = $('#urunler');
      if (catalog) {
        catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

        function renderSuggestions(query) {
      const q = query.trim();
      if (q.length < 2) {
        dropdown.hidden = true;
        dropdown.innerHTML = '';
        return;
      }

      // Eşleşen ürünleri bul
      const terms = norm(q).split(/\s+/).filter(Boolean);
      const matchedProducts = products().filter((p) => {
        const hay = norm(`${p.title} ${p.categoryName} ${p.shortDescription} ${p.sku}`);
        return terms.every((t) => hay.includes(t));
      }).slice(0, 5);

      if (matchedProducts.length === 0) {
        dropdown.hidden = true;
        dropdown.innerHTML = '';
        return;
      }

      let html = `<div class="tm-suggest-section-title">Eşleşen Ürünler</div>`;
      matchedProducts.forEach((p) => {
        html += `
          <div class="tm-suggest-product" data-suggest-id="${esc(p.id)}">
            <img src="${esc(p.image)}" alt="${esc(p.title)}" class="tm-suggest-product__img" onerror="this.onerror=null;this.src='images/logo.png';">
            <div class="tm-suggest-product__body">
              <div class="tm-suggest-product__title">${esc(p.title)}</div>
              <div class="tm-suggest-product__meta">${esc(p.categoryName || '')} • Kod: ${esc(p.sku || '')}</div>
            </div>
          </div>`;
      });

      dropdown.innerHTML = html;
      dropdown.hidden = false;
    }

    let t = null;
    searchInput.addEventListener('input', () => {
      // Yazım anında ana sayfaya ürün dökülmesini kesin olarak engelle;
      // Sadece arama kutusunun altındaki öneri menüsünü güncelle
      const val = searchInput.value.trim();
      if (val.length === 0) {
        document.body.classList.remove('tm-searching');
        dropdown.hidden = true;
        dropdown.innerHTML = '';
      }
      clearTimeout(t);
      t = setTimeout(() => {
        renderSuggestions(searchInput.value);
      }, 120);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        executeSearch(searchInput.value);
      } else if (e.key === 'Escape') {
        dropdown.hidden = true;
      }
    });

    if (searchBtn) {
      searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        executeSearch(searchInput.value);
      });
    }

    dropdown.addEventListener('click', (e) => {
      const catRow = e.target.closest('[data-suggest-cat]');
      if (catRow) {
        const catKey = catRow.dataset.suggestCat;
        dropdown.hidden = true;
        enterCategoryPage(catKey, true);
        return;
      }

      const prodRow = e.target.closest('[data-suggest-id]');
      if (prodRow) {
        const id = prodRow.dataset.suggestId;
        dropdown.hidden = true;
        openQuickView(id);
        return;
      }
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== searchInput && e.target !== searchBtn) {
        dropdown.hidden = true;
      }
    });
  }


  /* ---------------- 8. KART İNDİRİM ETİKETİ VE EMOJİ TEMİZLİĞİ ---------------- */
  function decorateCards() {
    $$('#productsGrid .product-card').forEach((card) => {
      const p = byId(card.dataset.id);
      const box = $('.product-card__price', card);
      if (!p || !box || $('.tm-off', box)) return;
      const pct = offPct(p);
      if (pct) {
        const s = document.createElement('span');
        s.className = 'tm-off';
        s.textContent = `-%${pct}`;
        box.appendChild(s);
      }
    });
  }

  function stripEmoji() {
    const re = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && /^(SCRIPT|STYLE|NOSCRIPT)$/.test(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => { if (re.test(n.nodeValue)) { re.lastIndex = 0; n.nodeValue = n.nodeValue.replace(re, '').replace(/\s{2,}/g, ' '); } re.lastIndex = 0; });
  }

  

  /* ---------------- 9. GOOGLE DEĞERLENDİRME & YORUM ETKİLEŞİMİ ---------------- */
  function initGoogleReviews() {
    const box = $('#googleYorumlar');
    if (!box) return;

    const starsWrap = $('#interactiveStars');
    const rateStatus = $('#rateStatus');
    const commentInput = $('#googleUserComment');
    const btnComment = $('#btnGoogleCommentDirect');
    const btnRate = $('#btnGoogleRateDirect');

    const GOOGLE_REVIEW_URL = 'https://www.google.com/search?q=' + encodeURIComponent('Atlı Medikal Aydınlıkevler Ankara') + '#lrd=0x14d34f64cc8a1ca5:0x17f85564a7e9d4c1,3,,';

    const starDescriptions = {
      1: '1.0 / 5.0 (Geliştirilmeli)',
      2: '2.0 / 5.0 (Orta)',
      3: '3.0 / 5.0 (İyi)',
      4: '4.0 / 5.0 (Çok İyi)',
      5: '5.0 / 5.0 (Mükemmel)'
    };

    let selectedStar = 5;

    if (starsWrap) {
      const starBtns = starsWrap.querySelectorAll('.star-btn');
      
      const updateStarUI = (val) => {
        starBtns.forEach(btn => {
          const s = parseInt(btn.dataset.star, 10);
          btn.classList.toggle('is-active', s <= val);
        });
        if (rateStatus) {
          rateStatus.textContent = starDescriptions[val] || (val + '.0 / 5.0');
        }
      };

      starBtns.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
          const s = parseInt(btn.dataset.star, 10);
          starBtns.forEach(b => {
            const val = parseInt(b.dataset.star, 10);
            b.classList.toggle('is-hovered', val <= s);
          });
        });

        btn.addEventListener('mouseleave', () => {
          starBtns.forEach(b => b.classList.remove('is-hovered'));
          updateStarUI(selectedStar);
        });

        btn.addEventListener('click', () => {
          selectedStar = parseInt(btn.dataset.star, 10);
          updateStarUI(selectedStar);
          showToast('<i class="fas fa-star" style="color:#F59E0B;"></i> ' + selectedStar + ' Yıldız puanınız seçildi! Google Business sayfasına yönlendiriliyorsunuz...');
          setTimeout(() => {
            window.open(GOOGLE_REVIEW_URL, '_blank', 'noopener,noreferrer');
          }, 800);
        });
      });
    }

    if (btnComment) {
      btnComment.addEventListener('click', () => {
        const text = (commentInput ? commentInput.value : '').trim();
        if (text) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => {});
          }
          showToast('<i class="fas fa-check-circle" style="color:#10B981;"></i> Yorumunuz kopyalandı! Açılan Google Business penceresine yapıştırarak yayınlayabilirsiniz.');
        } else {
          showToast('Google Business yorum ve değerlendirme sayfasına yönlendiriliyorsunuz...');
        }
        setTimeout(() => {
          window.open(GOOGLE_REVIEW_URL, '_blank', 'noopener,noreferrer');
        }, 700);
      });
    }

    function showToast(msg) {
      let toast = document.querySelector('.google-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'google-toast';
        document.body.appendChild(toast);
      }
      toast.innerHTML = msg;
      toast.classList.add('is-show');
      setTimeout(() => {
        toast.classList.remove('is-show');
      }, 4500);
    }
  }

  
  /* ---------------- MOBİL UYGULAMA DENEYİMİ DİNAMİK BİLEŞENLERİ ---------------- */
  function initMobileExperience() {
    if (window.innerWidth > 768) return;

    // A. 2 Satırlı Mobil Kategori Şeridini Ekle
    const navbar = $('#navbar');
    if (navbar && !$('#atliMobileCatStrip')) {
      const cats = [
        { key: 'all', name: 'Tümü', icon: 'fa-th-large' },
        { key: 'dizlik', name: 'Dizlik', icon: 'fa-bone' },
        { key: 'solunum', name: 'Solunum', icon: 'fa-lungs' },
        { key: 'mobilite', name: 'Sandalye', icon: 'fa-wheelchair' },
        { key: 'korse', name: 'Korse', icon: 'fa-shield-alt' },
        { key: 'el-kol-omuz', name: 'El & Kol', icon: 'fa-hand-holding-medical' },
        { key: 'bakim', name: 'Hasta Yatağı', icon: 'fa-bed-pulse' },
        { key: 'corap', name: 'Varis Çorabı', icon: 'fa-socks' },
        { key: 'ayak-bilek', name: 'Ayak & Bilek', icon: 'fa-shoe-prints' }
      ];

      const strip = document.createElement('div');
      strip.className = 'atli-mobile-cat-strip atli-mobile-only';
      strip.id = 'atliMobileCatStrip';
      strip.setAttribute('aria-label', 'Mobil Hızlı Kategoriler');
      strip.innerHTML = `
        <div class="atli-mobile-cat-scroll">
          ${cats.map(c => `
            <button type="button" class="atli-cat-pill ${c.key === 'all' ? 'active' : ''}" data-cat="${c.key}">
              <i class="fas ${c.icon}"></i><span>${c.name}</span>
            </button>
          `).join('')}
        </div>
      `;
      navbar.appendChild(strip);

      strip.addEventListener('click', (e) => {
        const btn = e.target.closest('.atli-cat-pill');
        if (!btn) return;
        e.preventDefault();
        const catKey = btn.dataset.cat;
        strip.querySelectorAll('.atli-cat-pill').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');

        if (catKey === 'all') {
          exitCategoryPage(true);
        } else {
          enterCategoryPage(catKey, true);
        }

        const uSec = $('#urunler');
        if (uSec) setTimeout(() => uSec.scrollIntoView({ behavior: 'smooth' }), 100);
      });
    }

    // B. Banner Altı Mobil Kartı Kaldırıldı (Kullanıcı talebi: sadece poster)

    // C. Sabit Alt Dock Menüsü Kaldırıldı (Kullanıcı talebi: eski haline çevir)
  }
  
  function init() {
    try { buildHeaderMarquee(); } catch (e) { console.error('[tema] marquee', e); }
    try { buildDrawer(); } catch (e) { console.error('[tema] menü', e); }
    try { initSmartHeaderSearch(); } catch (e) { console.error('[tema] arama', e); }
    try { buildDeals(); } catch (e) { console.error('[tema] kampanya', e); }
    try { buildCategoryCardsSection(); } catch (e) { console.error('[tema] kategoriler', e); }
    try { buildBrandsSection(); updateBestsellerVisibility(); } catch (e) { console.error('[tema] markalar', e); }
    try { buildAboutSection(); } catch (e) { console.error('[tema] hakkımızda', e); }
    try { buildCategoryPageBanner(); } catch (e) { console.error('[tema] kategori sayfası', e); }
    try { decorateCards(); } catch (e) { console.error('[tema] kart', e); }
    try { initGoogleReviews(); } catch (e) { console.error('[tema] google reviews', e); }
    try { stripEmoji(); } catch (e) { console.error('[tema] emoji', e); }
    try { initMobileExperience(); } catch (e) { console.error('[tema] mobile app', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();




