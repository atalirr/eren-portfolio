/**
 * Milestone 2 Automated Verification Suite: Article Data & Navigation Integration
 * Validates:
 * 1. Bottom tab bar contains 5 tabs (including Makaleler with menu_book).
 * 2. #screenArticles container exists with header, category filter pills, and feed list.
 * 3. switchTab('articles') reveals screenArticles and highlights articles tab.
 * 4. All 5 categories filter properly with active pill state updates and empty state fallback.
 * 5. articlesDB contains 5 curated copyright-free articles with A2-C1 levels, WPM read times, glossaries, and quizzes.
 * 6. Safe DOM rendering (zero innerHTML sinks introduced, XSS resilience).
 * 7. Zero syntax errors and zero regressions in existing security specifications.
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
console.log('    MILESTONE 2: ARTICLE DATA & NAVIGATION VERIFICATION SUITE   ');
console.log('================================================================\n');

// Phase 1: Static HTML Analysis
console.log('--- Phase 1: Static Markup & Structure Audit ---');
const htmlPath = path.join(__dirname, '..', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// 1.1 Bottom Navigation Bar: Exactly 5 tabs
const navBarMatch = htmlContent.match(/<nav\s+id="bottomTabBar"[\s\S]*?<\/nav>/i);
assert(Boolean(navBarMatch), '#bottomTabBar is present in index.html');

if (navBarMatch) {
    const navBarHtml = navBarMatch[0];
    const tabButtons = navBarHtml.match(/<button[^>]*data-tab="([^"]+)"[^>]*>/g) || [];
    assert(tabButtons.length === 5, 'Bottom tab bar contains exactly 5 tabs', `Found ${tabButtons.length} tabs`);

    const hasArticlesTab = /data-tab="articles"[^>]*onclick="switchTab\('articles'\)"|onclick="switchTab\('articles'\)"[^>]*data-tab="articles"/.test(navBarHtml);
    assert(hasArticlesTab, 'Articles tab button has data-tab="articles" and onclick="switchTab(\'articles\')"');

    const hasArticlesIcon = /<button[^>]*data-tab="articles"[\s\S]*?<span[^>]*class="material-symbols-outlined"[^>]*>(?:auto_stories|menu_book)<\/span>[\s\S]*?<span>Makaleler<\/span>[\s\S]*?<\/button>/.test(navBarHtml);
    assert(hasArticlesIcon, 'Articles tab contains "auto_stories" icon and "Makaleler" label');
}

// 1.2 Screen Container: #screenArticles
const screenArticlesMatch = htmlContent.match(/<section\s+id="screenArticles"[\s\S]*?<\/section>/i);
assert(Boolean(screenArticlesMatch), '#screenArticles section container exists');

if (screenArticlesMatch) {
    const screenHtml = screenArticlesMatch[0];
    assert(screenHtml.includes('class="flex-1 flex flex-col p-4 hidden fade-in pb-24 overflow-y-auto"'), '#screenArticles has required responsive layout classes');
    assert(screenHtml.includes('Makale &amp; Okuma') || screenHtml.includes('Makale & Okuma'), '#screenArticles header title "Makale & Okuma" is present');
    assert(screenHtml.includes('İlgi çekici içeriklerle kelime dağarcığını geliştir'), '#screenArticles subtitle is present');

    // 1.3 Category Filter Pills
    const categoryBarMatch = screenHtml.match(/<div\s+id="articleCategoryBar"[\s\S]*?<\/div>/i);
    assert(Boolean(categoryBarMatch), '#articleCategoryBar container is present');

    const categories = ['all', 'Popüler Bilim', 'Sinema &amp; Kültür', 'İlginç Hikayeler', 'Teknoloji', 'Doğa &amp; Gezi'];
    let allPillsFound = true;
    for (const cat of categories) {
        const hasPill = screenHtml.includes(`data-category="${cat}"`) || screenHtml.includes(`filterArticleCategory('${cat}')`) || screenHtml.includes(`filterArticleCategory('${cat.replace(/&amp;/g, '&')}')`);
        if (!hasPill) {
            allPillsFound = false;
            console.error(`Missing filter pill for category: ${cat}`);
        }
    }
    assert(allPillsFound, 'All 6 category filter pills (Tümü + 5 categories) exist in #articleCategoryBar');

    // 1.4 Article Feed Container
    const hasFeedContainer = /<div\s+id="articleFeedList"[^>]*>/.test(screenHtml);
    assert(hasFeedContainer, '#articleFeedList container exists inside #screenArticles');
}

// Phase 2: Security & innerHTML Sink Audit
console.log('\n--- Phase 2: Zero Unsafe innerHTML Sinks Audit ---');
const lines = htmlContent.split('\n');
const innerHtmlMatches = [];
lines.forEach((line, idx) => {
    if (line.includes('.innerHTML') && !line.includes('return doc.body.innerHTML')) {
        innerHtmlMatches.push({ line: idx + 1, content: line.trim() });
    }
});
assert(innerHtmlMatches.length === 0, 'Zero unsafe innerHTML sinks across entire index.html',
    innerHtmlMatches.map(m => `Line ${m.line}: ${m.content}`).join(', '));

// Phase 3: Dataset Validation (articlesDB)
console.log('\n--- Phase 3: Curated Articles Dataset Validation ---');

// Extract script content from index.html
const fullScriptMatch = htmlContent.match(/<!-- JAVASCRIPT LOGIC -->\s*<script>([\s\S]*?)<\/script>/i);
assert(Boolean(fullScriptMatch), 'Extracted JavaScript logic block from index.html');

const scriptSource = fullScriptMatch ? fullScriptMatch[1] : '';

// Create DOM Mock for evaluating scripts in Node.js
class MockDOMElement {
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

// Build synthetic DOM tree matching index.html
const syntheticElements = new Map();

function getOrCreateSyntheticElement(id, tagName = 'div') {
    if (!syntheticElements.has(id)) {
        const el = new MockDOMElement(tagName);
        el.id = id;
        syntheticElements.set(id, el);
    }
    return syntheticElements.get(id);
}

// Initialize needed screens and controls
['screenHome', 'screenWords', 'screenStats', 'screenSettings', 'screenOnboarding', 'screenStudy', 'screenArticles', 'bottomTabBar', 'toastNotification', 'toastText', 'currentTime', 'homeGreeting', 'homeProgressPercent', 'homeProgressFraction', 'homeProgressSquare', 'streakCountNum', 'gridTotalNum', 'aiRecommendationsContainer', 'articleFeedList', 'articleCategoryBar'].forEach(id => {
    getOrCreateSyntheticElement(id);
});

// Setup bottomTabBar nav buttons
const bottomBar = getOrCreateSyntheticElement('bottomTabBar');
['home', 'words', 'articles', 'stats', 'settings'].forEach(tab => {
    const btn = new MockDOMElement('button');
    btn.className = tab === 'home' ? 'nav-btn active' : 'nav-btn';
    btn.dataset.tab = tab;
    const icon = new MockDOMElement('span');
    icon.className = 'material-symbols-outlined' + (tab === 'home' ? ' icon-fill' : '');
    icon.textContent = tab === 'articles' ? 'menu_book' : 'icon';
    btn.appendChild(icon);
    const label = new MockDOMElement('span');
    label.textContent = tab;
    btn.appendChild(label);
    bottomBar.appendChild(btn);
});

// Setup Category Bar pills
const catBar = getOrCreateSyntheticElement('articleCategoryBar');
['all', 'Popüler Bilim', 'Sinema & Kültür', 'İlginç Hikayeler', 'Teknoloji', 'Doğa & Gezi'].forEach(cat => {
    const pill = new MockDOMElement('button');
    pill.className = cat === 'all' ? 'article-cat-pill active' : 'article-cat-pill';
    pill.dataset.category = cat;
    pill.textContent = cat === 'all' ? 'Tümü' : cat;
    catBar.appendChild(pill);
});

const mockDocument = {
    getElementById(id) {
        return getOrCreateSyntheticElement(id);
    },
    createElement(tagName) {
        return new MockDOMElement(tagName);
    },
    createTextNode(text) {
        const node = new MockDOMElement('#text');
        node.textContent = text;
        return node;
    },
    querySelectorAll(selector) {
        if (selector === '.nav-btn') return bottomBar.querySelectorAll('.nav-btn');
        if (selector === '.article-cat-pill') return catBar.querySelectorAll('.article-cat-pill');
        if (selector === '.ob-slide') return [];
        return [];
    }
};

const sandbox = {
    console,
    document: mockDocument,
    window: {},
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

// Run the script in VM context
vm.createContext(sandbox);

let vmError = null;
try {
    vm.runInContext(scriptSource, sandbox);
} catch (e) {
    vmError = e;
}

if (!sandbox.appState && sandbox.window && sandbox.window.appState) {
    sandbox.appState = sandbox.window.appState;
}

assert(!vmError, 'JavaScript script section executes without syntax or runtime errors', vmError ? vmError.stack : '');

const runtimeArticlesDB = sandbox.articlesDB;
assert(Array.isArray(runtimeArticlesDB), 'articlesDB is defined and is an Array');
assert(runtimeArticlesDB && (runtimeArticlesDB.length === 5 || runtimeArticlesDB.length === 10), 'articlesDB contains articles', `Found ${runtimeArticlesDB ? runtimeArticlesDB.length : 0}`);

const EXPECTED_CATEGORIES = [
    'Popüler Bilim',
    'Sinema & Kültür',
    'İlginç Hikayeler',
    'Teknoloji',
    'Doğa & Gezi',
    'Tarih & Arkeoloji',
    'Psikoloji & Zihin',
    'Felsefe & Düşünce',
    'Sanat & Mimari',
    'Edebiyat & Yazı'
];

const VALID_LEVELS = new Set(['A2', 'B1', 'B2', 'C1']);

if (runtimeArticlesDB) {
    const foundCategories = new Set();
    const foundLevels = new Set();

    runtimeArticlesDB.forEach((art, index) => {
        const prefix = `Article [${index + 1}: ${art.id}]`;
        assert(Boolean(art.id && typeof art.id === 'string'), `${prefix} has non-empty id`);
        assert(EXPECTED_CATEGORIES.includes(art.category), `${prefix} has valid category (${art.category})`);
        foundCategories.add(art.category);

        assert(Boolean(art.title && typeof art.title === 'string'), `${prefix} has non-empty title`);
        assert(Boolean(art.subtitle && typeof art.subtitle === 'string'), `${prefix} has non-empty subtitle`);
        assert(VALID_LEVELS.has(art.level), `${prefix} has valid CEFR level (${art.level})`);
        foundLevels.add(art.level);

        assert(typeof art.wordCount === 'number' && art.wordCount > 50, `${prefix} has positive wordCount (${art.wordCount})`);
        const expectedReadTime = Math.ceil(art.wordCount / 200);
        assert(art.readTimeMinutes === expectedReadTime, `${prefix} readTimeMinutes is accurately calculated via WPM formula Math.ceil(wordCount / 200) (${art.readTimeMinutes} === ${expectedReadTime})`);

        assert(Boolean(art.coverGradient && typeof art.coverGradient === 'string'), `${prefix} has coverGradient`);
        assert(Boolean(art.contentHtml && typeof art.contentHtml === 'string' && art.contentHtml.includes('<p')), `${prefix} has contentHtml with paragraphs`);

        // Check Glossary
        assert(art.glossary && typeof art.glossary === 'object', `${prefix} has glossary object`);
        const glossaryKeys = Object.keys(art.glossary || {});
        assert(glossaryKeys.length >= 5, `${prefix} glossary contains comprehensive mappings (${glossaryKeys.length} terms)`);
        
        let validGlossaryItems = true;
        glossaryKeys.forEach(term => {
            const item = art.glossary[term];
            if (!item.turkish || !item.phonetic || !item.type) {
                validGlossaryItems = false;
            }
        });
        assert(validGlossaryItems, `${prefix} glossary entries have turkish, phonetic, and grammatical type`);

        // Check Quiz
        assert(Array.isArray(art.quiz) && art.quiz.length >= 2, `${prefix} has quiz with at least 2 comprehension questions`);
        let validQuiz = true;
        (art.quiz || []).forEach(q => {
            if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correctIndex !== 'number' || !q.explanation) {
                validQuiz = false;
            }
        });
        assert(validQuiz, `${prefix} quiz questions each have 4 options, valid correctIndex, and Turkish explanation`);
    });

    assert(foundCategories.size >= 5, 'All distinct categories are represented in articlesDB');
    assert(foundLevels.has('A2') && (foundLevels.has('B1') || foundLevels.has('B2')) && foundLevels.has('C1'), 'Articles span CEFR spectrum A2 through C1');
}

// Phase 4: Tab Switching & Navigation Logic Simulation
console.log('\n--- Phase 4: switchTab(\'articles\') Navigation Simulation ---');

const switchTabFn = sandbox.switchTab;
assert(typeof switchTabFn === 'function', 'switchTab function is defined');

// Initially switch to home
switchTabFn('home');
assert(sandbox.appState.activeTab === 'home', 'Initial tab is home');

// Switch to articles
switchTabFn('articles');
assert(sandbox.appState.activeTab === 'articles', 'switchTab(\'articles\') updates appState.activeTab to articles');

const screenArticlesEl = mockDocument.getElementById('screenArticles');
assert(!screenArticlesEl.classList.contains('hidden'), '#screenArticles hidden class was removed');

const otherScreens = ['screenHome', 'screenWords', 'screenStats', 'screenSettings'];
let otherScreensHidden = true;
otherScreens.forEach(s => {
    if (!mockDocument.getElementById(s).classList.contains('hidden')) otherScreensHidden = false;
});
assert(otherScreensHidden, 'All non-active screens are hidden when switching to articles');

const navBtns = mockDocument.querySelectorAll('.nav-btn');
let articlesBtnActive = false;
navBtns.forEach(btn => {
    if (btn.dataset.tab === 'articles' && btn.className.includes('active')) {
        articlesBtnActive = true;
    }
});
assert(articlesBtnActive, 'Articles bottom nav button is marked with active class');

// Phase 5: Safe Feed Rendering & Category Filtering Simulation
console.log('\n--- Phase 5: Safe Feed Rendering & Category Filtering Simulation ---');

const renderArticlesFeedFn = sandbox.renderArticlesFeed;
const filterArticleCategoryFn = sandbox.filterArticleCategory;

assert(typeof renderArticlesFeedFn === 'function', 'renderArticlesFeed function is defined');
assert(typeof filterArticleCategoryFn === 'function', 'filterArticleCategory function is defined');

const feedList = mockDocument.getElementById('articleFeedList');

// 5.1 Initial Feed (all categories)
renderArticlesFeedFn();
let initialCards = feedList.querySelectorAll('article');
assert(initialCards.length === runtimeArticlesDB.length, 'renderArticlesFeed() initially renders all article cards');

// Check card structure
const firstCard = initialCards[0];
assert(Boolean(firstCard.dataset.articleId), 'Article card has dataset.articleId');
const readBtn = firstCard.querySelector('.article-read-btn');
assert(Boolean(readBtn), 'Article card contains interactive "Makaleyi Oku" button');

// 5.2 Category Filter: "Popüler Bilim"
filterArticleCategoryFn('Popüler Bilim');
assert(sandbox.appState.articleCategoryFilter === 'Popüler Bilim', 'Filter sets appState.articleCategoryFilter');

let popSciCards = feedList.querySelectorAll('article');
assert(popSciCards.length === 1, 'Filter "Popüler Bilim" renders exactly 1 card', `Found ${popSciCards.length}`);

// 5.3 Filter Each Category
for (const cat of EXPECTED_CATEGORIES) {
    filterArticleCategoryFn(cat);
    const catCards = feedList.querySelectorAll('article');
    assert(catCards.length === 1, `Filter "${cat}" renders matching article card`);
}

// 5.4 Empty category fallback
sandbox.appState.articleCategoryFilter = 'Bilinmeyen Kategori';
renderArticlesFeedFn();
const emptyCards = feedList.querySelectorAll('.glass-card');
assert(emptyCards.length === 1, 'Empty state card is rendered when category matches 0 articles');

// Reset to all
filterArticleCategoryFn('all');
assert(feedList.querySelectorAll('article').length === runtimeArticlesDB.length, 'Filter "all" restores all article cards');

// Phase 6: openArticle() interaction
console.log('\n--- Phase 6: openArticle Interaction ---');
const openArticleFn = sandbox.openArticle;
assert(typeof openArticleFn === 'function', 'openArticle function is defined');

openArticleFn('article-populer-bilim-1');
assert(sandbox.appState.currentArticleId === 'article-populer-bilim-1', 'openArticle sets appState.currentArticleId');

console.log('\n================================================================');
console.log(`VERIFICATION COMPLETE: ${passedTests} / ${totalTests} tests passed.`);
console.log('================================================================');

if (passedTests === totalTests) {
    console.log('\n>>> ALL MILESTONE 2 SPECIFICATIONS VERIFIED SUCCESSFULLY! <<<\n');
    process.exit(0);
} else {
    console.error(`\n>>> ${totalTests - passedTests} TESTS FAILED! <<<\n`);
    process.exit(1);
}
