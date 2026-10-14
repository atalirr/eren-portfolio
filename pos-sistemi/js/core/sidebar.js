// ===== SIDEBAR YÖNETİMİ - KORUNMUŞ DOSYA =====
// Bu dosya sidebar işlevlerini yönetir ve değiştirilmemelidir
// Tarih: 10.09.2025

console.log('📁 Sidebar modülü yüklendi');

// ===== SIDEBAR YÖNETİMİ SİSTEMİ =====

// Sidebar toggle - Basit ve güvenilir
function toggleSidebar() {
    console.log('🔄 Sidebar toggle ediliyor...');
    
    const sidebar = document.getElementById('sidebar');
    const main = document.querySelector('.main-content');
    
    if (!sidebar || !main) {
        console.error('❌ Sidebar veya main content bulunamadı!');
        return;
    }
    
    // Toggle collapsed class
    sidebar.classList.toggle('collapsed');
    
    // Update main content margin
    if (sidebar.classList.contains('collapsed')) {
        main.style.marginLeft = '50px';
        console.log('✅ Sidebar daraltıldı');
    } else {
        main.style.marginLeft = '200px';
        console.log('✅ Sidebar genişletildi');
    }
    
    // Save state
    try {
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed') ? '1' : '0');
    } catch (e) { 
        console.warn('⚠️ localStorage erişim hatası:', e);
    }
}

// Sidebar durumunu geri yükle
function restoreSidebarState() {
    console.log('🔄 Sidebar durumu geri yükleniyor...');
    
    try {
        const collapsed = localStorage.getItem('sidebarCollapsed') === '1';
        const sidebar = document.getElementById('sidebar');
        const main = document.querySelector('.main-content');
        
        if (!sidebar) {
            console.error('❌ Sidebar element bulunamadı');
            return;
        }
        
        if (collapsed) {
            sidebar.classList.add('collapsed');
            if (main) {
                main.style.marginLeft = '50px';
            }
            console.log('✅ Sidebar daraltılmış durumda geri yüklendi');
        } else {
            sidebar.classList.remove('collapsed');
            if (main) {
                main.style.marginLeft = '200px';
            }
            console.log('✅ Sidebar genişletilmiş durumda geri yüklendi');
        }
        
    } catch (e) { 
        console.warn('⚠️ Sidebar state restore hatası:', e);
    }
}

// Sidebar modülünü global olarak erişilebilir yap
window.toggleSidebar = toggleSidebar;
window.restoreSidebarState = restoreSidebarState;

console.log('✅ Sidebar modülü hazır');
