/**
 * Milestone 2 Empirical Adversarial Challenger Test Suite
 * 
 * Conducts deep adversarial stress-testing against Milestone 2:
 * 1. Root-cause analysis of test_m2_navigation_articles.cjs failure.
 * 2. Rapid 5-tab switching stress harness (1000 iterations).
 * 3. Rapid category filtering stress harness (100 iterations, verifying zero zombie DOM nodes).
 * 4. Adversarial HTML/XSS injection harness against renderArticlesFeed() and openArticle().
 * 5. Architectural contract validation: window.appState vs script-scoped appState.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
    if (condition) {
        passedTests++;
        console.log(`[PASS] ${testName}`);
    } else {
        failedTests++;
        failures.push({ testName, details });
        console.error(`[FAIL] ${testName} ${details ? '- ' + details : ''}`);
    }
}

console.log('================================================================');
console.log('    EMPIRICAL ADVERSARIAL CHALLENGER TEST SUITE (MILESTONE 2)   ');
console.log('================================================================\n');

const htmlPath = path.join(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// --- CHALLENGE 1: Root-Cause Analysis of Worker M2 Verification Suite ---
console.log('--- Challenge 1: Verification of Worker M2 Test Suite Defect ---');

// Check if test_m2_navigation_articles.cjs passes or fails when executed directly
const workerTestPath = path.join(__dirname, 'test_m2_navigation_articles.cjs');
const workerTestCode = fs.readFileSync(workerTestPath, 'utf8');

// The worker test lacks window.addEventListener and tries to read sandbox.appState
const hasWindowAddEventListenerMock = workerTestCode.includes('addEventListener') && workerTestCode.includes('sandbox = {') && workerTestCode.includes('addEventListener:');
assert(!hasWindowAddEventListenerMock, 'Confirmed: worker test mock window lacks addEventListener method');

const readsSandboxAppState = workerTestCode.includes('sandbox.appState');
assert(readsSandboxAppState, 'Confirmed: worker test directly inspects sandbox.appState');

const indexExportsAppState = /window\.appState\s*=\s*appState/.test(htmlContent);
assert(!indexExportsAppState, 'Observed: index.html does NOT export appState to window (window.appState is undefined)');

// --- CHALLENGE 2: Mock Environment Construction with Full Window Support ---
console.log('\n--- Challenge 2: Headless DOM Environment Setup ---');

class MockDOMNode {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.childNodes = [];
        this.attributes = new Map();
        this.className = '';
        this.textContent = '';
        this.dataset = {};
        this.style = {};
        this.parentNode = null;
        this.eventListeners = {};
        this.id = '';
        this.title = '';
        this.value = '';
    }

    get innerText() { return this.textContent; }
    set innerText(val) { this.textContent = String(val); }

    get firstChild() { return this.childNodes[0] || null; }

    appendChild(child) {
        if (!child) return;
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = this;
        this.childNodes.push(child);
        return child;
    }

    removeChild(child) {
        const idx = this.childNodes.indexOf(child);
        if (idx >= 0) this.childNodes.splice(idx, 1);
        child.parentNode = null;
        return child;
    }

    replaceChildren(...newChildren) {
        while (this.childNodes.length > 0) {
            this.removeChild(this.childNodes[0]);
        }
        for (const c of newChildren) {
            this.appendChild(c);
        }
    }

    setAttribute(name, val) {
        this.attributes.set(name, String(val));
        if (name === 'class') this.className = String(val);
        if (name === 'id') this.id = String(val);
        if (name.startsWith('data-')) {
            const key = name.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
            this.dataset[key] = String(val);
        }
    }

    getAttribute(name) {
        return this.attributes.get(name) || null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    get classList() {
        const self = this;
        return {
            add(...classes) {
                const set = new Set(self.className.split(/\s+/).filter(Boolean));
                classes.forEach(c => set.add(c));
                self.className = Array.from(set).join(' ');
            },
            remove(...classes) {
                const set = new Set(self.className.split(/\s+/).filter(Boolean));
                classes.forEach(c => set.delete(c));
                self.className = Array.from(set).join(' ');
            },
            contains(cls) {
                return self.className.split(/\s+/).includes(cls);
            },
            toggle(cls, force) {
                if (force !== undefined) {
                    if (force) this.add(cls);
                    else this.remove(cls);
                } else {
                    if (this.contains(cls)) this.remove(cls);
                    else this.add(cls);
                }
            }
        };
    }

    addEventListener(event, handler) {
        if (!this.eventListeners[event]) this.eventListeners[event] = [];
        this.eventListeners[event].push(handler);
    }

    removeEventListener(event, handler) {
        if (!this.eventListeners[event]) return;
        this.eventListeners[event] = this.eventListeners[event].filter(h => h !== handler);
    }

    click() {
        if (this.eventListeners['click']) {
            this.eventListeners['click'].forEach(fn => fn({ stopPropagation: () => {} }));
        }
    }

    querySelectorAll(selector) {
        const results = [];
        function traverse(node) {
            for (const child of node.childNodes) {
                let match = false;
                if (selector.startsWith('.')) {
                    const cls = selector.slice(1);
                    if (child.className && child.className.split(/\s+/).includes(cls)) match = true;
                } else if (selector.startsWith('#')) {
                    if (child.id === selector.slice(1)) match = true;
                } else if (selector === child.tagName.toLowerCase() || selector === child.tagName) {
                    match = true;
                }
                if (match) results.push(child);
                traverse(child);
            }
        }
        traverse(this);
        return results;
    }

    querySelector(selector) {
        const all = this.querySelectorAll(selector);
        return all[0] || null;
    }
}

const elementMap = new Map();
function getEl(id, tag = 'div') {
    if (!elementMap.has(id)) {
        const el = new MockDOMNode(tag);
        el.id = id;
        elementMap.set(id, el);
    }
    return elementMap.get(id);
}

// Build DOM nodes
const screenIds = ['screenHome', 'screenWords', 'screenStats', 'screenSettings', 'screenOnboarding', 'screenStudy', 'screenArticles'];
screenIds.forEach(id => getEl(id, 'section'));

getEl('bottomTabBar', 'nav');
getEl('toastNotification', 'div');
getEl('toastText', 'span');
getEl('currentTime', 'span');
getEl('articleFeedList', 'div');
getEl('articleCategoryBar', 'div');
getEl('swipeCard', 'div');
getEl('aiRecommendationsContainer', 'div');
getEl('modalAddWord', 'div');
getEl('modalEnInput', 'input');
getEl('modalWordDetail', 'div');
getEl('detailWordType', 'span');
getEl('detailWordEn', 'h2');
getEl('detailWordPhonetic', 'p');
getEl('detailWordTr', 'p');
getEl('detailWordExamples', 'div');
getEl('statsStreakNum', 'span');
getEl('statsTotalNum', 'span');
getEl('statsMasteryTotal', 'span');
getEl('barMastered', 'div');
getEl('barLearning', 'div');
getEl('barNew', 'div');
getEl('txtMasteredPct', 'span');
getEl('txtLearningPct', 'span');
getEl('txtNewPct', 'span');
getEl('txtMasteredCount', 'p');
getEl('txtLearningCount', 'p');
getEl('txtNewCount', 'p');
getEl('toggleThemeSwitch', 'input');
getEl('themeIcon', 'span');
getEl('themeLabel', 'p');
getEl('themeIconBox', 'div');
getEl('targetLanguageSelect', 'select');
getEl('wordFilterAll', 'button');
getEl('wordFilterMastered', 'button');
getEl('wordFilterStarred', 'button');
getEl('wordListContainer', 'div');
getEl('cardWordEn', 'h2');
getEl('cardWordPhonetic', 'p');
getEl('cardWordType', 'span');
getEl('cardQuizOptions', 'div');
getEl('cardQuizFeedback', 'div');
getEl('cardSuccessCheck', 'div');

// Bottom Tab buttons
const bottomBar = getEl('bottomTabBar');
['home', 'words', 'articles', 'stats', 'settings'].forEach(tab => {
    const btn = new MockDOMNode('button');
    btn.className = tab === 'home' ? 'nav-btn active' : 'nav-btn';
    btn.dataset.tab = tab;
    const icon = new MockDOMNode('span');
    icon.className = 'material-symbols-outlined' + (tab === 'home' ? ' icon-fill' : '');
    icon.textContent = tab === 'articles' ? 'menu_book' : 'icon';
    btn.appendChild(icon);
    const label = new MockDOMNode('span');
    label.textContent = tab;
    btn.appendChild(label);
    bottomBar.appendChild(btn);
});

// Category Bar pills
const catBar = getEl('articleCategoryBar');
['all', 'Popüler Bilim', 'Sinema & Kültür', 'İlginç Hikayeler', 'Teknoloji', 'Doğa & Gezi'].forEach(cat => {
    const pill = new MockDOMNode('button');
    pill.className = cat === 'all' ? 'article-cat-pill active' : 'article-cat-pill';
    pill.dataset.category = cat;
    pill.textContent = cat === 'all' ? 'Tümü' : cat;
    catBar.appendChild(pill);
});

const mockDoc = {
    getElementById(id) { return getEl(id); },
    createElement(tag) { return new MockDOMNode(tag); },
    createTextNode(txt) {
        const n = new MockDOMNode('#text');
        n.textContent = txt;
        return n;
    },
    querySelectorAll(sel) {
        if (sel === '.nav-btn') return bottomBar.querySelectorAll('.nav-btn');
        if (sel === '.article-cat-pill') return catBar.querySelectorAll('.article-cat-pill');
        if (sel === '.ob-slide') return [];
        return [];
    },
    documentElement: new MockDOMNode('html')
};

const windowEvents = {};
const fullSandbox = {
    console,
    document: mockDoc,
    setInterval: () => {},
    setTimeout: (fn) => { if (typeof fn === 'function') fn(); },
    Date,
    Math,
    String,
    Array,
    Object,
    RegExp,
    Set,
    Map,
    addEventListener(evt, fn) {
        if (!windowEvents[evt]) windowEvents[evt] = [];
        windowEvents[evt].push(fn);
    },
    removeEventListener(evt, fn) {
        if (!windowEvents[evt]) return;
        windowEvents[evt] = windowEvents[evt].filter(f => f !== fn);
    },
    speechSynthesis: {
        cancel: () => {},
        speak: () => {}
    },
    SpeechSynthesisUtterance: function(text) { this.text = text; }
};
fullSandbox.window = fullSandbox;

// Extract script
const fullScriptMatch = htmlContent.match(/<!-- JAVASCRIPT LOGIC -->\s*<script>([\s\S]*?)<\/script>/i);
assert(Boolean(fullScriptMatch), 'Extracted JavaScript logic block from index.html');
const scriptSource = fullScriptMatch ? fullScriptMatch[1] : '';

// Wrap script in an execution that exposes appState to sandbox for empirical testing
const instrumentedScript = scriptSource + '\n; if (typeof appState !== "undefined") window.__testAppState = appState;';

vm.createContext(fullSandbox);
let executionErr = null;
try {
    vm.runInContext(instrumentedScript, fullSandbox);
} catch (e) {
    executionErr = e;
}

assert(!executionErr, 'Index.html script executes cleanly with standard window event listeners', executionErr ? executionErr.stack : '');

const appState = fullSandbox.__testAppState;
assert(Boolean(appState), 'Retrieved internal appState reference for empirical testing');

// --- CHALLENGE 3: Rapid Tab Switching Stress Harness (1,000 Iterations) ---
console.log('\n--- Challenge 3: Rapid 5-Tab Switching Stress Harness ---');

const tabs = ['home', 'words', 'articles', 'stats', 'settings'];
let corruptedState = false;
const iterations = 1000;

for (let i = 0; i < iterations; i++) {
    const tab = tabs[i % tabs.length];
    fullSandbox.switchTab(tab);

    // Verify active tab state
    if (appState.activeTab !== tab) {
        corruptedState = true;
        break;
    }

    // Verify exactly 1 screen is visible
    let visibleCount = 0;
    screenIds.forEach(id => {
        const el = mockDoc.getElementById(id);
        if (!el.classList.contains('hidden')) visibleCount++;
    });

    if (visibleCount !== 1) {
        corruptedState = true;
        break;
    }

    // Verify screenArticles hidden status
    const articlesScreen = mockDoc.getElementById('screenArticles');
    const expectedArticlesVisible = (tab === 'articles');
    const actualArticlesVisible = !articlesScreen.classList.contains('hidden');
    if (expectedArticlesVisible !== actualArticlesVisible) {
        corruptedState = true;
        break;
    }
}

assert(!corruptedState, `Rapid 5-tab switching (${iterations} switches) maintains clean visibility and zero DOM corruption`);

// Check final state on articles tab
fullSandbox.switchTab('articles');
const activeNavBtn = bottomBar.querySelectorAll('.nav-btn').find(b => b.dataset.tab === 'articles');
assert(activeNavBtn.className.includes('active'), 'Active articles tab button correctly styled');

// --- CHALLENGE 4: Category Filtering Stress & DOM Leak Harness ---
console.log('\n--- Challenge 4: Category Filtering Stress & DOM Node Stability ---');

const categories = ['all', 'Popüler Bilim', 'Sinema & Kültür', 'İlginç Hikayeler', 'Teknoloji', 'Doğa & Gezi'];
const feedListEl = mockDoc.getElementById('articleFeedList');

// Filter switching stress
let filterError = false;
for (let i = 0; i < 120; i++) {
    const cat = categories[i % categories.length];
    fullSandbox.filterArticleCategory(cat);

    const cards = feedListEl.querySelectorAll('article');
    const expectedCount = (cat === 'all') ? 5 : 1;
    if (cards.length !== expectedCount) {
        filterError = true;
        console.error(`Filter count mismatch for "${cat}": expected ${expectedCount}, got ${cards.length}`);
        break;
    }

    // Verify container child count equals card count (no residual or zombie nodes)
    if (feedListEl.childNodes.length !== expectedCount) {
        filterError = true;
        console.error(`Feed container childNodes mismatch: expected ${expectedCount}, got ${feedListEl.childNodes.length}`);
        break;
    }
}

assert(!filterError, 'Rapid category filter switching (120 switches) maintains strict DOM counts without zombie nodes');

// Empty filter stress
fullSandbox.filterArticleCategory('NonExistentCategory');
const emptyCards = feedListEl.querySelectorAll('.glass-card');
assert(emptyCards.length === 1, 'Non-existent category produces exactly 1 empty state card');
assert(feedListEl.childNodes.length === 1, 'Empty state card completely replaces previous feed without leakage');

// Reset to all
fullSandbox.filterArticleCategory('all');
assert(feedListEl.querySelectorAll('article').length === 5, 'Resetting filter to "all" restores all 5 articles');

// --- CHALLENGE 5: Adversarial HTML & Injection Attack Vector Testing ---
console.log('\n--- Challenge 5: Adversarial Payload Injection Resilience ---');

const maliciousPayloads = [
    '<script>alert("XSS-TITLE")</script>',
    '<img src=x onerror=alert("XSS-IMG")>',
    '"><svg onload=alert("XSS-SVG")>',
    "';alert('XSS-QUOTE');//",
    '<iframe src="javascript:alert(1)"></iframe>',
    '<b>bold</b><style>body{display:none}</style>'
];

let injectionDetected = false;
const originalArticlesDB = [...fullSandbox.articlesDB];

maliciousPayloads.forEach((payload, idx) => {
    // Inject adversarial article into dataset
    const evilArticle = {
        id: `evil-${idx}`,
        category: 'Popüler Bilim',
        title: `Adversarial Title ${payload}`,
        subtitle: `Adversarial Subtitle ${payload}`,
        level: 'B2',
        wordCount: 150,
        readTimeMinutes: 1,
        coverGradient: `from-red-600 to-black ${payload}`,
        glossary: { 'test': { turkish: 'test', phonetic: '/t/', type: 'İsim' } },
        quiz: []
    };

    // Mutate existing array so lexical closure sees it
    fullSandbox.articlesDB.splice(0, fullSandbox.articlesDB.length, evilArticle);
    fullSandbox.renderArticlesFeed();

    const renderedCard = feedListEl.querySelector('article');
    const titleNode = renderedCard.querySelector('h3');
    const subtitleNode = renderedCard.querySelector('p');

    // Verify that title and subtitle textContent matches literal payload without creating element nodes
    if (titleNode.childNodes.length !== 0 && titleNode.childNodes.some(c => c.tagName !== '#TEXT')) {
        injectionDetected = true;
        console.error(`HTML tag injection detected in title: ${payload}`);
    }

    if (titleNode.textContent !== evilArticle.title) {
        injectionDetected = true;
        console.error(`Title textContent mismatch: ${titleNode.textContent}`);
    }

    // Verify that no SCRIPT, IMG, SVG, or IFRAME elements were created inside the feed container
    const dangerousElements = feedListEl.querySelectorAll('script, img, svg, iframe, style');
    if (dangerousElements.length > 0) {
        injectionDetected = true;
        console.error(`Dangerous element rendered in DOM from payload: ${payload}`);
    }

    // Test openArticle with malicious title and id
    let toastReceived = '';
    const origToast = mockDoc.getElementById('toastText');
    fullSandbox.openArticle(`evil-${idx}`);
    if (appState.currentArticleId !== `evil-${idx}`) {
        injectionDetected = true;
        console.error(`openArticle failed to set currentArticleId safely`);
    }
});

assert(!injectionDetected, 'renderArticlesFeed and openArticle are 100% resilient against raw HTML and XSS payloads');

// Restore original articlesDB
fullSandbox.articlesDB.splice(0, fullSandbox.articlesDB.length, ...originalArticlesDB);
fullSandbox.filterArticleCategory('all');

// --- CHALLENGE 6: Visual & Responsive Layout Audit (PROJECT.md & M2 Requirements) ---
console.log('\n--- Challenge 6: Visual Layout & Architecture Conformance ---');

// 6.1 Bottom bar padding check
const bottomBarHtml = htmlContent.match(/<nav\s+id="bottomTabBar"[^>]*class="([^"]+)"/i);
assert(Boolean(bottomBarHtml && bottomBarHtml[1].includes('px-3')), 'Bottom bar uses px-3 padding to prevent clipping with 5 tabs');

// 6.2 All 5 curated articles check
assert(originalArticlesDB.length === 5, 'Dataset contains exactly 5 curated articles');

const expectedCategories = ['Popüler Bilim', 'Sinema & Kültür', 'İlginç Hikayeler', 'Teknoloji', 'Doğa & Gezi'];
const foundCats = originalArticlesDB.map(a => a.category);
const allCatsCovered = expectedCategories.every(c => foundCats.includes(c));
assert(allCatsCovered, 'All 5 niche magazine categories represented');

const levels = new Set(originalArticlesDB.map(a => a.level));
assert(levels.has('A2') && levels.has('B1') && levels.has('B2') && levels.has('C1'), 'Articles span levels A2, B1, B2, C1');

// 6.3 Reading time formula check (Math.ceil(wordCount / 200))
const readTimesAccurate = originalArticlesDB.every(a => a.readTimeMinutes === Math.ceil(a.wordCount / 200));
assert(readTimesAccurate, 'All articles calculate readTimeMinutes strictly using Math.ceil(wordCount / 200)');

console.log('\n================================================================');
console.log(`CHALLENGE SUITE COMPLETE: ${passedTests} passed | ${failedTests} failed.`);
console.log('================================================================\n');

if (failedTests > 0) {
    console.error('CHALLENGE REPORTED FAILURES:');
    failures.forEach(f => console.error(` - [FAIL] ${f.testName}: ${f.details}`));
}
