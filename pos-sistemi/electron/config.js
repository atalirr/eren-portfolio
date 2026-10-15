/**
 * Electron Konfigürasyonu
 */

const { app } = require('electron');
const path = require('path');

const isDevelopment = app ? !app.isPackaged : (process.env.NODE_ENV !== 'production');

const config = {
  isDevelopment,
  // Window ayarları
  window: {
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false, // Başlangıçta gizli, yüklendikten sonra göster
    webPreferences: {
      nodeIntegration: false, // Güvenlik: Node.js API'lerine doğrudan erişim yok
      contextIsolation: true, // Güvenlik: Context isolation aktif
      preload: path.join(__dirname, 'preload.js'),
    },
  },

  // Frontend URL (development vs production)
  frontendUrl: isDevelopment
    ? 'http://localhost:5174' // Vite dev server
    : `file://${path.join(__dirname, '..', 'frontend', 'dist', 'index.html')}`, // Built files

  // Python sunucu ayarları
  python: {
    defaultPort: 14533,
    host: '127.0.0.1',
    healthCheckInterval: 1000, // ms
    healthCheckTimeout: 30000, // ms (30 saniye)
  },
};

module.exports = config;


