/**
 * Electron API Type Definitions
 */

interface ElectronAPI {
  getPort: () => Promise<number>;
  checkPythonHealth: (port: number) => Promise<boolean>;
  openSecondScreen: (data: {
    cart: any[];
    total: number;
    customer: any;
  }) => Promise<{ success: boolean }>;
  platform: string;
}

interface ElectronIPC {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

interface Window {
  electronAPI?: ElectronAPI;
  electron?: {
    ipcRenderer: ElectronIPC;
  };
}





















