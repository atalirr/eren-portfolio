const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const htmlPath = path.resolve(__dirname, '..', 'index.html');

// Create test html that opens articles tab
let html = fs.readFileSync(htmlPath, 'utf8');

// Test 1: Articles tab
const articlesHtml = html.replace(/switchTab\('home'\);\s*<\/script>/, "switchTab('articles');\n</script>");
const tempArticles = path.resolve(__dirname, '..', 'temp_articles.html');
fs.writeFileSync(tempArticles, articlesHtml, 'utf8');

// Test 2: Word Detail Modal
const modalHtml = html.replace(/switchTab\('home'\);\s*<\/script>/, "switchTab('words'); setTimeout(() => openWordDetailModal(appState.words[0].id), 200);\n</script>");
const tempModal = path.resolve(__dirname, '..', 'temp_modal.html');
fs.writeFileSync(tempModal, modalHtml, 'utf8');

// Test 3: Article Reader Clean View
const readerHtml = html.replace(/switchTab\('home'\);\s*<\/script>/, "switchTab('articles'); openArticle('article-populer-bilim-1');\n</script>");
const tempReader = path.resolve(__dirname, '..', 'temp_reader.html');
fs.writeFileSync(tempReader, readerHtml, 'utf8');

// Test 4: Article Reader with Dictionary Lookup Modal
const readerLookupHtml = html.replace(/switchTab\('home'\);\s*<\/script>/, "switchTab('articles'); openArticle('article-populer-bilim-1'); setTimeout(() => openArticleWordLookup('resilient', 'Engineers developed resilient components capable of withstanding extreme cold.'), 300);\n</script>");
const tempReaderLookup = path.resolve(__dirname, '..', 'temp_reader_lookup.html');
fs.writeFileSync(tempReaderLookup, readerLookupHtml, 'utf8');

// Test 5: Article Reader with Paragraph Translations Active
const readerTransHtml = html.replace(/switchTab\('home'\);\s*<\/script>/, "switchTab('articles'); openArticle('article-populer-bilim-1'); setTimeout(() => toggleArticleTranslation(), 300);\n</script>");
const tempReaderTrans = path.resolve(__dirname, '..', 'temp_reader_trans.html');
fs.writeFileSync(tempReaderTrans, readerTransHtml, 'utf8');

// Test 6: Articles Feed with Category Drawer Opened
const drawerHtml = html.replace(/switchTab\('home'\);\s*<\/script>/, "switchTab('articles'); setTimeout(() => toggleArticleCategoryDrawer(), 200);\n</script>");
const tempDrawer = path.resolve(__dirname, '..', 'temp_drawer.html');
fs.writeFileSync(tempDrawer, drawerHtml, 'utf8');

// Test 7: Articles Feed with Search Active
const searchHtml = html.replace(/switchTab\('home'\);\s*<\/script>/, "switchTab('articles'); setTimeout(() => { toggleArticleSearchInput(); const inp = document.getElementById('articleSearchInput'); if (inp) { inp.value = 'Telescope'; onArticleSearchInput('Telescope'); } }, 200);\n</script>");
const tempSearch = path.resolve(__dirname, '..', 'temp_search.html');
fs.writeFileSync(tempSearch, searchHtml, 'utf8');

// Test 8: 10 Categories Modal
const catModalHtml = html.replace(/switchTab\('home'\);\s*<\/script>/, "switchTab('articles'); setTimeout(() => openArticleCategoriesModal(), 250);\n</script>");
const tempCatModal = path.resolve(__dirname, '..', 'temp_cat_modal.html');
fs.writeFileSync(tempCatModal, catModalHtml, 'utf8');

// Test 9: Reader with Audio Player Bar Toggled
const readerAudioHtml = html.replace(/switchTab\('home'\);\s*<\/script>/, "switchTab('articles'); openArticle('article-populer-bilim-1'); setTimeout(() => toggleArticleAudioPlayerVisibility(), 300);\n</script>");
const tempReaderAudio = path.resolve(__dirname, '..', 'temp_reader_audio.html');
fs.writeFileSync(tempReaderAudio, readerAudioHtml, 'utf8');

const outArticles = path.resolve(__dirname, '..', 'preview_articles.png').replace(/\\/g, '/');
const outModal = path.resolve(__dirname, '..', 'preview_modal.png').replace(/\\/g, '/');
const outReader = path.resolve(__dirname, '..', 'preview_reader.png').replace(/\\/g, '/');
const outReaderLookup = path.resolve(__dirname, '..', 'preview_reader_lookup.png').replace(/\\/g, '/');
const outReaderTrans = path.resolve(__dirname, '..', 'preview_reader_translated.png').replace(/\\/g, '/');
const outDrawer = path.resolve(__dirname, '..', 'preview_feed_drawer.png').replace(/\\/g, '/');
const outSearch = path.resolve(__dirname, '..', 'preview_feed_search.png').replace(/\\/g, '/');
const outCatModal = path.resolve(__dirname, '..', 'preview_categories_modal.png').replace(/\\/g, '/');
const outReaderAudio = path.resolve(__dirname, '..', 'preview_reader_audio.png').replace(/\\/g, '/');

try {
    execSync(`"${edge}" --headless=new --disable-gpu --virtual-time-budget=2500 --window-size=500,1050 "--screenshot=${outArticles}" "file:///${tempArticles.replace(/\\/g, '/')}"`, { timeout: 30000 });
    console.log('Articles screenshot captured.');

    execSync(`"${edge}" --headless=new --disable-gpu --virtual-time-budget=2500 --window-size=500,1050 "--screenshot=${outModal}" "file:///${tempModal.replace(/\\/g, '/')}"`, { timeout: 30000 });
    console.log('Modal screenshot captured.');

    execSync(`"${edge}" --headless=new --disable-gpu --virtual-time-budget=3000 --window-size=500,1100 "--screenshot=${outReader}" "file:///${tempReader.replace(/\\/g, '/')}"`, { timeout: 30000 });
    console.log('Reader Clean screenshot captured.');

    execSync(`"${edge}" --headless=new --disable-gpu --virtual-time-budget=3000 --window-size=500,1100 "--screenshot=${outReaderLookup}" "file:///${tempReaderLookup.replace(/\\/g, '/')}"`, { timeout: 30000 });
    console.log('Reader Lookup screenshot captured.');

    execSync(`"${edge}" --headless=new --disable-gpu --virtual-time-budget=3000 --window-size=500,1100 "--screenshot=${outReaderTrans}" "file:///${tempReaderTrans.replace(/\\/g, '/')}"`, { timeout: 30000 });
    console.log('Reader Translated screenshot captured.');

    execSync(`"${edge}" --headless=new --disable-gpu --virtual-time-budget=2500 --window-size=500,1050 "--screenshot=${outDrawer}" "file:///${tempDrawer.replace(/\\/g, '/')}"`, { timeout: 30000 });
    console.log('Feed Drawer screenshot captured.');

    execSync(`"${edge}" --headless=new --disable-gpu --virtual-time-budget=2500 --window-size=500,1050 "--screenshot=${outSearch}" "file:///${tempSearch.replace(/\\/g, '/')}"`, { timeout: 30000 });
    console.log('Feed Search screenshot captured.');

    execSync(`"${edge}" --headless=new --disable-gpu --virtual-time-budget=3000 --window-size=500,1050 "--screenshot=${outCatModal}" "file:///${tempCatModal.replace(/\\/g, '/')}"`, { timeout: 30000 });
    console.log('Categories Modal screenshot captured.');

    execSync(`"${edge}" --headless=new --disable-gpu --virtual-time-budget=3000 --window-size=500,1100 "--screenshot=${outReaderAudio}" "file:///${tempReaderAudio.replace(/\\/g, '/')}"`, { timeout: 30000 });
    console.log('Reader Audio screenshot captured.');
} catch (e) {
    console.error('Error during capture:', e.message);
} finally {
    if (fs.existsSync(tempArticles)) fs.unlinkSync(tempArticles);
    if (fs.existsSync(tempModal)) fs.unlinkSync(tempModal);
    if (fs.existsSync(tempReader)) fs.unlinkSync(tempReader);
    if (fs.existsSync(tempReaderLookup)) fs.unlinkSync(tempReaderLookup);
    if (fs.existsSync(tempReaderTrans)) fs.unlinkSync(tempReaderTrans);
    if (fs.existsSync(tempDrawer)) fs.unlinkSync(tempDrawer);
    if (fs.existsSync(tempSearch)) fs.unlinkSync(tempSearch);
    if (fs.existsSync(tempCatModal)) fs.unlinkSync(tempCatModal);
    if (fs.existsSync(tempReaderAudio)) fs.unlinkSync(tempReaderAudio);
}
