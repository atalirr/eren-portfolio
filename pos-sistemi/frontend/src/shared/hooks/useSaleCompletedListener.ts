/**
 * Custom Hook: Sale Completed Event Listener
 * Satış tamamlandığında otomatik veri yenileme için kullanılır
 */

import { useEffect } from 'react';

interface UseSaleCompletedListenerOptions {
  /**
   * Satış tamamlandığında çağrılacak fonksiyon
   */
  onSaleCompleted: () => void;
  
  /**
   * Periyodik güncelleme interval'i (ms) - 0 ise periyodik güncelleme yapılmaz
   * @default 0
   */
  refreshInterval?: number;
  
  /**
   * Satış tamamlandıktan sonra ne kadar bekleyip yenileme yapılacak (ms)
   * @default 500
   */
  delay?: number;
}

/**
 * Satış tamamlandı event'ini dinler ve otomatik veri yenileme yapar
 * 
 * @example
 * ```tsx
 * useSaleCompletedListener({
 *   onSaleCompleted: () => loadData(),
 *   refreshInterval: 10000, // Her 10 saniyede bir güncelle
 *   delay: 500 // Satış sonrası 500ms bekle
 * });
 * ```
 */
export function useSaleCompletedListener({
  onSaleCompleted,
  refreshInterval = 0,
  delay = 500,
}: UseSaleCompletedListenerOptions): void {
  useEffect(() => {
    // Satış yapıldığında event'i dinle ve anında güncelle
    const handleSaleCompleted = (event?: Event) => {
      console.log('🎉 Sale-completed event yakalandı!', event);
      if (delay > 0) {
        setTimeout(() => {
          console.log('⏰ Delay sonrası onSaleCompleted çağrılıyor...');
          onSaleCompleted();
        }, delay);
      } else {
        console.log('⚡ Anında onSaleCompleted çağrılıyor...');
        onSaleCompleted();
      }
    };

    window.addEventListener('sale-completed', handleSaleCompleted);

    // Cross-window destek: başka bir pencere/tab satış yaptıysa localStorage üzerinden yakala
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== 'pos-sale-completed') return;
      handleSaleCompleted(e as any);
    };
    window.addEventListener('storage', handleStorage);

    // Periyodik güncelleme (eğer interval belirtilmişse)
    let interval: NodeJS.Timeout | null = null;
    if (refreshInterval > 0) {
      interval = setInterval(onSaleCompleted, refreshInterval);
    }

    return () => {
      window.removeEventListener('sale-completed', handleSaleCompleted);
      window.removeEventListener('storage', handleStorage);
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [onSaleCompleted, refreshInterval, delay]);
}


