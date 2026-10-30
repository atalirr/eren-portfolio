/**
 * Settings Page
 * Uygulama ayarlarını yöneten modernize panel.
 */

import { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Package,
  Store,
  Bell,
  CreditCard,
  ChevronRight,
  Info,
  Loader2,
  Check,
  BrainCircuit,
  Eye,
  EyeOff,
  Moon,
  X
} from 'lucide-react';
import { settingsApi, Setting } from '../services/settingsApi';
import { cn } from '@/shared/utils/cn';

export function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [activeGeminiKey, setActiveGeminiKey] = useState('');
  const [geminiKeyVisible, setGeminiKeyVisible] = useState(false);
  const [geminiSaving, setGeminiSaving] = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getSettings();
      setSettings(data);
      const dbKey = data.find(s => s.key === 'gemini_api_key');
      if (dbKey) {
        setGeminiKey(dbKey.value);
        setActiveGeminiKey(dbKey.value);
      }
    } catch (error) {
      console.error('Ayarlar yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeminiKey = async (keyToSave?: string) => {
    const keyVal = keyToSave !== undefined ? keyToSave : geminiKey;
    try {
      setGeminiSaving(true);
      await settingsApi.updateSetting('gemini_api_key', keyVal.trim());
      setActiveGeminiKey(keyVal.trim());
      if (keyToSave === undefined) {
        setGeminiSaved(true);
        setTimeout(() => setGeminiSaved(false), 2500);
      }
    } catch (error) {
      console.error('Gemini API key kaydedilemedi:', error);
      alert('API anahtarı kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setGeminiSaving(false);
    }
  };

  const handleRevokeGeminiKey = async () => {
    if (!window.confirm('API anahtarını kullanımdan çekmek istediğinize emin misiniz? Fatura tarama özelliği çalışmayacaktır.')) return;
    try {
      setGeminiSaving(true);
      await settingsApi.updateSetting('gemini_api_key', '');
      setGeminiKey('');
      setActiveGeminiKey('');
    } catch (error) {
      console.error('API key kullanımdan çekilemedi:', error);
      alert('İşlem başarısız oldu. Lütfen tekrar deneyin.');
    } finally {
      setGeminiSaving(false);
    }
  };

  const handleToggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    setIsDarkMode(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  const maskKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 10) return '••••••••';
    return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
  };

  const handleToggle = async (key: string, currentValue: string) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    
    try {
      setUpdating(key);
      await settingsApi.updateSetting(key, newValue);
      
      // Local state update
      setSettings(prev => {
        const index = prev.findIndex(s => s.key === key);
        if (index > -1) {
          const newSettings = [...prev];
          newSettings[index] = { ...newSettings[index], value: newValue };
          return newSettings;
        } else {
          return [...prev, { id: 'temp', key, value: newValue }];
        }
      });

      setSuccess(key);
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      console.error('Ayar güncellenemedi:', error);
      alert('Ayar kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setUpdating(null);
    }
  };

  const getSettingValue = (key: string, defaultValue: string = 'false') => {
    const s = settings.find(s => s.key === key);
    return s ? s.value : defaultValue;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium">Ayarlar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] font-sans antialiased text-slate-800">
      
      {/* Header */}
      <header className="sticky top-0 bg-white border-b border-slate-200 shrink-0 z-30 shadow-sm">
        <div className="max-w-[900px] mx-auto w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 rounded-md flex items-center justify-center shadow-sm">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 uppercase">SİSTEM AYARLARI</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 opacity-80">Genel Yapılandırma ve Politika Yönetimi</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[900px] mx-auto space-y-6">
          
          {/* Section: Görünüm Ayarları */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Moon className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Görünüm Ayarları</h2>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                <div className="flex gap-3 max-w-2xl">
                  <div className="w-9 h-9 rounded-md bg-slate-900 flex items-center justify-center shrink-0 border border-slate-800">
                    <Moon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-0.5">Koyu Tema (Dark Mode)</h3>
                    <p className="text-xs text-slate-500 font-medium leading-normal">
                      Tüm uygulamanın renk paletini gece modu/koyu temaya geçirir. Göz yorgunluğunu azaltır ve şık bir görünüm sunar.
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <button
                    onClick={handleToggleDarkMode}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-1",
                      isDarkMode ? "bg-indigo-600" : "bg-slate-200"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        isDarkMode ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Envanter Politikaları */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Envanter Politikaları</h2>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
              
              {/* Negative Stock Toggle */}
              <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                <div className="flex gap-3 max-w-2xl">
                  <div className="w-9 h-9 rounded-md bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-0.5">Negatif Stoğa İzin Ver</h3>
                    <p className="text-xs text-slate-500 font-medium leading-normal">
                      Kapalıyken stok sıfırın altına düşerse satış engellenir. Açık olduğunda sistem stok kontrolü yapmadan satışa devam eder.
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded w-fit uppercase tracking-wider">
                      <Info className="w-3 h-3" />
                      STOK TAKİBİNİ DOĞRUDAN ETKİLER
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {updating === 'allow_negative_stock' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                  {success === 'allow_negative_stock' && <Check className="w-4 h-4 text-emerald-500 animate-in zoom-in" />}
                  
                  <button
                    onClick={() => handleToggle('allow_negative_stock', getSettingValue('allow_negative_stock'))}
                    disabled={updating !== null}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-1",
                      getSettingValue('allow_negative_stock') === 'true' ? "bg-blue-600" : "bg-slate-200"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        getSettingValue('allow_negative_stock') === 'true' ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Other Placeholders */}
              <div className="p-4 flex items-center justify-between opacity-50 grayscale cursor-not-allowed">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                    <Bell className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-0.5">Kritik Stok Bildirimleri</h3>
                    <p className="text-xs text-slate-500 font-medium leading-normal">
                      Stok kritik seviyeye düştüğünde yöneticiye anlık bildirim gönder.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </div>
            </div>
          </section>

          {/* Section: Mağaza Yapılandırması */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Store className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mağaza Yapılandırması</h2>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
              <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors cursor-pointer group">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-md bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-0.5">Ödeme Yöntemleri</h3>
                    <p className="text-xs text-slate-500 font-medium leading-normal">
                      Kredi kartı, nakit, veresiye ve havale seçeneklerini özelleştirin.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </section>

          {/* Section: AI Entegrasyonu */}
          <section className="space-y-3">
            <div className="flex items-center gap-1.5 mb-1">
              <BrainCircuit className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Entegrasyonu</h2>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-md bg-violet-50 flex items-center justify-center shrink-0 border border-violet-100">
                    <BrainCircuit className="w-5 h-5 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 mb-0.5">Google Gemini API Anahtarı</h3>
                    <p className="text-xs text-slate-500 font-medium leading-normal mb-3">
                      Fatura tarama özelliği için Gemini Vision API kullanılır. Anahtarı{' '}
                      <span className="font-bold text-slate-700">aistudio.google.com</span>{' '}
                      adresinden ücretsiz alabilirsiniz.
                    </p>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={geminiKeyVisible ? 'text' : 'password'}
                          value={geminiKey === 'disabled' ? '' : geminiKey}
                          onChange={e => setGeminiKey(e.target.value)}
                          placeholder="Kişisel API Anahtarınızı girin (AIzaSy...)"
                          className="w-full px-3 py-1.5 pr-8 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-transparent font-mono bg-slate-50"
                        />
                        <button
                          type="button"
                          onClick={() => setGeminiKeyVisible(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {geminiKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <button
                        onClick={() => handleSaveGeminiKey()}
                        disabled={geminiSaving || !geminiKey.trim() || geminiKey === 'disabled'}
                        className={cn(
                          "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all shrink-0",
                          geminiSaved
                            ? "bg-emerald-500 text-white"
                            : "bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        {geminiSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {geminiSaved && <Check className="w-3.5 h-3.5" />}
                        {geminiSaved ? 'Kaydedildi' : 'Kaydet'}
                      </button>
                    </div>

                    {/* API Status Cards */}
                    {activeGeminiKey === 'disabled' ? (
                      <div className="mt-3 p-3 bg-rose-50/50 border border-rose-100 rounded-md flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-rose-100 flex items-center justify-center border border-rose-200 shrink-0">
                            <X className="w-3.5 h-3.5 text-rose-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 leading-none">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">API Anahtarı Durumu</p>
                              <span className="text-[8px] font-bold text-rose-700 bg-rose-50 border border-rose-100/50 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                                Engellendi
                              </span>
                            </div>
                            <p className="text-xs font-bold text-rose-700 mt-1 leading-none">
                              Gemini API Tamamen Devre Dışı
                            </p>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleSaveGeminiKey('')}
                          disabled={geminiSaving}
                          className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-emerald-900/50 rounded text-[9px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer disabled:opacity-50"
                        >
                          Varsayılana Dön (Etkinleştir)
                        </button>
                      </div>
                    ) : activeGeminiKey ? (
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 leading-none">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Aktif API Anahtarı (Kişisel)</p>
                              <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100/50 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                                Kullanımda
                              </span>
                            </div>
                            <p className="text-xs font-mono font-bold text-slate-800 mt-1 leading-none">
                              {maskKey(activeGeminiKey)}
                            </p>
                          </div>
                        </div>
                        
                        <button
                          onClick={handleRevokeGeminiKey}
                          disabled={geminiSaving}
                          className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-900/50 rounded text-[9px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer disabled:opacity-50"
                        >
                          Kullanımdan Çek
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                            <BrainCircuit className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 leading-none">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Aktif API Anahtarı (Sistem Varsayılanı)</p>
                              <span className="text-[8px] font-bold text-blue-700 bg-blue-50 border border-blue-100/50 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 animate-pulse">
                                Aktif
                              </span>
                            </div>
                            <p className="text-xs font-mono font-bold text-slate-800 mt-1 leading-none">
                              {'AIzaSy••••••••••••'}
                            </p>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleSaveGeminiKey('disabled')}
                          disabled={geminiSaving}
                          className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-900/50 rounded text-[9px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer disabled:opacity-50"
                        >
                          Devre Dışı Bırak (Kapat)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Tips / Info */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-indigo-900 flex gap-3">
            <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-1">Sistem Güvenliği</h2>
              <p className="text-xs text-indigo-750 font-medium leading-relaxed">
                Burada yaptığınız değişiklikler tüm şubeleri ve terminalleri anında etkiler. Özellikle envanter ve ödeme politikalarını değiştirirken dikkatli olmanız önerilir.
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
