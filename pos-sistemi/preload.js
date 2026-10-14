const { contextBridge, ipcRenderer } = require('electron');

// Renderer process'e güvenli API'ler sağla
contextBridge.exposeInMainWorld('posAPI', {
    // Database işlemleri
    initDatabase: () => ipcRenderer.invoke('database-init'),
    
    // Ürün işlemleri
    getProducts: () => ipcRenderer.invoke('get-products'),
    addProduct: (product) => ipcRenderer.invoke('add-product', product),
    updateProduct: (id, product) => ipcRenderer.invoke('update-product', id, product),
    deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),
    
    // Satış işlemleri
    getSales: () => ipcRenderer.invoke('get-sales'),
    addSale: (sale) => ipcRenderer.invoke('add-sale', sale),
    
    // Dashboard ve raporlar
    getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
    getDatabase: () => ipcRenderer.invoke('get-database'),
    
    // Kategori işlemleri
    getCategories: () => ipcRenderer.invoke('get-categories'),
    addCategory: (category) => ipcRenderer.invoke('add-category', category),
    
    // UI işlemleri
    showError: (message) => ipcRenderer.invoke('show-error', message),
    showSuccess: (message) => ipcRenderer.invoke('show-success', message),
    
    // Event listeners
    onNewSale: (callback) => ipcRenderer.on('new-sale', callback),
    onAddProduct: (callback) => ipcRenderer.on('add-product', callback),
    
    // Event listener temizleme
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
