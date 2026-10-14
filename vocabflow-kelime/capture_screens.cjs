const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2
    });
    const page = await context.newPage();
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(1000);

    // 1. Home
    await page.screenshot({ path: 'preview_home.png' });
    console.log('Captured preview_home.png');

    // 2. Words
    await page.evaluate(() => switchTab('words'));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'preview_words.png' });
    console.log('Captured preview_words.png');

    // 3. Stats
    await page.evaluate(() => switchTab('stats'));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'preview_stats.png' });
    console.log('Captured preview_stats.png');

    // 4. Articles
    await page.evaluate(() => {
        switchTab('articles');
        closeArticleCategoriesModal();
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'preview_articles.png' });
    console.log('Captured preview_articles.png');

    // 5. Reader
    await page.evaluate(() => openArticle('article-populer-bilim-1'));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'preview_reader.png' });
    console.log('Captured preview_reader.png');

    // 6. Reader Audio
    await page.evaluate(() => toggleArticleAudioPlayerVisibility());
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'preview_reader_audio.png' });
    console.log('Captured preview_reader_audio.png');

    // 7. Study
    await page.evaluate(() => { closeArticleReader(); switchTab('study'); });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'preview_study.png' });
    console.log('Captured preview_study.png');

    await browser.close();
    console.log('All screenshots captured successfully!');
})();
