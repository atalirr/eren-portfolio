/* ================================================================
   AyarlarSayfasi.jsx — Gelişmiş Uygulama Ayarları & Tema Paneli
   Üçgen renk teması özelleştirme, animasyon hızı, bildirimler ve veri yönetimi.
   ================================================================ */
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Moon, Sun, Plus, Settings, ShieldCheck, Palette, Bell, Info, Sliders, Zap, Download, RefreshCw, Check
} from 'lucide-react'

const UCGEN_RENK_SECENEKLERI = [
  { id: 'yesil', ad: 'Zümrüt Yeşil', kod: '#16A34A', glow: 'rgba(22, 163, 74, 0.4)' },
  { id: 'cyan', ad: 'Elektrik Mavi', kod: '#00F0FF', glow: 'rgba(0, 240, 255, 0.4)' },
  { id: 'violet', ad: 'Neon Menekşe', kod: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.4)' },
  { id: 'amber', ad: 'Kehribar Altın', kod: '#F59E0B', glow: 'rgba(245, 158, 11, 0.4)' },
  { id: 'rose', ad: 'Gül Kırmızısı', kod: '#F43F5E', glow: 'rgba(244, 63, 94, 0.4)' },
]

export default function AyarlarSayfasi({ koyuMod, setKoyuMod, onOpenModal }) {
  const [seciliUcgenRenk, setSeciliUcgenRenk] = useState(() => {
    return localStorage.getItem('ucgenRenk') || '#16A34A'
  })

  const [hatirlaticiSaati, setHatirlaticiSaati] = useState(() => {
    return localStorage.getItem('hatirlaticiSaati') || '21:00'
  })

  const [seriUyariAktif, setSeriUyariAktif] = useState(() => {
    return localStorage.getItem('seriUyari') !== 'false'
  })

  const [akisHizi, setAkisHizi] = useState(() => {
    return localStorage.getItem('akisHizi') || 'dengeli'
  })

  const t = {
    bg: '#090D16',
    kart: koyuMod ? '#121626' : '#FFFFFF',
    metin: koyuMod ? '#FFFFFF' : '#0F172A',
    alt: koyuMod ? '#94A3B8' : '#64748B',
    kenarlik: koyuMod ? '#1E2340' : '#E2E8F0',
    orange: '#F97316',
    subBg: koyuMod ? '#171C2E' : '#F8FAFC',
  }

  const handleUcgenRenkDegistir = (kod) => {
    setSeciliUcgenRenk(kod)
    localStorage.setItem('ucgenRenk', kod)
    window.dispatchEvent(new Event('ucgenRenkDegisti'))
  }

  const handleHatirlaticiDegistir = (saat) => {
    setHatirlaticiSaati(saat)
    localStorage.setItem('hatirlaticiSaati', saat)
  }

  const handleSeriUyariToggle = () => {
    const yeni = !seriUyariAktif
    setSeriUyariAktif(yeni)
    localStorage.setItem('seriUyari', yeni.toString())
  }

  const handleAkisHiziDegistir = (hiz) => {
    setAkisHizi(hiz)
    localStorage.setItem('akisHizi', hiz)
  }

  const handleVeriIndir = () => {
    const data = {
      tarih: new Date().toISOString(),
      ayarlar: { koyuMod, seciliUcgenRenk, hatirlaticiSaati, akisHizi }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aliskanlik_takip_yedek_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '640px', margin: '0 auto' }}
    >
      {/* ─── BAŞLIK ────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: 'italic',
          fontSize: '34px',
          fontWeight: 400,
          color: t.metin,
          margin: '0 0 6px 0',
        }}>
          Sistem Ayarları
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: t.alt }}>
          Görünüm, üçgen temaları, bildirimler ve sistem yapılandırması.
        </p>
      </div>

      {/* ─── 🎨 ÜÇGEN RENK TEMASI ÖZELLEŞTİRME ──────────────────── */}
      <div style={{
        background: t.kart,
        borderRadius: '16px',
        padding: '24px',
        border: `1px solid ${t.kenarlik}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Palette size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: t.metin }}>Performans Üçgen Renk Teması</h3>
              <span style={{ fontSize: '12px', color: t.alt }}>Günlük takip listesindeki üçgenlerin rengini seçin</span>
            </div>
          </div>
        </div>

        {/* Renk Seçenekleri Paleti */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
          {UCGEN_RENK_SECENEKLERI.map((renk) => {
            const isSelected = seciliUcgenRenk === renk.kod
            return (
              <motion.div
                key={renk.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleUcgenRenkDegistir(renk.kod)}
                style={{
                  background: isSelected ? `${renk.kod}15` : t.subBg,
                  border: `2px solid ${isSelected ? renk.kod : t.kenarlik}`,
                  borderRadius: '12px',
                  padding: '12px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: renk.kod,
                  boxShadow: `0 0 10px ${renk.glow}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {isSelected && <Check size={14} color="#FFF" strokeWidth={3} />}
                </div>
                <span style={{ fontSize: '11px', fontWeight: isSelected ? 800 : 600, color: isSelected ? renk.kod : t.metin }}>
                  {renk.ad}
                </span>
              </motion.div>
            )
          })}
        </div>

        {/* Canlı Üçgen Kenetlenme Önizlemesi */}
        <div style={{
          background: t.subBg,
          padding: '14px 18px',
          borderRadius: '12px',
          border: `1px solid ${t.kenarlik}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '12px', color: t.alt, fontWeight: 600 }}>Canlı Önizleme:</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {[1, 1, 1, 0, 1, 1, 0, 1].map((d, idx) => {
              const isUpright = idx % 2 === 0
              const triColor = d === 1 ? seciliUcgenRenk : (koyuMod ? '#1E293B' : '#CBD5E1')
              return (
                <div key={idx} style={{ width: '16px', height: '17px', marginRight: '-4.5px' }}>
                  <svg width="16" height="17" viewBox="0 0 12 14">
                    <polygon
                      points={isUpright ? "6,0 12,14 0,14" : "0,0 12,0 6,14"}
                      fill={triColor}
                      stroke={d === 1 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)'}
                      strokeWidth="1"
                    />
                  </svg>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─── TEMA VE GÖRÜNÜM AYARI ─────────────────────────────── */}
      <div style={{
        background: t.kart,
        borderRadius: '16px',
        padding: '24px',
        border: `1px solid ${t.kenarlik}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(249, 115, 22, 0.15)', color: t.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Moon size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: t.metin }}>Genel Tema Modu</h3>
            <span style={{ fontSize: '12px', color: t.alt }}>Karanlık gece veya aydınlık gündüz tercihi</span>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: t.subBg,
          padding: '16px 20px',
          borderRadius: '12px',
          border: `1px solid ${t.kenarlik}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {koyuMod ? <Moon size={20} color={t.orange} /> : <Sun size={20} color={t.orange} />}
            <span style={{ fontSize: '14px', fontWeight: 700, color: t.metin }}>
              {koyuMod ? 'Karanlık Gece Modu (Aktif)' : 'Aydınlık Gündüz Modu (Aktif)'}
            </span>
          </div>

          <motion.div
            onClick={() => setKoyuMod(!koyuMod)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              width: '54px', height: '28px',
              background: koyuMod ? '#1E2340' : '#E2E8F0',
              borderRadius: '100px', padding: '3px', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              border: `1px solid ${t.kenarlik}`,
            }}
          >
            <motion.div
              animate={{ x: koyuMod ? 26 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{
                width: '22px', height: '22px', 
                background: koyuMod ? t.orange : '#FFFFFF',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
              }}
            >
              {koyuMod ? <Sun size={11} color="#FFF" fill="#FFF" /> : <Moon size={11} color="#6366F1" fill="#6366F1" />}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ─── ⚡ YÖRÜNGESEL HARİTA AKIŞ HIZI ─────────────────────── */}
      <div style={{
        background: t.kart,
        borderRadius: '16px',
        padding: '24px',
        border: `1px solid ${t.kenarlik}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(0, 240, 255, 0.15)', color: '#00F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: t.metin }}>Yörüngesel Isı Haritası Akış Hızı</h3>
            <span style={{ fontSize: '12px', color: t.alt }}>Lazer akış parçacıklarının animasyon temposu</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {[
            { id: 'yavas', etiket: 'Yavaş (Sakin)' },
            { id: 'dengeli', etiket: 'Dengeli (Varsayılan)' },
            { id: 'hizli', etiket: 'Hızlı (Seri)' },
          ].map((hiz) => (
            <button
              key={hiz.id}
              onClick={() => handleAkisHiziDegistir(hiz.id)}
              style={{
                background: akisHizi === hiz.id ? 'rgba(0, 240, 255, 0.15)' : t.subBg,
                border: `1px solid ${akisHizi === hiz.id ? '#00F0FF' : t.kenarlik}`,
                color: akisHizi === hiz.id ? '#00F0FF' : t.metin,
                padding: '10px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {hiz.etiket}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 🔔 AKILLI BİLDİRİMLER & HATIRLATICI ────────────────── */}
      <div style={{
        background: t.kart,
        borderRadius: '16px',
        padding: '24px',
        border: `1px solid ${t.kenarlik}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: t.metin }}>Akıllı Bildirimler & Uyarılar</h3>
            <span style={{ fontSize: '12px', color: t.alt }}>Günlük rutin ve seri kopma hatırlatıcıları</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.subBg, padding: '14px 18px', borderRadius: '12px', border: `1px solid ${t.kenarlik}` }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: t.metin }}>Günlük Hatırlatıcı Saati</span>
            <input 
              type="time" 
              value={hatirlaticiSaati}
              onChange={(e) => handleHatirlaticiDegistir(e.target.value)}
              style={{
                background: t.kart,
                color: t.metin,
                border: `1px solid ${t.kenarlik}`,
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 800,
                fontFamily: 'monospace'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.subBg, padding: '14px 18px', borderRadius: '12px', border: `1px solid ${t.kenarlik}` }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: t.metin }}>Seri Kopma Riski Uyarısı</div>
              <div style={{ fontSize: '11px', color: t.alt }}>Tamamlanmayan alışkanlıklar için akşam uyarısı al</div>
            </div>
            <input 
              type="checkbox"
              checked={seriUyariAktif}
              onChange={handleSeriUyariToggle}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#F59E0B' }}
            />
          </div>
        </div>
      </div>

      {/* ─── 💾 VERİ YÖNETİMİ & YEDEKLEME ───────────────────────── */}
      <div style={{
        background: t.kart,
        borderRadius: '16px',
        padding: '24px',
        border: `1px solid ${t.kenarlik}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Download size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: t.metin }}>Veri Yönetimi & Dışa Aktarma</h3>
            <span style={{ fontSize: '12px', color: t.alt }}>Alışkanlık geçmişinizi yedekleyin veya aktarın</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleVeriIndir}
            style={{
              flex: 1,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10B981',
              padding: '12px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <Download size={16} /> VERİLERİ JSON YEDEKLE
          </button>
        </div>
      </div>

      {/* ─── YENİ ALIŞKANLIK YÖNETİMİ ───────────────────────────── */}
      <div style={{
        background: t.kart,
        borderRadius: '16px',
        padding: '24px',
        border: `1px solid ${t.kenarlik}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(249, 115, 22, 0.15)', color: t.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: t.metin }}>Yeni Alışkanlık Ekleme</h3>
            <span style={{ fontSize: '12px', color: t.alt }}>Yeni hedef ve rutin tanımlayın</span>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: t.subBg,
          padding: '16px 20px',
          borderRadius: '12px',
          border: `1px solid ${t.kenarlik}`
        }}>
          <span style={{ fontSize: '13px', color: t.alt, fontWeight: 500 }}>
            Takibine başlamak istediğiniz yeni bir rutin oluşturun.
          </span>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onOpenModal?.()}
            style={{
              background: t.orange,
              color: '#FFFFFF',
              border: 'none',
              height: '40px',
              padding: '0 20px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
              flexShrink: 0,
            }}
          >
            <Plus size={16} strokeWidth={3} />
            YENİ ALIŞKANLIK
          </motion.button>
        </div>
      </div>

      {/* ─── SİSTEM BİLGİLERİ ───────────────────────────────────── */}
      <div style={{
        background: t.kart,
        borderRadius: '16px',
        padding: '24px',
        border: `1px solid ${t.kenarlik}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Info size={18} color={t.alt} />
          <span style={{ fontSize: '13px', color: t.alt, fontWeight: 600 }}>Uygulama Sürümü</span>
        </div>
        <span style={{ fontSize: '12px', fontWeight: 800, color: t.orange, fontFamily: 'monospace' }}>v2.5.0 (Sanctuary Custom Theme)</span>
      </div>

    </motion.div>
  )
}
