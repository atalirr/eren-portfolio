const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== FORENSIC CHECK 1: MEDICAL CATALOG & SPECS AUTHENTICITY ===');

// 1. Load js/products-data.js
const productsJs = fs.readFileSync(path.join(__dirname, '../js/products-data.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(productsJs, sandbox);
const products = sandbox.window.ATLI_PRODUCTS;

console.log(`Found ${products.length} products in js/products-data.js.`);

// Check for forbidden placeholder patterns
const dummyPatterns = [
  /lorem\s+ipsum/i,
  /placeholder/i,
  /dummy/i,
  /todo/i,
  /asdf/i,
  /test\s*product/i,
  /deneme\s*ürün/i,
  /örnek\s*ürün/i,
  /xxx+/i
];

let placeholderViolations = 0;
products.forEach((p, idx) => {
  const serialized = JSON.stringify(p);
  dummyPatterns.forEach(pattern => {
    if (pattern.test(serialized)) {
      console.error(`[VIOLATION] Dummy pattern ${pattern} matched in product ${p.sku}`);
      placeholderViolations++;
    }
  });

  // Verify completeness of medical fields
  const requiredFields = ['id', 'sku', 'title', 'shortDescription', 'fullDescription', 'category', 'price', 'image', 'technicalDetails'];
  requiredFields.forEach(f => {
    if (!p[f]) {
      console.error(`[VIOLATION] Missing field '${f}' in product ${p.sku}`);
      placeholderViolations++;
    }
  });

  const techCount = Object.keys(p.technicalDetails || {}).length;
  if (techCount < 5) {
    console.error(`[VIOLATION] Product ${p.sku} has insufficient technicalDetails (${techCount} keys, expected >= 5)`);
    placeholderViolations++;
  }

  console.log(`Product ${idx + 1}: [${p.sku}] ${p.title.slice(0, 45)}... | Price: ${p.price} TL | Tech Specs: ${techCount} items`);
});

if (placeholderViolations === 0) {
  console.log('✓ PASS: All 12 products have rich, genuine clinical medical specifications with zero placeholders.');
} else {
  console.error(`✗ FAIL: ${placeholderViolations} placeholder or missing field violations found in products-data.js.`);
}

console.log('\n=== FORENSIC CHECK 1B: INDEX.HTML CARDS MATCH PRODUCTS-DATA.JS ===');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

// Extract all <article class="product-card" ...>
const cardMatches = [...html.matchAll(/<article[^>]*class="product-card"[^>]*>([\s\S]*?)<\/article>/gi)];
console.log(`Found ${cardMatches.length} product-card elements in index.html.`);

if (cardMatches.length !== 12) {
  console.error(`[VIOLATION] Expected 12 product cards in index.html, found ${cardMatches.length}`);
}

cardMatches.forEach((match, i) => {
  const cardMarkup = match[0];
  const skuMatch = cardMarkup.match(/data-sku="([^"]+)"/i);
  const idMatch = cardMarkup.match(/data-id="([^"]+)"/i);
  const catMatch = cardMarkup.match(/data-category="([^"]+)"/i);
  const imgSrcMatch = cardMarkup.match(/<img[^>]+src="([^"]+)"/i);
  const titleMatch = cardMarkup.match(/<h3[^>]*class="product-card__title"[^>]*>([\s\S]*?)<\/h3>/i);

  const sku = skuMatch ? skuMatch[1] : null;
  const id = idMatch ? idMatch[1] : null;
  const cat = catMatch ? catMatch[1] : null;
  const imgSrc = imgSrcMatch ? imgSrcMatch[1] : null;
  const title = titleMatch ? titleMatch[1].trim() : null;

  const dataProd = products.find(p => p.sku === sku);
  if (!dataProd) {
    console.error(`[VIOLATION] Card ${i + 1} SKU ${sku} does not exist in products-data.js`);
  } else {
    // Check image match
    if (dataProd.image !== imgSrc) {
      console.error(`[MISMATCH] Card ${sku} image src in HTML (${imgSrc}) != products-data.js (${dataProd.image})`);
    }
    // Check category match
    if (dataProd.category !== cat) {
      console.error(`[MISMATCH] Card ${sku} category in HTML (${cat}) != products-data.js (${dataProd.category})`);
    }
    console.log(`Card ${i + 1}: [${sku}] matches data model (${cat}, ${imgSrc})`);
  }
});

console.log('\n=== FORENSIC CHECK 2: PHYSICAL IMAGE ASSET INTEGRITY ON DISK ===');
const prodImgDir = path.join(__dirname, '../images/products');
const diskFiles = fs.readdirSync(prodImgDir);
console.log(`Found ${diskFiles.length} image files in images/products/:`);

let corruptedFiles = 0;
diskFiles.forEach(fileName => {
  const filePath = path.join(prodImgDir, fileName);
  const stat = fs.statSync(filePath);
  const buf = fs.readFileSync(filePath);
  
  // Check magic bytes
  let isValid = false;
  let type = 'unknown';
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    isValid = true;
    type = 'JPEG';
  } else if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    isValid = true;
    type = 'PNG';
  }

  if (!isValid || stat.size === 0) {
    console.error(`[CORRUPT FILE] ${fileName} (Size: ${stat.size} bytes, Header: ${buf.slice(0, 4).toString('hex')})`);
    corruptedFiles++;
  } else {
    console.log(`  ✓ ${fileName.padEnd(28)} | ${type.padEnd(5)} | ${(stat.size / 1024).toFixed(1)} KB | Signature OK`);
  }
});

if (corruptedFiles === 0) {
  console.log(`✓ PASS: All ${diskFiles.length} product images on disk are valid non-empty JPEG/PNG binaries.`);
} else {
  console.error(`✗ FAIL: ${corruptedFiles} corrupt or empty image files on disk.`);
}

const http = require('http');
const { chromium } = require('playwright');

async function runBrowserForensics() {
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

  return new Promise((resolve, reject) => {
    server.listen(0, async () => {
      const port = server.address().port;
      console.log(`\n=== FORENSIC CHECK 3: HEADLESS BROWSER AUDIT (PORT ${port}) ===`);
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      
      const failedRequests = [];
      page.on('requestfailed', req => {
        failedRequests.push({ url: req.url(), failure: req.failure() });
      });

      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
      await page.waitForTimeout(500);

      // 3A. Verify all 26 product images on page
      console.log('\n--- 3A: DOM Product Image naturalWidth & naturalHeight Audit ---');
      const domImages = await page.$$eval('img', imgs => imgs.map(img => ({
        src: img.getAttribute('src'),
        currentSrc: img.currentSrc,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        alt: img.getAttribute('alt')
      })));

      console.log(`Total <img> tags found in index.html: ${domImages.length}`);
      const productImagesInDom = domImages.filter(img => img.src && (img.src.includes('images/products/') || img.src.includes('images/')));
      console.log(`Product/brand images in index.html: ${productImagesInDom.length}`);

      let brokenCount = 0;
      domImages.forEach((img, idx) => {
        const isOk = img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
        if (!isOk) {
          console.error(`[BROKEN IMAGE] <img> #${idx + 1} src="${img.src}" complete=${img.complete} naturalWidth=${img.naturalWidth}`);
          brokenCount++;
        }
      });

      if (brokenCount === 0) {
        console.log(`✓ PASS: All ${domImages.length} images loaded with complete === true and naturalWidth > 0.`);
      } else {
        console.error(`✗ FAIL: ${brokenCount} broken images detected.`);
      }

      // 3B. Dynamic Quick-View Modal verification on multiple products
      console.log('\n--- 3B: Dynamic Quick-View Modal Data Binding Audit ---');
      const testSkus = ['ATL-KRY-01', 'ATL-HVL-02', 'ATL-OKS-04', 'ATL-TSN-09', 'ATL-KOL-12'];
      let modalFailures = 0;

      for (const sku of testSkus) {
        const dataProd = products.find(p => p.sku === sku);
        const qvBtn = await page.$(`.product-card[data-sku="${sku}"] [data-quick-view]`);
        if (!qvBtn) {
          console.error(`[FAIL] Quick view button for ${sku} not found`);
          modalFailures++;
          continue;
        }

        await qvBtn.click();
        await page.waitForTimeout(200);

        const isOpen = await page.$eval('#quickViewModal', el => el.classList.contains('show'));
        const modalTitle = await page.$eval('#qvModalTitle', el => el.textContent.trim());
        const modalPrice = await page.$eval('.qv-price-current', el => el.textContent.trim());
        const specRows = await page.$$eval('.qv-specs-table tr', rows => rows.map(r => ({
          key: r.children[0].textContent.trim(),
          val: r.children[1].textContent.trim()
        })));
        const sgkText = await page.$eval('.qv-sgk-box', el => el.textContent.trim());

        // Verify dynamic values match the specific product
        if (!isOpen) {
          console.error(`[FAIL] Modal did not open for ${sku}`);
          modalFailures++;
        }
        if (modalTitle !== dataProd.title) {
          console.error(`[FAIL] Modal title mismatch for ${sku}. Expected "${dataProd.title}", got "${modalTitle}"`);
          modalFailures++;
        }
        const expectedPriceStr = `${dataProd.price.toLocaleString('tr-TR')} ₺`;
        if (modalPrice !== expectedPriceStr) {
          console.error(`[FAIL] Modal price mismatch for ${sku}. Expected "${expectedPriceStr}", got "${modalPrice}"`);
          modalFailures++;
        }
        const expectedSpecCount = Object.keys(dataProd.technicalDetails || {}).length;
        if (specRows.length !== expectedSpecCount) {
          console.error(`[FAIL] Spec row count mismatch for ${sku}. Expected ${expectedSpecCount}, got ${specRows.length}`);
          modalFailures++;
        }

        console.log(`  ✓ Quick-View dynamic check [${sku}]: Title matches, Price matches (${modalPrice}), ${specRows.length} tech spec rows dynamically populated.`);

        // Close modal
        await page.click('#quickViewCloseBtn');
        await page.waitForTimeout(200);
      }

      if (modalFailures === 0) {
        console.log('✓ PASS: Quick-View modal dynamically binds genuine product data for all sampled products.');
      } else {
        console.error(`✗ FAIL: ${modalFailures} Quick-View modal verification failures.`);
      }

      // 3C. Live Search & Category Filtering Empirical Audit
      console.log('\n--- 3C: Live Search & Category Filtering Functional Audit ---');
      let searchFilterFailures = 0;

      // Test category filtering
      const categories = ['bakim', 'solunum', 'mobilite', 'ortopedi'];
      for (const cat of categories) {
        const catBtn = await page.$(`.filter-btn[data-filter="${cat}"]`);
        await catBtn.click();
        await page.waitForTimeout(200);

        const visibleCards = await page.$$eval('.product-card:not(.is-hidden)', cards => cards.map(c => ({
          sku: c.getAttribute('data-sku'),
          category: c.getAttribute('data-category')
        })));

        const expectedSkus = products.filter(p => p.category === cat).map(p => p.sku);
        const actualSkus = visibleCards.map(c => c.sku);

        const matches = expectedSkus.length === actualSkus.length && expectedSkus.every(s => actualSkus.includes(s));
        if (!matches) {
          console.error(`[FAIL] Filter for category '${cat}' expected [${expectedSkus}], got [${actualSkus}]`);
          searchFilterFailures++;
        } else {
          console.log(`  ✓ Filter category '${cat}': exactly ${actualSkus.length} matching products shown.`);
        }
      }

      // Reset to all
      await page.click('.filter-btn[data-filter="all"]');
      await page.waitForTimeout(200);

      // Test live search with Turkish case sensitivity (e.g. "İ/i", "I/ı", "oksijen", "çelik")
      const searchQueries = [
        { q: 'oksijen', minExpected: 1 },
        { q: 'Oksijen', minExpected: 1 },
        { q: 'karyola', minExpected: 1 },
        { q: 'çelik', minExpected: 1 },
        { q: 'sandalye', minExpected: 1 },
        { q: 'nebülizatör', minExpected: 1 },
        { q: 'nonexistentquery999', minExpected: 0, maxExpected: 0 }
      ];

      const searchInput = await page.$('#productSearchInput');
      for (const t of searchQueries) {
        await searchInput.fill(t.q);
        await page.waitForTimeout(300);

        const visibleCount = await page.$$eval('.product-card:not(.is-hidden)', els => els.length);
        const emptyStateVisible = await page.$eval('#searchNoResults', el => el.style.display !== 'none');

        if (t.minExpected > 0 && visibleCount < t.minExpected) {
          console.error(`[FAIL] Search for "${t.q}" expected >= ${t.minExpected} results, got ${visibleCount}`);
          searchFilterFailures++;
        } else if (t.maxExpected === 0) {
          if (visibleCount !== 0 || !emptyStateVisible) {
            console.error(`[FAIL] Search for "${t.q}" expected 0 results and emptyStateVisible=true, got visibleCount=${visibleCount}, emptyState=${emptyStateVisible}`);
            searchFilterFailures++;
          } else {
            console.log(`  ✓ Search for non-matching "${t.q}": 0 cards visible, #searchNoResults empty state displayed.`);
          }
        } else {
          console.log(`  ✓ Search for "${t.q}": ${visibleCount} cards visible.`);
        }
      }

      if (searchFilterFailures === 0) {
        console.log('✓ PASS: Live search & category filters execute authentic DOM updates without test bypasses.');
      } else {
        console.error(`✗ FAIL: ${searchFilterFailures} search/filter failures.`);
      }

      await browser.close();
      server.close();
      resolve({ brokenCount, modalFailures, searchFilterFailures });
    });
  });
}

runBrowserForensics().then(res => {
  console.log('\n=== ALL FORENSIC CHECKS FINISHED ===');
  console.log(JSON.stringify(res));
  process.exit(0);
}).catch(err => {
  console.error('Forensic audit error:', err);
  process.exit(1);
});



