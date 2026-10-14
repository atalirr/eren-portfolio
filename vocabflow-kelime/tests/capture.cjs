const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const htmlPath = path.resolve(__dirname, '..', 'index.html');
const outLight = path.resolve(__dirname, '..', 'preview_light.png').replace(/\\/g, '/');
const outDark = path.resolve(__dirname, '..', 'preview_dark.png').replace(/\\/g, '/');

// Create temp dark html
const originalHtml = fs.readFileSync(htmlPath, 'utf8');
const darkHtml = originalHtml.replace('<html lang="tr" class="light">', '<html lang="tr" class="dark">');
const tempDarkPath = path.resolve(__dirname, '..', 'temp_dark.html');
fs.writeFileSync(tempDarkPath, darkHtml, 'utf8');

const urlLight = 'file:///' + htmlPath.replace(/\\/g, '/');
const urlDark = 'file:///' + tempDarkPath.replace(/\\/g, '/');

console.log('Capturing full frame screenshots...');
try {
    execSync(`"${edge}" --headless=new --disable-gpu --virtual-time-budget=2500 --window-size=450,1050 "--screenshot=${outLight}" "${urlLight}"`, { timeout: 30000 });
    console.log('Light exists:', fs.existsSync(outLight));
    execSync(`"${edge}" --headless=new --disable-gpu --virtual-time-budget=2500 --window-size=450,1050 "--screenshot=${outDark}" "${urlDark}"`, { timeout: 30000 });
    console.log('Dark exists:', fs.existsSync(outDark));
} catch (e) {
    console.error('Error:', e.message);
} finally {
    if (fs.existsSync(tempDarkPath)) fs.unlinkSync(tempDarkPath);
}


