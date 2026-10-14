/**
 * CHALLENGER M3 EMPIRICAL STRESS TEST SUITE
 * 
 * Adversarial and boundary verification for Milestone 3:
 * 1. Word tokenization edge cases: hyphens, standard apostrophes, typographic curly apostrophes,
 *    multi-hyphen compounds (state-of-the-art, James-Webb, don't, rock'n'roll, don’t), numbers,
 *    and surrounding punctuation.
 * 2. Interactive word click delegation & lookup modal opening with context sentence extraction.
 * 3. Word lookup definitions: glossary match, stemming (s/ed/ing), dictionaryDB, and fallback.
 * 4. Word addition to appState.words & deduplication stress:
 *    - exact match, uppercase, lowercase, whitespace padding, mixed case, invalid inputs.
 *    - UI re-render triggers (renderHome, renderWordList, renderStats).
 *    - Modal button state reflection ("✓ Deftere Eklendi" / disabled).
 * 5. Reader appearance settings:
 *    - themes: sepia, dark, light and class exclusivity.
 *    - fonts: serif, sans.
 *    - font sizes: sm, base, lg, xl and class conflict/cleanup checks.
 *    - settings sheet toggle.
 * 6. Comprehension mini-quiz engine stress:
 *    - 100% score (all correct), trophy icon military_tech.
 *    - 0% score (all incorrect), trophy icon menu_book, rose/emerald feedback & explanations.
 *    - 50% score (mixed), trophy icon thumb_up.
 *    - Anti-tampering / idempotency: double-answering prevention and button disabled state.
 *    - Retry functionality (resetArticleQuiz).
 * 7. Security injection stress: XSS vectors in article prose, glossary, and quiz objects.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passedTests = 0;
let totalTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`[PASS] ${testName}`);
    } else {
        const msg = `[FAIL] ${testName}${details ? ' - ' + details : ''}`;
        console.error(msg);
        failures.push(msg);
        process.exitCode = 1;
    }
}

console.log('================================================================');
console.log('    CHALLENGER M3: ADVERSARIAL EMPIRICAL STRESS TEST SUITE      ');
console.log('================================================================\n');

// --- Mock DOM & Environment Setup ---
const elementsMap = new Map();

class MockNode {
    constructor(nodeType, nodeName, nodeValue = null) {
        this.nodeType = nodeType;
        this.nodeName = nodeName;
        this.tagName = nodeName.toUpperCase();
        this._nodeValue = nodeValue;
        this._textContent = nodeValue || '';
        this.childNodes = [];
        this.parentNode = null;
        this.attributes = [];
        this.dataset = {};
        this._listeners = {};
        this.disabled = false;
        this.className = '';
        this._id = null;
    }

    get id() { return this._id; }
    set id(val) {
        this._id = val;
        if (val) elementsMap.set(val, this);
    }

    get classList() {
        const self = this;
        return {
            contains(cls) {
                return (self.className || '').split(/\s+/).filter(Boolean).includes(cls);
            },
            add(...clss) {
                const current = (self.className || '').split(/\s+/).filter(Boolean);
                clss.forEach(c => {
                    if (c && !current.includes(c)) current.push(c);
                });
                self.className = current.join(' ');
            },
            remove(...clss) {
                const current = (self.className || '').split(/\s+/).filter(Boolean);
                self.className = current.filter(c => !clss.includes(c)).join(' ');
            },
            toggle(cls) {
                if (this.contains(cls)) {
                    this.remove(cls);
                    return false;
                } else {
                    this.add(cls);
                    return true;
                }
            }
        };
    }

    get nodeValue() {
        return this.nodeType === 3 ? this._nodeValue : null;
    }
    set nodeValue(val) {
        this._nodeValue = val;
        this._textContent = val;
    }

    get textContent() {
        if (this.nodeType === 3) return this._textContent;
        return this.childNodes.map(c => c.textContent).join('');
    }

    set textContent(val) {
        this._textContent = String(val);
        this.childNodes = [];
        if (this.nodeType === 1 && String(val) !== '') {
            const t = new MockNode(3, '#text', String(val));
            t.parentNode = this;
            this.childNodes.push(t);
        }
    }

    get innerHTML() {
        function serialize(node) {
            let out = '';
            for (const child of node.childNodes) {
                if (child.nodeType === 3) {
                    out += child.nodeValue;
                } else if (child.nodeType === 1) {
                    const attrs = child.attributes.map(a => `${a.name}="${a.value}"`).join(' ');
                    const attrStr = attrs ? ' ' + attrs : '';
                    out += `<${child.tagName.toLowerCase()}${attrStr}>`;
                    out += serialize(child);
                    out += `</${child.tagName.toLowerCase()}>`;
                }
            }
            return out;
        }
        return serialize(this);
    }

    get innerText() { return this.textContent; }
    set innerText(val) { this.textContent = val; }

    get firstChild() { return this.childNodes[0] || null; }

    appendChild(child) {
        if (!child) return;
        if (child.nodeType === 11 /* DOCUMENT_FRAGMENT */) {
            const children = [...child.childNodes];
            child.childNodes = [];
            children.forEach(c => this.appendChild(c));
            return child;
        }
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = this;
        this.childNodes.push(child);
        return child;
    }

    removeChild(child) {
        const idx = this.childNodes.indexOf(child);
        if (idx >= 0) {
            this.childNodes.splice(idx, 1);
            child.parentNode = null;
            const removeSubtree = (node) => {
                if (node._id) elementsMap.delete(node._id);
                node.childNodes.forEach(removeSubtree);
            };
            removeSubtree(child);
        }
        return child;
    }

    replaceChild(newChild, oldChild) {
        const idx = this.childNodes.indexOf(oldChild);
        if (idx === -1) return;
        if (newChild.nodeType === 11) {
            const children = [...newChild.childNodes];
            newChild.childNodes = [];
            this.childNodes.splice(idx, 1, ...children);
            oldChild.parentNode = null;
            children.forEach(c => { c.parentNode = this; });
        } else {
            if (newChild.parentNode) newChild.parentNode.removeChild(newChild);
            this.childNodes[idx] = newChild;
            newChild.parentNode = this;
            oldChild.parentNode = null;
        }
    }

    replaceChildren(...nodes) {
        while (this.childNodes.length > 0) {
            this.removeChild(this.childNodes[0]);
        }
        nodes.forEach(n => this.appendChild(n));
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
        const removeSubtree = (node) => {
            if (node._id) elementsMap.delete(node._id);
            node.childNodes.forEach(removeSubtree);
        };
        removeSubtree(this);
    }

    addEventListener(event, fn) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(fn);
    }

    removeEventListener(event, fn) {
        if (this._listeners[event]) {
            this._listeners[event] = this._listeners[event].filter(l => l !== fn);
        }
    }

    dispatchEvent(eventObj) {
        const type = eventObj.type || 'click';
        let curr = this;
        let propagationStopped = false;
        eventObj.stopPropagation = () => { propagationStopped = true; };
        while (curr && !propagationStopped) {
            const handlers = curr._listeners[type] || [];
            for (const h of handlers) {
                h(eventObj);
                if (propagationStopped) break;
            }
            curr = curr.parentNode;
        }
    }

    click() {
        this.dispatchEvent({ type: 'click', target: this, currentTarget: this });
    }

    setAttribute(name, val) {
        this.attributes.push({ name, value: String(val) });
        if (name === 'id') this.id = String(val);
        if (name === 'class') this.className = String(val);
        if (name.startsWith('data-')) {
            const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            this.dataset[key] = String(val);
        }
    }

    getAttribute(name) {
        const a = this.attributes.find(x => x.name === name);
        return a ? a.value : null;
    }

    querySelectorAll(selector) {
        const results = [];
        const rawSelectors = selector.split(',').map(s => s.trim()).filter(Boolean);
        function match(n) {
            for (const sel of rawSelectors) {
                if (sel === '*') {
                    results.push(n);
                    break;
                } else if (sel.startsWith('.')) {
                    const cls = sel.slice(1);
                    if (n.classList && n.classList.contains(cls)) { results.push(n); break; }
                } else if (sel.startsWith('#')) {
                    const id = sel.slice(1);
                    if (n.id === id) { results.push(n); break; }
                } else if (n.tagName && n.tagName.toLowerCase() === sel.toLowerCase()) {
                    results.push(n);
                    break;
                }
            }
            if (Array.isArray(n.childNodes)) {
                for (const c of n.childNodes) {
                    if (c.nodeType === 1) match(c);
                }
            }
        }
        for (const child of this.childNodes) {
            if (child.nodeType === 1) match(child);
        }
        return results;
    }

    querySelector(selector) {
        const res = this.querySelectorAll(selector);
        return res[0] || null;
    }

    closest(selector) {
        let curr = this;
        while (curr) {
            if (selector.startsWith('.') && curr.classList && curr.classList.contains(selector.slice(1))) return curr;
            if (selector.startsWith('#') && curr.id === selector.slice(1)) return curr;
            if (curr.tagName && curr.tagName.toLowerCase() === selector.toLowerCase()) return curr;
            curr = curr.parentNode;
        }
        return null;
    }
}

class MockTreeWalker {
    constructor(root, whatToShow = 4) {
        this.root = root;
        this.whatToShow = whatToShow;
        this.nodes = [];
        this._index = -1;
        this._collect(root);
    }
    _collect(node) {
        for (const child of node.childNodes) {
            if (child.nodeType === 3) {
                this.nodes.push(child);
            } else if (child.nodeType === 1) {
                this._collect(child);
            }
        }
    }
    nextNode() {
        this._index++;
        return this.nodes[this._index] || null;
    }
}

class MockDOMParser {
    parseFromString(str, mimeType) {
        const doc = {
            body: new MockNode(1, 'body'),
            createElement: (tag) => new MockNode(1, tag),
            createTextNode: (text) => new MockNode(3, '#text', text),
            createDocumentFragment: () => new MockNode(11, '#document-fragment'),
            createTreeWalker: (root, filter) => new MockTreeWalker(root, filter)
        };
        const tagRegex = /<(\/)?([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
        let current = doc.body;
        let match;
        while ((match = tagRegex.exec(str)) !== null) {
            if (match[4]) {
                const textNode = new MockNode(3, '#text', match[4]);
                current.appendChild(textNode);
            } else if (match[1] === '/') {
                if (current.parentNode && current !== doc.body) {
                    current = current.parentNode;
                }
            } else {
                const tagName = match[2];
                const attrString = match[3] || '';
                const elem = new MockNode(1, tagName);
                const attrRegex = /([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
                let attrMatch;
                while ((attrMatch = attrRegex.exec(attrString)) !== null) {
                    const attrVal = attrMatch[2] !== undefined ? attrMatch[2] : (attrMatch[3] !== undefined ? attrMatch[3] : (attrMatch[4] !== undefined ? attrMatch[4] : ''));
                    elem.setAttribute(attrMatch[1], attrVal);
                }
                current.appendChild(elem);
                const isVoid = ['IMG', 'BR', 'HR', 'INPUT', 'META', 'LINK'].includes(elem.tagName);
                if (!isVoid && !attrString.trim().endsWith('/')) {
                    current = elem;
                }
            }
        }
        return doc;
    }
}

function getOrCreateElement(id) {
    if (elementsMap.has(id)) return elementsMap.get(id);
    const node = new MockNode(1, 'div');
    node.id = id;
    return node;
}

// Pre-create required DOM elements
const REQUIRED_IDS = [
    'screenHome', 'screenWords', 'screenStats', 'screenSettings', 'screenOnboarding', 'screenStudy',
    'screenArticles', 'articleFeedView', 'articleReaderView', 'articleFeedList', 'articleCategoryBar',
    'readerStickyHeader', 'readerCategoryBadge', 'readerLevelBadge', 'articleReaderHero', 'readerCoverGradient',
    'heroCategoryBadge', 'heroLevelBadge', 'heroArticleTitle', 'heroArticleSubtitle', 'heroReadTime', 'heroWordCount',
    'articleBodyContent', 'articleQuizContainer', 'modalArticleWordLookup', 'lookupWordTypeBadge', 'lookupHeadword',
    'lookupPhonetic', 'lookupTtsBtn', 'lookupTurkish', 'lookupContextSentence', 'lookupAddWordBtn', 'lookupAddWordIcon',
    'lookupAddWordText', 'readerSettingsSheet', 'readerFontSizeOptions', 'readerFontFamilyOptions', 'readerThemeOptions',
    'statLearnedCount', 'statReviewedToday', 'statMasteryRate', 'bottomTabBar'
];
REQUIRED_IDS.forEach(id => getOrCreateElement(id));

const fontContainer = getOrCreateElement('readerFontSizeOptions');
['sm', 'base', 'lg', 'xl'].forEach(s => {
    const btn = new MockNode(1, 'button');
    btn.className = s === 'base' ? 'reader-font-btn bg-indigo-600' : 'reader-font-btn';
    btn.dataset.size = s;
    fontContainer.appendChild(btn);
});

const familyContainer = getOrCreateElement('readerFontFamilyOptions');
['sans', 'serif'].forEach(f => {
    const btn = new MockNode(1, 'button');
    btn.className = f === 'sans' ? 'reader-family-btn bg-indigo-600 font-sans' : 'reader-family-btn font-serif';
    btn.dataset.font = f;
    familyContainer.appendChild(btn);
});

const themeContainer = getOrCreateElement('readerThemeOptions');
['light', 'dark', 'sepia'].forEach(t => {
    const btn = new MockNode(1, 'button');
    btn.className = t === 'light' ? 'reader-theme-btn border-indigo-600' : 'reader-theme-btn';
    btn.dataset.theme = t;
    themeContainer.appendChild(btn);
});

const mockDoc = {
    getElementById(id) { return elementsMap.has(id) ? elementsMap.get(id) : null; },
    createElement(tag) { return new MockNode(1, tag); },
    createTextNode(txt) { return new MockNode(3, '#text', txt); },
    createDocumentFragment() { return new MockNode(11, '#document-fragment'); },
    createTreeWalker(root, filter) { return new MockTreeWalker(root, filter); },
    querySelectorAll(selector) {
        if (selector === '.reader-font-btn') return fontContainer.querySelectorAll('.reader-font-btn');
        if (selector === '.reader-family-btn') return familyContainer.querySelectorAll('.reader-family-btn');
        if (selector === '.reader-theme-btn') return themeContainer.querySelectorAll('.reader-theme-btn');
        if (selector === '.article-cat-pill') return getOrCreateElement('articleCategoryBar').querySelectorAll('.article-cat-pill');
        if (selector === '.nav-btn') return getOrCreateElement('bottomTabBar').querySelectorAll('.nav-btn');
        return [];
    }
};

let ttsHistory = [];
let chimeCount = 0;
let toastHistory = [];

const mockSpeechSynthesis = {
    cancel: () => {},
    speak: (u) => { ttsHistory.push(u ? u.text : null); }
};

let homeRendered = 0;
let wordListRendered = 0;
let statsRendered = 0;

const sandbox = {
    console,
    document: mockDoc,
    window: {},
    speechSynthesis: mockSpeechSynthesis,
    DOMParser: MockDOMParser,
    NodeFilter: { SHOW_TEXT: 4 },
    SpeechSynthesisUtterance: function(text) { this.text = text; },
    playTTS: (text) => { ttsHistory.push(text); },
    playSuccessSound: () => { chimeCount++; },
    showToast: (msg) => { toastHistory.push(msg); },
    renderHome: () => { homeRendered++; },
    renderWordList: () => { wordListRendered++; },
    renderStats: () => { statsRendered++; },
    addEventListener: () => {},
    removeEventListener: () => {},
    setInterval: () => {},
    setTimeout: (fn) => { if (typeof fn === 'function') fn(); },
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
sandbox.window.speechSynthesis = mockSpeechSynthesis;
sandbox.window.playSuccessSound = () => { chimeCount++; };

// Load script from index.html
const htmlPath = path.join(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const fullScriptMatch = htmlContent.match(/<!-- JAVASCRIPT LOGIC -->\s*<script>([\s\S]*?)<\/script>/i);
if (!fullScriptMatch) {
    console.error('Fatal: Could not extract JavaScript logic from index.html');
    process.exit(1);
}

vm.createContext(sandbox);
vm.runInContext(fullScriptMatch[1], sandbox);

if (!sandbox.appState && sandbox.window && sandbox.window.appState) {
    sandbox.appState = sandbox.window.appState;
}
sandbox.window.renderHome = () => { homeRendered++; };
sandbox.window.renderWordList = () => { wordListRendered++; };
sandbox.window.renderStats = () => { statsRendered++; };
sandbox.window.playSuccessSound = () => { chimeCount++; };

// ====================================================================
// SECTION 1: Adversarial Tokenization with Hyphens and Apostrophes
// ====================================================================
console.log('--- Section 1: Adversarial Tokenization with Hyphens, Apostrophes & Edge Cases ---');

const complexArticle = {
    id: 'art-stress-test',
    title: 'Adversarial Tokenization Test',
    subtitle: 'Probing hyphen and apostrophe parsing',
    readTime: '3 dk okuma',
    category: 'Teknoloji',
    level: 'B2',
    coverGradient: 'from-blue-600 to-indigo-600',
    contentHtml: `
        <p>We don't believe James-Webb telescope is simple. Its state-of-the-art instruments observe twenty-four distant galaxies.</p>
        <p>Rock'n'roll won't fade; it's pre-existing, co-founder said. Don’t overlook the 100% precision!</p>
        <p>Nested "quotes" and 'single quotes', plus hyphens: well-known, high-tech, and self-esteem.</p>
    `,
    glossary: {
        'state-of-the-art': { turkish: 'en son teknoloji', phonetic: '/ˌsteɪt.əv.ðiːˈɑːt/', type: 'Sıfat' },
        'james-webb': { turkish: 'James Webb Uzay Teleskobu', phonetic: '/dʒeɪmz wɛb/', type: 'İsim' }
    }
};

const articleBodyEl = mockDoc.getElementById('articleBodyContent');
sandbox.renderArticleContentSafely(complexArticle);

const spans = articleBodyEl.querySelectorAll('.interactive-word');
assert(spans.length > 0, `Complex prose tokenized into ${spans.length} interactive word spans`);

const extractedWords = spans.map(s => ({
    text: s.textContent,
    datasetWord: s.dataset.word
}));

// Test specific tricky words
const testCases = [
    { expectedText: "don't", expectedDataset: "don't" },
    { expectedText: "James-Webb", expectedDataset: "james-webb" },
    { expectedText: "state-of-the-art", expectedDataset: "state-of-the-art" },
    { expectedText: "twenty-four", expectedDataset: "twenty-four" },
    { expectedText: "Rock'n'roll", expectedDataset: "rock'n'roll" },
    { expectedText: "won't", expectedDataset: "won't" },
    { expectedText: "it's", expectedDataset: "it's" },
    { expectedText: "pre-existing", expectedDataset: "pre-existing" },
    { expectedText: "co-founder", expectedDataset: "co-founder" },
    { expectedText: "Don’t", expectedDataset: "don’t" }, // curly apostrophe
    { expectedText: "well-known", expectedDataset: "well-known" },
    { expectedText: "high-tech", expectedDataset: "high-tech" },
    { expectedText: "self-esteem", expectedDataset: "self-esteem" },
    { expectedText: "100", expectedDataset: "100" }
];

testCases.forEach(tc => {
    const match = extractedWords.find(w => w.text.toLowerCase() === tc.expectedText.toLowerCase());
    assert(
        Boolean(match),
        `Tokenized compound/apostrophe word "${tc.expectedText}" exists`,
        `Found: ${JSON.stringify(match)}`
    );
    if (match) {
        assert(
            match.datasetWord === tc.expectedDataset,
            `Dataset.word for "${tc.expectedText}" is cleaned accurately ("${match.datasetWord}" === "${tc.expectedDataset}")`
        );
    }
});

// Verify punctuation is not swallowed as part of words
const percentMatch = extractedWords.find(w => w.text.includes('%'));
assert(!percentMatch, 'Punctuation symbol "%" is not swallowed into a word span');

const quoteMatch = extractedWords.find(w => w.text.startsWith('"') || w.text.endsWith('"'));
assert(!quoteMatch, 'Double quotes are not swallowed into word spans');

// ====================================================================
// SECTION 2: Click Delegation & Lookup Opening
// ====================================================================
console.log('\n--- Section 2: Click Delegation & Lookup Opening ---');

sandbox.appState.currentArticleId = complexArticle.id;

// Simulate clicking on the "state-of-the-art" span
const stateOfTheArtSpan = spans.find(s => s.dataset.word === 'state-of-the-art');
assert(Boolean(stateOfTheArtSpan), 'Found span for "state-of-the-art"');

// Initialize delegation
sandbox.initArticleReaderDelegation();

// Trigger click on the span
stateOfTheArtSpan.click();

const lookupModal = mockDoc.getElementById('modalArticleWordLookup');
assert(!lookupModal.classList.contains('hidden'), 'Lookup modal opened after clicking interactive word');

const headwordEl = mockDoc.getElementById('lookupHeadword');
assert(headwordEl.textContent === 'state-of-the-art', `Headword displays "state-of-the-art" (got "${headwordEl.textContent}")`);

const turkishEl = mockDoc.getElementById('lookupTurkish');
assert(turkishEl.textContent === 'en son teknoloji', `Turkish definition resolved from article glossary ("en son teknoloji")`);

const contextSentenceEl = mockDoc.getElementById('lookupContextSentence');
assert(
    contextSentenceEl.textContent.includes('twenty-four distant galaxies'),
    'Context sentence extracted from enclosing paragraph and rendered'
);

// Close lookup
sandbox.closeArticleWordLookup();
assert(lookupModal.classList.contains('hidden'), 'Lookup modal closed successfully');

// ====================================================================
// SECTION 3: Dictionary & Stemming Hierarchy Stress
// ====================================================================
console.log('\n--- Section 3: Definition Lookup Hierarchy & Stemming ---');

// Stemming: plural "galaxies" -> "galaxy"
// If glossary has "galaxies" or fallback
const defStem = sandbox.getWordDefinition('galaxies');
assert(Boolean(defStem && defStem.english), 'getWordDefinition gracefully resolves "galaxies"');

// Global dictionaryDB resolution: e.g. "resilient"
const defResilient = sandbox.getWordDefinition('resilient');
assert(
    defResilient && defResilient.turkish.includes('dayanıklı'),
    'getWordDefinition resolves global dictionaryDB entry ("resilient" -> "dayanıklı")'
);

// Fallback definition for arbitrary novel/hyphenated words
const defNovel = sandbox.getWordDefinition('cyber-resilience');
assert(
    defNovel && defNovel.english === 'cyber-resilience' && defNovel.turkish.includes('cyber-resilience'),
    'getWordDefinition creates structured fallback for unknown compound words'
);

// ====================================================================
// SECTION 4: Word Addition & Deduplication Stress (appState.words)
// ====================================================================
console.log('\n--- Section 4: Word Addition & Deduplication Stress ---');

const initialWordsCount = sandbox.appState.words.length;
homeRendered = 0;
wordListRendered = 0;
statsRendered = 0;

// Test 4.1: Add new compound word
const addSuccess1 = sandbox.addWordToNotebook({
    english: 'state-of-the-art',
    turkish: 'en son teknoloji',
    phonetic: '/ˌsteɪt.əv.ðiːˈɑːt/',
    type: 'Sıfat',
    example: 'Its state-of-the-art instruments observe distant galaxies.'
});

assert(addSuccess1 === true, 'addWordToNotebook returns true for new compound word');
assert(sandbox.appState.words.length === initialWordsCount + 1, 'appState.words length incremented by exactly 1');
assert(sandbox.appState.words[0].english === 'state-of-the-art', 'New word is unshifted to index 0');
assert(sandbox.appState.words[0].addedToday === true, 'New word has addedToday = true');
assert(sandbox.appState.words[0].starred === false, 'New word has starred = false');
assert(homeRendered > 0, 'renderHome() triggered on word addition');
assert(wordListRendered > 0, 'renderWordList() triggered on word addition');
assert(statsRendered > 0, 'renderStats() triggered on word addition');

// Test 4.2: Exact duplicate attempt
const addDupExact = sandbox.addWordToNotebook({
    english: 'state-of-the-art',
    turkish: 'en son teknoloji'
});
assert(addDupExact === false, 'Exact duplicate rejected (returns false)');
assert(sandbox.appState.words.length === initialWordsCount + 1, 'appState.words length unchanged after exact duplicate');

// Test 4.3: Uppercase duplicate attempt
const addDupUpper = sandbox.addWordToNotebook({
    english: 'STATE-OF-THE-ART',
    turkish: 'farklı açıklama'
});
assert(addDupUpper === false, 'Uppercase duplicate rejected (returns false)');
assert(sandbox.appState.words.length === initialWordsCount + 1, 'appState.words length unchanged after uppercase duplicate');

// Test 4.4: Whitespace-padded duplicate attempt
const addDupPadded = sandbox.addWordToNotebook({
    english: '   state-of-the-art   ',
    turkish: 'boşluklu kopya'
});
assert(addDupPadded === false, 'Whitespace-padded duplicate rejected (returns false)');
assert(sandbox.appState.words.length === initialWordsCount + 1, 'appState.words length unchanged after whitespace duplicate');

// Test 4.5: Mixed-case duplicate attempt
const addDupMixed = sandbox.addWordToNotebook({
    english: 'State-Of-The-Art',
    turkish: 'büyük küçük harf'
});
assert(addDupMixed === false, 'Mixed-case duplicate rejected (returns false)');
assert(sandbox.appState.words.length === initialWordsCount + 1, 'appState.words length unchanged after mixed-case duplicate');

// Test 4.6: Invalid inputs rejected
assert(sandbox.addWordToNotebook({ english: '' }) === false, 'Empty string rejected');
assert(sandbox.addWordToNotebook({ english: '   ' }) === false, 'Whitespace-only string rejected');
assert(sandbox.addWordToNotebook(null) === false, 'null argument rejected');
assert(sandbox.addWordToNotebook({}) === false, 'empty object rejected');
assert(sandbox.appState.words.length === initialWordsCount + 1, 'appState.words length untouched after invalid attempts');

// Test 4.7: Modal button state when word already in defter
sandbox.openArticleWordLookup('state-of-the-art');
const addWordBtn = mockDoc.getElementById('lookupAddWordBtn');
const addWordText = mockDoc.getElementById('lookupAddWordText');
assert(addWordBtn.disabled === true, 'Add button is disabled when word is already in notebook');
assert(addWordText.textContent.includes('Deftere Eklendi'), 'Add button text displays "✓ Deftere Eklendi"');
sandbox.closeArticleWordLookup();

// ====================================================================
// SECTION 5: Reader Customizer & Appearance Settings
// ====================================================================
console.log('\n--- Section 5: Reader Appearance Customizer Stress ---');

const readerView = mockDoc.getElementById('articleReaderView');

// Theme Tests
sandbox.setReaderTheme('sepia');
assert(sandbox.readerSettings.theme === 'sepia', 'readerSettings.theme is sepia');
assert(readerView.classList.contains('theme-sepia'), '#articleReaderView has .theme-sepia');
assert(!readerView.classList.contains('theme-dark'), '#articleReaderView does NOT have .theme-dark');
assert(!readerView.classList.contains('theme-light'), '#articleReaderView does NOT have .theme-light');

sandbox.setReaderTheme('dark');
assert(sandbox.readerSettings.theme === 'dark', 'readerSettings.theme is dark');
assert(readerView.classList.contains('theme-dark'), '#articleReaderView has .theme-dark');
assert(!readerView.classList.contains('theme-sepia'), '#articleReaderView does NOT have .theme-sepia');
assert(!readerView.classList.contains('theme-light'), '#articleReaderView does NOT have .theme-light');

sandbox.setReaderTheme('light');
assert(sandbox.readerSettings.theme === 'light', 'readerSettings.theme is light');
assert(readerView.classList.contains('theme-light'), '#articleReaderView has .theme-light');
assert(!readerView.classList.contains('theme-sepia'), '#articleReaderView does NOT have .theme-sepia');
assert(!readerView.classList.contains('theme-dark'), '#articleReaderView does NOT have .theme-dark');

// Invalid theme rejection
sandbox.setReaderTheme('neon-cyber');
assert(sandbox.readerSettings.theme === 'light', 'Invalid theme "neon-cyber" rejected; remains light');

// Font Family Tests
sandbox.setReaderFontFamily('serif');
assert(sandbox.readerSettings.fontFamily === 'serif', 'readerSettings.fontFamily is serif');
assert(readerView.classList.contains('font-serif'), '#articleReaderView has .font-serif');
assert(!readerView.classList.contains('font-sans'), '#articleReaderView does NOT have .font-sans');

sandbox.setReaderFontFamily('sans');
assert(sandbox.readerSettings.fontFamily === 'sans', 'readerSettings.fontFamily is sans');
assert(readerView.classList.contains('font-sans'), '#articleReaderView has .font-sans');
assert(!readerView.classList.contains('font-serif'), '#articleReaderView does NOT have .font-serif');

// Invalid font rejection
sandbox.setReaderFontFamily('comic-sans');
assert(sandbox.readerSettings.fontFamily === 'sans', 'Invalid font rejected; remains sans');

// Font Size Progression and Class Collision Cleanup
const sizes = [
    { size: 'sm', classExpected: 'text-sm' },
    { size: 'base', classExpected: 'text-base' },
    { size: 'lg', classExpected: 'text-lg' },
    { size: 'xl', classExpected: 'text-xl' }
];

sizes.forEach(({ size, classExpected }) => {
    sandbox.setReaderFontSize(size);
    assert(sandbox.readerSettings.fontSize === size, `readerSettings.fontSize is ${size}`);
    assert(readerView.classList.contains(classExpected), `#articleReaderView contains ${classExpected}`);
    
    // Ensure all other size classes are purged
    sizes.filter(s => s.size !== size).forEach(other => {
        assert(!readerView.classList.contains(other.classExpected), `#articleReaderView does NOT retain obsolete size ${other.classExpected}`);
    });
});

// Invalid font size rejection
sandbox.setReaderFontSize('colossal');
assert(sandbox.readerSettings.fontSize === 'xl', 'Invalid font size rejected; remains xl');

// Sheet toggle test
const settingsSheet = mockDoc.getElementById('readerSettingsSheet');
settingsSheet.classList.add('hidden');
sandbox.toggleReaderSettings();
assert(!settingsSheet.classList.contains('hidden'), 'toggleReaderSettings() un-hides settings sheet');
sandbox.toggleReaderSettings();
assert(settingsSheet.classList.contains('hidden'), 'toggleReaderSettings() re-hides settings sheet');

// ====================================================================
// SECTION 6: Comprehension Mini-Quiz Engine Deep Stress
// ====================================================================
console.log('\n--- Section 6: Comprehension Mini-Quiz Scoring & Mechanics Stress ---');

const quizArticle = {
    id: 'quiz-stress-article',
    title: 'Space Quiz Article',
    quiz: [
        {
            question: 'What is the primary mirror made of?',
            options: ['Beryllium coated in gold', 'Pure glass', 'Polished steel', 'Aluminum'],
            correctIndex: 0,
            explanation: 'The mirrors are beryllium coated in a microscopic layer of gold.'
        },
        {
            question: 'How far does the telescope orbit from Earth?',
            options: ['384,000 km', '1.5 million km (L2 point)', 'Low Earth Orbit', 'Mars orbit'],
            correctIndex: 1,
            explanation: 'It orbits at the second Lagrange point (L2), ~1.5 million km from Earth.'
        }
    ]
};

const quizContainer = mockDoc.getElementById('articleQuizContainer');

// --- Simulation A: 100% Correct Score ---
console.log('\n  [Quiz Sim A: 100% Score]');
sandbox.renderArticleQuiz(quizArticle);

let qCards = quizContainer.querySelectorAll('.quiz-card');
assert(qCards.length === 2, 'Rendered 2 question cards for quizArticle');

// Q0: choose option 0 (correct)
chimeCount = 0;
let q0Opts = qCards[0].querySelectorAll('.quiz-option-btn');
sandbox.selectArticleQuizOption(q0Opts[0], 0, 0, quizArticle);
assert(chimeCount === 1, 'Chime sound triggered on correct answer');
assert(q0Opts[0].classList.contains('border-emerald-500'), 'Option 0 has emerald border for correct answer');
assert(q0Opts.every(b => b.disabled === true), 'All Q0 option buttons disabled after answering');

// Q1: choose option 1 (correct)
let q1Opts = qCards[1].querySelectorAll('.quiz-option-btn');
sandbox.selectArticleQuizOption(q1Opts[1], 1, 1, quizArticle);
assert(chimeCount === 2, 'Chime sound triggered again on 2nd correct answer');
assert(q1Opts[1].classList.contains('border-emerald-500'), 'Option 1 has emerald border for correct answer');
assert(q1Opts.every(b => b.disabled === true), 'All Q1 option buttons disabled after answering');

// Check Score Card
let scoreCard = mockDoc.getElementById('quizScoreCard');
assert(Boolean(scoreCard), 'Score card rendered after all questions answered');
let scoreBadge = scoreCard.querySelector('.rounded-full');
assert(scoreBadge && scoreBadge.textContent.includes('2 / 2 Doğru (%100)'), `Score badge reads "2 / 2 Doğru (%100)" (got "${scoreBadge.textContent}")`);
let trophy = scoreCard.querySelector('.material-symbols-outlined');
assert(trophy && trophy.textContent === 'military_tech', `100% score displays military_tech trophy (got "${trophy.textContent}")`);

// --- Simulation B: 0% Score with Error Highlighting & Explanations ---
console.log('\n  [Quiz Sim B: 0% Score]');
sandbox.resetArticleQuiz(quizArticle);

qCards = quizContainer.querySelectorAll('.quiz-card');
assert(mockDoc.getElementById('quizScoreCard') === null, 'Score card removed after resetArticleQuiz()');

// Q0: choose option 2 (wrong: steel)
q0Opts = qCards[0].querySelectorAll('.quiz-option-btn');
sandbox.selectArticleQuizOption(q0Opts[2], 0, 2, quizArticle);
assert(q0Opts[2].classList.contains('border-rose-500'), 'Selected wrong option has rose border');
assert(q0Opts[0].classList.contains('border-emerald-500'), 'Correct option (0) automatically revealed in emerald');

let expBox0 = qCards[0].querySelector('.quiz-explanation-box');
assert(!expBox0.classList.contains('hidden'), 'Explanation box revealed on wrong answer');
assert(expBox0.textContent.includes('✗ Yanlış Cevap'), 'Explanation title notes wrong answer');
assert(expBox0.textContent.includes('beryllium coated'), 'Explanation body text displayed accurately');

// Q1: choose option 3 (wrong: Mars orbit)
q1Opts = qCards[1].querySelectorAll('.quiz-option-btn');
sandbox.selectArticleQuizOption(q1Opts[3], 1, 3, quizArticle);
assert(q1Opts[3].classList.contains('border-rose-500'), 'Selected wrong option has rose border');
assert(q1Opts[1].classList.contains('border-emerald-500'), 'Correct option (1) automatically revealed in emerald');

scoreCard = mockDoc.getElementById('quizScoreCard');
assert(Boolean(scoreCard), 'Score card rendered after all questions answered');
scoreBadge = scoreCard.querySelector('.rounded-full');
assert(scoreBadge && scoreBadge.textContent.includes('0 / 2 Doğru (%0)'), `Score badge reads "0 / 2 Doğru (%0)" (got "${scoreBadge.textContent}")`);
trophy = scoreCard.querySelector('.material-symbols-outlined');
assert(trophy && trophy.textContent === 'menu_book', `0% score displays menu_book icon (got "${trophy.textContent}")`);

// --- Simulation C: 50% Mixed Score ---
console.log('\n  [Quiz Sim C: 50% Mixed Score]');
sandbox.resetArticleQuiz(quizArticle);

qCards = quizContainer.querySelectorAll('.quiz-card');
q0Opts = qCards[0].querySelectorAll('.quiz-option-btn');
q1Opts = qCards[1].querySelectorAll('.quiz-option-btn');

// Q0: correct (opt 0)
sandbox.selectArticleQuizOption(q0Opts[0], 0, 0, quizArticle);
// Q1: incorrect (opt 0)
sandbox.selectArticleQuizOption(q1Opts[0], 1, 0, quizArticle);

scoreCard = mockDoc.getElementById('quizScoreCard');
scoreBadge = scoreCard.querySelector('.rounded-full');
assert(scoreBadge && scoreBadge.textContent.includes('1 / 2 Doğru (%50)'), `Score badge reads "1 / 2 Doğru (%50)" (got "${scoreBadge.textContent}")`);
trophy = scoreCard.querySelector('.material-symbols-outlined');
assert(trophy && trophy.textContent === 'thumb_up', `50% score displays thumb_up icon (got "${trophy.textContent}")`);

// --- Anti-Tampering / Idempotency Test ---
console.log('\n  [Quiz Anti-Tampering & Double-Answer Prevention]');
const beforeCorrect = sandbox.currentArticleQuizState.correctCount;
const beforeAnswered = sandbox.currentArticleQuizState.answeredCount;

// Attempt to re-answer Q0 with different option
sandbox.selectArticleQuizOption(q0Opts[1], 0, 1, quizArticle);
assert(sandbox.currentArticleQuizState.correctCount === beforeCorrect, 'Attempting to re-answer did not modify correctCount');
assert(sandbox.currentArticleQuizState.answeredCount === beforeAnswered, 'Attempting to re-answer did not modify answeredCount');

// Test Retry Button inside Score Card
const retryBtn = scoreCard.querySelector('button');
assert(Boolean(retryBtn), 'Retry button found inside score card');
retryBtn.click();
assert(mockDoc.getElementById('quizScoreCard') === null, 'Clicking retry button resets the quiz cleanly');

// ====================================================================
// SECTION 7: Security Injection Vectors in M3
// ====================================================================
console.log('\n--- Section 7: Security Injection Vectors in Reader Prose & Quiz ---');

const maliciousArticle = {
    id: 'art-xss-attack',
    title: '<script>alert("xss-title")</script>',
    subtitle: '<img src=x onerror=alert("xss-subtitle")>',
    readTime: '1 dk',
    contentHtml: `
        <p>Safe paragraph with <script>alert("pwn-script")</script> embedded script tag.</p>
        <p>Another paragraph with <img src=invalid onerror="alert('pwn-img')"> and <svg onload="alert('pwn-svg')"></p>
        <p><a href="javascript:alert('pwn-link')">Clickable malicious link</a></p>
    `,
    glossary: {
        'pwn': { turkish: '<script>alert("xss-glossary")</script>', phonetic: '/pwn/', type: 'Hacker' }
    },
    quiz: [
        {
            question: '<script>alert("xss-question")</script>',
            options: ['<img src=x onerror=alert(1)>', 'Normal option'],
            correctIndex: 0,
            explanation: '<svg onload=alert("xss-explanation")>'
        }
    ]
};

// Test safe rendering of malicious article
sandbox.renderArticleContentSafely(maliciousArticle);

const bodyContent = mockDoc.getElementById('articleBodyContent');
const dangerousScripts = bodyContent.querySelectorAll('script');
assert(dangerousScripts.length === 0, 'Zero script tags rendered into articleBodyContent from malicious contentHtml');

const dangerousImgs = bodyContent.querySelectorAll('img');
const hasOnError = dangerousImgs.some(img => img.getAttribute('onerror'));
assert(!hasOnError, 'Zero img tags with onerror rendered into articleBodyContent');

// Test safe rendering of quiz with malicious strings
sandbox.renderArticleQuiz(maliciousArticle);
const dangerousQuizScripts = quizContainer.querySelectorAll('script');
assert(dangerousQuizScripts.length === 0, 'Zero script tags rendered into quizContainer from malicious quiz questions');

const dangerousQuizImgs = quizContainer.querySelectorAll('img');
const hasQuizOnError = dangerousQuizImgs.some(img => img.getAttribute('onerror'));
assert(!hasQuizOnError, 'Zero img tags with onerror rendered into quizContainer');

// ====================================================================
// FINAL VERDICT & SUMMARY
// ====================================================================
console.log('\n================================================================');
console.log(`CHALLENGER VERIFICATION COMPLETE: ${passedTests} / ${totalTests} tests passed.`);
if (failures.length > 0) {
    console.error(`FAILURES (${failures.length}):`);
    failures.forEach(f => console.error(`  - ${f}`));
    console.log('VERDICT: REQUEST_CHANGES');
    process.exit(1);
} else {
    console.log('ALL ADVERSARIAL CHALLENGES PASSED EMPIRICALLY!');
    console.log('VERDICT: APPROVE');
    process.exit(0);
}
