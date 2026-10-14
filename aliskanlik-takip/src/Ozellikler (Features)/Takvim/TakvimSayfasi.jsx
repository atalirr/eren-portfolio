/* ================================================================
   TakvimSayfasi.jsx — SIFIRDAN YENİDEN YAZILMIŞ ZAMAN TÜNELİ
   ================================================================
   - Her saat = 80px yükseklik
   - Kartlar tam çizgiler arasına oturur (30dk hassasiyet)
   - Native pointer-based drag (framer-motion drag yerine)
   - Çakışma algılama ile yan yana kart yerleşimi
   - Otomatik scroll → şu anki saat
   ================================================================ */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import {
  CheckCircle2, Trash2, ListFilter, GripVertical,
  GripHorizontal, Sparkles, Timer, ArrowRight, Clock
} from 'lucide-react'
import { DURUM, ZAMAN_DILIMI } from '../AliskanlikListesi (HabitList)/SahteAliskanliklar (MockHabits).js'

/* ─── SABİTLER ─────────────────────────────────────────────────── */
const SAAT_SAYISI = 24
const SAAT_YUK = 80          // Her saat dilimi 80px
const YARIM_SAAT_YUK = 40    // 30dk = 40px
const SAATLER = Array.from({ length: SAAT_SAYISI }, (_, i) => i)

const KART_RENKLERI = [
  '#F97316', '#10B981', '#3B82F6', '#EF4444', '#EC4899',
  '#14B8A6', '#F59E0B', '#6366F1', '#06B6D4', '#8B5CF6',
]

const formatSaat = (decimalHour) => {
  const s = Math.floor(decimalHour)
  const d = Math.round((decimalHour - s) * 60)
  return `${s.toString().padStart(2, '0')}:${d.toString().padStart(2, '0')}`
}

// 30dk grid'e snap
const snapToGrid = (pxY) => {
  const slot = Math.round(pxY / YARIM_SAAT_YUK) * YARIM_SAAT_YUK
  return Math.max(0, Math.min((SAAT_SAYISI - 0.5) * SAAT_YUK, slot))
}

const pxToSaat = (px) => px / SAAT_YUK
const saatToPx = (saat) => saat * SAAT_YUK

/* ─── ANA BİLEŞEN ─────────────────────────────────────────────── */
export default function TakvimSayfasi({ aliskanliklar, setAliskanliklar, koyuMod }) {
  const scrollRef = useRef(null)
  const gridRef = useRef(null)
  const [suAnkiDakika, setSuAnkiDakika] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })

  /* ── Görevler (localStorage kalıcılık) ── */
  const [gorevler, setGorevler] = useState(() => {
    try {
      const saved = localStorage.getItem('timeline_tasks_v2')
      const savedDate = localStorage.getItem('timeline_date_v2')
      if (saved && savedDate === new Date().toDateString()) return JSON.parse(saved)
    } catch (_) {}
    return [
      { id: 1, baslik: 'Sabah Rutini', saat: 7, sure: 1.5, renk: '#F97316', habitId: 1, zamanDilimi: ZAMAN_DILIMI.SABAH },
      { id: 2, baslik: 'Derin Odak & Kodlama', saat: 10, sure: 2, renk: '#3B82F6', habitId: 2, zamanDilimi: ZAMAN_DILIMI.IS },
      { id: 3, baslik: 'Spor & Egzersiz', saat: 17, sure: 1, renk: '#10B981', habitId: 3, zamanDilimi: ZAMAN_DILIMI.AKSAM },
    ]
  })

  useEffect(() => {
    try {
      localStorage.setItem('timeline_tasks_v2', JSON.stringify(gorevler))
      localStorage.setItem('timeline_date_v2', new Date().toDateString())
    } catch (_) {}
  }, [gorevler])

  /* ── Modal state ── */
  const [modalGorev, setModalGorev] = useState(null)
  const [aiSecimModal, setAiSecimModal] = useState(null)
  const [secilenSaat, setSecilenSaat] = useState(14)

  /* ── Canlı saat güncelleme ── */
  useEffect(() => {
    const iv = setInterval(() => {
      const n = new Date()
      setSuAnkiDakika(n.getHours() * 60 + n.getMinutes())
    }, 15000)
    return () => clearInterval(iv)
  }, [])

  /* ── Sayfa açılınca mevcut saate scroll ── */
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date()
      const target = Math.max(0, (now.getHours() - 2) * SAAT_YUK)
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: target, behavior: 'smooth' })
      }, 300)
    }
  }, [])

  /* ── Tema tokenleri ── */
  const t = {
    bg: '#090D16',
    kart: koyuMod ? '#121626' : '#FFFFFF',
    metin: koyuMod ? '#FFFFFF' : '#0F172A',
    alt: koyuMod ? '#94A3B8' : '#64748B',
    kenarlik: koyuMod ? '#1E2340' : '#E2E8F0',
    orange: '#F97316',
    subBg: koyuMod ? '#171C2E' : '#F8FAFC',
    satir: koyuMod ? '#151A2E' : '#F1F5F9',
  }

  /* ── Görev ekleme ── */
  const gorevEkle = useCallback((kaynak, saat) => {
    setGorevler(prev => {
      const yeni = {
        id: Date.now(),
        baslik: kaynak.ad || kaynak.baslik,
        saat: saat,
        sure: 1,
        renk: kaynak.renk || KART_RENKLERI[prev.length % KART_RENKLERI.length],
        habitId: kaynak.id,
        zamanDilimi: kaynak.zamanDilimi,
      }
      return [...prev, yeni]
    })
    setAiSecimModal(null)
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } })
  }, [])

  /* ── Görev silme ── */
  const gorevSil = useCallback((id) => {
    setGorevler(prev => prev.filter(g => g.id !== id))
  }, [])

  /* ── Sürükleme bitince saat güncelleme ── */
  const gorevTasi = useCallback((id, yeniSaat) => {
    setGorevler(prev => prev.map(g => g.id === id ? { ...g, saat: yeniSaat } : g))
  }, [])

  /* ── Resize bitince süre güncelleme ── */
  const gorevBoyutlandir = useCallback((id, yeniSure) => {
    setGorevler(prev => prev.map(g => g.id === id ? { ...g, sure: yeniSure } : g))
  }, [])

  /* ── Tamamlama (Listeden silinir & Ana sayfada tiklenir) ── */
  const tamamlandiIsaretle = (g) => {
    if (g.habitId && setAliskanliklar) {
      setAliskanliklar(prev => prev.map(a => a.id === g.habitId ? { ...a, durum: DURUM.TAMAMLANDI } : a))
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors: ['#10B981', '#F97316', '#A855F7'] })
    }
    // Zaman tüneli listesinden de kaldır
    setGorevler(prev => prev.filter(x => x.id !== g.id))
    setModalGorev(null)
  }

  /* ── HTML5 Drop handler (sidebar'dan bırakma) ── */
  const handleDrop = (e) => {
    e.preventDefault()
    if (!gridRef.current) return
    const rect = gridRef.current.getBoundingClientRect()
    const scrollTop = scrollRef.current?.scrollTop || 0
    const rawY = e.clientY - rect.top + scrollTop
    const snappedPx = snapToGrid(rawY)
    const saat = pxToSaat(snappedPx)

    const habitData = e.dataTransfer.getData('habit')
    if (habitData) {
      try {
        const habit = JSON.parse(habitData)
        gorevEkle(habit, saat)
      } catch (_) {}
    }
  }

  /* ── Çakışma hesaplama ── */
  const overlapMap = useMemo(() => {
    const map = {}
    gorevler.forEach(g => {
      const gStart = g.saat
      const gEnd = g.saat + g.sure
      // Bu görevle çakışan tüm görevleri bul (kendisi dahil)
      const group = gorevler
        .filter(o => {
          const oStart = o.saat
          const oEnd = o.saat + o.sure
          return gStart < oEnd && gEnd > oStart
        })
        .sort((a, b) => a.id - b.id)
      const idx = group.findIndex(o => o.id === g.id)
      map[g.id] = { total: group.length, index: idx }
    })
    return map
  }, [gorevler])

  /* ── Bekleyen alışkanlıklar ── */
  const bekleyenler = useMemo(() => {
    return (aliskanliklar || []).map((a, idx) => ({
      ...a,
      renk: a.renk || KART_RENKLERI[idx % KART_RENKLERI.length]
    }))
  }, [aliskanliklar])

  /* ── AI önerileri ── */
  const AKILLI_ONERILER = useMemo(() => [
    { ad: '🎬 Inception Filmini İzle', detay: 'Zihinsel labirentlerde rüya içinde rüya sinema seansı.', renk: '#E11D48', zamanDilimi: ZAMAN_DILIMI.AKSAM, varsayilanSaat: 20 },
    { ad: '🎬 Interstellar Filmini İzle', detay: 'Kozmik müzikler ve solucan deliği uzay yolculuğu.', renk: '#8B5CF6', zamanDilimi: ZAMAN_DILIMI.AKSAM, varsayilanSaat: 21 },
    { ad: '📚 20 Sayfa Roman Okuma', detay: 'Telefonu uzakta bırak, hayal gücünü harekete geçir.', renk: '#3B82F6', zamanDilimi: ZAMAN_DILIMI.SABAH, varsayilanSaat: 16 },
    { ad: '🧘 15 Dk Rehberli Meditasyon', detay: 'Zihinsel detoks ve derin diyafram nefesi.', renk: '#06B6D4', zamanDilimi: ZAMAN_DILIMI.SABAH, varsayilanSaat: 9 },
    { ad: '🚶 25 Dk Tempolu Yürüyüş', detay: 'Taze hava al, bacak kaslarını çalıştır ve zihni boşalt.', renk: '#F97316', zamanDilimi: ZAMAN_DILIMI.AKSAM, varsayilanSaat: 18 },
    { ad: '☕ Espresso & Lo-Fi Müzik Molası', detay: 'Taze kahve delemeyip arkada lo-fi ritimler çalsın.', renk: '#D97706', zamanDilimi: ZAMAN_DILIMI.IS, varsayilanSaat: 15 },
    { ad: '🎧 Favori Albümünü Baştan Sona Dinle', detay: 'Hiçbir şey yapmadan sadece müzikle baş başa kal.', renk: '#6366F1', zamanDilimi: ZAMAN_DILIMI.AKSAM, varsayilanSaat: 22 },
    { ad: '📺 15 Dk TED Konuşması İzle', detay: 'Dünyanın en ilham verici zihinlerinden fikirler.', renk: '#EF4444', zamanDilimi: ZAMAN_DILIMI.IS, varsayilanSaat: 13 },
    { ad: '⏱️ 25 Dk Pomodoro Odak Seansı', detay: 'Sadece tek bir işe %100 kesintisiz odaklan.', renk: '#F97316', zamanDilimi: ZAMAN_DILIMI.IS, varsayilanSaat: 10 },
    { ad: '✍️ Günlük Tut & Zihnini Kağıda Dök', detay: 'Duygularını ve günün özetini kaleme al.', renk: '#EC4899', zamanDilimi: ZAMAN_DILIMI.AKSAM, varsayilanSaat: 22 },
    { ad: '♟️ Zorlu Satranç Bulmacası Çöz', detay: 'Stratejik düşünme ve hamle öngörüsü alıştırması.', renk: '#14B8A6', zamanDilimi: ZAMAN_DILIMI.IS, varsayilanSaat: 15 },
    { ad: '🎨 Karakalem veya Dijital Çizim', detay: 'Yaratıcı sağ beyni harekete geçir.', renk: '#F59E0B', zamanDilimi: ZAMAN_DILIMI.AKSAM, varsayilanSaat: 19 },
    { ad: '🌿 Evdeki Bitkileri Sula & Bakım Yap', detay: 'Doğayla ufak bir temas ve yeşil terapisi.', renk: '#10B981', zamanDilimi: ZAMAN_DILIMI.SABAH, varsayilanSaat: 9 },
    { ad: '💻 30 Dk Yeni Teknoloji Deneme', detay: 'İlgilendiğin yeni bir kütüphane veya araç incele.', renk: '#6366F1', zamanDilimi: ZAMAN_DILIMI.IS, varsayilanSaat: 14 },
    { ad: '❄️ Soğuk Duş & Canlanma Seansı', detay: 'Dopamin seviyeni doğal yoldan %250 yükselt.', renk: '#0284C7', zamanDilimi: ZAMAN_DILIMI.SABAH, varsayilanSaat: 7 },
    { ad: '🎼 Klasik Müzik & Mozart Etkisi', detay: 'Zihinsel odaklanma ve beyin dalgalarını düzenleme.', renk: '#4F46E5', zamanDilimi: ZAMAN_DILIMI.IS, varsayilanSaat: 10 },
    { ad: '🗺️ Google Earth İle Rastgele Keşif', detay: 'Dünyanın uzaktaki bir şehrinde sokak görünümüyle gez.', renk: '#0EA5E9', zamanDilimi: ZAMAN_DILIMI.IS, varsayilanSaat: 17 },
    { ad: '🍲 Yeni Bir Yemek Tarifi Araştır', detay: 'Farklı mutfaklardan leziz tarifler keşfet.', renk: '#EA580C', zamanDilimi: ZAMAN_DILIMI.AKSAM, varsayilanSaat: 17 },
  ], [])

  const gosterilenlerRef = useRef(new Set())
  const [mevcutAiOnerisi, setMevcutAiOnerisi] = useState(() => {
    const ilk = AKILLI_ONERILER[Math.floor(Math.random() * AKILLI_ONERILER.length)]
    gosterilenlerRef.current.add(ilk.ad)
    return ilk
  })

  const yeniOneriUret = () => {
    if (gosterilenlerRef.current.size >= AKILLI_ONERILER.length) gosterilenlerRef.current.clear()
    const kalanlar = AKILLI_ONERILER.filter(o => !gosterilenlerRef.current.has(o.ad))
    const secilen = kalanlar[Math.floor(Math.random() * kalanlar.length)] || AKILLI_ONERILER[0]
    gosterilenlerRef.current.add(secilen.ad)
    setMevcutAiOnerisi(secilen)
  }

  const toplamSaat = useMemo(() => gorevler.reduce((a, g) => a + g.sure, 0), [gorevler])

  /* ════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════ */
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}
    >
      {/* ─── CSS ─── */}
      <style>{`
        .tl-scroll::-webkit-scrollbar { width: 6px; }
        .tl-scroll::-webkit-scrollbar-track { background: rgba(18,22,38,0.6); border-radius: 10px; }
        .tl-scroll::-webkit-scrollbar-thumb { background: rgba(249,115,22,0.4); border-radius: 10px; }
        .tl-scroll::-webkit-scrollbar-thumb:hover { background: rgba(249,115,22,0.8); }
        .tl-slot:hover { background: rgba(249,115,22,0.06) !important; }
      `}</style>

      {/* ─── HEADER ─── */}
      <div style={{
        background: t.kart,
        borderRadius: '18px',
        padding: '10px 20px',
        border: `1px solid ${t.kenarlik}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
      }}>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: 'italic',
          fontSize: '20px',
          fontWeight: 400,
          color: t.metin,
          margin: 0,
        }}>
          Günlük Odak Akışı
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'rgba(249,115,22,0.12)',
            padding: '6px 14px',
            borderRadius: '12px',
            border: '1px solid rgba(249,115,22,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <CheckCircle2 size={15} color={t.orange} />
            <span style={{ fontSize: '11px', fontWeight: 800, color: t.metin, letterSpacing: '0.4px' }}>
              AKTİVİTE: <span style={{ color: t.orange, fontFamily: 'monospace', fontSize: '13px' }}>{gorevler.length}</span>
            </span>
          </div>

        </div>
      </div>

      {/* ─── ANA İÇERİK ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)', gap: '24px' }}>

        {/* ════ SOL: ZAMAN TÜNELİ ════ */}
        <div
          ref={scrollRef}
          className="tl-scroll"
          style={{
            background: t.kart,
            borderRadius: '24px',
            border: `1px solid ${t.kenarlik}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            maxHeight: '660px',
            overflowY: 'auto',
            overflowX: 'hidden',
            position: 'relative',
          }}
        >
          <div
            ref={gridRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            style={{
              display: 'grid',
              gridTemplateColumns: '72px 1fr',
              position: 'relative',
              minHeight: SAAT_SAYISI * SAAT_YUK,
            }}
          >
            {/* ── Saat Sütunu ── */}
            <div style={{
              background: t.subBg,
              borderRight: `1px solid ${t.kenarlik}`,
              position: 'relative',
            }}>
              {SAATLER.map(s => {
                const aktif = Math.floor(suAnkiDakika / 60) === s
                return (
                  <div key={s} style={{
                    height: SAAT_YUK,
                    position: 'relative',
                    borderBottom: `1px solid ${t.kenarlik}`,
                    boxSizing: 'border-box',
                  }}>
                    {/* Etiket tam çizginin üstünde oturur */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 5,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: aktif ? 'rgba(249,115,22,0.16)' : t.subBg,
                      border: aktif ? '1px solid rgba(249,115,22,0.4)' : '1px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                    }}>
                      {aktif && <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: t.orange, boxShadow: '0 0 6px #F97316',
                      }} />}
                      <span style={{
                        fontSize: '10px',
                        fontWeight: aktif ? 900 : 700,
                        color: aktif ? t.orange : t.alt,
                        fontFamily: 'monospace',
                        letterSpacing: '0.3px',
                      }}>
                        {s.toString().padStart(2, '0')}:00
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Görev Alanı ── */}
            <div style={{ position: 'relative' }}>
              {/* Saat çizgileri & 30dk bölmeleri */}
              {SAATLER.map(s => (
                <div key={s} style={{ height: SAAT_YUK, position: 'relative', boxSizing: 'border-box' }}>
                  {/* Üst yarım (XX:00 – XX:30) */}
                  <div
                    className="tl-slot"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      const habitData = e.dataTransfer.getData('habit')
                      if (habitData) { try { gorevEkle(JSON.parse(habitData), s) } catch(_){} }
                    }}
                    style={{
                      height: YARIM_SAAT_YUK,
                      borderBottom: `1px dashed rgba(255,255,255,0.06)`,
                      boxSizing: 'border-box',
                      transition: 'background 0.12s ease',
                    }}
                  />
                  {/* Alt yarım (XX:30 – XX+1:00) */}
                  <div
                    className="tl-slot"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      const habitData = e.dataTransfer.getData('habit')
                      if (habitData) { try { gorevEkle(JSON.parse(habitData), s + 0.5) } catch(_){} }
                    }}
                    style={{
                      height: YARIM_SAAT_YUK,
                      borderBottom: `1px solid ${t.kenarlik}`,
                      boxSizing: 'border-box',
                      transition: 'background 0.12s ease',
                    }}
                  />
                </div>
              ))}

              {/* ── CANLI ZAMAN ÇİZGİSİ ── */}
              <div style={{
                position: 'absolute',
                top: suAnkiDakika * (SAAT_YUK / 60),
                left: 0, right: 0,
                height: '2px',
                background: 'linear-gradient(90deg, #F97316, #FB923C)',
                zIndex: 200,
                pointerEvents: 'none',
                boxShadow: '0 0 12px rgba(249,115,22,0.8)',
              }}>
                <div style={{
                  position: 'absolute', left: -1, top: -5,
                  width: 12, height: 12, borderRadius: '50%',
                  background: t.orange, boxShadow: '0 0 10px #F97316',
                }} />
              </div>

              {/* ── GÖREV KARTLARI ── */}
              {gorevler.map(g => {
                const ov = overlapMap[g.id] || { total: 1, index: 0 }
                return (
                  <GorevKarti
                    key={g.id}
                    g={g}
                    overlap={ov}
                    scrollRef={scrollRef}
                    gridRef={gridRef}
                    gorevTasi={gorevTasi}
                    gorevSil={gorevSil}
                    gorevBoyutlandir={gorevBoyutlandir}
                    t={t}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {/* ════ SAĞ: YAN PANEL ════ */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>

          {/* ── Bekleyen Alışkanlıklar (Gradyan Çerçeveli) ── */}
          <div style={{
            background: 'linear-gradient(135deg, #F97316, #8B5CF6, #EC4899, #F97316)',
            borderRadius: '26px',
            padding: '2px',
            boxShadow: '0 8px 32px rgba(249,115,22,0.25)',
            maxHeight: '660px',
            display: 'flex',
          }}>
            <div style={{
              background: t.kart,
              borderRadius: '24px',
              padding: '20px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
            className="tl-scroll"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ListFilter size={16} color={t.orange} />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: t.metin }}>Alışkanlıklarım</span>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 900, color: t.alt,
                  background: t.subBg, padding: '2px 8px', borderRadius: '10px',
                  border: `1px solid ${t.kenarlik}`, fontFamily: 'monospace',
                }}>
                  {bekleyenler.length}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: t.alt, marginBottom: '10px', fontWeight: 600 }}>
                Kartları sürükleyip tünele bırakabilirsiniz:
              </div>
              <div 
                className="tl-scroll" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px', 
                  flex: 1, 
                  overflowY: 'auto', 
                  maxHeight: '550px',
                  paddingRight: '6px' 
                }}
              >
                {bekleyenler.map(a => {
                  const tamamlandi = a.durum === DURUM.TAMAMLANDI
                  return (
                    <motion.div
                      key={a.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('habit', JSON.stringify(a))}
                      whileHover={{ x: 4, backgroundColor: koyuMod ? 'rgba(249,115,22,0.12)' : '#FFF7ED' }}
                      style={{
                        padding: '10px 12px',
                        background: t.subBg,
                        borderRadius: '10px',
                        border: `1px solid ${t.kenarlik}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'grab',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: a.renk, flexShrink: 0,
                          boxShadow: `0 0 6px ${a.renk}`,
                        }} />
                        <span style={{ fontSize: '12px', fontWeight: 800, color: t.metin }}>{a.ad}</span>
                        {tamamlandi && (
                          <span style={{ fontSize: '10px', color: '#10B981', background: 'rgba(16,185,129,0.15)', padding: '1px 6px', borderRadius: '6px', fontWeight: 800 }}>
                            ✓ Tamamlandı
                          </span>
                        )}
                      </div>
                      <GripVertical size={13} color={t.alt} />
                    </motion.div>
                  )
                })}
                {bekleyenler.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '12px', color: t.alt, fontWeight: 600 }}>
                    🎉 Tüm alışkanlıklar planlandı!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MODALLAR ═══ */}
      <AnimatePresence>
        {/* AI Saat Seçim Modalı */}
        {aiSecimModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(12px)', zIndex: 3000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setAiSecimModal(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: t.kart, borderRadius: '24px', padding: '32px',
                width: '90%', maxWidth: '380px', textAlign: 'center', color: t.metin,
                border: `1px solid ${t.kenarlik}`, boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: '16px',
                background: 'rgba(249,115,22,0.15)', color: t.orange,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <Timer size={28} />
              </div>
              <h3 style={{
                fontSize: '20px', fontWeight: 800, margin: '0 0 6px',
                fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic',
              }}>Seans Saatini Seç</h3>
              <p style={{ color: t.alt, fontSize: '13px', marginBottom: '24px' }}>
                AI önerisi için başlangıç saatini belirleyin
              </p>
              <div style={{ marginBottom: '28px' }}>
                <input
                  type="range" min="0" max="23" step="0.5"
                  value={secilenSaat}
                  onChange={(e) => setSecilenSaat(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: t.orange, cursor: 'pointer' }}
                />
                <div style={{ fontSize: '32px', fontWeight: 900, color: t.orange, marginTop: '12px', fontFamily: 'monospace' }}>
                  {formatSaat(secilenSaat)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setAiSecimModal(null)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px',
                    border: `1px solid ${t.kenarlik}`, background: t.subBg,
                    color: t.alt, fontWeight: 800, cursor: 'pointer', fontSize: '13px',
                  }}
                >İPTAL</motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => gorevEkle(aiSecimModal, secilenSaat)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                    background: t.orange, color: '#FFF', fontWeight: 900, cursor: 'pointer', fontSize: '13px',
                  }}
                >EKLE</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Görev Tamamlama Modalı */}
        {modalGorev && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(12px)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setModalGorev(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: t.kart, borderRadius: '24px', width: '90%', maxWidth: '380px',
                padding: '32px', textAlign: 'center', color: t.metin,
                border: `1px solid ${t.kenarlik}`, boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{
                width: 64, height: 64, borderRadius: '20px',
                background: `${modalGorev.renk}20`, color: modalGorev.renk,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{
                fontSize: '20px', fontWeight: 800, margin: '0 0 6px',
                fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic',
              }}>{modalGorev.baslik}</h3>
              <p style={{ color: t.alt, margin: '0 0 24px', fontSize: '13px' }}>
                Seans tamamlandı! Hedefinize ulaştıysanız onaylayın.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setModalGorev(null)}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '14px',
                    border: `1px solid ${t.kenarlik}`, background: t.subBg,
                    color: t.alt, fontWeight: 800, cursor: 'pointer', fontSize: '13px',
                  }}
                >ATLA</motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => tamamlandiIsaretle(modalGorev)}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '14px', border: 'none',
                    background: modalGorev.renk, color: '#FFF', fontWeight: 900, cursor: 'pointer',
                    fontSize: '13px', boxShadow: `0 4px 16px ${modalGorev.renk}50`,
                  }}
                >TAMAMLADIM!</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   GÖREV KARTI BİLEŞENİ — Native Pointer-Based Drag & Resize
   ═══════════════════════════════════════════════════════════════════ */
function GorevKarti({ g, overlap, scrollRef, gridRef, gorevTasi, gorevSil, gorevBoyutlandir, t }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [visualTop, setVisualTop] = useState(saatToPx(g.saat))
  const [visualHeight, setVisualHeight] = useState(g.sure * SAAT_YUK)
  const dragStart = useRef({ pointerY: 0, origTop: 0 })
  const resizeStart = useRef({ pointerY: 0, origHeight: 0 })

  // Senkronize tut
  useEffect(() => {
    if (!isDragging) setVisualTop(saatToPx(g.saat))
  }, [g.saat, isDragging])

  useEffect(() => {
    if (!isResizing) setVisualHeight(g.sure * SAAT_YUK)
  }, [g.sure, isResizing])

  /* ── DRAG ── */
  const onDragPointerDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    dragStart.current = { pointerY: e.clientY, origTop: saatToPx(g.saat) }
    
    const onMove = (me) => {
      const delta = me.clientY - dragStart.current.pointerY
      const rawTop = dragStart.current.origTop + delta
      const snapped = snapToGrid(rawTop)
      setVisualTop(snapped)
    }
    
    const onUp = (ue) => {
      const delta = ue.clientY - dragStart.current.pointerY
      const rawTop = dragStart.current.origTop + delta
      const snapped = snapToGrid(rawTop)
      const newSaat = pxToSaat(snapped)
      gorevTasi(g.id, newSaat)
      setIsDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /* ── RESIZE ── */
  const onResizePointerDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    resizeStart.current = { pointerY: e.clientY, origHeight: g.sure * SAAT_YUK }

    const onMove = (me) => {
      const delta = me.clientY - resizeStart.current.pointerY
      const rawH = resizeStart.current.origHeight + delta
      const snapped = Math.max(YARIM_SAAT_YUK, Math.round(rawH / YARIM_SAAT_YUK) * YARIM_SAAT_YUK)
      setVisualHeight(snapped)
    }

    const onUp = (ue) => {
      const delta = ue.clientY - resizeStart.current.pointerY
      const rawH = resizeStart.current.origHeight + delta
      const snapped = Math.max(YARIM_SAAT_YUK, Math.round(rawH / YARIM_SAAT_YUK) * YARIM_SAAT_YUK)
      const newSure = snapped / SAAT_YUK
      gorevBoyutlandir(g.id, newSure)
      setIsResizing(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const isShort = visualHeight <= YARIM_SAAT_YUK
  const PAD = 4
  const widthPercent = overlap.total > 1 ? `calc(${100 / overlap.total}% - ${PAD}px)` : `calc(100% - ${PAD * 2}px)`
  const leftPercent = overlap.total > 1 ? `calc(${(overlap.index * 100) / overlap.total}% + ${PAD}px)` : `${PAD}px`

  return (
    <div
      style={{
        position: 'absolute',
        top: visualTop,
        left: leftPercent,
        width: widthPercent,
        height: visualHeight - 2,
        background: `linear-gradient(145deg, ${g.renk}E6, ${g.renk}BB)`,
        borderRadius: '8px',
        padding: isShort ? '0 8px' : '6px 10px',
        color: 'white',
        boxShadow: isDragging
          ? `0 12px 32px ${g.renk}60`
          : `0 2px 8px ${g.renk}30`,
        zIndex: isDragging ? 500 : 10,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: isShort ? 'center' : 'flex-start',
        overflow: 'hidden',
        userSelect: 'none',
        transition: isDragging || isResizing ? 'none' : 'top 0.2s ease, height 0.2s ease, box-shadow 0.2s ease',
        cursor: isDragging ? 'grabbing' : 'grab',
        border: `1px solid rgba(255,255,255,0.15)`,
        touchAction: 'none',
      }}
      onPointerDown={onDragPointerDown}
    >
      {/* İçerik */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px',
        flex: isShort ? undefined : 1,
        minWidth: 0,
      }}>
        {isShort ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
            <span style={{
              fontWeight: 800, fontSize: '11px', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{g.baslik}</span>
            <span style={{
              fontSize: '9px', opacity: 0.8, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap',
            }}>
              {formatSaat(g.saat)}–{formatSaat(g.saat + pxToSaat(visualHeight))}
            </span>
          </div>
        ) : (
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontWeight: 800, fontSize: '12px', letterSpacing: '-0.1px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{g.baslik}</div>
            <div style={{
              fontSize: '10px', marginTop: '2px', opacity: 0.8,
              fontWeight: 700, fontFamily: 'monospace',
            }}>
              {formatSaat(g.saat)} — {formatSaat(g.saat + pxToSaat(visualHeight))}
            </div>
          </div>
        )}

        {/* Sil Butonu */}
        <button
          onClick={(e) => { e.stopPropagation(); gorevSil(g.id) }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            cursor: 'pointer',
            width: isShort ? 18 : 24,
            height: isShort ? 18 : 24,
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Trash2 size={isShort ? 9 : 11} />
        </button>
      </div>

      {/* Resize Tutamacı */}
      <div
        onPointerDown={onResizePointerDown}
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: isShort ? '10px' : '16px',
          cursor: 'ns-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30,
        }}
      >
        {!isShort && <GripHorizontal size={12} style={{ opacity: 0.5 }} />}
      </div>
    </div>
  )
}
