/* ==========================================================
   YanMenu (Sidebar).jsx — Minimalist Uyumlu Sol Menü
   ========================================================== */
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Home, BarChart2, Calendar, Clock, BookOpen, Settings,
  ChevronLeft, ChevronRight, Compass
} from 'lucide-react'

const MENU_OGELERI = [
  { id: 'pano', etiket: 'Ana Sayfa', ikon: Home },
  { id: 'takvim', etiket: 'Zaman Tüneli', ikon: Calendar },
  { id: 'analiz', etiket: 'İstatistikler', ikon: BarChart2 },
  { id: 'odak', etiket: 'Odak & Çalışma Saati', ikon: Clock },
  { id: 'bilgi', etiket: 'Bilgi Merkezi', ikon: BookOpen },
  { id: 'ayarlar', etiket: 'Ayarlar', ikon: Settings },
]

function YanMenu({ aktifSayfa, sayfaDegistir, katlanmis, setKatlanmis, koyuMod }) {
  const [hoveredId, setHoveredId] = useState(null)

  const t = {
    bg: koyuMod ? '#0E1117' : '#FFFFFF',
    metin: koyuMod ? '#F1F5F9' : '#0F172A',
    alt: koyuMod ? '#94A3B8' : '#64748B',
    orange: '#F97316',
    border: koyuMod ? '#1E2340' : '#E2E8F0',
    aktifBg: koyuMod ? 'rgba(249, 115, 22, 0.14)' : '#FFF7ED',
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: katlanmis ? '72px' : '240px' }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        height: '100vh',
        background: t.bg,
        display: 'flex',
        flexDirection: 'column',
        padding: katlanmis ? '20px 10px' : '20px 12px',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 100,
        borderRight: `1px solid ${t.border}`,
        boxSizing: 'border-box',
        overflowX: 'hidden'
      }}
    >
      {/* ─── AÇ / KAPAT TOGGLE BUTONU ───────────────────────────────── */}
      <motion.button
        onClick={() => setKatlanmis(!katlanmis)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: 'absolute',
          right: '-11px',
          top: '26px',
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: t.bg,
          border: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: t.metin,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 101,
        }}
      >
        {katlanmis ? <ChevronRight size={12} strokeWidth={2.5} /> : <ChevronLeft size={12} strokeWidth={2.5} />}
      </motion.button>

      {/* ─── LOGO ALANI ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '32px',
        padding: katlanmis ? '0' : '0 6px',
        justifyContent: katlanmis ? 'center' : 'flex-start',
      }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '10px',
          background: 'rgba(249, 115, 22, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          <Compass size={20} color={t.orange} />
        </div>

        {!katlanmis && (
          <span style={{
            fontWeight: 900,
            fontSize: '15px',
            color: t.metin,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>
            SANCTUARY
          </span>
        )}
      </div>

      {/* ─── DÜZ NAVİGASYON LİSTESİ ───────────────────────────────── */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {MENU_OGELERI.map((o) => {
          const Ikon = o.ikon
          const aktif = aktifSayfa === o.id

          return (
            <div key={o.id} style={{ position: 'relative' }}>
              <motion.button
                onClick={() => sayfaDegistir(o.id)}
                onMouseEnter={() => setHoveredId(o.id)}
                onMouseLeave={() => setHoveredId(null)}
                whileHover={{ x: katlanmis ? 0 : 3 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: katlanmis ? '12px 0' : '10px 14px',
                  justifyContent: katlanmis ? 'center' : 'flex-start',
                  borderRadius: '12px',
                  border: `1px solid ${aktif ? 'rgba(249, 115, 22, 0.3)' : 'transparent'}`,
                  background: aktif ? t.aktifBg : 'transparent',
                  color: aktif ? t.orange : t.alt,
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 2,
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Aktif İkon ve Etiket */}
                <Ikon size={18} strokeWidth={aktif ? 2.2 : 1.6} color={aktif ? t.orange : t.alt} />
                {!katlanmis && (
                  <span style={{
                    fontSize: '13px',
                    fontWeight: aktif ? 800 : 500,
                    letterSpacing: '0.2px',
                    whiteSpace: 'nowrap',
                  }}>
                    {o.etiket}
                  </span>
                )}
              </motion.button>

              {/* Katlanmış Mod Tooltip */}
              {katlanmis && hoveredId === o.id && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{
                    position: 'absolute',
                    left: '70px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: koyuMod ? '#1E293B' : '#0F172A',
                    color: '#FFFFFF',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    zIndex: 200,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                    pointerEvents: 'none'
                  }}
                >
                  {o.etiket}
                </motion.div>
              )}
            </div>
          )
        })}
      </nav>
    </motion.aside>
  )
}

export default YanMenu
