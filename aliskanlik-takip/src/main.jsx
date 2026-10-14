/* ==========================================================
   main.jsx — Uygulamanın Giriş Noktası
   React uygulamasını başlatır ve kök bileşeni HTML'e bağlar.
   ========================================================== */

import { StrictMode } from 'react'          // StrictMode: geliştirme sırasında hataları erken yakalar
import { createRoot } from 'react-dom/client' // createRoot: React 18'in modern render motoru
import './index.css'                          // Global CSS stillerini projeye dahil et
import AnaUygulama from './AnaUygulama (App).jsx' // Ana uygulama bileşenini içe aktar
import HataYakalayici from './YardimciAraclar/HataYakalayici' // Hata yakalayıcıyı içe aktar
import DebugPanel from './YardimciAraclar/DebugPanel' // Debug panelini içe aktar

// HTML'deki id="root" elementini bul ve React uygulamasını içine yerleştir
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* HataYakalayici: Tüm uygulamadaki beklenmedik hataları yakalar */}
    <HataYakalayici>
      <AnaUygulama />
      <DebugPanel />
    </HataYakalayici>
  </StrictMode>,
)
