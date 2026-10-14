/* ================================================================
   AliskanlikListesi (HabitList).jsx — DARK-STITCH Yorumlaması
   ================================================================ */
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { 
  Check, FileText, ChevronDown, Filter, CheckCircle2, Trash2
} from 'lucide-react'
import { DURUM, ZAMAN_DILIMI } from './SahteAliskanliklar (MockHabits).js'

export default function AliskanlikListesi({ aliskanliklar, setAliskanliklar, koyuMod, sayfaDegistir, filtre: propFiltre, setFiltre: propSetFiltre, silAliskanlik }) {
  const [icFiltre, setIcFiltre] = useState('Tümü')
  const filtre = propFiltre !== undefined ? propFiltre : icFiltre
  const setFiltre = propSetFiltre || setIcFiltre
  const [comboboxAcik, setComboboxAcik] = useState(false)
  const [acikNotId, setAcikNotId] = useState(null)
  const comboboxRef = useRef(null)

  const t = {
    bg: '#0C0F1A',
    kart: koyuMod ? '#141829' : '#FFFFFF',
    icKart: koyuMod ? '#0E1117' : '#F8FAFC',
    metin: koyuMod ? '#F1F5F9' : '#0F172A',
    alt: koyuMod ? '#94A3B8' : '#64748B',
    kenarlik: koyuMod ? '#1E2340' : '#E2E8F0',
    orange: '#F97316',
    purple: '#8B5CF6',
    emerald: '#10B981',
    popoverBg: koyuMod ? '#1E2340' : '#FFFFFF',
  }

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

  const confettiPatlat = () => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#F97316', '#8B5CF6', '#10B981', '#EC4899'],
    })
  }

  function durumuGuncelle(id, yeniDurum, e) {
    e.stopPropagation()
    if (yeniDurum === DURUM.TAMAMLANDI) confettiPatlat()
    setAliskanliklar(onceki =>
      onceki.map(a => {
        if (a.id !== id) return a
        let yeniSeri = a.seri
        if (yeniDurum === DURUM.TAMAMLANDI) yeniSeri = a.seri + 1
        if (yeniDurum === DURUM.BEKLEMEDE && a.durum === DURUM.TAMAMLANDI) yeniSeri = Math.max(0, a.seri - 1)
        return { ...a, durum: yeniDurum, seri: yeniSeri }
      })
    )
  }

  const toggleNot = (id, e) => {
    e.stopPropagation()
    setAcikNotId(acikNotId === id ? null : id)
  }

  const filtrelenmis = useMemo(() => {
    if (filtre === 'Tümü') return aliskanliklar
    return aliskanliklar.filter(a => a.zamanDilimi === filtre)
  }, [aliskanliklar, filtre])

  const tamamlananSayisi = filtrelenmis.filter(a => a.durum === DURUM.TAMAMLANDI).length

  // Filtre seçenekleri
  const filtreOgeleri = [
    { id: 'Tümü', etiket: 'Tüm Rutinler', adet: aliskanliklar.length },
    { id: ZAMAN_DILIMI.SABAH, etiket: 'Sabah Rutinleri', adet: aliskanliklar.filter(a => a.zamanDilimi === ZAMAN_DILIMI.SABAH).length },
    { id: ZAMAN_DILIMI.IS, etiket: 'İş & Odak Rutinleri', adet: aliskanliklar.filter(a => a.zamanDilimi === ZAMAN_DILIMI.IS).length },
    { id: ZAMAN_DILIMI.AKSAM, etiket: 'Akşam Rutinleri', adet: aliskanliklar.filter(a => a.zamanDilimi === ZAMAN_DILIMI.AKSAM).length },
  ]

  const seciliEtiket = filtreOgeleri.find(o => o.id === filtre)?.etiket || 'Tüm Rutinler'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ─── ALIŞKANLIK LİSTESİ ────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <AnimatePresence mode="popLayout">
          {filtrelenmis.map((a) => {
            const tamam = a.durum === DURUM.TAMAMLANDI
            const notVar = Boolean(a.not)
            const notAcik = acikNotId === a.id

            return (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                whileHover={{ 
                  y: -2,
                  borderColor: koyuMod ? '#2A3055' : '#CBD5E1', 
                  boxShadow: koyuMod ? '0 12px 30px rgba(0,0,0,0.35)' : '0 8px 24px rgba(0,0,0,0.08)' 
                }}
                whileTap={{ scale: 0.995 }}
                transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                style={{
                  background: t.kart,
                  borderRadius: '20px',
                  border: `1px solid ${t.kenarlik}`,
                  overflow: 'hidden',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Ana Satır */}
                <div 
                  onClick={(e) => durumuGuncelle(a.id, tamam ? DURUM.BEKLEMEDE : DURUM.TAMAMLANDI, e)}
                  style={{
                    padding: '20px 26px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  {/* Sol: Check Dairesi & İsim & Not Butonu */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                    {/* Check Dairesi */}
                    <motion.div 
                      whileTap={{ scale: 0.88 }}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: tamam ? 'linear-gradient(135deg, #10B981, #059669)' : 'transparent',
                        border: tamam ? '2px solid #10B981' : `2px solid ${t.alt}`,
                        boxShadow: tamam ? '0 0 12px rgba(16, 185, 129, 0.45)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        flexShrink: 0,
                      }}
                    >
                      {tamam && <Check size={15} color="#FFFFFF" strokeWidth={3.5} />}
                    </motion.div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      {/* Başlık */}
                      <span style={{
                        fontSize: '16px',
                        fontWeight: 800,
                        color: tamam ? '#10B981' : t.metin,
                        letterSpacing: '-0.2px',
                        transition: 'color 0.2s ease',
                      }}>
                        {a.ad}
                      </span>

                      {/* Not İkon Göstergesi (Varsa) */}
                      {notVar && (
                        <motion.button
                          onClick={(e) => toggleNot(a.id, e)}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                          title="Notu görüntüle / gizle"
                          style={{
                            background: notAcik ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255,255,255,0.06)',
                            border: `1px solid ${notAcik ? t.orange : t.kenarlik}`,
                            color: notAcik ? t.orange : t.alt,
                            borderRadius: '10px',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          <FileText size={12} />
                          <span>Not</span>
                        </motion.button>
                      )}
                    </div>
                  </div>

                  {/* Sağ: Silme Butonu */}
                  <motion.button
                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#EF4444' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      silAliskanlik?.(a.id)
                    }}
                    title="Alışkanlığı Sil"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${t.kenarlik}`,
                      color: '#EF4444',
                      borderRadius: '12px',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Trash2 size={16} />
                  </motion.button>
                </div>

                {/* Açılan Not Alanı */}
                <AnimatePresence>
                  {notAcik && notVar && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        background: t.icKart,
                        borderTop: `1px solid ${t.kenarlik}`,
                        padding: '16px 26px',
                        fontSize: '13px',
                        color: t.alt,
                        fontStyle: 'italic',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px'
                      }}
                    >
                      <FileText size={15} color={t.orange} style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <strong style={{ color: t.metin, fontStyle: 'normal', display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Özel Not</strong>
                        {a.not}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

    </div>
  )
}
