/**
 * ATLI MEDİKAL - MOBİL UYGULAMA ETKİLEŞİM VE VİTRİN DESTEĞİ
 * Yalnızca mobil cihazlarda etkileşim sağlar, masaüstünü asla etkilemez.
 */
document.addEventListener('DOMContentLoaded', () => {
  initMobileCategoryStrip();
  initMobileDock();
  initMobileBannerEnhancement();
});

// Ayrıca dinamik theme-modern yüklemelerinden sonra da kontrol et
window.addEventListener('load', () => {
  setTimeout(() => {
    initMobileBannerEnhancement();
  }, 400);
});

/**
 * 1. Mobil Kayan Kategori Şeridi Etkileşimi
 */
function initMobileCategoryStrip() {
  const pills = document.querySelectorAll('.atli-cat-pill');
  if (!pills.length) return;

  pills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      const catKey = pill.getAttribute('data-cat');
      if (!catKey) return;

      // Aktif sekme stilini güncelle
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      // Theme-Modern çekmecesindeki ilgili butonu tetikle (en kusursuz senkronizasyon)
      const drawerBtn = document.querySelector(`#tmDrawer [data-tm-cat="${catKey}"]`);
      if (drawerBtn) {
        drawerBtn.click();
      } else {
        const filterBtn = document.querySelector(`.filter-btn[data-filter="${catKey}"]`);
        if (filterBtn) filterBtn.click();
        if (window.applyMedicalCatalogFilter) {
          window.applyMedicalCatalogFilter(catKey, '', true, true);
        }
      }

      // Kataloga yumuşakça kaydır
      const catalog = document.getElementById('urunler');
      if (catalog) {
        setTimeout(() => {
          catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    });
  });
}

/**
 * 2. Sabit Mobil Alt Dock Butonları
 */
function initMobileDock() {
  const dockSearch = document.getElementById('dockSearchBtn');
  const dockHome = document.getElementById('dockHomeBtn');
  const searchInput = document.getElementById('productSearchInput');

  if (dockSearch && searchInput) {
    dockSearch.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        searchInput.focus();
      }, 400);
    });
  }

  if (dockHome) {
    dockHome.addEventListener('click', (e) => {
      e.preventDefault();
      // Tüm ürünlere dön
      const allPill = document.querySelector('.atli-cat-pill[data-cat="all"]');
      if (allPill && !allPill.classList.contains('active')) {
        allPill.click();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

/**
 * 3. Kampanya Vitrin Kartı Mobil Alt Bilgi & Hızlı Sipariş Barı
 */
function initMobileBannerEnhancement() {
  const bannerCard = document.getElementById('tmBannerCard') || document.querySelector('.tm-full-banner-card');
  if (!bannerCard || document.getElementById('atliMobileBannerFoot')) return;

  const waUrl = 'https://wa.me/905363527416?text=' + encodeURIComponent('Merhaba, TENS ve EMS Masaj Cihazı 4.000 TL Kampanyanız hakkında bilgi ve sipariş almak istiyorum.');

  const foot = document.createElement('div');
  foot.className = 'atli-mobile-banner-foot atli-mobile-only';
  foot.id = 'atliMobileBannerFoot';
  foot.innerHTML = `
    <div class="atli-mobile-banner-meta">
      <div>
        <div class="atli-mobile-banner-title">TENS & EMS Masaj ve Fizik Tedavi Cihazı</div>
        <div class="atli-mobile-banner-badge">
          <i class="fas fa-truck-fast" style="color: #00D4AA;"></i>
          <span>Ankara İçi Aynı Gün Adrese Kurulum</span>
        </div>
      </div>
      <div class="atli-mobile-banner-price">
        <span class="atli-mobile-price-now">4.000 ₺</span>
        <span class="atli-mobile-price-old">6.500 ₺</span>
      </div>
    </div>
    <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="atli-mobile-banner-cta">
      <i class="fab fa-whatsapp"></i>
      <span>WhatsApp ile Hızlı Sipariş & Bilgi Al</span>
    </a>
  `;

  bannerCard.appendChild(foot);
}
