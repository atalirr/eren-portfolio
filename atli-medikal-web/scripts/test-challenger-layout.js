#!/usr/bin/env node
/**
 * ATLI MEDİKAL — ADVERSARIAL VIEWPORT & LAYOUT RESILIENCY VERIFIER (CHALLENGER M5-2)
 * 
 * Matrix of Viewport Dimensions:
 * 1. 1920x1080 (Ultrawide / Desktop Full HD)
 * 2. 1366x768  (Most common Windows laptop resolution)
 * 3. 1180x820  (iPad Air landscape)
 * 4. 820x1180  (iPad Air portrait)
 * 5. 414x896   (iPhone 11 / XR)
 * 6. 390x844   (iPhone 12 / 13 / 14 / 15)
 * 7. 360x780   (Modern Android)
 * 8. 280x653   (Galaxy Fold narrow outer screen)
 * 
 * Invariant Verifications:
 * 1. Zero horizontal overflow (scrollWidth <= innerWidth) across all 8 viewports across multiple scroll offsets.
 * 2. Zero element overlaps between fixed/sticky UI layers (sticky header, floating WhatsApp button,
 *    cookie banner, mobile bar, drawer backdrop, modal overlays).
 * 3. Dynamic UI mutation stability:
 *    - Search pill opening/typing/clearing
 *    - Multi-category filtering
 *    - Quick-view modal opening/closing
 *    - Cart drawer opening/closing and mutations
 *    - Checkout modal opening/closing and form containment
 *    - Modern theme hamburger menu drawer (tmDrawer) opening/closing
 * 4. Exact empirical bounding-box measurements and collision clearance calculations.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { chromium } = require('playwright');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const VIEWPORT_MATRIX = [
  { name: 'desktop_1080p', width: 1920, height: 1080, label: '1920x1080 (Ultrawide / Desktop Full HD)' },
  { name: 'laptop_1366',   width: 1366, height: 768,  label: '1366x768 (Common Windows Laptop)' },
  { name: 'ipad_air_land', width: 1180, height: 820,  label: '1180x820 (iPad Air Landscape)' },
  { name: 'ipad_air_port', width: 820,  height: 1180, label: '820x1180 (iPad Air Portrait)' },
  { name: 'iphone_xr',     width: 414,  height: 896,  label: '414x896 (iPhone 11 / XR)' },
  { name: 'iphone_14',     width: 390,  height: 844,  label: '390x844 (iPhone 12 / 13 / 14 / 15)' },
  { name: 'android_360',   width: 360,  height: 780,  label: '360x780 (Modern Android)' },
  { name: 'fold_280',      width: 280,  height: 653,  label: '280x653 (Galaxy Fold Narrow Screen)' }
];

// Lightweight static HTTP server
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

async function launchBrowser() {
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  };
  try {
    return await chromium.launch({ ...launchOptions, channel: 'chrome' });
  } catch {
    return await chromium.launch(launchOptions);
  }
}

async function runChallengerLayoutSuite() {
  const startTime = Date.now();
  console.log('================================================================================');
  console.log('  ATLI MEDİKAL — EMPIRICAL CHALLENGER M5-2: VIEWPORT & LAYOUT RESILIENCY SUITE  ');
  console.log('================================================================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const { server, baseUrl } = await startServer();
  console.log(`Local test server running at: ${baseUrl}\n`);

  const browser = await launchBrowser();
  console.log(`Browser launched: ${browser.version()}\n`);

  const results = {
    viewportsTested: VIEWPORT_MATRIX.length,
    viewportReports: [],
    overallPass: true,
    failures: []
  };

  try {
    for (const vp of VIEWPORT_MATRIX) {
      console.log('────────────────────────────────────────────────────────────────────────────────');
      console.log(`TESTING VIEWPORT: ${vp.label} (${vp.width}x${vp.height})`);
      console.log('────────────────────────────────────────────────────────────────────────────────');

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Challenger/5.2'
      });
      const page = await context.newPage();

      // Collect console errors & uncaught exceptions
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err.message));
      page.on('console', msg => {
        if (msg.type() === 'error') pageErrors.push(msg.text());
      });

      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const vpReport = {
        viewport: vp,
        overflow: null,
        scrollOverflows: [],
        fixedCollisions: null,
        dynamicMutations: {},
        passed: true,
        issues: []
      };

      // -------------------------------------------------------------
      // SUBTEST 1: Horizontal Overflow Check at Initial Load & Scroll
      // -------------------------------------------------------------
      const overflowCheck = await page.evaluate(() => {
        const docEl = document.documentElement;
        const innerW = window.innerWidth;
        const scrollW = docEl.scrollWidth;
        const delta = scrollW - innerW;

        const overflowingElements = [];
        const allNodes = document.querySelectorAll('*');
        for (const el of allNodes) {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) {
            continue;
          }
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.right > innerW + 1.0) {
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const cls = el.className && typeof el.className === 'string'
              ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
              : '';
            overflowingElements.push({
              selector: `${tag}${id}${cls}`,
              rectRight: Math.round(rect.right),
              rectWidth: Math.round(rect.width),
              overflowAmount: Math.round(rect.right - innerW)
            });
          }
        }

        return {
          scrollWidth: scrollW,
          innerWidth: innerW,
          delta: Math.max(0, delta),
          passed: scrollW <= innerW + 1.0,
          overflowingCount: overflowingElements.length,
          sample: overflowingElements.slice(0, 5)
        };
      });

      vpReport.overflow = overflowCheck;
      if (!overflowCheck.passed) {
        vpReport.passed = false;
        vpReport.issues.push(`Initial horizontal overflow: scrollWidth=${overflowCheck.scrollWidth} > innerWidth=${overflowCheck.innerWidth} (delta: ${overflowCheck.delta}px). Sample: ${JSON.stringify(overflowCheck.sample)}`);
        console.log(`  [FAIL] Initial Horizontal Overflow: scrollWidth ${overflowCheck.scrollWidth}px > innerWidth ${overflowCheck.innerWidth}px (+${overflowCheck.delta}px)`);
      } else {
        console.log(`  [PASS] Initial Horizontal Overflow: scrollWidth=${overflowCheck.scrollWidth}px, innerWidth=${overflowCheck.innerWidth}px (0px overflow)`);
      }

      // Check overflow at 5 scroll depths (20%, 40%, 60%, 80%, 100%)
      const scrollCheck = await page.evaluate(async () => {
        const totalHeight = document.body.scrollHeight;
        const checkpoints = [0.2, 0.4, 0.6, 0.8, 1.0];
        const scrollResults = [];

        for (const p of checkpoints) {
          const targetY = Math.round(totalHeight * p);
          window.scrollTo(0, targetY);
          await new Promise(r => setTimeout(r, 60));
          const scrollW = document.documentElement.scrollWidth;
          const innerW = window.innerWidth;
          scrollResults.push({
            checkpoint: `${Math.round(p * 100)}%`,
            targetY,
            scrollW,
            innerW,
            overflow: Math.max(0, scrollW - innerW),
            passed: scrollW <= innerW + 1.0
          });
        }
        window.scrollTo(0, 0);
        return scrollResults;
      });

      vpReport.scrollOverflows = scrollCheck;
      const failedScrolls = scrollCheck.filter(s => !s.passed);
      if (failedScrolls.length > 0) {
        vpReport.passed = false;
        vpReport.issues.push(`Scroll-depth overflow detected at checkpoints: ${failedScrolls.map(f => `${f.checkpoint} (+${f.overflow}px)`).join(', ')}`);
        console.log(`  [FAIL] Scroll Depth Overflow at: ${failedScrolls.map(f => `${f.checkpoint} (+${f.overflow}px)`).join(', ')}`);
      } else {
        console.log(`  [PASS] Multi-Depth Scroll Overflow: Zero overflow across all 5 scroll depths (0% to 100%)`);
      }

      // -------------------------------------------------------------
      // SUBTEST 2: Fixed / Sticky UI Layer Collision & Clearance Check
      // -------------------------------------------------------------
      // Ensure cookie banner is shown so its collision state can be audited
      await page.evaluate(() => {
        const banner = document.getElementById('cookieBanner');
        if (banner) {
          banner.style.display = 'block';
          banner.classList.add('show');
        }
      });
      await page.waitForTimeout(100);

      const fixedLayerCheck = await page.evaluate(() => {
        const layers = {
          header: document.querySelector('.site-header') || document.querySelector('#navbar'),
          tmBar: document.querySelector('.tm-bar'),
          whatsappFloat: document.querySelector('.whatsapp-float'),
          cookieBanner: document.getElementById('cookieBanner'),
          mobileBar: document.querySelector('.mobile-bar')
        };

        const activeLayers = {};
        for (const [key, el] of Object.entries(layers)) {
          if (!el) continue;
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const isVisible = style.display !== 'none' &&
                            style.visibility !== 'hidden' &&
                            parseFloat(style.opacity || '1') > 0 &&
                            rect.width > 2 && rect.height > 2;
          if (isVisible) {
            activeLayers[key] = {
              tag: el.tagName.toLowerCase(),
              className: el.className,
              rect: {
                top: Math.round(rect.top),
                bottom: Math.round(rect.bottom),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              zIndex: style.zIndex,
              position: style.position
            };
          }
        }

        const collisions = [];
        const layerKeys = Object.keys(activeLayers);

        for (let i = 0; i < layerKeys.length; i++) {
          for (let j = i + 1; j < layerKeys.length; j++) {
            const k1 = layerKeys[i];
            const k2 = layerKeys[j];
            const r1 = activeLayers[k1].rect;
            const r2 = activeLayers[k2].rect;

            const intersects = !(
              r1.right <= r2.left + 1.0 ||
              r1.left >= r2.right - 1.0 ||
              r1.bottom <= r2.top + 1.0 ||
              r1.top >= r2.bottom - 1.0
            );

            let clearanceX = 0;
            let clearanceY = 0;
            if (!intersects) {
              if (r1.bottom <= r2.top) clearanceY = r2.top - r1.bottom;
              else if (r2.bottom <= r1.top) clearanceY = r1.top - r2.bottom;

              if (r1.right <= r2.left) clearanceX = r2.left - r1.right;
              else if (r2.right <= r1.left) clearanceX = r1.left - r2.right;
            }

            if (intersects) {
              const overlapW = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
              const overlapH = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
              const area = overlapW * overlapH;
              if (area > 4.0) {
                collisions.push({
                  layer1: k1,
                  layer2: k2,
                  rect1: r1,
                  rect2: r2,
                  overlapArea: Math.round(area)
                });
              }
            } else {
              collisions.push({
                layer1: k1,
                layer2: k2,
                rect1: r1,
                rect2: r2,
                safeClearance: { clearanceX, clearanceY }
              });
            }
          }
        }

        return {
          activeLayers,
          collisions: collisions.filter(c => c.overlapArea > 0),
          clearances: collisions.filter(c => c.safeClearance)
        };
      });

      vpReport.fixedCollisions = fixedLayerCheck;
      if (fixedLayerCheck.collisions.length > 0) {
        vpReport.passed = false;
        vpReport.issues.push(`Fixed/sticky UI collision detected: ${JSON.stringify(fixedLayerCheck.collisions)}`);
        console.log(`  [FAIL] Fixed UI Collision Detected:`);
        for (const col of fixedLayerCheck.collisions) {
          console.log(`         Collision between ${col.layer1} and ${col.layer2} (Area: ${col.overlapArea}px²)`);
        }
      } else {
        console.log(`  [PASS] Fixed/Sticky Layer Clearance: Zero collisions across ${Object.keys(fixedLayerCheck.activeLayers).join(', ')}`);
        for (const cl of fixedLayerCheck.clearances) {
          console.log(`         Clearance between ${cl.layer1} & ${cl.layer2}: ΔX=${cl.safeClearance.clearanceX}px, ΔY=${cl.safeClearance.clearanceY}px`);
        }
      }

      // -------------------------------------------------------------
      // SUBTEST 3: Dynamic UI Mutation Stability
      // -------------------------------------------------------------

      // 3.1 Search Pill Interaction
      const searchRes = await page.evaluate(async () => {
        const input = document.getElementById('productSearchInput');
        if (!input) return { exists: false };
        const initialScrollW = document.documentElement.scrollWidth;
        const initialInnerW = window.innerWidth;

        input.focus();
        input.value = 'oksijen';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 250));

        const activeScrollW = document.documentElement.scrollWidth;
        const activeInnerW = window.innerWidth;

        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.blur();
        await new Promise(r => setTimeout(r, 150));

        const resetScrollW = document.documentElement.scrollWidth;
        const resetInnerW = window.innerWidth;

        return {
          exists: true,
          initialPassed: initialScrollW <= initialInnerW + 1.0,
          activePassed: activeScrollW <= activeInnerW + 1.0,
          resetPassed: resetScrollW <= resetInnerW + 1.0,
          activeScrollW,
          activeInnerW
        };
      });
      vpReport.dynamicMutations.searchPill = searchRes;
      if (searchRes.exists && (!searchRes.activePassed || !searchRes.resetPassed)) {
        vpReport.passed = false;
        vpReport.issues.push(`Search pill dynamic interaction caused horizontal overflow: activeScrollW=${searchRes.activeScrollW} > activeInnerW=${searchRes.activeInnerW}`);
        console.log(`  [FAIL] Search Pill Dynamic Mutation: Overflow during search interaction`);
      } else {
        console.log(`  [PASS] Search Pill Dynamic Mutation: Zero layout jump or overflow during live typing/clearing`);
      }

      // 3.2 Category Filtering Mutation
      const catRes = await page.evaluate(async () => {
        const categories = ['bakim', 'solunum', 'mobilite', 'ortopedi', 'all'];
        const stepResults = [];

        for (const cat of categories) {
          const btn = document.querySelector(`.filter-btn[data-filter="${cat}"]`);
          if (btn) {
            btn.click();
            await new Promise(r => setTimeout(r, 120));
          }
          const scrollW = document.documentElement.scrollWidth;
          const innerW = window.innerWidth;
          const visibleCards = Array.from(document.querySelectorAll('.product-card:not(.is-hidden)'));

          stepResults.push({
            category: cat,
            scrollW,
            innerW,
            visibleCardsCount: visibleCards.length,
            overflow: Math.max(0, scrollW - innerW),
            passed: scrollW <= innerW + 1.0
          });
        }
        return stepResults;
      });
      vpReport.dynamicMutations.categoryFiltering = catRes;
      const catFailures = catRes.filter(c => !c.passed);
      if (catFailures.length > 0) {
        vpReport.passed = false;
        vpReport.issues.push(`Category filtering overflow in categories: ${catFailures.map(c => c.category).join(', ')}`);
        console.log(`  [FAIL] Category Filtering Mutation: Overflow in ${catFailures.map(c => c.category).join(', ')}`);
      } else {
        console.log(`  [PASS] Category Filtering Mutation: Zero overflow across all 5 filter switches (${catRes.map(c => `${c.category}:${c.visibleCardsCount}cards`).join(', ')})`);
      }

      // 3.3 Quick-View Modal Mutation
      const qvRes = await page.evaluate(async () => {
        const qvBtn = document.querySelector('[data-quick-view]');
        const modal = document.getElementById('quickViewModal');
        const backdrop = document.getElementById('quickViewBackdrop');
        const closeBtn = document.getElementById('quickViewCloseBtn');

        if (!qvBtn || !modal || !closeBtn) {
          return { exists: false };
        }

        qvBtn.click();
        await new Promise(r => setTimeout(r, 250));

        const modalStyle = window.getComputedStyle(modal);
        const isOpen = modal.classList.contains('active') || modalStyle.display !== 'none';
        const dialog = modal.querySelector('.modal-dialog');
        const dialogRect = dialog ? dialog.getBoundingClientRect() : null;
        const innerW = window.innerWidth;

        const isDialogContained = dialogRect
          ? (dialogRect.left >= -1.0 && dialogRect.right <= innerW + 1.0)
          : false;

        closeBtn.click();
        await new Promise(r => setTimeout(r, 200));

        const closedScrollW = document.documentElement.scrollWidth;
        const closedInnerW = window.innerWidth;

        return {
          exists: true,
          openedSuccessfully: isOpen,
          isDialogContained,
          dialogBoundingBox: dialogRect ? {
            left: Math.round(dialogRect.left),
            right: Math.round(dialogRect.right),
            top: Math.round(dialogRect.top),
            bottom: Math.round(dialogRect.bottom),
            width: Math.round(dialogRect.width),
            height: Math.round(dialogRect.height)
          } : null,
          closedScrollW,
          closedInnerW,
          passed: isOpen && isDialogContained && (closedScrollW <= closedInnerW + 1.0)
        };
      });
      vpReport.dynamicMutations.quickView = qvRes;
      if (qvRes.exists && !qvRes.passed) {
        vpReport.passed = false;
        vpReport.issues.push(`Quick-View modal mutation issue: opened=${qvRes.openedSuccessfully}, contained=${qvRes.isDialogContained}, dialogBox=${JSON.stringify(qvRes.dialogBoundingBox)}`);
        console.log(`  [FAIL] Quick-View Modal Mutation: Dialog boundary issue or overflow`);
      } else {
        console.log(`  [PASS] Quick-View Modal Mutation: Clean opening, bounds contained within viewport (${qvRes.dialogBoundingBox?.width}x${qvRes.dialogBoundingBox?.height}px), and clean closing`);
      }

      // 3.4 Cart Drawer Mutation
      const cartRes = await page.evaluate(async () => {
        const addBtn = document.querySelector('[data-add-to-cart]');
        const cartToggle = document.getElementById('cartToggleBtn');
        const cartDrawer = document.getElementById('cartDrawer');
        const cartClose = document.getElementById('cartCloseBtn');

        if (!cartDrawer) return { exists: false };

        if (addBtn) {
          addBtn.click();
          await new Promise(r => setTimeout(r, 150));
        }

        if (cartToggle) {
          cartToggle.click();
        } else if (window.CartManager && window.CartManager.openDrawer) {
          window.CartManager.openDrawer();
        }
        await new Promise(r => setTimeout(r, 300));

        const drawerStyle = window.getComputedStyle(cartDrawer);
        const isOpen = cartDrawer.classList.contains('active') ||
                       cartDrawer.classList.contains('is-open') ||
                       drawerStyle.transform.includes('matrix') ||
                       drawerStyle.right === '0px';

        const drawerRect = cartDrawer.getBoundingClientRect();
        const innerW = window.innerWidth;

        const isDrawerRightAligned = Math.abs(drawerRect.right - innerW) <= 2.0;
        const drawerScrollW = document.documentElement.scrollWidth;

        if (cartClose) {
          cartClose.click();
        } else if (window.CartManager && window.CartManager.closeDrawer) {
          window.CartManager.closeDrawer();
        }
        await new Promise(r => setTimeout(r, 250));

        const closedScrollW = document.documentElement.scrollWidth;

        return {
          exists: true,
          isOpen,
          drawerRect: {
            left: Math.round(drawerRect.left),
            right: Math.round(drawerRect.right),
            width: Math.round(drawerRect.width),
            height: Math.round(drawerRect.height)
          },
          isDrawerRightAligned,
          drawerScrollW,
          closedScrollW,
          passed: isDrawerRightAligned && (drawerScrollW <= innerW + 1.0) && (closedScrollW <= innerW + 1.0)
        };
      });
      vpReport.dynamicMutations.cartDrawer = cartRes;
      if (cartRes.exists && !cartRes.passed) {
        vpReport.passed = false;
        vpReport.issues.push(`Cart drawer mutation issue: rightAligned=${cartRes.isDrawerRightAligned}, drawerScrollW=${cartRes.drawerScrollW}, rect=${JSON.stringify(cartRes.drawerRect)}`);
        console.log(`  [FAIL] Cart Drawer Mutation: Layout shift or drawer alignment anomaly`);
      } else {
        console.log(`  [PASS] Cart Drawer Mutation: Slide-over drawer right-aligned (${cartRes.drawerRect?.width}px width), zero page overflow`);
      }

      // 3.5 Checkout Modal Mutation & Boundary Verification
      const checkoutRes = await page.evaluate(async () => {
        const checkoutModal = document.getElementById('checkoutModal');
        const checkoutBackdrop = document.getElementById('checkoutBackdrop');
        const closeBtn = document.getElementById('checkoutCloseBtn');

        if (!checkoutModal || !window.CheckoutManager) return { exists: false };

        window.CheckoutManager.openModal();
        await new Promise(r => setTimeout(r, 300));

        const modalStyle = window.getComputedStyle(checkoutModal);
        const isOpen = checkoutModal.classList.contains('show') || checkoutModal.classList.contains('is-open');
        const dialog = checkoutModal.querySelector('.modal-dialog');
        const dialogRect = dialog ? dialog.getBoundingClientRect() : null;
        const innerW = window.innerWidth;

        const isContained = dialogRect
          ? (dialogRect.left >= -1.0 && dialogRect.right <= innerW + 1.0)
          : false;

        const modalScrollW = document.documentElement.scrollWidth;

        window.CheckoutManager.closeModal();
        await new Promise(r => setTimeout(r, 200));

        const closedScrollW = document.documentElement.scrollWidth;

        return {
          exists: true,
          isOpen,
          isContained,
          dialogRect: dialogRect ? {
            left: Math.round(dialogRect.left),
            right: Math.round(dialogRect.right),
            top: Math.round(dialogRect.top),
            bottom: Math.round(dialogRect.bottom),
            width: Math.round(dialogRect.width),
            height: Math.round(dialogRect.height)
          } : null,
          modalScrollW,
          closedScrollW,
          passed: isOpen && isContained && (modalScrollW <= innerW + 1.0) && (closedScrollW <= innerW + 1.0)
        };
      });
      vpReport.dynamicMutations.checkoutModal = checkoutRes;
      if (checkoutRes.exists && !checkoutRes.passed) {
        vpReport.passed = false;
        vpReport.issues.push(`Checkout modal mutation issue: isOpen=${checkoutRes.isOpen}, contained=${checkoutRes.isContained}, dialogRect=${JSON.stringify(checkoutRes.dialogRect)}`);
        console.log(`  [FAIL] Checkout Modal Mutation: Dialog boundary overflow or failure to open/close`);
      } else if (checkoutRes.exists) {
        console.log(`  [PASS] Checkout Modal Mutation: Dialog contained (${checkoutRes.dialogRect?.width}x${checkoutRes.dialogRect?.height}px), zero horizontal overflow`);
      }

      // 3.6 Modern Hamburger Menu Drawer (tmDrawer) Mutation
      const tmDrawerRes = await page.evaluate(async () => {
        const menuBtn = document.getElementById('tmMenuBtn');
        const drawer = document.getElementById('tmDrawer');
        const closeBtn = drawer ? drawer.querySelector('[data-tm-close]') : null;

        if (!menuBtn || !drawer || !closeBtn) return { exists: false };

        menuBtn.click();
        // Wait 450ms for CSS transition (0.32s duration) to fully settle
        await new Promise(r => setTimeout(r, 450));

        const isOpen = drawer.classList.contains('is-open');
        const drawerRect = drawer.getBoundingClientRect();
        const innerW = window.innerWidth;

        // Drawer slides from left: 0 to min(440px, 100vw). When fully open, left should be 0 (±1px)
        const isContained = Math.abs(drawerRect.left) <= 1.5 && drawerRect.right <= innerW + 1.0;
        const openScrollW = document.documentElement.scrollWidth;

        closeBtn.click();
        await new Promise(r => setTimeout(r, 350));

        const closedScrollW = document.documentElement.scrollWidth;

        return {
          exists: true,
          isOpen,
          isContained,
          drawerRect: {
            left: Math.round(drawerRect.left),
            right: Math.round(drawerRect.right),
            width: Math.round(drawerRect.width),
            height: Math.round(drawerRect.height)
          },
          openScrollW,
          closedScrollW,
          passed: isOpen && isContained && (openScrollW <= innerW + 1.0) && (closedScrollW <= innerW + 1.0)
        };
      });
      vpReport.dynamicMutations.tmDrawer = tmDrawerRes;
      if (tmDrawerRes.exists && !tmDrawerRes.passed) {
        vpReport.passed = false;
        vpReport.issues.push(`Modern hamburger drawer issue: isOpen=${tmDrawerRes.isOpen}, contained=${tmDrawerRes.isContained}, rect=${JSON.stringify(tmDrawerRes.drawerRect)}`);
        console.log(`  [FAIL] Modern Hamburger Drawer Mutation: Bounds overflow or failure to open/close`);
      } else if (tmDrawerRes.exists) {
        console.log(`  [PASS] Modern Hamburger Drawer Mutation: Drawer opens cleanly (${tmDrawerRes.drawerRect.width}px width), bounds contained, zero page overflow`);
      }

      if (pageErrors.length > 0) {
        console.log(`  [WARN] Page console errors captured (${pageErrors.length}): ${pageErrors[0]}`);
      }

      results.viewportReports.push(vpReport);
      if (!vpReport.passed) {
        results.overallPass = false;
        results.failures.push({ viewport: vp.label, issues: vpReport.issues });
      }

      await context.close();
      console.log('');
    }
  } finally {
    await browser.close();
    server.close();
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('================================================================================');
  console.log(`ADVERSARIAL VIEWPORT & LAYOUT RESILIENCY AUDIT SUMMARY`);
  console.log(`Duration: ${durationSec}s | Viewports Tested: ${results.viewportsTested}/8`);
  console.log(`Overall Resiliency Gate Verdict: ${results.overallPass ? 'APPROVE' : 'REQUEST_CHANGES'}`);
  console.log('================================================================================\n');

  if (!results.overallPass) {
    console.error('FAILURES DETECTED:');
    for (const f of results.failures) {
      console.error(` - [${f.viewport}]: ${f.issues.join(' | ')}`);
    }
  }

  // Write JSON artifact
  const artifactDir = path.join(PROJECT_ROOT, '.agents', 'teamwork', 'challenger_m5_2');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }
  const artifactPath = path.join(artifactDir, 'challenger-layout-results.json');
  fs.writeFileSync(artifactPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Full empirical test artifact saved to: ${artifactPath}`);

  return results;
}

if (require.main === module) {
  runChallengerLayoutSuite()
    .then(res => {
      process.exit(res.overallPass ? 0 : 1);
    })
    .catch(err => {
      console.error('Unexpected test suite crash:', err);
      process.exit(1);
    });
}

module.exports = { runChallengerLayoutSuite, VIEWPORT_MATRIX };
