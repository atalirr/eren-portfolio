/* ================================================================
   UstBar (TopSection).jsx — Sayfa Üst Navigasyon Çubuğu
   Arama alanı, kullanıcı profili ve "Yeni Alışkanlık" butonunu içerir.
   İstatistikler artık Hero (Özet) bölümünde yer aldığı için buradan kaldırıldı.
   ================================================================ */

import { Search, Plus } from 'lucide-react' // İkonlar
import { motion } from 'framer-motion' // Animasyonlar

/* ---- Tema Ayarları ---- */
const TemaAyarlari = {
  arkaplan: 'transparent',        // Sayfa arka planıyla bütünleşmesi için şeffaf
  kenarRengi: '#F3F4F6',          // Alt ayırıcı çizgi rengi
  vurguYesili: '#4ADE80',         // "NEW HABIT" butonu
  griMetin: '#9CA3AF',            // Başlıklar ve alt metinler
  koyuMetin: '#111827',           // Ana değerler
  acikGriMetin: '#4B5563',        // Alt etiketler
}

/* ----------------------------------------------------------------
   UstBar Bileşeni
   ---------------------------------------------------------------- */
function UstBar() {
  return (
    <div style={{ 
      display: 'flex',
      justifyContent: 'flex-end', // Sadece buton sağda
      alignItems: 'center',
      padding: '0 0 16px 0',
      marginBottom: '16px',
    }}>
      {/* New Habit Butonu */}
      <motion.button
        whileHover={{ scale: 1.05, backgroundColor: '#34d399' }}
        whileTap={{ scale: 0.95 }}
        style={{
          backgroundColor: '#4ADE80', 
          color: '#064E3B',           
          border: 'none',
          padding: '10px 22px',
          borderRadius: '12px',
          fontWeight: 800,
          fontSize: '13px',
          letterSpacing: '0.5px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 14px rgba(74, 222, 128, 0.3)',
        }}
      >
        <Plus size={18} strokeWidth={3} />
        NEW HABIT
      </motion.button>
    </div>
  )
}

export default UstBar
