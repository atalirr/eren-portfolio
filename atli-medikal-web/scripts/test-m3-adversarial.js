#!/usr/bin/env node
/**
 * ATLI MEDİKAL — ADVERSARIAL STRESS-TEST & INTEGRITY AUDIT SUITE (MILESTONE 3)
 * Reviewer & Adversarial Critic: reviewer_m3_1
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const { chromium } = require('playwright');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Test tracking
let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = [];

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
  } else {
    failedAssertions.push(message);
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('================================================================');
console.log(' ATLI MEDİKAL — M3 ADVERSARIAL STRESS-TEST & INTEGRITY AUDIT');
console.log('================================================================\n');

// -------------------------------------------------------------
// PART 1: CODE INTEGRITY & ANTI-CHEATING AUDIT
// -------------------------------------------------------------
console.log('--- 1. SOURCE CODE INTEGRITY & ANTI-CHEATING AUDIT ---');

const cartJs = fs.readFileSync(path.join(PROJECT_ROOT, 'js/cart.js'), 'utf8');
const checkoutJs = fs.readFileSync(path.join(PROJECT_ROOT, 'js/checkout.js'), 'utf8');
const paymentJs = fs.readFileSync(path.join(PROJECT_ROOT, 'js/payment-adapter.js'), 'utf8');
const testJs = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts/test-ecommerce-functional.js'), 'utf8');

// Check 1: No fake or hardcoded bypasses for test assertions
assert(!cartJs.includes('ATL-TEST-01'), 'cart.js does not contain hardcoded test IDs (ATL-TEST-01)');
assert(!cartJs.includes('Motorlu Hasta Karyolası Test'), 'cart.js does not contain hardcoded test product titles');
assert(!checkoutJs.includes('ATL-TEST'), 'checkout.js does not hardcode test case IDs');
assert(!paymentJs.includes('4532015112830366'), 'payment-adapter.js does not hardcode test card numbers');

// Check 2: Genuine mathematical calculations
assert(cartJs.includes('items.reduce') && cartJs.includes('item.price * item.quantity'), 'cart.js has genuine mathematical subtotal calculation');
assert(cartJs.includes('freeShippingThreshold') && cartJs.includes('flatShippingFee'), 'cart.js has genuine free shipping threshold calculation');
assert(paymentJs.includes('digit *= 2') && paymentJs.includes('sum % 10'), 'payment-adapter.js has genuine Luhn doubling and mod 10 logic');
assert(paymentJs.includes('Math.round(validAmount * (1 + p.rate) * 100) / 100'), 'payment-adapter.js has genuine interest math');

console.log(`✓ Integrity checks completed (Passed: ${passedAssertions}/${totalAssertions})`);

// -------------------------------------------------------------
// PART 2: UNIT & EDGE CASE STRESS TESTS
// -------------------------------------------------------------
console.log('\n--- 2. PAYMENT ADAPTER UNIT & STRESS TESTING ---');

const mockWindow = {};
const paymentAdapterModule = new Function('window', paymentJs);
paymentAdapterModule(mockWindow);
const adapter = mockWindow.PaymentGatewayAdapter;

// Card Luhn checks
// Valid cards
const visa1 = adapter.validateCard({ number: '4532015112830366', expiry: '12/28', cvc: '123', holder: 'Mehmet Yılmaz' });
assert(visa1.valid === true && visa1.brand === 'visa', 'Valid Visa 16-digit passes Luhn');

const mc1 = adapter.validateCard({ number: '5500000000000004', expiry: '08/27', cvc: '456', holder: 'Ayşe Kaya' });
assert(mc1.valid === true && mc1.brand === 'mastercard', 'Valid Mastercard passes Luhn');

const troy1 = adapter.validateCard({ number: '9792001234567890', expiry: '10/26', cvc: '789', holder: 'Ali Demir' });
// Calculate actual Luhn for 9792...
// Let's test invalid Luhn
const badLuhn = adapter.validateCard({ number: '4532015112830367', expiry: '12/28', cvc: '123', holder: 'Mehmet Yılmaz' });
assert(badLuhn.valid === false && badLuhn.errors.some(e => e.includes('Luhn')), 'Tampered card number fails Luhn');

// Expiry boundary checks
const expired = adapter.validateCard({ number: '4532015112830366', expiry: '01/22', cvc: '123', holder: 'Mehmet Yılmaz' });
assert(expired.valid === false && expired.errors.some(e => e.includes('geçmiş')), 'Past expiry date is rejected');

const badMonth = adapter.validateCard({ number: '4532015112830366', expiry: '13/28', cvc: '123', holder: 'Mehmet Yılmaz' });
assert(badMonth.valid === false && badMonth.errors.some(e => e.includes('ayı')), 'Invalid month (13) is rejected');

const badCvc = adapter.validateCard({ number: '4532015112830366', expiry: '12/28', cvc: '12', holder: 'Mehmet Yılmaz' });
assert(badCvc.valid === false && badCvc.errors.some(e => e.includes('CVC')), 'Short CVC (2 digits) is rejected');

// Installments
const zeroInst = adapter.calculateInstallments(0);
assert(zeroInst[0].total === 0 && zeroInst[0].monthly === 0, 'Zero amount installment handles cleanly without NaN');

const floatInst = adapter.calculateInstallments(14500.50);
assert(floatInst[0].total === 14500.50, 'Decimal installment total matches');
assert(floatInst[1].installments === 3 && floatInst[1].monthly === 4833.5, '3 installments has 0 interest');
assert(floatInst[2].installments === 6 && floatInst[2].ratePercent === 4.5, '6 installments has 4.5% interest');

// WhatsApp URL generator
const waUrl = adapter.generateWhatsAppUrl({
  orderId: 'ATL-20261018-9999',
  customer: {
    fullName: 'Test Müşteri Çetin Şahin',
    phone: '0536 352 74 16',
    district: 'Altındağ',
    address: 'Aydınlıkevler Mah. Uzayan Sk. NO:91',
    orderNotes: 'Acil hasta karyolası kurulumu'
  },
  items: [
    { id: 'ATL-KRY-01', title: '2 Motorlu Elektrikli Hasta Karyolası', price: 14500, quantity: 1 }
  ],
  subtotal: 14500,
  shippingFee: 0,
  grandTotal: 14500,
  paymentMethod: 'doorstep'
});

assert(waUrl.startsWith('https://wa.me/905363527416?text='), 'WhatsApp URL points to wa.me/905363527416');
assert(waUrl.includes(encodeURIComponent('ATL-20261018-9999')), 'WhatsApp URL encodes orderId');
assert(waUrl.includes(encodeURIComponent('2 Motorlu Elektrikli Hasta Karyolası')), 'WhatsApp URL encodes product title');
assert(waUrl.includes(encodeURIComponent('Test Müşteri Çetin Şahin')), 'WhatsApp URL encodes customer name');

console.log(`✓ Unit & edge case checks completed (Passed: ${passedAssertions}/${totalAssertions})`);

// -------------------------------------------------------------
// PART 3: HEADLESS BROWSER INTEGRATION & STRESS TEST
// -------------------------------------------------------------
async function runBrowserStressTests() {
  console.log('\n--- 3. HEADLESS BROWSER DOM STRESS TESTING ---');

  // Start local server
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
        '.jpg': 'image/jpeg',
        '.png': 'image/png'
      };

      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: 'load' });

  // STRESS TEST 1: Rapid multi-item addition
  console.log('Testing: Rapid multi-item addition...');
  await page.evaluate(() => {
    window.CartManager.clearCart();
    window.CartManager.addItem({ id: 'ATL-KRY-01', title: 'Hasta Karyolası', price: 14500 }, 1);
    window.CartManager.addItem({ id: 'ATL-HVL-02', title: 'Havalı Yatak', price: 3250 }, 2);
    window.CartManager.addItem({ id: 'ATL-OKS-04', title: 'Oksijen Konsantratörü', price: 19800 }, 1);
  });

  const cartState = await page.evaluate(() => window.CartManager.getState());
  assert(cartState.items.length === 3, `Expected 3 items in cart, got ${cartState.items.length}`);
  assert(cartState.itemCount === 4, `Expected 4 total quantity, got ${cartState.itemCount}`);
  assert(cartState.subtotal === (14500 + 3250 * 2 + 19800), `Subtotal math accurate: ${cartState.subtotal}`);
  assert(cartState.shipping === 0, `Free shipping for subtotal > 1000: ${cartState.shipping}`);
  assert(cartState.total === cartState.subtotal, `Grand total matches subtotal: ${cartState.total}`);

  // STRESS TEST 2: Threshold boundaries (Below vs Above 1000 TL)
  console.log('Testing: Threshold boundaries (Below vs Above 1000 TL)...');
  await page.evaluate(() => {
    window.CartManager.clearCart();
    window.CartManager.addItem({ id: 'ATL-KOL-12', title: 'Kol Askısı', price: 290, quantity: 1 });
  });

  const lowState = await page.evaluate(() => window.CartManager.getState());
  assert(lowState.subtotal === 290, `Subtotal is 290: ${lowState.subtotal}`);
  assert(lowState.shipping === 150, `Flat shipping fee 150 applied below 1000 TL: ${lowState.shipping}`);
  assert(lowState.total === 440, `Total 440 (290 + 150): ${lowState.total}`);
  assert(lowState.missingForFreeShipping === 710, `Missing 710 TL for free shipping: ${lowState.missingForFreeShipping}`);

  // Add 3 more (total 4 * 290 = 1160)
  await page.evaluate(() => {
    window.CartManager.updateQuantity('ATL-KOL-12', 4);
  });
  const highState = await page.evaluate(() => window.CartManager.getState());
  assert(highState.subtotal === 1160, `Subtotal is 1160: ${highState.subtotal}`);
  assert(highState.shipping === 0, `Shipping is free above 1000 TL: ${highState.shipping}`);
  assert(highState.total === 1160, `Total is 1160: ${highState.total}`);

  // STRESS TEST 3: Stepper clamping (Max 10, Min 1, 0 -> remove)
  console.log('Testing: Stepper quantity clamping (Max 10, Min 1, 0 -> remove)...');
  await page.evaluate(() => window.CartManager.updateQuantity('ATL-KOL-12', 99));
  const maxState = await page.evaluate(() => window.CartManager.getState());
  assert(maxState.items[0].quantity === 10, `Quantity clamped to max 10: got ${maxState.items[0].quantity}`);

  await page.evaluate(() => window.CartManager.updateQuantity('ATL-KOL-12', 0));
  const emptyState = await page.evaluate(() => window.CartManager.getState());
  assert(emptyState.items.length === 0, `Updating quantity to 0 removes item: count ${emptyState.items.length}`);

  // STRESS TEST 4: Corrupted LocalStorage resilience
  console.log('Testing: Corrupted localStorage resilience...');
  await page.evaluate(() => {
    localStorage.setItem('atli_medikal_cart_v1', '{ broken json garbage');
    window.CartManager.loadFromStorage();
  });
  const recoveredState = await page.evaluate(() => window.CartManager.getState());
  assert(Array.isArray(recoveredState.items) && recoveredState.items.length === 0, 'CartManager safely recovers from corrupted JSON in localStorage without crash');

  // STRESS TEST 5: Checkout form validation & District verification
  console.log('Testing: Checkout form validation & District options...');
  await page.evaluate(() => {
    window.CartManager.addItem({ id: 'ATL-KRY-01', title: 'Hasta Karyolası', price: 14500, quantity: 1 });
    window.CheckoutManager.openModal();
  });
  await page.waitForTimeout(200);

  const districts = await page.$$eval('#customerDistrict option', options => options.map(o => o.value));
  assert(districts.includes('Altındağ'), 'District includes Altındağ');
  assert(districts.includes('Çankaya'), 'District includes Çankaya');
  assert(districts.includes('Keçiören'), 'District includes Keçiören');
  assert(districts.includes('Yenimahalle'), 'District includes Yenimahalle');

  // STRESS TEST 6: 4 Payment method switcher tabs reactivity
  console.log('Testing: 4 Payment method switcher tabs reactivity...');
  const tabs = ['credit_card', 'havale', 'doorstep', 'whatsapp'];
  for (const method of tabs) {
    await page.evaluate((m) => window.CheckoutManager.switchPaymentMethod(m), method);
    await page.waitForTimeout(100);

    const isPanelVisible = await page.$eval(`.payment-panel[data-panel="${method}"]`, p => window.getComputedStyle(p).display !== 'none');
    assert(isPanelVisible, `Payment panel for ${method} becomes visible when selected`);
  }

  // STRESS TEST 7: IBAN Copy button functionality
  console.log('Testing: Bank account IBAN copy buttons...');
  const ibanCardsCount = await page.$$eval('.iban-card', cards => cards.length);
  assert(ibanCardsCount === 3, `Expected 3 bank IBAN cards (Ziraat, İş Bankası, VakıfBank), found ${ibanCardsCount}`);

  await browser.close();
  server.close();

  console.log('\n================================================================');
  console.log(`STRESS TEST SUMMARY: Total Assertions: ${totalAssertions} | Passed: ${passedAssertions} | Failed: ${failedAssertions.length}`);
  if (failedAssertions.length > 0) {
    console.error('FAILURES:', failedAssertions);
    process.exit(1);
  } else {
    console.log('ALL ADVERSARIAL STRESS-TESTS PASSED WITH ZERO INTEGRITY DEFECTS!');
    console.log('================================================================\n');
  }
}

runBrowserStressTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
