import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import YanMenu from './YanMenu (Sidebar).jsx'
import PanoOzeti from './Ozellikler (Features)/KarsilamaAlani (WelcomeArea)/KarsilamaAlani (WelcomeArea).jsx'
import AliskanlikListesi from './Ozellikler (Features)/AliskanlikListesi (HabitList)/AliskanlikListesi (HabitList).jsx'
import { SahteAliskanliklar, GunlukOzet, DURUM } from './Ozellikler (Features)/AliskanlikListesi (HabitList)/SahteAliskanliklar (MockHabits).js'
import IstatistiklerSayfasi from './Ozellikler (Features)/Istatistikler (Statistics)/IstatistiklerSayfasi.jsx'
import YeniAliskanlikModal from './Ozellikler (Features)/YeniAliskanlikModal/YeniAliskanlikModal.jsx'
import OdakZamanlayici from './Ozellikler (Features)/OdakZamanlayici/OdakZamanlayici.jsx'
import TakvimSayfasi from './Ozellikler (Features)/Takvim/TakvimSayfasi.jsx'
import BilgiMerkezi from './Ozellikler (Features)/BilgiMerkezi/BilgiMerkezi.jsx'
import AyarlarSayfasi from './Ozellikler (Features)/Ayarlar/AyarlarSayfasi.jsx'

const sayfaGecisAnimasyonu = {
  gizli: { opacity: 0, x: -16 },
  gorunen: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  cikis: { opacity: 0, x: 16, transition: { duration: 0.2 } },
}

function AnaUygulama() {
  const [aktifSayfa, setAktifSayfa] = useState('pano')
  const [filtre, setFiltre] = useState('Tümü')
  const [katlanmis, setKatlanmis] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [aliskanliklar, setAliskanliklar] = useState(SahteAliskanliklar)
  const [koyuMod, setKoyuMod] = useState(true)

  const globalTema = {
    arkaPlan: koyuMod ? '#090D16' : '#F9FAFB',
    kart: koyuMod ? '#121626' : '#FFFFFF',
    metin: koyuMod ? '#FFFFFF' : '#111827',
    altMetin: koyuMod ? '#8E9BAE' : '#6B7280',
    kenarlik: koyuMod ? '#1E2340' : '#F1F5F9'
  }

  const toplamGecmis = aliskanliklar.reduce((acc, a) => acc + (a.gecmis || []).filter(v => v === 1).length, 0)
  const toplamGecmisGun = aliskanliklar.reduce((acc, a) => acc + (a.gecmis || []).length, 0)
  const haftalikDisiplin = toplamGecmisGun > 0 ? Math.round((toplamGecmis / toplamGecmisGun) * 100) : 0
  const ustalikPuani = aliskanliklar.reduce((acc, a) => acc + a.seri, 0) * 10

  const handleDeleteHabit = (id) => {
    setAliskanliklar(prev => prev.filter(a => a.id !== id))
  }

  const dinamikOzet = {
    toplam: aliskanliklar.length,
    toplamAliskanlik: aliskanliklar.length,
    tamamlanan: aliskanliklar.filter(a => a.durum === DURUM.TAMAMLANDI).length,
    yuzde: aliskanliklar.length > 0 
      ? Math.round((aliskanliklar.filter(a => a.durum === DURUM.TAMAMLANDI).length / aliskanliklar.length) * 100) 
      : 0,
    haftalikDisiplin,
    ustalikPuani,
    maksimumSeri: Math.max(...aliskanliklar.map(a => a.seri), 0)
  }

  const sayfaHaritasi = {
    odak: <OdakZamanlayici koyuMod={koyuMod} />,
    takvim: <TakvimSayfasi aliskanliklar={aliskanliklar} setAliskanliklar={setAliskanliklar} koyuMod={koyuMod} setKoyuMod={setKoyuMod} />,
    bilgi: <BilgiMerkezi koyuMod={koyuMod} />,
    ayarlar: <AyarlarSayfasi koyuMod={koyuMod} setKoyuMod={setKoyuMod} onOpenModal={() => setIsModalOpen(true)} />,
    pano: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <PanoOzeti 
          gunlukOzet={dinamikOzet} 
          koyuMod={koyuMod}
          sayfaDegistir={setAktifSayfa}
          filtre={filtre}
          setFiltre={setFiltre}
          aliskanliklar={aliskanliklar}
        />
        <AliskanlikListesi 
          aliskanliklar={aliskanliklar} 
          setAliskanliklar={setAliskanliklar} 
          koyuMod={koyuMod}
          sayfaDegistir={setAktifSayfa}
          filtre={filtre}
          setFiltre={setFiltre}
          silAliskanlik={handleDeleteHabit}
        />
      </div>
    ),
    analiz: <IstatistiklerSayfasi gunlukOzet={dinamikOzet} aliskanliklar={aliskanliklar} koyuMod={koyuMod} />,
  }

  const handleAddHabit = (yeni) => {
    const yeniAliskanlik = {
      id: Date.now(),
      ad: yeni.ad || 'Yeni Alışkanlık',
      not: yeni.not || '',
      kategori: yeni.kategori || 'Genel',
      zamanDilimi: yeni.zamanDilimi || 'sabah',
      miktar: yeni.miktar || '1 defa',
      durum: DURUM.BEKLEMEDE,
      seri: 0,
      hedefGun: yeni.hedefGun || 21,
      gecmis: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      renk: yeni.renk || '#F97316',
      ikon: yeni.ikon || '🎯',
      ...yeni
    }
    setAliskanliklar(prev => [yeniAliskanlik, ...prev])
    setIsModalOpen(false)
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: globalTema.arkaPlan,
      transition: 'background 0.3s ease'
    }}>
      <YanMenu
        aktifSayfa={aktifSayfa}
        sayfaDegistir={setAktifSayfa}
        katlanmis={katlanmis}
        setKatlanmis={setKatlanmis}
        koyuMod={koyuMod}
      />

      <main style={{
        flex: 1,
        paddingLeft: katlanmis ? '100px' : '280px', 
        paddingTop: '40px',
        paddingRight: '40px',
        paddingBottom: '40px',
        transition: 'all 0.3s ease',
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={aktifSayfa}
            variants={sayfaGecisAnimasyonu}
            initial="gizli"
            animate="gorunen"
            exit="cikis"
          >
            {sayfaHaritasi[aktifSayfa]}
          </motion.div>
        </AnimatePresence>
      </main>

      <YeniAliskanlikModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdd={handleAddHabit}
        koyuMod={koyuMod}
      />
    </div>
  )
}

export default AnaUygulama
