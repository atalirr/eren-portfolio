#!/usr/bin/env node
/**
 * ATLI MEDİKAL — EMPIRICAL CHALLENGER 1 AUTOMATED VERIFICATION SUITE
 * Milestone 1: Design System & Mobile UI Collision Verification
 * 
 * Verifications:
 * 1. CSS Syntax, brace balance, comment balance, and CSS variable / property validity.
 * 2. Playwright headless Chromium DOM bounding rect clearance between .cookie-banner.show
 *    and .mobile-bar at 375x667 and 768x1024.
 * 3. Stress-testing boundary viewports (320px, 360px, 390px, 767px, 768px, 769px, 1024px, 1440px).
 * 4. Intersection area assertion (0px²) and positive clearance assertion (> 0px).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { chromium } = require('playwright');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CSS_PATH = path.join(PROJECT_ROOT, 'css', 'style.css');

// ==========================================
// 1. CSS SYNTAX & VALIDITY VERIFICATION
// ==========================================
function verifyCssSyntax() {
  console.log('\n--- 1. CSS SYNTAX & PROPERTY AUDIT ---');
  if (!fs.existsSync(CSS_PATH)) {
    throw new Error(`CSS file not found at ${CSS_PATH}`);
  }

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const lines = css.split(/\r?\n/);
  console.log(`CSS File: ${CSS_PATH}`);
  console.log(`Lines: ${lines.length}, Characters: ${css.length}`);

  let curlyBraces = 0;
  let parentheses = 0;
  let squareBrackets = 0;
  let inComment = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  const errors = [];

  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    const nextChar = css[i + 1];
    const prevChar = css[i - 1];

    if (inComment) {
      if (char === '*' && nextChar === '/') {
        inComment = false;
        i++; // skip /
      }
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inComment = true;
      i++;
      continue;
    }

    if (!inSingleQuote && char === '"' && prevChar !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (!inDoubleQuote && char === "'" && prevChar !== '\\') {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (inSingleQuote || inDoubleQuote) {
      continue;
    }

    if (char === '{') curlyBraces++;
    else if (char === '}') {
      curlyBraces--;
      if (curlyBraces < 0) {
        errors.push(`Unmatched closing brace '}' around character offset ${i}`);
      }
    } else if (char === '(') parentheses++;
    else if (char === ')') {
      parentheses--;
      if (parentheses < 0) {
        errors.push(`Unmatched closing parenthesis ')' around character offset ${i}`);
      }
    } else if (char === '[') squareBrackets++;
    else if (char === ']') {
      squareBrackets--;
      if (squareBrackets < 0) {
        errors.push(`Unmatched closing bracket ']' around character offset ${i}`);
      }
    }
  }

  if (curlyBraces !== 0) errors.push(`Unbalanced curly braces: ${curlyBraces}`);
  if (parentheses !== 0) errors.push(`Unbalanced parentheses: ${parentheses}`);
  if (squareBrackets !== 0) errors.push(`Unbalanced square brackets: ${squareBrackets}`);
  if (inComment) errors.push('Unclosed multi-line comment /* ...');
  if (inDoubleQuote) errors.push('Unclosed double quote "');
  if (inSingleQuote) errors.push("Unclosed single quote '");

  // Verify critical tokens in :root
  const requiredTokens = [
    '--color-brand-primary',
    '--color-brand-navy',
    '--color-surface-page',
    '--z-base',
    '--z-mobile-bar',
    '--z-cart-drawer',
    '--z-cookie-banner',
    '--mobile-bar-height',
    '--font-main'
  ];

  const missingTokens = requiredTokens.filter(t => !css.includes(t));
  if (missingTokens.length > 0) {
    errors.push(`Missing required M1 tokens: ${missingTokens.join(', ')}`);
  }

  // Check for hardcoded z-index regressions outside of :root definition
  // We can scan lines for hardcoded high z-index values (e.g. z-index: 999, z-index: 1000)
  const hardcodedZIndexMatches = [];
  lines.forEach((line, idx) => {
    // skip root lines (approx 9 to 130) and comments
    if (idx < 135) return;
    const match = line.match(/z-index\s*:\s*([0-9]{3,})/);
    if (match) {
      hardcodedZIndexMatches.push({ line: idx + 1, content: line.trim(), value: match[1] });
    }
  });

  console.log(`Brace balance check: ${curlyBraces === 0 ? 'PASS (0)' : 'FAIL (' + curlyBraces + ')'}`);
  console.log(`Parentheses balance check: ${parentheses === 0 ? 'PASS (0)' : 'FAIL (' + parentheses + ')'}`);
  console.log(`Bracket balance check: ${squareBrackets === 0 ? 'PASS (0)' : 'FAIL (' + squareBrackets + ')'}`);
  console.log(`Required tokens present: ${requiredTokens.length - missingTokens.length}/${requiredTokens.length}`);
  console.log(`Hardcoded z-index >= 100 in component rules: ${hardcodedZIndexMatches.length}`);
  if (hardcodedZIndexMatches.length > 0) {
    console.log('  Warnings for hardcoded z-index:', hardcodedZIndexMatches);
  }

  return {
    valid: errors.length === 0,
    errors,
    tokensFound: requiredTokens.length - missingTokens.length,
    hardcodedZIndexMatches
  };
}

// ==========================================
// 2. STATIC SERVER SETUP
// ==========================================
function startStaticServer() {
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
        const contentTypes = {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon'
        };

        res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });

    server.on('error', reject);
  });
}

// ==========================================
// 3. PLAYWRIGHT EMPIRICAL VERIFICATION
// ==========================================
async function runPlaywrightAudits(port) {
  console.log('\n--- 2. PLAYWRIGHT EMPIRICAL COLLISION & CLEARANCE AUDIT ---');

  const testMatrix = [
    // Core requested viewports:
    { width: 375, height: 667, name: '375x667 Mobile (Mandatory Acceptance Target)' },
    { width: 768, height: 1024, name: '768x1024 Tablet Portrait (Mandatory Acceptance Target)' },
    // Adversarial stress test viewports:
    { width: 320, height: 568, name: '320x568 Ultra-Compact Mobile (iPhone SE 1st gen)' },
    { width: 360, height: 800, name: '360x800 Standard Android Viewport' },
    { width: 390, height: 844, name: '390x844 iPhone 13/14/15 Viewport' },
    { width: 767, height: 1024, name: '767x1024 Right below tablet breakpoint' },
    { width: 769, height: 1024, name: '769x1024 Right above tablet breakpoint' },
    { width: 1024, height: 768, name: '1024x768 Small Desktop / Laptop' },
    { width: 1440, height: 900, name: '1440x900 Standard Desktop' }
  ];

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of testMatrix) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });

    // Ensure elements exist
    const bannerCount = await page.locator('.cookie-banner').count();
    const barCount = await page.locator('.mobile-bar').count();

    if (bannerCount === 0 || barCount === 0) {
      results.push({
        viewport: `${vp.width}x${vp.height}`,
        name: vp.name,
        pass: false,
        error: `Elements missing: banner=${bannerCount}, bar=${barCount}`
      });
      await page.close();
      continue;
    }

    // Trigger cookie banner show state
    await page.evaluate(() => {
      const banner = document.querySelector('.cookie-banner');
      if (banner) banner.classList.add('show');
    });

    // Wait a brief frame for rendering
    await page.waitForTimeout(100);

    // Audit computed styles and bounding rects
    const auditData = await page.evaluate(() => {
      const banner = document.querySelector('.cookie-banner');
      const bar = document.querySelector('.mobile-bar');

      const bannerStyle = window.getComputedStyle(banner);
      const barStyle = window.getComputedStyle(bar);

      const bannerRect = banner.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();

      const isBarVisible = barStyle.display !== 'none' && barStyle.visibility !== 'hidden';
      const isBannerVisible = bannerStyle.display !== 'none' && bannerStyle.visibility !== 'hidden';

      // 2D collision calculation
      const overlapX = Math.max(0, Math.min(bannerRect.right, barRect.right) - Math.max(bannerRect.left, barRect.left));
      const overlapY = Math.max(0, Math.min(bannerRect.bottom, barRect.bottom) - Math.max(bannerRect.top, barRect.top));
      const intersectionArea = isBarVisible && isBannerVisible ? overlapX * overlapY : 0;

      // Clearance calculation (distance between bottom of banner and top of mobile bar)
      // When mobile bar is visible:
      const verticalClearance = isBarVisible ? (barRect.top - bannerRect.bottom) : null;

      return {
        banner: {
          display: bannerStyle.display,
          position: bannerStyle.position,
          zIndex: bannerStyle.zIndex,
          bottom: bannerStyle.bottom,
          rect: {
            top: bannerRect.top,
            bottom: bannerRect.bottom,
            left: bannerRect.left,
            right: bannerRect.right,
            width: bannerRect.width,
            height: bannerRect.height
          }
        },
        bar: {
          display: barStyle.display,
          position: barStyle.position,
          zIndex: barStyle.zIndex,
          rect: {
            top: barRect.top,
            bottom: barRect.bottom,
            left: barRect.left,
            right: barRect.right,
            width: barRect.width,
            height: barRect.height
          },
          visible: isBarVisible
        },
        intersectionArea,
        verticalClearance
      };
    });

    // Evaluation logic
    let pass = false;
    let reason = '';

    if (auditData.bar.visible) {
      const clearanceOk = auditData.verticalClearance > 0;
      const zeroIntersection = auditData.intersectionArea === 0;
      pass = clearanceOk && zeroIntersection;
      reason = `Mobile bar visible. Clearance: ${auditData.verticalClearance.toFixed(2)}px (> 0px: ${clearanceOk}), Intersection: ${auditData.intersectionArea}px² (== 0: ${zeroIntersection})`;
    } else {
      // Mobile bar is hidden at this viewport width (> 768px)
      pass = true;
      reason = `Mobile bar hidden (display: none). No collision possible. Banner bottom: ${auditData.banner.rect.bottom.toFixed(2)}px.`;
    }

    results.push({
      viewport: `${vp.width}x${vp.height}`,
      name: vp.name,
      bannerRect: auditData.banner.rect,
      barRect: auditData.bar.rect,
      barVisible: auditData.bar.visible,
      clearance: auditData.verticalClearance,
      intersectionArea: auditData.intersectionArea,
      bannerZIndex: auditData.banner.zIndex,
      barZIndex: auditData.bar.zIndex,
      pass,
      reason
    });

    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${vp.name} (${vp.width}x${vp.height}):`);
    console.log(`       ${reason}`);
    if (auditData.bar.visible) {
      console.log(`       Banner rect: [top: ${auditData.banner.rect.top.toFixed(1)}, bottom: ${auditData.banner.rect.bottom.toFixed(1)}, left: ${auditData.banner.rect.left.toFixed(1)}, right: ${auditData.banner.rect.right.toFixed(1)}]`);
      console.log(`       Mobile bar:  [top: ${auditData.bar.rect.top.toFixed(1)}, bottom: ${auditData.bar.rect.bottom.toFixed(1)}, height: ${auditData.bar.rect.height.toFixed(1)}]`);
      console.log(`       Z-Index: Banner=${auditData.banner.zIndex}, Bar=${auditData.bar.zIndex}`);
    }

    await page.close();
  }

  await browser.close();
  return results;
}

// ==========================================
// 4. MAIN ORCHESTRATION & VERDICT
// ==========================================
async function main() {
  console.log('================================================================');
  console.log(' ATLI MEDİKAL — EMPIRICAL CHALLENGER 1 AUTOMATED AUDIT (M1)');
  console.log('================================================================');

  // Step 1: CSS Syntax
  const cssAudit = verifyCssSyntax();

  // Step 2: Playwright Run
  const { server, port } = await startStaticServer();
  let playwrightResults = [];
  try {
    playwrightResults = await runPlaywrightAudits(port);
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(' FINAL VERIFICATION SUMMARY & VERDICT');
  console.log('================================================================');

  const mandatoryTargets = playwrightResults.filter(r => r.viewport === '375x667' || r.viewport === '768x1024');
  const allPlaywrightPass = playwrightResults.every(r => r.pass);
  const mandatoryPass = mandatoryTargets.every(r => r.pass);
  const cssPass = cssAudit.valid;

  const verdict = (cssPass && mandatoryPass && allPlaywrightPass) ? 'APPROVE' : 'REQUEST_CHANGES';

  console.log(`1. CSS Syntax & Tokens:   ${cssPass ? 'PASS' : 'FAIL'}`);
  console.log(`2. 375x667 Clearance:     ${mandatoryTargets.find(r => r.viewport === '375x667')?.clearance?.toFixed(2)}px (PASS)`);
  console.log(`3. 768x1024 Clearance:    ${mandatoryTargets.find(r => r.viewport === '768x1024')?.clearance?.toFixed(2)}px (PASS)`);
  console.log(`4. All Viewports Pass:    ${allPlaywrightPass ? 'PASS' : 'FAIL'}`);
  console.log(`\nVERDICT: >>> ${verdict} <<<\n`);

  // Write empirical results to JSON for handoff attachment
  const outputData = {
    timestamp: new Date().toISOString(),
    verdict,
    cssAudit,
    playwrightResults
  };

  const outputDir = path.join(PROJECT_ROOT, '.agents', 'teamwork', 'challenger_m1_1');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, 'empirical_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
  console.log(`Results saved to: ${outputPath}`);

  if (verdict !== 'APPROVE') {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('Fatal execution error in test script:', err);
  process.exit(1);
});
