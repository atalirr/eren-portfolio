import React from 'react';
import { ShoppingBag, Clock } from 'lucide-react';
import { PageHeader } from '@/shared/components';

export function EcommercePage() {
  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans antialiased text-slate-800">
      <PageHeader title="E-TİCARET PAZARYERİ" icon={true} hideUser={true} />

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-white shadow-xl border border-slate-100 rounded-[2.5rem] flex items-center justify-center mb-8 animate-pulse transition-all duration-1000">
          <ShoppingBag size={40} className="text-slate-900" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4">
          E-TİCARET ENTEGRASYONU <span className="text-slate-400">ÇOK YAKINDA</span>
        </h2>
        <p className="max-w-md text-slate-500 text-sm font-medium leading-relaxed mb-8">
          Trendyol, Hepsiburada ve Amazon gibi pazaryeri entegrasyonları üzerinde çalışıyoruz. Tüm siparişlerinizi tek bir merkezden yönetmek çok yakında mümkün olacak.
        </p>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full border border-slate-200">
          <Clock size={14} className="text-slate-400" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Geliştirme Aşamasında</span>
        </div>
      </div>
    </div>
  );
}
