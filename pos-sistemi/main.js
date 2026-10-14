const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const Database = require('./database');

let mainWindow;
let db;

// Ana pencereyi oluştur
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            enableRemoteModule: false,
            webSecurity: true
        },
        icon: path.join(__dirname, 'assets/icon.ico'),
        title: 'ATLI Medikal POS Sistemi',
        show: false,
        frame: true,
        titleBarStyle: 'default'
    });

    // Ana sayfayı yükle
    mainWindow.loadFile('index.html');

    // Pencere hazır olduğunda göster
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Geliştirme modunda DevTools aç
        if (process.argv.includes('--dev')) {
            mainWindow.webContents.openDevTools();
        }
    });

    // Pencere kapatıldığında
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Menü oluştur
    createMenu();
}

// Menü oluştur
function createMenu() {
    const template = [
        {
            label: 'Dosya',
            submenu: [
                {
                    label: 'Yeni Satış',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.send('new-sale');
                    }
                },
                {
                    label: 'Ürün Ekle',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: () => {
                        mainWindow.webContents.send('add-product');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Çıkış',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Görünüm',
            submenu: [
                { role: 'reload', label: 'Yenile' },
                { role: 'forceReload', label: 'Zorla Yenile' },
                { role: 'toggleDevTools', label: 'Geliştirici Araçları' },
                { type: 'separator' },
                { role: 'resetZoom', label: 'Yakınlaştırmayı Sıfırla' },
                { role: 'zoomIn', label: 'Yakınlaştır' },
                { role: 'zoomOut', label: 'Uzaklaştır' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Tam Ekran' }
            ]
        },
        {
            label: 'Yardım',
            submenu: [
                {
                    label: 'Hakkında',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'ATLI Medikal POS',
                            message: 'ATLI Medikal POS Sistemi',
                            detail: 'Versiyon 1.0.0\nModern Point of Sale Uygulaması'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('database-init', async () => {
    try {
        db = new Database();
        await db.initialize();
        return { success: true };
    } catch (error) {
        console.error('Database init error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-products', async () => {
    try {
        return await db.getProducts();
    } catch (error) {
        console.error('Get products error:', error);
        throw error;
    }
});

ipcMain.handle('add-product', async (event, product) => {
    try {
        return await db.addProduct(product);
    } catch (error) {
        console.error('Add product error:', error);
        throw error;
    }
});

ipcMain.handle('update-product', async (event, id, product) => {
    try {
        return await db.updateProduct(id, product);
    } catch (error) {
        console.error('Update product error:', error);
        throw error;
    }
});

ipcMain.handle('delete-product', async (event, id) => {
    try {
        return await db.deleteProduct(id);
    } catch (error) {
        console.error('Delete product error:', error);
        throw error;
    }
});

ipcMain.handle('get-sales', async () => {
    try {
        return await db.getSales();
    } catch (error) {
        console.error('Get sales error:', error);
        throw error;
    }
});

ipcMain.handle('add-sale', async (event, sale) => {
    try {
        return await db.addSale(sale);
    } catch (error) {
        console.error('Add sale error:', error);
        throw error;
    }
});

ipcMain.handle('get-dashboard-stats', async () => {
    try {
        return await db.getDashboardStats();
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        throw error;
    }
});

ipcMain.handle('get-database', async () => {
    try {
        return db;
    } catch (error) {
        console.error('Get database error:', error);
        throw error;
    }
});

ipcMain.handle('get-categories', async () => {
    try {
        return await db.getCategories();
    } catch (error) {
        console.error('Get categories error:', error);
        throw error;
    }
});

ipcMain.handle('add-category', async (event, category) => {
    try {
        return await db.addCategory(category);
    } catch (error) {
        console.error('Add category error:', error);
        throw error;
    }
});

ipcMain.handle('show-error', async (event, message) => {
    dialog.showErrorBox('Hata', message);
});

ipcMain.handle('show-success', async (event, message) => {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Başarılı',
        message: message
    });
});

// App events
app.whenReady().then(async () => {
    try {
        // Önce veritabanını başlat
        console.log('Veritabanı başlatılıyor...');
        db = new Database();
        await db.initialize();
        console.log('Veritabanı başarıyla başlatıldı');
        
        // Sonra pencereyi oluştur
        createWindow();
    } catch (error) {
        console.error('App initialization error:', error);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', async () => {
    if (db) {
        await db.close();
    }
});
