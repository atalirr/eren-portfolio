const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

async function testModal() {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    let p = req.url === '/' ? '/index.html' : req.url;
    p = p.split('?')[0];
    const f = path.join(root, decodeURIComponent(p));
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      const ext = path.extname(f).toLowerCase();
      const mimes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.jpg': 'image/jpeg',
        '.png': 'image/png'
      };
      res.writeHead(200, { 'Content-Type': mimes[ext] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(0, async () => {
    const port = server.address().port;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + port, { waitUntil: 'load' });

    console.log('--- TEST 1: Open Quick View on ATL-KRY-01 ---');
    const firstQvBtn = await page.$('.product-card[data-id="ATL-KRY-01"] [data-quick-view]');
    if (!firstQvBtn) throw new Error('Quick view button for ATL-KRY-01 not found');
    await firstQvBtn.click();
    await page.waitForTimeout(300);

    const isModalVisible = await page.$eval('#quickViewModal', el => el.classList.contains('show'));
    console.log('Modal is open:', isModalVisible);
    if (!isModalVisible) throw new Error('Modal did not open');

    const titleText = await page.$eval('#qvModalTitle', el => el.textContent.trim());
    console.log('Modal title:', titleText);

    const priceText = await page.$eval('.qv-price-current', el => el.textContent.trim());
    console.log('Modal price:', priceText);

    const specRows = await page.$$eval('.qv-specs-table tr', rows => rows.length);
    console.log('Technical specs rows count:', specRows);
    if (specRows < 5) throw new Error('Expected at least 5 tech spec rows, got ' + specRows);

    const sgkNotice = await page.$eval('.qv-sgk-box', el => el.textContent.trim());
    console.log('SGK Notice present:', sgkNotice.includes('SGK'));

    console.log('--- TEST 2: Quantity Stepper in Modal ---');
    const plusBtn = await page.$('#qvQtyPlus');
    await plusBtn.click({ timeout: 3000 });
    await plusBtn.click({ timeout: 3000 });
    const qtyVal = await page.$eval('#qvQtyInput', el => el.value);
    console.log('Quantity after 2 plus clicks:', qtyVal);
    if (qtyVal !== '3') throw new Error('Expected quantity 3, got ' + qtyVal);

    console.log('--- TEST 3: Close via Close Button ---');
    const closeBtn = await page.$('#quickViewCloseBtn');
    await closeBtn.click();
    await page.waitForTimeout(300);
    const isClosed = await page.$eval('#quickViewModal', el => !el.classList.contains('show'));
    console.log('Modal closed via close button:', isClosed);
    if (!isClosed) throw new Error('Modal did not close via close button');

    console.log('--- TEST 4: Open ATL-OKS-04 and Close via Escape Key ---');
    const oksQvBtn = await page.$('.product-card[data-id="ATL-OKS-04"] [data-quick-view]');
    await oksQvBtn.click();
    await page.waitForTimeout(300);
    const oksTitle = await page.$eval('#qvModalTitle', el => el.textContent.trim());
    console.log('Oksijen modal title:', oksTitle);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const isClosedByEsc = await page.$eval('#quickViewModal', el => !el.classList.contains('show'));
    console.log('Modal closed via Escape key:', isClosedByEsc);
    if (!isClosedByEsc) throw new Error('Modal did not close via Escape key');

    console.log('--- TEST 5: Open ATL-TSN-09 and Close via Backdrop Click ---');
    const tsnQvBtn = await page.$('.product-card[data-id="ATL-TSN-09"] [data-quick-view]');
    await tsnQvBtn.click();
    await page.waitForTimeout(300);
    const tsnTitle = await page.$eval('#qvModalTitle', el => el.textContent.trim());
    console.log('Tansiyon modal title:', tsnTitle);

    await page.click('#quickViewModal', { position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);
    const isClosedByBackdrop = await page.$eval('#quickViewModal', el => !el.classList.contains('show'));
    console.log('Modal closed via Backdrop click:', isClosedByBackdrop);
    if (!isClosedByBackdrop) throw new Error('Modal did not close via Backdrop click');

    console.log('\n=== ALL QUICK-VIEW MODAL QA TESTS PASSED SUCCESSFULLY! ===');
    await browser.close();
    server.close();
    process.exit(0);
  });
}

testModal().catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});
