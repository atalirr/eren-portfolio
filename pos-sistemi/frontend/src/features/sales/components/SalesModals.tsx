import { useState, useEffect } from 'react';
import { 
  X, User, Pause, Banknote, CreditCard, Building2, 
  FileText, CheckCircle2, 
  Maximize2, Minimize2, Printer, Search, Percent, Trash2,
  ArrowRightLeft, Copy
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';


// Standardized Modal Container
function ModalContainer({ 
  children, 
  onClose, 
  title, 
  subtitle, 
  icon: Icon,
  width = "w-[500px]"
}: { 
  children: React.ReactNode; 
  onClose: () => void; 
  title: string; 
  subtitle?: string; 
  icon?: any;
  width?: string;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className={cn("bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200", width)} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-8 h-8 bg-slate-50 text-slate-400 rounded-lg flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-slate-800 leading-tight tracking-tight uppercase">{title}</h3>
              {subtitle && <p className="text-[10px] font-medium text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── OPTIONS MODAL ───────────────────────────────────────────
export function OptionsModal({
  cart,
  amount,
  onApplyDiscount,
  onApplyGeneralDiscount,
  onClose,
  initialTab = 'CHANGE',
  onChangeUpdate,
  selectedCustomer,
  onSaveCreditSale,
}: {
  cart: any[];
  amount: number;
  onApplyDiscount: (productId: string, type: 'PERCENT' | 'FIXED', discountValue: number) => void;
  onApplyGeneralDiscount?: (type: 'PERCENT' | 'FIXED' | null, discountValue: number) => void;
  onClose: () => void;
  initialTab?: 'CHANGE' | 'TRANSFER' | 'DISCOUNT' | 'DEBT';
  onChangeUpdate?: (given: number, change: number) => void;
  selectedCustomer?: any;
  onSaveCreditSale?: (data: { customerName: string; customerPhone: string; dueDate: string; debtAmount: string; downPaymentMethod: 'CASH' | 'CARD' | 'TRANSFER' }) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<'CHANGE' | 'TRANSFER' | 'DISCOUNT' | 'DEBT'>(initialTab);
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const change = receivedAmount ? parseFloat(receivedAmount) - amount : 0;

  // Veresiye form state'leri
  const [creditCustomerName, setCreditCustomerName] = useState(() => selectedCustomer ? selectedCustomer.name : '');
  const [creditCustomerPhone, setCreditCustomerPhone] = useState(() => (selectedCustomer && selectedCustomer.phone) ? selectedCustomer.phone : '');
  const [creditDueDate, setCreditDueDate] = useState(() => (selectedCustomer && selectedCustomer.due_date) ? selectedCustomer.due_date : '');
  const [creditDebtAmount, setCreditDebtAmount] = useState(() => amount.toFixed(2));
  const [creditDownPaymentMethod, setCreditDownPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [isSavingCredit, setIsSavingCredit] = useState(false);

  const handleSaveCredit = async () => {
    if (!creditCustomerName.trim()) { alert('Müşteri adı zorunludur!'); return; }
    if (onSaveCreditSale) {
      try {
        setIsSavingCredit(true);
        await onSaveCreditSale({
          customerName: creditCustomerName,
          customerPhone: creditCustomerPhone,
          dueDate: creditDueDate,
          debtAmount: creditDebtAmount,
          downPaymentMethod: creditDownPaymentMethod
        });
        onClose();
      } catch (err: any) {
        alert(err.message);
      } finally {
        setIsSavingCredit(false);
      }
    }
  };

  useEffect(() => {
    if (!onChangeUpdate || !receivedAmount) return;
    const given = parseFloat(receivedAmount);
    if (!isNaN(given)) onChangeUpdate(given, given - amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receivedAmount, amount]);
  const [discountTarget, setDiscountTarget] = useState<'GENERAL' | 'PRODUCT'>('PRODUCT');
  const [selectedProductId, setSelectedProductId] = useState<string>(() => {
    return cart && cart.length > 0 ? cart[0].productId : '';
  });
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountValue, setDiscountValue] = useState<string>('');

  // Havale/EFT için şirket adı ve IBAN düzenleme state'leri (localStorage ve dosya sistemi ile kalıcı yapıldı)
  const [companyName, setCompanyName] = useState(() => localStorage.getItem('transfer-company-name') || 'ASYA TEKNOLOJİ LTD. ŞTİ.');
  const [iban, setIban] = useState(() => localStorage.getItem('transfer-iban') || 'TR00 1234 5678 9012 3456 7890 12');

  useEffect(() => {
    const loadSettings = async () => {
      const api = (window as any).electronAPI;
      if (api && api.readSettings) {
        try {
          const settings = await api.readSettings();
          if (settings) {
            if (settings.companyName) {
              setCompanyName(settings.companyName);
              localStorage.setItem('transfer-company-name', settings.companyName);
            }
            if (settings.iban) {
              setIban(settings.iban);
              localStorage.setItem('transfer-iban', settings.iban);
            }
          }
        } catch (error) {
          console.error('Error loading settings via IPC:', error);
        }
      }
    };
    loadSettings();
  }, []);

  const updateCompanyName = async (val: string) => {
    setCompanyName(val);
    localStorage.setItem('transfer-company-name', val);
    const api = (window as any).electronAPI;
    if (api && api.saveSettings) {
      const currentIban = localStorage.getItem('transfer-iban') || iban;
      await api.saveSettings({ companyName: val, iban: currentIban });
    }
  };
  const updateIban = async (val: string) => {
    setIban(val);
    localStorage.setItem('transfer-iban', val);
    const api = (window as any).electronAPI;
    if (api && api.saveSettings) {
      const currentCompany = localStorage.getItem('transfer-company-name') || companyName;
      await api.saveSettings({ companyName: currentCompany, iban: val });
    }
  };

  // İksonsuz mini bildirim state'i
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  useEffect(() => {
    if (showCopiedToast) {
      const timer = setTimeout(() => setShowCopiedToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showCopiedToast]);

  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const selected = cart.find(item => item.productId === selectedProductId);
    setSearchQuery(selected ? selected.productName : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId]);

  const handleApplyDiscount = () => {
    const val = discountValue.trim();
    if (!val) {
      alert("Lütfen bir indirim değeri girin!");
      return;
    }
    const value = parseFloat(val);
    if (isNaN(value) || value <= 0) {
      alert("Lütfen geçerli bir indirim değeri girin (0'dan büyük olmalıdır)!");
      return;
    }

    if (discountTarget === 'PRODUCT') {
      if (!selectedProductId) {
        alert("Lütfen indirim uygulanacak bir ürün seçin!");
        return;
      }
      onApplyDiscount(selectedProductId, discountType, value);
    } else {
      if (onApplyGeneralDiscount) {
        onApplyGeneralDiscount(discountType, value);
      }
    }

    // Formu sıfırla ve kapat
    setDiscountValue('');
    setSelectedProductId('');
    setSearchQuery('');
    onClose();
  };

  return (
    <ModalContainer onClose={onClose} title="SATIŞ SEÇENEKLERİ" subtitle="Hızlı Erişim Fonksiyonları" width="w-[460px]">
      <div className="flex p-1 bg-slate-100 rounded-lg gap-1 mb-5">
        {[
          { id: 'CHANGE', label: 'Para Üstü', icon: Banknote },
          { id: 'TRANSFER', label: 'Havale/EFT', icon: Building2 },
          { id: 'DEBT', label: 'Veresiye', icon: FileText },
          { id: 'DISCOUNT', label: 'İndirim', icon: Percent },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 py-1.5 px-3 rounded-md font-bold text-[11px] transition-all flex items-center justify-center gap-2",
              activeTab === tab.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:bg-white/50"
            )}
          >
            <tab.icon className="w-3 h-3" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'CHANGE' && (
        <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Tutar</span>
            <span className="text-lg font-bold text-slate-800 tabular-nums">₺{amount.toFixed(2)}</span>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">ALINAN NAKİT</label>
            <input
              type="number"
              value={receivedAmount}
              onChange={(e) => setReceivedAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:outline-none focus:border-indigo-400 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
            />
          </div>
          <div className={cn(
            "p-4 rounded-xl border transition-all flex items-center justify-between",
            change >= 0 ? "bg-emerald-50 border-emerald-100/50" : "bg-rose-50 border-rose-100/50"
          )}>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{change >= 0 ? "PARA ÜSTÜ" : "BORÇ KALAN"}</p>
              <p className={cn("text-2xl font-bold tabular-nums", change >= 0 ? "text-emerald-600" : "text-rose-600")}>₺{Math.abs(change).toFixed(2)}</p>
            </div>
            {change >= 0 ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <X className="w-6 h-6 text-rose-500" />}
          </div>
          <button onClick={onClose} className="w-full py-2 bg-slate-800 text-white rounded-lg text-xs font-bold mt-2">KAPAT</button>
        </div>
      )}

      {activeTab === 'TRANSFER' && (
        <div className="space-y-3">
           <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
             <p className="text-[10px] font-bold text-blue-600 uppercase mb-3 flex items-center gap-1.5 tracking-wider"><Building2 className="w-3 h-3" /> IBAN BİLGİLERİ</p>
             <div className="space-y-2">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <p className="text-[9px] text-slate-400 font-bold mb-1">IBAN (DÜZENLENEBİLİR)</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={iban}
                      onChange={(e) => updateIban(e.target.value)}
                      className="flex-1 text-xs font-bold text-slate-700 font-mono tracking-tighter bg-transparent border-0 focus:ring-0 p-0 outline-none self-center"
                      placeholder="TR00 0000 0000 0000 0000 0000 00"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(iban);
                        setShowCopiedToast(true);
                      }}
                      className="p-1 rounded-lg text-slate-450 hover:text-indigo-650 hover:bg-indigo-50/80 transition-all shrink-0 self-center -mt-0.5"
                      title="IBAN'ı Kopyala"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <p className="text-[9px] text-slate-400 font-bold mb-1">ALICI / ŞİRKET ADI (DÜZENLENEBİLİR)</p>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => updateCompanyName(e.target.value)}
                    className="w-full text-xs font-bold text-slate-700 bg-transparent border-0 focus:ring-0 p-0 outline-none"
                    placeholder="Şirket adı girin..."
                  />
                </div>
             </div>
           </div>
           {showCopiedToast && (
             <div className="text-center text-[10px] font-bold text-emerald-600 bg-emerald-50 py-1.5 rounded-lg border border-emerald-100/50 animate-in fade-in duration-200">
               ✓ IBAN Panoya Kopyalandı
             </div>
           )}
        </div>
      )}

      {activeTab === 'DEBT' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">AD SOYAD</label>
              <input 
                type="text" 
                value={creditCustomerName} 
                onChange={(e) => setCreditCustomerName(e.target.value)} 
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-amber-400 focus:ring-0" 
                placeholder="Müşteri adı girin..." 
                autoFocus 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">TELEFON</label>
              <input 
                type="text" 
                value={creditCustomerPhone} 
                onChange={(e) => setCreditCustomerPhone(e.target.value)} 
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-amber-400 focus:ring-0" 
                placeholder="Telefon..." 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">ÖDEME TARİHİ (VADE)</label>
              <input 
                type="date" 
                value={creditDueDate} 
                onChange={(e) => setCreditDueDate(e.target.value)} 
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-amber-400 focus:ring-0" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">TOPLAM TUTAR</label>
              <div className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-650 font-mono">
                ₺{amount.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Alınan Peşinat — Sadece tutar gösterimi, ödeme yöntemi seçimi yok */}
          {amount - (parseFloat(creditDebtAmount) || 0) > 0 && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
              <div>
                <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Alınan Peşinat</p>
                <p className="text-lg font-black text-emerald-700 font-mono mt-0.5">
                  ₺{(amount - (parseFloat(creditDebtAmount) || 0)).toFixed(2)}
                </p>
              </div>
              <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
          )}

          <div className="bg-slate-800 rounded-xl p-3.5 flex justify-between items-center">
            <div className="flex-1">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Kayıt Edilecek Tutar (Borç)</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-2xl font-bold text-white">₺</span>
                <input 
                  type="number" 
                  step="0.01"
                  value={creditDebtAmount} 
                  onChange={(e) => setCreditDebtAmount(e.target.value)} 
                  className="bg-transparent border-0 p-0 text-2xl font-bold text-white outline-none focus:ring-0 w-36 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="w-9 h-9 bg-amber-500/20 text-amber-500 rounded-lg flex items-center justify-center"><FileText className="w-4 h-4" /></div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 bg-slate-50 text-slate-500 rounded-lg font-bold text-xs">Vazgeç</button>
            <button 
              onClick={handleSaveCredit} 
              disabled={isSavingCredit || !creditCustomerName.trim()} 
              className="flex-[2] py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs uppercase tracking-wider disabled:opacity-50"
            >
              {isSavingCredit ? 'KAYDEDİLİYOR...' : 'BORCU ONAYLA'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'DISCOUNT' && (
        <div className="space-y-4">
          {/* İndirim Hedefi Seçimi */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">İNDİRİM HEDEFİ</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDiscountTarget('PRODUCT')}
                className={cn(
                  "py-2 rounded-lg font-bold text-[10px] transition-all border",
                  discountTarget === 'PRODUCT'
                    ? "bg-slate-800 border-slate-850 text-white shadow-sm"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                )}
              >
                Seçili Ürüne Uygula
              </button>
              <button
                type="button"
                onClick={() => setDiscountTarget('GENERAL')}
                className={cn(
                  "py-2 rounded-lg font-bold text-[10px] transition-all border",
                  discountTarget === 'GENERAL'
                    ? "bg-slate-800 border-slate-850 text-white shadow-sm"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                )}
              >
                Tüm Sepete Uygula (Genel)
              </button>
            </div>
          </div>

          {/* Ürün Seçimi (Sadece Ürün Bazlı İndirim Seçilirse Gösterilir) */}
          {discountTarget === 'PRODUCT' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">ÜRÜN SEÇİN</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    if (val === '') {
                      setSelectedProductId('');
                    }
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder="Ürün adı yazın veya seçin..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer shadow-sm"
                />

                {showProductDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowProductDropdown(false)} 
                    />
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1.5 duration-100 divide-y divide-slate-50">
                      {cart.filter(item => item.productName.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
                        <button
                          key={item.productId}
                          type="button"
                          onClick={() => {
                            setSelectedProductId(item.productId);
                            setShowProductDropdown(false);
                          }}
                          className={cn(
                            "w-full px-3.5 py-2 text-left text-xs font-bold transition-colors flex items-center justify-between",
                            selectedProductId === item.productId
                              ? "bg-indigo-50 text-indigo-650"
                              : "text-slate-700 hover:bg-indigo-50/50 hover:text-indigo-600"
                          )}
                        >
                          <span className="truncate">{item.productName}</span>
                          <span className="text-[10px] text-slate-450 tabular-nums">₺{item.subtotal.toFixed(2)}</span>
                        </button>
                      ))}
                      {cart.filter(item => item.productName.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                        <div className="px-3.5 py-3 text-center text-xs font-bold text-slate-400">
                          Eşleşen ürün bulunamadı
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* İndirim Tipi Seçimi */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">İNDİRİM TİPİ</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button"
                onClick={() => setDiscountType('PERCENT')} 
                className={cn("py-2 rounded-lg font-bold text-[10px] transition-all border", discountType === 'PERCENT' ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200")}
              >
                % Yüzde
              </button>
              <button 
                type="button"
                onClick={() => setDiscountType('FIXED')} 
                className={cn("py-2 rounded-lg font-bold text-[10px] transition-all border", discountType === 'FIXED' ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200")}
              >
                ₺ Tutar
              </button>
            </div>
          </div>

          {/* İndirim Değeri Girişi */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">İNDİRİM DEĞERİ</label>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'PERCENT' ? 'İndirim yüzdesi girin...' : 'İndirim tutarı girin...'}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-850 focus:outline-none focus:border-indigo-400"
            />
          </div>

          <button 
            type="button"
            onClick={handleApplyDiscount} 
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-[11px] uppercase tracking-wider transition-colors"
          >
            İndirimi Uygula
          </button>
        </div>
      )}
    </ModalContainer>
  );
}

// ─── WRAPPERS FOR COMPATIBILITY ──────────────────────────────
export function ChangeModal({ amount, onClose }: any) {
  return <OptionsModal cart={[]} amount={amount} onApplyDiscount={() => {}} onClose={onClose} initialTab="CHANGE" />;
}
export function TransferModal({ amount, onClose }: any) {
  return <OptionsModal cart={[]} amount={amount} onApplyDiscount={() => {}} onClose={onClose} initialTab="TRANSFER" />;
}
export function DiscountModal({ cart, onApply, onApplyGeneral, onClose }: any) {
  return <OptionsModal cart={cart} amount={0} onApplyDiscount={onApply} onApplyGeneralDiscount={onApplyGeneral} onClose={onClose} initialTab="DISCOUNT" />;
}

// ─── CUSTOMER MODAL ──────────────────────────────────────────
export function CustomerModal({ customers, search, onSearchChange, onSelect, onClose, onCreateNew }: any) {
  const filtered = customers.filter((c: any) => c.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <ModalContainer onClose={onClose} title="MÜŞTERİ SEÇİMİ" subtitle="Kayıtlı Cari Listesi" icon={User} width="w-[400px]">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="text"
          placeholder="Ara..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-400 focus:bg-white"
        />
      </div>
      <div className="max-h-52 overflow-y-auto pr-1 space-y-1.5 mb-3">
        {filtered.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-[11px]">Müşteri bulunamadı</div>
        ) : (
          filtered.map((c: any) => (
            <button key={c.id} onClick={() => onSelect(c)} className="w-full px-3 py-2 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg text-left transition-all">
              <p className="text-xs font-bold text-slate-800">{c.name}</p>
              <p className="text-[9px] text-slate-400 font-medium">{c.phone || 'Telefon kaydı yok'}</p>
            </button>
          ))
        )}
      </div>
      <button onClick={onCreateNew} className="w-full py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg font-bold text-[10px] hover:bg-indigo-600 hover:text-white transition-all uppercase tracking-wide">+ Yeni Kayıt Ekle</button>
    </ModalContainer>
  );
}

// ─── HELD ORDERS MODAL ───────────────────────────────────────
export function HeldOrdersModal({ heldOrders, onRestore, onDelete, onClose }: any) {
  return (
    <ModalContainer onClose={onClose} title="BEKLEYENLER" subtitle="Askıya Alınanlar" icon={Pause} width="w-[450px]">
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {heldOrders.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs font-medium">Bekleyen satış kaydı bulunmuyor.</div>
        ) : (
          heldOrders.map((o: any) => (
            <div key={o.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between group">
              <div>
                <p className="text-xs font-bold text-slate-800 tracking-tight">#{o.id.slice(-6)} — ₺{o.finalAmount.toFixed(2)}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{o.cart.length} Ürün · {new Date(o.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => onRestore(o)} className="px-2.5 py-1.5 bg-slate-800 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-slate-700 transition-colors">Yükle</button>
                <button onClick={() => onDelete(o.id)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </ModalContainer>
  );
}

// ─── PAYMENT MODAL ──────────────────────────────────────────
export function PaymentModal({
  cart = [],
  subtotalBeforeDiscount = 0,
  discountAmount = 0,
  amount,
  onClose,
  onComplete,
  selectedCustomer,
}: {
  cart: any[];
  subtotalBeforeDiscount: number;
  discountAmount: number;
  amount: number;
  onClose: () => void;
  onComplete: (method: 'CASH' | 'CARD' | 'TRANSFER') => Promise<void>;
  selectedCustomer: any;
}) {
  const [showIcon, setShowIcon] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => { setTimeout(() => setShowIcon(true), 100); }, []);

  const totalQty = cart.reduce((s, i) => s + i.quantity, 0);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onComplete('CASH');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Koyu başlık — SuccessModal ile aynı stil */}
        <div className="pl-6 pr-3.5 py-6 bg-slate-900 flex items-center justify-between border-b border-slate-800 text-white">
          <div className="flex items-center gap-4">
            {/* Animasyonlu onay ikonu */}
            <div className={cn(
              "w-12 h-12 rounded-full border-2 border-indigo-400 flex items-center justify-center transition-all duration-700 text-indigo-400",
              showIcon ? "scale-100 rotate-0" : "scale-0 rotate-45"
            )}>
              <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6" strokeLinecap="round" strokeLinejoin="round">
                <path
                  d="M6 14l5 5 11-10"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeDasharray="30"
                  strokeDashoffset={showIcon ? 0 : 30}
                  className="transition-all duration-500 delay-200 ease-out"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-black text-slate-100 uppercase tracking-wide">Satış Önizleme</h2>
              <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">
                {totalQty} Kalem · Onaylayarak Satışı Tamamlayın
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 self-start -mt-1.5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Müşteri bilgisi */}
          {selectedCustomer && (
            <div className="flex justify-between items-center bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2.5 text-[10px]">
              <span className="font-black text-slate-500 uppercase tracking-wider">Müşteri</span>
              <span className="font-black text-slate-800 flex items-center gap-1.5">
                <User className="w-3 h-3" />
                {selectedCustomer.name}
              </span>
            </div>
          )}

          {/* Ürün listesi */}
          <div className="space-y-1 bg-slate-50/50 border border-slate-100 rounded-2xl p-3 max-h-44 overflow-y-auto modern-scrollbar">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 border-b border-slate-100 pb-1">
              Satış Kalemleri ({totalQty} Adet)
            </p>
            {cart.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-1.5 border-b border-slate-100/50 last:border-b-0">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-xs font-black text-slate-800 truncate">{item.productName}</p>
                  <p className="text-[9px] text-slate-500 font-bold">{item.quantity} adet × ₺{item.unitPrice.toFixed(2)}</p>
                </div>
                <span className="text-xs font-black text-slate-800 font-mono tabular-nums">₺{item.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Tutar özeti */}
          <div className="space-y-1.5 pt-1">
            {discountAmount > 0 && (
              <div className="flex justify-between text-[10px]">
                <span className="font-bold text-slate-500 uppercase tracking-wider">Ara Toplam</span>
                <span className="font-bold text-slate-700 font-mono">₺{subtotalBeforeDiscount.toFixed(2)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-[10px]">
                <span className="font-bold text-rose-500 uppercase tracking-wider">İndirim</span>
                <span className="font-bold text-rose-500 font-mono">−₺{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2.5 border-t border-b border-slate-200 mt-1">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">TOPLAM TUTAR</span>
              <span className="text-2xl font-black text-slate-900 font-mono tabular-nums">₺{amount.toFixed(2)}</span>
            </div>
          </div>

          {/* Aksiyonlar */}
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="flex-[2] py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  İşleniyor...
                </>
              ) : 'SATIŞI TAMAMLA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SuccessModal({ order, onClose, onComplete }: any) {
  const [showCheck, setShowCheck] = useState(false);
  useEffect(() => { setTimeout(() => setShowCheck(true), 150); }, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const subtotal = order.subtotalBeforeDiscount || 0;
  const discountAmount = order.discountAmount || 0;
  const finalAmount = (order.final_amount !== undefined && order.final_amount !== null && order.final_amount !== 0) ? order.final_amount : (subtotal - discountAmount);
  const paymentMethodLabel: Record<string, string> = {
    CASH: 'Nakit', CARD: 'Kredi Kartı / POS', TRANSFER: 'Havale / EFT', DEBT: 'Veresiye', SPLIT: 'Parçalı Ödeme'
  };
  const paymentLabel = paymentMethodLabel[order.paymentMethod] || order.paymentMethod || '—';
  const itemCount = order.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;

  // Set color and badge style depending on payment method
  let paymentBadgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
  if (order.paymentMethod === 'CASH') {
    paymentBadgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (order.paymentMethod === 'CARD') {
    paymentBadgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (order.paymentMethod === 'TRANSFER') {
    paymentBadgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (order.paymentMethod === 'DEBT') {
    paymentBadgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (order.paymentMethod === 'SPLIT') {
    paymentBadgeStyle = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=400,height=700,toolbar=no,menubar=no');
    if (!printWin) return;
    const receiptHtml = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Satış Fişi #${order.order_number || '---'}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; width: 300px; margin: 0 auto; padding: 10px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .sep { border-top: 1px dashed #000; margin: 8px 0; }
  .row { display: flex; justify-content: space-between; margin: 3px 0; }
  .header { margin-bottom: 10px; }
  .header h1 { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
  .total-row { font-size: 15px; font-weight: bold; margin: 4px 0; }
  .footer { margin-top: 12px; font-size: 11px; }
  @media print { body { width: 100%; } }
</style>
</head><body>
<div class="header center">
  <h1>MAĞAZA ADI</h1>
  <div>Adres Bilgisi Buraya</div>
  <div>Tel: 0XXX XXX XX XX</div>
</div>
<div class="sep"></div>
<div class="row"><span>Fiş No:</span><span class="bold">#${order.order_number || '---'}</span></div>
<div class="row"><span>Tarih:</span><span>${dateStr}</span></div>
<div class="row"><span>Saat:</span><span>${timeStr}</span></div>
${order.customer ? `<div class="row"><span>Müşteri:</span><span>${order.customer.name}</span></div>` : ''}
<div class="row"><span>Ödeme:</span><span>${paymentLabel}</span></div>
<div class="sep"></div>
<div class="bold center" style="margin:4px 0">ÜRÜNLER</div>
<div class="sep"></div>
${(order.items || []).map((item: any) => `
<div style="margin-bottom:6px">
  <div class="bold">${item.productName || item.product_name || 'Ürün'}</div>
  <div class="row">
    <span>${item.quantity} x ₺${(item.unitPrice || 0).toFixed(2)}</span>
    <span class="bold">₺${((item.unitPrice || 0) * item.quantity).toFixed(2)}</span>
  </div>
  ${(item.discount || 0) > 0 ? `<div class="row" style="color:#666"><span>  İndirim:</span><span>-₺${(item.discount || 0).toFixed(2)}</span></div>` : ''}
</div>`).join('')}
<div class="sep"></div>
<div class="row"><span>Ara Toplam:</span><span>₺${subtotal.toFixed(2)}</span></div>
${discountAmount > 0 ? `<div class="row"><span>İndirim:</span><span>-₺${discountAmount.toFixed(2)}</span></div>` : ''}
<div class="sep"></div>
<div class="row total-row"><span>TOPLAM:</span><span>₺${finalAmount.toFixed(2)}</span></div>
<div class="sep"></div>
<div class="footer center">
  <div>Teşekkür Ederiz!</div>
  <div>Yine Bekleriz.</div>
  <div style="margin-top:8px;font-size:10px;">Bu fiş yasal belge değildir.</div>
</div>
</body></html>`;
    printWin.document.write(receiptHtml);
    printWin.document.close();
    setTimeout(() => { printWin.print(); printWin.close(); }, 300);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header (Premium dark background with green checkmark circle and close button) */}
        <div className="pl-6 pr-3.5 py-6 bg-slate-900 flex items-center justify-between border-b border-slate-800 text-white">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-full border-2 border-emerald-500 flex items-center justify-center transition-all duration-700 text-emerald-500 scale-0",
              showCheck ? "scale-100 rotate-0" : "scale-0 rotate-45"
            )}>
              <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6 animate-in zoom-in spin-in-12 duration-500" strokeLinecap="round" strokeLinejoin="round">
                <path
                  d="M8 14.5l4.5 4.5 7.5-9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray="30"
                  strokeDashoffset={showCheck ? 0 : 30}
                  className="transition-all duration-500 delay-300 ease-out"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-black text-slate-100 uppercase tracking-wide">Satış Tamamlandı</h2>
              <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest mt-0.5">Sipariş Kaydedildi ve Fiş Hazırlandı</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 self-start -mt-1.5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          
          {/* Fiş Bilgisi */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-2.5 shadow-sm">
            <div className="flex justify-between items-center text-[10px] font-black text-black uppercase tracking-wider">
              <span>Fiş Numarası</span>
              <span className="text-black font-mono font-black bg-white px-2 py-0.5 border border-slate-200 rounded-lg">#{order.order_number || '---'}</span>
            </div>
            
            <div className="flex justify-between items-center text-[10px] text-black font-black uppercase tracking-wider">
              <span>Ödeme Yöntemi</span>
              <span className={cn("px-2.5 py-0.5 border rounded-lg font-black text-[9px] uppercase tracking-wider", paymentBadgeStyle)}>
                {paymentLabel}
              </span>
            </div>

            <div className="flex justify-between items-center text-[10px] text-black font-black uppercase tracking-wider">
              <span>İşlem Tarihi</span>
              <span className="text-black font-black">{dateStr} · {timeStr}</span>
            </div>
            
            {order.customer && (
              <div className="flex justify-between items-center text-[10px] text-black font-black uppercase tracking-wider pt-2.5 border-t border-slate-200/50">
                <span>Müşteri</span>
                <span className="text-black font-black flex items-center gap-1">
                  <User className="w-3 h-3 text-black" />
                  {order.customer.name}
                </span>
              </div>
            )}
          </div>

          {/* Ürün Listesi */}
          <div className="space-y-1 bg-slate-50/50 border border-slate-100 rounded-2xl p-3 max-h-36 overflow-y-auto modern-scrollbar">
            <p className="text-[8px] font-black text-black uppercase tracking-widest mb-1.5 border-b border-slate-100 pb-1">Satılan Ürünler ({itemCount} Kalem)</p>
            {(order.items || []).map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100/50 last:border-b-0">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-xs font-black text-black truncate">{item.productName || item.product_name}</p>
                  <p className="text-[9px] text-black font-bold">{item.quantity} adet × ₺{(item.unitPrice || 0).toFixed(2)}</p>
                </div>
                <span className="text-xs font-black text-black font-mono tabular-nums">₺{((item.unitPrice || 0) * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Tutar Özeti */}
          <div className="border-t border-slate-200/60 pt-4">
            <div className="flex justify-between items-center py-2.5 border-t border-b border-slate-200 mt-1">
              <span className="text-xs font-black text-black uppercase tracking-wider">TOPLAM TUTAR</span>
              <span className="text-2xl font-black text-black font-mono tabular-nums">₺{finalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Aksiyonlar */}
        <div className="px-6 pb-6 grid grid-cols-2 gap-3 bg-white">
          <button
            onClick={handlePrint}
            className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 border border-slate-200"
          >
            <Printer className="w-3.5 h-3.5" />
            Fiş Yazdır
          </button>
          <button
            onClick={onComplete || onClose}
            className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-250/20 active:scale-95"
          >
            Yeni Satış
          </button>
        </div>

      </div>
    </div>
  );
}
// ─── CREDIT SALE MODAL ───────────────────────────────────────
export function CreditSaleModal({ 
  finalAmount, 
  debtAmount, 
  customerName, 
  customerPhone, 
  dueDate, 
  downPaymentMethod,
  onCustomerNameChange, 
  onCustomerPhoneChange, 
  onDueDateChange, 
  onDebtAmountChange, 
  onDownPaymentMethodChange,
  onSave, 
  onClose 
}: any) {
  const parsedDebt = parseFloat(debtAmount || '0');
  const pesinat = finalAmount - parsedDebt;

  return (
    <ModalContainer onClose={onClose} title="VERESİYE KAYDI" subtitle="Deftere İşleme Modülü" icon={FileText} width="w-[480px]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">AD SOYAD</label>
            <input type="text" value={customerName} onChange={(e) => onCustomerNameChange(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-amber-400" placeholder="..." autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">TELEFON</label>
            <input type="text" value={customerPhone} onChange={(e) => onCustomerPhoneChange(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-amber-400" placeholder="..." />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">ÖDEME TARİHİ (VADE)</label>
            <input type="date" value={dueDate} onChange={(e) => onDueDateChange(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-amber-400" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">BORÇ TUTARI</label>
            <input type="number" step="0.01" value={debtAmount} onChange={(e) => onDebtAmountChange(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-amber-400 font-mono" placeholder="0.00" />
          </div>
        </div>

        {pesinat > 0 && (
          <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
            <div className="flex justify-between items-center mb-1 px-1">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ALINAN PEŞİNAT: <span className="text-emerald-600 font-mono">₺{pesinat.toFixed(2)}</span></label>
               <span className="text-[8px] font-black text-slate-300 uppercase underline decoration-slate-200">ÖDEME ŞEKLİ</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button" 
                onClick={() => onDownPaymentMethodChange('CASH')}
                className={cn("h-11 rounded-xl border text-[9px] font-black transition-all flex items-center justify-center gap-2 uppercase tracking-widest", downPaymentMethod === 'CASH' ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-200" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200")}
              >
                <Banknote size={14} /> NAKİT
              </button>
              <button 
                type="button" 
                onClick={() => onDownPaymentMethodChange('CARD')}
                className={cn("h-11 rounded-xl border text-[9px] font-black transition-all flex items-center justify-center gap-2 uppercase tracking-widest", downPaymentMethod === 'CARD' ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-200" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200")}
              >
                <CreditCard size={14} /> KART / HAVALE
              </button>
            </div>
          </div>
        )}
        <div className="bg-slate-800 rounded-xl p-4 flex justify-between items-center">
          <div>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Kayıt Edilecek Tutar</p>
            <p className="text-2xl font-bold text-white tabular-nums">₺{parseFloat(debtAmount || '0').toFixed(2)}</p>
          </div>
          <div className="w-10 h-10 bg-amber-500/20 text-amber-500 rounded-lg flex items-center justify-center"><FileText className="w-5 h-5" /></div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-50 text-slate-500 rounded-lg font-bold text-xs">Vazgeç</button>
          <button onClick={onSave} disabled={!customerName.trim()} className="flex-[2] py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs uppercase tracking-wider">BORCU ONAYLA</button>
        </div>
      </div>
    </ModalContainer>
  );
}

// ─── SECOND SCREEN MODAL ─────────────────────────────────────
export function SecondScreenModal({ finalAmount, isFullscreen, onToggleFullscreen, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50">
      <div className={cn("bg-white shadow-2xl transition-all duration-300 flex flex-col", isFullscreen ? "w-full h-full" : "w-[75vw] h-[75vh] rounded-2xl overflow-hidden")}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-600 uppercase tracking-widest">Müşteri Ekranı</h2>
          <div className="flex gap-2">
            <button onClick={onToggleFullscreen} className="p-1.5 hover:bg-slate-50 rounded-lg border border-slate-200">{isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
            <button onClick={onClose} className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg border border-rose-200"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.5em] mb-8">ÖDENECEK TUTAR</p>
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/10 blur-[80px] rounded-full" />
              <h2 className="text-9xl font-black text-slate-900 leading-none tabular-nums tracking-tighter relative">
                <span className="text-4xl text-slate-300 font-bold align-top mr-2 mt-4 inline-block">₺</span>{finalAmount.toFixed(2)}
              </h2>
            </div>
            <div className="mt-12 py-3 px-8 bg-emerald-600 text-white rounded-full font-bold text-sm inline-flex items-center gap-2 shadow-xl shadow-emerald-200">
              <CheckCircle2 className="w-5 h-5" /> Teşekkür Ederiz!
            </div>
        </div>
      </div>
    </div>
  );
}
