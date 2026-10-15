/**
 * Electron Main Process Entry Point
 * POS 6 Desktop Application
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { findAvailablePort, findFrontendPort } = require('./port-finder');
const { startPythonServer, stopPythonServer } = require('./python-manager');
const config = require('./config');
const fs = require('fs');

let mainWindow = null;
let pythonPort = null;
let frontendPort = null;
let logFile = null;

const writeInitLog = (message) => {
  try {
    if (!logFile) {
      logFile = config.isDevelopment
        ? path.join(__dirname, '..', 'backend', 'app_init_debug.log')
        : path.join(app.getPath('userData'), 'app_init_debug.log');
    }
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`);
  } catch (err) {
    console.error('❌ Init log yazilamadi:', err);
  }
};

/**
 * Ana pencereyi oluşturur
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    ...config.window,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
  });

  // Frontend'i yükle
  if (frontendPort) {
    const devUrl = `http://localhost:${frontendPort}`;
    console.log(`📡 Frontend dev server yükleniyor: ${devUrl}`);
    mainWindow.loadURL(devUrl).catch((error) => {
      console.error('❌ Frontend dev server yüklenemedi:', error);
    });
  } else if (config.isDevelopment) {
    console.log(`📡 Frontend dev config URL yükleniyor: ${config.frontendUrl}`);
    mainWindow.loadURL(config.frontendUrl).catch((error) => {
      console.error('❌ Frontend URL yüklenemedi:', error);
    });
  } else {
    const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
    console.log(`📂 Frontend production dosyası yükleniyor: ${indexPath}`);
    mainWindow.loadFile(indexPath).catch((error) => {
      console.error('❌ Frontend dosyası yüklenemedi:', error);
      writeInitLog(`❌ Frontend dosyası yüklenemedi: ${error.message}`);
    });
  }

  // Development modunda DevTools'u ayrı pencere olarak aç
  if (config.isDevelopment) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // WebContents olaylarını ve console loglarını dinle
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    writeInitLog(`[Renderer Console] [Level ${level}] ${message} (at ${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    writeInitLog(`❌ Renderer did-fail-load: code=${errorCode}, desc=${errorDescription}, url=${validatedURL}`);
  });

  // Yükleme hatalarını yakala
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`❌ Sayfa yüklenemedi:`);
    console.error(`  Error Code: ${errorCode}`);
    console.error(`  Error Description: ${errorDescription}`);
    console.error(`  URL: ${validatedURL}`);
    const currentUrl = frontendPort ? `http://localhost:${frontendPort}` : config.frontendUrl;
    console.error(`  Beklenen URL: ${currentUrl}`);
    console.error('');
    console.error('🔍 Sorun giderme:');
    console.error('  1. Frontend dev server çalışıyor mu?');
    console.error('  2. Tarayıcıda test edin: http://localhost:5173 (veya başka port)');
    console.error('  3. Frontend terminalinde hata var mı?');
  });

  // Yükleme başarılı olduğunda
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Frontend başarıyla yüklendi!');
    writeInitLog('✅ Frontend başarıyla yüklendi!');
    
    // #root içeriğini logla
    setTimeout(async () => {
      try {
        const rootHTML = await mainWindow.webContents.executeJavaScript('document.getElementById("root")?.innerHTML || "ROOT NOT FOUND"');
        writeInitLog(`[HTML Check] #root content: ${rootHTML}`);
      } catch (err) {
        writeInitLog(`[HTML Check] Error: ${err.message}`);
      }
    }, 4000);
  });

  // Pencere hazır olduğunda göster
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    console.log('✅ Electron pencere açıldı ve gösterildi!');
  });

  // Pencere kapatıldığında
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Python sunucusunun hazır olup olmadığını kontrol eder
 * @param {number} port - Kontrol edilecek port
 * @returns {Promise<boolean>}
 */
async function waitForPythonServer(port) {
  const https = require('http');
  const maxAttempts = config.python.healthCheckTimeout / config.python.healthCheckInterval;
  let attempts = 0;

  writeInitLog(`waitForPythonServer: Checking host ${config.python.host} on port ${port}. maxAttempts=${maxAttempts}`);

  while (attempts < maxAttempts) {
    try {
      const response = await new Promise((resolve, reject) => {
        const req = https.get(`http://${config.python.host}:${port}/health`, (res) => {
          resolve(res);
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });

      writeInitLog(`Health check attempt ${attempts + 1}: statusCode=${response.statusCode}`);

      if (response.statusCode === 200) {
        console.log('✅ Python sunucusu hazır!');
        writeInitLog(`Health check successful at attempt ${attempts + 1}`);
        return true;
      }
    } catch (error) {
      writeInitLog(`Health check attempt ${attempts + 1} failed: ${error.message}`);
    }

    attempts++;
    await new Promise((resolve) => setTimeout(resolve, config.python.healthCheckInterval));
  }

  console.error('❌ Python sunucusu hazır olmadı (timeout)');
  writeInitLog('❌ Python sunucusu hazır olmadı (timeout)');
  return false;
}

/**
 * Frontend dev server'ın hazır olup olmadığını kontrol eder ve port'u bulur
 * @returns {Promise<boolean>}
 */
async function waitForFrontendServer() {
  console.log(`⏳ Frontend dev server aranıyor...`);
  
  // Frontend port'unu dinamik olarak bul
  const foundPort = await findFrontendPort(5174, 5200);
  
  if (foundPort) {
    frontendPort = foundPort;
    console.log(`✅ Frontend dev server bulundu: http://localhost:${frontendPort}`);
    return true;
  }
  
  // Eğer bulunamazsa, default port'u dene
  const https = require('http');
  const frontendUrl = new URL(config.frontendUrl);
  const defaultPort = frontendUrl.port || 5173;
  const maxAttempts = 30; // 30 saniye bekle
  let attempts = 0;

  console.log(`⏳ Frontend dev server bekleniyor: http://localhost:${defaultPort}`);

  while (attempts < maxAttempts) {
    try {
      const response = await new Promise((resolve, reject) => {
        const req = https.get(`http://localhost:${defaultPort}`, (res) => {
          resolve(res);
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });

      if (response.statusCode === 200 || response.statusCode === 304) {
        frontendPort = defaultPort;
        console.log(`✅ Frontend dev server hazır: http://localhost:${frontendPort}`);
        return true;
      }
    } catch (error) {
      // Sunucu henüz hazır değil, devam et
    }

    attempts++;
    if (attempts % 5 === 0) {
      console.log(`⏳ Frontend bekleniyor... (${attempts}/${maxAttempts})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.warn('⚠️  Frontend dev server hazır olmadı, yine de devam ediliyor...');
  console.warn('   Lütfen frontend dev server\'ı başlatın: cd frontend && npm run dev');
  return false;
}

/**
 * Uygulama başlangıç akışı
 */
async function initializeApp() {
  writeInitLog('initializeApp started');

  console.log('🚀 POS 6 uygulaması başlatılıyor...');

  try {
    // 1. Port bul
    console.log('🔍 Port aranıyor...');
    writeInitLog('Searching for port...');
    pythonPort = await findAvailablePort();
    console.log(`✅ Port bulundu: ${pythonPort}`);
    writeInitLog(`Port found: ${pythonPort}`);

    // 2. Python sunucusunu başlat
    console.log('🐍 Python sunucusu başlatılıyor...');
    writeInitLog('Starting Python server...');
    await startPythonServer(pythonPort);
    writeInitLog('Python server process spawned.');

    // 3. Python sunucusunun hazır olmasını bekle
    console.log('⏳ Python sunucusunun hazır olması bekleniyor...');
    writeInitLog('Waiting for Python server health check...');
    const isReady = await waitForPythonServer(pythonPort);
    writeInitLog(`Health check result: ${isReady}`);

    if (!isReady) {
      console.error('❌ Python sunucusu başlatılamadı!');
      writeInitLog('❌ Python sunucusu hazır olamadı (Health check başarısız veya timeout)');
      dialog.showErrorBox(
        'Bağlantı Hatası',
        'Arka plan veri sunucusu (pos6-backend) belirlenen sürede (30 saniye) yanıt vermedi.\n\n' +
        'Olası Çözüm Yolları:\n' +
        '1. Virüs koruma yazılımınız (Windows Defender vb.) pos6-backend.exe programının çalışmasını veya ağ erişimini engelliyor olabilir. Antivirüs uygulamasından Medikal POS\'a izin verin.\n' +
        '2. Uygulamayı kısayoluna sağ tıklayarak "Yönetici Olarak Çalıştır" seçeneğiyle açmayı deneyin.\n' +
        '3. Bilgisayarınızın güvenlik duvarının yerel ağ bağlantılarına (127.0.0.1) izin verdiğinden emin olun.\n\n' +
        `Günlük Dosyası: ${logFile}`
      );
      app.quit();
      return;
    }

    // 4. Frontend dev server'ın hazır olmasını bekle (development modunda)
    if (config.isDevelopment) {
      console.log('⏳ Frontend dev server bekleniyor...');
      const frontendReady = await waitForFrontendServer();
      if (!frontendReady) {
        console.warn('⚠️  Frontend dev server hazır değil, yine de devam ediliyor...');
        console.warn('   Lütfen frontend dev server\'ı başlatın: cd frontend && npm run dev');
      }
    }

    // 5. Electron penceresini oluştur
    console.log('🪟 Electron penceresi oluşturuluyor...');
    writeInitLog('Creating BrowserWindow...');
    createWindow();

    console.log('✅ Uygulama başarıyla başlatıldı!');
  } catch (error) {
    console.error('❌ Uygulama başlatılırken hata:', error);
    writeInitLog(`❌ Uygulama başlatılırken hata: ${error.message}`);
    if (error.stack) {
      writeInitLog(`Stack: ${error.stack}`);
    }
    dialog.showErrorBox(
      'Başlatma Hatası',
      `Medikal POS başlatılırken beklenmedik bir sistem hatası oluştu:\n\n${error.message}\n\n` +
      `Hata Günlük Dosyası: ${logFile}`
    );
    app.quit();
  }
}

// Settings File Persistence for Company Info & IBAN
const getSettingsPath = () => {
  return path.join(app.getPath('userData'), 'company_settings.json');
};

ipcMain.handle('save-settings', (event, settings) => {
  try {
    const filePath = getSettingsPath();
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Settings save error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-settings', () => {
  try {
    const filePath = getSettingsPath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Settings read error:', error);
  }
  return null;
});

// IPC Handlers

// Port bilgisini renderer process'e gönder
ipcMain.handle('get-port', () => {
  return pythonPort;
});

// İkinci ekran penceresini aç
let secondScreenWindow = null;

ipcMain.handle('open-second-screen', async (event, data) => {
  if (secondScreenWindow && !secondScreenWindow.isDestroyed()) {
    // Pencere zaten açıksa odakla ve güncelle
    secondScreenWindow.focus();
    secondScreenWindow.webContents.send('cart-update', data);
    return;
  }

  // Yeni pencere oluştur
  const frontendUrl = frontendPort 
    ? `http://localhost:${frontendPort}/second-screen`
    : `${config.frontendUrl}/second-screen`;

  secondScreenWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: false,
    frame: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  secondScreenWindow.loadURL(frontendUrl);

  // Pencere hazır olduğunda göster ve sepet verilerini gönder
  secondScreenWindow.webContents.once('did-finish-load', () => {
    secondScreenWindow.show();
    secondScreenWindow.webContents.send('cart-update', data);
  });

  // Pencere kapatıldığında referansı temizle
  secondScreenWindow.on('closed', () => {
    secondScreenWindow = null;
  });

  return { success: true };
});

// App Lifecycle Events

// Uygulama hazır olduğunda
app.whenReady().then(() => {
  initializeApp();

  // macOS için: Dock'tan tıklandığında pencereyi aç
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Tüm pencereler kapandığında
app.on('window-all-closed', () => {
  // macOS'ta değilse uygulamayı kapat
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Uygulama kapanmadan önce
app.on('before-quit', async () => {
  console.log('🛑 Uygulama kapatılıyor...');
  
  // Python sunucusunu kapat
  if (pythonPort) {
    await stopPythonServer();
  }
});

// Çıkış öncesi cleanup
app.on('will-quit', () => {
  console.log('✅ Cleanup tamamlandı');
});

// Uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

