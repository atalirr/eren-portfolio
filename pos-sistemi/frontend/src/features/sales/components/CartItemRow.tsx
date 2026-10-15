import { Package, Minus, Plus, X, Tag } from 'lucide-react';
import { Product } from '../types/sales.types';
import { cn } from '@/shared/utils/cn';

interface CartItemRowProps {
  item: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    buyPrice: number;
    discount: number;
    subtotal: number;
  };
  product?: Product;
  onUpdate: (quantity: number) => void;
  onRemove: () => void;
  onRemoveDiscount?: () => void;
}

export function CartItemRow({ item, product, onUpdate, onRemove, onRemoveDiscount }: CartItemRowProps) {
  const lineTotal = item.subtotal;

  return (
    <div
      className="bg-white border-b border-slate-100 p-3.5 transition-all relative group flex items-start gap-3.5 hover:bg-slate-50/50"
    >
      {/* ── ÜRÜN İKONU / GÖRSELİ (Üste Alındı ve Hizalandı) ── */}
      <div className="w-11 h-11 bg-slate-50 border border-slate-200/60 rounded flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:bg-indigo-50/60 group-hover:border-indigo-150 group-hover:text-indigo-650 transition-colors self-start mt-0.5">
        {product?.image_url ? (
          <img src={product.image_url} alt={item.productName} className="w-full h-full object-cover rounded" />
        ) : (
          <Package className="w-5 h-5 stroke-[1.8]" />
        )}
      </div>

      {/* ── ORTA SÜTUN: DETAYLAR (Fiyat sütunundan bağımsız, sıkışık ve düzenli) ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5 self-start">
        {/* Satır 1: Marka + Ürün Adı */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {product?.brand && (
            <span className="text-[9px] font-black text-slate-900 bg-slate-100 border border-slate-250 px-1.5 py-0.5 rounded uppercase tracking-wider">
              {product.brand}
            </span>
          )}
          <p className="text-sm font-serif font-black text-slate-900 truncate leading-tight tracking-wide">
            {item.productName}
          </p>
        </div>

        {/* Satır 2: Beden ve Stok Rozetleri */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {product?.size && (
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase">
              Beden: {product.size}
            </span>
          )}
          {product?.stock_quantity !== undefined && (
            <span className={cn(
              "text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider",
              product.stock_quantity > 10 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-500 border border-rose-100"
            )}>
              Stok: {product.stock_quantity}
            </span>
          )}
          {item.discount > 0 && (
            <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded uppercase">
                İndirim: -₺{item.discount.toFixed(2)}
              </span>
              {onRemoveDiscount && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveDiscount(); }}
                  className="p-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded border border-rose-100 transition-colors active:scale-90 flex items-center justify-center"
                  title="İndirimi Geri Al"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Satır 3: SKU Bilgisi */}
        {product?.sku && (
          <div className="text-[10px] text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3 stroke-[1.5]" />SKU: {product.sku}
            </span>
          </div>
        )}
      </div>

      {/* ── SAĞ SÜTUN: FİYAT VE MİKTAR SEÇİCİ (Detaylar sütununun yanında) ── */}
      <div className="flex flex-col items-end gap-1.5 shrink-0 self-start mr-1.5">
        {/* Tutar (Çarpı ile çakışmaması için mr-5 eklendi) */}
        <div className="text-right mr-5 flex flex-col items-end">
          {item.discount > 0 && (
            <span className="text-[10px] text-slate-400 line-through font-bold leading-none mb-0.5">
              ₺{(item.unitPrice * item.quantity).toFixed(2)}
            </span>
          )}
          <p className="text-sm font-black text-emerald-600 tabular-nums">
            ₺{lineTotal.toFixed(2)}
          </p>
        </div>

        {/* Miktar Arttır / Azalt (Fiyatın Hemen Altında) */}
        <div className="flex items-center gap-1 bg-slate-150 border border-slate-200/60 rounded p-0.5">
          <button
            onClick={() => onUpdate(item.quantity - 1)}
            disabled={item.quantity <= 1}
            className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-rose-600 disabled:opacity-40 hover:bg-rose-50 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <input
            type="number"
            className="w-7 text-center text-xs font-black text-slate-800 bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={item.quantity}
            onChange={(e) => onUpdate(parseInt(e.target.value) || 1)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => onUpdate(item.quantity + 1)}
            className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── SİLME (X) İKONU (Hover'da Sağ Üst Köşede) ── */}
      <button
        onClick={onRemove}
        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
        title="Sepetten Çıkar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}


