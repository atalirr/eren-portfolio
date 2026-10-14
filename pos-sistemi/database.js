const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, 'pos_database.db');
        this.db = null;
    }

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

    async createTables() {
        const queries = [
            CREATE TABLE IF NOT EXISTS products (
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
            ),
            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_no TEXT UNIQUE,
                customer_name TEXT,
                total_amount REAL NOT NULL,
                payment_method TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ),
            CREATE TABLE IF NOT EXISTS sale_items (
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
            ),
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                color TEXT DEFAULT '#3498db',
                icon TEXT DEFAULT 'fas fa-box',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ];

        for (const query of queries) {
            await this.run(query);
        }

        await this.insertDefaultCategories();
        console.log('Database tables created successfully');
    }

    async insertDefaultCategories() {
        const defaultCategories = [
            ['Genel', '#607d8b', 'fas fa-box'],
            ['Elektronik', '#e74c3c', 'fas fa-mobile-alt'],
            ['Giyim', '#3498db', 'fas fa-tshirt'],
            ['Ev & Yaþam', '#2ecc71', 'fas fa-home'],
            ['Spor', '#f39c12', 'fas fa-dumbbell'],
            ['Kitap', '#9b59b6', 'fas fa-book'],
            ['Kozmetik', '#e91e63', 'fas fa-spa'],
            ['Saðlýk', '#00bcd4', 'fas fa-heartbeat'],
            ['Oyuncak', '#ff9800', 'fas fa-gamepad'],
            ['Diðer', '#607d8b', 'fas fa-box']
        ];

        for (const category of defaultCategories) {
            await this.run('INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)', category);
        }
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    console.error('Database run error:', err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

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

    async getProducts() {
        const sql = 
            SELECT
                id,
                barcode,
                name,
                brand,
                category AS category_name,
                size,
                stock,
                min_stock,
                purchase_price AS cost,
                sale_price AS price,
                description,
                created_at,
                updated_at
            FROM products
            ORDER BY created_at DESC;
        return await this.all(sql);
    }

    async getProductByBarcode(barcode) {
        return await this.get('SELECT * FROM products WHERE barcode = ?', [barcode]);
    }

    async addProduct(product) {
        try {
            const brand = product.brand || '';
            const size = product.size || '';
            const stock = Number(product.stock ?? 0) || 0;
            const minStock = Number((product.min_stock ?? product.minStock) ?? 0) || 0;

            const purchasePrice = Number(product.purchase_price ?? product.cost ?? product.purchasePrice ?? 0) || 0;
            const salePrice = Number(product.sale_price ?? product.price ?? product.salePrice ?? 0) || 0;

            let categoryName = product.category || '';
            if (!categoryName && product.category_id) {
                const cat = await this.get('SELECT name FROM categories WHERE id = ?', [product.category_id]);
                categoryName = cat?.name || '';
            }
            if (!categoryName) {
                const general = await this.get("SELECT name FROM categories WHERE name = 'Genel'");
                if (!general) {
                    await this.run('INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)', ['Genel', '#607d8b', 'fas fa-box']);
                }
                categoryName = 'Genel';
            }

            const result = await this.run(
                INSERT INTO products (barcode, name, brand, category, size, stock, min_stock, purchase_price, sale_price, description)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
                [
                    product.barcode || '',
                    product.name,
                    brand,
                    categoryName,
                    size,
                    stock,
                    minStock,
                    purchasePrice,
                    salePrice,
                    product.description || ''
                ]
            );
            console.log('Ürün baþarýyla eklendi:', product.name);
            return result;
        } catch (error) {
            console.error('Ürün ekleme hatasý:', error);
            throw error;
        }
    }

    async updateProduct(id, product) {
        try {
            const brand = product.brand || '';
            const size = product.size || '';
            const stock = Number(product.stock ?? 0) || 0;
            const minStock = Number((product.min_stock ?? product.minStock) ?? 0) || 0;
            const purchasePrice = Number(product.purchase_price ?? product.cost ?? product.purchasePrice ?? 0) || 0;
            const salePrice = Number(product.sale_price ?? product.price ?? product.salePrice ?? 0) || 0;

            let categoryName = product.category || '';
            if (!categoryName && product.category_id) {
                const cat = await this.get('SELECT name FROM categories WHERE id = ?', [product.category_id]);
                categoryName = cat?.name || '';
            }
            if (!categoryName) {
                categoryName = 'Genel';
            }

            const result = await this.run(
                UPDATE products SET
                 barcode = ?, name = ?, brand = ?, category = ?, size = ?, stock = ?,
                 min_stock = ?, purchase_price = ?, sale_price = ?, description = ?,
                 updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?,
                [
                    product.barcode || '',
                    product.name,
                    brand,
                    categoryName,
                    size,
                    stock,
                    minStock,
                    purchasePrice,
                    salePrice,
                    product.description || '',
                    id
                ]
            );
            console.log('Ürün baþarýyla güncellendi:', product.name);
            return result;
        } catch (error) {
            console.error('Ürün güncelleme hatasý:', error);
            throw error;
        }
    }

    async updateProductStock(barcode, newStock) {
        try {
            const result = await this.run('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE barcode = ?', [newStock, barcode]);
            console.log(Stok güncellendi:  -> );
            return result;
        } catch (error) {
            console.error('Stok güncelleme hatasý:', error);
            throw error;
        }
    }

    async deleteProduct(id) {
        try {
            const result = await this.run('DELETE FROM products WHERE id = ?', [id]);
            console.log('Ürün baþarýyla silindi, ID:', id);
            return result;
        } catch (error) {
            console.error('Ürün silme hatasý:', error);
            throw error;
        }
    }

    async getSales() {
        try {
            const sales = await this.all('SELECT * FROM sales ORDER BY created_at DESC');
            for (const sale of sales) {
                const items = await this.all('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id', [sale.id]);
                sale.items = items;
            }
            console.log(${sales.length} satýþ veritabanýndan yüklendi);
            return sales;
        } catch (error) {
            console.error('Satýþlarý getirme hatasý:', error);
            throw error;
        }
    }

    async addSale(sale) {
        try {
            const saleResult = await this.run(
                INSERT INTO sales (sale_no, customer_name, total_amount, payment_method)
                 VALUES (?, ?, ?, ?),
                [
                    sale.sale_no || null,
                    sale.customer_name || '',
                    Number(sale.total_amount ?? sale.total ?? 0) || 0,
                    sale.payment_method || 'cash'
                ]
            );

            for (const item of (sale.items || [])) {
                const qty = Number(item.quantity || 0) || 0;
                const unitPrice = Number(item.unit_price ?? item.price ?? 0) || 0;
                const purchase = Number(item.purchase_price ?? item.purchasePrice ?? 0) || 0;
                const total = unitPrice * qty;
                const profit = total - (purchase * qty);

                await this.run(
                    INSERT INTO sale_items (sale_id, barcode, name, brand, category, size, quantity, unit_price, purchase_price, total_price, profit)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
                    [
                        saleResult.id,
                        item.barcode || '',
                        item.name || '',
                        item.brand || '',
                        item.category || '',
                        item.size || '',
                        qty,
                        unitPrice,
                        purchase,
                        total,
                        profit
                    ]
                );

                if (item.barcode && typeof item.newStock !== 'undefined') {
                    await this.updateProductStock(item.barcode, item.newStock);
                }
            }

            console.log('Satýþ detaylarý eklendi');
            return saleResult;
        } catch (error) {
            console.error('Satýþ ekleme hatasý:', error);
            throw error;
        }
    }

    async deleteSale(saleId) {
        try {
            await this.run('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);
            const result = await this.run('DELETE FROM sales WHERE id = ?', [saleId]);
            console.log('Satýþ baþarýyla silindi, ID:', saleId);
            return result;
        } catch (error) {
            console.error('Satýþ silme hatasý:', error);
            throw error;
        }
    }

    async getCategories() {
        return await this.all('SELECT * FROM categories ORDER BY name');
    }

    async addCategory(category) {
        const result = await this.run('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)', [category.name, category.color || '#3498db', category.icon || 'fas fa-box']);
        return result;
    }

    async getDashboardStats() {
        const stats = {};
        try {
            const weeklySales = await this.get(
                SELECT SUM(total_amount) as total
                FROM sales
                WHERE created_at >= datetime('now', '-7 days')
            );
            stats.weeklyRevenue = weeklySales?.total || 0;

            const weeklyOrders = await this.get(
                SELECT COUNT(*) as count
                FROM sales
                WHERE created_at >= datetime('now', '-7 days')
            );
            stats.weeklyOrders = weeklyOrders?.count || 0;

            const totalProducts = await this.get('SELECT COUNT(*) as count FROM products');
            stats.totalProducts = totalProducts?.count || 0;

            const stockValue = await this.get(
                SELECT SUM(stock * purchase_price) as value
                FROM products
            );
            stats.stockValue = stockValue?.value || 0;

            const outOfStock = await this.get(
                SELECT COUNT(*) as count
                FROM products
                WHERE stock = 0
            );
            stats.outOfStock = outOfStock?.count || 0;

            console.log('Dashboard istatistikleri yüklendi');
            return stats;
        } catch (error) {
            console.error('Dashboard istatistikleri yükleme hatasý:', error);
            return stats;
        }
    }

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