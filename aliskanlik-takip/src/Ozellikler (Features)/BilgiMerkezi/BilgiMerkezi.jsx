import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import {
  Brain, Sparkles, Plus, Search, Trash2,
  Zap, CheckCircle2, XCircle, Star, Award,
  Lightbulb, X
} from 'lucide-react'

// HER İNSANIN İHTİYACI OLAN 5 TEMEL BİLGİ ALANI
const TEMEL_KATEGORILER = [
  { id: 'dil', name: '🔤 Dil & Kelime', color: '#6366F1' },
  { id: 'zihin', name: '🧠 Zihinsel Modeller', color: '#10B981' },
  { id: 'kultur', name: '💡 Genel Kültür', color: '#F59E0B' },
  { id: 'finans', name: '💼 Finansal Okuryazarlık', color: '#EC4899' },
  { id: 'uretim', name: '⚡ Üretkenlik', color: '#0EA5E9' },
]

// BAŞLANGIÇ HAFIZA DEPOSU (Çağrışımlı İpuçları)
const VARSAYILAN_HAFIZA = [
  {
    id: 1,
    kategoriId: 'dil',
    kavram: 'Resilient',
    anlam: 'Zorluklar karşısında güçlü kalan, pes etmeyen',
    cagrisim: '💡 REZİL olsan bile pes etmeyip ayağa kalkmak',
    yildiz: true
  },
  {
    id: 2,
    kategoriId: 'dil',
    kavram: 'Meticulous',
    anlam: 'Çok titiz, detaylara aşırı özen gösteren',
    cagrisim: '💡 METİK (Matematik) gibi milimetrik ve titiz çalışmak',
    yildiz: true
  },
  {
    id: 3,
    kategoriId: 'dil',
    kavram: 'Eloquent',
    anlam: 'Akıcı, ikna edici ve etkileyici konuşan',
    cagrisim: '💡 ELO seviyesi yüksek, lafı gediğine koyan konuşmacı',
    yildiz: false
  },
  {
    id: 4,
    kategoriId: 'zihin',
    kavram: 'Pareto İlkesi (80/20)',
    anlam: 'Sonuçların %80’i, çabaların %20’sinden doğar',
    cagrisim: '💡 Kıyafetlerinin %20’sini zamanın %80’inde giyersin',
    yildiz: true
  },
  {
    id: 5,
    kategoriId: 'zihin',
    kavram: 'First Principles',
    anlam: 'Sorunu temel bileşenlerine ayırıp sıfırdan çözüm üretme',
    cagrisim: '💡 Evi tamir etmeyip temeli baştan inşa eden Elon Musk yöntemi',
    yildiz: false
  },
  {
    id: 6,
    kategoriId: 'finans',
    kavram: 'Bileşik Büyüme',
    anlam: 'Kazancın da kazanç getirmesiyle oluşan katlanma',
    cagrisim: '💡 Tepeden yuvarlanan kar topunun dev çığa dönüşmesi',
    yildiz: true
  },
  {
    id: 7,
    kategoriId: 'kultur',
    kavram: 'Sirkadiyen Ritim',
    anlam: 'Vücudun 24 saatlik biyolojik iç saati',
    cagrisim: '💡 SİRKteki saat gibi düzenli dönen biyolojik ritmimiz',
    yildiz: false
  },
  {
    id: 8,
    kategoriId: 'uretim',
    kavram: '2 Dakika Kuralı',
    anlam: '2 dakikadan kısa sürecek işi anında yap',
    cagrisim: '💡 Diş fırçalamak gibi: 2 dk sürüyorsa bekleme yapma!',
    yildiz: true
  }
]

export default function BilgiMerkezi({ koyuMod }) {
  const [aktifKategoriId, setAktifKategoriId] = useState('dil')
  const [arama, setArama] = useState('')

  // LocalStorage Persisted State
  const [hafizaListesi, setHafizaListesi] = useState(() => {
    const saved = localStorage.getItem('bilgi_merkezi_hafiza_v3')
    return saved ? JSON.parse(saved) : VARSAYILAN_HAFIZA
  })

  // Ekleme Modalı State
  const [ekleModal, setEkleModal] = useState(false)
  const [yeniKavram, setYeniKavram] = useState('')
  const [yeniAnlam, setYeniAnlam] = useState('')
  const [yeniCagrisim, setYeniCagrisim] = useState('')

  // AKIL OYUNLARI TEST MODU STATE
  const [testAktif, setTestAktif] = useState(false)
  const [testSoruIndex, setTestSoruIndex] = useState(0)
  const [secilenSik, setSecilenSik] = useState(null)
  const [testSkor, setTestSkor] = useState(0)
  const [testBitti, setTestBitti] = useState(false)

  // LocalStorage Sync
  useEffect(() => {
    localStorage.setItem('bilgi_merkezi_hafiza_v3', JSON.stringify(hafizaListesi))
  }, [hafizaListesi])

  const t = {
    baslik:    koyuMod ? '#F1F5F9' : '#0F172A',
    altMetin:  koyuMod ? '#94A3B8' : '#64748B',
    kart:      koyuMod ? '#1E293B' : '#FFFFFF',
    kenarlik:  koyuMod ? '#334155' : '#E2E8F0',
    subBg:     koyuMod ? '#111827' : '#F8FAFC',
    orange:    '#F97316',
  }

  const aktifKategori = useMemo(() => {
    return TEMEL_KATEGORILER.find(k => k.id === aktifKategoriId) || TEMEL_KATEGORILER[0]
  }, [aktifKategoriId])

  // Yeni Bilgi Ekleme
  const bilgiKaydet = (e) => {
    e.preventDefault()
    if (!yeniKavram.trim() || !yeniAnlam.trim()) return

    const yeniItem = {
      id: Date.now(),
      kategoriId: aktifKategoriId,
      kavram: yeniKavram.trim(),
      anlam: yeniAnlam.trim(),
      cagrisim: yeniCagrisim.trim() ? `💡 ${yeniCagrisim.trim()}` : `💡 Çağrışım: ${yeniKavram.trim()} kilit nesnesi`,
      yildiz: false
    }

    setHafizaListesi(prev => [yeniItem, ...prev])
    setYeniKavram('')
    setYeniAnlam('')
    setYeniCagrisim('')
    setEkleModal(false)
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } })
  }

  const itemSil = (id) => {
    setHafizaListesi(prev => prev.filter(item => item.id !== id))
  }

  const itemYildizToggle = (id) => {
    setHafizaListesi(prev => prev.map(item => item.id === id ? { ...item, yildiz: !item.yildiz } : item))
  }

  const filtrelenmisHafiza = useMemo(() => {
    return hafizaListesi.filter(item => {
      const katEslesiyor = item.kategoriId === aktifKategoriId
      const aramaEslesiyor = item.kavram.toLowerCase().includes(arama.toLowerCase()) ||
                             item.anlam.toLowerCase().includes(arama.toLowerCase())
      return katEslesiyor && aramaEslesiyor
    })
  }, [hafizaListesi, aktifKategoriId, arama])

  // TEST SORULARI
  const testSorulari = useMemo(() => {
    const havuz = hafizaListesi.length >= 3 ? hafizaListesi : VARSAYILAN_HAFIZA
    return havuz.map(hedef => {
      const digerleri = havuz.filter(x => x.id !== hedef.id)
      const rastgeleYanlislar = digerleri.sort(() => 0.5 - Math.random()).slice(0, 3).map(x => x.anlam)
      const tumSiklar = [hedef.anlam, ...rastgeleYanlislar].sort(() => 0.5 - Math.random())
      return {
        id: hedef.id,
        kavram: hedef.kavram,
        dogruAnlam: hedef.anlam,
        cagrisim: hedef.cagrisim,
        siklar: tumSiklar
      }
    }).sort(() => 0.5 - Math.random())
  }, [hafizaListesi, testAktif])

  const mevcutSoru = testSorulari[testSoruIndex] || testSorulari[0]

  const testSikSec = (sik) => {
    if (secilenSik !== null) return
    setSecilenSik(sik)

    if (sik === mevcutSoru.dogruAnlam) {
      setTestSkor(prev => prev + 20)
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } })
    }

    setTimeout(() => {
      if (testSoruIndex + 1 >= Math.min(5, testSorulari.length)) {
        setTestBitti(true)
      } else {
        setTestSoruIndex(prev => prev + 1)
        setSecilenSik(null)
      }
    }, 1300)
  }

  const testBaslat = () => {
    setTestAktif(true)
    setTestSoruIndex(0)
    setSecilenSik(null)
    setTestSkor(0)
    setTestBitti(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '60px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>

      {/* ─── 1. SADE BAŞLIK & EYLEM BARI ─────────────────────────────────── */}
      <div style={{
        background: t.kart,
        borderRadius: '24px',
        padding: '24px 28px',
        border: `1px solid ${t.kenarlik}`,
        boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: 'italic',
            fontSize: '26px',
            fontWeight: 400,
            color: t.baslik,
            margin: 0,
            letterSpacing: '-0.5px'
          }}>
            Hafıza & Çağrışım Deposu
          </h1>
          <p style={{ fontSize: '13px', color: t.altMetin, margin: '4px 0 0', fontWeight: 600 }}>
            Öğrendiğin kelimeleri benzettiğin ipuçlarıyla kaydet ve günlük test yap
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Ekle Butonu */}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setEkleModal(true)}
            style={{
              padding: '12px 20px', borderRadius: '16px', border: `1px solid ${t.kenarlik}`,
              background: t.subBg, color: t.baslik, fontSize: '13px', fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
            }}
          >
            <Plus size={16} color="#6366F1" /> Kelime / Bilgi Ekle
          </motion.button>

          {/* Test Başlat Butonu */}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={testBaslat}
            style={{
              padding: '12px 22px', borderRadius: '16px', border: 'none',
              background: 'linear-gradient(135deg, #F97316, #EC4899)', color: '#FFFFFF',
              fontSize: '13px', fontWeight: 900,
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(249, 115, 22, 0.3)'
            }}
          >
            <Zap size={16} fill="#FFF" /> Günlük Test Yap
          </motion.button>
        </div>
      </div>

      {/* ─── 2. SADE KATEGORİ HAPLARI (PILL TABS) ───────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        {TEMEL_KATEGORILER.map(kat => {
          const aktif = kat.id === aktifKategoriId
          return (
            <button
              key={kat.id}
              onClick={() => setAktifKategoriId(kat.id)}
              style={{
                padding: '10px 20px',
                borderRadius: '20px',
                border: `1px solid ${aktif ? kat.color : t.kenarlik}`,
                background: aktif ? `${kat.color}15` : t.kart,
                color: aktif ? kat.color : t.altMetin,
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {kat.name}
            </button>
          )
        })}
      </div>

      {/* ─── 3. KART LİSTESİ & ARAMA BARI ─────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Arama Barı */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: t.altMetin }}>
            {aktifKategori.name} ({filtrelenmisHafiza.length})
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Kelime veya anlam ara..."
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px 10px 40px', borderRadius: '16px',
                border: `1px solid ${t.kenarlik}`, background: t.kart,
                fontSize: '13px', color: t.baslik, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Kartlar Izgarası */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          <AnimatePresence>
            {filtrelenmisHafiza.length === 0 ? (
              <div style={{ gridColumn: '1/-1', padding: '60px 20px', textAlign: 'center', background: t.kart, borderRadius: '24px', border: `1px solid ${t.kenarlik}`, color: t.altMetin, fontSize: '14px', fontWeight: 600 }}>
                Bu alanda henüz bir kelime yok. Sağ üstteki <b>"+ Kelime / Bilgi Ekle"</b> butonundan anında ekleyebilirsin! 💡
              </div>
            ) : filtrelenmisHafiza.map(item => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ y: -3 }}
                style={{
                  background: t.kart,
                  borderRadius: '22px',
                  padding: '22px',
                  border: `1px solid ${t.kenarlik}`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
                }}
              >
                <div>
                  {/* Başlık & İşlem Butonları */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 900, color: t.baslik, margin: 0, letterSpacing: '-0.3px' }}>
                      {item.kavram}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => itemYildizToggle(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <Star size={16} fill={item.yildiz ? '#F59E0B' : 'none'} color={item.yildiz ? '#F59E0B' : t.altMetin} />
                      </button>
                      <button
                        onClick={() => itemSil(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: t.altMetin }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Türkçe Anlamı */}
                  <div style={{ fontSize: '13px', fontWeight: 700, color: aktifKategori.color, marginBottom: '12px' }}>
                    🇹🇷 {item.anlam}
                  </div>

                  {/* Benzetme / Çağrışım İpucu */}
                  <div style={{
                    fontSize: '12px', fontWeight: 700, color: t.orange,
                    padding: '10px 14px', borderRadius: '14px',
                    background: 'rgba(249, 115, 22, 0.1)', border: '1px dashed rgba(249, 115, 22, 0.3)',
                    lineHeight: 1.4
                  }}>
                    {item.cagrisim}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── YENİ KELİME / BİLGİ EKLEME MODALI ───────────────────────────── */}
      <AnimatePresence>
        {ekleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEkleModal(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)', zIndex: 9000, display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: t.kart, borderRadius: '28px', padding: '32px',
                width: '100%', maxWidth: '480px', border: `1px solid ${t.kenarlik}`,
                boxShadow: '0 24px 60px rgba(0,0,0,0.3)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: t.baslik }}>
                  Yeni Kelime / Bilgi Kaydet
                </h3>
                <button onClick={() => setEkleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.altMetin }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={bilgiKaydet} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: t.altMetin, marginBottom: '6px', display: 'block' }}>KATEGORİ</label>
                  <select
                    value={aktifKategoriId}
                    onChange={(e) => setAktifKategoriId(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '14px',
                      border: `1px solid ${t.kenarlik}`, background: t.subBg,
                      fontSize: '13px', fontWeight: 800, color: t.baslik, outline: 'none', fontFamily: 'inherit'
                    }}
                  >
                    {TEMEL_KATEGORILER.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: t.altMetin, marginBottom: '6px', display: 'block' }}>KELİME / KAVRAM</label>
                  <input
                    placeholder="Örn: Resilient"
                    value={yeniKavram}
                    onChange={e => setYeniKavram(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '14px',
                      border: `1px solid ${t.kenarlik}`, background: t.subBg,
                      fontSize: '14px', fontWeight: 700, color: t.baslik, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: t.altMetin, marginBottom: '6px', display: 'block' }}>TÜRKÇE ANLAMI</label>
                  <input
                    placeholder="Örn: Güçlü, esneyebilen, pes etmeyen"
                    value={yeniAnlam}
                    onChange={e => setYeniAnlam(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '14px',
                      border: `1px solid ${t.kenarlik}`, background: t.subBg,
                      fontSize: '13px', color: t.baslik, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: t.altMetin, marginBottom: '6px', display: 'block' }}>BENZETME / ÇAĞRIŞIM İPUCU</label>
                  <input
                    placeholder="Örn: REZİL olsa da pes etmeyen kişi"
                    value={yeniCagrisim}
                    onChange={e => setYeniCagrisim(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '14px',
                      border: `1px solid ${t.kenarlik}`, background: t.subBg,
                      fontSize: '13px', color: t.baslik, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  style={{
                    marginTop: '8px', padding: '14px', borderRadius: '16px', border: 'none',
                    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#FFF',
                    fontSize: '14px', fontWeight: 900, cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(99, 102, 241, 0.35)'
                  }}
                >
                  Hafızaya Kaydet 💡
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── AKIL OYUNLARI TEST MODU MODALI ─────────────────────────────── */}
      <AnimatePresence>
        {testAktif && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(10, 13, 26, 0.85)',
              backdropFilter: 'blur(12px)', zIndex: 9999, display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={{
                background: t.kart, borderRadius: '32px', padding: '36px',
                width: '100%', maxWidth: '540px', border: `1px solid ${t.kenarlik}`,
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)', position: 'relative'
              }}
            >
              <button
                onClick={() => setTestAktif(false)}
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: t.altMetin, cursor: 'pointer' }}
              >
                <X size={20} />
              </button>

              {!testBitti ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: t.orange }}>
                      🎯 SORU {testSoruIndex + 1} / {Math.min(5, testSorulari.length)}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 900, color: '#10B981', fontFamily: 'monospace' }}>
                      Puan: {testSkor}
                    </span>
                  </div>

                  <div style={{
                    background: 'linear-gradient(135deg, #1E1B4B, #312E81)',
                    borderRadius: '24px', padding: '28px 24px', color: '#FFF',
                    textAlign: 'center', marginBottom: '24px', boxShadow: '0 12px 30px rgba(99, 102, 241, 0.25)'
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, opacity: 0.6, letterSpacing: '1px', textTransform: 'uppercase' }}>
                      BU KELİMENİN / KAVRAMIN ANLAMI NEDİR?
                    </span>
                    <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '12px 0 0', letterSpacing: '-0.5px' }}>
                      {mevcutSoru?.kavram}
                    </h2>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {mevcutSoru?.siklar.map((sik, idx) => {
                      const secildi = secilenSik === sik
                      const dogruMu = sik === mevcutSoru.dogruAnlam
                      let bg = t.subBg
                      let border = t.kenarlik
                      let color = t.baslik

                      if (secilenSik !== null) {
                        if (dogruMu) {
                          bg = 'rgba(16, 185, 129, 0.2)'
                          border = '#10B981'
                          color = '#10B981'
                        } else if (secildi && !dogruMu) {
                          bg = 'rgba(239, 68, 68, 0.2)'
                          border = '#EF4444'
                          color = '#EF4444'
                        }
                      }

                      return (
                        <motion.button
                          key={idx}
                          whileHover={{ scale: secilenSik === null ? 1.01 : 1 }}
                          whileTap={{ scale: secilenSik === null ? 0.98 : 1 }}
                          onClick={() => testSikSec(sik)}
                          style={{
                            padding: '16px 20px', borderRadius: '16px', border: `1.5px solid ${border}`,
                            background: bg, color: color, fontSize: '13px', fontWeight: 700,
                            textAlign: 'left', cursor: secilenSik === null ? 'pointer' : 'default',
                            transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                          }}
                        >
                          <span>{String.fromCharCode(65 + idx)}) {sik}</span>
                          {secilenSik !== null && dogruMu && <CheckCircle2 size={18} color="#10B981" />}
                          {secilenSik !== null && secildi && !dogruMu && <XCircle size={18} color="#EF4444" />}
                        </motion.button>
                      )
                    })}
                  </div>

                  {secilenSik !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        marginTop: '18px', padding: '12px 16px', borderRadius: '14px',
                        background: 'rgba(249, 115, 22, 0.12)', border: '1px solid rgba(249, 115, 22, 0.3)',
                        fontSize: '12px', color: t.orange, fontWeight: 700, lineHeight: 1.4
                      }}
                    >
                      {mevcutSoru.cagrisim}
                    </motion.div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <Award size={56} color="#F97316" style={{ margin: '0 auto 16px' }} />
                  <h2 style={{ fontSize: '24px', fontWeight: 900, color: t.baslik, margin: '0 0 8px' }}>
                    Tebrikler! Akıl Testi Tamamlandı 🎉
                  </h2>
                  <p style={{ fontSize: '13px', color: t.altMetin, margin: '0 0 20px' }}>
                    Zihinsel pratik ile nöron bağlantılarını güçlendirdin.
                  </p>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#10B981', marginBottom: '24px', fontFamily: 'monospace' }}>
                    {testSkor} PUAN
                  </div>
                  <button
                    onClick={testBaslat}
                    style={{
                      padding: '14px 32px', borderRadius: '18px', border: 'none',
                      background: 'linear-gradient(135deg, #F97316, #EC4899)', color: '#FFF',
                      fontSize: '14px', fontWeight: 900, cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(249, 115, 22, 0.4)'
                    }}
                  >
                    Yeniden Test Yap 🔄
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
