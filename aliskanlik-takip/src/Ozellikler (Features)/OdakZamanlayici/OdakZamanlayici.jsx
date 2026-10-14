/* =================================================================
   OdakZamanlayici.jsx
   - Derin Uzay & Kozmik Rezonans Sesi Yeniden Eklendi ✨
   - Kafe Sesi İstek Üzerine Önceki Akustik Fincan & Mırıldanma Haline Geri Getirildi ☕
   - Şömine, Yağmur, Fırtına ve Dalga için Gerçek Ses Dosyaları Kullanılmaya Devam Ediyor 🔥🌧️
   ================================================================= */
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Pause, RotateCcw, ChevronDown, Check, History, Volume2,
  VolumeX, Coffee, Flame, Waves, Sparkles, Music, Activity, Radio, Headphones
} from 'lucide-react'

// Yerel Ses Dosyaları
import somineSes from '../../assets/sesler/somine_gercek.ogg'
import yagmurSes from '../../assets/sesler/yagmur_gercek.ogg'
import dalgaSes from '../../assets/sesler/dalga.mp3'
import kafeSes from '../../assets/sesler/kafe.ogg'

const LOCAL_STORAGE_KEY = 'habitpulse_calisma_verileri'
const POMODORO_STORAGE_KEY = 'habitpulse_pomodoro_verileri'

const GERCEK_SES_DOSYALARI = {
  SOMINE: somineSes,
  YAGMUR: yagmurSes,
  DALGA: dalgaSes,
}

const SES_GRUPLARI = [
  {
    grupBaslik: 'SESSİZ',
    ogeler: [
      { id: 'YOK', etiket: 'Sessiz', ikonComponent: VolumeX },
    ]
  },
  {
    grupBaslik: 'DOĞAL & SOSYAL AMBİYANSLAR',
    ogeler: [
      { id: 'KAFE', etiket: 'Kafe Ambiyansı', ikonComponent: Coffee },
      { id: 'SOMINE', etiket: 'Şömine Ateşi', ikonComponent: Flame },
      { id: 'YAGMUR', etiket: 'Hafif Yağmur', ikonComponent: Waves },
      { id: 'DALGA', etiket: 'Okyanus Dalgası', ikonComponent: Waves },
      { id: 'UZAY', etiket: 'Derin Uzay', ikonComponent: Sparkles },
    ]
  },
  {
    grupBaslik: 'ŞİFALI FREKANSLAR',
    ogeler: [
      { id: 'HZ432', etiket: '432 Hz', ikonComponent: Music },
      { id: 'HZ528', etiket: '528 Hz', ikonComponent: Music },
      { id: 'ALPHA', etiket: 'Alpha Dalgaları', ikonComponent: Activity },
    ]
  },
  {
    grupBaslik: 'GÜRÜLTÜ MODLARI',
    ogeler: [
      { id: 'BEYAZ', etiket: 'White Noise', ikonComponent: Radio },
      { id: 'PEMBE', etiket: 'Pink Noise', ikonComponent: Headphones },
    ]
  }
]

export default function OdakZamanlayici({ koyuMod }) {
  const [altMod, setAltMod] = useState('KRONOMETRE')
  
  // Kronometre State
  const [kronometreSure, setKronometreSure] = useState(0)
  const [kronometreCalisiyor, setKronometreCalisiyor] = useState(false)
  const [gecmis, setGecmis] = useState([])
  const kronometreTimerRef = useRef(null)

  // Pomodoro State
  const [pomodoroDk, setPomodoroDk] = useState(25)
  const [pomodoroSure, setPomodoroSure] = useState(25 * 60)
  const [pomodoroCalisiyor, setPomodoroCalisiyor] = useState(false)
  const [tamamlananPomodoro, setTamamlananPomodoro] = useState(0)
  const [toplamOdakDakika, setToplamOdakDakika] = useState(0)
  const pomodoroTimerRef = useRef(null)

  // Ambiyans Sesi & Ses Seviyesi State
  const [seciliSes, setSeciliSes] = useState('YOK')
  const [sesSeviyesi, setSesSeviyesi] = useState(0.7)
  const [sesDropdownAcik, setSesDropdownAcik] = useState(false)
  const dropdownRef = useRef(null)
  
  // Audio Refs
  const audioPlayerRef = useRef(null)
  const audioCtxRef = useRef(null)
  const intervalRef = useRef(null)

  const t = {
    bg: '#0C0F1A',
    kart: koyuMod ? '#141829' : '#FFFFFF',
    icKart: koyuMod ? '#0E1117' : '#F8FAFC',
    metin: koyuMod ? '#F1F5F9' : '#0F172A',
    alt: koyuMod ? '#94A3B8' : '#64748B',
    kenarlik: koyuMod ? '#1E2340' : '#E2E8F0',
    orange: '#F97316',
    purple: '#8B5CF6',
    subBg: koyuMod ? '#0E1117' : '#F8FAFC',
    popoverBg: koyuMod ? '#1E2340' : '#FFFFFF',
  }

  // Dropdown dışına tıklanınca kapatma
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setSesDropdownAcik(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // LocalStorage Yükleme
  useEffect(() => {
    const savedCalisma = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (savedCalisma) setGecmis(JSON.parse(savedCalisma))

    const savedPomodoro = localStorage.getItem(POMODORO_STORAGE_KEY)
    if (savedPomodoro) {
      const parsed = JSON.parse(savedPomodoro)
      setTamamlananPomodoro(parsed.sayi || 0)
      setToplamOdakDakika(parsed.dakika || 0)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gecmis))
  }, [gecmis])

  useEffect(() => {
    localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify({
      sayi: tamamlananPomodoro,
      dakika: toplamOdakDakika
    }))
  }, [tamamlananPomodoro, toplamOdakDakika])

  // Kronometre Sayacı
  useEffect(() => {
    if (kronometreCalisiyor) {
      kronometreTimerRef.current = setInterval(() => setKronometreSure(prev => prev + 1), 1000)
    } else {
      clearInterval(kronometreTimerRef.current)
    }
    return () => clearInterval(kronometreTimerRef.current)
  }, [kronometreCalisiyor])

  // Pomodoro Sayacı
  useEffect(() => {
    if (pomodoroCalisiyor) {
      pomodoroTimerRef.current = setInterval(() => {
        setPomodoroSure(prev => {
          if (prev <= 1) {
            setPomodoroCalisiyor(false)
            setTamamlananPomodoro(p => p + 1)
            setToplamOdakDakika(d => d + pomodoroDk)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      clearInterval(pomodoroTimerRef.current)
    }
    return () => clearInterval(pomodoroTimerRef.current)
  }, [pomodoroCalisiyor, pomodoroDk])

  // SES SEVİYESİ DEĞİŞTİRME
  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.volume = sesSeviyesi
    }
  }, [sesSeviyesi])

  // HİBRİT SES OYNATICI VE SENTEZLEME MOTORU
  useEffect(() => {
    const calisiyor = kronometreCalisiyor || pomodoroCalisiyor

    // Durdurma Koşulu
    if (!calisiyor || seciliSes === 'YOK') {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
        audioPlayerRef.current = null
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
      return
    }

    // ═══════════════════════════════════════════════════════════
    // YAĞMUR: Gerçek kayıt + üzerine seramik tınlama overlay
    // ═══════════════════════════════════════════════════════════
    if (seciliSes === 'YAGMUR') {
      // Gerçek yağmur kaydını çal
      const audioSrc = GERCEK_SES_DOSYALARI[seciliSes]
      if (!audioPlayerRef.current || audioPlayerRef.current.src !== audioSrc) {
        audioPlayerRef.current = new Audio(audioSrc)
        audioPlayerRef.current.loop = true
        audioPlayerRef.current.volume = sesSeviyesi
      }
      audioPlayerRef.current.play().catch(() => {})

      // Üzerine seramik tınlama overlay (Web Audio)
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
        const ctx = audioCtxRef.current
        if (ctx.state === 'suspended') ctx.resume()

        const masterGain = ctx.createGain()
        masterGain.gain.setValueAtTime(sesSeviyesi * 0.6, ctx.currentTime)
        masterGain.connect(ctx.destination)

        // Rastgele aralıklarla seramik tınlama (yağmur damlası cam/metal çınlaması)
        const scheduleChime = () => {
          if (!audioCtxRef.current) return
          try {
            const ctx2 = audioCtxRef.current
            const now = ctx2.currentTime
            // Her tınlama 2-4 minik harmonik katman
            const harmonikSayisi = 2 + Math.floor(Math.random() * 3)
            for (let h = 0; h < harmonikSayisi; h++) {
              const chimeOsc = ctx2.createOscillator()
              const chimeGain = ctx2.createGain()
              chimeOsc.type = 'sine'
              // Farklı tonlarda tınlamalar: 1800-4200 Hz arası
              chimeOsc.frequency.setValueAtTime(1800 + Math.random() * 2400, now)
              const vol = 0.015 + Math.random() * 0.025
              chimeGain.gain.setValueAtTime(vol, now)
              chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12 + Math.random() * 0.15)
              chimeOsc.connect(chimeGain)
              chimeGain.connect(masterGain)
              chimeOsc.start(now + h * 0.03)
              chimeOsc.stop(now + 0.3 + h * 0.03)
            }
          } catch (e) {}
          // Sonraki tınlama: 1.5 - 4.5 saniye arası rastgele
          intervalRef.current = setTimeout(scheduleChime, 1500 + Math.random() * 3000)
        }
        scheduleChime()
      } catch (e) {}
    }
    // ═══════════════════════════════════════════════════════════
    // GERÇEK ALAN KAYDI DOSYA OYNATICI (Şömine, Fırtına, Dalga)
    // ═══════════════════════════════════════════════════════════
    else if (GERCEK_SES_DOSYALARI[seciliSes]) {
      if (intervalRef.current) { clearInterval(intervalRef.current); clearTimeout(intervalRef.current) }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }

      const audioSrc = GERCEK_SES_DOSYALARI[seciliSes]
      if (!audioPlayerRef.current || audioPlayerRef.current.src !== audioSrc) {
        audioPlayerRef.current = new Audio(audioSrc)
        audioPlayerRef.current.loop = true
        audioPlayerRef.current.volume = sesSeviyesi
      }
      
      audioPlayerRef.current.play().catch(err => {
        console.warn('Oynatma hatası:', err)
      })
    } 
    // ═══════════════════════════════════════════════════════════
    // WEB AUDIO SENTEZLEME: KAFE, DERİN UZAY, FREKANSLAR, NOISE
    // ═══════════════════════════════════════════════════════════
    else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
        audioPlayerRef.current = null
      }

      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext()
        }

        const ctx = audioCtxRef.current
        if (ctx.state === 'suspended') {
          ctx.resume()
        }

        const masterGain = ctx.createGain()
        masterGain.gain.setValueAtTime(sesSeviyesi, ctx.currentTime)
        masterGain.connect(ctx.destination)

        // ─── ŞİFALI FREKANSLAR ───
        if (seciliSes === 'HZ432' || seciliSes === 'HZ528' || seciliSes === 'ALPHA') {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()

          if (seciliSes === 'HZ432') {
            osc.frequency.setValueAtTime(432, ctx.currentTime)
            osc.type = 'sine'
            gain.gain.setValueAtTime(0.2, ctx.currentTime)
          } else if (seciliSes === 'HZ528') {
            osc.frequency.setValueAtTime(528, ctx.currentTime)
            osc.type = 'sine'
            gain.gain.setValueAtTime(0.18, ctx.currentTime)
          } else if (seciliSes === 'ALPHA') {
            osc.frequency.setValueAtTime(210, ctx.currentTime)
            osc.type = 'triangle'
            gain.gain.setValueAtTime(0.15, ctx.currentTime)
          }

          osc.connect(gain)
          gain.connect(masterGain)
          osc.start()
        }
        // ─── DERİN UZAY & KOZMİK REZONANS (LFO bozulma + detune + gürültü süpürme) ───
        else if (seciliSes === 'UZAY') {
          const now = ctx.currentTime

          // Ana derin bas osilatör (60 Hz sawtooth, lowpass filtreli)
          const osc1 = ctx.createOscillator()
          osc1.type = 'sawtooth'
          osc1.frequency.setValueAtTime(60, now)
          const filter1 = ctx.createBiquadFilter()
          filter1.type = 'lowpass'
          filter1.frequency.setValueAtTime(140, now)
          const gain1 = ctx.createGain()
          gain1.gain.setValueAtTime(0.2, now)
          osc1.connect(filter1)
          filter1.connect(gain1)
          gain1.connect(masterGain)
          osc1.start()

          // İkinci detune osilatör (62.5 Hz — ana ile 2.5 Hz fark = yavaş vurgu/beating)
          const osc2 = ctx.createOscillator()
          osc2.type = 'sine'
          osc2.frequency.setValueAtTime(62.5, now)
          const filter2 = ctx.createBiquadFilter()
          filter2.type = 'lowpass'
          filter2.frequency.setValueAtTime(120, now)
          const gain2 = ctx.createGain()
          gain2.gain.setValueAtTime(0.12, now)
          osc2.connect(filter2)
          filter2.connect(gain2)
          gain2.connect(masterGain)
          osc2.start()

          // LFO: Ana osilatörün frekansını yavaşça 55-65 Hz arası sallandırır
          const lfo = ctx.createOscillator()
          lfo.type = 'sine'
          lfo.frequency.setValueAtTime(0.08, now) // 0.08 Hz = ~12 saniyelik yavaş dalga
          const lfoGain = ctx.createGain()
          lfoGain.gain.setValueAtTime(5, now) // ±5 Hz sapma
          lfo.connect(lfoGain)
          lfoGain.connect(osc1.frequency)
          lfo.start()

          // Filtre sweep LFO: lowpass frekansını 100-200 Hz arası yavaşça süpürür
          const filterLfo = ctx.createOscillator()
          filterLfo.type = 'triangle'
          filterLfo.frequency.setValueAtTime(0.04, now) // 25 saniye periyot
          const filterLfoGain = ctx.createGain()
          filterLfoGain.gain.setValueAtTime(50, now) // ±50 Hz filtre sapması
          filterLfo.connect(filterLfoGain)
          filterLfoGain.connect(filter1.frequency)
          filterLfo.start()

          // Hafif kozmik gürültü süpürmesi (çok düşük seviyede)
          const noiseLen = ctx.sampleRate * 2
          const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
          const noiseOut = noiseBuf.getChannelData(0)
          for (let i = 0; i < noiseLen; i++) noiseOut[i] = Math.random() * 2 - 1
          const noiseSrc = ctx.createBufferSource()
          noiseSrc.buffer = noiseBuf
          noiseSrc.loop = true
          const noiseFilter = ctx.createBiquadFilter()
          noiseFilter.type = 'bandpass'
          noiseFilter.frequency.setValueAtTime(200, now)
          noiseFilter.Q.setValueAtTime(0.5, now)
          const noiseGain = ctx.createGain()
          noiseGain.gain.setValueAtTime(0.04, now)
          noiseSrc.connect(noiseFilter)
          noiseFilter.connect(noiseGain)
          noiseGain.connect(masterGain)
          noiseSrc.start()
        }
        // ─── KAFE AMBİYANSI (Sıcak & Gerçekçi Kafe Uğultusu ☕) ───
        else if (seciliSes === 'KAFE') {
          const now = ctx.currentTime

          // 1. KAFE UĞULTUSU (Pink noise filter - Kafe içi tatlı kalabalık mırıldanması)
          const bufferSize = ctx.sampleRate * 3
          const cafeBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
          const data = cafeBuf.getChannelData(0)
          let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1
            b0 = 0.99886 * b0 + white * 0.0555179
            b1 = 0.99332 * b1 + white * 0.0750759
            b2 = 0.96900 * b2 + white * 0.1538520
            b3 = 0.86650 * b3 + white * 0.3104856
            b4 = 0.55000 * b4 + white * 0.5329522
            b5 = -0.7616 * b5 - white * 0.0168980
            data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
            data[i] *= 0.11
            b6 = white * 0.115926
          }

          const cafeSrc = ctx.createBufferSource()
          cafeSrc.buffer = cafeBuf
          cafeSrc.loop = true

          // Bandpass filtre: 250 - 900 Hz (insan sesi mırıldanma ve kafe ortamı frekansı)
          const cafeFilter = ctx.createBiquadFilter()
          cafeFilter.type = 'bandpass'
          cafeFilter.frequency.setValueAtTime(450, now)
          cafeFilter.Q.setValueAtTime(0.8, now)

          const cafeGain = ctx.createGain()
          cafeGain.gain.setValueAtTime(0.18, now)

          cafeSrc.connect(cafeFilter)
          cafeFilter.connect(cafeGain)
          cafeGain.connect(masterGain)
          cafeSrc.start()

          // 2. KAFE İÇİ DİNAMİK SOHBET LFO (Hafif dalgalanan kalabalık sesi)
          const lfo = ctx.createOscillator()
          lfo.type = 'sine'
          lfo.frequency.setValueAtTime(0.12, now) // ~8 saniyede bir hafif uğultu dalgası
          const lfoGain = ctx.createGain()
          lfoGain.gain.setValueAtTime(0.04, now)
          lfo.connect(lfoGain)
          lfoGain.connect(cafeGain.gain)
          lfo.start()

          // 3. FİNCAN & TABAK TINKIRTILARI (Rastgele seramik/kahve bardağı temasları)
          const scheduleCafeClink = () => {
            if (!audioCtxRef.current) return
            try {
              const ctx2 = audioCtxRef.current
              const t2 = ctx2.currentTime
              
              // Rastgele ikili/tekli fincan sesi
              const isDouble = Math.random() > 0.6
              const count = isDouble ? 2 : 1
              
              for (let c = 0; c < count; c++) {
                const osc = ctx2.createOscillator()
                const gain = ctx2.createGain()
                osc.type = 'sine'
                // Gerçek seramik tınlama frekansı: 1600 - 2400 Hz
                const freq = 1600 + Math.random() * 800
                osc.frequency.setValueAtTime(freq, t2 + c * 0.08)
                
                const vol = 0.015 + Math.random() * 0.02
                gain.gain.setValueAtTime(vol, t2 + c * 0.08)
                gain.gain.exponentialRampToValueAtTime(0.0001, t2 + c * 0.08 + 0.05)
                
                osc.connect(gain)
                gain.connect(masterGain)
                osc.start(t2 + c * 0.08)
                osc.stop(t2 + c * 0.08 + 0.07)
              }
            } catch (e) {}

            intervalRef.current = setTimeout(scheduleCafeClink, 2000 + Math.random() * 3500)
          }
          scheduleCafeClink()
        }
        // ─── BEYAZ & PEMBE GÜRÜLTÜ MODLARI ───
        else {
          const bufferSize = ctx.sampleRate * 2
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
          const output = noiseBuffer.getChannelData(0)

          let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1
            if (seciliSes === 'PEMBE') {
              b0 = 0.99886 * b0 + white * 0.0555179
              b1 = 0.99332 * b1 + white * 0.0750759
              b2 = 0.96900 * b2 + white * 0.1538520
              b3 = 0.86650 * b3 + white * 0.3104856
              b4 = 0.55000 * b4 + white * 0.5329522
              b5 = -0.7616 * b5 - white * 0.0168980
              output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
              output[i] *= 0.11
              b6 = white * 0.115926
            } else {
              output[i] = white
            }
          }

          const whiteNoise = ctx.createBufferSource()
          whiteNoise.buffer = noiseBuffer
          whiteNoise.loop = true
          const filter = ctx.createBiquadFilter()
          filter.type = 'lowpass'
          filter.frequency.setValueAtTime(3500, ctx.currentTime)
          const noiseGain = ctx.createGain()
          noiseGain.gain.setValueAtTime(0.2, ctx.currentTime)
          whiteNoise.connect(filter)
          filter.connect(noiseGain)
          noiseGain.connect(masterGain)
          whiteNoise.start()
        }
      } catch (err) {
        console.warn('Frekans üretme hatası:', err)
      }
    }

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); clearTimeout(intervalRef.current) }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
    }
  }, [seciliSes, kronometreCalisiyor, pomodoroCalisiyor])

  const resetKronometre = () => {
    if (kronometreSure > 0) {
      const bugun = new Date().toLocaleDateString('tr-TR')
      const yeniKayit = {
        id: Date.now(),
        tarih: bugun,
        saniye: kronometreSure,
        saat: (kronometreSure / 3600).toFixed(2)
      }
      setGecmis(prev => [yeniKayit, ...prev])
    }
    setKronometreSure(0)
    setKronometreCalisiyor(false)
  }

  const resetPomodoro = () => {
    setPomodoroSure(pomodoroDk * 60)
    setPomodoroCalisiyor(false)
  }

  const fmtKronometre = (saniye) => {
    const st = Math.floor(saniye / 3600)
    const dk = Math.floor((saniye % 3600) / 60)
    const sn = saniye % 60
    return `${String(st).padStart(2, '0')}:${String(dk).padStart(2, '0')}:${String(sn).padStart(2, '0')}`
  }

  const fmtPomodoro = (saniye) => {
    const dk = Math.floor(saniye / 60)
    const sn = saniye % 60
    return `${String(dk).padStart(2, '0')}:${String(sn).padStart(2, '0')}`
  }

  const calisiyorMu = altMod === 'KRONOMETRE' ? kronometreCalisiyor : pomodoroCalisiyor

  const seciliSesObjesi = SES_GRUPLARI.flatMap(g => g.ogeler).find(o => o.id === seciliSes) || { id: 'YOK', etiket: 'Sessiz (Ses Yok)', ikonComponent: VolumeX }

  const ActiveIcon = seciliSesObjesi.ikonComponent || VolumeX

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '640px', margin: '0 auto' }}
    >
      <style>{`
        .custom-dark-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .custom-dark-scroll::-webkit-scrollbar-track {
          background: rgba(18, 22, 38, 0.6);
          border-radius: 10px;
        }
        .custom-dark-scroll::-webkit-scrollbar-thumb {
          background: rgba(249, 115, 22, 0.4);
          border-radius: 10px;
        }
        .custom-dark-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(249, 115, 22, 0.8);
        }
      `}</style>

      {/* ─── BAŞLIK & MOD SEÇİMİ ─────────────────────────────────── */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: 'italic',
          fontSize: '34px',
          fontWeight: 400,
          color: t.metin,
          margin: '0 0 6px 0',
        }}>
          Odak & Çalışma Saati
        </h1>
        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: t.alt }}>
          Zihninizi sadeleştirin. Kafe ambiyansı, şömine ateşi, derin kozmik uzay ve şifalı frekanslar ile ana odaklanın.
        </p>

        {/* Mod Sekmeleri */}
        <div style={{
          display: 'inline-flex',
          gap: '6px',
          background: t.kart,
          padding: '6px',
          borderRadius: '14px',
          border: `1px solid ${t.kenarlik}`
        }}>
          <button
            onClick={() => setAltMod('KRONOMETRE')}
            style={{
              padding: '8px 20px',
              borderRadius: '10px',
              border: 'none',
              background: altMod === 'KRONOMETRE' ? t.orange : 'transparent',
              color: altMod === 'KRONOMETRE' ? '#FFFFFF' : t.alt,
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Serbest Çalışma (Kronometre)
          </button>
          <button
            onClick={() => setAltMod('POMODORO')}
            style={{
              padding: '8px 20px',
              borderRadius: '10px',
              border: 'none',
              background: altMod === 'POMODORO' ? t.orange : 'transparent',
              color: altMod === 'POMODORO' ? '#FFFFFF' : t.alt,
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Pomodoro (25 Dk Odak)
          </button>
        </div>
      </div>

      {/* ─── POMODORO İSTATİSTİK SAYACI ─────────────────────────── */}
      {altMod === 'POMODORO' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: t.kart,
            borderRadius: '16px',
            padding: '16px 24px',
            border: `1px solid ${t.kenarlik}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            textAlign: 'center'
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: t.alt, fontWeight: 700, textTransform: 'uppercase' }}>TAMAMLANAN POMODORO</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: t.orange, fontFamily: 'monospace', marginTop: '2px' }}>
              {tamamlananPomodoro} Seans
            </div>
          </div>
          <div style={{ width: '1px', height: '36px', background: t.kenarlik }} />
          <div>
            <div style={{ fontSize: '11px', color: t.alt, fontWeight: 700, textTransform: 'uppercase' }}>TOPLAM ODAK SÜRESİ</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: t.metin, fontFamily: 'monospace', marginTop: '2px' }}>
              {toplamOdakDakika} Dk
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── ÇALIŞMA SAATİ GÖRÜNÜMÜ ──────────────────────────────── */}
      <motion.div
        layout
        style={{
          background: t.kart,
          borderRadius: '24px',
          padding: '40px 28px 32px 28px',
          border: `1px solid ${t.kenarlik}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
          position: 'relative'
        }}
      >
        {/* SAĞ ÜST KÖŞE SES SEÇİCİ BUTONU */}
        <div ref={dropdownRef} style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 90 }}>
          <motion.button
            whileHover={{ scale: 1.03, borderColor: t.orange }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setSesDropdownAcik(!sesDropdownAcik)}
            style={{
              background: seciliSes !== 'YOK' ? 'rgba(249, 115, 22, 0.12)' : t.subBg,
              color: seciliSes !== 'YOK' ? t.orange : t.metin,
              border: `1px solid ${seciliSes !== 'YOK' ? t.orange : t.kenarlik}`,
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: sesDropdownAcik ? '0 4px 14px rgba(249, 115, 22, 0.25)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <ActiveIcon size={14} color={seciliSes !== 'YOK' ? t.orange : t.alt} />
            <span>{seciliSesObjesi.etiket}</span>
            <ChevronDown size={14} color={t.alt} style={{ transform: sesDropdownAcik ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </motion.button>
        </div>

        {/* HALKA */}
        <motion.div
          animate={calisiyorMu ? {
            boxShadow: [
              'inset 0 4px 20px rgba(0,0,0,0.6), 0 0 0px rgba(249, 115, 22, 0)',
              'inset 0 4px 20px rgba(0,0,0,0.4), 0 0 30px rgba(249, 115, 22, 0.35)',
              'inset 0 4px 20px rgba(0,0,0,0.6), 0 0 0px rgba(249, 115, 22, 0)'
            ]
          } : {
            boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)'
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: '220px',
            height: '220px',
            borderRadius: '50%',
            border: `3px solid ${t.orange}`,
            background: 'rgba(249, 115, 22, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            marginBottom: '24px',
            marginTop: '12px',
          }}
        >
          <span style={{ fontSize: '38px', fontWeight: 900, color: t.metin, fontFamily: 'monospace', letterSpacing: '-1px' }}>
            {altMod === 'KRONOMETRE' ? fmtKronometre(kronometreSure) : fmtPomodoro(pomodoroSure)}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 800, color: t.orange, textTransform: 'uppercase', letterSpacing: '1.5px', marginTop: '6px' }}>
            {calisiyorMu ? 'ODAKLANILIYOR...' : 'HAZIR'}
          </span>
        </motion.div>

        {/* KONTROL BUTONLARI */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (altMod === 'KRONOMETRE') setKronometreCalisiyor(!kronometreCalisiyor)
              else setPomodoroCalisiyor(!pomodoroCalisiyor)
            }}
            style={{
              background: t.orange,
              color: '#FFFFFF',
              border: 'none',
              height: '46px',
              padding: '0 28px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(249, 115, 22, 0.35)',
            }}
          >
            {calisiyorMu ? <Pause size={16} fill="#FFFFFF" /> : <Play size={16} fill="#FFFFFF" />}
            {calisiyorMu ? 'DURDUR' : 'BAŞLAT'}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (altMod === 'KRONOMETRE') resetKronometre()
              else resetPomodoro()
            }}
            style={{
              background: t.subBg,
              color: t.alt,
              border: `1px solid ${t.kenarlik}`,
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={16} />
          </motion.button>
        </div>

        {/* ─── SAĞ ÜST KÖŞEDEN AÇILAN SES DROPDOWN POPUP ─── */}
        <AnimatePresence>
          {sesDropdownAcik && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="custom-dark-scroll"
              style={{
                position: 'absolute',
                top: '52px',
                right: '16px',
                width: '240px',
                background: t.popoverBg,
                borderRadius: '16px',
                border: `1px solid ${t.kenarlik}`,
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)',
                padding: '12px',
                zIndex: 100,
                maxHeight: '280px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >

                {SES_GRUPLARI.map((grup, gIdx) => (
                  <div key={gIdx}>
                    <div style={{ fontSize: '10px', fontWeight: 900, color: t.alt, letterSpacing: '1px', padding: '4px 8px', marginBottom: '4px' }}>
                      {grup.grupBaslik}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {grup.ogeler.map((o) => {
                        const secili = seciliSes === o.id
                        const ItemIcon = o.ikonComponent || VolumeX
                        return (
                          <motion.div
                            key={o.id}
                            whileHover={{ backgroundColor: koyuMod ? 'rgba(249, 115, 22, 0.15)' : '#F1F5F9', x: 2 }}
                            onClick={() => {
                              setSeciliSes(o.id)
                              setSesDropdownAcik(false)
                            }}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: secili ? (koyuMod ? 'rgba(249, 115, 22, 0.2)' : '#FFF7ED') : 'transparent',
                              color: secili ? t.orange : t.metin,
                              fontSize: '13px',
                              fontWeight: secili ? 800 : 600,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <ItemIcon size={16} color={secili ? t.orange : t.alt} />
                              <span>{o.etiket}</span>
                            </div>
                            {secili && <Check size={14} color={t.orange} strokeWidth={3} />}
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
      </motion.div>

      {/* ─── GEÇMİŞ ÇALIŞMA SEANSLARI ───────────────────────────── */}
      {altMod === 'KRONOMETRE' && gecmis.length > 0 && (
        <div style={{
          background: t.kart,
          borderRadius: '16px',
          padding: '24px',
          border: `1px solid ${t.kenarlik}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <History size={16} color={t.orange} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: t.metin }}>Geçmiş Çalışma Seansları</h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {gecmis.slice(0, 5).map((g) => (
              <div key={g.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: t.subBg, borderRadius: '10px', border: `1px solid ${t.kenarlik}`
              }}>
                <span style={{ fontSize: '12px', color: t.alt, fontWeight: 600 }}>{g.tarih}</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: t.metin, fontFamily: 'monospace' }}>
                  {fmtKronometre(g.saniye)} ({g.saat} saat)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </motion.div>
  )
}
