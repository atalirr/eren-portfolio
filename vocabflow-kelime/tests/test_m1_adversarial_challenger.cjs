/**
 * Milestone 1 Adversarial Security Challenger Test Suite
 * Executes comprehensive stress-testing against Milestone 1 security hardening:
 * - Tests safeFallbackSanitizer against nested tags, case variations, attribute injections, protocol obfuscation, DOM clobbering
 * - Tests DOMPurify baseline under ARTICLE_PURIFY_CONFIG
 * - Tests refactored DOM construction functions against quote/regex breakouts
 * - Evaluates outputs in real Microsoft Edge headless browser runtime
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('================================================================');
console.log('    EMPIRICAL ADVERSARIAL CHALLENGER TEST SUITE (MILESTONE 1)   ');
console.log('================================================================\n');

const runnerHtmlPath = path.join(__dirname, 'adversarial_runner.html');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

if (!fs.existsSync(edgePath)) {
    console.error('[ERROR] Microsoft Edge binary not found at:', edgePath);
    process.exit(1);
}

if (!fs.existsSync(runnerHtmlPath)) {
    console.error('[ERROR] adversarial_runner.html not found at:', runnerHtmlPath);
    process.exit(1);
}

console.log('Executing test harness in Microsoft Edge headless environment...');
const fileUrl = 'file:///' + runnerHtmlPath.replace(/\\/g, '/');

let domDump = '';
try {
    domDump = execSync(`"${edgePath}" --headless=new --disable-gpu --virtual-time-budget=3000 --dump-dom "${fileUrl}"`, {
        timeout: 30000,
        encoding: 'utf8'
    });
} catch (err) {
    console.error('[ERROR] Failed to run Microsoft Edge headless:', err.message);
    process.exit(1);
}

const match = domDump.match(/<div id="results"[^>]*>([\s\S]*?)<\/div>/i);
if (!match || !match[1].trim()) {
    console.error('[ERROR] Could not extract results from dumped DOM. Raw dump length:', domDump.length);
    process.exit(1);
}

// Decode HTML entities in dumped pre/div
const rawJson = match[1]
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

let testResults = [];
try {
    testResults = JSON.parse(rawJson);
} catch (parseErr) {
    console.error('[ERROR] Failed to parse JSON test results:', parseErr.message);
    console.log('Raw JSON preview:', rawJson.substring(0, 500));
    process.exit(1);
}

console.log(`\nCollected ${testResults.length} empirical test cases from browser runtime.\n`);

let passedCount = 0;
let failedCount = 0;
const failures = [];

testResults.forEach(tc => {
    const status = tc.passed ? '[PASS]' : '[FAIL]';
    if (tc.passed) {
        passedCount++;
        console.log(`${status} ${tc.id}: ${tc.category} - ${tc.name}`);
    } else {
        failedCount++;
        failures.push(tc);
        console.error(`${status} ${tc.id}: ${tc.category} - ${tc.name}`);
        if (tc.payload) console.error(`       Payload : ${tc.payload}`);
        console.error(`       Target  : ${tc.target || 'DOM'}`);
        console.error(`       Output  : ${tc.output}`);
        console.error(`       Issues  : ${tc.issues ? tc.issues.join(', ') : 'Unknown issue'}`);
    }
});

console.log('\n================================================================');
console.log(`  SUMMARY: Total: ${testResults.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
console.log('================================================================\n');

if (failedCount > 0) {
    console.error(`ADVERSARIAL CHALLENGE RESULT: VULNERABILITIES DETECTED! (${failedCount} failure(s))`);
    console.error('\nDetailed Breakdown of Failures:');
    failures.forEach((f, idx) => {
        console.error(`\n--- Failure #${idx + 1} [${f.id}] ---`);
        console.error(`Name:    ${f.name}`);
        console.error(`Target:  ${f.target}`);
        console.error(`Payload: ${f.payload}`);
        console.error(`Output:  ${f.output}`);
        console.error(`Reasons: ${f.issues.join('; ')}`);
    });
    console.log('\nVerdict: REQUEST_CHANGES');
} else {
    console.log('ADVERSARIAL CHALLENGE RESULT: All tests passed. Verdict: APPROVE');
}
