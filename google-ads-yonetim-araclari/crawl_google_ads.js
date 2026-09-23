const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const userDataDir = path.join(__dirname, 'ads_chrome_session');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const screenshotDir = path.join(__dirname, 'ads_screenshots');

if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
}

(async () => {
    console.log('=============================================================');
    console.log('>>> [1/3] GOOGLE ADS GUVENLI TARAYICI BASLATILIYOR...');
    console.log('=============================================================');

    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        defaultViewport: null,
        userDataDir: userDataDir,
        protocolTimeout: 0, // ASLA TIMEOUT VERME
        args: [
            '--start-maximized',
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-infobars'
        ]
    });

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    page.setDefaultTimeout(0); // Sayfa zaman asimi SINIRSIZ
    page.setDefaultNavigationTimeout(0);

    console.log('[2/3] Google Ads sayfasi aciliyor...');
    try {
        await page.goto('https://ads.google.com', { waitUntil: 'domcontentloaded' });
    } catch (e) {
        console.log('Sayfa acilis uyarisi (onemsiz):', e.message);
    }

    console.log('\n=============================================================');
    console.log('>>> LUTFEN ACILAN PENCEREDE GOOGLE HESABINIZA RAHATCA GIRIS YAPINIZ.');
    console.log('>>> Zaman siniri YOKTUR, tarayici KESINLIKLE KAPANMAYACAKTIR.');
    console.log('>>> Ana Ads paneli (dashboard) acildiginda tarama kendiliginden baslayacaktir.');
    console.log('>>> (Fatura ve Kredi Karti alanlari guvenlik geregi kesinlikle dislanir)');
    console.log('=============================================================\n');

    // Sonsuz ve guvenli dongu: Kullanici Ads ana paneline girdi mi?
    let loggedIn = false;
    while (!loggedIn) {
        await new Promise(r => setTimeout(r, 3000));
        try {
            const url = page.url();
            const isAdsApp = url.includes('ads.google.com/aw') || url.includes('ads.google.com/home');
            const isNotLogin = !url.includes('accounts.google.com') && !url.includes('signin') && !url.includes('/ServiceLogin');

            if (isAdsApp && isNotLogin) {
                // Sayfada ads menuleri var mi kontrol et
                const hasDom = await page.evaluate(() => {
                    return !!document.querySelector('material-button, [role="navigation"], [role="menu"], .particle-table, div[nav-item], a[href*="/campaigns"], a[href*="/adgroups"]');
                }).catch(() => false);

                if (hasDom) {
                    loggedIn = true;
                    break;
                }
            }
        } catch (err) {
            // Gezinme anindaki sayfa gecis hatalarini yut, kapanma!
        }
    }

    console.log('\n>>> [3/3] GIRIS BASARILI! Google Ads Paneli tespit edildi.');
    console.log('>>> Verilerin tam yuklenmesi icin 8 saniye bekleniyor...');
    await new Promise(r => setTimeout(r, 8000));

    // Ana panel screenshot
    const homeShot = path.join(screenshotDir, '01_ana_panel.png');
    await page.screenshot({ path: homeShot, fullPage: false });
    console.log(`[+] Ana panel ekran goruntusu alindi: ${homeShot}`);

    // Menuleri tara
    console.log('[+] Menuler ve ozellikler analiz ediliyor...');
    const discoveredSections = await page.evaluate(() => {
        const items = [];
        const elements = document.querySelectorAll('a[href], [role="menuitem"], [role="tab"], div[nav-item], [class*="nav-item"], [class*="menu-item"]');
        
        elements.forEach(el => {
            const text = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\n/g, ' ');
            const href = el.getAttribute('href') || '';
            
            // Fatura ve odeme KESINLIKLE HARIC
            const lowerText = text.toLowerCase();
            const lowerHref = href.toLowerCase();
            const isBilling = lowerText.includes('fatura') || lowerText.includes('ödeme') || lowerText.includes('odeme') ||
                              lowerText.includes('billing') || lowerText.includes('payment') || lowerText.includes('kredi') ||
                              lowerHref.includes('billing') || lowerHref.includes('payments');
            
            if (!isBilling && text && text.length > 1 && text.length < 60) {
                items.push({ text, href, tag: el.tagName });
            }
        });
        return items;
    });

    const uniqueSections = [];
    const seen = new Set();
    for (const item of discoveredSections) {
        const key = item.text + '||' + item.href;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueSections.push(item);
        }
    }

    console.log(`[+] Toplam ${uniqueSections.length} adet menu/bolum tespit edildi.`);

    const pageDetails = await page.evaluate(() => {
        const titles = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]')).map(h => h.innerText.trim()).filter(Boolean);
        const tables = document.querySelectorAll('table, .particle-table, [role="table"], [role="grid"]');
        let tableHeaders = [];
        tables.forEach(t => {
            const headers = Array.from(t.querySelectorAll('th, [role="columnheader"]')).map(th => th.innerText.trim()).filter(Boolean);
            if (headers.length > 0) tableHeaders.push(headers);
        });

        return { titles, tableHeaders, url: window.location.href };
    });

    const reportData = {
        scanDate: new Date().toISOString(),
        currentUrl: pageDetails.url,
        detectedHeaders: pageDetails.titles,
        tableHeaders: pageDetails.tableHeaders,
        menuItems: uniqueSections,
        notes: "Kredi karti ve faturalandirma sayfalari guvenlik geregi filtrelenmistir."
    };

    const reportPath = path.join(__dirname, 'google_ads_kesif_raporu.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf-8');
    
    console.log(`\n=============================================================`);
    console.log(`>>> TARAMA BASARIYLA TAMAMLANDI!`);
    console.log(`>>> Rapor dosyasi: ${reportPath}`);
    console.log(`>>> Ekran goruntusu: ${homeShot}`);
    console.log(`=============================================================\n`);
    console.log('Tarayici acik kalmaya devam edecektir. Pencereyi dilediginizde kapatabilirsiniz.');

    // Sonsuza kadar bekle, kullanici kapatana kadar acik kalsin
    await new Promise(() => {});
})().catch(err => {
    console.error('Beklenmeyen hata:', err);
});
