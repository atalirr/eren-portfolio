/**
 * Preload Script - Güvenlik Köprüsü
 * Electron IPC ile Renderer Process arasında güvenli köprü
 */

const { contextBridge, ipcRenderer } = require('electron');

// API port bilgisini renderer process'e expose et
contextBridge.exposeInMainWorld('electronAPI', {
  // Port bilgisini al
  getPort: () => ipcRenderer.invoke('get-port'),

  // Python sunucusunun hazır olup olmadığını kontrol et
  checkPythonHealth: async (port) => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  },

  // İkinci ekran penceresini aç
  openSecondScreen: (data) => ipcRenderer.invoke('open-second-screen', data),

  // Cart update listener (ikinci ekran için)
  onCartUpdate: (callback) => {
    ipcRenderer.on('cart-update', (event, data) => {
      callback(data);
    });
  },

  // Ayarları oku/yaz
  readSettings: () => ipcRenderer.invoke('read-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Platform bilgisi
  platform: process.platform,
});

// Eski API uyumluluğu için
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, callback) => {
      // Sadece güvenli kanallar için
      if (channel === 'cart-update') {
        ipcRenderer.on(channel, (event, ...args) => callback(event, ...args));
      }
    },
    removeListener: (channel, callback) => {
      if (channel === 'cart-update') {
        ipcRenderer.removeListener(channel, callback);
      }
    },
  },
});

console.log('✅ Preload script yüklendi');


