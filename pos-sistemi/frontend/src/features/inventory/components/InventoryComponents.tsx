import React, { useState } from 'react';
import { 
  Package, Edit, Trash2, CheckSquare, Plus, Minus, TrendingUp, Clock, Wallet, AlertCircle 
} from 'lucide-react';
import { Product, Category } from '../services/inventoryApi';
import { cn } from '@/shared/utils/cn';
import { getApiBaseUrl } from '@/shared/config/api.config';

// Stat Card Component
export function StatCard({ label, value, subValue, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-4 rounded-2xl transition-transform duration-500 group-hover:scale-110", bg, color)}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <h3 className="text-slate-500 text-sm font-semibold mb-1 uppercase tracking-wider">{label}</h3>
      <div className="flex flex-col">
        <span className="text-2xl font-black text-slate-900 tracking-tight">{value}</span>
        {subValue && <span className="text-xs text-slate-400 font-medium mt-1">{subValue}</span>}
      </div>
    </div>
  );
}

// Product Card Component (Grid View)
export function ProductCard({ 
  product, 
  isSelected, 
  onSelect, 
  onEdit, 
  onDelete, 
  onStockUpdate, 
  categories 
}: {
  product: Product;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStockUpdate: (id: string, delta: number) => void;
  categories: Category[];
}) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Heuristic cost calculation for UI preview
  const cost = product.cost || product.price * 0.7;
  const profitMargin = product.price > 0 ? Math.round(((product.price - cost) / product.price) * 100) : 0;
  const category = categories.find((c) => c.id === product.category_id);

  return (
    <div 
      className={cn(
        "group relative bg-white rounded-[2.5rem] border transition-all duration-500 overflow-hidden",
        isSelected 
          ? "border-indigo-500 ring-4 ring-indigo-500/10 shadow-2xl" 
          : "border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Select Overlay */}
      <button 
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        className={cn(
          "absolute top-5 right-5 z-20 w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
          isSelected 
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
            : "bg-white/90 backdrop-blur-sm text-slate-400 opacity-0 group-hover:opacity-100 border border-slate-200"
        )}
      >
        {isSelected ? <CheckSquare className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
      </button>

      {/* Image Area */}
      <div className="relative aspect-square overflow-hidden bg-slate-50">
        {product.image_url ? (
          <img 
            src={product.image_url.startsWith('http') ? product.image_url : `${getApiBaseUrl()}${product.image_url}`}
            className={cn("w-full h-full object-cover transition-transform duration-700", isHovered ? "scale-110" : "scale-100")}
            alt={product.name}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 space-y-3">
            <Package className="w-16 h-16 stroke-[1]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Resim Yok</span>
          </div>
        )}
        
        {/* Status Badges */}
        <div className="absolute bottom-5 left-5 right-5 flex flex-wrap gap-2">
          {product.stock_quantity <= product.critical_level && (
            <span className="px-3 py-1.5 bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-rose-200/50">KRİTİK STOK</span>
          )}
          {product.stock_quantity === 0 && (
            <span className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg shadow-slate-900/50">TÜKENDİ</span>
          )}
        </div>

        {/* Quick Actions */}
        <div className={cn(
          "absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center gap-4 transition-all duration-300",
          isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <button onClick={onEdit} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-900 hover:bg-indigo-600 hover:text-white transition-all transform hover:scale-110 shadow-xl">
            <Edit className="w-5 h-5" />
          </button>
          <button onClick={onDelete} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-rose-600 hover:bg-rose-600 hover:text-white transition-all transform hover:scale-110 shadow-xl">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              {category?.name || 'GENEL'}
            </span>
            {product.brand && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {product.brand}
              </span>
            )}
          </div>
          <h3 className="text-slate-900 text-lg font-bold line-clamp-1 group-hover:text-indigo-600 transition-colors">{product.name}</h3>
          <p className="text-[10px] font-mono text-slate-400 mt-1 tracking-tight">{product.barcode || '--- BARKODSUZ ---'}</p>
        </div>

        <div className="flex items-end justify-between mb-8">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FİYAT</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 leading-none">₺{product.price.toFixed(2)}</span>
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">%{profitMargin} KÂR</span>
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">STOK</p>
            <span className={cn(
              "text-lg font-black leading-none",
              product.stock_quantity <= product.critical_level ? 'text-rose-600' : 'text-slate-900'
            )}>
              {product.stock_quantity} <span className="text-xs font-bold text-slate-400 ml-1">{product.unit || 'Adet'}</span>
            </span>
          </div>
        </div>

        {/* Hızlı Stok Kontrolü */}
        <div className="flex items-center gap-3 p-1.5 bg-slate-50 rounded-[1.5rem]">
          <button 
            onClick={() => onStockUpdate(product.id, -1)}
            disabled={product.stock_quantity <= 0}
            className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-slate-600 hover:text-rose-600 hover:shadow-xl transition-all shadow-sm active:scale-90 disabled:opacity-50"
          >
            <Minus className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center font-black text-[10px] text-slate-400 uppercase tracking-widest">HIZLI STOK</div>
          <button 
            onClick={() => onStockUpdate(product.id, 1)}
            className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-slate-600 hover:text-emerald-600 hover:shadow-xl transition-all shadow-sm active:scale-90"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
