/**
 * Invoice Processing Page
 * E-fatura kuyruk ve log ekranı
 */

const processingQueue = [
  { id: 'INV-2025-0813', step: 'XML oluşturuluyor', progress: 45, channel: 'E-Arşiv' },
  { id: 'INV-2025-0812', step: 'GİB yanıtı bekleniyor', progress: 82, channel: 'E-Fatura' },
  { id: 'INV-2025-0811', step: 'Müşteriye e-posta', progress: 100, channel: 'E-Arşiv' },
];

const failureLogs = [
  { id: 'INV-2025-0788', reason: 'GİB servis hatası', action: 'Tekrar dene', time: '23.11.2025 18:42' },
  { id: 'INV-2025-0785', reason: 'Vergi numarası eşleşmiyor', action: 'Muhasebe kontrolü', time: '23.11.2025 15:10' },
];

export function InvoiceProcessingPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6 border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-900">Fatura İşleme Kuyruğu</h1>
        <p className="text-slate-500 mt-1">GİB gönderim süreci gerçek zamanlı izlenir.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Aktif Kuyruk</h2>
              <p className="text-sm text-slate-500">E-İmza dosyaları sırasıyla işleniyor</p>
            </div>
            <button className="text-sm text-blue-600 font-semibold">Yenile</button>
          </div>
          <div className="divide-y divide-slate-100">
            {processingQueue.map((item) => (
              <div key={item.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{item.id}</p>
                    <p className="text-slate-500">{item.step}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{item.channel}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: `${item.progress}%` }} />
                </div>
                <div className="text-right text-xs text-slate-400">{item.progress}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-xl font-semibold text-slate-900">Hata Kayıtları</h2>
            <p className="text-sm text-slate-500">Muhasebe aksiyon gerektiren kayıtlar</p>
          </div>
          <div className="divide-y divide-slate-100">
            {failureLogs.map((log) => (
              <div key={log.id} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{log.id}</p>
                  <span className="text-xs text-slate-400">{log.time}</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{log.reason}</p>
                <button className="mt-3 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  {log.action}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
