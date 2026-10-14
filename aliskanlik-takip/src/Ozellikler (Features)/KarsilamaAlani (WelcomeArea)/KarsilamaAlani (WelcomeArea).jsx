/* ================================================================
   PanoOzeti (DashboardHero).jsx — DARK-STITCH Yorumlaması
   ================================================================ */
import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Flame, Target, Play, Sparkles, Filter, ChevronDown
} from 'lucide-react'
import { ZAMAN_DILIMI } from '../AliskanlikListesi (HabitList)/SahteAliskanliklar (MockHabits).js'

function PanoOzeti({ gunlukOzet, sayfaDegistir, koyuMod, filtre = 'Tümü', setFiltre, aliskanliklar = [] }) {
  const [comboboxAcik, setComboboxAcik] = useState(false)
  const comboboxRef = useRef(null)
  const bugunTarih = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }).toUpperCase()

  // Combobox dışına tıklanınca kapatma
  useEffect(() => {
    function handleClickOutside(event) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target)) {
        setComboboxAcik(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtreOgeleri = [
    { id: 'Tümü', etiket: 'Tüm Rutinler', adet: aliskanliklar.length },
    { id: ZAMAN_DILIMI.SABAH, etiket: 'Sabah Rutinleri', adet: aliskanliklar.filter(a => a.zamanDilimi === ZAMAN_DILIMI.SABAH).length },
    { id: ZAMAN_DILIMI.IS, etiket: 'İş & Odak Rutinleri', adet: aliskanliklar.filter(a => a.zamanDilimi === ZAMAN_DILIMI.IS).length },
    { id: ZAMAN_DILIMI.AKSAM, etiket: 'Akşam Rutinleri', adet: aliskanliklar.filter(a => a.zamanDilimi === ZAMAN_DILIMI.AKSAM).length },
  ]

  const seciliEtiket = filtreOgeleri.find(o => o.id === filtre)?.etiket || 'Tüm Rutinler'

  const t = {
    bg: '#0C0F1A',
    kart: koyuMod ? '#141829' : '#FFFFFF',
    metin: koyuMod ? '#F1F5F9' : '#0F172A',
    alt: koyuMod ? '#94A3B8' : '#64748B',
    kenarlik: koyuMod ? '#1E2340' : '#E2E8F0',
    orange: '#F97316',
    purple: '#8B5CF6',
    subBg: koyuMod ? '#0E1117' : '#F8FAFC',
    popoverBg: koyuMod ? '#1E2340' : '#FFFFFF',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
    >
      {/* ─── 1. EN ÜST ORTADA TARİH VE GÜN BÖLÜMÜ ───────────────────────── */}
      <div style={{ textAlign: 'center', padding: '12px 0 4px 0' }}>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: 'italic',
          fontSize: '38px',
          fontWeight: 400,
          color: t.metin,
          margin: '0 0 6px 0',
          letterSpacing: '-0.5px'
        }}>
          Bugün
        </h1>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', color: t.orange, fontSize: '12px', fontWeight: 800, letterSpacing: '1.5px' }}>
          <span style={{ width: '28px', height: '1px', background: t.orange, opacity: 0.6 }} />
          <span>{bugunTarih}</span>
          <span style={{ width: '28px', height: '1px', background: t.orange, opacity: 0.6 }} />
        </div>
      </div>

      {/* ─── 2. HERO KARTLAR (2'li DARK-STITCH Grid) ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* KART 1: Bugünün İlerlemesi + Rutin Filtresi Combobox */}
        <motion.div
          whileHover={{ borderColor: '#F97316', boxShadow: '0 0 20px rgba(249, 115, 22, 0.3)' }}
          style={{
            background: t.kart,
            borderRadius: '20px',
            padding: '20px 24px',
            border: `1px solid ${t.kenarlik}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            transition: 'border-color 0.05s linear, box-shadow 0.05s linear',
            position: 'relative',
            zIndex: 50
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '64px',
              height: '56px',
              borderRadius: '16px',
              border: `2px solid ${t.orange}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: 'rgba(249, 115, 22, 0.12)',
              boxShadow: '0 0 20px rgba(249, 115, 22, 0.3)',
              padding: '0 4px'
            }}>
              <span style={{ fontSize: '18px', fontWeight: 900, color: t.orange, fontFamily: 'monospace' }}>
                {gunlukOzet?.tamamlanan ?? 3}/{gunlukOzet?.toplam ?? 5}
              </span>
            </div>
            <div>
              <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic', fontSize: '19px', fontWeight: 400, color: t.metin }}>
                Bugünün İlerlemesi
              </div>
            </div>
          </div>

          {/* Rutin Filtresi Combobox */}
          <div ref={comboboxRef} style={{ position: 'relative' }}>
            <motion.button
              whileHover={{ scale: 1.02, borderColor: t.orange }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setComboboxAcik(!comboboxAcik)}
              style={{
                background: t.subBg,
                color: t.metin,
                border: `1px solid ${comboboxAcik ? t.orange : t.kenarlik}`,
                padding: '9px 15px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: comboboxAcik ? '0 4px 18px rgba(249, 115, 22, 0.25)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Filter size={13} color={t.orange} />
              <span>{seciliEtiket}</span>
              <motion.div
                animate={{ rotate: comboboxAcik ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <ChevronDown size={13} color={t.alt} />
              </motion.div>
            </motion.button>

            {/* DÜŞEN POP-OVER MENÜ */}
            <AnimatePresence>
              {comboboxAcik && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 6, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    width: '200px',
                    background: t.popoverBg,
                    borderRadius: '16px',
                    border: `1px solid ${t.kenarlik}`,
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
                    padding: '8px',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {filtreOgeleri.map((o) => {
                    const secili = filtre === o.id
                    return (
                      <motion.div
                        key={o.id}
                        whileHover={{ 
                          backgroundColor: koyuMod ? 'rgba(249, 115, 22, 0.18)' : '#FFF7ED', 
                          scale: 1.015 
                        }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => {
                          setFiltre?.(o.id)
                          setComboboxAcik(false)
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          backgroundColor: secili ? (koyuMod ? 'rgba(249, 115, 22, 0.15)' : '#FFEDD5') : 'transparent',
                          color: secili ? t.orange : t.metin,
                          fontSize: '12px',
                          fontWeight: secili ? 800 : 600,
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <span>{o.etiket}</span>
                        <span style={{ 
                          fontSize: '11px', 
                          opacity: 0.6,
                          background: secili ? t.orange : (koyuMod ? '#0E1117' : '#E2E8F0'),
                          color: secili ? '#FFFFFF' : t.metin,
                          padding: '2px 8px',
                          borderRadius: '100px',
                          fontFamily: 'monospace',
                        }}>
                          {o.adet}
                        </span>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* KART 2: Derin Çalışma Kartı */}
        <motion.div
          whileHover={{ borderColor: '#F97316', boxShadow: '0 0 20px rgba(249, 115, 22, 0.3)' }}
          style={{
            background: t.kart,
            borderRadius: '20px',
            padding: '24px',
            border: `1px solid ${t.kenarlik}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            transition: 'border-color 0.05s linear, box-shadow 0.05s linear'
          }}
        >
          <div>
            <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic', fontSize: '20px', color: t.orange }}>
              Derin Çalışma
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: t.metin, marginTop: '4px', fontFamily: 'monospace' }}>
              2s 15dk
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => sayfaDegistir?.('odak')}
            style={{
              background: 'linear-gradient(135deg, #F97316, #EA580C)',
              color: '#FFFFFF',
              border: 'none',
              height: '42px',
              padding: '0 20px',
              borderRadius: '14px',
              fontSize: '12px',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(249, 115, 22, 0.35)',
              letterSpacing: '0.5px'
            }}
          >
            <Play size={14} fill="#FFFFFF" />
            OTURUM BAŞLAT
          </motion.button>
        </motion.div>

      </div>
    </motion.div>
  )
}

export default PanoOzeti
