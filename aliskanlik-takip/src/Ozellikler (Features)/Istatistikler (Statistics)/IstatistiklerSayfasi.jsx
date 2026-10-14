import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, Cell,
  PieChart, Pie
} from 'recharts'
import {
  TrendingUp, TrendingDown, Flame, Target, Zap, Award,
  Clock, CheckCircle2, Activity, BarChart2, Grid, BookOpen,
  Minus, ChevronUp, ChevronDown, ArrowUpRight,
  Brain, Layers, Sparkles, Star, Edit3
} from 'lucide-react'

import { DURUM, ZAMAN_DILIMI } from '../AliskanlikListesi (HabitList)/SahteAliskanliklar (MockHabits).js'

const SON_12_GUN_ETIKETLERI = Array.from({ length: 12 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (11 - i))
  return d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric' })
})

const KATEGORI_RENKLERI = {
  'Sağlık':           '#10B981',
  'Spor':             '#6366F1',
  'Verimlilik':       '#F59E0B',
  'Zihinsel Sağlık':  '#EC4899',
  'Kişisel Gelişim':  '#0EA5E9',
}

function useCountUp(target, speed = 30) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (value === target) return
    const step = Math.max(1, Math.ceil(Math.abs(target - value) / 15))
    const timer = setInterval(() => {
      setValue(prev => {
        const next = prev < target ? Math.min(prev + step, target) : Math.max(prev - step, target)
        if (next === target) clearInterval(timer)
        return next
      })
    }, speed)
    return () => clearInterval(timer)
  }, [target, value, speed])
  return value
}

const ISI_VERISI = Array.from({ length: 35 }, (_, i) => {
  return (i * 13 + 7) % 5
})

export default function IstatistiklerSayfasi({ gunlukOzet, aliskanliklar = [], koyuMod }) {
  const [siralamaSecenegi, setSiralamaSecenegi] = useState('seri_desc')
  const [cevirilmis, setCevirilmis] = useState({})
  const [takipSuresi, setTakipSuresi] = useState('hafta')
  const [trendSuresi, setTrendSuresi] = useState('14') // 'gunluk', 'hafta', '4hafta', '3ay', '6ay'
  const [seciliKategori, setSeciliKategori] = useState('hepsi') // 'hepsi', veya dinamik kategori isimleri

  const kartCevir = (id) => setCevirilmis(prev => ({ ...prev, [id]: !prev[id] }))

  // Dinamik Kategori Seçenekleri Combobox'ı
  const kategoriSecenekleri = useMemo(() => {
    const benzersiz = [...new Set(aliskanliklar.map(a => a.kategori).filter(Boolean))]
    return [
      { value: 'hepsi', label: 'Tüm Kategoriler' },
      ...benzersiz.map(k => ({ value: k, label: k }))
    ]
  }, [aliskanliklar])

  /* ─── Hesaplamalar (useMemo) ──────────────────────────────────── */

  const durumDagilimi = useMemo(() => {
    const tam = aliskanliklar.filter(a => a.durum === DURUM.TAMAMLANDI).length
    const bek = aliskanliklar.filter(a => a.durum === DURUM.BEKLEMEDE).length
    const atl = aliskanliklar.filter(a => a.durum === DURUM.ATLANDI).length
    return [
      { name: 'Tamamlandı', value: tam, color: '#10B981' },
      { name: 'Beklemede',  value: bek, color: '#6366F1' },
      { name: 'Atlandı',   value: atl, color: '#EF4444' },
    ]
  }, [aliskanliklar])

  const zamanDilimiVerisi = useMemo(() => {
    const dilimler = [
      { key: ZAMAN_DILIMI.SABAH,  etiket: 'Sabah', renk: '#6366F1' },
      { key: ZAMAN_DILIMI.IS,     etiket: 'İş',    renk: '#10B981' },
      { key: ZAMAN_DILIMI.AKSAM,  etiket: 'Akşam', renk: '#F59E0B' },
    ]
    return dilimler.map(d => {
      const grup = aliskanliklar.filter(a => a.zamanDilimi === d.key)
      const tam = grup.filter(a => a.durum === DURUM.TAMAMLANDI).length
      return { ...d, toplam: grup.length, tamamlanan: tam, oran: grup.length > 0 ? Math.round((tam / grup.length) * 100) : 0 }
    })
  }, [aliskanliklar])

  const trendVerisi = useMemo(() => {
    const gunSayisi = parseInt(trendSuresi) || 14
    const bugun = new Date()
    
    return Array.from({ length: gunSayisi }, (_, i) => {
      const d = new Date()
      // Sol baştan Tam Bugünün Tarihi ("10 Ağu") ile başlatıp ileriye doğru git (10 Ağu, 11 Ağu, 12 Ağu...)
      d.setDate(bugun.getDate() + i)
      
      const etiket = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
      const tamTarih = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })
      const isToday = i === 0
      
      let tamamlanan = 0
      aliskanliklar.forEach(a => {
        const gecmisDizisi = a.gecmis && a.gecmis.length > 0 
          ? a.gecmis 
          : Array(gunSayisi).fill(a.durum === DURUM.TAMAMLANDI ? 1 : 0)
        
        if (isToday && a.durum === DURUM.TAMAMLANDI) {
          tamamlanan++
        } else if (i < gecmisDizisi.length && gecmisDizisi[i] === 1) {
          tamamlanan++
        }
      })
      
      const toplam = aliskanliklar.length || 1
      const oran = Math.round((tamamlanan / toplam) * 100)
      return { name: etiket, oran, tamamlanan, toplam, tamTarih }
    })
  }, [aliskanliklar, trendSuresi])

  const radarVerisi = useMemo(() => {
    const kategoriler = [...new Set(aliskanliklar.map(a => a.kategori))]
    return kategoriler.map(kat => {
      const grup = aliskanliklar.filter(a => a.kategori === kat)
      const toplamGecmis = grup.reduce((acc, a) => acc + (a.gecmis || []).filter(v => v === 1).length, 0)
      const toplamGun = grup.reduce((acc, a) => acc + (a.gecmis || []).length, 0)
      const skor = toplamGun > 0 ? Math.round((toplamGecmis / toplamGun) * 100) : 0
      return { kategori: kat, skor, fullMark: 100 }
    })
  }, [aliskanliklar])

  const tabloVerisi = useMemo(() => {
    const [alani, yonu] = siralamaSecenegi.split('_')
    let filtreli = Array.isArray(aliskanliklar) ? [...aliskanliklar] : []
    
    if (seciliKategori !== 'hepsi') {
      filtreli = filtreli.filter(a => (a.kategori || 'Genel') === seciliKategori)
    }

    return filtreli.map((a, idx) => {
      const gecmisDizisi = Array.isArray(a.gecmis) && a.gecmis.length > 0 
        ? a.gecmis 
        : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, a.durum === DURUM.TAMAMLANDI ? 1 : 0]
      
      const tamSayisi = gecmisDizisi.filter(v => v === 1).length
      const toplamGun = gecmisDizisi.length || 1
      const basariskor = Math.round((tamSayisi / toplamGun) * 100)
      const seriVal = a.seri !== undefined ? a.seri : (a.durum === DURUM.TAMAMLANDI ? 1 : 0)
      const hedefGunVal = a.hedefGun || 21
      const hedefYuzde = Math.min(Math.round((seriVal / hedefGunVal) * 100), 100)
      
      return { 
        ...a, 
        id: a.id || `hab-${idx}`,
        ad: a.ad || 'İsimsiz Alışkanlık',
        ikon: a.ikon || '🎯',
        kategori: a.kategori || 'Genel',
        seri: seriVal,
        hedefGun: hedefGunVal,
        gecmis: gecmisDizisi,
        basariskor, 
        hedefYuzde 
      }
    }).sort((a, b) => {
      const av = alani === 'seri' ? a.seri : a.basariskor
      const bv = alani === 'seri' ? b.seri : b.basariskor
      return yonu === 'desc' ? bv - av : av - bv
    })
  }, [aliskanliklar, siralamaSecenegi, seciliKategori])

  // Haftalık Odak ve Aksatılan Alışkanlıklar Analizi
  const odakVerileri = useMemo(() => {
    let calismaListesi = []
    let pomodoroData = { sayi: 0, dakika: 0 }
    
    try {
      const rawCalisma = localStorage.getItem('habitpulse_calisma_verileri')
      if (rawCalisma) calismaListesi = JSON.parse(rawCalisma)
      
      const rawPomo = localStorage.getItem('habitpulse_pomodoro_verileri')
      if (rawPomo) pomodoroData = JSON.parse(rawPomo)
    } catch (e) {}

    const kronometreToplamSn = calismaListesi.reduce((acc, item) => acc + (item.sure || 0), 0)
    const kronometreToplamDk = Math.round(kronometreToplamSn / 60)
    
    const toplamDk = kronometreToplamDk + (pomodoroData.dakika || 0)
    const toplamSaat = (toplamDk / 60).toFixed(1)

    return {
      toplamDk,
      toplamSaat,
      kronometreToplamDk,
      pomodoroSayisi: pomodoroData.sayi || 0,
      pomodoroDakika: pomodoroData.dakika || 0,
      oturumSayisi: calismaListesi.length,
      sonSeanslar: calismaListesi.slice(-2).reverse()
    }
  }, [aliskanliklar])

  const zDilimiBarVerisi = useMemo(() => {
    const dilimler = [
      { key: ZAMAN_DILIMI.SABAH,  etiket: 'Sabah', renk: '#6366F1' },
      { key: ZAMAN_DILIMI.IS,     etiket: 'İş',    renk: '#10B981' },
      { key: ZAMAN_DILIMI.AKSAM,  etiket: 'Akşam', renk: '#F59E0B' },
    ]
    return dilimler.map(d => {
      const grup = aliskanliklar.filter(a => a.zamanDilimi === d.key)
      const toplamGecmis = grup.reduce((acc, a) => acc + (a.gecmis || []).filter(v => v === 1).length, 0)
      const toplamMumkun = grup.reduce((acc, a) => acc + (a.gecmis || []).length, 0)
      const oran = toplamMumkun > 0 ? Math.round((toplamGecmis / toplamMumkun) * 100) : 0
      return { etiket: d.etiket, oran, renk: d.renk }
    })
  }, [aliskanliklar])

  const kpiVerileri = useMemo(() => {
    const seriKopanSayisi = aliskanliklar.filter(a => a.seri === 0).length
    const toplamSayisi = aliskanliklar.length || 1
    const sicramaOrani = Math.round((seriKopanSayisi / toplamSayisi) * 100)
    const ortSeri = aliskanliklar.length > 0
      ? Math.round(aliskanliklar.reduce((s, a) => s + a.seri, 0) / aliskanliklar.length)
      : 0
    const gunSayisi = 12
    let mukemmelGun = 0
    for (let i = 0; i < gunSayisi; i++) {
      const hepsini = aliskanliklar.every(a => (a.gecmis || [])[i] === 1)
      if (hepsini && aliskanliklar.length > 0) mukemmelGun++
    }
    const mukemmelOrani = Math.round((mukemmelGun / gunSayisi) * 100)
    const toplamDakika = aliskanliklar.reduce((acc, a) => {
      const sayi = parseInt(a.miktar)
      return acc + (isNaN(sayi) ? 15 : sayi)
    }, 0)
    return [
      { baslik: 'SERİ KOPMA ORANI', deger: sicramaOrani, birim: '%', alt: `${seriKopanSayisi} alışkanlık sıfıra düştü`, pozitif: false, ikon: <Flame size={20} />, renk: '#EF4444' },
      { baslik: 'ORTALAMA SERİ', deger: ortSeri, birim: 'GÜN', alt: 'Tüm alışkanlıkların ortası', pozitif: true, ikon: <Layers size={20} />, renk: '#6366F1' },
      { baslik: 'MÜKEMMEL GÜN', deger: mukemmelOrani, birim: '%', alt: `${mukemmelGun}/${gunSayisi} tam tamamlama`, pozitif: true, ikon: <Star size={20} />, renk: '#F59E0B' },
      { baslik: 'TAHMİNİ SÜRE', deger: toplamDakika, birim: 'DK', alt: 'Günlük toplam yatırım', pozitif: null, ikon: <Clock size={20} />, renk: '#0EA5E9' },
    ]
  }, [aliskanliklar])

  /* ─── Tema ────────────────────────────────────────────────────── */
  const t = {
    bg: '#0C0F1A',
    kart: '#141829',
    baslik: '#FFFFFF',
    alt: '#94A3B8',
    kenarlik: '#1E2340',
    filtreBg: '#1C2136',
    grid: '#1E2340',
  }

  const yuzde = gunlukOzet?.yuzde ?? 0
  const animYuzde = useCountUp(yuzde)
  const maxSeri = aliskanliklar.length > 0 ? Math.max(...aliskanliklar.map(a => a.seri)) : 0
  const animMaxSeri = useCountUp(maxSeri)
  
  // Radius calculation for the smaller SVG
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (animYuzde / 100) * circumference

  /* ─── Kart Stili ──────────────────────────────────────────────── */
  const kartStil = {
    background: t.kart,
    borderRadius: '20px',
    border: `1px solid ${t.kenarlik}`,
    padding: '28px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '60px' }}>

      {/* ─── BAŞLIK ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'inline-block', backgroundColor: '#F9731620', color: '#F97316', borderRadius: '20px', padding: '6px 16px', fontSize: '13px', fontWeight: 'bold', marginBottom: '12px' }}>
            İstatistikler
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '30px', color: t.baslik, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            Haftalık Genel Bakış
          </h1>
          <p style={{ margin: 0, color: t.alt, fontSize: '14px', lineHeight: '1.6', maxWidth: '500px' }}>
            Tutarlılığınız ivme kazanıyor — Son 7 güne ait tüm aktif rutinlerinize genel bir bakış.
          </p>
        </div>
      </div>

      {/* ─── BÖLÜM 1: BİRLEŞTİRİLMİŞ ÜST GENEL BAKIŞ & KESİNTİSİZ SERİ KARTI ─── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={kartStil}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: '28px', alignItems: 'center' }}>
          
          {/* Sol Taraf: Dikey Dikdörtgen Yükleme Çubuğu (Load Bar) & Tamamlama Oranı */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Dikey Dikdörtgen Load Bar SVG */}
            <div style={{ position: 'relative', width: 44, height: 104, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={44} height={104} viewBox="0 0 44 104">
                {/* Arka plan kenarlık çerçeve */}
                <rect x={3} y={3} width={38} height={98} rx={8} stroke={t.kenarlik} strokeWidth={3.5} fill="none" />
                {/* Turuncu Çerçeve Çizgi İlerlemesi (Load Bar) */}
                <rect
                  x={3} y={3} width={38} height={98} rx={8}
                  stroke="#F97316" strokeWidth={3.5} fill="none"
                  strokeDasharray={272}
                  strokeDashoffset={272 * (1 - animYuzde / 100)}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.9s ease-out' }}
                />
              </svg>
            </div>

            <div>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#F97316' }}>GENEL İLERLEME</span>
              <h3 style={{ margin: '2px 0 6px 0', fontSize: '19px', color: t.baslik, fontWeight: 700, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Bugünün İlerleme Durumu</h3>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#F97316', fontFamily: 'monospace', lineHeight: 1 }}>
                %{animYuzde} <span style={{ fontSize: '13px', color: t.alt, fontWeight: 600, fontFamily: 'sans-serif' }}>Tamamlama Oranı</span>
              </div>
            </div>
          </div>

          {/* Orta Dikey Ayırıcı Çizgi */}
          <div style={{ width: '1px', height: '80px', background: t.kenarlik, opacity: 0.6 }} />

          {/* Sağ Taraf: Kesintisiz Seri - Turuncu Kare Kutu İçinde Yalnızca Rakam */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            {/* Turuncu Kenarlıklı Kare Kutu İçinde Rakam */}
            <div style={{
              width: 58, height: 58, borderRadius: '16px',
              background: 'rgba(249, 115, 22, 0.12)',
              border: '2px solid #F97316',
              boxShadow: '0 0 16px rgba(249, 115, 22, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#F97316', flexShrink: 0
            }}>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#F97316', fontFamily: 'monospace', lineHeight: 1 }}>
                {animMaxSeri}
              </span>
            </div>

            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: t.baslik, fontWeight: 800 }}>Kesintisiz Seri</h3>
              <div style={{ fontSize: '13px', color: t.alt, fontWeight: 700 }}>
                {animMaxSeri} Gün Kesintisiz İlerleme 🚀
              </div>
            </div>
          </div>

        </div>
      </motion.div>

      {/* ─── BÖLÜM 2: TREND GRAFİĞİ (Zarif Modern Tasarım) ─────── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={kartStil}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: t.baslik, fontWeight: 700 }}>Günlük Tamamlama Trendi</h3>
            </div>
            <p style={{ margin: 0, color: t.alt, fontSize: '13px' }}>Son {trendSuresi} gündeki başarı oranınızın canlı değişimi</p>
          </div>

          {/* ZAMAN FİLTRESİ TOGGLE BUTONLARI */}
          <div style={{ display: 'flex', gap: '6px', background: t.subBg, padding: '4px', borderRadius: '12px', border: `1px solid ${t.kenarlik}` }}>
            {['7', '14', '30'].map(gun => (
              <button
                key={gun}
                onClick={() => setTrendSuresi(gun)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: trendSuresi === gun ? '#F97316' : 'transparent',
                  color: trendSuresi === gun ? '#FFFFFF' : t.alt,
                  fontSize: '11px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: trendSuresi === gun ? '0 2px 10px rgba(249, 115, 22, 0.35)' : 'none'
                }}
              >
                {gun} GÜN
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={195}>
          <AreaChart data={trendVerisi} margin={{ top: 6, right: 6, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F97316" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#F97316" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.25)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 600, fill: t.alt }} dy={6} />
            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 600, fill: t.alt }} tickFormatter={v => `${v}%`} width={32} />
            <Tooltip
              contentStyle={{
                background: koyuMod ? 'rgba(14, 18, 32, 0.98)' : 'rgba(255,255,255,0.98)',
                backdropFilter: 'blur(14px)',
                border: `1px solid ${t.kenarlik}`,
                borderRadius: '10px',
                color: t.baslik,
                fontSize: '11px',
                fontWeight: 700,
                boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
                padding: '7px 11px',
              }}
              formatter={(val) => [`${val}%`, 'Başarı']}
              labelStyle={{ color: t.alt, fontWeight: 600, fontSize: '10px' }}
            />
            <Area
              type="monotone"
              dataKey="oran"
              stroke="#F97316"
              strokeWidth={2}
              fill="url(#chartGrad)"
              dot={{ fill: '#F97316', stroke: koyuMod ? '#0C0F1A' : '#fff', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, fill: '#FBBF24', stroke: '#F97316', strokeWidth: 2 }}
            />
            <Area type="monotone" dataKey={() => 80} stroke={koyuMod ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'} strokeDasharray="3 6" strokeWidth={1} fill="none" dot={false} activeDot={false} />
          </AreaChart>
        </ResponsiveContainer>
        {(() => {
          const ort = Math.round(trendVerisi.reduce((a, b) => a + b.oran, 0) / (trendVerisi.length || 1))
          const ilk = trendVerisi.slice(0, 6).reduce((a, b) => a + b.oran, 0) / 6
          const son = trendVerisi.slice(6).reduce((a, b) => a + b.oran, 0) / 6
          const yukselis = son >= ilk
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '10px 14px', background: t.filtreBg, borderRadius: '12px', border: `1px solid ${t.kenarlik}` }}>
              <span style={{ fontSize: '12px', color: t.alt }}>12 Günlük Ort: <span style={{ color: '#F97316', fontWeight: 800 }}>{ort}%</span></span>
              <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: yukselis ? 'rgba(249,115,22,0.1)' : 'rgba(239,68,68,0.1)' }}>
                {yukselis ? <TrendingUp size={13} color="#F97316" /> : <TrendingDown size={13} color="#EF4444" />}
                <span style={{ color: yukselis ? '#F97316' : '#EF4444', fontWeight: 800 }}>{yukselis ? 'Yükseliyor' : 'Düşüyor'}</span>
              </span>
            </div>
          )
        })()}
      </motion.div>

      {/* ─── BÖLÜM 3 & 4: ISI HARİTASI & ZAMANSAL ÖRÜNTÜLER (Yan yana 2'li grid) ─── */}
      {/* ─── BÖLÜM 3 & 4: ISI HARİTASI & DİSİPLİN ANALİZİ (Yan yana 2'li grid) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* Yörüngesel Aktivite Isı Haritası */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ ...kartStil, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', color: t.baslik, fontWeight: 700 }}>Yörüngesel Aktivite Isı Haritası</h3>
            <p style={{ margin: '0 0 16px 0', color: t.alt, fontSize: '12px' }}>Merkezden uzaklık = Günlük Aktivite Yoğunluğu</p>
            <YorungeselAkisHaritasi t={t} koyuMod={koyuMod} aliskanliklar={aliskanliklar} />
          </div>
        </motion.div>

        {/* Odak & Çalışma Seansları Analizi Kartı (Net & Anlaşılır Yüksek Görsel Düzen) */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} style={{ ...kartStil, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {/* Üst Başlık & Rozet */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'inline-block', backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#F97316', borderRadius: '12px', padding: '3px 10px', fontSize: '10px', fontWeight: '900', letterSpacing: '0.8px', marginBottom: '8px' }}>
                ODAK & ZAMANLAYICI VERİLERİ
              </div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", color: t.baslik, fontWeight: 800 }}>Çalışma & Odak Raporu</h3>
              <p style={{ margin: 0, color: t.alt, fontSize: '12px', lineHeight: '1.4' }}>
                Odak Zamanlayıcısı ve Pomodoro oturumlarınızdan elde edilen gerçek zamanlı veriler.
              </p>
            </div>

            {/* ANA HERO METRİK: Toplam Çalışma Süresi Kartı */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(139, 92, 246, 0.08))',
              border: '1px solid rgba(249, 115, 22, 0.3)',
              borderRadius: '16px',
              padding: '16px 18px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 900, color: '#F97316', textTransform: 'uppercase', letterSpacing: '0.8px' }}>TOPLAM DİRİ ODAKLANMA</div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#F97316', fontFamily: 'monospace', lineHeight: 1.1, marginTop: '2px' }}>
                  {odakVerileri.toplamSaat} <span style={{ fontSize: '14px', color: t.baslik, fontWeight: 700 }}>SAAT</span>
                </div>
                <div style={{ fontSize: '11px', color: t.alt, fontWeight: 600, marginTop: '2px' }}>
                  Toplam {odakVerileri.toplamDk} dakika kaliteli çalışma
                </div>
              </div>
              <div style={{
                width: 48, height: 48, borderRadius: '14px',
                background: 'rgba(249, 115, 22, 0.2)',
                border: '1px solid #F97316',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', flexShrink: 0
              }}>
                ⚡
              </div>
            </div>

            {/* 2'Lİ ALT METRİK IZGARASI (Pomodoro & Kronometre Ayrımı) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              {/* Pomodoro Kutusu */}
              <div style={{ background: t.filtreBg, border: `1px solid ${t.kenarlik}`, padding: '12px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px' }}>🍅</span>
                  <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: 900 }}>POMODORO</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: t.baslik, fontFamily: 'monospace' }}>
                  {odakVerileri.pomodoroSayisi} <span style={{ fontSize: '11px', color: t.alt, fontWeight: 600 }}>Seans</span>
                </div>
                <div style={{ fontSize: '10px', color: t.alt, fontWeight: 600, marginTop: '2px' }}>
                  {odakVerileri.pomodoroDakika} dakika odak
                </div>
              </div>

              {/* Kronometre Kutusu */}
              <div style={{ background: t.filtreBg, border: `1px solid ${t.kenarlik}`, padding: '12px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px' }}>⏱️</span>
                  <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 900 }}>KRONOMETRE</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: t.baslik, fontFamily: 'monospace' }}>
                  {odakVerileri.oturumSayisi} <span style={{ fontSize: '11px', color: t.alt, fontWeight: 600 }}>Oturum</span>
                </div>
                <div style={{ fontSize: '10px', color: t.alt, fontWeight: 600, marginTop: '2px' }}>
                  {odakVerileri.kronometreToplamDk} dakika çalışma
                </div>
              </div>
            </div>

            {/* SON SEANSLAR ÖNİZLEMESİ (Varsa Son Çalışmalar) */}
            {odakVerileri.sonSeanslar.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: t.alt, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  SON ÇALIŞMA OTURUMLARI
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {odakVerileri.sonSeanslar.map((s, idx) => (
                    <div key={idx} style={{ background: t.filtreBg, border: `1px solid ${t.kenarlik}`, padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: t.baslik }}>{s.etiket || 'Çalışma Seansı'}</span>
                      <span style={{ fontSize: '11px', fontWeight: 900, color: '#F97316', fontFamily: 'monospace' }}>{Math.round((s.sure || 0) / 60)} dk</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* İPUCU VE ÖZET MESAJI */}
          <div style={{ padding: '10px 12px', background: t.filtreBg, borderRadius: '10px', border: `1px solid ${t.kenarlik}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>💡</span>
            <span style={{ fontSize: '11px', color: t.baslik, fontWeight: 600 }}>
              {odakVerileri.toplamDk > 0 
                ? `Harika performans! Odak zamanlayıcısında toplam ${odakVerileri.toplamDk} dakikalık verimli çalışma tamamladınız.`
                : 'Odak zamanlayıcısını başlatıp çalışarak buraya gerçek oturum verilerinizi kaydedebilirsiniz.'}
            </span>
          </div>
        </motion.div>

      </div>

      {/* ─── BÖLÜM 5: PERFORMANS LİSTESİ (Tam genişlik) ───────── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} style={kartStil}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#8B5CF620', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: t.baslik }}>Günlük Takip</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: t.alt }}>Farklı periyotlardaki alışkanlık durumunuz</p>
            </div>
          </div>
          
          {/* Category, Time Range & Sorting Custom Dropdowns */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <OzelDropdown
              secili={seciliKategori}
              onChange={setSeciliKategori}
              genislik="165px"
              t={t}
              secenekler={kategoriSecenekleri}
            />

            <div style={{ width: '1px', height: '24px', background: t.kenarlik }} />

            <OzelDropdown
              secili={takipSuresi}
              onChange={setTakipSuresi}
              genislik="175px"
              t={t}
              secenekler={[
                { value: 'gunluk', label: 'Bugün / Günlük (1 Gün)' },
                { value: 'hafta', label: 'Bu Hafta (7 Gün)' },
                { value: '4hafta', label: 'Son 4 Hafta (28 Gün)' },
                { value: '3ay', label: 'Son 3 Ay (90 Gün)' },
                { value: '6ay', label: 'Son 6 Ay (180 Gün)' },
              ]}
            />

            <div style={{ width: '1px', height: '24px', background: t.kenarlik }} />

            <OzelDropdown
              secili={siralamaSecenegi}
              onChange={setSiralamaSecenegi}
              genislik="175px"
              t={t}
              secenekler={[
                { value: 'seri_desc', label: 'En Yüksek Seri' },
                { value: 'seri_asc', label: 'En Düşük Seri' },
                { value: 'basariskor_desc', label: 'En Yüksek Başarı %' },
                { value: 'basariskor_asc', label: 'En Düşük Başarı %' },
              ]}
            />
          </div>
        </div>

        {/* KAYDIRILABİLİR İÇ ÇERÇEVE CONTAINER (Sık Ve Şık Görünür Scrollbar) */}
        <style>{`
          .custom-card-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-card-scrollbar::-webkit-scrollbar-track {
            background: #141829;
            border-radius: 4px;
          }
          .custom-card-scrollbar::-webkit-scrollbar-thumb {
            background: #2D3658;
            border-radius: 4px;
          }
          .custom-card-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #8B5CF6;
          }
        `}</style>

        <div
          className="custom-card-scrollbar"
          style={{
            maxHeight: '650px',
            overflowY: 'auto',
            paddingRight: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            scrollbarWidth: 'thin',
            scrollbarColor: '#2D3658 #141829'
          }}
        >
          <AnimatePresence>
            {tabloVerisi.map((a, i) => (
              <PerformansSatiri 
                key={a.id} 
                a={a} 
                i={i} 
                t={t} 
                takipSuresi={takipSuresi} 
                isBest={i === 0 && siralamaSecenegi.endsWith('_desc')} 
                koyuMod={koyuMod}
              />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
function YorungeselAkisHaritasi({ t, koyuMod, aliskanliklar = [] }) {
  const [hoveredNode, setHoveredNode] = useState(null)

  // Son 12 günü hesapla (12 Farklı Yüzde Düğümü)
  const gunSayisi = 12
  const gunVerileri = useMemo(() => {
    const hasHabits = Array.isArray(aliskanliklar) && aliskanliklar.length > 0
    return Array.from({ length: gunSayisi }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (gunSayisi - 1 - i))
      const label = d.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })
      const shortLabel = d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric' })
      const isToday = i === gunSayisi - 1

      let tamamlanan = 0
      if (hasHabits) {
        aliskanliklar.forEach(a => {
          const gecmisDizisi = a.gecmis && a.gecmis.length > 0 
            ? a.gecmis 
            : Array(gunSayisi).fill(a.durum === DURUM.TAMAMLANDI ? 1 : 0)
          
          const idx = gecmisDizisi.length - gunSayisi + i
          if (idx >= 0 && gecmisDizisi[idx] === 1) {
            tamamlanan++
          } else if (isToday && a.durum === DURUM.TAMAMLANDI) {
            tamamlanan++
          }
        })
      }

      const toplam = aliskanliklar.length
      const hesaplananOran = toplam > 0 ? (tamamlanan / toplam) : 0
      const oran = Math.min(1, Math.max(0, hesaplananOran))

      const angleDeg = (i * (360 / gunSayisi)) - 90
      const angleRad = (angleDeg * Math.PI) / 180

      const baseR = hasHabits ? 80 : 70
      const r = baseR + oran * 75
      const x = 210 + r * Math.cos(angleRad)
      const y = 175 + r * Math.sin(angleRad)

      // Radial Label Position (Çakışmasız Radyal Dış Etiket)
      const labelR = r + (hasHabits ? 26 : 20)
      const lx = 210 + labelR * Math.cos(angleRad)
      const ly = 175 + labelR * Math.sin(angleRad) + 4

      return { id: i, label, shortLabel, isToday, tamamlanan, toplam, oran, x, y, lx, ly, hasHabits }
    })
  }, [aliskanliklar])

  const cx = 210
  const cy = 175

  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none' }}>
      
      <style>{`
        @keyframes orbitCircleSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .rotating-orbit-ring {
          transform-origin: 210px 175px;
          animation: orbitCircleSpin 40s linear infinite;
        }
        .rotating-today-aura {
          animation: orbitCircleSpin 3s linear infinite;
        }
      `}</style>

      <svg width="450" height="360" viewBox="0 0 450 360" style={{ overflow: 'visible' }}>
        <defs>
          {/* Siyah-Mavimsi Derin Siber Radyal Gradyan */}
          <radialGradient id="vibrantCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#FB923C" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#050711" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="vibrantOrbGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="50%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#1E1B4B" />
          </linearGradient>

          <filter id="neonLaserGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ─── DÖNEN KESİKLİ DIŞ YÖRÜNGE HALKALARI ─────────────────────── */}
        {[65, 115, 165].map((r, idx) => (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={t.kenarlik}
            strokeDasharray="4 8"
            strokeOpacity={0.35}
            className="rotating-orbit-ring"
          />
        ))}

        {/* ─── İNCE (PRECISION) LAZER BAĞLANTI ÇİZGİLERİ (Siyah-Mavi Siber Palet) ─── */}
        {gunVerileri.map(node => {
          const isToday = node.isToday
          // Uyumlu Siber Mavi Renk Skalası (Bugün #F97316, %70+ #FB923C, %40+ #EA580C, %20 #7C2D12)
          const strokeColor = isToday ? '#F97316' : (node.oran >= 0.7 ? '#FB923C' : node.oran >= 0.4 ? '#EA580C' : '#7C2D12')
          const strokeWidth = isToday ? 1.2 : 0.75
          const opacity = isToday ? 0.95 : (0.25 + node.oran * 0.45)

          return (
            <g key={`solid-line-${node.id}`}>
              {/* İnce Hassas Çizgi */}
              <line
                x1={cx}
                y1={cy}
                x2={node.x}
                y2={node.y}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeOpacity={opacity}
              />
              
              {/* BUGÜN İÇİN SIK VE AYNI RENKTE (ELEKTRİK MAVİ) KESİNTİSİZ AKIŞ TANECİKLERİ */}
              {isToday && (
                <g>
                  {/* İnce Elektrik Mavi Akış Yolu */}
                  <line
                    x1={cx}
                    y1={cy}
                    x2={node.x}
                    y2={node.y}
                    stroke="#F97316"
                    strokeWidth="1.2"
                    strokeOpacity="0.85"
                    filter="url(#neonLaserGlow)"
                  />
                  {/* 4 Adet Sık ve Aynı Renkte Elektrik Mavi Işık Taneciği Akışı */}
                  {[0, 0.35, 0.7, 1.05].map((beginTime, pIdx) => (
                    <circle
                      key={pIdx}
                      r="2.5"
                      fill="#F97316"
                      opacity={1 - pIdx * 0.15}
                      filter="url(#neonLaserGlow)"
                    >
                      <animate attributeName="cx" from={cx} to={node.x} dur="1.4s" begin={`${beginTime}s`} repeatCount="indefinite" />
                      <animate attributeName="cy" from={cy} to={node.y} dur="1.4s" begin={`${beginTime}s`} repeatCount="indefinite" />
                    </circle>
                  ))}
                </g>
              )}
            </g>
          )
        })}

        {/* ─── SIYAH-MAVİMSİ SİBER MERKEZ ÇEKİRDEK (Dark Blackish/Bluish Core) ─── */}
        <g>
          {/* Şeffaf Elektrik Mavi Dış Aura */}
          <circle cx={cx} cy={cy} r="44" fill="url(#vibrantCoreGlow)" />
          {/* Siyah-Mavimsi Koyu Küre */}
          <circle cx={cx} cy={cy} r="18" fill="#050711" stroke="#F97316" strokeWidth="2" filter="url(#neonLaserGlow)" />
          {/* İç Çekirdek Kontrast Çemberi */}
          <circle cx={cx} cy={cy} r="8" fill="#0A0E1A" stroke="#FB923C" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r="3" fill="#F97316" />
        </g>

        {/* ─── GÜN DÜĞÜMLERİ VE ÇAKIŞMASIZ RADYAL ETIKETLER ──────────── */}
        {gunVerileri.map(node => {
          const isToday = node.isToday
          const isHovered = hoveredNode === node.id
          
          const nodeColor = !node.hasHabits 
            ? '#334155' 
            : (isToday ? '#F97316' : (node.oran >= 0.7 ? '#10B981' : node.oran >= 0.4 ? '#F59E0B' : '#EF4444'))
          
          const nodeRadius = isToday ? 8 : (node.hasHabits ? 6 + node.oran * 4 : 5)
          const pctVal = `%${Math.round(node.oran * 100)}`

          return (
            <g
              key={`clean-node-${node.id}`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Bugünkü Dönen Halka Halesi */}
              {isToday && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={nodeRadius + 6}
                  fill="none"
                  stroke="#F97316"
                  strokeWidth="1.8"
                  strokeDasharray="4 4"
                  style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                  className="rotating-today-aura"
                />
              )}

              {/* Düğüm Noktası */}
              <circle
                cx={node.x}
                cy={node.y}
                r={isHovered ? nodeRadius + 3 : nodeRadius}
                fill={nodeColor}
                stroke="#0C0F1A"
                strokeWidth="1.5"
                filter={node.oran >= 0.4 ? 'url(#neonLaserGlow)' : 'none'}
                style={{ transition: 'all 0.15s ease' }}
              />

              {/* Çakışmasız Radyal Gün İsmi Etiketi */}
              <text
                x={node.lx}
                y={node.ly}
                textAnchor="middle"
                fill={isToday ? '#F97316' : (node.hasHabits ? t.baslik : '#64748B')}
                fontSize="10"
                fontWeight={isToday ? '900' : '700'}
                fontFamily="monospace"
              >
                {node.shortLabel}
              </text>

              {/* Yalnızca Alışkanlık Varsa Yüzde Rozetini Göster */}
              {node.hasHabits && node.oran > 0 && (
                <g>
                  <rect
                    x={node.x - 18}
                    y={node.y - 22}
                    width="36"
                    height="15"
                    rx="4"
                    fill="rgba(5, 7, 17, 0.94)"
                    stroke="#F97316"
                    strokeWidth="1"
                    strokeOpacity="0.85"
                  />
                  <text
                    x={node.x}
                    y={node.y - 11}
                    textAnchor="middle"
                    fill="#F97316"
                    fontSize="9"
                    fontWeight="900"
                    fontFamily="monospace"
                  >
                    {pctVal}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* ALİŞKANLIK YOKSA SADE BOŞ DURUM MESAJI */}
        {(!aliskanliklar || aliskanliklar.length === 0) && (
          <text
            x={cx}
            y={cy + 130}
            textAnchor="middle"
            fill="#64748B"
            fontSize="12"
            fontWeight="700"
          >
            Henüz alışkanlık eklenmedi
          </text>
        )}
      </svg>

      {/* HOVER TOOLTIP */}
      {hoveredNode !== null && (() => {
        const item = gunVerileri.find(n => n.id === hoveredNode)
        if (!item) return null
        return (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              position: 'absolute',
              bottom: '10px',
              background: 'rgba(12, 15, 26, 0.95)',
              color: '#10B981',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 800,
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
              border: '1px solid #10B981',
              textAlign: 'center',
              fontFamily: 'monospace',
              pointerEvents: 'none'
            }}
          >
            <div style={{ color: '#FFFFFF' }}>{item.label}</div>
            <div style={{ color: '#F97316', marginTop: '2px' }}>
              [{item.tamamlanan}/{item.toplam}] TAMAMLANDI - %{Math.round(item.oran * 100)}
            </div>
          </motion.div>
        )
      })()}

    </div>
  )
}




function SiralamaButon({ aktif, onClick, etiket, t, showIcon = true }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: '10px',
        border: `1px solid ${aktif ? '#8B5CF6' : t.kenarlik}`,
        background: aktif ? '#8B5CF6' : t.filtreBg,
        color: aktif ? '#FFFFFF' : t.alt,
        fontSize: '11px',
        fontWeight: 900,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'all 0.2s'
      }}
    >
      {etiket}
      {showIcon && <ArrowUpRight size={12} />}
    </button>
  )
}

function PerformansSatiri({ a, i, t, takipSuresi, isBest, koyuMod }) {
  const seriEmoji = a.seri > 0 ? '🔥' : '🌱'
  const katRenk = KATEGORI_RENKLERI[a.kategori] || '#8B5CF6'
  
  // Geçmiş Verisini Simüle Etme
  const getSimulatedGecmis = (gec = [], length, id) => {
    const numericId = typeof id === 'string' ? id.charCodeAt(0) : (id || 42)
    const totalGecmis = gec.length
    if (length <= totalGecmis) return gec.slice(-length)
    
    const padded = []
    const padLen = length - totalGecmis
    for (let idx = 0; idx < padLen; idx++) {
      const rand = Math.sin(numericId + idx) * 10000
      padded.push((rand - Math.floor(rand)) > 0.4 ? 1 : 0)
    }
    return [...padded, ...gec]
  }

  let showLength = 7
  if (takipSuresi === 'gunluk') showLength = 1
  if (takipSuresi === 'hafta') showLength = 7
  if (takipSuresi === '4hafta') showLength = 28
  if (takipSuresi === '3ay') showLength = 90
  if (takipSuresi === '6ay') showLength = 180

  const rawGecmis = getSimulatedGecmis(a.gecmis || [], showLength, a.id || a.ad)
  const genisGecmis = [...rawGecmis]
  // Sondaki üçgenin boyasını kaldır (yalnızca ilk üçgen dolu olsun)
  genisGecmis[genisGecmis.length - 1] = 0
  if (a.durum === DURUM.TAMAMLANDI) {
    genisGecmis[0] = 1
  } else {
    genisGecmis[0] = 0
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.15 }}
      whileHover={{ borderColor: '#8B5CF6' }}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 18px',
        borderRadius: '16px',
        gap: '14px',
        background: koyuMod ? '#141829' : '#FFFFFF',
        border: `1px solid ${t.kenarlik}`,
        boxShadow: 'none',
        transition: 'border-color 0.05s linear',
        marginBottom: '6px',
      }}
    >
      {/* Sol: İkon (Karesiz Direkt İkon) + Ad + Kategori */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '190px', flexShrink: 0 }}>
        <span style={{ fontSize: '24px', flexShrink: 0, lineHeight: 1 }}>{a.ikon}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: '14px', fontWeight: 800, color: t.baslik,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {a.ad}
          </div>
          <span style={{
            fontSize: '9px', fontWeight: 800, padding: '2px 7px', borderRadius: '6px',
            background: `${katRenk}18`, color: katRenk, border: `1px solid ${katRenk}30`,
            marginTop: '2px', display: 'inline-block'
          }}>
            {a.kategori}
          </span>
        </div>
      </div>

      {/* Orta: KENETLENEN YAPBOZ ŞERİDİ (7 Günlük Periyot Tek Satır, Uzun Periyotlar 2 Altlı Üstlü Satır) */}
      {(() => {
        const total = genisGecmis.length
        // 14 veya daha az eleman (örn. 7 günlük periyot veya 1 gün) TEK SATIRDA SIKINTISIZ SIĞAR!
        // Yalnızca 14'ten fazla eleman olduğunda (28 gün, 90 gün, 180 gün) 2 altlı üstlü satıra böl.
        const shouldSplit = total > 14
        const half = shouldSplit ? Math.ceil(total / 2) : total
        const ustSatir = genisGecmis.slice(0, half)
        const altSatir = shouldSplit ? genisGecmis.slice(half) : []

        return (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            minHeight: '34px',
            padding: '2px 0',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}>
            {/* ÜST SATIR (Row 1: ▲▼▲▼▲▼) */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {ustSatir.map((d, idx) => {
                const isUpright = idx % 2 === 0
                const triWidth = 16
                const triHeight = 17
                
                const seciliUcgenRenk = typeof window !== 'undefined' ? (localStorage.getItem('ucgenRenk') || '#16A34A') : '#16A34A'
                const triColor = d === 1 ? seciliUcgenRenk : (koyuMod ? '#1E293B' : '#CBD5E1')
                // HER BİR ÜÇGENİN ETRAFINA KUSURSUZ BEYAZ ÇERÇEVE ÇİZGİSİ
                const strokeCol = d === 1 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)'

                return (
                  <motion.div
                    key={`top-${idx}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.02 + idx * 0.003 }}
                    title={d === 1 ? `Gün ${idx + 1}: Tamamlandı (%100)` : `Gün ${idx + 1}: Tamamlanmadı (%0)`}
                    style={{
                      width: `${triWidth}px`,
                      height: `${triHeight}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginRight: '-4.5px',
                      zIndex: d === 1 ? 2 : 1,
                    }}
                  >
                    <svg width={triWidth} height={triHeight} viewBox="0 0 12 14" style={{ overflow: 'visible' }}>
                      {isUpright ? (
                        /* DÜZ MAT ÜÇGEN ▲ BEYAZ ÇİZGİLİ */
                        <polygon
                          points="6,0 12,14 0,14"
                          fill={triColor}
                          stroke={strokeCol}
                          strokeWidth="1"
                        />
                      ) : (
                        /* TERS MAT ÜÇGEN ▼ BEYAZ ÇİZGİLİ */
                        <polygon
                          points="0,0 12,0 6,14"
                          fill={triColor}
                          stroke={strokeCol}
                          strokeWidth="1"
                        />
                      )}
                    </svg>
                  </motion.div>
                )
              })}
            </div>

            {/* ALT SATIR (Row 2: ▼▲▼▲▼▲ - Üst Satırdaki Düz Üçgenlerin Altına Oturan Ters Yönlü Sıra) */}
            {altSatir.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '1px' }}>
                {altSatir.map((d, idx) => {
                  const isUpright = idx % 2 === 1
                  const triWidth = 16
                  const triHeight = 17
                  
                  const seciliUcgenRenk = typeof window !== 'undefined' ? (localStorage.getItem('ucgenRenk') || '#16A34A') : '#16A34A'
                const triColor = d === 1 ? seciliUcgenRenk : (koyuMod ? '#1E293B' : '#CBD5E1')
                  // HER BİR ÜÇGENİN ETRAFINA KUSURSUZ BEYAZ ÇERÇEVE ÇİZGİSİ
                  const strokeCol = d === 1 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)'

                  return (
                    <motion.div
                      key={`bot-${idx}`}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.02 + (half + idx) * 0.003 }}
                      title={d === 1 ? `Gün ${half + idx + 1}: Tamamlandı (%100)` : `Gün ${half + idx + 1}: Tamamlanmadı (%0)`}
                      style={{
                        width: `${triWidth}px`,
                        height: `${triHeight}px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginRight: '-4.5px',
                        zIndex: d === 1 ? 2 : 1,
                      }}
                    >
                      <svg width={triWidth} height={triHeight} viewBox="0 0 12 14" style={{ overflow: 'visible' }}>
                        {isUpright ? (
                          /* DÜZ MAT ÜÇGEN ▲ BEYAZ ÇİZGİLİ */
                          <polygon
                            points="6,0 12,14 0,14"
                            fill={triColor}
                            stroke={strokeCol}
                            strokeWidth="1"
                          />
                        ) : (
                          /* TERS MAT ÜÇGEN ▼ BEYAZ ÇİZGİLİ */
                          <polygon
                            points="0,0 12,0 6,14"
                            fill={triColor}
                            stroke={strokeCol}
                            strokeWidth="1"
                          />
                        )}
                      </svg>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Sağ: Seri + Başarı Yüzdesi Rozeti */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '15px' }}>{seriEmoji}</span>
          <span style={{ fontSize: isBest ? '16px' : '14px', fontWeight: 900, color: isBest ? '#F97316' : t.baslik, fontFamily: 'monospace' }}>
            {a.seri}
          </span>
          <span style={{ fontSize: '10px', color: t.alt, fontWeight: 700 }}>GÜN</span>
        </div>

        <div style={{
          minWidth: '46px', textAlign: 'center',
          fontSize: '12px', fontWeight: 900,
          color: a.basariskor >= 80 ? '#10B981' : '#F97316',
          fontFamily: 'monospace',
          padding: '4px 9px',
          borderRadius: '8px',
          background: a.basariskor >= 80 ? 'rgba(16,185,129,0.14)' : 'rgba(249,115,22,0.14)',
          border: `1px solid ${a.basariskor >= 80 ? 'rgba(16,185,129,0.3)' : 'rgba(249,115,22,0.3)'}`
        }}>
          %{a.basariskor}
        </div>
      </div>
    </motion.div>
  )
}

function OzelDropdown({ secili, onChange, secenekler, genislik = '165px', t }) {
  const [acik, setAcik] = useState(false)
  const ref = React.useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setAcik(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const seciliEtiket = secenekler.find(s => s.value === secili)?.label || ''

  return (
    <div ref={ref} style={{ position: 'relative', width: genislik }}>
      <button
        onClick={() => setAcik(!acik)}
        style={{
          width: '100%',
          padding: '8px 14px',
          borderRadius: '12px',
          border: `1px solid ${acik ? '#8B5CF6' : t.kenarlik}`,
          background: t.filtreBg,
          color: t.baslik,
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          transition: 'all 0.2s ease',
          outline: 'none',
          boxShadow: acik ? '0 0 0 2px rgba(139, 92, 246, 0.25)' : 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seciliEtiket}</span>
        <ChevronDown size={14} color={acik ? '#8B5CF6' : t.alt} style={{ transform: acik ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
      </button>

      <AnimatePresence>
        {acik && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 100,
              background: '#141829',
              border: `1px solid ${t.kenarlik}`,
              borderRadius: '14px',
              padding: '6px',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              marginTop: '4px',
            }}
          >
            {secenekler.map((s) => {
              const aktif = s.value === secili
              return (
                <button
                  key={s.value}
                  onClick={() => {
                    onChange(s.value)
                    setAcik(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: 'none',
                    background: aktif ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                    color: aktif ? '#A78BFA' : t.baslik,
                    fontSize: '12px',
                    fontWeight: aktif ? 800 : 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={(e) => { if (!aktif) e.currentTarget.style.background = '#1C2136' }}
                  onMouseLeave={(e) => { if (!aktif) e.currentTarget.style.background = 'transparent' }}
                >
                  <span>{s.label}</span>
                  {aktif && <CheckCircle2 size={12} color="#A78BFA" />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

