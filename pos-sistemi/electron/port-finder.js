/**
 * Dinamik Port Bulucu
 * Electron başladığında boş bir port bulur
 */

const net = require('net');

const DEFAULT_PORT = 14532;
const PORT_RANGE = { min: 14000, max: 15000 };

/**
 * Port'un kullanılabilir olup olmadığını kontrol eder
 * @param {number} port - Kontrol edilecek port
 * @returns {Promise<boolean>} True if available, False if in use
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Boş bir port bulur
 * @returns {Promise<number>} Bulunan port numarası
 */
async function findAvailablePort() {
  try {
    // Önce varsayılan portu dene
    const isDefaultAvailable = await isPortAvailable(DEFAULT_PORT);
    
    if (isDefaultAvailable) {
      console.log(`✅ Varsayılan port ${DEFAULT_PORT} kullanılabilir`);
      return DEFAULT_PORT;
    }
    
    // Varsayılan port meşgulse, aralık içinde boş bir port bul
    console.log(`⚠️  Port ${DEFAULT_PORT} meşgul, alternatif port aranıyor...`);
    
    for (let port = PORT_RANGE.min; port <= PORT_RANGE.max; port++) {
      const available = await isPortAvailable(port);
      if (available) {
        console.log(`✅ Port ${port} bulundu ve kullanılacak`);
        return port;
      }
    }
    
    // Hiç boş port bulunamazsa varsayılan portu döndür (hata durumu)
    console.warn(`⚠️  Boş port bulunamadı, varsayılan port kullanılacak: ${DEFAULT_PORT}`);
    return DEFAULT_PORT;
    
  } catch (error) {
    console.error('❌ Port bulma hatası:', error);
    // Hata durumunda varsayılan portu döndür
    return DEFAULT_PORT;
  }
}

/**
 * Frontend dev server'ın çalıştığı port'u bulur
 * @param {number} startPort - Başlangıç portu (default: 5173)
 * @param {number} maxPort - Maksimum port (default: 5200)
 * @returns {Promise<number|null>} Port numarası veya null
 */
async function findFrontendPort(startPort = 5173, maxPort = 5200) {
  const https = require('http');
  
  console.log(`🔍 Frontend dev server port'u aranıyor (${startPort}-${maxPort})...`);
  
  for (let port = startPort; port <= maxPort; port++) {
    try {
      const response = await new Promise((resolve, reject) => {
        const req = https.get(`http://localhost:${port}`, (res) => {
          resolve(res);
        });
        req.on('error', reject);
        req.setTimeout(500, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });

      if (response.statusCode === 200 || response.statusCode === 304) {
        console.log(`✅ Frontend dev server bulundu: http://localhost:${port}`);
        return port;
      }
    } catch (error) {
      // Bu port'ta çalışmıyor, devam et
    }
  }
  
  console.warn(`⚠️  Frontend dev server bulunamadı (${startPort}-${maxPort})`);
  return null;
}

module.exports = { findAvailablePort, findFrontendPort };
