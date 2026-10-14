// ===== VERİTABANI İŞLEMLERİ - KORUNMUŞ DOSYA =====
// Bu dosya veritabanı CRUD işlemlerini yönetir
// Tarih: 10.09.2025

console.log('📁 Database Operations modülü yüklendi');

// ===== ÜRÜN İŞLEMLERİ =====

// Ürün ekle
async function addProduct(productData) {
    console.log('➕ Ürün ekleniyor:', productData.name);
    
    try {
        const sql = `
            INSERT INTO products (name, barcode, category_id, price, cost, stock, min_stock, description, size, brand)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            productData.name,
            productData.barcode || null,
            productData.category_id || 1,
            productData.price,
            productData.cost || 0,
            productData.stock || 0,
            productData.min_stock || 0,
            productData.description || '',
            productData.size || '',
            productData.brand || ''
        ];
        
        if (window.posAPI && window.posAPI.run) {
            const result = await window.posAPI.run(sql, params);
            console.log('✅ Ürün başarıyla eklendi, ID:', result.lastID);
            return { success: true, id: result.lastID };
        }
        
    } catch (error) {
        console.error('❌ Ürün ekleme hatası:', error);
        return { success: false, error: error.message };
    }
}

// Ürünleri getir
async function getProducts(searchTerm = '') {
    console.log('📦 Ürünler getiriliyor...');
    
    try {
        let sql = `
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id
        `;
        
        let params = [];
        
        if (searchTerm) {
            sql += ` WHERE p.name LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ?`;
            params = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];
        }
        
        sql += ` ORDER BY p.name ASC`;
        
        if (window.posAPI && window.posAPI.all) {
            const products = await window.posAPI.all(sql, params);
            console.log('✅ Ürünler getirildi:', products.length);
            return { success: true, data: products };
        }
        
    } catch (error) {
        console.error('❌ Ürün getirme hatası:', error);
        return { success: false, error: error.message };
    }
}

// Ürün güncelle
async function updateProduct(id, productData) {
    console.log('🔄 Ürün güncelleniyor:', id);
    
    try {
        const sql = `
            UPDATE products 
            SET name = ?, barcode = ?, category_id = ?, price = ?, cost = ?, 
                stock = ?, min_stock = ?, description = ?, size = ?, brand = ?, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        const params = [
            productData.name,
            productData.barcode || null,
            productData.category_id || 1,
            productData.price,
            productData.cost || 0,
            productData.stock || 0,
            productData.min_stock || 0,
            productData.description || '',
            productData.size || '',
            productData.brand || '',
            id
        ];
        
        if (window.posAPI && window.posAPI.run) {
            await window.posAPI.run(sql, params);
            console.log('✅ Ürün başarıyla güncellendi');
            return { success: true };
        }
        
    } catch (error) {
        console.error('❌ Ürün güncelleme hatası:', error);
        return { success: false, error: error.message };
    }
}

// Ürün sil
async function deleteProduct(id) {
    console.log('🗑️ Ürün siliniyor:', id);
    
    try {
        const sql = `DELETE FROM products WHERE id = ?`;
        
        if (window.posAPI && window.posAPI.run) {
            await window.posAPI.run(sql, [id]);
            console.log('✅ Ürün başarıyla silindi');
            return { success: true };
        }
        
    } catch (error) {
        console.error('❌ Ürün silme hatası:', error);
        return { success: false, error: error.message };
    }
}

// ===== SATIŞ İŞLEMLERİ =====

// Satış ekle
async function addSale(saleData) {
    console.log('🛒 Satış ekleniyor...');
    
    try {
        // Satış numarası oluştur
        const saleNumber = 'S' + Date.now();
        
        const sql = `
            INSERT INTO sales (sale_number, customer_name, customer_phone, total_amount, discount_amount, tax_amount, payment_method)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            saleNumber,
            saleData.customer_name || '',
            saleData.customer_phone || '',
            saleData.total_amount,
            saleData.discount_amount || 0,
            saleData.tax_amount || 0,
            saleData.payment_method || 'cash'
        ];
        
        if (window.posAPI && window.posAPI.run) {
            const result = await window.posAPI.run(sql, params);
            const saleId = result.lastID;
            
            // Satış detaylarını ekle
            for (const item of saleData.items) {
                await addSaleItem(saleId, item);
            }
            
            console.log('✅ Satış başarıyla eklendi, ID:', saleId);
            return { success: true, id: saleId, sale_number: saleNumber };
        }
        
    } catch (error) {
        console.error('❌ Satış ekleme hatası:', error);
        return { success: false, error: error.message };
    }
}

// Satış detayı ekle
async function addSaleItem(saleId, itemData) {
    console.log('📋 Satış detayı ekleniyor...');
    
    try {
        const sql = `
            INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            saleId,
            itemData.product_id,
            itemData.product_name,
            itemData.quantity,
            itemData.unit_price,
            itemData.total_price
        ];
        
        if (window.posAPI && window.posAPI.run) {
            await window.posAPI.run(sql, params);
            
            // Ürün stokunu güncelle
            await updateProductStock(itemData.product_id, -itemData.quantity);
        }
        
    } catch (error) {
        console.error('❌ Satış detayı ekleme hatası:', error);
    }
}

// Satışları getir
async function getSales(startDate = null, endDate = null) {
    console.log('📊 Satışlar getiriliyor...');
    
    try {
        let sql = `
            SELECT s.*, 
                   COUNT(si.id) as item_count,
                   GROUP_CONCAT(si.product_name) as products
            FROM sales s
            LEFT JOIN sale_items si ON s.id = si.sale_id
        `;
        
        let params = [];
        
        if (startDate && endDate) {
            sql += ` WHERE s.sale_date BETWEEN ? AND ?`;
            params = [startDate, endDate];
        }
        
        sql += ` GROUP BY s.id ORDER BY s.sale_date DESC`;
        
        if (window.posAPI && window.posAPI.all) {
            const sales = await window.posAPI.all(sql, params);
            console.log('✅ Satışlar getirildi:', sales.length);
            return { success: true, data: sales };
        }
        
    } catch (error) {
        console.error('❌ Satış getirme hatası:', error);
        return { success: false, error: error.message };
    }
}

// Ürün stokunu güncelle
async function updateProductStock(productId, quantityChange) {
    console.log('📦 Ürün stoku güncelleniyor:', productId);
    
    try {
        const sql = `
            UPDATE products 
            SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        if (window.posAPI && window.posAPI.run) {
            await window.posAPI.run(sql, [quantityChange, productId]);
            console.log('✅ Ürün stoku güncellendi');
        }
        
    } catch (error) {
        console.error('❌ Ürün stok güncelleme hatası:', error);
    }
}

// ===== KATEGORİ İŞLEMLERİ =====

// Kategorileri getir
async function getCategories() {
    console.log('📂 Kategoriler getiriliyor...');
    
    try {
        const sql = `SELECT * FROM categories ORDER BY name ASC`;
        
        if (window.posAPI && window.posAPI.all) {
            const categories = await window.posAPI.all(sql);
            console.log('✅ Kategoriler getirildi:', categories.length);
            return { success: true, data: categories };
        }
        
    } catch (error) {
        console.error('❌ Kategori getirme hatası:', error);
        return { success: false, error: error.message };
    }
}

// Veritabanı işlemlerini global olarak erişilebilir yap
window.addProduct = addProduct;
window.getProducts = getProducts;
window.updateProduct = updateProduct;
window.deleteProduct = deleteProduct;
window.addSale = addSale;
window.addSaleItem = addSaleItem;
window.getSales = getSales;
window.updateProductStock = updateProductStock;
window.getCategories = getCategories;

console.log('✅ Database Operations modülü hazır');

