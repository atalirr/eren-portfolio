import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Zap, Clock, Trophy, Target, TrendingUp, Flame, Activity, Award
} from 'lucide-react'

/* ================================================================
   DashboardEkstralar.jsx — Gerçek Veriye Dayalı KPI Kartları
   4 adet animasyonlu istatistik kartı + genel performans özeti.
   Artık tüm veriler dinamikOzet prop'undan geliyor (sahte değil).
   ================================================================ */

/* ---- Animasyonlu sayaç hook'u ---- */
function useAnimatedCounter(hedef, sure = 1500) {
  const [deger, setDeger] = useState(0)
  useEffect(() => {
    if (hedef === 0) { setDeger(0); return }
    let baslangic = 0
    const adim = hedef / (sure / 16)
    const id = setInterval(() => {
      baslangic += adim
      if (baslangic >= hedef) {
        setDeger(hedef)
        clearInterval(id)
      } else {
        setDeger(Math.round(baslangic))
      }
    }, 16)
    return () => clearInterval(id)
  }, [hedef, sure])
  return deger
}

function DashboardEkstralar({ koyuMod, sayfaDegistir, dinamikOzet, aliskanliklar }) {
  /* ---- Veriler ---- */
  const yuzde = dinamikOzet?.yuzde ?? 0
  const tamamlanan = dinamikOzet?.tamamlanan ?? 0
  const toplam = dinamikOzet?.toplamAliskanlik ?? 0
  const maksimumSeri = dinamikOzet?.maksimumSeri ?? 0
  const haftalikDisiplin = dinamikOzet?.haftalikDisiplin ?? 0
  const ustalikPuani = dinamikOzet?.ustalikPuani ?? 0

  /* Animasyonlu sayaçlar */
  const animYuzde = useAnimatedCounter(yuzde)
  const animSeri = useAnimatedCounter(maksimumSeri)
  const animDisiplin = useAnimatedCounter(haftalikDisiplin)
  const animPuan = useAnimatedCounter(ustalikPuani, 2000)

  /* ---- Tema ---- */
  const tema = {
    kart: koyuMod ? '#1E293B' : '#FFFFFF',
    baslik: koyuMod ? '#F1F5F9' : '#1E293B',
    altMetin: koyuMod ? '#94A3B8' : '#64748B',
    kenarlik: koyuMod ? '#334155' : '#F1F5F9',
    subBg: koyuMod ? '#0F172A' : '#F8FAFC',
  }

  /* ---- KPI kart verileri ---- */
  const kartlar = [
    {
      baslik: 'Tamamlama',
      deger: `${animYuzde}%`,
      altMetin: `${tamamlanan}/${toplam} alışkanlık`,
      ikon: Target,
      ikonRenk: '#6366F1',
      ikonBg: koyuMod ? '#6366F118' : '#EEF2FF',
      vurguRenk: '#6366F1',
      gradyan: 'linear-gradient(135deg, #6366F115, #8B5CF610)',
    },
    {
      baslik: 'En Uzun Seri',
      deger: `${animSeri}`,
      altMetin: 'gün aralıksız',
      ikon: Flame,
      ikonRenk: '#F59E0B',
      ikonBg: koyuMod ? '#F59E0B18' : '#FFFBEB',
      vurguRenk: '#F59E0B',
      gradyan: 'linear-gradient(135deg, #F59E0B10, #F97316A8)',
    },
    {
      baslik: 'Haftalık Disiplin',
      deger: `${animDisiplin}%`,
      altMetin: 'son 7 günlük ort.',
      ikon: TrendingUp,
      ikonRenk: '#10B981',
      ikonBg: koyuMod ? '#10B98118' : '#ECFDF5',
      vurguRenk: '#10B981',
      gradyan: 'linear-gradient(135deg, #10B98110, #059669A8)',
    },
    {
      baslik: 'Ustalık Puanı',
      deger: `${animPuan}`,
      altMetin: 'toplam XP',
      ikon: Award,
      ikonRenk: '#8B5CF6',
      ikonBg: koyuMod ? '#8B5CF618' : '#F5F3FF',
      vurguRenk: '#8B5CF6',
      gradyan: 'linear-gradient(135deg, #8B5CF610, #7C3AEDA8)',
    },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '20px',
    }}>
      {kartlar.map((kart, i) => {
        const Ikon = kart.ikon
        return (
          <motion.div
            key={kart.baslik}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
            whileHover={{ y: -2, borderColor: kart.vurguRenk + '40', boxShadow: `0 10px 24px ${kart.vurguRenk}10` }}
            style={{
              background: tema.kart,
              borderRadius: '24px',
              padding: '24px',
              border: `1px solid ${tema.kenarlik}`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              cursor: 'default',
              position: 'relative',
              overflow: 'hidden',
              transition: 'box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease',
            }}
          >
            {/* Arka plan gradyanı */}
            <div style={{
              position: 'absolute', top: 0, right: 0, width: '120px', height: '120px',
              background: kart.gradyan, borderRadius: '0 24px 0 100%',
              opacity: 0.6,
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* İkon */}
              <div style={{
                width: '44px', height: '44px', borderRadius: '14px',
                background: kart.ikonBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '16px',
              }}>
                <Ikon size={20} color={kart.ikonRenk} />
              </div>

              {/* Başlık */}
              <div style={{ fontSize: '12px', fontWeight: 700, color: tema.altMetin, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                {kart.baslik}
              </div>

              {/* Değer */}
              <div style={{ fontSize: '28px', fontWeight: 900, color: tema.baslik, letterSpacing: '-1px', marginBottom: '4px', lineHeight: 1 }}>
                {kart.deger}
              </div>

              {/* Alt metin */}
              <div style={{ fontSize: '12px', fontWeight: 600, color: tema.altMetin }}>
                {kart.altMetin}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

export default DashboardEkstralar
