import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Trash2,
  ShoppingCart,
  Percent,
  Monitor,
  Pause,
  Package,
  CheckCircle2,
  FileText,
  X,
  LogOut,
  Keyboard,
} from 'lucide-react';

// Hooks & Services
import { useSales } from '../hooks/useSales';
import { Product, HeldOrder } from '../types/sales.types';
import { customersApi, Customer } from '../services/customersApi';
import { PageHeader } from '@/shared/components';
import { cn } from '@/shared/utils/cn';

// Subcomponents
import { CartItemRow } from './CartItemRow';
import { 
  CustomerModal, 
  HeldOrdersModal, 
  OptionsModal, 
  DiscountModal, 
  TransferModal, 
  ChangeModal, 
  SuccessModal, 
  CreditSaleModal,
  PaymentModal 
} from './SalesModals';


export function SalesPage() {
  const navigate = useNavigate();
  const {
    products,
    cart,
    addToCart,
    removeFromCart,
    updateCartItem,
    applyItemDiscount,
    removeItemDiscount,
    clearCart,
    restoreCart,
    calculateTotal,
    calculateFinalTotal,
    completeSale,
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    refreshProducts,
    loading
  } = useSales();

  // KDV Gruplarını Hesapla
  const kdvGroups = useMemo(() => {
    const groups: Record<number, number> = {};
    cart.forEach(item => {
      const rate = item.tax_rate ?? 20;
      // KDV dahil birim fiyattan KDV miktarını ayır (Tutar = Matrah + KDV)
      // KDV = Tutar - (Tutar / (1 + Oran/100))
      const taxAmount = (item.unitPrice * item.quantity) - ((item.unitPrice * item.quantity) / (1 + rate / 100));
      groups[rate] = (groups[rate] || 0) + taxAmount;
    });
    return groups;
  }, [cart]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedParentProduct, setSelectedParentProduct] = useState<Product | null>(null);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [productVariants, setProductVariants] = useState<Product[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldOrdersModal, setShowHeldOrdersModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [showSecondScreenModal, _setShowSecondScreenModal] = useState(false);
  const [changeInfo, setChangeInfo] = useState<{ given: number; change: number } | null>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditCustomerName, setCreditCustomerName] = useState('');
  const [creditCustomerPhone, setCreditCustomerPhone] = useState('');
  const [creditDueDate, setCreditDueDate] = useState('');
  const [creditDebtAmount, setCreditDebtAmount] = useState('');
  const [creditDownPaymentMethod, setCreditDownPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');

  // Modern Toast/Alert State ve Override
  const [alertInfo, setAlertInfo] = useState<{ show: boolean; message: string; type: 'warning' | 'error' | 'success' }>({
    show: false,
    message: '',
    type: 'warning'
  });

  const showCustomAlert = (message: string, type: 'warning' | 'error' | 'success' = 'warning') => {
    setAlertInfo({ show: true, message, type });
  };

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message: string) => {
      const msgLower = message.toLowerCase();
      const isError = msgLower.includes('yetersiz') || msgLower.includes('hata') || msgLower.includes('zorunludur');
      const isSuccess = msgLower.includes('başarılı') || msgLower.includes('tamamlandı') || msgLower.includes('alındı');
      showCustomAlert(message, isError ? 'error' : isSuccess ? 'success' : 'warning');
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  useEffect(() => {
    if (alertInfo.show) {
      const timer = setTimeout(() => {
        setAlertInfo(prev => ({ ...prev, show: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [alertInfo.show]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const lastScanTimeRef = useRef<number>(0); // Barkod çift okuma önleme

  // Donanım Barkod Okuyucu ve Kısayol State Referansları
  const barcodeBufferRef = useRef<string>('');
  const lastKeystrokeTimeRef = useRef<number>(0);
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const productsRef = useRef(products);
  productsRef.current = products;
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  // Barkod okunduğunda çalan hafif geri bildirim sesi (Web Audio API)
  const playBarcodeSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1760, ctx.currentTime); // 1760 Hz (A6) net hoş bip
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch {
      // AudioContext engellenmişse sessizce geç
    }
  };

  // Auto-focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Herhangi bir modal açıkken arama barından odağı kaldır
  const isAnyModalOpen = showDiscountModal || showOptionsModal || showCustomerModal || showHeldOrdersModal || showSizeModal || showPaymentModal || showTransferModal || showChangeModal || showSuccessModal || showCreditModal;
  const isAnyModalOpenRef = useRef(isAnyModalOpen);
  isAnyModalOpenRef.current = isAnyModalOpen;

  useEffect(() => {
    if (isAnyModalOpen) {
      searchInputRef.current?.blur();
    }
  }, [isAnyModalOpen]);

  // Click outside to close product search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const secondScreenRef = useRef<Window | null>(null);

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const data = await customersApi.getAll();
        setCustomers(data);
      } catch (error) {
        console.error('Müşteriler yüklenemedi:', error);
      }
    };
    loadCustomers();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('heldOrders');
    if (saved) {
      try { setHeldOrders(JSON.parse(saved)); } catch {}
    }
  }, []);

  const saveHeldOrders = (orders: HeldOrder[]) => {
    setHeldOrders(orders);
    localStorage.setItem('heldOrders', JSON.stringify(orders));
  };

  useEffect(() => {
    if (searchQuery.length < 2) {
      setFilteredProducts([]);
      setShowProductDropdown(false);
      return;
    }
    const filtered = products.filter(
      (p) =>
        !p.parent_id && ( // Sadece parent ürünleri göster (variant değil)
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
        )
    );
    setFilteredProducts(filtered);
    setShowProductDropdown(filtered.length > 0);
  }, [searchQuery, products]);

  const subtotalBeforeDiscount = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const itemDiscountsTotal = cart.reduce((sum, item) => sum + (item.discount || 0), 0);
  
  let generalDiscount = 0;
  if (discountType && discountValue > 0) {
    const totalAfterItemDiscounts = subtotalBeforeDiscount - itemDiscountsTotal;
    if (discountType === 'PERCENT') {
      generalDiscount = totalAfterItemDiscounts * (discountValue / 100);
    } else {
      generalDiscount = discountValue;
    }
  }
  
  const discountAmount = itemDiscountsTotal + generalDiscount;
  const finalAmount = subtotalBeforeDiscount - discountAmount;
  
  // KDV hesaplamasını sabit 0.20 yerine sepet verisinden dinamik al
  const kdvAmount = Object.values(kdvGroups).reduce((sum, val) => sum + val, 0);
  const netSubtotal = subtotalBeforeDiscount - kdvAmount;
  const avgKdvRate = finalAmount > 0 ? (kdvAmount / (finalAmount - kdvAmount)) : 0;

  // İkinci ekranı canlı güncelle
  const updateSecondScreen = () => {
    const w = secondScreenRef.current;
    if (!w || w.closed) return;

    const totalQty = cart.reduce((s, i) => s + i.quantity, 0);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

    const itemRows = cart.map((item, idx) => {
      const itemTotal = item.subtotal;
      const originalTotal = item.unitPrice * item.quantity;
      const hasDisc = (item.discount || 0) > 0;
      return `
        <tr class="${idx % 2 === 0 ? 'row-even' : ''}">
          <td class="td-idx">${idx + 1}</td>
          <td class="td-name">
            <div class="p-name font-serif">
              ${item.productName}
              ${item.brand ? `<span class="brand-tag">${item.brand}</span>` : ''}
              ${item.size ? `<span class="size-tag">Beden: ${item.size}</span>` : ''}
            </div>
            <div class="p-meta">${item.quantity} ${item.unit || 'adet'} &times; ₺${item.unitPrice.toFixed(2)}</div>
          </td>
          <td class="td-amt">
            ${hasDisc ? `<div class="amt-orig">₺${originalTotal.toFixed(2)}</div>` : ''}
            <div class="amt-val ${hasDisc ? 'text-green' : ''}">₺${itemTotal.toFixed(2)}</div>
            ${hasDisc ? `<div class="amt-disc">−₺${(item.discount||0).toFixed(2)}</div>` : ''}
          </td>
        </tr>`;
    }).join('');

    const isEmpty = cart.length === 0;
    const origin = window.location.origin;

    const kdvRows = Object.entries(kdvGroups)
      .filter(([, amt]) => amt > 0)
      .map(([rate, amt]) => `
        <div class="summ-row">
          <span class="summ-lbl">KDV %${rate}</span>
          <span class="summ-val">₺${amt.toFixed(2)}</span>
        </div>`)
      .join('');

    const showChange = changeInfo && changeInfo.change > 0;
    const customerName = selectedCustomer ? `${selectedCustomer.name} ${selectedCustomer.last_name || ''}`.toUpperCase().trim() : null;

    w.document.body.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
          background: #f8fafc;
          color: #0f172a;
          display: flex; flex-direction: column;
          height: 100vh; overflow: hidden;
        }

        /* ── HEADER ── */
        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 24px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #fff;
          border-bottom: 3px solid #3b82f6;
          flex-shrink: 0;
          min-height: 76px;
        }
        .header-left { display: flex; flex-direction: column; justify-content: center; gap: 2px; }
        .clock-time { font-size: 24px; font-weight: 900; color: #fff; font-variant-numeric: tabular-nums; letter-spacing: -0.5px; line-height: 1; }
        .clock-date { font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: .01em; }

        /* QR sağ üst - çerçevesiz */
        .header-qr {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
        }
        .header-qr img {
          width: 56px; height: 56px; object-fit: contain;
          background: #fff; padding: 4px;
          border-radius: 8px; display: block;
        }
        .header-qr-err {
          width: 56px; height: 56px; background: rgba(255,255,255,0.1);
          border-radius: 8px; display: none; align-items: center;
          justify-content: center; font-size: 8px; color: rgba(255,255,255,0.4);
        }
        .header-qr-lbl {
          font-size: 9px; font-weight: 700; color: rgba(255,255,255,0.82);
          letter-spacing: .02em; text-align: center;
        }

        /* ── CONTENT (SPLIT LAYOUT) ── */
        .content-wrap {
          flex: 1; display: flex; overflow: hidden; padding: 24px; gap: 24px;
        }

        /* Sol Sütun: Ürünler */
        .left-col {
          flex: 1.3; display: flex; flex-direction: column;
          background: #fff; border-radius: 20px; border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); overflow: hidden;
          transition: all 0.3s ease;
        }
        .left-col.full-width {
          flex: 1;
        }
        .tbl-head {
          display: grid; grid-template-columns: 44px 1fr 140px;
          padding: 0 20px; border-bottom: 2px solid #e2e8f0;
          background: #f1f5f9; flex-shrink: 0;
        }
        .th { font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: .15em; padding: 12px 0; }
        .th-r { text-align: right; }

        .tbl-body { flex: 1; overflow-y: auto; }
        .tbl-body::-webkit-scrollbar { width: 4px; }
        .tbl-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }

        table { width: 100%; border-collapse: collapse; }
        tr { border-bottom: 1px solid #f1f5f9; transition: background-color 0.2s; }
        tr:last-child { border-bottom: none; }
        tr:hover { background-color: #f8fafc; }
        tr.row-even { background: #fafbfc; }

        .td-idx { width: 44px; padding: 14px 0 14px 20px; font-size: 11px; font-weight: 800; color: #94a3b8; vertical-align: top; }
        .td-name { padding: 14px 12px 14px 0; vertical-align: top; }
        .td-amt { padding: 14px 20px 14px 0; text-align: right; vertical-align: top; white-space: nowrap; }

        .p-name { font-size: 14px; font-weight: 800; color: #0f172a; line-height: 1.3; }
        .p-name.font-serif { font-family: Georgia, serif; font-weight: 900; }
        .brand-tag { display: inline-block; font-size: 8px; font-weight: 800; padding: 1px 6px; background: #f1f5f9; color: #0f172a; text-transform: uppercase; letter-spacing: .08em; margin-left: 7px; vertical-align: middle; border-radius: 4px; border: 1px solid #cbd5e1; }
        .size-tag { display: inline-block; font-size: 8px; font-weight: 800; padding: 1px 6px; background: #eff6ff; color: #2563eb; text-transform: uppercase; letter-spacing: .08em; margin-left: 7px; vertical-align: middle; border-radius: 4px; border: 1px solid #bfdbfe; }
        .p-meta { font-size: 11px; font-weight: 500; color: #64748b; margin-top: 4px; }

        .amt-val { font-size: 15px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
        .amt-val.text-green { color: #059669; }
        .amt-orig { font-size: 11px; color: #94a3b8; text-decoration: line-through; font-variant-numeric: tabular-nums; margin-bottom: 1px; }
        .amt-disc { font-size: 9px; font-weight: 700; color: #ef4444; margin-top: 2px; }

        /* Sağ Sütun: Ödeme Paneli */
        .right-col {
          flex: 1; display: flex; flex-direction: column; gap: 20px;
        }

        /* Müşteri Kartı (Sağ Sütun) */
        .customer-card {
          background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 16px;
          padding: 14px 18px; display: flex; align-items: center; gap: 12px;
          color: #1e3a8a; flex-shrink: 0;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
        }
        .customer-icon {
          width: 36px; height: 36px; border-radius: 12px; background: #dbeafe;
          display: flex; align-items: center; justify-content: center; font-size: 18px;
        }
        .customer-lbl { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #3b82f6; }
        .customer-name { font-size: 14px; font-weight: 800; margin-top: 1px; color: #1e3a8a; }

        /* Özet Tablosu (Sol Sütun Alt Panel) */
        .left-summary-panel {
          background: #fff; border-top: 2px solid #e2e8f0;
          display: flex; flex-direction: column; flex-shrink: 0;
        }
        .left-summary-details {
          padding: 14px 20px;
          display: flex; flex-direction: column; gap: 8px;
          background: #f8fafc; border-bottom: 1px solid #e2e8f0;
        }
        .summ-row { display: flex; align-items: center; justify-content: space-between; }
        .summ-lbl { font-size: 13px; font-weight: 500; color: #475569; }
        .summ-val { font-size: 13px; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; }
        .summ-val.neg { color: #ef4444; font-weight: 800; }
        .summ-divider { height: 1px; background: #e2e8f0; margin: 6px 0; }

        /* Toplam Alanı (Sol Sütun Altı) */
        .left-total-bar {
          background: #eff6ff;
          padding: 12px 20px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .total-info { display: flex; flex-direction: column; }
        .total-lbl { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .15em; color: #1e3a8a; }
        .total-sub { font-size: 11px; color: #3b82f6; font-weight: 600; margin-top: 2px; }
        .total-val-wrap { display: flex; align-items: baseline; gap: 3px; color: #1e3a8a; }
        .total-symbol { font-size: 16px; font-weight: 700; }
        .total-val { font-size: 28px; font-weight: 900; font-variant-numeric: tabular-nums; letter-spacing: -1px; line-height: 1; }

        /* Minimal Para Üstü Satırı */
        .summary-change-bar {
          background: #f0fdf4;
          border-top: 1.5px solid #bbf7d0;
          padding: 12px 20px;
          display: flex; justify-content: space-between; align-items: center;
          flex-shrink: 0;
        }
        .change-lbl-wrap { display: flex; flex-direction: column; gap: 2px; }
        .change-lbl { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .15em; color: #166534; }
        .change-given { font-size: 13px; font-weight: 700; color: #15803d; font-variant-numeric: tabular-nums; }
        .change-val { font-size: 24px; font-weight: 900; color: #16a34a; font-variant-numeric: tabular-nums; letter-spacing: -0.5px; line-height: 1; }

        /* ── WELCOME SCREEN (EMPTY STATE) ── */
        .welcome-wrap {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%; background: radial-gradient(circle at center, #ffffff 0%, #f1f5f9 100%);
          text-align: center; flex: 1;
        }
        .welcome-clock { font-size: 72px; font-weight: 900; color: #0f172a; letter-spacing: -3px; line-height: 1; }
        .welcome-date { font-size: 18px; color: #64748b; margin-top: 10px; font-weight: 600; }
        .welcome-card {
          margin-top: 40px; padding: 40px 60px; background: #fff;
          border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.08);
          border: 1px solid #e2e8f0; max-width: 540px;
        }
        .welcome-title { font-size: 26px; font-weight: 900; color: #2563eb; letter-spacing: .15em; text-transform: uppercase; margin-bottom: 12px; }
        .welcome-desc { font-size: 13px; font-weight: 500; color: #475569; line-height: 1.6; }

        /* ── FOOTER ── */
        .footer {
          display: flex; align-items: center; justify-content: center;
          padding: 14px; background: #0f172a; gap: 32px; flex-shrink: 0;
        }
        .footer-text { font-size: 11px; font-weight: 800; letter-spacing: .15em; color: #fbbf24; }
      </style>

      <!-- HEADER -->
      <div class="header">
        <div class="header-left">
          <div class="clock-time">${timeStr}</div>
          <div class="clock-date">${dateStr}</div>
        </div>
        <div class="header-qr">
          <img
            src="${origin}/qr-payment.png"
            alt="QR"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
          />
          <div class="header-qr-err">QR Yok</div>
          <div class="header-qr-lbl">İşletmemize puan verin!</div>
        </div>
      </div>

      <!-- MAIN WRAPPER -->
      ${isEmpty ? `
        <div class="welcome-wrap">
          <div class="welcome-clock">${timeStr}</div>
          <div class="welcome-date">${dateStr}</div>
          <div class="welcome-card">
            <div class="welcome-title">HOŞ GELDİNİZ</div>
            <div class="welcome-desc">Kasa görevlisi ürünlerinizi eklerken sepet detaylarınızı ve tutarları buradan anlık olarak takip edebilirsiniz.</div>
          </div>
        </div>
      ` : `
        <div class="content-wrap">
          <!-- Sol Sütun: Ürün Listesi ve Alt Kısımda Özet -->
          <div class="left-col ${!customerName ? 'full-width' : ''}">
            <div class="tbl-head">
              <span class="th"></span>
              <span class="th">Ürün Tanımı</span>
              <span class="th th-r" style="padding-right:20px">Tutar</span>
            </div>
            <div class="tbl-body">
              <table><tbody>${itemRows}</tbody></table>
            </div>

            <!-- Özet ve Ödenecek Tutar Paneli (Ürün Kartının En Altı) -->
            <div class="left-summary-panel">
              <!-- Detaylar -->
              <div class="left-summary-details">
                <div class="summ-row">
                  <span class="summ-lbl">Ara Toplam (KDV Hariç)</span>
                  <span class="summ-val">₺${netSubtotal.toFixed(2)}</span>
                </div>
                ${itemDiscountsTotal > 0 ? `
                  <div class="summ-row">
                    <span class="summ-lbl">Ürün İndirimleri</span>
                    <span class="summ-val neg">−₺${itemDiscountsTotal.toFixed(2)}</span>
                  </div>
                ` : ''}
                ${generalDiscount > 0 ? `
                  <div class="summ-row">
                    <span class="summ-lbl">Genel İndirim${discountType === 'PERCENT' ? ` (%${discountValue})` : ''}</span>
                    <span class="summ-val neg">−₺${generalDiscount.toFixed(2)}</span>
                  </div>
                ` : ''}
                ${kdvRows}
              </div>

              <!-- Toplam Ödeme Barı -->
              <div class="left-total-bar">
                <div class="total-info">
                  <div class="total-lbl">ÖDENECEK TUTAR</div>
                  <div class="total-sub">Toplam ${totalQty} Kalem Ürün · Fiyatlara KDV Dahildir</div>
                </div>
                <div class="total-val-wrap">
                  <span class="total-symbol">₺</span>
                  <span class="total-val">${finalAmount.toFixed(2)}</span>
                </div>
              </div>

              <!-- Para Üstü Bilgisi (Ödeme barının altına yeni bir satır olarak eklendi) -->
              ${showChange ? `
                <div class="summary-change-bar">
                  <div class="change-lbl-wrap">
                    <span class="change-lbl">Ödenen Nakit</span>
                    <span class="change-given">₺${changeInfo!.given.toFixed(2)}</span>
                  </div>
                  <div class="change-lbl-wrap" style="align-items:flex-end">
                    <span class="change-lbl">Para Üstü</span>
                    <span class="change-val">₺${changeInfo!.change.toFixed(2)}</span>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Sağ Sütun: Yalnızca Müşteri Kartı (Varsa) -->
          ${customerName ? `
            <div class="right-col">
              <div class="customer-card">
                <div class="customer-icon">👤</div>
                <div class="customer-info-inner">
                  <div class="customer-lbl">MÜŞTERİ</div>
                  <div class="customer-name">${customerName}</div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      `}

      <!-- FOOTER -->
      <div class="footer">
        <div class="footer-text">TEŞEKKÜR EDERİZ</div>
        <div class="footer-text">YİNE BEKLERİZ</div>
        <div class="footer-text">İYİ ALIŞVERİŞLER</div>
      </div>
    `;
  };

  useEffect(() => { if (cart.length === 0) setChangeInfo(null); }, [cart.length]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { updateSecondScreen(); }, [cart, discountAmount, finalAmount, changeInfo, selectedCustomer]);

  const handleHoldSale = () => {
    if (cart.length === 0) { alert('Sepet boş!'); return; }
    const heldOrder: HeldOrder = {
      id: Date.now().toString(),
      cart: cart.map((item) => ({ ...item })),
      customer: selectedCustomer ? { ...selectedCustomer } : null,
      discountType,
      discountValue,
      totalAmount: subtotalBeforeDiscount,
      finalAmount,
      timestamp: new Date().toISOString(),
    };
    saveHeldOrders([...heldOrders, heldOrder]);
    clearCart();
    setSelectedCustomer(null);
    alert('Satış beklemeye alındı!');
  };

  const handleRestoreHeldOrder = (heldOrder: HeldOrder) => {
    clearCart();
    restoreCart(heldOrder.cart);
    if (heldOrder.customer) setSelectedCustomer(heldOrder.customer as Customer);
    setDiscountType(heldOrder.discountType || null);
    setDiscountValue(heldOrder.discountValue || 0);
    const updated = heldOrders.filter((o) => o.id !== heldOrder.id);
    saveHeldOrders(updated);
    setShowHeldOrdersModal(false);
  };

  const handleSaveCreditSale = async (overrideData?: { customerName: string; customerPhone: string; dueDate: string; debtAmount: string; downPaymentMethod: 'CASH' | 'CARD' | 'TRANSFER' }) => {
    const cName = overrideData ? overrideData.customerName : creditCustomerName;
    const cPhone = overrideData ? overrideData.customerPhone : creditCustomerPhone;
    const cDueDate = overrideData ? overrideData.dueDate : creditDueDate;
    const cDebtAmount = overrideData ? overrideData.debtAmount : creditDebtAmount;
    const cDownPaymentMethod = overrideData ? overrideData.downPaymentMethod : creditDownPaymentMethod;

    if (!cName.trim()) { alert('Müşteri adı zorunludur!'); return; }
    try {
      setIsProcessing(true);
      
      let customerId = selectedCustomer?.id;
      
      // Eğer seçili müşteri yoksa veya girilen isim seçili olandan farklıysa yeni müşteri oluştur
      if (!customerId || selectedCustomer?.name !== cName) {
        try {
          const newCustomer = await customersApi.create({
            name: cName,
            phone: cPhone || undefined
          });
          customerId = newCustomer.id;
        } catch (cError: any) {
          console.error('Müşteri oluşturma hatası:', cError);
          throw new Error('Müşteri kaydı oluşturulamadı, lütfen tekrar deneyin.');
        }
      }

      const { salesApi } = await import('../services/salesApi');

      const parsedDebtAmount = parseFloat(cDebtAmount) || finalAmount;

      const orderData = {
        customer_id: customerId,
        payment_method: 'DEBT' as const,
        platform: 'STORE' as const,
        total_amount: subtotalBeforeDiscount,
        discount_type: discountType || null,
        discount_value: discountValue || 0,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        items: cart.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
          price: item.unitPrice,
          discount: item.discount || 0,
        })),
        due_date: cDueDate || undefined,
      };

      // Backend satış servisi DEBT transaction'ı otomatik oluşturuyor
      const result = await salesApi.createSale(orderData, 'default-user');

      // Kısmi ödeme varsa (Borç tutarı < Toplam tutar) peşinat nakit gelir olarak yaz
      if (parsedDebtAmount < finalAmount) {
        const { transactionsApi } = await import('../../transactions/services/transactionsApi');
        const paidPart = finalAmount - parsedDebtAmount;
        await transactionsApi.addIncome(
          paidPart,
          'Veresiye Tahsilat (Peşinat)',
          `Satış #${result.order_number} için peşin alınan tutar`,
          'default-user',
          'CASH',
          'CASH',
        );
      }

      localStorage.setItem('pos-sale-completed', new Date().toISOString());
      window.dispatchEvent(new Event('sale-completed'));
      await refreshProducts();

      setCompletedOrder({
        ...result,
        items: cart.map(item => ({ ...item })),
        customer: selectedCustomer || { id: customerId, name: cName },
        paymentMethod: 'DEBT',
        subtotalBeforeDiscount,
        discountAmount,
        final_amount: parsedDebtAmount,
      });

      // Sepeti ve form durumlarını hemen sıfırla
      clearCart();
      setSelectedCustomer(null);
      setDiscountType(null);
      setDiscountValue(0);

      setShowCreditModal(false);
      setShowSuccessModal(true);
    } catch (error: any) {
      const apiErrorMessage = error.response?.data?.detail || error.message;
      alert(`Hata: ${apiErrorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteSale = async (
    method: 'CASH' | 'CARD' | 'TRANSFER',
  ) => {
    if (cart.length === 0) return;
    try {
      setIsProcessing(true);
      const { salesApi } = await import('../services/salesApi');
      
      let customerId = selectedCustomer?.id || null;

      const orderData = {
        customer_id: customerId,
        payment_method: method,
        platform: 'STORE' as const,
        source: 'POS',
        total_amount: subtotalBeforeDiscount,
        discount_type: discountType || null,
        discount_value: discountValue || 0,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        items: cart.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
          price: item.unitPrice,       // Ham birim fiyat (indirim öncesi); discount ayrıca gönderiliyor
          discount: item.discount || 0,
        })),
      };

      const createdOrder = await salesApi.createSale(orderData, 'default-user');

      setCompletedOrder({
        ...createdOrder,
        items: cart.map(item => ({ ...item })),
        customer: selectedCustomer || null,
        paymentMethod: method,
        subtotalBeforeDiscount,
        discountAmount,
        final_amount: finalAmount,
      });

      // Sepeti ve form durumlarını hemen sıfırla
      clearCart();
      setSelectedCustomer(null);
      setDiscountType(null);
      setDiscountValue(0);

      setShowPaymentModal(false);
      setShowSuccessModal(true);
      localStorage.setItem('pos-sale-completed', new Date().toISOString());
      window.dispatchEvent(new Event('sale-completed'));
      await refreshProducts();
    } catch (error: any) {
      const apiErrorMessage = error.response?.data?.detail || error.message;
      alert(`Hata: ${apiErrorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteSaleRef = useRef(handleCompleteSale);
  handleCompleteSaleRef.current = handleCompleteSale;

  // ── GLOBAL DONANIM BARKOD OKUYUCU VE POS KLAVYE KISAYOLLARI DİNLEYİCİSİ ──
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. POS Hızlı Kısayol Tuşları (F2, F4, F8, F9, Escape)
      if (e.key === 'F2') {
        e.preventDefault();
        if (!isAnyModalOpenRef.current && !isProcessingRef.current) {
          if (cartRef.current.length > 0) {
            handleCompleteSaleRef.current('CASH');
          } else {
            showCustomAlert('Hızlı nakit satış için sepete en az bir ürün ekleyin.', 'warning');
          }
        }
        return;
      }

      if (e.key === 'F4') {
        e.preventDefault();
        if (!isAnyModalOpenRef.current && !isProcessingRef.current) {
          if (cartRef.current.length > 0) {
            handleCompleteSaleRef.current('CARD');
          } else {
            showCustomAlert('Hızlı kart satışı için sepete en az bir ürün ekleyin.', 'warning');
          }
        }
        return;
      }

      if (e.key === 'F8') {
        e.preventDefault();
        if (!isProcessingRef.current) {
          setShowCustomerModal(true);
        }
        return;
      }

      if (e.key === 'F9') {
        e.preventDefault();
        if (!isAnyModalOpenRef.current && !isProcessingRef.current) {
          if (cartRef.current.length > 0) {
            setShowCreditModal(true);
          } else {
            showCustomAlert('Veresiye satış için sepete en az bir ürün ekleyin.', 'warning');
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (isAnyModalOpenRef.current) {
          setShowCustomerModal(false);
          setShowHeldOrdersModal(false);
          setShowOptionsModal(false);
          setShowDiscountModal(false);
          setShowTransferModal(false);
          setShowChangeModal(false);
          setShowCreditModal(false);
          setShowSizeModal(false);
          setShowPaymentModal(false);
          setShowSuccessModal(false);
        } else {
          setShowProductDropdown(false);
          setSearchQuery('');
          searchInputRef.current?.focus();
        }
        return;
      }

      // 2. Donanım Barkod Okuyucu Dinleyicisi (Hardware Barcode Scanner)
      // Modallar açıkken barkod okuyucunun araya girmesini engelle
      if (isAnyModalOpenRef.current) {
        barcodeBufferRef.current = '';
        return;
      }

      // Kullanıcı herhangi bir metin giriş kutusunda (input, textarea vb.) yazıyorsa global tamponu atla
      const target = e.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      if (isInput) {
        return;
      }

      const now = Date.now();
      // Barkod okuyucular tuşları 20-50ms aralığında art arda basar. 150ms üzeri insan yazımıdır, sıfırla.
      if (now - lastKeystrokeTimeRef.current > 150) {
        barcodeBufferRef.current = '';
      }
      lastKeystrokeTimeRef.current = now;

      if (e.key === 'Enter') {
        const rawCode = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = '';
        if (rawCode.length >= 2) {
          e.preventDefault();
          const lowerCode = rawCode.toLowerCase();
          const matched = productsRef.current.find(
            p => p.barcode && p.barcode.trim().toLowerCase() === lowerCode
          );

          if (matched) {
            const variants = productsRef.current.filter(v => v.parent_id === matched.id);
            if (variants.length > 0) {
              setSelectedParentProduct(matched);
              setProductVariants(variants);
              setShowSizeModal(true);
            } else {
              addToCart(matched, 1);
              playBarcodeSound();
              showCustomAlert(`Barkod Okundu: ${matched.name}`, 'success');
            }
          } else {
            // Kod veya SKU eşleşmesi
            const bySku = productsRef.current.find(
              p => (p.sku && p.sku.trim().toLowerCase() === lowerCode) ||
                   (p.code && (p as any).code.trim().toLowerCase() === lowerCode)
            );
            if (bySku) {
              addToCart(bySku, 1);
              playBarcodeSound();
              showCustomAlert(`Ürün Eklendi: ${bySku.name}`, 'success');
            } else {
              showCustomAlert(`Barkod bulunamadı: ${rawCode}`, 'warning');
            }
          }
        }
        return;
      }

      // Sadece yazdırılabilir karakterleri tampona ekle
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [addToCart]);

  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans antialiased text-slate-800">
      
      <PageHeader
        title="SATIŞ (POS)"
        icon={true}
        hideUser={true}
        actions={
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100/90 border border-slate-200/80 rounded-full text-slate-600 shadow-2xs">
            <Keyboard className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-700">Klavye Kısayolları:</span>
            <span className="text-[11px] font-medium text-slate-600">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-800 shadow-2xs">F2</kbd> Nakit
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] font-medium text-slate-600">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-800 shadow-2xs">F4</kbd> Kart
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] font-medium text-slate-600">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-800 shadow-2xs">F8</kbd> Müşteri
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] font-medium text-slate-600">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-800 shadow-2xs">F9</kbd> Veresiye
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] font-medium text-slate-600">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-800 shadow-2xs">Esc</kbd> Temizle
            </span>
          </div>
        }
      />

      <div className="flex-1 flex overflow-hidden gap-0 p-2 lg:p-4">
        {/* ── SOL PANEL: ARAMA + SEPET ── */}
        <div className="flex-[2.2] flex flex-col bg-white rounded-2xl border border-slate-400 h-full overflow-hidden shadow-sm">
          {/* Internal Header for search only */}
          <div className="px-4 py-3 border-b border-slate-400 bg-white flex items-center gap-4">

          {/* Arama */}
          <div ref={searchContainerRef} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={searchInputRef}
              data-barcode-target="true"
              type="text"
              placeholder="Ürün adı veya barkod..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                refreshProducts();
              }}
              onFocus={() => {
                refreshProducts();
                if (searchQuery.length >= 2) {
                  setShowProductDropdown(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const now = Date.now();
                  if (now - lastScanTimeRef.current < 500) return; // 500ms cooldown - çift okuma önleme
                  lastScanTimeRef.current = now;

                  const trimmed = searchQuery.trim().toLowerCase();
                  if (!trimmed) return;

                  // 1. Herhangi bir ürünün barkoduna tam eşitlik var mı kontrol et (parent veya variant)
                  const exactBarcodeProduct = products.find(
                    p => p.barcode && p.barcode.trim().toLowerCase() === trimmed
                  );

                  if (exactBarcodeProduct) {
                    addToCart(exactBarcodeProduct, 1);
                    setSearchQuery('');
                    setShowProductDropdown(false);
                    playBarcodeSound();
                    showCustomAlert(`Barkod Okundu: ${exactBarcodeProduct.name}`, 'success');
                    return;
                  }

                  // 2. Barkod tam eşleşmesi yoksa ve filtrelenmiş ürün listesinde eşleşen varsa
                  if (filteredProducts.length > 0) {
                    const firstProduct = filteredProducts[0];
                    // Seçilen ürünün alt varyantları (beden/renk) varsa, size modalını aç (seçim yapmak zorunda kalsın)
                    const variants = products.filter(v => v.parent_id === firstProduct.id);
                    if (variants.length > 0) {
                      setSelectedParentProduct(firstProduct);
                      setProductVariants(variants);
                      setShowSizeModal(true);
                    } else {
                      // Varyant yoksa doğrudan sepete ekle
                      addToCart(firstProduct, 1);
                      playBarcodeSound();
                      showCustomAlert(`Ürün Eklendi: ${firstProduct.name}`, 'success');
                    }
                  }
                  setSearchQuery('');
                  setShowProductDropdown(false);
                }
              }}
              autoFocus
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-400 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
            />

            {showProductDropdown && filteredProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-400 rounded-2xl shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">{filteredProducts.length} ürün bulundu</span>
                  <button onClick={() => setShowProductDropdown(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto modern-scrollbar">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        // Varyant kontrolü
                        const variants = products.filter(v => v.parent_id === p.id);
                        if (variants.length > 0) {
                          setSelectedParentProduct(p);
                          setProductVariants(variants);
                          setShowSizeModal(true);
                        } else {
                          addToCart(p, 1);
                        }
                        setSearchQuery('');
                        setShowProductDropdown(false);
                      }}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-indigo-50/50 transition-colors border-b border-slate-50 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400 font-mono">{p.barcode || 'Barkodsuz'}</span>
                            {p.brand && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                {p.brand}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">₺{p.sell_price.toFixed(2)}</p>
                        <p className={`text-[11px] font-medium ${p.stock_quantity > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          Stok: {p.stock_quantity}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          </div>

        {/* Sepet Başlık */}
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Sipariş Listesi</span>
            {cart.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-700 text-white rounded-md text-[10px] font-bold">{cart.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {heldOrders.length > 0 && (
              <button
                onClick={() => setShowHeldOrdersModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium text-slate-200 transition-colors"
              >
                <Pause className="w-3 h-3" />
                Bekleyenler
                <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{heldOrders.length}</span>
              </button>
            )}
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-medium text-rose-600 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Temizle
              </button>
            )}
          </div>
        </div>

        {/* Sepet İçeriği */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-100/60 shadow-[inset_0_4px_24px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-slate-200/50 relative">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="w-16 h-16 bg-white shadow-sm border border-slate-400 rounded-2xl flex items-center justify-center mb-4">
                <ShoppingCart className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-400">Sepet boş</p>
              <p className="text-xs text-slate-400 mt-1">Ürün aramak için yukarıdaki alanı kullanın veya barkod okutun.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-400 overflow-hidden divide-y divide-slate-100">
              {cart.map((item) => (
                <CartItemRow
                  key={item.productId}
                  item={item}
                  product={products.find(p => p.id === item.productId)}
                  onUpdate={(qty) => updateCartItem(item.productId, qty)}
                  onRemove={() => removeFromCart(item.productId)}
                  onRemoveDiscount={() => removeItemDiscount(item.productId)}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── SAĞ PANEL: ÖZET & ÖDEME ── */}
      <div className="w-80 flex flex-col bg-slate-700 h-full rounded-2xl ml-4 shadow-xl overflow-hidden border border-slate-600">

        {/* Panel Başlık */}
        <div className="px-4 py-3 border-b border-slate-600 text-center bg-slate-700/50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Satış Özeti</p>
        </div>

        {/* Tutar Detayları */}
        <div className="px-5 py-5 space-y-3.5 border-b border-slate-600">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-300">Ara Toplam (KDV Hariç)</span>
            <span className="text-sm font-medium text-slate-100">₺{netSubtotal.toFixed(2)}</span>
          </div>
          <div className="space-y-1.5 pt-0.5">
            {Object.entries(kdvGroups).map(([rate, amount]) => amount > 0 && (
              <div key={rate} className="flex justify-between items-center">
                <span className="text-xs text-slate-400 italic">KDV (%{rate})</span>
                <span className="text-[11px] font-medium text-slate-400">₺{amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div
            className="flex justify-between items-center cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setShowDiscountModal(true)}
          >
            <span className="text-xs text-slate-300 flex items-center gap-1">
              <Percent className="w-3 h-3 text-slate-400" /> İndirim
            </span>
            <span className="text-sm font-medium text-rose-300">
              {discountAmount > 0 ? `-₺${discountAmount.toFixed(2)}` : '0.00 ₺'}
            </span>
          </div>
        </div>
        {/* Ödenecek Tutar */}
        <div className="px-4 py-5 border-b border-slate-600 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ödenecek Tutar</p>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-lg text-slate-400 font-medium">₺</span>
            <span className="text-3xl font-bold text-white tabular-nums tracking-tight">{finalAmount.toFixed(2)}</span>
          </div>
          {cart.length > 0 && (
            <p className="text-xs text-slate-400 mt-1.5">{cart.reduce((s, i) => s + i.quantity, 0)} adet</p>
          )}
        </div>

        {/* Eylem Butonları */}
        <div className="flex-1 flex flex-col px-3 py-3 gap-2 justify-end">

          {/* Seçenekler & Beklet (Yanyana Şık Tasarım) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowOptionsModal(true)}
              className="py-3 bg-slate-800 hover:bg-slate-600 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
            >
              <Percent className="w-3.5 h-3.5 text-slate-450" />
              Seçenekler
            </button>
            <button
              onClick={handleHoldSale}
              className="py-3 bg-slate-800 hover:bg-slate-600 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
            >
              <Pause className="w-3.5 h-3.5" />
              Askıya Al (Beklet)
            </button>
          </div>

          {/* Satışı Tamamla — Tek Adım (F2: Nakit Hızlı Satış) */}
          <button
            onClick={() => handleCompleteSale('CASH')}
            disabled={cart.length === 0 || isProcessing}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-950/20 mt-1"
          >
            {isProcessing ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                İşleniyor...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Satışı Tamamla (F2)
              </>
            )}
          </button>
        </div>
      </div>
    </div>

      {/* ── MODALLAR ── */}
      {showCustomerModal && (
        <CustomerModal
          customers={customers} search={customerSearch}
          onSearchChange={setCustomerSearch}
          onSelect={(c: Customer) => { setSelectedCustomer(c); setShowCustomerModal(false); }}
          onClose={() => setShowCustomerModal(false)}
          onCreateNew={() => {}}
        />
      )}
      {showHeldOrdersModal && (
        <HeldOrdersModal
          heldOrders={heldOrders}
          onRestore={handleRestoreHeldOrder}
          onClose={() => setShowHeldOrdersModal(false)}
          onDelete={(id: string) => saveHeldOrders(heldOrders.filter((o: HeldOrder) => o.id !== id))}
        />
      )}
      {showOptionsModal && (
        <OptionsModal
          cart={cart}
          amount={finalAmount}
          onApplyDiscount={(productId: string, type: 'PERCENT' | 'FIXED', val: number) => applyItemDiscount(productId, type, val)}
          onApplyGeneralDiscount={(type: 'PERCENT' | 'FIXED' | null, val: number) => { setDiscountType(type); setDiscountValue(val); }}
          onClose={() => setShowOptionsModal(false)}
          onChangeUpdate={(given, change) => setChangeInfo({ given, change })}
          selectedCustomer={selectedCustomer}
          onSaveCreditSale={handleSaveCreditSale}
        />
      )}
      {showDiscountModal && (
        <DiscountModal
          cart={cart}
          onApply={(id: string, type: 'PERCENT' | 'FIXED', val: number) => { applyItemDiscount(id, type, val); setShowDiscountModal(false); }}
          onApplyGeneral={(type: 'PERCENT' | 'FIXED' | null, val: number) => { setDiscountType(type); setDiscountValue(val); setShowDiscountModal(false); }}
          onClose={() => setShowDiscountModal(false)}
        />
      )}
      {showTransferModal && <TransferModal amount={finalAmount} customer={selectedCustomer} onClose={() => setShowTransferModal(false)} />}
      {showChangeModal && <ChangeModal amount={finalAmount} onClose={() => setShowChangeModal(false)} />}
      {showSuccessModal && completedOrder && <SuccessModal 
        order={completedOrder} 
        onClose={() => {
          setShowSuccessModal(false);
          setCompletedOrder(null);
          setSearchQuery('');
          clearCart();
          setSelectedCustomer(null);
          setDiscountType(null);
          setDiscountValue(0);
        }}
        onComplete={() => {
          setShowSuccessModal(false);
          clearCart();
          setSelectedCustomer(null);
          setDiscountType(null);
          setDiscountValue(0);
          setCompletedOrder(null);
          setSearchQuery('');
        }}
      />}
      {showPaymentModal && (
        <PaymentModal
          cart={cart}
          subtotalBeforeDiscount={subtotalBeforeDiscount}
          discountAmount={discountAmount}
          amount={finalAmount}
          onClose={() => setShowPaymentModal(false)}
          onComplete={handleCompleteSale}
          selectedCustomer={selectedCustomer}
        />
      )}
      {showSecondScreenModal && (
        <div style={{display:'none'}} />
      )}
      {showCreditModal && (
        <CreditSaleModal
          finalAmount={finalAmount}
          debtAmount={creditDebtAmount}
          customerName={creditCustomerName}
          customerPhone={creditCustomerPhone}
          dueDate={creditDueDate}
          downPaymentMethod={creditDownPaymentMethod}
          onCustomerNameChange={setCreditCustomerName}
          onCustomerPhoneChange={setCreditCustomerPhone}
          onDueDateChange={setCreditDueDate}
          onDebtAmountChange={setCreditDebtAmount}
          onDownPaymentMethodChange={setCreditDownPaymentMethod}
          onSave={handleSaveCreditSale}
          onClose={() => setShowCreditModal(false)}
        />
      )}

      {/* Beden/Varyant Seçim Modal'ı */}
      {showSizeModal && selectedParentProduct && productVariants.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">{selectedParentProduct.name}</h3>
              <button
                onClick={() => setShowSizeModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-4">Bedenini seç</p>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {productVariants.map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => {
                    addToCart(variant, 1);
                    setShowSizeModal(false);
                    setSelectedParentProduct(null);
                  }}
                  disabled={variant.stock_quantity === 0}
                  className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                    variant.stock_quantity === 0
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white border-slate-200 hover:border-indigo-500 hover:bg-indigo-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {variant.size ? `Beden: ${variant.size}` : 'Standart'}
                        {variant.color && ` - ${variant.color}`}
                      </p>
                      <p className="text-xs text-slate-500">
                        Stok: {variant.stock_quantity}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-slate-700">
                      ₺{variant.sell_price.toFixed(2)}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowSizeModal(false)}
              className="w-full mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* ── MODERN ORTALI UYARI MODAL KARTI ── */}
      {alertInfo.show && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-inner",
              alertInfo.type === 'error' ? "bg-red-50 text-red-500" :
              alertInfo.type === 'success' ? "bg-emerald-50 text-emerald-500" :
              "bg-amber-50 text-amber-500" // warning
            )}>
              {alertInfo.type === 'error' ? (
                <span className="text-xl font-black">!</span>
              ) : alertInfo.type === 'success' ? (
                <span className="text-xl font-black">✓</span>
              ) : (
                <span className="text-xl font-black">⚠</span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-800 leading-snug mb-2">
              {alertInfo.type === 'error' ? 'Hata' : alertInfo.type === 'success' ? 'Başarılı' : 'Sistem Uyarısı'}
            </h3>
            <p className="text-sm text-slate-650 font-medium leading-relaxed">
              {alertInfo.message}
            </p>
            <button
              onClick={() => setAlertInfo(prev => ({ ...prev, show: false }))}
              className="w-full mt-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.98]"
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
