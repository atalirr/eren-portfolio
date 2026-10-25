#!/usr/bin/env node
/**
 * ATLI MEDİKAL — PROGRAMMATIC DOM LAYOUT & COLLISION AUDITOR
 * 
 * Verifies 4 strict layout criteria across 1440px, 1024px, 768px, and 375px:
 * 1. Zero element overlaps (DOM bounding-box collision detection)
 * 2. Zero horizontal overflow (scrollWidth <= innerWidth)
 * 3. Equal grid card heights (±1.0px) and bottom-aligned CTAs (±1.0px)
 * 4. 100% image integrity (naturalWidth > 0, complete === true, 0 404s)
 * 
 * Usage:
 *   node scripts/test-layout-qa.js
 *   node scripts/test-layout-qa.js --viewport=mobile
 *   node scripts/test-layout-qa.js --browser=edge
 *   node scripts/test-layout-qa.js --json
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { chromium } = require('playwright');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Viewport matrix specification
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, label: '1440px Desktop' },
  { name: 'laptop', width: 1024, height: 768, label: '1024px Small Desktop / Tablet Landscape' },
  { name: 'tablet', width: 768, height: 1024, label: '768px Tablet Portrait' },
  { name: 'mobile', width: 375, height: 812, label: '375px Mobile (iPhone SE / Standard)' }
];

// CLI Arguments
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const noExitCode = args.includes('--no-exit-code');
const viewportArg = (args.find(a => a.startsWith('--viewport=')) || '').split('=')[1];
const browserArg = (args.find(a => a.startsWith('--browser=')) || '').split('=')[1] || 'chrome';

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

// Main Runner
async function runLayoutQa() {
  const startTime = Date.now();
  log(`${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  log(`${colors.bold}${colors.cyan}  ATLI MEDİKAL — PROGRAMMATIC DOM LAYOUT & COLLISION AUDITOR   ${colors.reset}`);
  log(`${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  log(`Timestamp: ${new Date().toISOString()}`);

  const { server, baseUrl } = await startServer();
  log(`Local test server running at: ${baseUrl}`);

  const browser = await launchBrowser(browserArg);
  const browserVersion = browser.version();
  log(`Browser: ${browserArg} (${browserVersion}) headless`);

  const activeViewports = viewportArg
    ? VIEWPORTS.filter(v => v.name === viewportArg || `${v.width}` === viewportArg)
    : VIEWPORTS;

  if (activeViewports.length === 0) {
    console.error(`Invalid viewport specified: "${viewportArg}". Available: desktop, laptop, tablet, mobile`);
    server.close();
    await browser.close();
    process.exit(1);
  }

  const results = {
    timestamp: new Date().toISOString(),
    browser: `${browserArg} ${browserVersion}`,
    passed: true,
    totalErrors: 0,
    viewports: {}
  };

  for (const vp of activeViewports) {
    log(`\n${colors.bold}────────────────────────────────────────────────────────────────${colors.reset}`);
    log(`${colors.bold}Auditing Viewport: ${colors.cyan}${vp.label} (${vp.width}x${vp.height})${colors.reset}`);
    log(`${colors.bold}────────────────────────────────────────────────────────────────${colors.reset}`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });

    const page = await context.newPage();
    const networkFailures = [];

    page.on('response', response => {
      if (response.status() >= 400 && response.url().match(/\.(jpg|jpeg|png|webp|svg)/i)) {
        networkFailures.push({ url: response.url(), status: response.status() });
      }
    });

    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.waitForTimeout(500);

    // Scroll to trigger lazy loading images and return to top
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForFunction(() => window.scrollY === 0);
    await page.waitForTimeout(200);

    // 1. Horizontal Overflow Audit
    const overflowReport = await page.evaluate(() => {
      const doc = document.documentElement;
      const scrollW = doc.scrollWidth;
      const innerW = window.innerWidth;
      const overflow = scrollW - innerW;

      const offendingElements = [];
      if (overflow > 1.0) {
        const all = document.querySelectorAll('*');
        for (const el of all) {
          const rect = el.getBoundingClientRect();
          if (rect.right > innerW + 1.0) {
            const style = window.getComputedStyle(el);
            if (style.display !== 'none' && style.visibility !== 'hidden' && style.overflowX !== 'hidden') {
              const tag = el.tagName.toLowerCase();
              const id = el.id ? `#${el.id}` : '';
              const cls = el.className && typeof el.className === 'string'
                ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
                : '';
              offendingElements.push({
                selector: `${tag}${id}${cls}`,
                rectRight: Math.round(rect.right),
                width: Math.round(rect.width),
                overflowPx: Math.round(rect.right - innerW)
              });
            }
          }
        }
      }

      return {
        scrollWidth: scrollW,
        innerWidth: innerW,
        overflow: Math.max(0, overflow),
        passed: overflow <= 1.0,
        offendingCount: offendingElements.length,
        offendingSample: offendingElements.slice(0, 5)
      };
    });

    // 2. Element Overlap / Collision Audit
    const overlapReport = await page.evaluate(() => {
      const selectors = [
        'button',
        'a[href]',
        'input',
        'select',
        'textarea',
        '[role="button"]',
        '.product-card',
        '.filter-btn',
        '.header-pill-btn',
        '.search-pill',
        '.announcement-bar',
        '.site-header',
        '.site-footer',
        '.bento-box',
        '#cookieBanner.show',
        '.whatsapp-float',
        '.floating-whatsapp',
        '.mobile-bar',
        '.mobile-bottom-bar',
        '.modal-dialog',
        '.cart-drawer'
      ];

      const elements = Array.from(document.querySelectorAll(selectors.join(',')));
      const candidates = [];

      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        // Pruning rules: invisible or zero-sized
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          parseFloat(style.opacity || '1') === 0 ||
          rect.width <= 2 ||
          rect.height <= 2 ||
          style.pointerEvents === 'none'
        ) {
          continue;
        }

        // Must be somewhat within or near vertical view (within 10,000px scroll)
        candidates.push({ el, rect, style });
      }

      const collisions = [];

      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          const a = candidates[i];
          const b = candidates[j];

          // Skip if parent/child relationship
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue;

          const rA = a.rect;
          const rB = b.rect;

          // Mathematical bounding box intersection test (with 1.0px tolerance)
          const intersects = !(
            rA.right <= rB.left + 1.0 ||
            rA.left >= rB.right - 1.0 ||
            rA.bottom <= rB.top + 1.0 ||
            rA.top >= rB.bottom - 1.0
          );

          if (intersects) {
            const overlapX = Math.max(0, Math.min(rA.right, rB.right) - Math.max(rA.left, rB.left));
            const overlapY = Math.max(0, Math.min(rA.bottom, rB.bottom) - Math.max(rA.top, rB.top));
            const area = overlapX * overlapY;

            // Threshold: area > 4.0 px²
            if (area > 4.0) {
              const getIdentifier = (node) => {
                const tag = node.tagName.toLowerCase();
                const id = node.id ? `#${node.id}` : '';
                const cls = node.className && typeof node.className === 'string'
                  ? `.${node.className.trim().split(/\s+/).slice(0, 2).join('.')}`
                  : '';
                const text = (node.textContent || '').trim().slice(0, 20);
                return `${tag}${id}${cls} ("${text}")`;
              };

              collisions.push({
                elementA: getIdentifier(a.el),
                elementB: getIdentifier(b.el),
                overlapArea: Math.round(area),
                rectA: { x: Math.round(rA.left), y: Math.round(rA.top), w: Math.round(rA.width), h: Math.round(rA.height) },
                rectB: { x: Math.round(rB.left), y: Math.round(rB.top), w: Math.round(rB.width), h: Math.round(rB.height) }
              });
            }
          }
        }
      }

      return {
        candidateCount: candidates.length,
        collisionCount: collisions.length,
        collisions: collisions.slice(0, 10),
        passed: collisions.length === 0
      };
    });

    // 3. Equal Grid Card Heights & Bottom-Aligned CTAs Audit
    const gridReport = await page.evaluate(() => {
      const visibleCards = Array.from(document.querySelectorAll('.product-card'))
        .filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && !el.classList.contains('is-hidden');
        });

      if (visibleCards.length === 0) {
        return {
          totalCards: 0,
          passed: true,
          message: 'No visible product cards found to audit.'
        };
      }

      const cardData = visibleCards.map(c => {
        const rect = c.getBoundingClientRect();
        const actionEl = c.querySelector('.product-card__actions, .card-actions, .product-card__btn-group')
          || c.querySelector('a, button');
        const actionRect = actionEl ? actionEl.getBoundingClientRect() : null;
        const ctaBottomMargin = actionRect ? Math.round((rect.bottom - actionRect.bottom) * 10) / 10 : 0;

        return {
          top: Math.round(rect.top),
          height: Math.round(rect.height * 10) / 10,
          rect,
          ctaBottomMargin
        };
      });

      // Group cards into rows by matching top within 12px
      const rows = [];
      cardData.forEach(card => {
        let matchedRow = rows.find(r => Math.abs(r.top - card.top) <= 12);
        if (!matchedRow) {
          matchedRow = { top: card.top, cards: [] };
          rows.push(matchedRow);
        }
        matchedRow.cards.push(card);
      });

      let heightDeltaMax = 0;
      let ctaDeltaMax = 0;
      const rowDetails = [];

      rows.forEach((row, idx) => {
        const heights = row.cards.map(c => c.height);
        const margins = row.cards.map(c => c.ctaBottomMargin);
        const minH = Math.min(...heights);
        const maxH = Math.max(...heights);
        const deltaH = Math.round((maxH - minH) * 10) / 10;

        const minM = Math.min(...margins);
        const maxM = Math.max(...margins);
        const deltaM = Math.round((maxM - minM) * 10) / 10;

        if (deltaH > heightDeltaMax) heightDeltaMax = deltaH;
        if (deltaM > ctaDeltaMax) ctaDeltaMax = deltaM;

        rowDetails.push({
          row: idx + 1,
          cardCount: row.cards.length,
          heights,
          deltaH,
          margins,
          deltaM,
          passed: deltaH <= 1.0 && deltaM <= 1.0
        });
      });

      return {
        totalCards: visibleCards.length,
        rowCount: rows.length,
        maxHeightDelta: heightDeltaMax,
        maxCtaDelta: ctaDeltaMax,
        rowDetails,
        passed: heightDeltaMax <= 1.0 && ctaDeltaMax <= 1.0
      };
    });

    // 4. Image Integrity Audit
    const imageReport = await page.evaluate(() => {
      const allImages = Array.from(document.querySelectorAll('img'));
      const broken = [];
      const valid = [];

      for (const img of allImages) {
        const src = img.getAttribute('src') || '';
        const isComplete = img.complete;
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        const isValid = isComplete && naturalWidth > 0 && naturalHeight > 0;

        const info = {
          src,
          alt: img.getAttribute('alt') || '',
          naturalWidth,
          naturalHeight,
          complete: isComplete
        };

        if (!isValid) {
          broken.push(info);
        } else {
          valid.push(info);
        }
      }

      return {
        totalImages: allImages.length,
        validCount: valid.length,
        brokenCount: broken.length,
        brokenImages: broken,
        passed: broken.length === 0
      };
    });

    // Merge network failures with broken images
    if (networkFailures.length > 0) {
      imageReport.networkFailures = networkFailures;
      imageReport.passed = false;
    }

    const vpPassed = overflowReport.passed && overlapReport.passed && gridReport.passed && imageReport.passed;
    if (!vpPassed) {
      results.passed = false;
      results.totalErrors++;
    }

    results.viewports[vp.name] = {
      label: vp.label,
      dimensions: `${vp.width}x${vp.height}`,
      passed: vpPassed,
      overflow: overflowReport,
      overlap: overlapReport,
      grid: gridReport,
      images: imageReport
    };

    // Console Logging for Viewport
    const mark = (cond) => (cond ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`);

    log(`1. Horizontal Overflow : ${mark(overflowReport.passed)} (scrollWidth: ${overflowReport.scrollWidth}px, innerWidth: ${overflowReport.innerWidth}px, delta: ${overflowReport.overflow}px)`);
    if (!overflowReport.passed) {
      log(`   ${colors.red}→ Offending elements: ${overflowReport.offendingCount}${colors.reset}`);
      overflowReport.offendingSample.forEach(o => {
        log(`     - ${o.selector} (right: ${o.rectRight}px, overflow: +${o.overflowPx}px)`);
      });
    }

    log(`2. Zero Element Overlap : ${mark(overlapReport.passed)} (${overlapReport.candidateCount} elements checked, ${overlapReport.collisionCount} collisions)`);
    if (!overlapReport.passed) {
      overlapReport.collisions.forEach(c => {
        log(`   ${colors.red}→ Collision (${c.overlapArea} px²):${colors.reset}`);
        log(`     • ${c.elementA}`);
        log(`     • ${c.elementB}`);
      });
    }

    log(`3. Equal Card Heights  : ${mark(gridReport.passed)} (${gridReport.totalCards} cards in ${gridReport.rowCount} rows, max ΔH: ${gridReport.maxHeightDelta}px, max ΔCTA: ${gridReport.maxCtaDelta}px)`);
    if (!gridReport.passed) {
      gridReport.rowDetails.filter(r => !r.passed).forEach(r => {
        log(`   ${colors.yellow}→ Row ${r.row}: ΔH=${r.deltaH}px (target ≤1.0px), ΔCTA=${r.deltaM}px (target ≤1.0px)${colors.reset}`);
      });
    }

    log(`4. Image Integrity     : ${mark(imageReport.passed)} (${imageReport.validCount}/${imageReport.totalImages} valid, ${imageReport.brokenCount} broken, ${networkFailures.length} 404s)`);
    if (!imageReport.passed) {
      imageReport.brokenImages.forEach(b => {
        log(`   ${colors.red}→ Broken: ${b.src || '(empty src)'} (complete: ${b.complete}, naturalWidth: ${b.naturalWidth})${colors.reset}`);
      });
      networkFailures.forEach(nf => {
        log(`   ${colors.red}→ HTTP ${nf.status}: ${nf.url}${colors.reset}`);
      });
    }

    await context.close();
  }

  await browser.close();
  server.close();

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  results.durationSec = durationSec;

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
    log(`${colors.bold}AUDIT SUMMARY — Execution Time: ${durationSec}s${colors.reset}`);
    log(`Overall Layout Quality Gate Status: ${results.passed ? `${colors.green}${colors.bold}PASSED (ALL CRITERIA MET)` : `${colors.red}${colors.bold}FAILED (${results.totalErrors} viewports with issues)`}${colors.reset}`);
    log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);
  }

  if (!results.passed && !noExitCode) {
    process.exit(1);
  }
}

// Execute
runLayoutQa().catch(err => {
  console.error('Fatal crash during Layout QA execution:', err);
  process.exit(2);
});
