/**
 * Milestone 3 Automated Verification Suite: Interactive Reader, Word Lookup & Defter Sync, Customizer, and Comprehension Quiz
 *
 * Validates:
 * 1. Static HTML & Layout: #screenArticles split into #articleFeedView and #articleReaderView.
 * 2. Sticky Header with Geri button, Category badge, Level badge, and Görünüm button.
 * 3. Hero section with Title, Subtitle, Read time, and cover gradient.
 * 4. Safe TreeWalker word tokenization on Node.TEXT_NODE (preserving punctuation, XSS defense, zero innerHTML sinks).
 * 5. Interactive Word Lookup Modal (#modalArticleWordLookup) with definition lookup hierarchy, TTS, and context sentence.
 * 6. "Kelime Defterime Ekle" sync with appState.words (deduplication, unshift, UI update, toast).
 * 7. Customizable Reader Appearance (#readerSettingsSheet: 4 font sizes, serif/sans toggle, sepia/dark/light themes).
 * 8. Comprehension Mini-Quiz Engine (options rendering, answer feedback, correct option reveal on wrong answer, explanation card, score card, and retry).
 * 9. Zero regressions on Milestone 1 (test_m1_security.cjs) and Milestone 2 (test_m2_navigation_articles.cjs).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

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
console.log('  MILESTONE 3: INTERACTIVE READER, SYNC, SETTINGS & QUIZ SUITE ');
console.log('================================================================\n');

// ====================================================================
// Phase 1: Static Markup & Structure Audit
// ====================================================================
console.log('--- Phase 1: Static Markup & Structure Audit ---');
const htmlPath = path.join(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// 1.1 Check #screenArticles container
const screenArticlesMatch = htmlContent.match(/<section\s+id="screenArticles"[\s\S]*?<\/section>/i);
assert(Boolean(screenArticlesMatch), '#screenArticles section container exists');

if (screenArticlesMatch) {
    const screenHtml = screenArticlesMatch[0];

    // 1.2 Sub-views: #articleFeedView and #articleReaderView
    assert(screenHtml.includes('id="articleFeedView"'), '#screenArticles contains #articleFeedView');
    assert(screenHtml.includes('id="articleReaderView"'), '#screenArticles contains #articleReaderView');

    // 1.3 Sticky Reader Header
    assert(screenHtml.includes('id="readerStickyHeader"'), '#readerStickyHeader exists inside #articleReaderView');
    assert(screenHtml.includes('onclick="closeArticleReader()"'), 'Geri button exists with onclick="closeArticleReader()"');
    assert(screenHtml.includes('id="readerCategoryBadge"'), '#readerCategoryBadge exists in sticky header');
    assert(screenHtml.includes('id="readerLevelBadge"'), '#readerLevelBadge exists in sticky header');
    assert(screenHtml.includes('onclick="toggleReaderSettings()"'), 'Görünüm button exists with onclick="toggleReaderSettings()"');

    // 1.4 Article Hero & Body Container
    assert(screenHtml.includes('id="articleReaderHero"'), '#articleReaderHero exists inside #articleReaderView');
    assert(screenHtml.includes('id="readerCoverGradient"'), '#readerCoverGradient exists inside #articleReaderHero');
    assert(screenHtml.includes('id="heroCategoryBadge"'), '#heroCategoryBadge exists inside hero');
    assert(screenHtml.includes('id="heroLevelBadge"'), '#heroLevelBadge exists inside hero');
    assert(screenHtml.includes('id="heroArticleTitle"'), '#heroArticleTitle exists inside hero');
    assert(screenHtml.includes('id="heroArticleSubtitle"'), '#heroArticleSubtitle exists inside hero');
    assert(screenHtml.includes('id="heroReadTime"'), '#heroReadTime exists inside hero');
    assert(screenHtml.includes('id="heroWordCount"'), '#heroWordCount exists inside hero');
    assert(screenHtml.includes('id="articleBodyContent"'), '#articleBodyContent container exists inside #articleReaderView');

    // 1.5 Comprehension Quiz Container
    assert(screenHtml.includes('id="articleQuizContainer"'), '#articleQuizContainer exists inside #articleReaderView');
}

// 1.6 Interactive Word Lookup Modal (#modalArticleWordLookup)
const lookupModalMatch = htmlContent.match(/<div\s+id="modalArticleWordLookup"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i);
assert(Boolean(lookupModalMatch), '#modalArticleWordLookup modal container exists in index.html');

if (lookupModalMatch) {
    const modalHtml = lookupModalMatch[0];
    assert(modalHtml.includes('id="lookupHeadword"'), '#lookupHeadword element exists in lookup modal');
    assert(modalHtml.includes('id="lookupPhonetic"'), '#lookupPhonetic element exists in lookup modal');
    assert(modalHtml.includes('id="lookupWordTypeBadge"'), '#lookupWordTypeBadge element exists in lookup modal');
    assert(modalHtml.includes('id="lookupTurkish"'), '#lookupTurkish element exists in lookup modal');
    assert(modalHtml.includes('id="lookupContextSentence"'), '#lookupContextSentence element exists in lookup modal');
    assert(modalHtml.includes('id="lookupTtsBtn"'), '#lookupTtsBtn element exists in lookup modal');
    assert(modalHtml.includes('id="lookupAddWordBtn"'), '#lookupAddWordBtn element exists in lookup modal');
    assert(modalHtml.includes('onclick="closeArticleWordLookup()"'), 'Close handler closeArticleWordLookup() is bound');
}

// 1.7 Reader Settings Sheet (#readerSettingsSheet)
const settingsSheetMatch = htmlContent.match(/<div\s+id="readerSettingsSheet"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i);
assert(Boolean(settingsSheetMatch), '#readerSettingsSheet container exists in index.html');

if (settingsSheetMatch) {
    const sheetHtml = settingsSheetMatch[0];
    assert(sheetHtml.includes('id="readerFontSizeOptions"'), '#readerFontSizeOptions container exists');
    assert(sheetHtml.includes('data-size="sm"') && sheetHtml.includes('data-size="base"') && sheetHtml.includes('data-size="lg"') && sheetHtml.includes('data-size="xl"'), 'All 4 font size options (sm, base, lg, xl) exist');
    assert(sheetHtml.includes('data-font="sans"') && sheetHtml.includes('data-font="serif"'), 'Both font family options (sans, serif) exist');
    assert(sheetHtml.includes('data-theme="light"') && sheetHtml.includes('data-theme="dark"') && sheetHtml.includes('data-theme="sepia"'), 'All 3 reader themes (light, dark, sepia) exist');
}

// 1.8 Zero Unsafe innerHTML Sinks Audit
console.log('\n--- Phase 2: Zero Unsafe innerHTML Sinks Audit ---');
const htmlLines = htmlContent.split('\n');
const innerHtmlMatches = [];
htmlLines.forEach((line, idx) => {
    if (line.includes('.innerHTML') && !line.includes('return doc.body.innerHTML')) {
        innerHtmlMatches.push({ line: idx + 1, content: line.trim() });
    }
});
assert(innerHtmlMatches.length === 0, 'Zero unsafe innerHTML sinks across entire index.html',
    innerHtmlMatches.map(m => `Line ${m.line}: ${m.content}`).join(', '));

// ====================================================================
// Phase 3: Runtime VM Sandbox & Safe TreeWalker Simulation
// ====================================================================
console.log('\n--- Phase 3: Runtime VM Sandbox & TreeWalker Setup ---');

// Synthetic DOM registry
const elementsMap = new Map();
function getOrCreateElement(id, tagName = 'div') {
    if (!elementsMap.has(id)) {
        const el = new MockNode(1, tagName);
        el.id = id;
        elementsMap.set(id, el);
    }
    return elementsMap.get(id);
}

// Robust Mock Node & DOM for TreeWalker and tokenization verification
class MockNode {
    constructor(nodeType, nodeName, nodeValue = null) {
        this.nodeType = nodeType;
        this.nodeName = (nodeName || '').toUpperCase();
        this.tagName = this.nodeType === 1 ? this.nodeName : undefined;
        this.nodeValue = nodeValue;
        this._textContent = nodeValue !== null ? String(nodeValue) : '';
        this.childNodes = [];
        this.parentNode = null;
        this.attributes = [];
        this.className = '';
        this.dataset = {};
        this.style = {};
        this._id = '';
        this.eventListeners = {};
        this._delegationAttached = false;
        this.scrollTop = 0;
        this.disabled = false;
        this.value = '';
    }

    get id() { return this._id || ''; }
    set id(val) {
        const oldId = this._id;
        if (oldId && elementsMap.has(oldId) && elementsMap.get(oldId) === this) {
            elementsMap.delete(oldId);
        }
        this._id = String(val || '');
        if (this._id) {
            elementsMap.set(this._id, this);
            const existingAttr = this.attributes.find(a => a.name.toLowerCase() === 'id');
            if (existingAttr) existingAttr.value = this._id;
            else this.attributes.push({ name: 'id', value: this._id });
        }
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
        if (child.nodeType === 11 /* DOCUMENT_FRAGMENT_NODE */) {
            const fragmentChildren = [...child.childNodes];
            child.childNodes = [];
            fragmentChildren.forEach(c => this.appendChild(c));
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
            function unregisterRecursive(n) {
                if (n._id && elementsMap.has(n._id)) elementsMap.delete(n._id);
                if (Array.isArray(n.childNodes)) n.childNodes.forEach(unregisterRecursive);
            }
            unregisterRecursive(child);
        }
        return child;
    }

    replaceChild(newChild, oldChild) {
        const idx = this.childNodes.indexOf(oldChild);
        if (idx === -1) return;
        if (newChild.nodeType === 11 /* DOCUMENT_FRAGMENT_NODE */) {
            const fragmentChildren = [...newChild.childNodes];
            newChild.childNodes = [];
            this.childNodes.splice(idx, 1, ...fragmentChildren);
            oldChild.parentNode = null;
            fragmentChildren.forEach(c => { c.parentNode = this; });
        } else {
            if (newChild.parentNode) newChild.parentNode.removeChild(newChild);
            this.childNodes[idx] = newChild;
            oldChild.parentNode = null;
            newChild.parentNode = this;
        }
        return oldChild;
    }

    replaceChildren(...newChildren) {
        while (this.childNodes.length > 0) {
            this.removeChild(this.childNodes[0]);
        }
        newChildren.forEach(c => this.appendChild(c));
    }

    replaceWith(...nodes) {
        if (!this.parentNode) return;
        const parent = this.parentNode;
        const idx = parent.childNodes.indexOf(this);
        if (idx === -1) return;
        parent.childNodes.splice(idx, 1, ...nodes);
        this.parentNode = null;
        nodes.forEach(n => { n.parentNode = parent; });
    }

    remove() {
        if (this._id && elementsMap.has(this._id)) elementsMap.delete(this._id);
        if (this.parentNode) this.parentNode.removeChild(this);
    }

    setAttribute(name, val) {
        let existing = this.attributes.find(a => a.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            existing.value = String(val);
        } else {
            this.attributes.push({ name: String(name), value: String(val) });
        }
        if (name === 'class') this.className = String(val);
        if (name === 'id') this.id = String(val);
        if (name.startsWith('data-')) {
            const key = name.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
            this.dataset[key] = String(val);
        }
    }

    getAttribute(name) {
        const attr = this.attributes.find(a => a.name.toLowerCase() === name.toLowerCase());
        return attr ? attr.value : null;
    }

    removeAttribute(name) {
        this.attributes = this.attributes.filter(a => a.name.toLowerCase() !== name.toLowerCase());
        if (name === 'class') this.className = '';
        if (name === 'id') this.id = '';
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

    dispatchEvent(event) {
        const list = this.eventListeners[event.type] || [];
        list.forEach(fn => fn(event));
        if (!event.cancelBubble && this.parentNode && typeof this.parentNode.dispatchEvent === 'function') {
            this.parentNode.dispatchEvent(event);
        }
    }

    click() {
        const event = {
            type: 'click',
            target: this,
            cancelBubble: false,
            stopPropagation: () => { event.cancelBubble = true; }
        };
        this.dispatchEvent(event);
    }

    closest(selector) {
        let curr = this;
        while (curr) {
            if (curr.nodeType === 1) {
                if (selector.startsWith('.')) {
                    if (curr.classList.contains(selector.slice(1))) return curr;
                } else if (selector.startsWith('#')) {
                    if (curr.id === selector.slice(1)) return curr;
                } else if (selector.toUpperCase() === curr.tagName) {
                    return curr;
                }
            }
            curr = curr.parentNode;
        }
        return null;
    }

    querySelectorAll(selector) {
        const results = [];
        function traverse(node) {
            for (const child of node.childNodes) {
                if (child.nodeType !== 1) continue;
                let match = false;
                if (selector.startsWith('.')) {
                    if (child.classList.contains(selector.slice(1))) match = true;
                } else if (selector.startsWith('#')) {
                    if (child.id === selector.slice(1)) match = true;
                } else if (selector.toUpperCase() === child.tagName) {
                    match = true;
                } else if (selector === '*') {
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

// TreeWalker implementation for Node.TEXT_NODE iteration
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
            if (child.nodeType === 3 /* Node.TEXT_NODE */) {
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

// Mock DOMParser parsing HTML text into MockNode tree with createTreeWalker support
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

// Register all required application IDs
const ALL_IDS = [
    'screenHome', 'screenWords', 'screenStats', 'screenSettings', 'screenOnboarding', 'screenStudy',
    'screenArticles', 'articleFeedView', 'articleReaderView', 'articleFeedList', 'articleCategoryBar',
    'readerStickyHeader', 'readerCategoryBadge', 'readerLevelBadge', 'articleReaderHero', 'readerCoverGradient',
    'heroCategoryBadge', 'heroLevelBadge', 'heroArticleTitle', 'heroArticleSubtitle', 'heroReadTime', 'heroWordCount',
    'articleBodyContent', 'articleQuizContainer', 'modalArticleWordLookup', 'lookupWordTypeBadge', 'lookupHeadword',
    'lookupPhonetic', 'lookupTtsBtn', 'lookupTurkish', 'lookupContextSentence', 'lookupAddWordBtn', 'lookupAddWordIcon',
    'lookupAddWordText', 'readerSettingsSheet', 'readerFontSizeOptions', 'readerFontFamilyOptions', 'readerThemeOptions',
    'toastNotification', 'toastText', 'bottomTabBar', 'currentTime', 'homeGreeting', 'homeProgressPercent',
    'homeProgressFraction', 'homeProgressSquare', 'streakCountNum', 'gridTotalNum', 'aiRecommendationsContainer',
    'searchInput', 'wordCountBadge', 'wordListContainer', 'statsStreakNum', 'statsTotalNum', 'statsMasteryTotal',
    'barMastered', 'barLearning', 'barNew', 'txtMasteredPct', 'txtLearningPct', 'txtNewPct',
    'txtMasteredCount', 'txtLearningCount', 'txtNewCount', 'swipeCard'
];
ALL_IDS.forEach(id => getOrCreateElement(id));

// Setup font buttons in readerSettingsSheet
const fontContainer = getOrCreateElement('readerFontSizeOptions');
['sm', 'base', 'lg', 'xl'].forEach(size => {
    const btn = new MockNode(1, 'button');
    btn.className = size === 'base' ? 'reader-font-btn bg-indigo-600' : 'reader-font-btn';
    btn.dataset.size = size;
    fontContainer.appendChild(btn);
});

// Setup font family buttons
const familyContainer = getOrCreateElement('readerFontFamilyOptions');
['sans', 'serif'].forEach(f => {
    const btn = new MockNode(1, 'button');
    btn.className = f === 'sans' ? 'reader-family-btn bg-indigo-600 font-sans' : 'reader-family-btn font-serif';
    btn.dataset.font = f;
    familyContainer.appendChild(btn);
});

// Setup theme buttons
const themeContainer = getOrCreateElement('readerThemeOptions');
['light', 'dark', 'sepia'].forEach(t => {
    const btn = new MockNode(1, 'button');
    btn.className = t === 'light' ? 'reader-theme-btn border-indigo-600' : 'reader-theme-btn';
    btn.dataset.theme = t;
    themeContainer.appendChild(btn);
});

// Mock Document
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

let ttsInvokedWith = null;
let chimePlayed = false;

const mockSpeechSynthesis = {
    cancel: () => {},
    speak: (u) => { ttsInvokedWith = u ? u.text : null; }
};

const sandbox = {
    console,
    document: mockDoc,
    window: {},
    speechSynthesis: mockSpeechSynthesis,
    DOMParser: MockDOMParser,
    NodeFilter: { SHOW_TEXT: 4 },
    SpeechSynthesisUtterance: function(text) { this.text = text; },
    playTTS: (text) => { ttsInvokedWith = text; },
    playSuccessSound: () => { chimePlayed = true; },
    _onChime: () => { chimePlayed = true; },
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
sandbox.window.playSuccessSound = () => { chimePlayed = true; };
sandbox.window._onChime = () => { chimePlayed = true; };

// Extract script
const fullScriptMatch = htmlContent.match(/<!-- JAVASCRIPT LOGIC -->\s*<script>([\s\S]*?)<\/script>/i);
assert(Boolean(fullScriptMatch), 'Extracted JavaScript logic from index.html');

vm.createContext(sandbox);
let vmError = null;
try {
    vm.runInContext(fullScriptMatch[1], sandbox);
} catch (e) {
    vmError = e;
}

if (!sandbox.appState && sandbox.window && sandbox.window.appState) {
    sandbox.appState = sandbox.window.appState;
}

assert(!vmError, 'M3 logic script executes in VM without syntax/runtime errors', vmError ? vmError.stack : '');

// ====================================================================
// Phase 4: Safe TreeWalker Word Tokenization Verification
// ====================================================================
console.log('\n--- Phase 4: Safe TreeWalker Word Tokenization Verification ---');

const renderContentSafelyFn = sandbox.renderArticleContentSafely;
assert(typeof renderContentSafelyFn === 'function', 'renderArticleContentSafely is defined as a function');

const testArticle = sandbox.articlesDB[0]; // Populer Bilim (Webb Telescope)
const bodyContainer = mockDoc.getElementById('articleBodyContent');

renderContentSafelyFn(testArticle);

const wordSpans = bodyContainer.querySelectorAll('.interactive-word');
assert(wordSpans.length > 50, `renderArticleContentSafely tokenized prose into words (found ${wordSpans.length} .interactive-word spans)`);

// Check span properties
const firstSpan = wordSpans[0];
assert(Boolean(firstSpan.dataset.word), 'Interactive word has dataset.word');
assert(firstSpan.classList.contains('cursor-pointer'), 'Interactive word has cursor-pointer class');
assert(firstSpan.classList.contains('interactive-word'), 'Interactive word has .interactive-word class');

// Check preservation of punctuation: paragraph has text nodes alongside spans
const firstParagraph = bodyContainer.childNodes[0];
assert(Boolean(firstParagraph), 'Body container contains paragraph nodes');
let hasPunctuationTextNode = false;
firstParagraph.childNodes.forEach(child => {
    if (child.nodeType === 3 && child.nodeValue.trim().length > 0) {
        // Punctuation like commas or periods
        if (/[.,—-]/.test(child.nodeValue)) hasPunctuationTextNode = true;
    }
});
assert(hasPunctuationTextNode, 'Punctuation marks are preserved outside word spans as separate text nodes');

// Check XSS immunity in article tokenizer
const maliciousArticle = {
    id: 'malicious-test',
    category: 'Popüler Bilim',
    title: 'XSS Injection Test',
    subtitle: 'Testing XSS defense',
    level: 'B1',
    wordCount: 10,
    readTimeMinutes: 1,
    contentHtml: '<p class="mb-4">Safe text <script>alert("PWNED")</script><img src="x" onerror="alert(1)"><svg onload="alert(1)"></svg> and harmless words.</p>',
    glossary: {},
    quiz: []
};

renderContentSafelyFn(maliciousArticle);
const scriptNodes = bodyContainer.querySelectorAll('script');
const imgNodes = bodyContainer.querySelectorAll('img');
const svgNodes = bodyContainer.querySelectorAll('svg');
assert(scriptNodes.length === 0, 'Zero <script> tags injected into article body DOM');
assert(imgNodes.length === 0, 'Zero <img> tags with onerror injected into article body DOM');
assert(svgNodes.length === 0, 'Zero <svg> tags with onload injected into article body DOM');

// ====================================================================
// Phase 5: Reader Navigation & State Switching
// ====================================================================
console.log('\n--- Phase 5: Reader Navigation & State Switching ---');

const openArticleFn = sandbox.openArticle;
const closeArticleReaderFn = sandbox.closeArticleReader;
assert(typeof openArticleFn === 'function', 'openArticle is defined');
assert(typeof closeArticleReaderFn === 'function', 'closeArticleReader is defined');

const feedViewEl = mockDoc.getElementById('articleFeedView');
const readerViewEl = mockDoc.getElementById('articleReaderView');

// 5.1 Open Article
openArticleFn('article-populer-bilim-1');
assert(sandbox.appState.currentArticleId === 'article-populer-bilim-1', 'openArticle sets appState.currentArticleId');
assert(feedViewEl.classList.contains('hidden'), '#articleFeedView is hidden when reading an article');
assert(!readerViewEl.classList.contains('hidden'), '#articleReaderView is revealed when reading an article');

const heroTitleEl = mockDoc.getElementById('heroArticleTitle');
assert(heroTitleEl.textContent === testArticle.title, 'Hero article title matches opened article');

const heroReadTimeEl = mockDoc.getElementById('heroReadTime');
assert(heroReadTimeEl.textContent === `${testArticle.readTimeMinutes} dk okuma`, 'Hero read time is formatted correctly');

const heroWordCountEl = mockDoc.getElementById('heroWordCount');
assert(heroWordCountEl.textContent === `${testArticle.wordCount} kelime`, 'Hero word count is formatted correctly');

// 5.2 Close Article Reader
closeArticleReaderFn();
assert(sandbox.appState.currentArticleId === null, 'closeArticleReader clears appState.currentArticleId to null');
assert(!feedViewEl.classList.contains('hidden'), '#articleFeedView is revealed upon closing reader');
assert(readerViewEl.classList.contains('hidden'), '#articleReaderView is hidden upon closing reader');

// Re-open for further tests
openArticleFn('article-populer-bilim-1');

// ====================================================================
// Phase 6: Word Lookup Modal & DictionaryDB Integration
// ====================================================================
console.log('\n--- Phase 6: Word Lookup Modal & DictionaryDB Integration ---');

const openLookupFn = sandbox.openArticleWordLookup;
const closeLookupFn = sandbox.closeArticleWordLookup;
const getWordDefFn = sandbox.getWordDefinition;

assert(typeof openLookupFn === 'function', 'openArticleWordLookup is defined');
assert(typeof closeLookupFn === 'function', 'closeArticleWordLookup is defined');
assert(typeof getWordDefFn === 'function', 'getWordDefinition is defined');

// 6.1 Lookup word from article glossary (infrared)
const infraredDef = getWordDefFn('infrared');
assert(infraredDef !== null, 'getWordDefinition resolves "infrared"');
assert(infraredDef.turkish.includes('kızılötesi'), 'infrared Turkish definition is "kızılötesi"');
assert(infraredDef.type === 'Sıfat', 'infrared grammatical type is "Sıfat"');

// 6.2 Lookup word from global dictionaryDB (resilient)
const resilientDef = getWordDefFn('resilient');
assert(resilientDef !== null, 'getWordDefinition resolves "resilient" from dictionaryDB');
assert(resilientDef.turkish.includes('dayanıklı'), 'resilient Turkish definition is "dayanıklı, dirençli"');

// 6.3 Stem matching (galaxies -> galaxy or galaxies)
const stemDef = getWordDefFn('galaxies');
assert(stemDef !== null && Boolean(stemDef.turkish), 'Plural/conjugated word resolves definition gracefully');

// 6.4 Open Modal & Populate
openLookupFn('infrared', 'Webb uses infrared instruments to peer through dust.');
const lookupModal = mockDoc.getElementById('modalArticleWordLookup');
assert(!lookupModal.classList.contains('hidden'), '#modalArticleWordLookup is shown');

const headwordEl = mockDoc.getElementById('lookupHeadword');
assert(headwordEl.textContent === 'infrared', '#lookupHeadword displays "infrared"');

const phoneticEl = mockDoc.getElementById('lookupPhonetic');
assert(phoneticEl.textContent === '/ˌɪnfrəˈred/', '#lookupPhonetic displays correct IPA');

const trEl = mockDoc.getElementById('lookupTurkish');
assert(trEl.textContent.includes('kızılötesi'), '#lookupTurkish displays Turkish meaning');

// 6.5 Audio Pronunciation via playLookupTTS()
ttsInvokedWith = null;
const playLookupTTSFn = sandbox.playLookupTTS;
assert(typeof playLookupTTSFn === 'function', 'playLookupTTS is defined');
playLookupTTSFn();
assert(ttsInvokedWith === 'infrared', 'playLookupTTS() invoked speech synthesis with "infrared"');

// 6.6 Close Modal
closeLookupFn();
assert(lookupModal.classList.contains('hidden'), 'closeArticleWordLookup() hides modal');

// ====================================================================
// Phase 7: "Kelime Defterime Ekle" (appState.words Sync & Deduplication)
// ====================================================================
console.log('\n--- Phase 7: Kelime Defterime Ekle (appState.words Sync) ---');

const addWordFn = sandbox.addWordToNotebook;
assert(typeof addWordFn === 'function', 'addWordToNotebook is defined');

const initialCount = sandbox.appState.words.length;

// 7.1 Add new unique word
const addSuccess = addWordFn({
    english: 'astronomy',
    turkish: 'gökbilim',
    phonetic: '/əˈstrɒnəmi/',
    type: 'İsim',
    example: 'Webb is rewriting the history of astronomy.'
});

assert(addSuccess === true, 'addWordToNotebook returns true for unique word');
assert(sandbox.appState.words.length === initialCount + 1, 'appState.words length increased by 1');
assert(sandbox.appState.words[0].english === 'astronomy', 'New word is prepended to appState.words[0]');
assert(sandbox.appState.words[0].addedToday === true, 'New word has addedToday = true');
assert(sandbox.appState.words[0].starred === false, 'New word has starred = false');

// 7.2 Duplicate addition prevention
const duplicateAttempt = addWordFn({
    english: 'ASTRONOMY', // Case-insensitive duplicate
    turkish: 'gökbilim',
    phonetic: '/əˈstrɒnəmi/',
    type: 'İsim',
    example: 'Webb is rewriting the history of astronomy.'
});

assert(duplicateAttempt === false, 'addWordToNotebook returns false for case-insensitive duplicate');
assert(sandbox.appState.words.length === initialCount + 1, 'appState.words length did not increase on duplicate');

// ====================================================================
// Phase 8: Customizable Reader Appearance
// ====================================================================
console.log('\n--- Phase 8: Customizable Reader Appearance ---');

const applySettingsFn = sandbox.applyReaderSettings;
const setFontSizeFn = sandbox.setReaderFontSize;
const setFontFamilyFn = sandbox.setReaderFontFamily;
const setThemeFn = sandbox.setReaderTheme;
const toggleSettingsFn = sandbox.toggleReaderSettings;

assert(typeof applySettingsFn === 'function', 'applyReaderSettings is defined');
assert(typeof setFontSizeFn === 'function', 'setReaderFontSize is defined');
assert(typeof setFontFamilyFn === 'function', 'setReaderFontFamily is defined');
assert(typeof setThemeFn === 'function', 'setReaderTheme is defined');

// 8.1 Font Sizes: sm, base, lg, xl
setFontSizeFn('sm');
assert(sandbox.readerSettings.fontSize === 'sm', 'setReaderFontSize(\'sm\') updates readerSettings.fontSize');
assert(readerViewEl.classList.contains('text-sm'), '#articleReaderView received text-sm class');

setFontSizeFn('xl');
assert(sandbox.readerSettings.fontSize === 'xl', 'setReaderFontSize(\'xl\') updates readerSettings.fontSize');
assert(readerViewEl.classList.contains('text-xl'), '#articleReaderView received text-xl class');
assert(!readerViewEl.classList.contains('text-sm'), '#articleReaderView removed previous text-sm class');

// 8.2 Font Family: sans vs serif
setFontFamilyFn('serif');
assert(sandbox.readerSettings.fontFamily === 'serif', 'setReaderFontFamily(\'serif\') updates readerSettings.fontFamily');
assert(readerViewEl.classList.contains('font-serif'), '#articleReaderView received font-serif class');

setFontFamilyFn('sans');
assert(sandbox.readerSettings.fontFamily === 'sans', 'setReaderFontFamily(\'sans\') updates readerSettings.fontFamily');
assert(readerViewEl.classList.contains('font-sans'), '#articleReaderView received font-sans class');
assert(!readerViewEl.classList.contains('font-serif'), '#articleReaderView removed font-serif class');

// 8.3 Themes: light, dark, sepia
setThemeFn('sepia');
assert(sandbox.readerSettings.theme === 'sepia', 'setReaderTheme(\'sepia\') updates readerSettings.theme');
assert(readerViewEl.classList.contains('theme-sepia'), '#articleReaderView received theme-sepia class');

setThemeFn('dark');
assert(sandbox.readerSettings.theme === 'dark', 'setReaderTheme(\'dark\') updates readerSettings.theme');
assert(readerViewEl.classList.contains('theme-dark'), '#articleReaderView received theme-dark class');
assert(!readerViewEl.classList.contains('theme-sepia'), '#articleReaderView removed theme-sepia class');

setThemeFn('light');
assert(sandbox.readerSettings.theme === 'light', 'setReaderTheme(\'light\') updates readerSettings.theme');
assert(readerViewEl.classList.contains('theme-light'), '#articleReaderView received theme-light class');

// 8.4 Toggle Settings Sheet
const settingsSheet = mockDoc.getElementById('readerSettingsSheet');
settingsSheet.classList.add('hidden');
toggleSettingsFn();
assert(!settingsSheet.classList.contains('hidden'), 'toggleReaderSettings() opens settings sheet');
toggleSettingsFn();
assert(settingsSheet.classList.contains('hidden'), 'toggleReaderSettings() closes settings sheet');

// ====================================================================
// Phase 9: Comprehension Mini-Quiz Engine
// ====================================================================
console.log('\n--- Phase 9: Comprehension Mini-Quiz Engine ---');

const renderQuizFn = sandbox.renderArticleQuiz;
const selectQuizOptionFn = sandbox.selectArticleQuizOption;
const resetQuizFn = sandbox.resetArticleQuiz;

assert(typeof renderQuizFn === 'function', 'renderArticleQuiz is defined');
assert(typeof selectQuizOptionFn === 'function', 'selectArticleQuizOption is defined');
assert(typeof resetQuizFn === 'function', 'resetArticleQuiz is defined');

const quizContainer = mockDoc.getElementById('articleQuizContainer');
renderQuizFn(testArticle);

const quizCards = quizContainer.querySelectorAll('.quiz-card');
assert(quizCards.length === testArticle.quiz.length, `renderArticleQuiz renders exactly ${testArticle.quiz.length} question cards`);

// 9.1 Test Correct Answer Flow
chimePlayed = false;
const q1Card = quizCards[0];
const q1Btns = q1Card.querySelectorAll('.quiz-option-btn');
assert(q1Btns.length === 4, 'Question 1 has 4 multiple-choice options');

const correctOptIdxQ1 = testArticle.quiz[0].correctIndex; // 1
const correctBtnQ1 = q1Btns[correctOptIdxQ1];

selectQuizOptionFn(correctBtnQ1, 0, correctOptIdxQ1, testArticle);

assert(chimePlayed === true, 'Correct option selection triggers playSuccessSound()');
assert(correctBtnQ1.classList.contains('border-emerald-500'), 'Correct option received emerald border');
assert(q1Btns.every(b => b.disabled === true), 'All options for question 1 are disabled after answering');

const q1ExpBox = q1Card.querySelector('.quiz-explanation-box');
assert(q1ExpBox && !q1ExpBox.classList.contains('hidden'), 'Explanation box is revealed');
assert(q1ExpBox.textContent.includes(testArticle.quiz[0].explanation), 'Explanation box contains Turkish explanation text');

// 9.2 Test Incorrect Answer Flow on Question 2
const q2Card = quizCards[1];
const q2Btns = q2Card.querySelectorAll('.quiz-option-btn');
const correctOptIdxQ2 = testArticle.quiz[1].correctIndex; // 0
const wrongOptIdxQ2 = correctOptIdxQ2 === 0 ? 1 : 0;
const wrongBtnQ2 = q2Btns[wrongOptIdxQ2];

selectQuizOptionFn(wrongBtnQ2, 1, wrongOptIdxQ2, testArticle);

assert(wrongBtnQ2.classList.contains('border-rose-500'), 'Incorrect option received rose border');
const highlightedCorrectBtnQ2 = q2Btns[correctOptIdxQ2];
assert(highlightedCorrectBtnQ2.classList.contains('border-emerald-500'), 'Correct option is highlighted in emerald when incorrect option is selected');

// 9.3 Score Summary Card
const scoreCard = mockDoc.getElementById('quizScoreCard');
assert(Boolean(scoreCard), 'Score summary card is rendered after all questions are answered');
assert(scoreCard.textContent.includes('1 / 2 Doğru (%50)'), 'Score summary card accurately calculates score fraction and percentage');

// 9.4 Reset Quiz
resetQuizFn(testArticle);
const refreshedCards = quizContainer.querySelectorAll('.quiz-card');
assert(refreshedCards.length === testArticle.quiz.length, 'resetArticleQuiz re-initializes quiz questions cleanly');
const refreshedScoreCard = mockDoc.getElementById('quizScoreCard');
assert(refreshedScoreCard === null, 'Score card is removed upon reset');

// ====================================================================
// Phase 10: Cross-Milestone Regression Verification
// ====================================================================
console.log('\n--- Phase 10: Cross-Milestone Regression Verification ---');

try {
    console.log('Running test_m2_navigation_articles.cjs regression check...');
    execSync('node tests/test_m2_navigation_articles.cjs', { stdio: 'pipe' });
    assert(true, 'tests/test_m2_navigation_articles.cjs executed with 0 exit code (PASS)');
} catch (e) {
    assert(false, 'tests/test_m2_navigation_articles.cjs regression check', e.message);
}

try {
    console.log('Running test_m1_security.cjs regression check...');
    execSync('node tests/test_m1_security.cjs', { stdio: 'pipe' });
    assert(true, 'tests/test_m1_security.cjs executed with 0 exit code (PASS)');
} catch (e) {
    assert(false, 'tests/test_m1_security.cjs regression check', e.message);
}

// ====================================================================
// Verification Summary
// ====================================================================
console.log('\n================================================================');
console.log(`VERIFICATION COMPLETE: ${passedTests} / ${totalTests} tests passed.`);
console.log('================================================================');

if (passedTests === totalTests) {
    console.log('\n>>> ALL MILESTONE 3 SPECIFICATIONS VERIFIED WITH 100% SUCCESS! <<<\n');
    process.exit(0);
} else {
    console.error(`\n>>> ${totalTests - passedTests} TESTS FAILED! <<<\n`);
    process.exit(1);
}
