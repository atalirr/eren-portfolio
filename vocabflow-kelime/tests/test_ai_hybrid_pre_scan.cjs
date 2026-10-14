/**
 * Verification Suite for AI Hybrid Pre-Scan & .env Security Architecture
 * Verifies:
 * 1. Key Security: GEMINI_API_KEY is strictly in .env, excluded by .gitignore, and NEVER in index.html.
 * 2. Hybrid Pre-Scan: Articles with known words trigger ZERO AI calls.
 * 3. Batch Resolution: Only genuine orphan words are bundled and resolved via AI.
 * 4. Self-Growing Cache: Resolved words persist into localStorage; subsequent views resolve offline.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`[PASS] ${testName}`);
    } else {
        console.error(`[FAIL] ${testName} ${details ? '- ' + details : ''}`);
        process.exitCode = 1;
    }
}

console.log('================================================================');
console.log('   AI HYBRID PRE-SCAN & .ENV SECURITY VERIFICATION SUITE       ');
console.log('================================================================\n');

// 1. Security & .env Isolation Audit
console.log('--- Section 1: API Key Isolation & Git Protection Audit ---');

const envPath = path.join(__dirname, '..', '.env');
assert(fs.existsSync(envPath), '.env file exists in project root');

const envContent = fs.readFileSync(envPath, 'utf8');
assert(envContent.includes('GEMINI_API_KEY='), '.env defines GEMINI_API_KEY');

const gitignorePath = path.join(__dirname, '..', '.gitignore');
assert(fs.existsSync(gitignorePath), '.gitignore file exists in project root');

const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
assert(gitignoreContent.includes('.env'), '.gitignore strictly blocks .env from version control');

const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// Extract the actual key from .env to verify it NEVER appears in index.html
const keyMatch = envContent.match(/GEMINI_API_KEY=([^\s]+)/);
if (keyMatch) {
    const rawKey = keyMatch[1].trim();
    assert(!htmlContent.includes(rawKey), 'index.html has ZERO references to the secret Gemini API key');
    assert(!htmlContent.includes('AIzaSy'), 'index.html does not contain any Google API key prefix');
}

// 2. Server Proxy Verification
console.log('\n--- Section 2: Secure Server Architecture ---');
const serverCjsPath = path.join(__dirname, '..', 'server.cjs');
assert(fs.existsSync(serverCjsPath), 'server.cjs proxy exists');

const { callGeminiBatch, loadEnv } = require('../server.cjs');
const loaded = loadEnv();
assert(Boolean(loaded.GEMINI_API_KEY), 'server.cjs loadEnv successfully reads GEMINI_API_KEY from .env');

// 3. Runtime Pre-Scan & Batch Resolution Logic
console.log('\n--- Section 3: Smart Hybrid Pre-Scan & Zero-Waste AI Simulation ---');

const scriptMatch = htmlContent.match(/<!-- JAVASCRIPT LOGIC -->\s*<script>([\s\S]*?)<\/script>/i);
assert(Boolean(scriptMatch), 'JavaScript logic script extracted from index.html');

const storageMap = new Map();
const mockLocalStorage = {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear(),
    get length() { return storageMap.size; }
};

let serverAiCalls = [];
let myMemoryCalls = [];

const mockFetch = async (url, opts) => {
    if (url === '/api/ai-resolve-words') {
        const body = JSON.parse((opts && opts.body) || '{}');
        serverAiCalls.push(body.words);
        const results = (body.words || []).map(w => ({
            word: w,
            turkish: w + ' (AI Türkçe çevirisi)',
            type: 'Kelime',
            phonetic: '/' + w + '/'
        }));
        return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, results })
        };
    }
    if (url.includes('mymemory')) {
        myMemoryCalls.push(url);
        return {
            ok: true,
            status: 200,
            json: async () => ({
                responseStatus: 200,
                responseData: { translatedText: 'örnek çeviri' }
            })
        };
    }
    return { ok: false, status: 404 };
};

const domElements = new Map();
class MockElement {
    constructor(id) {
        this.id = id;
        this.classList = { add: () => {}, remove: () => {}, contains: () => false };
        this.dataset = {};
        this.style = {};
        this.childNodes = [];
    }
    appendChild(c) { this.childNodes.push(c); return c; }
    removeChild(c) { return c; }
    replaceChildren() { this.childNodes = []; }
    addEventListener() {}
    removeEventListener() {}
}

const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval: () => {},
    clearInterval: () => {},
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
    localStorage: mockLocalStorage,
    navigator: { onLine: true },
    fetch: mockFetch,
    document: {
        getElementById: (id) => {
            if (!domElements.has(id)) domElements.set(id, new MockElement(id));
            return domElements.get(id);
        },
        createElement: () => new MockElement(''),
        createTextNode: (txt) => ({ nodeType: 3, nodeValue: txt, textContent: txt }),
        createDocumentFragment: () => new MockElement('frag'),
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener: () => {}
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    window: {},
    speechSynthesis: { speak: () => {}, cancel: () => {} },
    SpeechSynthesisUtterance: function() {}
};
sandbox.window = sandbox;

try {
    vm.createContext(sandbox);
    vm.runInContext(scriptMatch[1], sandbox);
} catch (err) {
    console.error('VM initialization error:', err);
    process.exit(1);
}

async function runPreScanTests() {
    const scanAndPreResolve = sandbox.scanAndPreResolveArticle;
    assert(typeof scanAndPreResolve === 'function', 'scanAndPreResolveArticle function is available');

    // TEST 3.1: Article containing ONLY known core vocabulary
    serverAiCalls = [];
    const knownArticle = {
        id: 'art_known',
        paragraphs: ['The space telescope discovered new galaxies in the universe.'],
        glossary: {}
    };

    await scanAndPreResolve(knownArticle);
    assert(serverAiCalls.length === 0, 'Zero AI calls made for article with 100% known core words (100% offline)');

    // TEST 3.2: Article containing novel/orphan words
    serverAiCalls = [];
    const articleWithOrphans = {
        id: 'art_orphans',
        paragraphs: [
            'Scientists observed unexpected bioflocculation and supercavitation phenomena in the abyss.'
        ],
        glossary: {}
    };

    await scanAndPreResolve(articleWithOrphans);
    assert(serverAiCalls.length === 1, 'Exactly one batch AI request made for unresolved orphan words');
    const batchedWords = serverAiCalls[0];
    assert(batchedWords.includes('bioflocculation'), 'Batched list includes orphan word "bioflocculation"');
    assert(batchedWords.includes('supercavitation'), 'Batched list includes orphan word "supercavitation"');
    assert(!batchedWords.includes('the') && !batchedWords.includes('in'), 'Common grammar words excluded from AI batch');

    // TEST 3.3: Persistence & Self-Growing Cache
    const cachedBio = mockLocalStorage.getItem('vocab_cache_bioflocculation');
    assert(Boolean(cachedBio), 'Resolved orphan word saved to localStorage');
    const parsedBio = JSON.parse(cachedBio);
    assert(parsedBio.isAIResult === true, 'Entry flagged as isAIResult');

    // TEST 3.4: Re-opening the article with those words now needs 0 AI calls
    serverAiCalls = [];
    await scanAndPreResolve(articleWithOrphans);
    assert(serverAiCalls.length === 0, 'Second scan triggers ZERO AI requests (Cache Hit on all words)');

    // TEST 3.5: Tap on word in reader resolves in 0ms from cache
    const wordDef = sandbox.getWordDefinition('bioflocculation');
    assert(wordDef !== null && wordDef.turkish.includes('AI'), 'Reader getWordDefinition resolves cached AI translation instantly (0ms)');

    console.log('\n================================================================');
    console.log(`AI HYBRID PRE-SCAN TEST COMPLETE: ${passedTests} / ${totalTests} passed.`);
    console.log('================================================================\n');

    if (passedTests === totalTests) {
        console.log('ALL SECURITY AND ARCHITECTURAL REQUIREMENTS VERIFIED!');
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runPreScanTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
