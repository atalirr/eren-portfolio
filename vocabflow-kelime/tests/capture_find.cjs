const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const htmlPath = path.resolve(__dirname, '..', 'index.html');
const outLookup = path.resolve(__dirname, '..', 'preview_find_lookup.png').replace(/\\/g, '/');

let html = fs.readFileSync(htmlPath, 'utf8');

const autoScript = `
<script>
window.addEventListener('load', () => {
    setTimeout(() => {
        if (typeof closeCategoriesDrawer === 'function') closeCategoriesDrawer();
        if (typeof switchTab === 'function') switchTab('articles');
        setTimeout(() => {
            if (typeof closeCategoriesDrawer === 'function') closeCategoriesDrawer();
            if (typeof openArticle === 'function') openArticle('article-teknoloji-4');
            setTimeout(() => {
                const words = document.querySelectorAll('#articleBodyContent .interactive-word');
                for (const span of words) {
                    if (span.dataset.word === 'find') {
                        span.click();
                        break;
                    }
                }
            }, 800);
        }, 800);
    }, 800);
});
</script>
</body>`;

html = html.replace('</body>', autoScript);
const tempPath = path.resolve(__dirname, '..', 'temp_find.html');
fs.writeFileSync(tempPath, html, 'utf8');

const url = 'file:///' + tempPath.replace(/\\/g, '/');

console.log('Capturing find lookup card...');
try {
    execSync(`"${edge}" --headless=new --disable-gpu --virtual-time-budget=6000 --window-size=430,932 "--screenshot=${outLookup}" "${url}"`, { timeout: 30000 });
    console.log('Screenshot created:', fs.existsSync(outLookup));
} catch (e) {
    console.error('Error:', e.message);
} finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
}
