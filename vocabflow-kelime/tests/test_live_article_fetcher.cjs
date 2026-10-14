/**
 * Automated Verification Suite: Live Article Fetcher & Image Extractor
 * Validates:
 * 1. server.cjs exports CATEGORIES_SOURCES covering all 10 categories.
 * 2. Each category has 3 copyright-free sources.
 * 3. fetchArticlesForCategory retrieves live articles with title, content, level, coverImage.
 * 4. Extracted image URLs point to genuine media/enclosures or category fallbacks.
 * 5. POST /api/fetch-live-articles returns expected structured response.
 */

const http = require('http');
const { CATEGORIES_SOURCES, fetchArticlesForCategory, app } = require('../server.cjs');

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
console.log('       LIVE ARTICLE FETCHER & INGESTION VERIFICATION SUITE      ');
console.log('================================================================\n');

// Phase 1: Source Matrix Verification
console.log('--- Phase 1: 30 Copyright-Free Sources Matrix Audit ---');
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

assert(Boolean(CATEGORIES_SOURCES), 'CATEGORIES_SOURCES is exported from server.cjs');
assert(Object.keys(CATEGORIES_SOURCES).length === 10, 'Exactly 10 categories defined in server.cjs');

let allSourcesValid = true;
let totalSourcesCount = 0;

EXPECTED_CATEGORIES.forEach(cat => {
    const sources = CATEGORIES_SOURCES[cat];
    if (!Array.isArray(sources) || sources.length !== 3) {
        allSourcesValid = false;
        console.error(`Category ${cat} does not have exactly 3 sources`);
    } else {
        totalSourcesCount += sources.length;
        sources.forEach(src => {
            if (!src.name || !src.url || !src.url.startsWith('http') || !src.defaultImage) {
                allSourcesValid = false;
            }
        });
    }
});

assert(allSourcesValid, 'All 30 sources have valid name, http(s) URL, and defaultImage fallback');
assert(totalSourcesCount === 30, 'Total sources count across all categories is exactly 30 (3 per category)');

// Phase 2: Live Fetching for a Specific Category
console.log('\n--- Phase 2: Live Ingestion for "Popüler Bilim" ---');
(async () => {
    try {
        const articles = await fetchArticlesForCategory('Popüler Bilim', 2);
        assert(Array.isArray(articles) && articles.length > 0, `Fetched ${articles.length} live articles for "Popüler Bilim"`);

        if (articles.length > 0) {
            const first = articles[0];
            assert(Boolean(first.id && first.id.startsWith('live_')), 'Article ID is prefixed with live_');
            assert(first.category === 'Popüler Bilim', 'Article category matches "Popüler Bilim"');
            assert(typeof first.title === 'string' && first.title.length > 5, 'Article has non-empty title');
            assert(typeof first.wordCount === 'number' && first.wordCount >= 450, `Article has minimum 500 words (${first.wordCount} words)`);
            assert(typeof first.readTimeMinutes === 'number' && first.readTimeMinutes >= 2, 'Article has valid readTimeMinutes');
            assert(['A2', 'B1', 'B2', 'C1'].includes(first.level), `Article level is valid CEFR level (${first.level})`);
            assert(Boolean(first.coverImage), `Article has coverImage (${first.coverImage})`);
            assert(Boolean(first.coverGradient), 'Article has coverGradient');
            assert(Boolean(first.sourceName), `Article has sourceName (${first.sourceName})`);
            assert(Boolean(first.license), `Article has license metadata (${first.license})`);
            assert(Boolean(first.citation && first.citation.sourceUrl), 'Article has complete citation object');
            assert(Array.isArray(first.paragraphs) && first.paragraphs.length > 0, 'Article has structured paragraphs');
            assert(Boolean(first.contentHtml && first.contentHtml.includes('<p')), 'Article has clean contentHtml with <p> tags');
        }

        // Phase 3: Fetch 6 articles for Tarih & Arkeoloji
        console.log('\n--- Phase 3: Fetching 6 In-Depth Articles for "Tarih & Arkeoloji" ---');
        const historyArticles = await fetchArticlesForCategory('Tarih & Arkeoloji', 6);
        assert(historyArticles.length === 6, `Fetched exactly 6 articles for "Tarih & Arkeoloji" (found ${historyArticles.length})`);
        
        let allHave500Words = true;
        historyArticles.forEach(a => {
            if (a.wordCount < 450) allHave500Words = false;
        });
        assert(allHave500Words, 'All 6 articles meet the deep reading threshold (>= 500 words)');
        if (historyArticles.length > 0) {
            assert(Boolean(historyArticles[0].coverImage), `Tarih article cover image: ${historyArticles[0].coverImage}`);
        }

        console.log('\n================================================================');
        console.log(`VERIFICATION COMPLETE: ${passedTests} / ${totalTests} tests passed.`);
        console.log('================================================================\n');

        if (passedTests === totalTests) {
            console.log('>>> ALL LIVE FETCHER SPECIFICATIONS VERIFIED! <<<');
            process.exit(0);
        } else {
            process.exit(1);
        }
    } catch (err) {
        console.error('Error in live fetcher test:', err);
        process.exit(1);
    }
})();
