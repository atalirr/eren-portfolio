/**
 * Shift End Page Component
 * Gün Sonu / Vardiya Kapanışı (Z-Raporu)
 */

import { useState, useEffect } from 'react';
import { Save, Calculator, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface ShiftSummary {
  cashExpected: number;
  cashCounted: number | null;
  cardTotal: number | null;
  difference: number | null;
  transactions: number;
  totalRevenue: number;
}

export function ShiftEndPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [summary, setSummary] = useState<ShiftSummary>({
    cashExpected: 0,
    cashCounted: null,
    cardTotal: null,
    difference: null,
    transactions: 0,
    totalRevenue: 0,
  });
  const [cashInput, setCashInput] = useState('');
  const [cardInput, setCardInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Gün sonu verilerini yükle (mock)
  useEffect(() => {
    // Gerçek uygulamada API'den çekilecek
    const mockSummary: ShiftSummary = {
      cashExpected: 12500.75,
      cashCounted: null,
      cardTotal: null,
      difference: null,
      transactions: 127,
      totalRevenue: 32500.50,
    };
    setSummary(mockSummary);
  }, []);

  // Adım 1: Nakit sayımı
  const handleCashCount = () => {
    const counted = parseFloat(cashInput);
    if (isNaN(counted) || counted < 0) {
      alert('Lütfen geçerli bir tutar girin!');
      return;
    }

    setSummary({ ...summary, cashCounted: counted });
    setStep(2);
    setCashInput('');
  };

  // Adım 2: POS toplamı
  const handleCardTotal = () => {
    const total = parseFloat(cardInput);
    if (isNaN(total) || total < 0) {
      alert('Lütfen geçerli bir tutar girin!');
      return;
    }

    const cashCounted = summary.cashCounted || 0;
    const difference = cashCounted - summary.cashExpected;

    setSummary({
      ...summary,
      cardTotal: total,
      difference: difference,
    });
    setStep(3);
    setCardInput('');
  };

  // Adım 3: Vardiyayı kapat
  const handleCloseShift = async () => {
    if (!confirm('Vardiyayı kapatmak istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
      return;
    }

    setIsProcessing(true);
    
    try {
      // Gerçek uygulamada API'ye istek atılacak
      // await closeShiftAPI(summary);
      
      // Mock delay
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      alert('Vardiya başarıyla kapatıldı!');
      // navigate('/dashboard');
    } catch (error) {
      alert('Vardiya kapatılırken bir hata oluştu!');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const differenceAmount = summary.difference || 0;
  const hasDifference = Math.abs(differenceAmount) > 0.01;

  return (
    <div className="p-6 bg-gray-50 min-h-screen ml-64">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Save className="w-7 h-7 text-blue-600" />
            Gün Sonu / Vardiya Kapanışı
          </h1>
          <p className="text-sm text-gray-500 mt-1">Vardiyayı güvenli bir şekilde kapatın</p>
        </div>

        {/* Adım Göstergesi */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}
              >
                1
              </div>
              <span className="font-medium">Nakit Sayımı</span>
            </div>
            <div className="flex-1 h-0.5 mx-4 bg-gray-200">
              <div
                className={`h-full transition-all ${
                  step >= 2 ? 'bg-blue-600' : 'bg-gray-200'
                }`}
                style={{ width: step >= 2 ? '100%' : '0%' }}
              />
            </div>
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}
              >
                2
              </div>
              <span className="font-medium">POS Toplamı</span>
            </div>
            <div className="flex-1 h-0.5 mx-4 bg-gray-200">
              <div
                className={`h-full transition-all ${
                  step >= 3 ? 'bg-blue-600' : 'bg-gray-200'
                }`}
                style={{ width: step >= 3 ? '100%' : '0%' }}
              />
            </div>
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}
              >
                3
              </div>
              <span className="font-medium">Kapatma</span>
            </div>
          </div>
        </div>

        {/* Adım 1: Nakit Sayımı */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Nakit Sayımı</h2>
              <p className="text-sm text-gray-600">
                Lütfen kasada saydığınız fiziksel para miktarını girin. Sistem teorik tutarı göstermeyecektir.
              </p>
            </div>

            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Sistemde Beklenen Nakit:</span>
                <span className="text-lg font-bold text-blue-600">
                  {summary.cashExpected.toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  ₺
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sayılan Nakit Tutarı (₺)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 text-lg border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <button
                onClick={handleCashCount}
                disabled={!cashInput || parseFloat(cashInput) < 0}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                <Calculator className="w-5 h-5" />
                Devam Et
              </button>
            </div>
          </div>
        )}

        {/* Adım 2: POS Toplamı */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Kredi Kartı Toplamı</h2>
              <p className="text-sm text-gray-600">
                Lütfen kredi kartı sliplerinin toplam tutarını girin.
              </p>
            </div>

            <div className="mb-6 space-y-3">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Sayılan Nakit:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {summary.cashCounted?.toLocaleString('tr-TR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    ₺
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kredi Kartı Toplamı (₺)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={cardInput}
                  onChange={(e) => setCardInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 text-lg border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <button
                onClick={handleCardTotal}
                disabled={!cardInput || parseFloat(cardInput) < 0}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                <Calculator className="w-5 h-5" />
                Devam Et
              </button>
            </div>
          </div>
        )}

        {/* Adım 3: Kapanış Özeti ve Onay */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Özet Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <p className="text-sm text-gray-600 mb-2">Toplam İşlem</p>
                <p className="text-3xl font-bold text-gray-900">{summary.transactions}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <p className="text-sm text-gray-600 mb-2">Toplam Gelir</p>
                <p className="text-3xl font-bold text-green-600">
                  {summary.totalRevenue.toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  ₺
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <p className="text-sm text-gray-600 mb-2">Beklenen Nakit</p>
                <p className="text-3xl font-bold text-blue-600">
                  {summary.cashExpected.toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  ₺
                </p>
              </div>
            </div>

            {/* Detaylı Özet */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Kapanış Özeti</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Sayılan Nakit:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {summary.cashCounted?.toLocaleString('tr-TR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    ₺
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Kredi Kartı Toplamı:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {summary.cardTotal?.toLocaleString('tr-TR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    ₺
                  </span>
                </div>

                {hasDifference && (
                  <div
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      differenceAmount > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {differenceAmount > 0 ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      )}
                      <span className="text-sm font-medium text-gray-700">
                        {differenceAmount > 0 ? 'Kasa Fazlası' : 'Kasa Açığı'}:
                      </span>
                    </div>
                    <span
                      className={`text-lg font-bold ${
                        differenceAmount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {Math.abs(differenceAmount).toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      ₺
                    </span>
                  </div>
                )}

                {!hasDifference && (
                  <div className="flex items-center justify-center p-4 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <span className="text-sm font-medium text-green-700">
                      Kasa tutarı tam eşleşiyor!
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Kapatma Butonu */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Vardiyayı kapatmak için aşağıdaki butona tıklayın. Bu işlem geri alınamaz ve
                  sistemde bir kayıt oluşturulacaktır.
                </p>
              </div>
              <button
                onClick={handleCloseShift}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium text-lg"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    İşleniyor...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Vardiyayı Kapat
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}






















