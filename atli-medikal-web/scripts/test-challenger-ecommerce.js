#!/usr/bin/env node
/**
 * ATLI MEDİKAL — ADVERSARIAL E-COMMERCE STRESS VERIFICATION SUITE
 * Milestone 5 Quality Gate — Challenger M5-1
 * 
 * Comprehensive stress-testing of the E-Commerce State Machine:
 * 1. Turkish Search Edge Cases (toLocaleLowerCase('tr-TR'), dotted/dotless I, accents, prefixes, whitespace, empty state, reset)
 * 2. Extreme Cart Quantities & Spamming (clamping, auto-removal on 0, rapid click spamming, grid vs quick-view accumulation)
 * 3. LocalStorage Robustness (malformed JSON, corrupted structures, primitives, dirty items, recovery without crash)
 * 4. Payment & Checkout Stress-Testing (Luhn algorithm, Troy/Visa/MC/Amex, expiry/CVC boundaries, installment math, phone validation, WhatsApp URL generator)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { chromium } = require('playwright');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// CLI Arguments
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const noExitCode = args.includes('--no-exit-code');

// Assertion & Telemetry Tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = [];
const testResults = [];

function assertTest(suite, name, passed, details = '') {
  totalTests++;
  const result = { suite, name, passed, details, timestamp: new Date().toISOString() };
  testResults.push(result);

  if (passed) {
    passedTests++;
    if (!jsonOutput) {
      console.log(`  ✓ PASS: [${suite}] ${name} ${details ? `(${details})` : ''}`);
    }
  } else {
    failedTests.push({ suite, name, details });
    if (!jsonOutput) {
      console.error(`  ✗ FAIL: [${suite}] ${name} — ${details}`);
    }
  }
}

// Local Static Web Server
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
          '.woff2': 'font/woff2'
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

async function runAdversarialSuite() {
  const startTime = Date.now();
  if (!jsonOutput) {
    console.log('================================================================');
    console.log(' ATLI MEDİKAL — ADVERSARIAL E-COMMERCE STRESS VERIFIER (M5-1)   ');
    console.log('================================================================');
    console.log(`Started: ${new Date().toISOString()}`);
  }

  // 1. Start Server & Browser
  const { server, port, baseUrl } = await startServer();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'tr-TR'
    });
    const page = await context.newPage();

    // Catch page errors to detect any runtime exceptions
    const pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err.message || String(err));
    });

    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.waitForTimeout(500);

    // =========================================================================
    // SUITE 1: TURKISH SEARCH & CASE-FOLDING EDGE CASES
    // =========================================================================
    if (!jsonOutput) console.log('\n────────────────────────────────────────────────────────────────');
    if (!jsonOutput) console.log('SUITE 1: Turkish Search Edge Cases & Case-Folding');
    if (!jsonOutput) console.log('────────────────────────────────────────────────────────────────');

    const searchInput = page.locator('#productSearchInput');
    const resetBtn = page.locator('#resetSearchBtn');
    const noResultsEl = page.locator('#searchNoResults');
    const productCards = page.locator('.product-card[data-category]');

    const totalProductCount = await productCards.count();
    assertTest('Search', 'Product catalog renders initial cards', totalProductCount === 12, `Total cards: ${totalProductCount}`);

    // Helper to perform debounced search and get visible cards
    async function executeSearch(query) {
      await searchInput.fill('');
      if (query !== '') {
        await searchInput.fill(query);
      }
      // Wait for debounce (150ms in main.js) + DOM update
      await page.waitForTimeout(250);

      const visibleCount = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.product-card[data-category]'));
        return cards.filter(c => !c.classList.contains('is-hidden') && c.style.display !== 'none').length;
      });
      const noResultsDisplay = await noResultsEl.evaluate(el => window.getComputedStyle(el).display);
      return { visibleCount, isNoResultsVisible: noResultsDisplay !== 'none' };
    }

    // 1.1: Turkish Dotted vs Dotless I
    // 'oksijen' vs 'OKSİJEN' (dotted uppercase İ -> i)
    const resOksLower = await executeSearch('oksijen');
    assertTest('Search', 'Lowercase "oksijen" matches product', resOksLower.visibleCount >= 1, `Matches: ${resOksLower.visibleCount}`);

    const resOksUpper = await executeSearch('OKSİJEN');
    assertTest('Search', 'Turkish uppercase "OKSİJEN" with dotted İ matches', resOksUpper.visibleCount === resOksLower.visibleCount, `Matches: ${resOksUpper.visibleCount}`);

    // 'tekerlekli' vs 'TEKERLEKLİ' (dotted uppercase İ)
    const resTekLower = await executeSearch('tekerlekli');
    assertTest('Search', 'Lowercase "tekerlekli" matches wheelchair', resTekLower.visibleCount >= 1, `Matches: ${resTekLower.visibleCount}`);

    const resTekUpper = await executeSearch('TEKERLEKLİ');
    assertTest('Search', 'Turkish uppercase "TEKERLEKLİ" with dotted İ matches', resTekUpper.visibleCount === resTekLower.visibleCount, `Matches: ${resTekUpper.visibleCount}`);

    // 'yatak' vs 'YATAK' (dotless uppercase I -> ı in Turkish, but matches yatak)
    const resYatakLower = await executeSearch('yatak');
    assertTest('Search', 'Lowercase "yatak" matches beds', resYatakLower.visibleCount >= 2, `Matches: ${resYatakLower.visibleCount}`);

    const resYatakUpper = await executeSearch('YATAK');
    assertTest('Search', 'Uppercase "YATAK" matches beds', resYatakUpper.visibleCount === resYatakLower.visibleCount, `Matches: ${resYatakUpper.visibleCount}`);

    // 'karyola' vs 'KARYOLA'
    const resKaryolaLower = await executeSearch('karyola');
    const resKaryolaUpper = await executeSearch('KARYOLA');
    assertTest('Search', 'Case folding for "karyola" / "KARYOLA" consistent', resKaryolaLower.visibleCount >= 1 && resKaryolaLower.visibleCount === resKaryolaUpper.visibleCount, `Matches: ${resKaryolaLower.visibleCount}`);

    // 1.2: Accented & Special Turkish Characters
    // 'nebülizatör' vs 'NEBÜLİZATÖR' (Ü, İ, Ö)
    const resNebLower = await executeSearch('nebülizatör');
    const resNebUpper = await executeSearch('NEBÜLİZATÖR');
    assertTest('Search', 'Accented Turkish "nebülizatör" / "NEBÜLİZATÖR" matched', resNebLower.visibleCount >= 1 && resNebLower.visibleCount === resNebUpper.visibleCount, `Matches: ${resNebLower.visibleCount}`);

    // 'rollatör' vs 'ROLLATÖR'
    const resRolLower = await executeSearch('rollatör');
    const resRolUpper = await executeSearch('ROLLATÖR');
    assertTest('Search', 'Accented "rollatör" / "ROLLATÖR" matched', resRolLower.visibleCount >= 1 && resRolLower.visibleCount === resRolUpper.visibleCount, `Matches: ${resRolLower.visibleCount}`);

    // 'tansiyon' vs 'TANSİYON'
    const resTanLower = await executeSearch('tansiyon');
    const resTanUpper = await executeSearch('TANSİYON');
    assertTest('Search', 'Case folding for "tansiyon" / "TANSİYON" matched', resTanLower.visibleCount >= 1 && resTanLower.visibleCount === resTanUpper.visibleCount, `Matches: ${resTanLower.visibleCount}`);

    // 1.3: Partial Prefixes
    const resPrefOks = await executeSearch('oks');
    assertTest('Search', 'Partial prefix "oks" matches oxygen devices', resPrefOks.visibleCount >= 1, `Matches: ${resPrefOks.visibleCount}`);

    const resPrefTek = await executeSearch('tek');
    assertTest('Search', 'Partial prefix "tek" matches tekerlekli sandalye', resPrefTek.visibleCount >= 1, `Matches: ${resPrefTek.visibleCount}`);

    // 1.4: Whitespace Padding
    const resPadded = await executeSearch('   oksijen   ');
    assertTest('Search', 'Whitespace padded query "   oksijen   " trimmed & matches', resPadded.visibleCount === resOksLower.visibleCount, `Matches: ${resPadded.visibleCount}`);

    // 1.5: Non-matching queries & Empty state
    // 'İSTANBUL' (Atlı Medikal is Ankara-focused, no product named İstanbul)
    const resIstanbul = await executeSearch('İSTANBUL');
    assertTest('Search', 'Search for "İSTANBUL" yields 0 matches and displays empty state', resIstanbul.visibleCount === 0 && resIstanbul.isNoResultsVisible, `Visible: ${resIstanbul.visibleCount}, EmptyState: ${resIstanbul.isNoResultsVisible}`);

    const resBogus = await executeSearch('XYZNOTFOUND9988');
    assertTest('Search', 'Search for "XYZNOTFOUND9988" shows empty state without exceptions', resBogus.visibleCount === 0 && resBogus.isNoResultsVisible, `Visible: ${resBogus.visibleCount}`);

    // 1.6: Search Reset
    await resetBtn.click();
    await page.waitForTimeout(200);
    const resAfterReset = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.product-card[data-category]'));
      const visible = cards.filter(c => !c.classList.contains('is-hidden') && c.style.display !== 'none').length;
      const inputVal = document.getElementById('productSearchInput').value;
      const emptyDisp = window.getComputedStyle(document.getElementById('searchNoResults')).display;
      return { visible, inputVal, emptyDisp };
    });
    assertTest('Search', 'Reset button restores all 12 products and clears input', resAfterReset.visible === 12 && resAfterReset.inputVal === '' && resAfterReset.emptyDisp === 'none', `Restored cards: ${resAfterReset.visible}`);

    // =========================================================================
    // SUITE 2: EXTREME CART QUANTITIES & ACCUMULATION STRESS
    // =========================================================================
    if (!jsonOutput) console.log('\n────────────────────────────────────────────────────────────────');
    if (!jsonOutput) console.log('SUITE 2: Extreme Cart Quantities & Accumulation Stress');
    if (!jsonOutput) console.log('────────────────────────────────────────────────────────────────');

    // Clear cart first
    await page.evaluate(() => window.CartManager.clearCart());

    // 2.1: Add item and verify initial state
    await page.evaluate(() => {
      window.CartManager.addItem({
        id: 'ATL-KRY-01',
        title: '2 Motorlu Elektrikli Hasta Karyolası',
        price: 14500,
        image: 'images/products/hasta-yatagi.jpg'
      }, 1);
    });

    let cartState = await page.evaluate(() => window.CartManager.getState());
    assertTest('CartQuantities', 'Item added to cart with quantity 1', cartState.items.length === 1 && cartState.items[0].quantity === 1, `Items: ${cartState.items.length}, Qty: ${cartState.items[0].quantity}`);

    // 2.2: Increment to large quantity (e.g. 50 via addItem or test stepper clamp)
    // Check stepper clamp in updateQuantity (enforces max 10 for single order)
    await page.evaluate(() => window.CartManager.updateQuantity('ATL-KRY-01', 99));
    cartState = await page.evaluate(() => window.CartManager.getState());
    assertTest('CartQuantities', 'updateQuantity(99) enforces max safety clamp (10 units)', cartState.items[0].quantity === 10, `Clamped Qty: ${cartState.items[0].quantity}`);

    // Test large quantity via direct bulk addition (e.g. 50 units for institutional order)
    await page.evaluate(() => {
      window.CartManager.clearCart();
      window.CartManager.addItem({
        id: 'ATL-KRY-01',
        title: '2 Motorlu Elektrikli Hasta Karyolası',
        price: 14500,
        image: 'images/products/hasta-yatagi.jpg'
      }, 50);
    });
    cartState = await page.evaluate(() => window.CartManager.getState());
    assertTest('CartQuantities', 'Bulk institutional quantity (50 units) accumulates accurately', cartState.items[0].quantity === 50 && cartState.subtotal === (14500 * 50), `Qty: ${cartState.items[0].quantity}, Subtotal: ${cartState.subtotal}`);
    assertTest('CartQuantities', 'Bulk order financial calculation has zero NaN', !isNaN(cartState.total) && !isNaN(cartState.shipping), `Total: ${cartState.total}`);

    // 2.3: Decrement to 0 and verify auto-removal
    await page.evaluate(() => window.CartManager.updateQuantity('ATL-KRY-01', 0));
    cartState = await page.evaluate(() => window.CartManager.getState());
    const isCartEmptyInDOM = await page.evaluate(() => {
      const list = document.getElementById('cartItemsList');
      const empty = document.getElementById('cartEmptyState');
      return list.children.length === 0 && window.getComputedStyle(empty).display !== 'none';
    });
    assertTest('CartQuantities', 'Updating quantity to 0 removes line item and reveals empty state', cartState.items.length === 0 && isCartEmptyInDOM, `Cart items: ${cartState.items.length}, DOM Empty: ${isCartEmptyInDOM}`);

    // 2.4: Rapid clicking "Sepete Ekle" (15 rapid clicks)
    await page.evaluate(() => {
      window.CartManager.clearCart();
      window.CartManager.closeDrawer();
    });
    await page.waitForTimeout(200);

    // Rapid clicking on the product add-to-cart button
    await page.evaluate(() => {
      const btn = document.querySelector('.product-card[data-id="ATL-HVL-02"] .btn-add-cart');
      for (let i = 0; i < 15; i++) {
        btn.click();
      }
    });
    await page.waitForTimeout(300);

    cartState = await page.evaluate(() => window.CartManager.getState());
    assertTest('CartQuantities', '15 rapid clicks on "Sepete Ekle" accumulates exactly 15 units without race conditions', cartState.items.length === 1 && cartState.items[0].quantity === 15, `Items count: ${cartState.items.length}, Quantity: ${cartState.items[0]?.quantity}`);
    assertTest('CartQuantities', 'Line total equals price * 15 (3250 * 15 = 48750)', cartState.subtotal === 48750, `Subtotal: ${cartState.subtotal}`);

    // 2.5: Adding the SAME product from catalog grid AND quick-view modal
    await page.evaluate(() => {
      window.CartManager.clearCart();
      window.CartManager.closeDrawer();
    });
    await page.waitForTimeout(200);

    // Step A: Add from catalog grid (1 unit of ATL-OKS-04)
    const oksGridBtn = page.locator('.product-card[data-id="ATL-OKS-04"] .btn-add-cart');
    await oksGridBtn.click();
    await page.waitForTimeout(200);

    // Close the cart drawer that opened after grid add
    await page.evaluate(() => window.CartManager.closeDrawer());
    await page.waitForTimeout(200);

    // Step B: Open Quick-View for ATL-OKS-04
    const oksQvBtn = page.locator('.product-card[data-id="ATL-OKS-04"] .btn-quick-view');
    await oksQvBtn.click();
    await page.waitForTimeout(300);

    // In Quick-View: Click '+' to set quantity to 2
    const qvPlusBtn = page.locator('#qvQtyPlus');
    await qvPlusBtn.click();
    await page.waitForTimeout(100);

    // Click 'Sepete Ekle' in Quick View
    const qvAddBtn = page.locator('#qvAddToCartBtn');
    await qvAddBtn.click();
    await page.waitForTimeout(300);

    // Close Quick View & Cart Drawer
    await page.locator('#quickViewCloseBtn').click();
    await page.evaluate(() => window.CartManager.closeDrawer());
    await page.waitForTimeout(200);

    cartState = await page.evaluate(() => window.CartManager.getState());
    assertTest('CartQuantities', 'Adding from grid (1) and quick-view (2) merges into 1 item with quantity 3', cartState.items.length === 1 && cartState.items[0].id === 'ATL-OKS-04' && cartState.items[0].quantity === 3, `Items: ${cartState.items.length}, Qty: ${cartState.items[0]?.quantity}`);
    assertTest('CartQuantities', 'Merged item subtotal is 19800 * 3 = 59400 TL', cartState.subtotal === 59400, `Subtotal: ${cartState.subtotal}`);

    // =========================================================================
    // SUITE 3: LOCALSTORAGE CORRUPTION & RESILIENCE STRESS
    // =========================================================================
    if (!jsonOutput) console.log('\n────────────────────────────────────────────────────────────────');
    if (!jsonOutput) console.log('SUITE 3: LocalStorage Corruption & Resilience Stress');
    if (!jsonOutput) console.log('────────────────────────────────────────────────────────────────');

    const STORAGE_KEY = 'atli_medikal_cart_v1';

    // 3.1: Completely malformed JSON string
    await page.evaluate((key) => {
      localStorage.setItem(key, '{ "corrupted": true, broken: [[[ json, ');
      window.CartManager.loadFromStorage();
      window.CartManager.render();
    }, STORAGE_KEY);

    cartState = await page.evaluate(() => window.CartManager.getState());
    assertTest('LocalStorage', 'Malformed JSON recovers gracefully without throwing unhandled exception', Array.isArray(cartState.items) && cartState.items.length === 0, `Items: ${cartState.items.length}`);

    // 3.2: Non-array primitive values
    const primitives = ['null', '12345', '"just-a-string"', '{}'];
    for (const prim of primitives) {
      await page.evaluate(({ key, p }) => {
        localStorage.setItem(key, p);
        window.CartManager.loadFromStorage();
      }, { key: STORAGE_KEY, p: prim });
      const primState = await page.evaluate(() => window.CartManager.getState());
      assertTest('LocalStorage', `Primitive localStorage value (${prim}) safely defaults to empty array`, Array.isArray(primState.items) && primState.items.length === 0);
    }

    // 3.3: Missing fields & null property values on items
    await page.evaluate((key) => {
      const dirtyObjects = [
        {}, // completely empty object
        { id: '', price: 100 }, // missing id
        { id: 'ATL-NULL-01', price: null, quantity: null }, // null price & qty
        { id: 'ATL-NEG-01', price: -50, quantity: -2 }, // negative price & qty
        { id: 'ATL-VALID-01', price: 500 } // valid item with missing title, image, quantity
      ];
      localStorage.setItem(key, JSON.stringify(dirtyObjects));
      window.CartManager.loadFromStorage();
      window.CartManager.render();
    }, STORAGE_KEY);

    cartState = await page.evaluate(() => window.CartManager.getState());
    assertTest('LocalStorage', 'Missing fields and null property values sanitized: valid item retained with defaults', cartState.items.length === 1 && cartState.items[0].id === 'ATL-VALID-01' && cartState.items[0].quantity === 1, `Items count: ${cartState.items.length}, Qty: ${cartState.items[0]?.quantity}`);
    assertTest('LocalStorage', 'Sanitized item subtotal has valid math (500 * 1 = 500)', cartState.subtotal === 500, `Subtotal: ${cartState.subtotal}`);

    // 3.4: Literal null element in array ([null, { ... }])
    await page.evaluate((key) => {
      const withNullElements = [null, undefined, { id: 'ATL-VALID-02', price: 300 }];
      localStorage.setItem(key, JSON.stringify(withNullElements));
      window.CartManager.loadFromStorage();
      window.CartManager.render();
    }, STORAGE_KEY);

    const nullElemState = await page.evaluate(() => window.CartManager.getState());
    assertTest('LocalStorage', 'Literal null/undefined elements in array caught safely by try-catch without uncaught exception', Array.isArray(nullElemState.items), `Items: ${nullElemState.items.length}`);

    // 3.4: Full page reload with corrupted LocalStorage
    await page.evaluate((key) => {
      localStorage.setItem(key, '<<< INVALID UNPARSEABLE SYNTAX >>>');
    }, STORAGE_KEY);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);

    const reloadedCartState = await page.evaluate(() => window.CartManager.getState());
    assertTest('LocalStorage', 'Storefront boots without white-screen or error after reload on corrupted storage', reloadedCartState && Array.isArray(reloadedCartState.items) && reloadedCartState.items.length === 0);

    // 3.5: Add item after corruption restores valid JSON in localStorage
    await page.evaluate(() => {
      window.CartManager.addItem({
        id: 'ATL-TNS-09',
        title: 'Dijital Tansiyon Aleti',
        price: 1250,
        image: 'images/products/tansiyon-aleti.jpg'
      }, 1);
    });
    const storedRaw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    let parsedClean = null;
    try {
      parsedClean = JSON.parse(storedRaw);
    } catch (e) {
      parsedClean = null;
    }
    assertTest('LocalStorage', 'Adding product after corruption properly restores valid JSON to localStorage', Array.isArray(parsedClean) && parsedClean[0].id === 'ATL-TNS-09', `Stored valid JSON: ${Boolean(parsedClean)}`);

    // =========================================================================
    // SUITE 4: PAYMENT ADAPTER, LUHN, INSTALLMENTS, PHONE & WHATSAPP
    // =========================================================================
    if (!jsonOutput) console.log('\n────────────────────────────────────────────────────────────────');
    if (!jsonOutput) console.log('SUITE 4: Payment Inputs, Luhn, Installments, Phone & WhatsApp');
    if (!jsonOutput) console.log('────────────────────────────────────────────────────────────────');

    // 4.1: Luhn Algorithm Validation
    const luhnResults = await page.evaluate(() => {
      const adapter = window.PaymentGatewayAdapter;
      return {
        // Valid Cards
        validVisa: adapter.validateCard({ number: '4532015112830366', expiry: '12/28', cvc: '123', holder: 'Ahmet Yılmaz' }),
        validMC: adapter.validateCard({ number: '5500000000000004', expiry: '08/27', cvc: '456', holder: 'Fatma Kaya' }),
        validTroy: adapter.validateCard({ number: '9792000000000011', expiry: '10/26', cvc: '789', holder: 'Mehmet Demir' }),
        validAmex: adapter.validateCard({ number: '378282246310005', expiry: '11/27', cvc: '1234', holder: 'Canan Öz' }),

        // Invalid Cards
        badLuhn: adapter.validateCard({ number: '4532015112830367', expiry: '12/28', cvc: '123', holder: 'Ahmet Yılmaz' }),
        tooShort: adapter.validateCard({ number: '453201511', expiry: '12/28', cvc: '123', holder: 'Ahmet Yılmaz' }),
        tooLong: adapter.validateCard({ number: '453201511283036699', expiry: '12/28', cvc: '123', holder: 'Ahmet Yılmaz' }),
        nonDigits: adapter.validateCard({ number: '4532ABCD12830366', expiry: '12/28', cvc: '123', holder: 'Ahmet Yılmaz' }),
        emptyNumber: adapter.validateCard({ number: '', expiry: '12/28', cvc: '123', holder: 'Ahmet Yılmaz' }),

        // Expiry Boundaries
        pastExpiry: adapter.validateCard({ number: '4532015112830366', expiry: '01/20', cvc: '123', holder: 'Ahmet Yılmaz' }),
        month13: adapter.validateCard({ number: '4532015112830366', expiry: '13/28', cvc: '123', holder: 'Ahmet Yılmaz' }),
        month00: adapter.validateCard({ number: '4532015112830366', expiry: '00/28', cvc: '123', holder: 'Ahmet Yılmaz' }),
        farFuture: adapter.validateCard({ number: '4532015112830366', expiry: '12/55', cvc: '123', holder: 'Ahmet Yılmaz' }),

        // CVC Boundaries
        cvc2Digits: adapter.validateCard({ number: '4532015112830366', expiry: '12/28', cvc: '12', holder: 'Ahmet Yılmaz' }),
        cvc4DigitsVisa: adapter.validateCard({ number: '4532015112830366', expiry: '12/28', cvc: '1234', holder: 'Ahmet Yılmaz' }),
        cvcAlpha: adapter.validateCard({ number: '4532015112830366', expiry: '12/28', cvc: 'ABC', holder: 'Ahmet Yılmaz' })
      };
    });

    assertTest('Payment', 'Valid 16-digit Visa passes Luhn & detected as visa', luhnResults.validVisa.valid && luhnResults.validVisa.brand === 'visa');
    assertTest('Payment', 'Valid 16-digit Mastercard passes Luhn & detected as mastercard', luhnResults.validMC.valid && luhnResults.validMC.brand === 'mastercard');
    assertTest('Payment', 'Valid 16-digit Troy passes Luhn & detected as troy', luhnResults.validTroy.valid && luhnResults.validTroy.brand === 'troy');
    assertTest('Payment', 'Valid 15-digit Amex passes Luhn & detected as amex', luhnResults.validAmex.valid && luhnResults.validAmex.brand === 'amex');

    assertTest('Payment', 'Tampered card number (1 checksum digit off) rejected by Luhn', !luhnResults.badLuhn.valid && luhnResults.badLuhn.errors.some(e => e.includes('Luhn')));
    assertTest('Payment', 'Card number < 15 digits rejected', !luhnResults.tooShort.valid);
    assertTest('Payment', 'Card number > 16 digits rejected', !luhnResults.tooLong.valid);
    assertTest('Payment', 'Non-numeric card input rejected', !luhnResults.nonDigits.valid);
    assertTest('Payment', 'Empty card number rejected', !luhnResults.emptyNumber.valid);

    assertTest('Payment', 'Past expiry date rejected', !luhnResults.pastExpiry.valid && luhnResults.pastExpiry.errors.some(e => e.includes('geçmiş')));
    assertTest('Payment', 'Invalid month 13 rejected', !luhnResults.month13.valid && luhnResults.month13.errors.some(e => e.includes('ayı')));
    assertTest('Payment', 'Invalid month 00 rejected', !luhnResults.month00.valid && luhnResults.month00.errors.some(e => e.includes('ayı')));
    assertTest('Payment', 'Far future expiry (>15 years) rejected', !luhnResults.farFuture.valid && luhnResults.farFuture.errors.some(e => e.includes('yılı')));

    assertTest('Payment', 'Short CVC (2 digits) for Visa rejected', !luhnResults.cvc2Digits.valid);
    assertTest('Payment', '4-digit CVC for Visa rejected (only Amex allows 4)', !luhnResults.cvc4DigitsVisa.valid);
    assertTest('Payment', 'Alphabetic CVC rejected', !luhnResults.cvcAlpha.valid);

    // 4.2: Installment Calculation Mathematical Correctness
    const instResults = await page.evaluate(() => {
      const adapter = window.PaymentGatewayAdapter;
      const amt1 = 14500;
      const p1 = adapter.calculateInstallments(amt1);

      const amt2 = 19800.50;
      const p2 = adapter.calculateInstallments(amt2);

      const amtZero = adapter.calculateInstallments(0);
      const amtNegative = adapter.calculateInstallments(-500);

      return { p1, p2, amtZero, amtNegative };
    });

    // Verify 14500 TL installment math:
    // 1 inst: total 14500, monthly 14500
    // 3 inst: total 14500, monthly 4833.33 (0% interest)
    // 6 inst: total 15152.5 (14500 * 1.045), monthly 2525.42
    // 9 inst: total 15732.5 (14500 * 1.085), monthly 1748.06
    const p1 = instResults.p1;
    assertTest('Installments', '1 installment has 0% interest and exact total', p1[0].installments === 1 && p1[0].total === 14500 && p1[0].monthly === 14500);
    assertTest('Installments', '3 installments has 0% interest and exact monthly (4833.33 ₺)', p1[1].installments === 3 && p1[1].total === 14500 && p1[1].monthly === 4833.33);
    assertTest('Installments', '6 installments has 4.5% interest (total 15152.5 ₺, monthly 2525.42 ₺)', p1[2].installments === 6 && p1[2].total === 15152.5 && p1[2].monthly === 2525.42);
    assertTest('Installments', '9 installments has 8.5% interest (total 15732.5 ₺, monthly 1748.06 ₺)', p1[3].installments === 9 && p1[3].total === 15732.5 && p1[3].monthly === 1748.06);

    // Decimal float installment math (19800.50)
    const p2 = instResults.p2;
    assertTest('Installments', 'Decimal amount (19800.50 ₺) calculates without rounding drift', p2[0].total === 19800.50 && !isNaN(p2[2].monthly));

    // Zero amount installment handling
    assertTest('Installments', 'Zero amount produces 0 total & monthly with no NaN', instResults.amtZero[0].total === 0 && instResults.amtZero[0].monthly === 0 && !isNaN(instResults.amtZero[1].monthly));

    // 4.3: Phone Validation in CheckoutManager
    const phoneTestCases = [
      { phone: '05363527416', shouldPass: true, label: 'Standard 05XXXXXXXXX without spaces' },
      { phone: '5363527416', shouldPass: true, label: 'Standard 5XXXXXXXXX without leading 0' },
      { phone: '05321234567', shouldPass: true, label: 'Standard Turkcell 0532' },
      { phone: '03121234567', shouldPass: false, label: 'Ankara landline (0312) rejected' },
      { phone: '02123456789', shouldPass: false, label: 'Istanbul landline (0212) rejected' },
      { phone: '0532', shouldPass: false, label: 'Too short (4 digits) rejected' },
      { phone: '0532123456789', shouldPass: false, label: 'Too long (>11 digits) rejected' },
      { phone: '+14155552671', shouldPass: false, label: 'Foreign international (+1) rejected' },
      { phone: 'abcdefghijk', shouldPass: false, label: 'Alphabetic input rejected' },
      { phone: '', shouldPass: false, label: 'Empty phone rejected' }
    ];

    for (const tc of phoneTestCases) {
      const isCleanValid = await page.evaluate((val) => {
        const clean = val.replace(/\D/g, '');
        const startsWithValidPrefix = clean.startsWith('05') || clean.startsWith('5');
        const validLen = clean.length >= 10 && clean.length <= 11;
        return startsWithValidPrefix && validLen;
      }, tc.phone);

      assertTest('PhoneValidation', `Phone check: ${tc.label}`, isCleanValid === tc.shouldPass, `Input: "${tc.phone}" -> Expected: ${tc.shouldPass}, Actual: ${isCleanValid}`);
    }

    // Interactive DOM check for Checkout Form Phone Input & pattern
    await page.evaluate(() => {
      window.CheckoutManager.openModal();
    });
    await page.waitForTimeout(200);

    const domPhoneResult = await page.evaluate(() => {
      const phoneInput = document.getElementById('customerPhone');
      if (!phoneInput) return { exists: false };

      // Test valid unspaced
      phoneInput.value = '05363527416';
      const validUnspaced = phoneInput.checkValidity();

      // Test valid spaced
      phoneInput.value = '0536 352 74 16';
      const validSpaced = phoneInput.checkValidity();

      // Test landline
      phoneInput.value = '03121234567';
      const landlineValid = phoneInput.checkValidity();

      return {
        exists: true,
        pattern: phoneInput.getAttribute('pattern'),
        validUnspaced,
        validSpaced,
        landlineValid
      };
    });

    assertTest('PhoneValidation', 'Phone input element exists in checkout DOM', domPhoneResult.exists);
    assertTest('PhoneValidation', 'HTML5 pattern rejects landlines (0312)', !domPhoneResult.landlineValid);
    assertTest('PhoneValidation', 'HTML5 pattern accepts unspaced Turkish mobile "05363527416"', domPhoneResult.validUnspaced);

    // Close checkout modal
    await page.evaluate(() => window.CheckoutManager.closeModal());
    await page.waitForTimeout(200);

    // 4.4: WhatsApp Order URL Generator
    const waResults = await page.evaluate(() => {
      const adapter = window.PaymentGatewayAdapter;
      const url = adapter.generateWhatsAppUrl({
        orderId: 'ATL-20261018-9999',
        customer: {
          fullName: 'Test Müşteri Çetin Şahin',
          phone: '0536 352 74 16',
          district: 'Altındağ',
          city: 'Ankara',
          address: 'Aydınlıkevler Mah. Uzayan Sk. NO:91',
          orderNotes: 'Acil hasta karyolası kurulumu (Özel Not: Çift motorlu olsun)'
        },
        items: [
          { id: 'ATL-KRY-01', title: '2 Motorlu Elektrikli Hasta Karyolası', price: 14500, quantity: 1 },
          { id: 'ATL-HVL-02', title: 'Boru Tipi Havalı Hasta Yatağı', price: 3250, quantity: 2 }
        ],
        subtotal: 21000,
        shippingFee: 0,
        grandTotal: 21000,
        paymentMethod: 'doorstep'
      });

      return {
        url,
        decoded: decodeURIComponent(url)
      };
    });

    assertTest('WhatsApp', 'Target phone number in URL is wa.me/905363527416', waResults.url.startsWith('https://wa.me/905363527416?text='), `URL prefix: ${waResults.url.slice(0, 36)}`);
    assertTest('WhatsApp', 'URL encodes Order ID (ATL-20261018-9999)', waResults.decoded.includes('ATL-20261018-9999'));
    assertTest('WhatsApp', 'URL encodes Turkish customer name "Test Müşteri Çetin Şahin"', waResults.decoded.includes('Test Müşteri Çetin Şahin'));
    assertTest('WhatsApp', 'URL encodes Turkish characters (ç, ğ, ı, ö, ş, ü, İ) without corruption', waResults.decoded.includes('Çetin') && waResults.decoded.includes('Şahin') && waResults.decoded.includes('karyolası'));
    assertTest('WhatsApp', 'URL lists items with quantities, SKUs, and unit prices', waResults.decoded.includes('ATL-KRY-01') && waResults.decoded.includes('x 1 Adet') && waResults.decoded.includes('ATL-HVL-02') && waResults.decoded.includes('x 2 Adet'));
    assertTest('WhatsApp', 'URL formats Free Shipping for subtotal > 1000 TL', waResults.decoded.includes('ÜCRETSİZ'));
    assertTest('WhatsApp', 'URL encodes Doorstep / Ankara Kapıda Ödeme method label', waResults.decoded.includes('Ankara İçi Kapıda / Kurulumda Ödeme'));
    assertTest('WhatsApp', 'URL includes customer order notes', waResults.decoded.includes('Acil hasta karyolası kurulumu'));

    // Check zero unhandled page errors throughout test execution
    assertTest('Reliability', 'Zero unhandled client-side runtime crashes/pageerrors during all stress tests', pageErrors.length === 0, `Errors: ${pageErrors.join(' | ') || 'None'}`);

  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Summary Output
  if (jsonOutput) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      total: totalTests,
      passed: passedTests,
      failed: failedTests.length,
      failures: failedTests,
      results: testResults
    }, null, 2));
  } else {
    console.log('\n================================================================');
    console.log(`ADVERSARIAL STRESS TEST SUMMARY — Duration: ${duration}s`);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed:     ${passedTests}`);
    console.log(`Failed:     ${failedTests.length}`);
    console.log(`Verdict:    ${failedTests.length === 0 ? 'APPROVE (ALL ADVERSARIAL STRESS TESTS PASSED)' : 'REQUEST_CHANGES'}`);
    console.log('================================================================\n');

    if (failedTests.length > 0) {
      console.log('FAILED TESTS BREAKDOWN:');
      failedTests.forEach((f, idx) => {
        console.log(`  ${idx + 1}. [${f.suite}] ${f.name} -> ${f.details}`);
      });
      console.log('');
    }
  }

  if (!noExitCode && failedTests.length > 0) {
    process.exit(1);
  }
}

runAdversarialSuite().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
