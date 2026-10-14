import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, CheckCircle2 } from 'lucide-react'

const LOCAL_STORAGE_KEY = 'habitpulse_calisma_verileri'

const MOTIVASYON_SOZLERI = [
  "Sakin ve dengeli kal, harika ilerliyorsun.",
  "Her saniye, gelecekteki hedeflerine giden bir tuğladır.",
  "Önemli olan hızın değil, tutarlılığındır.",
  "Dikkati dağıtan şeyleri serbest bırak, sadece şu ana odaklan.",
  "Zamanını bilinçli kullanmak, kendine verdiğin en büyük değerdir.",
  "Şu an gösterdiğin çaba, yarınki başarının temelidir.",
]

export default function CalismaSaati({ koyuMod }) {
  // --- State ---
  const [sure, setSure] = useState(0) // Saniye cinsinden
  const [calisiyor, setCalisiyor] = useState(false)
  const [gecmis, setGecmis] = useState([])
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [toastMesaj, setToastMesaj] = useState('')
  const timerRef = useRef(null)

  // Sayfa yüklendiğinde verileri çek
  useEffect(() => {
    const kaydedilen = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (kaydedilen) {
      setGecmis(JSON.parse(kaydedilen))
    }
  }, [])

  // Veri her değiştiğinde kaydet
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gecmis))
  }, [gecmis])

  // Kronometre mantığı
  useEffect(() => {
    if (calisiyor) {
      timerRef.current = setInterval(() => {
        setSure(prev => prev + 1)
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [calisiyor])

  // Motivasyon sözlerini döndürme
  useEffect(() => {
    if (!calisiyor) return
    const id = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % MOTIVASYON_SOZLERI.length)
    }, 30000) // 30 saniyede bir değiştir
    return () => clearInterval(id)
  }, [calisiyor])

  // --- Yardımcı Fonksiyonlar ---
  const fmtSure = (saniye) => {
    const saat = Math.floor(saniye / 3600)
    const dakika = Math.floor((saniye % 3600) / 60)
    const sn = saniye % 60
    return `${String(saat).padStart(2, '0')}:${String(dakika).padStart(2, '0')}:${String(sn).padStart(2, '0')}`
  }

  const reset = () => {
    if (sure > 0) {
      // Seansı otomatik olarak geçmişe ekle (kaydet)
      const bugun = new Date().toLocaleDateString('tr-TR')
      const yeniKayit = {
        id: Date.now(),
        tarih: bugun,
        saniye: sure,
        saat: (sure / 3600).toFixed(2)
      }

      setGecmis(prev => [yeniKayit, ...prev])
      
      // Kaydedildi bildirimi tetikle
      setToastMesaj(`Çalışma seansı kaydedildi ve sıfırlandı! (+${(sure / 3600).toFixed(2)} saat) 🎯`)
      setTimeout(() => setToastMesaj(''), 3000)
    }

    setSure(0)
    setCalisiyor(false)
  }

  // --- Stil Değişkenleri ---
  const tema = {
    metin: koyuMod ? '#F1F5F9' : '#1E293B',
    altMetin: koyuMod ? '#94A3B8' : '#64748B',
    panelBg: koyuMod ? 'rgba(30, 41, 59, 0.65)' : 'rgba(255, 255, 255, 0.75)',
    kartBg: koyuMod ? '#1E293B' : '#FFFFFF',
    kenarlik: koyuMod ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
    vurgu: '#3B82F6', // Mavi
    vurguYesil: '#10B981', // Yeşil
    gradyan: 'linear-gradient(135deg, #3B82F6, #60A5FA)',
    golge: koyuMod ? '0 25px 50px rgba(0,0,0,0.4)' : '0 16px 35px rgba(0,0,0,0.04)'
  }

  return (
    <div style={{
      padding: '40px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      maxWidth: '520px',
      margin: '0 auto',
      position: 'relative'
    }}>
      
      {/* ════ ARKA PLAN DEKORATİF RADYAL IŞILTILAR ════ */}
      <div style={{
        position: 'absolute', top: '25%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '320px', height: '320px',
        background: `radial-gradient(circle, ${tema.vurgu}0c 0%, transparent 70%)`,
        filter: 'blur(45px)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      {/* BAŞLIK */}
      <div style={{ zIndex: 1, textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 900, color: tema.metin, margin: 0, letterSpacing: '-0.5px' }}>
          Çalışma Takibi
        </h1>
        <p style={{ color: tema.altMetin, marginTop: '8px', fontSize: '13px', fontWeight: 600 }}>
          Zihninizi sadeleştirin. Sadece kronometreye ve ana odaklanın.
        </p>
      </div>

      {/* KRONOMETRE PANALİ (MERKEZ KART) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          width: '100%',
          background: tema.panelBg,
          borderRadius: '36px',
          padding: '48px 40px',
          border: `1px solid ${tema.kenarlik}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: tema.golge,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 1,
          position: 'relative'
        }}
      >
        
        {/* SÜRE SAYACI HALKASI (Daha koyu, rahatlatıcı ve parlayıp sönen nefes efektiyle) */}
        <motion.div
          animate={calisiyor ? {
            backgroundColor: koyuMod 
              ? [ 'rgba(9, 11, 20, 0.95)', 'rgba(23, 37, 84, 0.95)', 'rgba(9, 11, 20, 0.95)' ] 
              : [ 'rgba(15, 23, 42, 0.12)', 'rgba(59, 130, 246, 0.14)', 'rgba(15, 23, 42, 0.12)' ],
            boxShadow: koyuMod 
              ? [ 'inset 0 4px 20px rgba(0,0,0,0.65), 0 0 0px rgba(59, 130, 246, 0)', 'inset 0 4px 20px rgba(0,0,0,0.5), 0 0 25px rgba(59, 130, 246, 0.22)', 'inset 0 4px 20px rgba(0,0,0,0.65), 0 0 0px rgba(59, 130, 246, 0)' ]
              : [ 'inset 0 4px 20px rgba(0,0,0,0.06), 0 0 0px rgba(59, 130, 246, 0)', 'inset 0 4px 20px rgba(0,0,0,0.04), 0 0 20px rgba(59, 130, 246, 0.12)', 'inset 0 4px 20px rgba(0,0,0,0.06), 0 0 0px rgba(59, 130, 246, 0)' ]
          } : {
            backgroundColor: koyuMod ? 'rgba(9, 11, 20, 0.95)' : 'rgba(15, 23, 42, 0.12)',
            boxShadow: koyuMod ? 'inset 0 4px 20px rgba(0,0,0,0.65)' : 'inset 0 4px 20px rgba(0,0,0,0.06)'
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            border: `2px solid ${koyuMod ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            marginBottom: '40px',
          }}
        >
          
          {/* PROFESYONEL VE AKICI DÖNEN MAVİ ÇİZGİ OVERLAY */}
          <motion.div
            animate={calisiyor ? { rotate: 360 } : { rotate: 0 }}
            transition={calisiyor ? { duration: 8, repeat: Infinity, ease: "linear" } : {}}
            style={{
              position: 'absolute',
              inset: '-8px',
              pointerEvents: 'none',
              zIndex: 1
            }}
          >
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <circle 
                cx="50" 
                cy="50" 
                r="49" 
                fill="none" 
                stroke="url(#studBlueLine)" 
                strokeWidth="2.5" 
                strokeDasharray="75 233" // Daire çevresinin ~1/4'ünü kaplayan şık bir ark
                strokeLinecap="round"
                style={{
                  filter: `drop-shadow(0 0 8px ${tema.vurgu}80)`
                }}
              />
              <defs>
                <linearGradient id="studBlueLine" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563EB" />
                  <stop offset="60%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.4} />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>
          
          <div style={{ textAlign: 'center', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Küçük durum/nefes metni */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: calisiyor ? tema.vurguYesil : tema.altMetin,
                boxShadow: calisiyor ? `0 0 8px ${tema.vurguYesil}` : 'none'
              }} />
              <span style={{ 
                fontSize: '10px', 
                fontWeight: 900, 
                color: tema.altMetin, 
                textTransform: 'uppercase', 
                letterSpacing: '2.5px' 
              }}>
                {calisiyor ? 'ÇALIŞILIYOR' : 'HAZIR'}
              </span>
            </div>

            {/* Büyük Sayaç Saat Sayıları */}
            <div style={{ 
              fontSize: '44px', 
              fontWeight: 300, 
              color: tema.metin, 
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-1.5px',
              fontFamily: "'Inter', sans-serif",
              lineHeight: 1
            }}>
              {fmtSure(sure)}
            </div>
          </div>
        </motion.div>

        {/* Kontrol Butonları (Sadece Başlat ve Sıfırla Butonları Var — İkisi De Glassmorphism) */}
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          
          {/* Başlat / Durdur Butonu (Glassmorphism Stili) */}
          <motion.button
            whileHover={{ scale: 1.02, backgroundColor: koyuMod ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderColor: koyuMod ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setCalisiyor(!calisiyor)}
            style={{
              flex: 1,
              height: '54px',
              borderRadius: '16px',
              border: `1.5px solid ${koyuMod ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              background: koyuMod ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.5)',
              color: tema.metin,
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: 'none',
              transition: 'background-color 0.2s, border-color 0.2s'
            }}
          >
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: calisiyor ? '#EF4444' : '#10B981',
              display: 'inline-block'
            }} />
            {calisiyor ? 'Durdur' : 'Başlat'}
          </motion.button>

          {/* Sıfırlama Butonu (Glassmorphism Stili - Seansı Otomatik Kaydeder) */}
          <motion.button
            whileHover={{ scale: 1.04, backgroundColor: koyuMod ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderColor: koyuMod ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }}
            whileTap={{ scale: 0.96 }}
            onClick={reset}
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              border: `1.5px solid ${koyuMod ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              background: koyuMod ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.5)',
              color: tema.metin,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: 'none',
              transition: 'background-color 0.2s, border-color 0.2s'
            }}
            title="Sıfırla ve Seansı Kaydet"
          >
            <RotateCcw size={18} />
          </motion.button>
        </div>

        {/* Motivasyon İletisi */}
        {calisiyor && (
          <div style={{ marginTop: '28px', height: '14px', textAlign: 'center', width: '100%' }}>
            <AnimatePresence mode="wait">
              <motion.p
                key={quoteIndex}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 0.5, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  margin: 0,
                  fontSize: '11px',
                  fontStyle: 'italic',
                  color: tema.metin,
                  fontWeight: 600,
                  lineHeight: 1.3
                }}
              >
                "{MOTIVASYON_SOZLERI[quoteIndex]}"
              </motion.p>
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* ════ BAŞARILI BİLDİRİM TOAST KUTUSU ════ */}
      <AnimatePresence>
        {toastMesaj && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed',
              bottom: '40px',
              background: '#10B981',
              color: 'white',
              padding: '14px 28px',
              borderRadius: '18px',
              fontWeight: 800,
              fontSize: '13px',
              boxShadow: '0 12px 28px rgba(16, 185, 129, 0.3)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              letterSpacing: '0.2px'
            }}
          >
            <CheckCircle2 size={16} />
            {toastMesaj}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
