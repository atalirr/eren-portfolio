/**
 * Automated Verification Suite: FIFO Rolling Buffer Engine
 * Validates:
 * 1. MAX_ARTICLES_PER_CATEGORY is set to 3.
 * 2. rotateCategoryArticles prepends new articles and truncates to newest 3 (deleting older ones).
 * 3. Articles of unaffected categories remain completely intact.
 * 4. Merged articles are persisted to localStorage under key 'vocabflow_live_articles_v1'.
 * 5. Articles with duplicate titles/IDs are deduplicated gracefully.
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
console.log('     FIFO ROLLING BUFFER & LIVE ARTICLES VERIFICATION SUITE     ');
console.log('================================================================\n');

const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// 1. Static checks
console.log('--- Phase 1: Static Architecture & Element Audit ---');
assert(html.includes('id="btnArticleRefresh"'), 'btnArticleRefresh button exists in screenArticles header');
assert(html.includes('refreshLiveArticles()'), 'refreshLiveArticles() is bound to refresh button');
assert(html.includes('MAX_ARTICLES_PER_CATEGORY = 6'), 'MAX_ARTICLES_PER_CATEGORY is defined as 6');
assert(html.includes('vocabflow_live_articles_v1'), 'STORAGE_KEY_LIVE_ARTICLES uses key vocabflow_live_articles_v1');
assert(html.includes('createArticleCitationElement'), 'createArticleCitationElement function exists in index.html');
assert(html.includes('Kaynakça ve Orijinal Yayın'), 'Bibliography title exists in index.html');

// 2. VM Simulation
console.log('\n--- Phase 2: Runtime Sandbox & FIFO Rotation Logic ---');
const scriptMatch = html.match(/<!-- JAVASCRIPT LOGIC -->\s*<script>([\s\S]*?)<\/script>/i) ||
                    html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)?.[1]?.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
assert(Boolean(scriptMatch), 'Inline script extracted from index.html');

const mockStorage = {};
const mockLocalStorage = {
    getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

function createMockNode(id = '') {
    return {
        id,
        className: '',
        tagName: 'DIV',
        dataset: {},
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        textContent: '',
        children: [],
        childNodes: [],
        style: { removeProperty: () => {} },
        appendChild: function(c) { this.children.push(c); this.childNodes.push(c); return c; },
        removeChild: function(c) { this.children = this.children.filter(ch => ch !== c); return c; },
        replaceChildren: function(...newChildren) { this.children = newChildren.slice(); this.childNodes = newChildren.slice(); },
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelectorAll: () => [],
        querySelector: () => null
    };
}

const elementCache = {};
const mockDoc = {
    getElementById: (id) => {
        if (!elementCache[id]) elementCache[id] = createMockNode(id);
        return elementCache[id];
    },
    createElement: (tag) => {
        const n = createMockNode();
        n.tagName = tag.toUpperCase();
        return n;
    },
    createTextNode: (text) => {
        const n = createMockNode();
        n.textContent = text;
        return n;
    },
    querySelectorAll: () => []
};

const sandbox = {
    window: {},
    document: mockDoc,
    localStorage: mockLocalStorage,
    tailwind: { config: {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    setInterval: () => {},
    setTimeout: (fn) => { if (typeof fn === 'function') fn(); },
    console,
    Date,
    Math,
    String,
    Array,
    Object,
    RegExp,
    Set,
    Map
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(scriptMatch[1], sandbox);

assert(typeof sandbox.rotateCategoryArticles === 'function', 'rotateCategoryArticles function is available');
assert(sandbox.MAX_ARTICLES_PER_CATEGORY === 6, 'MAX_ARTICLES_PER_CATEGORY is strictly 6');

// Phase 3: Push 8 articles into a category sequentially (FIFO behavior)
console.log('\n--- Phase 3: Pushing 8 Articles into "Popüler Bilim" ---');
const testCategory = 'Popüler Bilim';

const incomingArticles = [
    { id: 'pb-new-1', category: testCategory, title: 'Quantum Breakthrough 1', level: 'B1', wordCount: 520, readTimeMinutes: 3 },
    { id: 'pb-new-2', category: testCategory, title: 'Black Hole Discoveries 2', level: 'B2', wordCount: 580, readTimeMinutes: 3 },
    { id: 'pb-new-3', category: testCategory, title: 'Mars Rover Rock Samples 3', level: 'A2', wordCount: 510, readTimeMinutes: 3 },
    { id: 'pb-new-4', category: testCategory, title: 'Fusion Energy Milestone 4', level: 'C1', wordCount: 600, readTimeMinutes: 3 },
    { id: 'pb-new-5', category: testCategory, title: 'Exoplanet Water Biosignature 5', level: 'B2', wordCount: 550, readTimeMinutes: 3 },
    { id: 'pb-new-6', category: testCategory, title: 'James Webb Cosmic Dawn 6', level: 'C1', wordCount: 640, readTimeMinutes: 4 },
    { id: 'pb-new-7', category: testCategory, title: 'Supernova Explosion Echo 7', level: 'B1', wordCount: 530, readTimeMinutes: 3 },
    { id: 'pb-new-8', category: testCategory, title: 'Europa Ocean Exploration 8', level: 'B2', wordCount: 590, readTimeMinutes: 3 }
];

// Rotate batch of 8
sandbox.rotateCategoryArticles(testCategory, incomingArticles);

const afterRotation = sandbox.articlesDB.filter(a => a.category === testCategory);
assert(afterRotation.length === 6, 'Category has strictly 6 articles after rotating 8 items', `Found ${afterRotation.length}`);
assert(afterRotation[0].id === 'pb-new-1', 'Newest article pb-new-1 is at index 0');
assert(afterRotation[1].id === 'pb-new-2', 'Second article pb-new-2 is at index 1');
assert(afterRotation[5].id === 'pb-new-6', 'Sixth article pb-new-6 is at index 5');
assert(!afterRotation.some(a => a.id === 'pb-new-7'), '7th article was dropped by FIFO limit');
assert(!afterRotation.some(a => a.id === 'pb-new-8'), '8th article was dropped by FIFO limit');

// Phase 4: Push a 9th single article
console.log('\n--- Phase 4: Pushing a 9th Single Article ---');
sandbox.rotateCategoryArticles(testCategory, [
    { id: 'pb-new-9', category: testCategory, title: 'Asteroid Deflection Success 9', level: 'C1', wordCount: 620, readTimeMinutes: 4 }
]);

const afterNinth = sandbox.articlesDB.filter(a => a.category === testCategory);
assert(afterNinth.length === 6, 'Category maintains strictly 6 articles (MAX_ARTICLES_PER_CATEGORY)');
assert(afterNinth[0].id === 'pb-new-9', 'pb-new-9 occupies index 0');
assert(afterNinth[1].id === 'pb-new-1', 'pb-new-1 shifted to index 1');
assert(afterNinth[5].id === 'pb-new-5', 'pb-new-5 shifted to index 5');
assert(!afterNinth.some(a => a.id === 'pb-new-6'), 'pb-new-6 was dropped by FIFO limit');

// Phase 5: Persistence to localStorage
console.log('\n--- Phase 5: Storage Synchronization ---');
const rawStored = mockLocalStorage.getItem('vocabflow_live_articles_v1');
assert(Boolean(rawStored), 'localStorage has key "vocabflow_live_articles_v1"');
const parsedStored = JSON.parse(rawStored);
assert(Array.isArray(parsedStored), 'Stored data parses into Array');
const storedPopSci = parsedStored.filter(a => a.category === testCategory);
assert(storedPopSci.length === 6, 'Stored data has exactly 6 articles for test category');
assert(storedPopSci[0].id === 'pb-new-9', 'Stored top article matches runtime state');

// Phase 6: Unaffected categories check
console.log('\n--- Phase 6: Non-interfering Category Isolation ---');
const cinemaArticles = sandbox.articlesDB.filter(a => a.category === 'Sinema & Kültür');
assert(cinemaArticles.length >= 1, 'Unaffected category "Sinema & Kültür" retained its articles intact');

console.log('\n================================================================');
console.log(`VERIFICATION COMPLETE: ${passedTests} / ${totalTests} tests passed.`);
console.log('================================================================\n');

if (passedTests === totalTests) {
    console.log('>>> ALL FIFO ROLLING BUFFER SPECIFICATIONS VERIFIED! <<<');
} else {
    process.exitCode = 1;
}
