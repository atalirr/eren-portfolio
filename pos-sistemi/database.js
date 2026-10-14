const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, 'pos_database.db');
        this.db = null;
    }

    // Veritabanını başlat
    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Database connection error:', err);
                    reject(err);
                    return;
                }
                console.log('Database connected successfully');
                this.createTables().then(resolve).catch(reject);
            });
        });
    }

    // Tabloları oluştur
    async createTables() {
        const queries = [
            // Ürünler tablosu - Beden sütunu eklendi, barkod unique yapıldı
            `CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                barcode TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                brand TEXT NOT NULL,
                category TEXT NOT NULL,
                size TEXT DEFAULT '',
                stock INTEGER DEFAULT 0,
                min_stock INTEGER DEFAULT 0,
                purchase_price REAL NOT NULL,
                sale_price REAL NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Satışlar tablosu
            `CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_no TEXT UNIQUE NOT NULL,
                customer_name TEXT,
                total_amount REAL NOT NULL,
                payment_method TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Satış detayları tablosu - Beden sütunu eklendi
            `CREATE TABLE IF NOT EXISTS sale_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER NOT NULL,
                barcode TEXT NOT NULL,
                name TEXT NOT NULL,
                brand TEXT,
                category TEXT,
                size TEXT DEFAULT '',
                quantity INTEGER NOT NULL,
                unit_price REAL NOT NULL,
                purchase_price REAL NOT NULL,
                total_price REAL NOT NULL,
                profit REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE
            )`,
            
            // Kategoriler tablosu
            `CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                color TEXT DEFAULT '#3498db',
                icon TEXT DEFAULT 'fas fa-box',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const query of queries) {
            await this.run(query);
        }

        // Varsayılan kategorileri ekle
        await this.insertDefaultCategories();
        
        console.log('Database tables created successfully');
    }

    // Varsayılan kategorileri ekle
    async insertDefaultCategories() {
        const defaultCategories = [
            ['Elektronik', '#e74c3c', 'fas fa-mobile-alt'],
            ['Giyim', '#3498db', 'fas fa-tshirt'],
            ['Ev & Yaşam', '#2ecc71', 'fas fa-home'],
            ['Spor', '#f39c12', 'fas fa-dumbbell'],
            ['Kitap', '#9b59b6', 'fas fa-book'],
            ['Kozmetik', '#e91e63', 'fas fa-spa'],
            ['Sağlık', '#00bcd4', 'fas fa-heartbeat'],
            ['Oyuncak', '#ff9800', 'fas fa-gamepad'],
            ['Diğer', '#607d8b', 'fas fa-box']
        ];

        for (const category of defaultCategories) {
            await this.run(
                'INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)',
                category
            );
        }
    }

    // Genel query çalıştır
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('Database run error:', err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    // Tek satır getir
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('Database get error:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Çoklu satır getir
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Database all error:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Ürün işlemleri
    async getProducts() {
        return await this.all('SELECT * FROM products ORDER BY created_at DESC');
    }

    async getProductByBarcode(barcode) {
        return await this.get('SELECT * FROM products WHERE barcode = ?', [barcode]);
    }

    async addProduct(product) {
        try {
            const result = await this.run(
                `INSERT INTO products (barcode, name, brand, category, size, stock, min_stock, purchase_price, sale_price, description)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    product.barcode,
                    product.name,
                    product.brand,
                    product.category,
                    product.size || '',
                    product.stock || 0,
                    product.minStock || 0,
                    product.purchasePrice,
                    product.salePrice,
                    product.description || ''
                ]
            );
            console.log('Ürün başarıyla eklendi:', product.name);
            return result;
        } catch (error) {
            console.error('Ürün ekleme hatası:', error);
            throw error;
        }
    }

    async updateProduct(id, product) {
        try {
            const result = await this.run(
                `UPDATE products SET 
                 barcode = ?, name = ?, brand = ?, category = ?, size = ?, stock = ?, 
                 min_stock = ?, purchase_price = ?, sale_price = ?, description = ?, 
                 updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    product.barcode,
                    product.name,
                    product.brand,
                    product.category,
                    product.size || '',
                    product.stock || 0,
                    product.minStock || 0,
                    product.purchasePrice,
                    product.salePrice,
                    product.description || '',
                    id
                ]
            );
            console.log('Ürün başarıyla güncellendi:', product.name);
            return result;
        } catch (error) {
            console.error('Ürün güncelleme hatası:', error);
            throw error;
        }
    }

    async updateProductStock(barcode, newStock) {
        try {
            const result = await this.run(
                'UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE barcode = ?',
                [newStock, barcode]
            );
            console.log(`Stok güncellendi: ${barcode} -> ${newStock}`);
            return result;
        } catch (error) {
            console.error('Stok güncelleme hatası:', error);
            throw error;
        }
    }

    async deleteProduct(id) {
        try {
            const result = await this.run('DELETE FROM products WHERE id = ?', [id]);
            console.log('Ürün başarıyla silindi, ID:', id);
            return result;
        } catch (error) {
            console.error('Ürün silme hatası:', error);
            throw error;
        }
    }

    // Satış işlemleri
    async getSales() {
        try {
            const sales = await this.all('SELECT * FROM sales ORDER BY created_at DESC');
            
            // Her satış için detayları getir
            for (const sale of sales) {
                const items = await this.all(
                    'SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id',
                    [sale.id]
                );
                sale.items = items;
            }
            
            console.log(`${sales.length} satış veritabanından yüklendi`);
            return sales;
        } catch (error) {
            console.error('Satışları getirme hatası:', error);
            throw error;
        }
    }

    async addSale(sale) {
        try {
            // Ana satış kaydını ekle
            const saleResult = await this.run(
                `INSERT INTO sales (sale_no, customer_name, total_amount, payment_method)
                 VALUES (?, ?, ?, ?)`,
                [
                    sale.sale_no,
                    sale.customer_name || '',
                    sale.total_amount,
                    sale.payment_method
                ]
            );
            
            console.log('Ana satış kaydı eklendi, ID:', saleResult.id);
            
            // Satış detaylarını ekle
            for (const item of sale.items) {
                const profit = (item.price * item.quantity) - (item.purchasePrice * item.quantity);
                await this.run(
                    `INSERT INTO sale_items (sale_id, barcode, name, brand, category, size, quantity, unit_price, purchase_price, total_price, profit)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        saleResult.id,
                        item.barcode,
                        item.name,
                        item.brand || '',
                        item.category || '',
                        item.size || '',
                        item.quantity,
                        item.price,
                        item.purchasePrice,
                        item.price * item.quantity,
                        profit
                    ]
                );
                
                // Ürün stoğunu güncelle
                await this.updateProductStock(item.barcode, item.newStock || 0);
            }
            
            console.log('Satış detayları eklendi');
            return saleResult;
        } catch (error) {
            console.error('Satış ekleme hatası:', error);
            throw error;
        }
    }

    async deleteSale(saleId) {
        try {
            // Önce satış detaylarını sil
            await this.run('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);
            // Sonra ana satış kaydını sil
            const result = await this.run('DELETE FROM sales WHERE id = ?', [saleId]);
            console.log('Satış başarıyla silindi, ID:', saleId);
            return result;
        } catch (error) {
            console.error('Satış silme hatası:', error);
            throw error;
        }
    }

    // Kategori işlemleri
    async getCategories() {
        return await this.all('SELECT * FROM categories ORDER BY name');
    }

    async addCategory(category) {
        const result = await this.run(
            'INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)',
            [category.name, category.color || '#3498db', category.icon || 'fas fa-box']
        );
        return result;
    }

    // Dashboard istatistikleri
    async getDashboardStats() {
        const stats = {};
        
        try {
            // Haftalık satış
            const weeklySales = await this.get(`
                SELECT SUM(total_amount) as total
                FROM sales
                WHERE created_at >= datetime('now', '-7 days')
            `);
            stats.weeklyRevenue = weeklySales?.total || 0;
            
            // Haftalık satış sayısı
            const weeklyOrders = await this.get(`
                SELECT COUNT(*) as count
                FROM sales 
                WHERE created_at >= datetime('now', '-7 days')
            `);
            stats.weeklyOrders = weeklyOrders?.count || 0;
            
            // Toplam ürün sayısı
            const totalProducts = await this.get('SELECT COUNT(*) as count FROM products');
            stats.totalProducts = totalProducts?.count || 0;
            
            // Toplam stok değeri
            const stockValue = await this.get(`
                SELECT SUM(stock * purchase_price) as value
                FROM products
            `);
            stats.stockValue = stockValue?.value || 0;
            
            // Stoğu biten ürünler
            const outOfStock = await this.get(`
                SELECT COUNT(*) as count
                FROM products
                WHERE stock = 0
            `);
            stats.outOfStock = outOfStock?.count || 0;
            
            console.log('Dashboard istatistikleri yüklendi');
            return stats;
        } catch (error) {
            console.error('Dashboard istatistikleri yükleme hatası:', error);
            return stats;
        }
    }

    // Veritabanını kapat
    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Database close error:', err);
                        reject(err);
                    } else {
                        console.log('Database closed successfully');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = Database;
