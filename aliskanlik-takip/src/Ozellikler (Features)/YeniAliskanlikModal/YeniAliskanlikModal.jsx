import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Target, Clock, Coffee, Wind, Zap, FileText } from 'lucide-react'

/* ----------------------------------------------------------------
   YeniAliskanlikModal — Alışkanlık Ekleme Formu (Not Özellikli)
   ---------------------------------------------------------------- */
function YeniAliskanlikModal({ isOpen, onClose, onAdd, koyuMod }) {
  const [ad, setAd] = useState('')
  const [kategori, setKategori] = useState('sabah')
  const [hedef, setHedef] = useState('')
  const [not, setNot] = useState('')
  const [hedefGun, setHedefGun] = useState(30)
  const [frekans, setFrekans] = useState(1)
  const [customKategori, setCustomKategori] = useState('')
  const [isCustom, setIsCustom] = useState(false)

  const modalTema = {
    bg: koyuMod ? '#141829' : '#FFFFFF',
    inputBg: koyuMod ? '#090D16' : '#F9FAFB',
    text: koyuMod ? '#FFFFFF' : '#1F2937',
    label: koyuMod ? '#94A3B8' : '#4B5563',
    border: koyuMod ? '#1E2340' : '#E2E8F0'
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!ad) return
    const finalKategori = isCustom && customKategori ? customKategori.trim().toLowerCase() : kategori
    onAdd({ 
      ad, 
      zamanDilimi: finalKategori, 
      miktar: hedef || 'Her gün',
      not: not.trim(),
      hedefGun: parseInt(hedefGun) || 30,
      frekans: parseInt(frekans) || 1,
      seri: 0,
      durum: 'beklemede',
      gecmis: [0, 0, 0, 0, 0, 0, 0]
    })
    setAd('')
    setHedef('')
    setNot('')
    setHedefGun(30)
    setFrekans(1)
    setCustomKategori('')
    setIsCustom(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(8px)',
              zIndex: 1000,
            }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: '-50%', y: -40 }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: '-50%', y: -40 }}
            style={{
              position: 'fixed',
              top: '60px',
              left: '50%',
              width: '90%',
              maxWidth: '480px',
              background: modalTema.bg,
              borderRadius: '20px',
              padding: '28px',
              border: `1px solid ${modalTema.border}`,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              zIndex: 1001,
              color: modalTema.text,
              transition: 'background 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '10px', 
                  background: '#F9731620', 
                  color: '#F97316',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Plus size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Yeni Alışkanlık</h3>
              </div>
              <motion.button 
                onClick={onClose}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{ 
                  background: modalTema.inputBg, 
                  border: 'none', 
                  padding: '8px', 
                  borderRadius: '50%', 
                  cursor: 'pointer',
                  color: '#9CA3AF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </motion.button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: modalTema.label, marginBottom: '6px' }}>
                  Alışkanlık Adı
                </label>
                <input 
                  autoFocus
                  type="text"
                  placeholder="Örn: Sabah Meditasyonu"
                  value={ad}
                  onChange={(e) => setAd(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: `1px solid ${modalTema.border}`,
                    background: modalTema.inputBg,
                    outline: 'none',
                    fontSize: '14px',
                    color: modalTema.text
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: modalTema.label, marginBottom: '6px' }}>
                  Kategori
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'sabah', label: 'Sabah', ikon: <Coffee size={14} /> },
                    { id: 'is', label: 'İş', ikon: <Target size={14} /> },
                    { id: 'aksam', label: 'Akşam', ikon: <Wind size={14} /> },
                  ].map(k => (
                    <motion.button
                      key={k.id}
                      type="button"
                      onClick={() => {
                        setKategori(k.id)
                        setIsCustom(false)
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        padding: '10px 6px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: kategori === k.id ? '#F97316' : modalTema.border,
                        background: kategori === k.id ? '#F9731620' : modalTema.inputBg,
                        color: kategori === k.id ? '#F97316' : modalTema.label,
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {k.ikon}
                      {k.label}
                    </motion.button>
                  ))}
                  <motion.button
                    type="button"
                    onClick={() => {
                      setKategori('custom')
                      setIsCustom(true)
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      padding: '10px 6px',
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: kategori === 'custom' ? '#F97316' : modalTema.border,
                      background: kategori === 'custom' ? '#F9731620' : modalTema.inputBg,
                      color: kategori === 'custom' ? '#F97316' : modalTema.label,
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Plus size={14} />
                    Özel
                  </motion.button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: modalTema.label, marginBottom: '6px' }}>
                  Hedef / Miktar
                </label>
                <div style={{ position: 'relative' }}>
                  <Clock size={15} color="#94A3B8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text"
                    placeholder="Örn: Günde 15 dk / 2 L"
                    value={hedef}
                    onChange={(e) => setHedef(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 40px',
                      borderRadius: '12px',
                      border: `1px solid ${modalTema.border}`,
                      background: modalTema.inputBg,
                      outline: 'none',
                      fontSize: '14px',
                      color: modalTema.text
                    }}
                  />
                </div>
              </div>

              {/* NOT ALANI */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: modalTema.label, marginBottom: '6px' }}>
                  Özel Not / Hatırlatma
                </label>
                <div style={{ position: 'relative' }}>
                  <FileText size={15} color="#94A3B8" style={{ position: 'absolute', left: '14px', top: '14px' }} />
                  <textarea 
                    rows={2}
                    placeholder="Örn: Aç karnına 1 bardak ılık su ile içilecek..."
                    value={not}
                    onChange={(e) => setNot(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 40px',
                      borderRadius: '12px',
                      border: `1px solid ${modalTema.border}`,
                      background: modalTema.inputBg,
                      outline: 'none',
                      fontSize: '13px',
                      color: modalTema.text,
                      resize: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '8px' }}>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    border: 'none',
                    background: '#F97316',
                    color: '#FFFFFF',
                    fontSize: '15px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 8px 18px rgba(249, 115, 22, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Zap size={18} fill="#FFFFFF" />
                  Alışkanlığı Oluştur
                </motion.button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default YeniAliskanlikModal
