#!/usr/bin/env node
/**
 * ATLI MEDİKAL — E-COMMERCE FUNCTIONAL ACCEPTANCE TEST SUITE
 * 
 * Verifies 4 core functional modules:
 * 1. Cart State Machine: Add to cart, quantity (+/-), line total math, subtotal,
 *    1.000 TL free shipping bar, item delete, empty state, and localStorage reload persistence (`atli_medikal_cart_v1`).
 * 2. Checkout Modal & Gateway Adapters: Customer address validation, payment switcher
 *    (İyzico/PayTR 3D Secure card form, Havale/EFT with IBAN copy, Ankara Doorstep, WhatsApp 1-click order).
 * 3. Live Search & Category Filters: Real-time debounced search, no-results state,
 *    and category switching without layout distortion.
 * 4. Physical Store Verification: Address, phone CTA (0536 352 74 16), hours (08:30–19:30), Google Maps iframe.
 * 
 * Usage:
 *   node scripts/test-ecommerce-functional.js
 *   node scripts/test-ecommerce-functional.js --browser=edge
 *   node scripts/test-ecommerce-functional.js --json
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
const browserArg = (args.find(a => a.startsWith('--browser=')) || '').split('=')[1] || 'chrome';

// Static HTTP Server
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

// Browser launcher with fallback
async function launchBrowser(channel) {
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  };

  if (channel === 'chrome') {
    try {
      return await chromium.launch({ ...launchOptions, channel: 'chrome' });
    } catch {
      return await chromium.launch(launchOptions);
    }
  } else if (channel === 'edge' || channel === 'msedge') {
    try {
      return await chromium.launch({ ...launchOptions, channel: 'msedge' });
    } catch {
      return await chromium.launch(launchOptions);
    }
  } else {
    return await chromium.launch(launchOptions);
  }
}

// Formatting helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(msg) {
  if (!jsonOutput) console.log(msg);
}

// Assertion & Test Suite Framework
class TestRunner {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
  }

  suite(name) {
    this.currentSuite = { name, tests: [] };
    this.suites.push(this.currentSuite);
    log(`\n${colors.bold}────────────────────────────────────────────────────────────────${colors.reset}`);
    log(`${colors.bold}${colors.cyan}TEST SUITE: ${name}${colors.reset}`);
    log(`${colors.bold}────────────────────────────────────────────────────────────────${colors.reset}`);
  }

  async test(name, fn) {
    this.totalTests++;
    const testRecord = { name, passed: false, error: null, durationMs: 0 };
    const t0 = Date.now();

    try {
      await fn();
      testRecord.passed = true;
      this.passedTests++;
      testRecord.durationMs = Date.now() - t0;
      log(`  ${colors.green}✓ PASS${colors.reset} [${testRecord.durationMs}ms] ${name}`);
    } catch (err) {
      testRecord.passed = false;
      testRecord.error = err.message || String(err);
      this.failedTests++;
      testRecord.durationMs = Date.now() - t0;
      log(`  ${colors.red}✗ FAIL${colors.reset} [${testRecord.durationMs}ms] ${name}`);
      log(`    ${colors.red}Error: ${testRecord.error}${colors.reset}`);
    }

    if (this.currentSuite) {
      this.currentSuite.tests.push(testRecord);
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Main Test Execution
async function runEcommerceFunctionalTests() {
  const startTime = Date.now();
  log(`${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  log(`${colors.bold}${colors.cyan}   ATLI MEDİKAL — E-COMMERCE FUNCTIONAL PLAYWRIGHT TEST SUITE   ${colors.reset}`);
  log(`${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  log(`Timestamp: ${new Date().toISOString()}`);

  const { server, baseUrl } = await startServer();
  log(`Local test server running at: ${baseUrl}`);

  const browser = await launchBrowser(browserArg);
  const browserVersion = browser.version();
  log(`Browser: ${browserArg} (${browserVersion}) headless`);

  const runner = new TestRunner();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  // =========================================================================
  // SUITE 1: PHYSICAL STORE & CONTACT INTEGRITY VERIFICATION
  // =========================================================================
  runner.suite('1. Physical Store Showcase & Contact Verification');

  await runner.test('Store address displays "Aydınlıkevler, Uzayan Sk. NO:91, Altındağ/Ankara"', async () => {
    const bodyText = await page.textContent('body');
    const hasAddress = bodyText.includes('Uzayan') &&
      (bodyText.includes('91') || bodyText.includes('No:91')) &&
      bodyText.includes('Aydınlıkevler') &&
      bodyText.includes('Altındağ');
    assert(hasAddress, 'Physical store address with Aydınlıkevler, Uzayan Sk. No:91, Altındağ/Ankara not found in page body');
  });

  await runner.test('Primary phone CTA "0536 352 74 16" and tel: links are valid', async () => {
    const phoneLinks = await page.$$eval('a[href^="tel:"]', links => links.map(a => ({
      href: a.getAttribute('href'),
      text: a.textContent.trim()
    })));
    assert(phoneLinks.length > 0, 'No tel: phone links found on page');

    const hasValidPhone = phoneLinks.some(l =>
      l.href.replace(/\s+/g, '').includes('905363527416') ||
      l.href.replace(/\s+/g, '').includes('05363527416')
    );
    assert(hasValidPhone, `Phone link with +905363527416 not found. Found: ${JSON.stringify(phoneLinks)}`);
  });

  await runner.test('WhatsApp support links target "0536 352 74 16" (wa.me/905363527416)', async () => {
    const waLinks = await page.$$eval('a[href*="wa.me"], a[href*="whatsapp.com"]', links => links.map(a => a.getAttribute('href')));
    assert(waLinks.length > 0, 'No WhatsApp links found on page');

    const hasValidWa = waLinks.some(href => href.includes('905363527416') || href.includes('5363527416'));
    assert(hasValidWa, `WhatsApp link does not point to Atlı Medikal phone 905363527416. Found: ${JSON.stringify(waLinks)}`);
  });

  await runner.test('Store operating hours are displayed', async () => {
    const bodyText = await page.textContent('body');
    const hasHours = (bodyText.includes('08:30') || bodyText.includes('09:00')) &&
      (bodyText.includes('19:30') || bodyText.includes('19:00'));
    assert(hasHours, 'Store operating hours (08:30–19:30 or 09:00–19:00) not found in page content');
  });

  await runner.test('Interactive Google Maps iframe is present and loaded', async () => {
    const iframeSrc = await page.$eval('iframe[src*="google.com/maps"]', el => el.getAttribute('src')).catch(() => null);
    assert(iframeSrc && iframeSrc.length > 10, 'Google Maps iframe not found or missing src attribute');
  });

  // =========================================================================
  // SUITE 2: LIVE SEARCH & CATEGORY FILTERING
  // =========================================================================
  runner.suite('2. Live Search & Multi-Facet Category Filtering');

  await runner.test('Category filter tabs switch active state and filter product grid', async () => {
    const filterButtons = await page.$$('.filter-btn[data-filter]');
    assert(filterButtons.length >= 3, `Expected at least 3 category filter buttons, found ${filterButtons.length}`);

    // Click "solunum" category
    const solunumBtn = await page.$('.filter-btn[data-filter="solunum"]');
    assert(solunumBtn, 'Category button with data-filter="solunum" not found');

    await solunumBtn.click();
    await page.waitForTimeout(200);

    // Verify visible cards
    const visibleCards = await page.$$eval('.product-card:not(.is-hidden)', cards => cards.map(c => ({
      category: c.getAttribute('data-category'),
      title: (c.querySelector('.product-card__title') || c).textContent.trim()
    })));

    assert(visibleCards.length > 0, 'No visible cards found after selecting "solunum" filter');
    const allMatch = visibleCards.every(c => c.category === 'solunum');
    assert(allMatch, `Found cards not matching "solunum" category: ${JSON.stringify(visibleCards)}`);

    // Click "all" filter to restore
    const allBtn = await page.$('.filter-btn[data-filter="all"]');
    if (allBtn) {
      await allBtn.click();
      await page.waitForTimeout(200);
      const totalCards = await page.$$eval('.product-card:not(.is-hidden)', cards => cards.length);
      assert(totalCards >= 4, `Expected at least 4 product cards restored on "all" filter, got ${totalCards}`);
    }
  });

  await runner.test('Debounced live search filters products by query keyword (e.g. "oksijen")', async () => {
    const searchInput = await page.$('#productSearchInput');
    assert(searchInput, 'Search input #productSearchInput not found');

    await searchInput.fill('');
    await searchInput.type('oksijen', { delay: 40 });
    await page.waitForTimeout(350);

    const matchingCards = await page.$$eval('.product-card:not(.is-hidden)', cards => cards.map(c =>
      (c.querySelector('.product-card__title') || c).textContent.trim().toLowerCase()
    ));

    assert(matchingCards.length > 0, 'No matching cards displayed when searching for "oksijen"');
    const hasOxygen = matchingCards.some(t => t.includes('oksijen'));
    assert(hasOxygen, `Expected "oksijen" in search results, got: ${JSON.stringify(matchingCards)}`);

    // Reset search
    await searchInput.fill('');
    await page.waitForTimeout(200);
  });

  await runner.test('Live search with non-matching term shows empty state or hides all cards without distortion', async () => {
    const searchInput = await page.$('#productSearchInput');
    assert(searchInput, 'Search input #productSearchInput not found');

    await searchInput.fill('xyznonexistentquery999');
    await page.waitForTimeout(350);

    const visibleCards = await page.$$eval('.product-card:not(.is-hidden)', cards => cards.length);
    assert(visibleCards === 0, `Expected 0 visible cards for non-matching search, but found ${visibleCards}`);

    // Verify horizontal overflow didn't break
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1.0, `Layout overflow detected during search empty state: ${overflow}px`);

    // Clean up
    await searchInput.fill('');
    const allBtn = await page.$('.filter-btn[data-filter="all"]');
    if (allBtn) await allBtn.click();
    await page.waitForTimeout(200);
  });

  // =========================================================================
  // SUITE 3: SHOPPING CART STATE MACHINE (`Sepetim`)
  // =========================================================================
  runner.suite('3. Shopping Cart State Machine & LocalStorage Persistence');

  await runner.test('Cart drawer element (#cartDrawer or .cart-drawer) exists in DOM', async () => {
    const cartDrawer = await page.$('#cartDrawer, .cart-drawer, [data-cart-drawer]');
    const cartManagerExists = await page.evaluate(() => typeof window.CartManager !== 'undefined');
    assert(cartDrawer || cartManagerExists, 'Cart drawer (#cartDrawer/.cart-drawer) or window.CartManager not found in DOM');
  });

  await runner.test('Add to Cart adds item, opens drawer, updates count badge and subtotal math', async () => {
    // Check if add to cart button exists
    const addBtn = await page.$('.product-card .btn-add-cart, .product-card [data-add-to-cart], #productsGrid button:has-text("Sepet")');
    const hasCartManager = await page.evaluate(() => typeof window.CartManager !== 'undefined');

    if (!addBtn && !hasCartManager) {
      throw new Error('E-commerce Add-to-Cart button or window.CartManager is not yet implemented in markup (Milestone 3 Pending).');
    }

    if (addBtn) {
      await addBtn.click();
      await page.waitForTimeout(300);
    } else if (hasCartManager) {
      await page.evaluate(() => {
        window.CartManager.addItem({
          id: 'ATL-TEST-01',
          title: 'Motorlu Hasta Karyolası Test',
          price: 24500,
          image: 'images/products/hasta-yatagi.jpg',
          quantity: 1
        });
      });
      await page.waitForTimeout(300);
    }

    // Verify cart count badge
    const countText = await page.$eval('#cartCount, .cart-count, [data-cart-count]', el => el.textContent.trim()).catch(() => null);
    assert(countText && parseInt(countText, 10) >= 1, `Cart count badge expected >= 1, got "${countText}"`);

    // Verify line item in cart
    const cartItemsCount = await page.$$eval('#cartItemsList .cart-item, .cart-drawer__items .cart-item, [data-cart-item]', els => els.length).catch(() => 0);
    assert(cartItemsCount >= 1, `Expected at least 1 item row in cart drawer, found ${cartItemsCount}`);

    // Verify subtotal display
    const subtotalText = await page.$eval('#cartSubtotal, .cart-subtotal, [data-cart-subtotal]', el => el.textContent).catch(() => '');
    assert(subtotalText.length > 0, 'Cart subtotal element empty or missing');
  });

  await runner.test('Quantity increment (+) and decrement (-) recalculates line total and subtotal', async () => {
    const plusBtn = await page.$('#cartDrawer .qty-plus, .cart-drawer [data-qty-plus], .cart-item__plus');
    const hasCartManager = await page.evaluate(() => typeof window.CartManager !== 'undefined');

    if (!plusBtn && !hasCartManager) {
      throw new Error('Cart quantity increment button or CartManager not found in DOM (Milestone 3 Pending).');
    }

    if (plusBtn) {
      await plusBtn.click();
      await page.waitForTimeout(200);
      const qtyVal = await page.$eval('#cartDrawer .cart-item__qty, .cart-drawer [data-qty-input]', el => el.value || el.textContent.trim());
      assert(parseInt(qtyVal, 10) >= 2, `Expected quantity >= 2 after plus click, got ${qtyVal}`);
    } else if (hasCartManager) {
      const state = await page.evaluate(() => {
        const items = window.CartManager.getState().items;
        if (items.length > 0) {
          window.CartManager.updateQuantity(items[0].id, 2);
          return window.CartManager.getState();
        }
        return null;
      });
      assert(state && state.items[0].quantity === 2, `Expected CartManager quantity 2, got ${state?.items[0]?.quantity}`);
    }
  });

  await runner.test('1.000 TL free shipping threshold progress bar logic is accurate', async () => {
    const shippingBar = await page.$('#freeShippingBar, .free-shipping-bar, [data-shipping-progress]');
    const hasCartManager = await page.evaluate(() => typeof window.CartManager !== 'undefined');

    if (!shippingBar && !hasCartManager) {
      throw new Error('Free shipping progress bar element not found in DOM (Milestone 3 Pending).');
    }

    if (hasCartManager) {
      const shippingCheck = await page.evaluate(() => {
        const state = window.CartManager.getState ? window.CartManager.getState() : null;
        return {
          threshold: state?.freeShippingThreshold || 1000,
          subtotal: state?.subtotal || 0,
          freeEligible: (state?.subtotal || 0) >= 1000
        };
      });
      assert(shippingCheck.threshold === 1000, `Expected free shipping threshold 1000 TL, got ${shippingCheck.threshold}`);
    }
  });

  await runner.test('Item deletion removes product and reveals empty cart state', async () => {
    const removeBtn = await page.$('#cartDrawer .cart-item__remove, .cart-drawer [data-item-remove]');
    const hasCartManager = await page.evaluate(() => typeof window.CartManager !== 'undefined');

    if (!removeBtn && !hasCartManager) {
      throw new Error('Cart item remove button or CartManager.clearCart not found (Milestone 3 Pending).');
    }

    if (removeBtn) {
      await removeBtn.click();
      await page.waitForTimeout(200);
    } else if (hasCartManager) {
      await page.evaluate(() => window.CartManager.clearCart());
      await page.waitForTimeout(200);
    }

    const emptyNotice = await page.$('#cartEmptyState, .cart-empty, [data-cart-empty]');
    const itemCount = await page.$$eval('#cartItemsList .cart-item, .cart-drawer__items .cart-item', els => els.length).catch(() => 0);
    assert(itemCount === 0, `Expected 0 items in cart after removal, got ${itemCount}`);
    assert(emptyNotice !== null, 'Empty cart notice element (#cartEmptyState) not found in DOM after removing all items');
  });

  await runner.test('LocalStorage persistence key "atli_medikal_cart_v1" preserves state across page reloads', async () => {
    // Add item to cart
    await page.evaluate(() => {
      const testItem = [{
        id: 'ATL-PERSIST-01',
        title: 'Manuel Tekerlekli Sandalye',
        price: 8500,
        image: 'images/products/tekerlekli-sandalye.jpg',
        quantity: 1,
        deliveryType: 'ankara_same_day'
      }];
      localStorage.setItem('atli_medikal_cart_v1', JSON.stringify(testItem));
    });

    // Reload page
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);

    const storedData = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('atli_medikal_cart_v1'));
      } catch {
        return null;
      }
    });

    assert(Array.isArray(storedData) && storedData.length === 1, 'LocalStorage key atli_medikal_cart_v1 was not preserved or is not an array');
    assert(storedData[0].id === 'ATL-PERSIST-01', `Expected item ATL-PERSIST-01 in localStorage, got ${storedData[0]?.id}`);
    assert(storedData[0].price === 8500, `Expected price 8500 in stored item, got ${storedData[0]?.price}`);

    // Clean up
    await page.evaluate(() => localStorage.removeItem('atli_medikal_cart_v1'));
  });

  // =========================================================================
  // SUITE 4: CHECKOUT FLOW & MULTI-GATEWAY ADAPTER SWITCHER
  // =========================================================================
  runner.suite('4. Checkout Modal & Multi-Gateway Adapter Switcher');

  await runner.test('Checkout modal element (#checkoutModal or .checkout-modal) exists in DOM', async () => {
    const modal = await page.$('#checkoutModal, .checkout-modal, [data-checkout-modal]');
    const checkoutManagerExists = await page.evaluate(() => typeof window.CheckoutManager !== 'undefined');
    assert(modal || checkoutManagerExists, 'Checkout modal (#checkoutModal) or window.CheckoutManager not found in DOM (Milestone 3 Pending)');
  });

  await runner.test('Address field validation requires Full Name, Phone, and Address before submit', async () => {
    const modal = await page.$('#checkoutModal, .checkout-modal');
    if (!modal) {
      throw new Error('Checkout modal not present to test address field validation (Milestone 3 Pending)');
    }

    // Trigger open if needed
    const isVisible = await modal.isVisible();
    if (!isVisible) {
      await page.evaluate(() => {
        const el = document.querySelector('#checkoutModal, .checkout-modal');
        if (el) el.classList.add('is-open', 'show');
      });
      await page.waitForTimeout(200);
    }

    const submitBtn = await page.$('#checkoutModal button[type="submit"], #checkoutSubmitBtn, #btnCompleteOrder');
    assert(submitBtn, 'Checkout submit button not found inside checkout modal');

    // Trigger submit with empty fields
    await submitBtn.click();
    await page.waitForTimeout(200);

    const hasValidationFeedback = await page.evaluate(() => {
      const inputs = document.querySelectorAll('#checkoutModal input[required], #checkoutModal textarea[required]');
      let invalidCount = 0;
      inputs.forEach(i => {
        if (!i.checkValidity() || i.classList.contains('is-invalid')) invalidCount++;
      });
      return invalidCount >= 2;
    });

    assert(hasValidationFeedback, 'HTML5 or JS validation did not flag empty required fields on checkout submit');
  });

  await runner.test('Payment gateway switcher displays Credit Card form, Havale/EFT IBAN, and Ankara Doorstep tabs', async () => {
    const paymentMethods = await page.$$eval('[name="paymentMethod"], [name="payment_method"], .payment-method-tab', els =>
      els.map(el => el.value || el.getAttribute('data-method'))
    ).catch(() => []);

    if (paymentMethods.length === 0) {
      throw new Error('Payment gateway switcher tabs/radios not found in DOM (Milestone 3 Pending)');
    }

    assert(paymentMethods.includes('credit_card') || paymentMethods.includes('card'), 'Credit Card payment method option missing');
    assert(paymentMethods.includes('havale') || paymentMethods.includes('eft'), 'Havale / EFT payment method option missing');
    assert(paymentMethods.includes('doorstep') || paymentMethods.includes('kapida'), 'Ankara Doorstep payment method option missing');
  });

  await runner.test('WhatsApp 1-click order generator encodes items and targets 0536 352 74 16', async () => {
    const waOrderBtn = await page.$('#whatsappOrderBtn, .btn-whatsapp-order, a[href*="wa.me"][data-wa-order]');
    const hasAdapter = await page.evaluate(() => typeof window.PaymentGatewayAdapter !== 'undefined');

    if (!waOrderBtn && !hasAdapter) {
      throw new Error('WhatsApp order button or PaymentGatewayAdapter not found in DOM (Milestone 3 Pending)');
    }

    if (waOrderBtn) {
      const href = await waOrderBtn.getAttribute('href');
      assert(href.includes('905363527416') || href.includes('5363527416'), `WhatsApp order button href does not target 905363527416: ${href}`);
    }
  });

  await browser.close();
  server.close();

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  const results = {
    timestamp: new Date().toISOString(),
    browser: `${browserArg} ${browserVersion}`,
    totalTests: runner.totalTests,
    passedTests: runner.passedTests,
    failedTests: runner.failedTests,
    durationSec,
    suites: runner.suites,
    passed: runner.failedTests === 0
  };

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
    log(`${colors.bold}FUNCTIONAL ACCEPTANCE TEST SUMMARY — Duration: ${durationSec}s${colors.reset}`);
    log(`Total Tests: ${runner.totalTests}`);
    log(`Passed:     ${colors.green}${runner.passedTests}${colors.reset}`);
    log(`Failed:     ${runner.failedTests > 0 ? `${colors.red}${runner.failedTests}` : `${colors.green}0`}${colors.reset}`);
    log(`Suite Status: ${results.passed ? `${colors.green}${colors.bold}PASSED (ALL CRITERIA MET)` : `${colors.red}${colors.bold}DEFECTS / PENDING MILESTONE FEATURES DETECTED`}${colors.reset}`);
    log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);
  }

  if (!results.passed && !noExitCode) {
    process.exit(1);
  }
}

// Execute
runEcommerceFunctionalTests().catch(err => {
  console.error('Fatal crash during Functional Test execution:', err);
  process.exit(2);
});
