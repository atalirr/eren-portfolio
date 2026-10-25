#!/usr/bin/env node
/**
 * ATLI MEDİKAL — REVIEWER M5-1 INDEPENDENT END-TO-END USER JOURNEY VERIFICATION
 * 
 * Verifies:
 * 1. Storefront load
 * 2. Category filters (all, bakim, solunum, mobilite, ortopedi)
 * 3. Debounced Turkish search & case folding
 * 4. Quick-View modal open/close flow
 * 5. Add to Cart & Cart Drawer quantity controls, item deletion, subtotal & 1.000 TL free shipping bar
 * 6. LocalStorage persistence ('atli_medikal_cart_v1') across page reloads
 * 7. Checkout modal opening & customer address validation
 * 8. 4 Payment tabs switching (Credit Card + Luhn + installments, Havale + IBAN, Doorstep, WhatsApp 0536 352 74 16)
 * 9. Order submission, confirmation modal, orderId generation, cart clearance & order archive
 * 10. Physical store authority (Aydınlıkevler, Google Maps, 08:30–19:30, live badge, Schema.org LD+JSON)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { chromium } = require('playwright');

const PROJECT_ROOT = path.resolve(__dirname, '..');

let totalChecks = 0;
let passedChecks = 0;
const failures = [];

function check(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failures.push(message);
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let pathname = url.parse(req.url).pathname;
      if (pathname === '/' || pathname === '') pathname = '/index.html';
      pathname = decodeURIComponent(pathname);
      const filePath = path.normalize(path.join(PROJECT_ROOT, pathname));

      if (!filePath.startsWith(PROJECT_ROOT)) {
        res.statusCode = 403;
        res.end('Access Denied');
        return;
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.woff2': 'font/woff2',
          '.woff': 'font/woff',
          '.ttf': 'font/ttf',
          '.txt': 'text/plain; charset=utf-8',
          '.xml': 'application/xml; charset=utf-8'
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(filePath).pipe(res);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port, baseUrl: `http://127.0.0.1:${port}` });
    });
    server.on('error', reject);
  });
}

async function runReviewerJourney() {
  console.log('================================================================');
  console.log('  REVIEWER M5-1 — INDEPENDENT E2E USER JOURNEY VERIFICATION     ');
  console.log('================================================================\n');

  const { server, baseUrl } = await startServer();
  console.log(`Server listening at: ${baseUrl}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  try {
    // ---------------------------------------------------------
    // 1. STOREFRONT LOAD
    // ---------------------------------------------------------
    console.log('--- 1. Storefront Load & Basic Elements ---');
    const response = await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
    check(response.status() === 200, 'index.html loads with HTTP 200');

    const title = await page.title();
    check(title.includes('Atlı Medikal'), `Page title contains "Atlı Medikal" (${title})`);

    const cardCount = await page.locator('.product-card').count();
    check(cardCount === 12, `Product catalog renders exactly 12 product cards (found: ${cardCount})`);

    // ---------------------------------------------------------
    // 2. CATEGORY FILTERS
    // ---------------------------------------------------------
    console.log('\n--- 2. Multi-Facet Category Filtering ---');
    await page.click('.filter-btn[data-filter="solunum"]');
    await page.waitForTimeout(100);
    const solunumCount = await page.locator('.product-card:not(.is-hidden)').count();
    check(solunumCount === 3, `Solunum filter shows 3 products (found: ${solunumCount})`);

    await page.click('.filter-btn[data-filter="mobilite"]');
    await page.waitForTimeout(100);
    const mobiliteCount = await page.locator('.product-card:not(.is-hidden)').count();
    check(mobiliteCount === 2, `Mobilite filter shows 2 products (found: ${mobiliteCount})`);

    await page.click('.filter-btn[data-filter="all"]');
    await page.waitForTimeout(100);
    const allCount = await page.locator('.product-card:not(.is-hidden)').count();
    check(allCount === 12, `All filter restores 12 products (found: ${allCount})`);

    // ---------------------------------------------------------
    // 3. DEBOUNCED TURKISH SEARCH
    // ---------------------------------------------------------
    console.log('\n--- 3. Debounced Turkish Search ---');
    await page.fill('#productSearchInput', 'oksijen');
    await page.waitForTimeout(400); // debounce 250ms
    const oksijenResults = await page.locator('.product-card:not(.is-hidden)').count();
    check(oksijenResults === 1, `Searching "oksijen" yields 1 product (found: ${oksijenResults})`);

    // Test Turkish case-folding: uppercase İ and I
    await page.fill('#productSearchInput', 'OKSİJEN');
    await page.waitForTimeout(400);
    const upperResults = await page.locator('.product-card:not(.is-hidden)').count();
    check(upperResults === 1, `Searching Turkish uppercase "OKSİJEN" yields 1 product`);

    // Search for non-matching keyword
    await page.fill('#productSearchInput', 'xyz_bulunamaz_cihaz_999');
    await page.waitForTimeout(400);
    const noResults = await page.locator('.product-card:not(.is-hidden)').count();
    const emptyStateVisible = await page.locator('#searchNoResults').isVisible();
    check(noResults === 0 && emptyStateVisible, `Non-matching search displays #searchNoResults empty state`);

    // Clear search
    await page.click('#resetSearchBtn');
    await page.waitForTimeout(200);
    const resetCount = await page.locator('.product-card:not(.is-hidden)').count();
    check(resetCount === 12, `Resetting search restores all 12 cards`);

    // ---------------------------------------------------------
    // 4. QUICK-VIEW MODAL OPEN/CLOSE
    // ---------------------------------------------------------
    console.log('\n--- 4. Quick-View Modal Flow (Open & Close) ---');
    const firstQuickView = page.locator('.product-card[data-id="ATL-KRY-01"] [data-quick-view], .product-card[data-sku="ATL-KRY-01"] .btn-quick-view').first();
    await firstQuickView.click();
    await page.waitForTimeout(300);

    const isModalOpen = await page.evaluate(() => document.getElementById('quickViewModal').classList.contains('show'));
    check(isModalOpen, 'Quick-View modal has .show class after click');

    const modalTitle = await page.locator('#qvModalTitle').textContent();
    check(modalTitle.includes('2 Motorlu Elektrikli Hasta Karyolası'), `Modal title matches product title (${modalTitle.trim()})`);

    const techRowsCount = await page.locator('.qv-specs-table tr').count();
    check(techRowsCount >= 8, `Modal technical details table has ${techRowsCount} specifications`);

    // Stepper in quick-view modal
    await page.click('#qvQtyPlus');
    const qvQty = await page.locator('#qvQtyInput').inputValue();
    check(qvQty === '2', `Modal quantity stepper incremented to 2`);

    // Close quick-view modal cleanly via close button
    await page.click('#quickViewCloseBtn');
    await page.waitForTimeout(350);
    const isModalClosed = await page.evaluate(() => !document.getElementById('quickViewModal').classList.contains('show'));
    check(isModalClosed, 'Quick-View modal closed via #quickViewCloseBtn (.show removed)');

    // ---------------------------------------------------------
    // 5. ADD TO CART & CART DRAWER OPERATIONS, FREE SHIPPING
    // ---------------------------------------------------------
    console.log('\n--- 5. Add to Cart, Quantity Controls & Free Shipping Bar ---');
    // Add first item: Motorlu Hasta Karyolası (ATL-KRY-01: 14.500 TL)
    await page.click('.product-card[data-id="ATL-KRY-01"] .btn-add-cart, .product-card[data-sku="ATL-KRY-01"] .btn-add-cart');
    await page.waitForTimeout(400);

    const drawerOpen = await page.evaluate(() => document.getElementById('cartDrawer').classList.contains('show'));
    check(drawerOpen, 'Clicking "Sepete Ekle" on product card opens Cart Drawer (.show present)');

    const cartBadgeCount = await page.locator('#cartCount, .cart-count, [data-cart-count]').first().textContent();
    check(cartBadgeCount.trim() === '1', `Cart badge shows 1 item (found: ${cartBadgeCount.trim()})`);

    // Close drawer to add second item
    await page.click('#cartCloseBtn');
    await page.waitForTimeout(350);

    // Add second item: Boru Tipi Havalı Hasta Yatağı (ATL-HVL-02: 3.250 TL)
    await page.click('.product-card[data-id="ATL-HVL-02"] .btn-add-cart, .product-card[data-sku="ATL-HVL-02"] .btn-add-cart');
    await page.waitForTimeout(400);

    const cartRows = await page.locator('.cart-item, [data-cart-item]').count();
    check(cartRows === 2, `Cart drawer contains 2 distinct item rows (found: ${cartRows})`);

    // Increment ATL-HVL-02 quantity in cart
    const plusBtnSecond = page.locator('.cart-item[data-id="ATL-HVL-02"] .cart-item__plus, .cart-item[data-id="ATL-HVL-02"] [data-qty-plus]').first();
    await plusBtnSecond.click();
    await page.waitForTimeout(300);

    const totalBadge = await page.locator('#cartCount, .cart-count, [data-cart-count]').first().textContent();
    check(totalBadge.trim() === '3', `Total item count is 3 (1 Karyola + 2 Havalı Yatak)`);

    // Subtotal check: 14500*1 + 3250*2 = 14500 + 6500 = 21.000 TL
    const subtotalText = await page.locator('#cartSubtotal').textContent();
    check(subtotalText.includes('21.000'), `Subtotal correctly calculated as 21.000 ₺ (${subtotalText.trim()})`);

    // Free shipping bar check (subtotal >= 1000 TL)
    const freeShippingAchieved = await page.evaluate(() => {
      const fill = document.querySelector('.free-shipping-bar__progress-fill');
      const text = document.querySelector('.free-shipping-bar__text');
      return fill && fill.style.width === '100%' && text && text.textContent.includes('kazandınız');
    });
    check(freeShippingAchieved, 'Free shipping bar shows 100% and free shipping notice');

    // Test item deletion
    console.log('\n--- 5b. Item Deletion in Cart Drawer ---');
    // Remove the second item
    const removeBtn = page.locator('.cart-item[data-id="ATL-HVL-02"] .cart-item__remove, .cart-item[data-id="ATL-HVL-02"] [data-item-remove]').first();
    await removeBtn.click();
    await page.waitForTimeout(300);
    const rowsAfterRemoval = await page.locator('.cart-item, [data-cart-item]').count();
    check(rowsAfterRemoval === 1, `After item removal, cart has 1 row (found: ${rowsAfterRemoval})`);

    // ---------------------------------------------------------
    // 6. LOCALSTORAGE PERSISTENCE ACROSS PAGE RELOAD
    // ---------------------------------------------------------
    console.log('\n--- 6. LocalStorage Persistence Across Reload ---');
    const storageBefore = await page.evaluate(() => localStorage.getItem('atli_medikal_cart_v1'));
    check(Boolean(storageBefore && storageBefore.includes('ATL-KRY-01')), 'localStorage key atli_medikal_cart_v1 stores ATL-KRY-01');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);

    const badgeAfterReload = await page.locator('#cartCount, .cart-count, [data-cart-count]').first().textContent();
    check(badgeAfterReload.trim() === '1', `After page reload, cart badge still displays 1 item`);

    // Open cart drawer again
    await page.click('#cartToggleBtn, .btn-cart-toggle, [data-cart-toggle], #navbar .header-pill-btn--cart');
    await page.waitForTimeout(350);

    // ---------------------------------------------------------
    // 7. CHECKOUT MODAL & ADDRESS VALIDATION
    // ---------------------------------------------------------
    console.log('\n--- 7. Checkout Modal & Address Validation ---');
    await page.click('#cartCheckoutBtn');
    await page.waitForTimeout(350);

    const checkoutVisible = await page.evaluate(() => document.getElementById('checkoutModal').classList.contains('show'));
    check(checkoutVisible, 'Checkout modal opens from Cart Drawer (.show present)');

    // Trigger validation with empty inputs
    await page.evaluate(() => window.CheckoutManager && window.CheckoutManager.validateForm());
    await page.waitForTimeout(200);

    const invalidInputs = await page.locator('#checkoutModal .is-invalid').count();
    check(invalidInputs >= 2, `Form validation catches empty fields (found ${invalidInputs} invalid inputs)`);

    // Fill valid customer delivery details
    await page.fill('#customerFullName', 'Av. Dr. Mehmet Demir');
    await page.fill('#customerPhone', '05329876543');
    await page.selectOption('#customerDistrict', 'Altındağ');
    await page.fill('#customerAddress', 'Aydınlıkevler Mah. Çevreli Cad. No:45/8 Altındağ / Ankara');
    await page.fill('#customerNotes', 'Lütfen aynı gün saat 16:00 sonrası kurulum için geliniz.');

    // ---------------------------------------------------------
    // 8. PAYMENT TABS & SUB-SYSTEMS SWITCHING
    // ---------------------------------------------------------
    console.log('\n--- 8. Payment Method Switcher Tabs ---');

    // A) Credit Card Form + Installments Preview
    await page.click('.payment-method-tab[data-method="credit_card"]');
    await page.waitForTimeout(150);
    const ccPanelVisible = await page.locator('.payment-panel[data-panel="credit_card"]').isVisible();
    check(ccPanelVisible, 'Credit card payment panel is visible');

    // Installments table rendered
    const installmentRows = await page.locator('#installmentTableBody tr').count();
    check(installmentRows === 4, `Installment table contains 4 rows (1, 3, 6, 9 taksit) (found: ${installmentRows})`);

    // Card input auto-formatting & brand detection
    await page.fill('#ccNumber', '4532015112830366'); // Standard Visa
    const brandPreview = await page.locator('#previewCardBrand').textContent();
    check(brandPreview.includes('VISA'), `Card brand correctly detected as VISA (${brandPreview.trim()})`);

    await page.fill('#ccExpiry', '0928');
    const expValue = await page.locator('#ccExpiry').inputValue();
    check(expValue === '09/28', `Card expiry auto-formatted with slash to 09/28 (found: ${expValue})`);

    await page.fill('#ccCvc', '456');
    await page.fill('#ccHolder', 'MEHMET DEMIR');

    // B) Havale / EFT Tab & IBAN Copy
    await page.click('.payment-method-tab[data-method="havale"]');
    await page.waitForTimeout(150);
    const havalePanelVisible = await page.locator('.payment-panel[data-panel="havale"]').isVisible();
    check(havalePanelVisible, 'Havale/EFT payment panel is visible');

    const bankCards = await page.locator('.iban-card').count();
    check(bankCards >= 2, `Bank account IBAN cards displayed (found: ${bankCards})`);

    const ziraatIban = await page.locator('.iban-card:has-text("Ziraat") .iban-code').textContent();
    check(ziraatIban.includes('TR56'), `Ziraat Bankası IBAN displayed accurately (${ziraatIban.trim()})`);

    // C) Ankara Doorstep Payment Tab
    await page.click('.payment-method-tab[data-method="doorstep"]');
    await page.waitForTimeout(150);
    const doorstepPanelVisible = await page.locator('.payment-panel[data-panel="doorstep"]').isVisible();
    check(doorstepPanelVisible, 'Ankara doorstep/installation payment panel is visible');

    // D) WhatsApp 1-Click Order Tab
    await page.click('.payment-method-tab[data-method="whatsapp"]');
    await page.waitForTimeout(150);
    const waPanelVisible = await page.locator('.payment-panel[data-panel="whatsapp"]').isVisible();
    check(waPanelVisible, 'WhatsApp 1-click order panel is visible');

    const waHref = await page.locator('#whatsappOrderBtn').getAttribute('href');
    check(
      waHref.includes('wa.me/905363527416') &&
      waHref.includes(encodeURIComponent('Mehmet Demir')) &&
      waHref.includes(encodeURIComponent('ATL-KRY-01')),
      'WhatsApp order link correctly encodes customer name, product SKU, and targets 0536 352 74 16'
    );

    // ---------------------------------------------------------
    // 9. ORDER SUBMISSION & CONFIRMATION
    // ---------------------------------------------------------
    console.log('\n--- 9. Order Submission & Confirmation ---');
    // Switch back to Credit Card to complete realistic order
    await page.click('.payment-method-tab[data-method="credit_card"]');
    await page.waitForTimeout(150);

    // Submit order
    await page.click('#btnCompleteOrder');
    console.log('  ...Submitting order through 3D Secure simulation...');
    await page.waitForTimeout(1500);

    const successModalVisible = await page.evaluate(() => document.getElementById('orderSuccessModal').classList.contains('show'));
    check(successModalVisible, 'Order confirmation modal (#orderSuccessModal) displayed upon successful submit');

    const confirmedOrderId = await page.locator('#successOrderCode').textContent();
    check(/^ATL-\d{8}-\d{4}$/.test(confirmedOrderId.trim()), `Order ID format matches ATL-YYYYMMDD-XXXX (${confirmedOrderId.trim()})`);

    // Verify cart was cleared
    const cartItemsCountAfter = await page.evaluate(() => window.CartManager.getState().itemCount);
    check(cartItemsCountAfter === 0, `Shopping cart cleared in memory (itemCount = 0)`);

    const cartStorageAfter = await page.evaluate(() => localStorage.getItem('atli_medikal_cart_v1'));
    check(cartStorageAfter === '[]' || !cartStorageAfter, `LocalStorage cart reset to empty array`);

    const pastOrders = await page.evaluate(() => JSON.parse(localStorage.getItem('atli_medikal_orders') || '[]'));
    check(pastOrders.length >= 1 && pastOrders[0].orderId === confirmedOrderId.trim(), 'Order archived into localStorage atli_medikal_orders');

    // ---------------------------------------------------------
    // 10. PHYSICAL STORE AUTHORITY & LEGAL COMPLIANCE
    // ---------------------------------------------------------
    console.log('\n--- 10. Physical Store Authority & Legal Compliance ---');
    // Store address verification
    const bodyText = await page.textContent('body');
    check(
      bodyText.includes('Uzayan') && bodyText.includes('Aydınlıkevler') && bodyText.includes('Altındağ'),
      'Physical store address (Aydınlıkevler, Uzayan Sk., Altındağ) present on page'
    );

    // Phone CTA
    const phoneLinks = await page.locator('a[href*="905363527416"]').count();
    check(phoneLinks >= 3, `Found ${phoneLinks} direct phone links across page targeting 0536 352 74 16`);

    // Google Maps iframe
    const mapsIframe = await page.locator('iframe[src*="google.com/maps"]').count();
    check(mapsIframe >= 1, 'Google Maps iframe embed is present');

    // Live Turkey Time Store Hours Badge
    const badgeText = await page.locator('#storeStatusBadge .store-status-pill__text').textContent();
    check(badgeText && badgeText.length > 3, `Live store status badge is operational (${badgeText.trim()})`);

    // 4 Medical Trust Pillars
    const trustPillars = await page.locator('.store-trust-card').count();
    check(trustPillars === 4, `All 4 medical trust pillars rendered (found: ${trustPillars})`);

    // Schema.org LD+JSON
    const ldJson = await page.locator('script[type="application/ld+json"]').textContent();
    const ldParsed = JSON.parse(ldJson);
    check(
      ldParsed['@type'] === 'MedicalBusiness' &&
      ldParsed.telephone === '+905363527416' &&
      ldParsed.address.streetAddress.includes('Uzayan') &&
      ldParsed.openingHoursSpecification[0].opens === '08:30' &&
      ldParsed.openingHoursSpecification[0].closes === '19:30',
      'Schema.org MedicalBusiness LD+JSON has verified address, phone and opening hours'
    );

    // Modernized legal pages check
    console.log('\n--- 11. Modernized Legal & Error Pages ---');
    const privacyRes = await page.goto(`${baseUrl}/privacy.html`);
    check(privacyRes.status() === 200, 'privacy.html loads with HTTP 200');
    const privacyKVKK = await page.locator('text=6698 SAYILI KVKK').count();
    check(privacyKVKK >= 1, 'privacy.html includes 6698 KVKK notice');

    const termsRes = await page.goto(`${baseUrl}/terms.html`);
    check(termsRes.status() === 200, 'terms.html loads with HTTP 200');
    const termsIyzico = await page.locator('text=İyzico').count();
    check(termsIyzico >= 1, 'terms.html references İyzico / PayTR distance sales payment');

    const errRes = await page.goto(`${baseUrl}/404.html`);
    check(errRes.status() === 200, '404.html loads with HTTP 200');
    const errBadge = await page.locator('.error-code-badge').textContent();
    check(errBadge.trim() === '404', '404.html displays branded 404 badge');

  } catch (err) {
    console.error('Test execution uncaught error:', err);
    failures.push(`Execution error: ${err.message}`);
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n================================================================');
  console.log(`E2E USER JOURNEY VERIFICATION SUMMARY:`);
  console.log(`Total Checks: ${totalChecks}`);
  console.log(`Passed:       ${passedChecks}`);
  console.log(`Failed:       ${failures.length}`);
  console.log(`Status:       ${failures.length === 0 ? 'ALL CHECKS PASSED (100%)' : 'FAILURES DETECTED'}`);
  console.log('================================================================');

  if (failures.length > 0) {
    console.error('\nFailures summary:');
    failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runReviewerJourney();
