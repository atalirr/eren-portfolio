/**
 * Automated Verification Suite for Multi-Layer Dynamic Translation & Caching Architecture
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
console.log('  DYNAMIC TRANSLATION, CACHE & ARTICLE INGESTION TEST SUITE    ');
console.log('================================================================\n');

const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scriptMatch = html.match(/<!-- JAVASCRIPT LOGIC -->\s*<script>([\s\S]*?)<\/script>/i);
if (!scriptMatch) {
    console.error('[FATAL] Main inline script block could not be extracted from index.html');
    process.exit(1);
}
const scriptCode = scriptMatch[1];

const storageMap = new Map();
const mockLocalStorage = {
    getItem: (key) => storageMap.get(key) || null,
    setItem: (key, val) => storageMap.set(key, String(val)),
    removeItem: (key) => storageMap.delete(key),
    clear: () => storageMap.clear(),
    get length() { return storageMap.size; }
};

const domElements = new Map();

class MockElement {
    constructor(id, tagName = 'div') {
        this.id = id;
        this.tagName = tagName.toUpperCase();
        this.className = '';
        this.classList = {
            _classes: new Set(),
            add: (...cls) => cls.forEach(c => this.classList._classes.add(c)),
            remove: (...cls) => cls.forEach(c => this.classList._classes.delete(c)),
            contains: (c) => this.classList._classes.has(c),
            toggle: (c) => this.classList.contains(c) ? this.classList.remove(c) : this.classList.add(c)
        };
        this.dataset = {};
        this.style = {};
        this._textContent = '';
        this.childNodes = [];
        this.disabled = false;
    }
    get textContent() { return this._textContent; }
    set textContent(v) { this._textContent = String(v); }
    appendChild(n) { this.childNodes.push(n); return n; }
    removeChild(n) {
        const i = this.childNodes.indexOf(n);
        if (i >= 0) this.childNodes.splice(i, 1);
        return n;
    }
    replaceChildren(...nodes) { this.childNodes = [...nodes]; }
    get firstChild() { return this.childNodes[0] || null; }
    querySelector() { return null; }
    addEventListener() {}
    removeEventListener() {}
    getBoundingClientRect() { return { top: 100, bottom: 140, left: 50, right: 150, width: 100, height: 40 }; }
}

function getMockEl(id, tag = 'div') {
    if (!domElements.has(id)) {
        domElements.set(id, new MockElement(id, tag));
    }
    return domElements.get(id);
}

[
    'modalArticleWordLookup', 'modalArticleWordLookupCard', 'lookupHeadword', 'lookupPhonetic',
    'lookupWordTypeBadge', 'lookupContextWrapper', 'lookupContextLabel', 'lookupTurkish',
    'lookupPrimaryWrapper', 'lookupPrimaryLabel', 'lookupPrimaryMeaning', 'lookupContextSentence',
    'lookupAddWordBtn', 'lookupAddWordText', 'lookupAddWordIcon', 'articleBodyContent',
    'screenArticles', 'appViewport', 'articlesFeedList', 'articleReaderView'
].forEach(id => getMockEl(id));

let onlineFetchHistory = [];
let mockFetchHandler = async (url) => {
    onlineFetchHistory.push(url);
    if (url.includes('serendipity')) {
        return {
            ok: true,
            status: 200,
            json: async () => ({
                responseStatus: 200,
                responseData: { translatedText: 'tesadüf' }
            })
        };
    }
    if (url.includes('photosynthesis')) {
        return {
            ok: true,
            status: 200,
            json: async () => ({
                responseStatus: 200,
                responseData: { translatedText: 'fotosentez' }
            })
        };
    }
    return {
        ok: false,
        status: 404,
        json: async () => ({ responseStatus: 404 })
    };
};

const sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: () => {},
    clearInterval: () => {},
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
    localStorage: mockLocalStorage,
    navigator: { onLine: true },
    fetch: (url, opts) => mockFetchHandler(url, opts),
    AbortController: class {
        constructor() { this.signal = {}; }
        abort() {}
    },
    document: {
        getElementById: (id) => getMockEl(id),
        createElement: (tag) => new MockElement('', tag),
        createTextNode: (txt) => ({ nodeType: 3, nodeValue: txt, textContent: txt }),
        createDocumentFragment: () => new MockElement('', 'fragment'),
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener: () => {}
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    window: {},
    speechSynthesis: { speak: () => {}, cancel: () => {} },
    SpeechSynthesisUtterance: function(txt) { this.text = txt; }
};
sandbox.window = sandbox;

try {
    vm.createContext(sandbox);
    vm.runInContext(scriptCode, sandbox);
} catch (err) {
    console.error('VM initialization error:', err);
    process.exit(1);
}

console.log('--- Section 1: Offline Core & MWE Concept Lookups ---');

const getWordDefinition = sandbox.getWordDefinition;
assert(typeof getWordDefinition === 'function', 'getWordDefinition is available');

const mweDef = getWordDefinition('Big Bang');
assert(mweDef !== null, 'Big Bang resolves via multiWordConceptsDB');
assert(mweDef.turkish.toLowerCase().includes('büyük patlama'), 'Big Bang translation contains "Büyük Patlama"');
assert(mweDef.isCompound === true, 'Big Bang flagged as isCompound');

const coreDef = getWordDefinition('telescope');
assert(coreDef !== null && coreDef.turkish.toLowerCase().includes('teleskop'), 'Core word "telescope" resolves offline to "teleskop"');

const stemDef = getWordDefinition('galaxies');
assert(stemDef !== null && stemDef.turkish.toLowerCase().includes('galaksi'), 'Inflected word "galaxies" resolves offline to "galaksi"');

console.log('\n--- Section 2: Live Online Fallback Translation ---');

const fetchOnlineTranslation = sandbox.fetchOnlineTranslation;
assert(typeof fetchOnlineTranslation === 'function', 'fetchOnlineTranslation is available');

async function runTests() {
    onlineFetchHistory = [];
    const res = await fetchOnlineTranslation('serendipity');
    assert(res !== null, 'Online translation resolved for "serendipity"');
    assert(res.turkish === 'tesadüf', 'Translation result is "tesadüf"');
    assert(res.isOnlineResult === true, 'Flagged as isOnlineResult');
    const firstCallReqCount = onlineFetchHistory.length;
    assert(firstCallReqCount > 0, 'Network request dispatched');

    console.log('\n--- Section 3: In-Memory & Persistent LocalStorage Cache ---');

    const memCached = sandbox.sessionWordCache['serendipity'];
    assert(Boolean(memCached), 'Word is cached in sessionWordCache');
    assert(memCached && memCached.turkish === 'tesadüf', 'sessionWordCache contains correct translation');

    const stored = mockLocalStorage.getItem('vocab_cache_serendipity');
    assert(Boolean(stored), 'Word is stored in localStorage under "vocab_cache_serendipity"');
    const parsedStored = JSON.parse(stored);
    assert(parsedStored.turkish === 'tesadüf', 'localStorage contains valid JSON translation');

    const secondCall = await fetchOnlineTranslation('serendipity');
    assert(secondCall.turkish === 'tesadüf', 'Subsequent lookup resolves immediately');
    assert(onlineFetchHistory.length === firstCallReqCount, 'Zero additional network requests made (Cache Hit)');

    const defFromCache = getWordDefinition('serendipity');
    assert(defFromCache !== null && defFromCache.turkish === 'tesadüf', 'getWordDefinition directly resolves cached online word');

    console.log('\n--- Section 4: Modal UI Reactive Asynchronous Population ---');

    const openLookup = sandbox.openArticleWordLookup;
    assert(typeof openLookup === 'function', 'openArticleWordLookup is available');

    openLookup('photosynthesis', 'Plants use photosynthesis to make food.');

    const headwordEl = getMockEl('lookupHeadword');
    assert(headwordEl.textContent === 'photosynthesis', 'Modal headword displays "photosynthesis"');

    const turkishEl = getMockEl('lookupTurkish');
    assert(turkishEl.textContent === 'Çevirisi aranıyor...', 'Modal displays searching indicator "Çevirisi aranıyor..."');

    await new Promise(r => setTimeout(r, 50));
    assert(turkishEl.textContent === 'fotosentez', 'Modal dynamically updated with "fotosentez"');

    console.log('\n--- Section 5: Safe Dynamic Article Ingestion Hook ---');

    const ingestNewArticleSafely = sandbox.ingestNewArticleSafely;
    assert(typeof ingestNewArticleSafely === 'function', 'ingestNewArticleSafely is available');

    const sampleRemoteArticle = {
        id: 'remote_science_01',
        title: 'Quantum Computers Explained',
        category: 'Bilim & Teknoloji',
        level: 'B2',
        readTime: '4 dk',
        summary: 'How qubits revolutionize calculation.',
        contentHtml: '<p>Quantum computing uses qubits instead of classical bits.</p><script>alert("hack")</script>',
        paragraphs: ['Quantum computing uses qubits instead of classical bits.'],
        glossary: {
            'qubits': { tr: 'kübitler (kuantum bitleri)', type: 'İsim' }
        }
    };

    const ingested = ingestNewArticleSafely(sampleRemoteArticle);
    assert(ingested !== null, 'Article successfully ingested');
    assert(ingested.id === 'remote_science_01', 'Ingested article preserves ID');

    const foundInDB = sandbox.articlesDB.find(a => a.id === 'remote_science_01');
    assert(Boolean(foundInDB), 'Article is present in articlesDB');
    assert(!ingested.contentHtml.includes('<script>'), 'Malicious script tags purged from contentHtml');

    sandbox.appState.activeArticleObject = ingested;
    sandbox.appState.currentArticleId = ingested.id;

    const qubitDef = getWordDefinition('qubits');
    assert(qubitDef !== null && qubitDef.turkish.includes('kübitler'), 'Ingested article glossary resolves for reader lookup');

    console.log('\n--- Section 6: Offline Resilience & Graceful Fallback ---');

    sandbox.navigator.onLine = false;
    const offlineWordDef = await fetchOnlineTranslation('unknownnovelwordxyz');
    assert(offlineWordDef === null, 'fetchOnlineTranslation returns null gracefully when offline');

    sandbox.navigator.onLine = true;

    console.log('\n================================================================');
    console.log(`DYNAMIC TRANSLATION TEST COMPLETE: ${passedTests} / ${totalTests} passed.`);
    console.log('================================================================\n');

    if (passedTests === totalTests) {
        console.log('ALL ARCHITECTURAL LAYERS VERIFIED SUCCESSFULLY!');
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
