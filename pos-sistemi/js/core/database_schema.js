// ===== VERİTABANI ŞEMASI - KORUNMUŞ DOSYA =====
// Bu dosya veritabanı şemasını yönetir ve değiştirilmemelidir
// Tarih: 10.09.2025

console.log('📁 Database Schema modülü yüklendi');

// ===== VERİTABANI ŞEMASI =====

// Veritabanı tablolarını oluştur
async function createDatabaseTables() {
    console.log('🗄️ Veritabanı tabloları oluşturuluyor...');
    
    try {
        // Kategoriler tablosu
        await createCategoriesTable();
        
        // Ürünler tablosu
        await createProductsTable();
        
        // Satışlar tablosu
        await createSalesTable();
        
        // Satış detayları tablosu
        await createSaleItemsTable();
        
        // Varsayılan kategorileri ekle
        await insertDefaultCategories();
        
        console.log('✅ Veritabanı tabloları başarıyla oluşturuldu');
        return true;
        
    } catch (error) {
        console.error('❌ Veritabanı tablo oluşturma hatası:', error);
        return false;
    }
}

// Kategoriler tablosu
async function createCategoriesTable() {
    console.log('📂 Kategoriler tablosu oluşturuluyor...');
    
    const sql = `
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;
    
    try {
        if (window.posAPI && window.posAPI.run) {
            await window.posAPI.run(sql);
            console.log('✅ Kategoriler tablosu oluşturuldu');
        }
    } catch (error) {
        console.error('❌ Kategoriler tablosu oluşturma hatası:', error);
    }
}

// Ürünler tablosu
async function createProductsTable() {
    console.log('📦 Ürünler tablosu oluşturuluyor...');
    
    const sql = `
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            barcode TEXT UNIQUE,
            category_id INTEGER,
            price DECIMAL(10,2) NOT NULL,
            cost DECIMAL(10,2),
            stock INTEGER DEFAULT 0,
            min_stock INTEGER DEFAULT 0,
            description TEXT,
            size TEXT,
            brand TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories (id)
        )
    `;
    
    try {
        if (window.posAPI && window.posAPI.run) {
            await window.posAPI.run(sql);
            console.log('✅ Ürünler tablosu oluşturuldu');
        }
    } catch (error) {
        console.error('❌ Ürünler tablosu oluşturma hatası:', error);
    }
}

// Satışlar tablosu
async function createSalesTable() {
    console.log('🛒 Satışlar tablosu oluşturuluyor...');
    
    const sql = `
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_number TEXT UNIQUE NOT NULL,
            customer_name TEXT,
            customer_phone TEXT,
            total_amount DECIMAL(10,2) NOT NULL,
            discount_amount DECIMAL(10,2) DEFAULT 0,
            tax_amount DECIMAL(10,2) DEFAULT 0,
            payment_method TEXT DEFAULT 'cash',
            sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;
    
    try {
        if (window.posAPI && window.posAPI.run) {
            await window.posAPI.run(sql);
            console.log('✅ Satışlar tablosu oluşturuldu');
        }
    } catch (error) {
        console.error('❌ Satışlar tablosu oluşturma hatası:', error);
    }
}

// Satış detayları tablosu
async function createSaleItemsTable() {
    console.log('📋 Satış detayları tablosu oluşturuluyor...');
    
    const sql = `
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            total_price DECIMAL(10,2) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sale_id) REFERENCES sales (id),
            FOREIGN KEY (product_id) REFERENCES products (id)
        )
    `;
    
    try {
        if (window.posAPI && window.posAPI.run) {
            await window.posAPI.run(sql);
            console.log('✅ Satış detayları tablosu oluşturuldu');
        }
    } catch (error) {
        console.error('❌ Satış detayları tablosu oluşturma hatası:', error);
    }
}

// Varsayılan kategorileri ekle
async function insertDefaultCategories() {
    console.log('📂 Varsayılan kategoriler ekleniyor...');
    
    const categories = [
        { name: 'Genel', description: 'Genel kategorisi' },
        { name: 'İlaç', description: 'İlaç kategorisi' },
        { name: 'Tıbbi Malzeme', description: 'Tıbbi malzeme kategorisi' },
        { name: 'Vitamin', description: 'Vitamin kategorisi' },
        { name: 'Kozmetik', description: 'Kozmetik kategorisi' }
    ];
    
    try {
        for (const category of categories) {
            const sql = `
                INSERT OR IGNORE INTO categories (name, description) 
                VALUES (?, ?)
            `;
            
            if (window.posAPI && window.posAPI.run) {
                await window.posAPI.run(sql, [category.name, category.description]);
            }
        }
        
        console.log('✅ Varsayılan kategoriler eklendi');
        
    } catch (error) {
        console.error('❌ Varsayılan kategoriler ekleme hatası:', error);
    }
}

// Veritabanı şemasını global olarak erişilebilir yap
window.createDatabaseTables = createDatabaseTables;
window.createCategoriesTable = createCategoriesTable;
window.createProductsTable = createProductsTable;
window.createSalesTable = createSalesTable;
window.createSaleItemsTable = createSaleItemsTable;
window.insertDefaultCategories = insertDefaultCategories;

console.log('✅ Database Schema modülü hazır');

