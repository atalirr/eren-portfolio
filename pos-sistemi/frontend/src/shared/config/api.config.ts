/**
 * API Configuration
 * Electron IPC üzerinden port bilgisini alır
 */

let apiBaseUrl = 'http://127.0.0.1:14532'; // Default port (Electron will override this)

/**
 * API base URL'i ayarlar
 * @param port - Python sunucusunun port numarası
 */
export function setApiBaseUrl(port: number): void {
  apiBaseUrl = `http://127.0.0.1:${port}`;
}

/**
 * API base URL'i alır
 * @returns API base URL
 */
export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

/**
 * API port'unu Electron'dan alır
 */
export async function initializeApiConfig(): Promise<void> {
  try {
    console.log('🔧 API config initialization starting...');
    console.log('🔧 window.electronAPI available:', !!window.electronAPI);
    
    // Electron API mevcut mu kontrol et
    if (window.electronAPI) {
      console.log('🔧 Getting port from Electron...');
      const port = await window.electronAPI.getPort();
      console.log('🔧 Electron provided port:', port);
      if (port) {
        setApiBaseUrl(port);
        console.log('🔧 API base URL set to:', getApiBaseUrl());
        
        // Health check yap
        const isHealthy = await window.electronAPI.checkPythonHealth(port);
        if (!isHealthy) {
          console.warn('⚠️ Python sunucusu henüz hazır değil');
        }
      }
    } else {
      // Development modunda (Electron dışında çalışıyorsa)
      console.log('🔧 Electron API not available, using default port 14532');
      setApiBaseUrl(14532);
    }
  } catch (error) {
    console.error('❌ API konfigürasyonu başlatılamadı:', error);
    // Varsayılan portu kullan
    console.error('🔧 Using fallback port 14532');
    setApiBaseUrl(14532);
  }
}

// TypeScript için Electron API tipi
declare global {
  interface Window {
    electronAPI?: {
      getPort: () => Promise<number>;
      checkPythonHealth: (port: number) => Promise<boolean>;
      openSecondScreen: (data: {
        cart: any[];
        total: number;
        customer: any;
      }) => Promise<{ success: boolean }>;
      platform: string;
    };
    electron?: {
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
      };
    };
  }
}


