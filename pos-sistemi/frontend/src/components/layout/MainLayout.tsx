/**
 * Main Layout Component
 * Sidebar + Ana içerik alanını kapsayan layout
 * Kullanıcı profili artık PageHeader içinde gösterilir (sticky, her sayfada)
 */

import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/shared/utils/cn';

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarCollapsed, isLoggedIn, user } = useAppStore();



  // Global barkod okuyucu / klavye yönlendirme listener'ı
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Sadece tek karakterli yazılabilir tuşları ve herhangi bir kontrol (Ctrl, Alt, Meta) tuşu basılı değilse yakala
      const isPrintableKey = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey;
      if (!isPrintableKey) return;

      const activeEl = document.activeElement;
      
      // Eğer ekranda herhangi bir modal açık ise tuşları yönlendirme
      const isModalOpen = document.querySelector('.fixed.inset-0') !== null;
      if (isModalOpen) return;

      // Eğer kullanıcı zaten bir input veya textarea içindeyse, odağı bozma
      const isInputFocused = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        (activeEl as HTMLElement).isContentEditable
      );
      if (isInputFocused) return;

      // Sayfadaki barkod hedeflenen input elementini bul (data-barcode-target="true")
      const barcodeInput = document.querySelector('input[data-barcode-target="true"]') as HTMLInputElement;
      
      if (barcodeInput) {
        barcodeInput.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // ── Koşullu return'ler hook'lardan SONRA ──
  if (!isLoggedIn || !user) {
    return <Navigate to="/login" replace />;
  }

  // navigate kullanılmıyor ama ileride gerekebilir
  void navigate;

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-x-hidden w-full max-w-full">
      {/* Sidebar */}
      <Sidebar />

      {/* Ana İçerik Alanı — kullanıcı profili PageHeader içinde sticky olarak görünür */}
      <div className={cn(
        'flex-1 min-h-screen flex flex-col transition-all duration-300 overflow-x-hidden w-full max-w-full',
        sidebarCollapsed ? 'ml-20' : 'ml-64'
      )}>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
