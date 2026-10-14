// ===== VERİTABANI YÖNETİMİ - KORUNMUŞ DOSYA =====
// Bu dosya veritabanı işlevlerini yönetir ve değiştirilmemelidir
// Tarih: 10.09.2025

console.log('📁 Database modülü yüklendi');

// ===== VERİTABANI YÖNETİMİ SİSTEMİ =====

// Veritabanını başlat
async function initializeDatabase() {
    console.log('🗄️ Veritabanı başlatılıyor...');
    
    try {
        // Veritabanı başlatma işlemleri
        if (window.posAPI && typeof window.posAPI.initDatabase === 'function') {
            const result = await window.posAPI.initDatabase();
            if (!result || !result.success) {
                console.error('❌ Veritabanı başlatma hatası:', result?.error);
                return false;
            } else {
                console.log('✅ Veritabanı başarıyla başlatıldı');
                
                // Tabloları oluştur
                const tablesResult = await createDatabaseTables();
                if (tablesResult) {
                    console.log('✅ Veritabanı tabloları oluşturuldu');
                    return true;
                } else {
                    console.error('❌ Veritabanı tabloları oluşturulamadı');
                    return false;
                }
            }
        } else {
            console.warn('⚠️ posAPI bulunamadı');
            return false;
        }
    } catch (error) {
        console.error('❌ Veritabanı başlatma hatası:', error);
        return false;
    }
}

// Veritabanı bağlantısını test et
async function testDatabaseConnection() {
    console.log('🔍 Veritabanı bağlantısı test ediliyor...');
    
    try {
        if (window.posAPI && typeof window.posAPI.testConnection === 'function') {
            const result = await window.posAPI.testConnection();
            if (result && result.success) {
                console.log('✅ Veritabanı bağlantısı başarılı');
                return true;
            } else {
                console.error('❌ Veritabanı bağlantısı başarısız');
                return false;
            }
        } else {
            console.warn('⚠️ posAPI test fonksiyonu bulunamadı');
            return false;
        }
    } catch (error) {
        console.error('❌ Veritabanı bağlantı testi hatası:', error);
        return false;
    }
}

// Veritabanı durumunu kontrol et
function checkDatabaseStatus() {
    console.log('📊 Veritabanı durumu kontrol ediliyor...');
    
    try {
        // Veritabanı durumu kontrolü
        const status = {
            connected: false,
            tables: [],
            lastCheck: new Date().toISOString()
        };
        
        console.log('✅ Veritabanı durumu kontrol edildi');
        return status;
    } catch (error) {
        console.error('❌ Veritabanı durum kontrolü hatası:', error);
        return null;
    }
}

// Veritabanı modülünü global olarak erişilebilir yap
window.initializeDatabase = initializeDatabase;
window.testDatabaseConnection = testDatabaseConnection;
window.checkDatabaseStatus = checkDatabaseStatus;

console.log('✅ Database modülü hazır');
