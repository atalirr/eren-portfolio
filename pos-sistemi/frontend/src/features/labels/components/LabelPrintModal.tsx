/**
 * Label Print Modal Component
 * Ürün etiketi yazdırma modalı - Bir sayfada 12 adet (3x4 Izgara) olacak şekilde A4 baskı uyumlu
 */

import { useState, useRef } from 'react';
import { X, Printer, Loader2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { Product } from '../../inventory/services/inventoryApi';

interface LabelPrintModalProps {
  product: Product;
  onClose: () => void;
}

type LabelType = 'SHELF' | 'BARCODE';

export function LabelPrintModal({ product, onClose }: LabelPrintModalProps) {
  const [labelType, setLabelType] = useState<LabelType>('SHELF');
  const [quantity, setQuantity] = useState<number>(product.stock_quantity || 12);
  const [isPrinting, setIsPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const printFn = useReactToPrint({
    contentRef: printRef,
  });

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      printFn();
      setIsPrinting(false);
    }, 100);
  };

  // Sayfa bazlı gruplama hesabı (Her sayfada en fazla 12 etiket)
  const labelsCount = quantity;
  const pagesCount = Math.ceil(labelsCount / 12);
  const pages = [];
  for (let i = 0; i < pagesCount; i++) {
    const start = i * 12;
    const end = Math.min(start + 12, labelsCount);
    pages.push({ index: i, count: end - start });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <style>{`
        @media print {
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .print-container {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-page {
            width: 210mm !important;
            height: 297mm !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            margin: 0 !important;
            padding: 10mm !important;
            box-sizing: border-box !important;
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            grid-template-rows: repeat(4, 1fr) !important;
            gap: 5mm !important;
          }
          .print-page:last-child {
            page-break-after: avoid !important;
          }
          .print-label-cell {
            border: 1px solid #cbd5e1 !important;
            border-radius: 6px !important;
            padding: 4mm !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden !important;
            height: 64mm !important;
          }
          .print-empty-cell {
            border: 1px dashed #e2e8f0 !important;
            border-radius: 6px !important;
            height: 64mm !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {product.name} İçin Etiket Bas
            </h2>
            <p className="text-sm text-slate-500 mt-1">A4 şablonda her sayfaya 12 adet (3x4 Izgara) sığacak şekilde yazdırın</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            {/* Etiket Tipi Seçimi */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Etiket Şablonu
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLabelType('SHELF')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    labelType === 'SHELF'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold text-slate-900 mb-1">
                      Raf Etiketi (Detaylı)
                    </div>
                    <div className="text-xs text-slate-500">Ürün Adı, Fiyat, Barkod No, Stok Adedi</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setLabelType('BARCODE')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    labelType === 'BARCODE'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-lg font-semibold text-slate-900 mb-1">
                      Barkod Sticker (Sade)
                    </div>
                    <div className="text-xs text-slate-500">Ürün Adı, Fiyat ve Barkod Barkodu</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Adet */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  Basılacak Toplam Etiket Adeti
                </label>
                <span className="text-xs text-slate-400 font-bold">
                  ({pagesCount} Sayfa A4 kağıt kullanılacak)
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-bold"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(12)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  1 Sayfa (12 Adet)
                </button>
                <button
                  type="button"
                  onClick={() => setQuantity(24)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  2 Sayfa (24 Adet)
                </button>
              </div>
            </div>

            {/* Önizleme */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Baskı Önizleme (A4 Ölçekli)
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 flex justify-center overflow-y-auto max-h-[400px]">
                <div style={{ zoom: 0.5, transformOrigin: 'top center' }} className="bg-white p-2 shadow-inner">
                  {/* Yazdırılacak Alan */}
                  <div ref={printRef} className="print-container bg-white">
                    {pages.map((page, pageIdx) => (
                      <div 
                        key={pageIdx} 
                        className="print-page bg-white mb-8 border border-slate-300 p-[10mm] box-sizing-border-box"
                        style={{
                          width: '210mm',
                          height: '297mm',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gridTemplateRows: 'repeat(4, 1fr)',
                          gap: '5mm',
                        }}
                      >
                        {Array.from({ length: 12 }).map((_, labelIdx) => {
                          const itemNumber = pageIdx * 12 + labelIdx;
                          if (itemNumber >= labelsCount) {
                            return (
                              <div 
                                key={labelIdx} 
                                className="print-empty-cell border border-dashed border-slate-200 rounded"
                                style={{ height: '64mm' }}
                              />
                            );
                          }
                          return (
                            <div 
                              key={labelIdx} 
                              className="print-label-cell border border-slate-350 p-4 rounded flex flex-col justify-between overflow-hidden bg-white"
                              style={{ height: '64mm', boxSizing: 'border-box' }}
                            >
                              {labelType === 'SHELF' ? (
                                <ShelfLabelContent product={product} />
                              ) : (
                                <BarcodeLabelContent product={product} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3 flex-shrink-0 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition font-medium"
          >
            İptal
          </button>
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            {isPrinting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Yazdırılıyor...
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                YAZDIR ({quantity} Adet / {pagesCount} Sayfa)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Raf Etiketi İçeriği
function ShelfLabelContent({ product }: { product: Product }) {
  return (
    <div className="w-full h-full flex flex-col justify-between text-slate-800">
      <div className="text-center">
        <h3 className="text-[11px] font-black text-slate-900 line-clamp-2 leading-tight uppercase tracking-tight">{product.name}</h3>
        {product.brand && (
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{product.brand}</p>
        )}
      </div>
      <div className="flex items-end justify-between border-t border-slate-100 pt-2">
        <div className="text-left">
          <span className="text-[7px] text-slate-400 font-black block uppercase leading-none mb-1">Satış Fiyatı</span>
          <span className="text-base font-black text-blue-600 leading-none">₺{product.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
        </div>
        {product.barcode && (
          <div className="text-right flex flex-col items-end">
            <span className="text-[7px] text-slate-400 font-black block uppercase leading-none mb-1">Barkod</span>
            <span className="font-mono text-[9px] font-black text-slate-700 leading-none">{product.barcode}</span>
          </div>
        )}
      </div>
      <div className="text-center text-[7px] text-slate-400 font-black border-t border-slate-100 pt-1.5 uppercase tracking-wider">
        Mevcut Stok: {product.stock_quantity || 0} {product.unit || 'Adet'}
      </div>
    </div>
  );
}

// Barkod Sticker İçeriği
function BarcodeLabelContent({ product }: { product: Product }) {
  return (
    <div className="w-full h-full flex flex-col justify-between text-center text-slate-800">
      <div className="h-10 flex items-center justify-center">
        <h3 className="text-[10px] font-black text-slate-900 line-clamp-2 leading-tight uppercase tracking-tight">{product.name}</h3>
      </div>
      <div className="my-1">
        <span className="text-sm font-black text-blue-600">₺{product.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
      </div>
      {product.barcode && (
        <div className="border-t border-slate-100 pt-2 flex flex-col items-center">
          <span className="text-[7px] text-slate-400 font-black block uppercase leading-none mb-0.5">Barkod</span>
          <span className="font-mono text-[9px] font-black text-slate-700 leading-none">{product.barcode}</span>
        </div>
      )}
    </div>
  );
}
