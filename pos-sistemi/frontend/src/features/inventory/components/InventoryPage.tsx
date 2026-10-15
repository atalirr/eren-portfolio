/**

 * Inventory Page — Shopify-style product card grid

 * Ürün resimleri, filtreler, slide-over panel ve fatura tarama entegrasyonu

 * Refreshed: 2026-04-11

 */



import { useState, useMemo, useRef, useEffect } from 'react';

import {

  Search, Grid3x3, List as ListIcon, Plus, X, Copy, Check,

  Minus, MoreVertical, MoreHorizontal, Edit, Trash2, Package, Upload,

  Image as ImageIcon, Loader2, ScanLine, ChevronDown,

  Tag, FileSpreadsheet, FileDown, FileUp, Sparkles, PenLine,

  AlertCircle, TrendingDown, History, Layers, Printer, CheckSquare, Square,

  PlusCircle, Wallet, BarChart3, Clock, ArrowUpDown, Globe, ShoppingBag, TrendingUp, RotateCcw, Mic, ArrowRight, Zap

} from 'lucide-react';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';



import { inventoryApi, Product, Category, ProductCreate } from '../services/inventoryApi';

import { getApiBaseUrl } from '@/shared/config/api.config';

import { cn } from '@/shared/utils/cn';



import { QuickInvoiceAddModal } from './QuickInvoiceAddModal';

import { SmartCombobox } from './InventoryModals';

import { useAppStore } from '@/store/appStore';

import { salesApi } from '../../sales/services/salesApi';



// ─── Category color / icon palette ──────────────────────────────────────────

const CAT_PALETTE: Record<string, { bg: string; accent: string; text: string }> = {

  ayakkabı: { bg: '#FFF7ED', accent: '#EA580C', text: '#C2410C' },

  giyim:    { bg: '#EFF6FF', accent: '#2563EB', text: '#1D4ED8' },

  teknoloji:{ bg: '#F0FDF4', accent: '#16A34A', text: '#15803D' },

  default:  { bg: '#F8FAFC', accent: '#64748B', text: '#475569' },

};



function getCatKey(name = '') {

  const n = name.toLowerCase();

  if (n.includes('ayakkabı')) return 'ayakkabı';

  if (n.includes('giyim') || n.includes('kıyafet')) return 'giyim';

  if (n.includes('teknoloji') || n.includes('elektronik')) return 'teknoloji';

  return 'default';

}



// ─── Sub-Components ────────────────────────────────────────────────────────

function KPICard({ title, value, icon: Icon, color, trend }: any) {

  return (

    <div className="bg-slate-50/85 rounded-xl border border-slate-400 shadow-sm p-4 relative group transition-all hover:border-slate-500 hover:bg-slate-100/60">

      <div className="flex items-center justify-between mb-3">

        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{title}</p>

        <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0 opacity-80", color)}>

          <Icon className="w-3.5 h-3.5" />

        </div>

      </div>

      

      <div className="flex items-baseline gap-1">

        <span className="text-xl font-bold text-slate-900 tabular-nums leading-none tracking-tight">{value}</span>

      </div>



      {trend && (

        <div className="mt-3 pt-2.5 border-t border-slate-50">

          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight leading-none">{trend}</p>

        </div>

      )}

    </div>

  );

}



function ProductSkeleton() {

  return (

    <div className="bg-white rounded-xl border border-slate-100 p-3 space-y-2 animate-pulse">

      <div className="aspect-[4/3] bg-slate-50 rounded-lg" />

      <div className="h-4 bg-slate-50 rounded w-2/3" />

      <div className="h-3 bg-slate-50 rounded w-1/2" />

      <div className="flex justify-between items-center pt-1.5">

        <div className="h-4 bg-slate-50 rounded w-1/4" />

        <div className="h-6 bg-slate-50 rounded-md w-1/3" />

      </div>

    </div>

  );

}



// ─── Stock badge ─────────────────────────────────────────────────────────────

function StockBadge({ qty, critical }: { qty: number; critical: number }) {

  if (qty === 0)

    return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-600 uppercase">Tükendi</span>;

  if (qty <= critical)

    return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 uppercase">Kritik</span>;

  return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase">Stokta</span>;

}



// ─── Barcode generator helpers ───────────────────────────────────────────────

function generateCode39Pattern(code: string): string {

  const chars: Record<string, string> = {

    '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101',

    '4': '101001101011', '5': '110100110101', '6': '101100110101', '7': '101001011011',

    '8': '110100101101', '9': '101100101101', 'A': '110101001011', 'B': '101101001011',

    'C': '110110100101', 'D': '101011001011', 'E': '110101100101', 'F': '101101100101',

    'G': '101010011011', 'H': '110101001101', 'I': '101101001101', 'J': '101011001101',

    'K': '110101010011', 'L': '101101010011', 'M': '110110101001', 'N': '101011010011',

    'O': '110101101001', 'P': '101101101001', 'Q': '101010110011', 'R': '110101011001',

    'S': '101101011001', 'T': '101011011001', 'U': '110010101011', 'V': '100110101011',

    'W': '110011010101', 'X': '100101101011', 'Y': '110010110101', 'Z': '100110110101',

    '-': '100101011011', '.': '110010101101', ' ': '100110101101', '*': '100101101101',

    '$': '100100100101', '/': '100100101001', '+': '100101001001', '%': '101001001001'

  };

  const cleanCode = (code || '').trim().toUpperCase();

  const allowedChars = new Set(Object.keys(chars));

  let sanitized = '';

  for (let i = 0; i < cleanCode.length; i++) {

    const char = cleanCode[i];

    if (allowedChars.has(char)) {

      sanitized += char;

    }

  }

  if (!sanitized) {

    sanitized = '12345678';

  }

  const formattedCode = `*${sanitized}*`;

  let result = '';

  for (let i = 0; i < formattedCode.length; i++) {

    const char = formattedCode[i];

    const pattern = chars[char] || chars['*'];

    result += pattern + '0';

  }

  return result;

}



function BarcodeSVG({ value }: { value: string }) {

  const pattern = generateCode39Pattern(value);

  const barWidth = 2;

  const height = 45;

  const totalWidth = pattern.length * barWidth;



  return (

    <svg width="100%" height={height} viewBox={`0 0 ${totalWidth} ${height}`} preserveAspectRatio="none" className="w-full">

      {pattern.split('').map((bit, idx) => {

        if (bit === '1') {

          return (

            <rect

              key={idx}

              x={idx * barWidth}

              y={0}

              width={barWidth}

              height={height}

              fill="black"

            />

          );

        }

        return null;

      })}

    </svg>

  );

}



function getBarcodeSVGString(value: string): string {

  const pattern = generateCode39Pattern(value);

  const barWidth = 2;

  const height = 45;

  const totalWidth = pattern.length * barWidth;

  

  let rectsHtml = '';

  pattern.split('').forEach((bit, idx) => {

    if (bit === '1') {

      rectsHtml += `<rect x="${idx * barWidth}" y="0" width="${barWidth}" height="${height}" fill="black" />`;

    }

  });

  

  return `<svg viewBox="0 0 ${totalWidth} ${height}" preserveAspectRatio="none" style="width: 100%; height: 50px;">${rectsHtml}</svg>`;

}









function ImageMissingOverlay({ onClick }: { onClick: (e: React.MouseEvent) => void }) {

  return (

    <div

      onClick={onClick as any}

      className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-4 text-center"

    >

      <PlusCircle className="w-8 h-8 text-white mb-2 animate-pulse" />

      <p className="text-[10px] font-black text-white uppercase tracking-widest leading-tight">Görsel Eksik</p>

      <p className="text-[8px] text-white/70 font-bold mt-1">Eklemek için tıklayın</p>

    </div>

  );

}



// ─── Product Card Component ──────────────────────────────────────────────────

function ProductCard({ 

  product, 

  variants, 

  catName, 

  palette, 

  isSelected, 

  isBulkSelecting, 

  onToggleSelect, 

  actionMenu, 

  setActionMenu, 

  actionMenuRef,

  openEdit,

  openHistory,

  setForm,

  setShowPanel,

  setEditTarget,

  setIsEdit,

  setLabelTarget,

  setShowLabelModal,

  isDragging,

  isDragOver,

  onDragStart,

  onDragOver,

  onDrop,

  onDragEnd,

  load,

  handleDelete,

  searchString

}: any) {

  const [activeProduct, setActiveProduct] = useState(variants && variants.length > 0 ? variants[0] : product);
  const [isInlineEditingStock, setIsInlineEditingStock] = useState(false);
  const [inlineStock, setInlineStock] = useState(product.stock_quantity.toString());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await inventoryApi.updateProductImage(activeProduct.id, file);
      await load();
    } catch (err) {
      alert("Görsel yüklenemedi");
    }
  };



  // Sync activeProduct with search query or fresh data

  useEffect(() => {

    if (searchString) {

      const s = searchString.trim().toLowerCase();

      if (s) {

        const matchingVariant = variants.find((v: Product) => v.barcode && v.barcode.toLowerCase() === s);

        if (matchingVariant) {

          setActiveProduct(matchingVariant);

          return;

        }

      }

    }



    if (variants && variants.length > 0) {

      const freshVariant = variants.find((v: Product) => v.id === activeProduct.id);

      if (freshVariant) {

        setActiveProduct(freshVariant);

      } else {

        setActiveProduct(variants[0]);

      }

    } else {

      setActiveProduct(product);

    }

  }, [product, variants, searchString]);

  

  const pal = palette(activeProduct.category_id);

  // Support blob URLs (just uploaded) or server URLs

  const imgSrc = (() => {

    const url = activeProduct.image_url || product.image_url;

    if (!url) return null;

    if (url.startsWith('blob:') || url.startsWith('http')) return url;

    return `${getApiBaseUrl()}${url}`;

  })();



  const handleInlineStockUpdate = async (e: React.MouseEvent) => {

    e.stopPropagation();

    try {

      await inventoryApi.updateProduct(activeProduct.id, { stock_quantity: parseInt(inlineStock) || 0 } as any);

      setIsInlineEditingStock(false);

      await load();

    } catch(err) {

      alert("Stok güncellenemedi");

    }

  };



  return (

    <div 

      key={activeProduct.id} 

      draggable

      onDragStart={onDragStart}

      onDragOver={onDragOver}

      onDrop={onDrop}

      className={cn(

        "relative w-full h-[360px] cursor-grab active:cursor-grabbing group transition-all duration-300 bg-white rounded-xl border flex flex-col transition-shadow",

actionMenu === product.id ? "z-[50] overflow-visible" : "z-10 overflow-hidden",

        isDragging && "opacity-0 scale-95",

        isDragOver && "scale-[1.02] ring-4 ring-blue-500/50 z-50 rounded-xl",

        isSelected 

          ? "border-slate-900 ring-2 ring-slate-900/20 shadow-md" 

          : (activeProduct.marketplaceStatus === 'active'

              ? "border-emerald-400 ring-2 ring-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]" 

              : "border-slate-400 shadow-sm hover:border-slate-500")

      )}

      onDragEnd={onDragEnd}

      onClick={() => {

        if (isBulkSelecting) onToggleSelect(product.id);

      }}

    >

      {product.parent_id && (

        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400" />

      )}



      {isBulkSelecting && (

        <button 

          type="button"

          onClick={(e) => { e.stopPropagation(); onToggleSelect(product.id); }}

          className={cn(

            "absolute top-2 right-2 z-40 w-5 h-5 rounded-[5px] flex items-center justify-center transition-colors duration-100 ease-out",

            isSelected ? "bg-slate-900 text-white shadow-sm" : "bg-white/90 border-[1.5px] border-slate-300/80 hover:border-slate-400"

          )}

        >

          <Check className={cn("w-3 h-3 text-white stroke-[3] transition-[transform,opacity] duration-100 ease-out", isSelected ? "scale-100 opacity-100" : "scale-75 opacity-0")} />

        </button>

      )}



      <div className="relative border-b border-slate-200/80 rounded-t-xl overflow-hidden" style={{ background: pal.bg }}>

        <div className="absolute top-2 left-2 z-20 flex gap-1.5 flex-col items-start pointer-events-none">

          {!product.parent_id && variants.length > 0 && (

            <div className="bg-slate-900 border border-white/10 text-white px-2 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1 shadow-sm">

              <Layers className="w-2.5 h-2.5 opacity-70" /> {variants.length} SEÇENEK

            </div>

          )}

        </div>



        <div 
          onClick={handleImageClick}
          className="h-44 w-full flex items-center justify-center overflow-hidden relative cursor-pointer group"
        >
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {imgSrc
            ? (
              <>
                <img src={imgSrc} alt={activeProduct.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-4 text-center">
                  <PlusCircle className="w-8 h-8 text-white mb-2 animate-pulse" />
                  <p className="text-[10px] font-black text-white uppercase tracking-widest leading-tight">Görseli Değiştir</p>
                  <p className="text-[8px] text-white/70 font-bold mt-1">Yeni görsel seçmek için tıklayın</p>
                </div>
              </>
            )
            : (
              <div 
                className="w-full h-full flex items-center justify-center relative overflow-hidden"
                style={{ 
                  backgroundColor: ['#FEE2E2', '#FEF3C7', '#D1FAE5', '#DBEAFE', '#E0E7FF', '#F3E8FF', '#FAE8FF'][activeProduct.id.charCodeAt(0) % 7] 
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-50" />
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <Package className="w-12 h-12" style={{ color: pal.accent, opacity: 0.25 }} />
                  <span className="text-[14px] font-black tracking-widest opacity-20 uppercase select-none">{activeProduct.name.substring(0, 2)}</span>
                </div>
                <ImageMissingOverlay onClick={handleImageClick} />
              </div>
            )
          }
        </div>






        <div className="absolute bottom-1.5 left-1.5 z-10">

          {isInlineEditingStock && (

            <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5 shadow-xl animate-in zoom-in-95">

              <input 

                autoFocus

                type="number"

                value={inlineStock}

                onChange={e => setInlineStock(e.target.value)}

                onClick={e => e.stopPropagation()}

                className="w-12 px-1 text-[10px] font-black outline-none border-none text-center"

              />

              <button onClick={handleInlineStockUpdate} className="p-1 bg-emerald-500 text-white rounded-md hover:bg-emerald-600"><Check className="w-3 h-3" /></button>

              <button onClick={(e) => { e.stopPropagation(); setIsInlineEditingStock(false); }} className="p-1 bg-slate-100 text-slate-500 rounded-md"><X className="w-3 h-3" /></button>

            </div>

          )}

        </div>

      </div>

        {!isBulkSelecting && (

          <div className={cn(

            "absolute top-2 right-1.5 transition-all z-30 opacity-0 group-hover:opacity-100"

          )}>

            <button

              onClick={(e) => { e.stopPropagation(); setActionMenu(actionMenu === product.id ? null : product.id); }}

              className={cn(

                "w-8 h-8 rounded-full border transition-all duration-300 flex items-center justify-center shadow-md menu-toggle-btn active:scale-90 hover:scale-105",

                actionMenu === product.id ? "bg-slate-950 border-slate-950 text-white shadow-indigo-500/10" : "bg-white/80 backdrop-blur-md border-slate-200/60 text-slate-600 hover:text-slate-900 hover:bg-white hover:border-slate-300 hover:shadow-lg"

              )}

            >

              <MoreHorizontal className="w-4 h-4" />

            </button>

            {actionMenu === product.id && (

              <div ref={actionMenuRef} className="absolute right-0 top-10 w-48 bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.12),0_0_20px_rgba(99,102,241,0.03)] border border-slate-200/50 py-2.5 z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200 overflow-hidden">

                <div className="px-4 py-1.5 border-b border-slate-100/60 mb-1.5">

                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">İşlemler</p>

                </div>

                <button onClick={(e) => { e.stopPropagation(); openEdit(activeProduct); }} className="w-full px-4 py-2 text-left text-[11px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100/80 flex items-center gap-3 transition-all duration-150 group/item">

                  <Edit className="w-3.5 h-3.5 text-slate-400 group-hover/item:text-blue-500 group-hover/item:scale-110 transition-all duration-150" /> Düzenle

                </button>

                <button onClick={(e) => { e.stopPropagation(); openHistory(activeProduct); }} className="w-full px-4 py-2 text-left text-[11px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100/80 flex items-center gap-3 transition-all duration-150 group/item">

                  <History className="w-3.5 h-3.5 text-slate-400 group-hover/item:text-amber-500 group-hover/item:scale-110 transition-all duration-150" /> Hareket Geçmişi

                </button>

                <button onClick={(e) => { e.stopPropagation(); setLabelTarget([activeProduct]); setShowLabelModal(true); setActionMenu(null); }} className="w-full px-4 py-2 text-left text-[11px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100/80 flex items-center gap-3 transition-all duration-150 group/item">

                  <Printer className="w-3.5 h-3.5 text-slate-400 group-hover/item:text-indigo-500 group-hover/item:scale-110 transition-all duration-150" /> Etiket

                </button>

                <div className="h-px bg-slate-100/60 my-1.5 mx-2" />

                <button onClick={(e) => { e.stopPropagation(); handleDelete(activeProduct); }} className="w-full px-4 py-2 text-left text-[11px] font-semibold text-red-500 hover:text-red-600 hover:bg-red-50/50 flex items-center gap-3 transition-all duration-150 group/item">

                  <Trash2 className="w-3.5 h-3.5 text-red-400 group-hover/item:text-red-500 group-hover/item:scale-110 transition-all duration-150" /> Ürünü Sil

                </button>

              </div>

            )}

          </div>

        )}



      <div className="p-2.5 flex flex-col flex-1 gap-1.5 min-w-0">

        <div className="max-w-full">

          <div className="flex items-start justify-between gap-2">

            <div className="flex flex-col gap-2 min-w-0 mt-1">

              {(activeProduct.brand || product.brand) && (

                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight leading-none truncate">{activeProduct.brand || product.brand}</p>

              )}

              <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.1em] leading-none">

                {catName(activeProduct.category_id) || 'Genel Kategori'}

              </p>

            </div>

            

            <div className="shrink-0">

               <div onClick={(e) => { e.stopPropagation(); setIsInlineEditingStock(true); }} className="cursor-pointer">

                 <StockBadge qty={activeProduct.stock_quantity} critical={activeProduct.critical_level} />

               </div>

            </div>

          </div>

          

          <h3 className="text-[13px] font-bold text-slate-900 leading-[1.3] break-words">

            {activeProduct.name}

          </h3>

          <p className="text-[9.5px] font-mono text-slate-400 mt-1 tracking-tight leading-none">

            {activeProduct.barcode || '--- BARKODSUZ ---'}

          </p>

        </div>



        <div className="flex flex-col gap-2 flex-1">

          {(variants.length > 0 || product.size) && (

            <div className="flex items-center gap-1.5 flex-wrap max-h-[80px] overflow-y-auto scrollbar-hide py-0.5">

              {variants.map((v: Product) => (

                <button

                  key={v.id}

                  onClick={(e) => { e.stopPropagation(); setActiveProduct(v); }}

                  className={cn(

                    "px-2 py-1 rounded-md text-[9px] font-black border transition-all flex items-center gap-1.5",

                    activeProduct.id === v.id 

                      ? "bg-slate-900 border-slate-900 text-white scale-105" 

                      : "bg-white border-slate-100 text-slate-500 hover:border-slate-300",

                    v.stock_quantity === 0 && "relative overflow-hidden bg-slate-50 border-slate-200/60 text-slate-400 opacity-60 after:content-[''] after:absolute after:top-1/2 after:left-1 after:right-1 after:h-[1.5px] after:bg-slate-400/80 after:-rotate-12"

                  )}

                >

                  {v.size || ''} {v.color && (v.size ? `- ${v.color}` : v.color)}

                  {!v.size && !v.color && 'Varsayılan'}

                  {v.marketplaceStatus === 'active' && (

                    <div className="relative w-2 h-2">

                      <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse" />

                      <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 opacity-75" />

                    </div>

                  )}

                </button>

              ))}

            </div>

          )}



          <div className="mt-auto flex items-end justify-between border-t border-slate-200/60 pt-2">

            <div className="flex flex-col">

              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none mb-1">Fiyat</span>

              <div className="flex items-baseline gap-1">

                <p className="text-sm font-black text-slate-900">₺{activeProduct.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>

                <span className="text-[8px] font-bold text-slate-400 uppercase">KDV DAHİL</span>

              </div>

            </div>

            <div className="flex flex-col items-end">

              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none mb-1">Stok</span>

              <p className="text-[11px] font-black text-slate-700">{activeProduct.stock_quantity} {activeProduct.unit || 'Adet'}</p>

            </div>

          </div>

        </div>

      </div>

    </div>

  );

}



// ─── Product List Row Component ─────────────────────────────────────────────

function ProductListRow({ 

  product, 

  variants, 

  catName, 

  isSelected, 

  isBulkSelecting, 

  onToggleSelect, 

  openEdit, 

  handleDelete,

  isDragging,

  isDragOver,

  onDragStart,

  onDragOver,

  onDrop,

  onDragEnd,

  onCopy,

  searchString

}: any) {

  const matchingVariant = useMemo(() => {

    if (!searchString) return null;

    const s = searchString.trim().toLowerCase();

    return variants.find((v: any) => v.barcode && v.barcode.toLowerCase() === s);

  }, [searchString, variants]);



  const cost = matchingVariant ? (matchingVariant.cost || 0) : (product.cost || 0);

  const price = matchingVariant ? (matchingVariant.price || 0) : (product.price || 0);

  const rawTax = matchingVariant ? (matchingVariant.tax_rate ?? 18) : (product.tax_rate ?? 18);

  const taxRate = Math.round(rawTax);

  const barcodeVal = matchingVariant ? matchingVariant.barcode : product.barcode;

  const stockQuantity = matchingVariant ? matchingVariant.stock_quantity : product.stock_quantity;

  const unitVal = matchingVariant ? (matchingVariant.unit || 'AD') : (product.unit || 'AD');

  const displayName = matchingVariant ? `${product.name} [${matchingVariant.size}]` : product.name;



  const imgSrc = product.image_url

    ? (product.image_url.startsWith('http') ? product.image_url : `${getApiBaseUrl()}${product.image_url}`)

    : null;

  // Net Kar Hesabı: (Satiş Fiyatı / (1 + KDV/100)) - Maliyet

  const netPrice = price / (1 + taxRate / 100);

  const profit = netPrice - cost;

  const margin = cost > 0 ? Math.round((profit / cost) * 100) : 0;

  const [showVariants, setShowVariants] = useState(false);



  const handleCopyBarcode = (e: React.MouseEvent) => {

    e.stopPropagation();

    if (barcodeVal) {

      navigator.clipboard.writeText(barcodeVal);

      onCopy?.();

    }

  };



  return (

    <tr

      draggable

      onDragStart={onDragStart}

      onDragOver={onDragOver}

      onDrop={onDrop}

      onDragEnd={onDragEnd}

      className={cn(

        'group transition-colors cursor-grab active:cursor-grabbing relative hover:z-50',

        isSelected ? 'bg-blue-50/60' : 'bg-white hover:bg-slate-50/80',

        isDragging && 'opacity-30',

        isDragOver && 'border-t-2 border-t-blue-500'

      )}

    >

      {/* Checkbox / drag */}

      <td className="w-[40px] pl-6 pr-2 py-3 text-center">

        {isBulkSelecting ? (

          <button

            onClick={onToggleSelect}

            className={cn(

              'w-4.5 h-4.5 rounded border mx-auto flex items-center justify-center transition-all',

              isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'

            )}

          >

            {isSelected && <Check className="w-3 h-3" />}

          </button>

        ) : (

          <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">

            <MoreVertical size={14} className="text-slate-300" />

            <MoreVertical size={14} className="text-slate-300 -mt-2" />

          </div>

        )}

      </td>



      {/* Image */}

      <td className="py-3 px-4 w-[60px]">

        <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-slate-100 border border-slate-200/50 shadow-sm shrink-0">

          {imgSrc ? (

            <img src={imgSrc} alt={product.name} className="w-full h-full object-cover" />

          ) : (

            <div className="w-full h-full flex items-center justify-center text-slate-300">

              <Package size={20} />

            </div>

          )}

        </div>

      </td>



      {/* Name */}

      <td className="py-3 px-4 w-[20%]">

        <div className="font-black text-[13.5px] text-slate-900 truncate capitalize">{displayName}</div>

        <div className="flex items-center gap-1.5 mt-0.5">

          {product.brand && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.brand}</span>}

        </div>

      </td>



      {/* Barcode */}

      <td className="py-3 px-4 w-[16%]">

        {barcodeVal ? (

          <span 

            onClick={handleCopyBarcode}

            title="Kopyalamak için tıklayın"

            className="inline-block text-[11px] font-mono font-bold text-slate-600 bg-slate-50/80 border border-slate-200 rounded-md px-2 py-0.5 truncate max-w-full cursor-pointer hover:bg-white hover:border-slate-300 transition-all active:scale-95"

          >

            {barcodeVal}

          </span>

        ) : (

          <span className="text-[12px] font-bold text-slate-300">-</span>

        )}

      </td>



      {/* Category */}

      <td className="py-3 px-4 w-[12%]">

        <span className="text-[10px] inline-block font-black text-indigo-600 bg-indigo-50/50 border border-indigo-100/50 uppercase tracking-wider px-2 py-1 rounded-lg">

          {catName(product.category_id) || 'Genel'}

        </span>

      </td>



      {/* Variants (Beden) */}

      <td className="py-3 px-4 w-[8%] text-center relative z-10">

        {matchingVariant ? (

          <div className="inline-flex items-center gap-1 bg-indigo-600 text-white px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm">

            BEDEN: {matchingVariant.size}

          </div>

        ) : variants.length > 0 ? (

          <div className="relative inline-block">

            <div 

              onClick={(e) => { e.stopPropagation(); setShowVariants(prev => !prev); }}

              className={cn(

                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer transition-all",

                showVariants ? "bg-slate-200/80 shadow-inner" : "bg-slate-100/70 border border-slate-200/50 hover:bg-slate-200/60"

              )}

            >

              <Layers size={13} className="text-slate-500"/>

              <span className="text-[11px] font-black text-slate-700">

                {variants.length}

              </span>

            </div>



            {/* iOS Glassy Dropdown (Click triggered) */}

            {showVariants && (

              <div 

                className="absolute top-full left-1/2 ml-[-80px] mt-1 z-[999] animate-in fade-in zoom-in-95 duration-200 origin-top"

                onClick={e => e.stopPropagation()}

              >

                <div className="bg-white/60 backdrop-blur-3xl rounded-[1.25rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/80 max-h-[220px] overflow-hidden flex flex-col w-max min-w-[160px] max-w-[280px]">

                  <div className="px-3 py-2.5 bg-white/40 border-b border-black/5 text-[8.5px] font-black text-slate-800 uppercase tracking-widest text-center">

                    SEÇENEKLER 

                  </div>

                  <div className="p-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full flex flex-col">

                    {variants.map((v: any) => (

                      <div key={v.id} className="flex justify-between items-center text-[11px] whitespace-nowrap py-2 px-3 rounded-xl hover:bg-white/80 transition-colors cursor-default">

                        <div className="flex flex-col">

                          <span className={cn(

                            "font-bold text-slate-800 tracking-wider",

                            v.stock_quantity === 0 && "relative overflow-hidden text-slate-450 opacity-60 after:content-[''] after:absolute after:top-1/2 after:left-0 after:right-0 after:h-[1.5px] after:bg-slate-400/80 after:-rotate-6"

                          )}>

                            {v.size || ''} {v.color && (v.size ? `- ${v.color}` : v.color)}

                            {!v.size && !v.color && 'Varsayılan'}

                          </span>

                          {v.barcode && (

                            <span className="text-[8.5px] font-mono text-slate-400 mt-0.5">{v.barcode}</span>

                          )}

                        </div>

                        <div className="flex items-center gap-1.5 ml-6">

                           {v.stock_quantity <= v.critical_level ? <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse" /> : <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}

                           <span className={cn("font-black text-[11px]", v.stock_quantity <= v.critical_level ? 'text-rose-600' : 'text-slate-600')}>

                             {v.stock_quantity}

                           </span>

                        </div>

                      </div>

                    ))}

                  </div>

                </div>

              </div>

            )}

          </div>

        ) : (

          <span className="text-[11px] font-semibold text-slate-400">Tekil</span>

        )}

      </td>



      {/* Prices (Cost & Sell) */}

      <td className="py-3 px-4 w-[12%] text-right">

        <div className="flex flex-col gap-0.5 mt-0.5">

          <span className="text-[10px] font-bold text-slate-400">Alış: ₺{cost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>

          <span className="text-[14px] font-black text-emerald-600 leading-none">₺{price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>

        </div>

      </td>



      {/* KDV */}

      <td className="py-3 px-3 w-[6%] text-center">

        <span className="text-[11px] font-black text-rose-600 bg-rose-50 border border-rose-100/50 px-1.5 py-0.5 rounded-md">%{taxRate}</span>

      </td>



      {/* Profit */}

      <td className="py-3 px-4 w-[11%] text-right">

        <div className="flex flex-col items-end gap-0.5">

          <span className={cn('text-[14px] font-black leading-none whitespace-nowrap', profit > 0 ? 'text-slate-900' : 'text-slate-500')}>

            {profit > 0 ? '+' : ''}₺{profit.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}

          </span>

          <span className={cn('text-[9.5px] font-black uppercase tracking-tight', margin > 0 ? 'text-emerald-500' : 'text-slate-400')}>

            %{margin} kâr

          </span>

        </div>

      </td>



      {/* Stock */}

      <td className="py-3 px-4 w-[10%] text-right">

        <div className="flex items-center justify-end gap-1">

          <span className="text-[15px] font-black text-slate-900">

            {stockQuantity}

          </span>

          <span className="text-[9.5px] text-slate-900 font-bold uppercase tracking-widest pl-0.5">{unitVal}</span>

        </div>

      </td>



      {/* Actions */}

      <td className="py-3 pl-4 pr-6 w-[80px] text-right relative z-0">

        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">

          <button onClick={() => openEdit(product)} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all">

            <Edit className="w-3.5 h-3.5" />

          </button>

          <button onClick={() => handleDelete(product)} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all">

            <Trash2 className="w-3.5 h-3.5" />

          </button>

        </div>

      </td>

    </tr>

  );

}







// ─── Voice / Turbo Helpers ──────────────────────────────────────────────────

function VoiceInput({ onResult, value, onChange, placeholder, className, label, onSkip }: any) {

  const [isListening, setIsListening] = useState(false);



  const startVoice = () => {

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return alert("Tarayıcınız ses tanımayı desteklemiyor.");

    

    const recognition = new SpeechRecognition();

    recognition.lang = 'tr-TR';

    recognition.onstart = () => setIsListening(true);

    recognition.onend = () => setIsListening(false);

    recognition.onresult = (e: any) => {

      const text = e.results[0][0].transcript;

      onChange(text);

      if (onResult) onResult(text);

    };

    recognition.start();

  };



  return (

    <div className={cn("flex flex-col gap-1.5", className)}>

      <div className="flex items-center justify-between">

        {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>}

        {onSkip && (

          <button onClick={onSkip} className="p-1 text-slate-300 hover:text-slate-500 transition-colors" title="Geç">

            <ArrowRight className="w-3 h-3" />

          </button>

        )}

      </div>

      <div className="relative group/voice">

        <input 

          value={value}

          onChange={(e) => onChange(e.target.value)}

          placeholder={placeholder}

          className="w-full pl-3 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[13px] font-bold focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"

        />

        <button 

          onClick={startVoice}

          className={cn(

             "absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all",

             isListening ? "bg-red-500 text-white animate-pulse" : "bg-white text-slate-400 hover:text-blue-600 shadow-sm border border-slate-100"

          )}

        >

          <Mic className="w-3.5 h-3.5" />

        </button>

      </div>

    </div>

  );

}







// ─── Main Component ───────────────────────────────────────────────────────────

export function InventoryPage() {

  const { sidebarCollapsed } = useAppStore();

  // ── Data state ──

  const [products, setProducts]   = useState<Product[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const [showCopyToast, setShowCopyToast] = useState(false);



  const triggerCopyToast = () => {

    setShowCopyToast(true);

    setTimeout(() => setShowCopyToast(false), 2000);

  };



  // ── UI state ──

  const [searchTerm, setSearchTerm] = useState('');

  const [catFilter, setCatFilter]  = useState('all');

  const [sortFilter, setSortFilter] = useState('manual');

  const [actionMenu, setActionMenu] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 12; // 3 satır x 4 sütun = 12 ürün



  // ── Calculated KPIs (Real-time) ──

  const calculatedKPIs = useMemo(() => {
    let totalCost = 0;
    let totalSell = 0;
    let criticalCount = 0;
    let outOfStockCount = 0;
    let totalItemsCount = 0;
    let uniqueProductsCount = 0;

    // Varyantı olan parent ürünlerin ID'lerini bir Set olarak alıyoruz
    const parentIdsWithVariants = new Set(
      products.filter(p => p.parent_id).map(p => p.parent_id)
    );

    // Parent ürünlerin hızlı araması için Map
    const parentProducts = new Map(
      products.filter(p => !p.parent_id).map(p => [p.id, p])
    );

    products.forEach(p => {
      // Varyantı olan bir ana (parent) ürünse, bunu atlıyoruz.
      // Çünkü bunun varyantları (çocukları) döngüde ayrıca sayılacak ve mükerrer sayım engellenecektir.
      if (!p.parent_id && parentIdsWithVariants.has(p.id)) return;

      const qty = p.stock_quantity || 0;
      
      // Maliyet ve Fiyat kalıtımı (Inheritance):
      // Eğer varyantın fiyat/maliyeti girilmemişse (0 veya null), ana ürünün fiyat/maliyetini kullan.
      let cost = p.cost;
      let price = p.price;
      
      if (p.parent_id) {
        const parent = parentProducts.get(p.parent_id);
        if (parent) {
          if (cost === null || cost === undefined || cost === 0) {
            cost = parent.cost;
          }
          if (price === null || price === undefined || price === 0) {
            price = parent.price;
          }
        }
      }

      totalCost += (cost || 0) * qty;
      totalSell += (price || 0) * qty;
      totalItemsCount += qty;
      uniqueProductsCount++;

      if (qty === 0) {
        outOfStockCount++;
      } else if (qty <= p.critical_level) {
        criticalCount++;
      }
    });

    return {
      totalCost,
      totalSell,
      expectedProfit: totalSell - totalCost,
      alerts: criticalCount + outOfStockCount,
      criticalCount,
      outOfStockCount,
      totalItemsCount,
      uniqueProductsCount
    };
  }, [products]);



  // Variant counts

  const variantCounts = useMemo(() => {

    const counts: Record<string, number> = {};

    products.forEach(p => {

      if (p.parent_id) counts[p.parent_id] = (counts[p.parent_id] || 0) + 1;

    });

    return counts;

  }, [products]);



  const variantMap = useMemo(() => {

    const map: Record<string, Product[]> = {};

    products.forEach(p => {

      if (p.parent_id) {

        if (!map[p.parent_id]) map[p.parent_id] = [];

        map[p.parent_id].push(p);

      }

    });

    return map;

  }, [products]);



  // Unique brands and sizes for autocomplete

  const brandList = useMemo(() => {

    return Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort() as string[];

  }, [products]);

  const sizeSuggestions = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Standard'];



  // ── Panel (add / edit) ──

  const [showPanel, setShowPanel]      = useState(false);

  const [isEdit, setIsEdit]            = useState(false);

  const [editTarget, setEditTarget]    = useState<Product | null>(null);

  const [isSaving, setIsSaving]        = useState(false);

  const [formError, setFormError]      = useState<string | null>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);



  const [form, setForm] = useState({

    name: '', barcode: '', category: '', brand: '',

    buyPrice: '', sellPrice: '', tax_rate: '18',

    stock: '0', criticalStock: '10', unit: 'adet',

    image: null as File | null,

    size: '', color: '' 

  });



  const [formVariants, setFormVariants] = useState<any[]>([]);

  const [deletedVariants, setDeletedVariants] = useState<string[]>([]);

  const [newOption, setNewOption] = useState({ size: '', color: '', barcode: '', stock: '0' });
  const [sizeOpen, setSizeOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.size-select-container')) {
        setSizeOpen(false);
      }
      if (!target.closest('.color-select-container')) {
        setColorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const [isDeleting, setIsDeleting] = useState(false);



  // ── Invoice modal ──

  const [showInvoice, setShowInvoice] = useState(false);



  // ── Menu dropdowns ──

  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const [catMenuOpen, setCatMenuOpen] = useState(false);

  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const [openMenuSection, setOpenMenuSection] = useState<'import' | 'export' | null>(null);



  // ── History modal ──

  const [historyTarget, setHistoryTarget] = useState<Product | null>(null);

  const [historyData, setHistoryData] = useState<any[]>([]);



  // ── Label modal ──

  const [labelTarget, setLabelTarget] = useState<Product[]>([]);

  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showBulkBarcodeChoice, setShowBulkBarcodeChoice] = useState(false);



  const labelChunks = useMemo(() => {
    const chunks: Product[][] = [];
    for (let i = 0; i < labelTarget.length; i += 6) {
      chunks.push(labelTarget.slice(i, i + 6));
    }
    return chunks;
  }, [labelTarget]);



  const [isBulkSelecting, setIsBulkSelecting] = useState(false);

  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);



  const [showCatDeleteConfirm, setShowCatDeleteConfirm] = useState(false);

  const [catToDelete, setCatToDelete] = useState<Category | null>(null);



  const [showProductDeleteConfirm, setShowProductDeleteConfirm] = useState(false);

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);



  // ── New UI Enchancements States ──

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  const [brandFilter, setBrandFilter] = useState<string>('all');

  

  // ── Bulk Actions ──

  const [showBulkEditModal, setShowBulkEditModal] = useState(false);

  const [bulkEditForm, setBulkEditForm] = useState({ categoryId: '', priceChangeType: 'none', priceChangeValue: '0' });

  const [isBulkSaving, setIsBulkSaving] = useState(false);



  // ── Drag & Drop ──

  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);

  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);







  // Modal açıkken kaydırmayı engelle

  useEffect(() => {

    const isModalOpen = showBulkDeleteConfirm || showPanel || showInvoice || historyTarget || showLabelModal || showCatDeleteConfirm || showProductDeleteConfirm || showBulkBarcodeChoice;
    if (isModalOpen) {

      document.body.style.overflow = 'hidden';

    } else {

      document.body.style.overflow = 'unset';

    }

    return () => { document.body.style.overflow = 'unset'; };

  }, [showBulkDeleteConfirm, showPanel, showInvoice, historyTarget, showLabelModal, showBulkEditModal, showCatDeleteConfirm, showProductDeleteConfirm]);



  const fileRef = useRef<HTMLInputElement>(null);

  const importExcelRef = useRef<HTMLInputElement>(null);

  const actionMenuRef = useRef<HTMLDivElement>(null);

  const contentScrollRef = useRef<HTMLDivElement>(null);



  // ── Debounced Search ──

  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  useEffect(() => {

    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);

    return () => clearTimeout(timer);

  }, [searchTerm]);



  // ── Unique Brands for Filter ──

  const uniqueBrands = useMemo(() => {

    const brands = new Set<string>();

    products.forEach(p => { if (p.brand) brands.add(p.brand); });

    return Array.from(brands).sort();

  }, [products]);



  // ── Load ──

  // ── Handling Outside Clicks for Action Menu ──

  useEffect(() => {

    const handleClickOutside = (event: MouseEvent) => {

      const target = event.target as HTMLElement;

      if (actionMenuRef.current && !actionMenuRef.current.contains(target) && !target.closest('.menu-toggle-btn')) {

        setActionMenu(null);

      }

    };

    if (actionMenu) {

      document.addEventListener('mousedown', handleClickOutside);

    }

    return () => {

      document.removeEventListener('mousedown', handleClickOutside);

    };

  }, [actionMenu]);







  const load = async () => {

    setIsLoading(true);

    try {

      const [p, c] = await Promise.all([

        inventoryApi.getProducts().catch(err => { console.error('Products load error:', err); return []; }),

        inventoryApi.getCategories().catch(err => { console.error('Categories load error:', err); return []; })

      ]);

      setProducts(p || []);

      setCategories(c || []);

      

      // KPIs are now calculated in real-time on the frontend via useMemo

    } catch (e) { 

      console.error('Data load error:', e); 

    } finally { 

      setIsLoading(false); 

    }

  };

  useEffect(() => { load(); }, []);



  // ── Filter + Sort ──

  const filtered = useMemo(() => {

    const s = debouncedSearch.toLowerCase();

    let list = products.filter(p => {

      // Variants are NEVER displayed as individual rows on the main grid.

      if (p.parent_id) return false;

      

      if (catFilter !== 'all' && p.category_id !== catFilter) return false;

      

      if (sortFilter === 'online-only') {

        const hasOnlineVariant = products.filter(v => v.parent_id === p.id).some(v => v.marketplaceStatus === 'active');

        const isParentOnline = p.marketplaceStatus === 'active';

        return isParentOnline || hasOnlineVariant;

      }

      

      // If searching, search in everything including variants

      if (s) {

        const matchesParent = p.name.toLowerCase().includes(s) || 

                              p.brand?.toLowerCase().includes(s) || 

                              p.barcode?.includes(s);

        if (matchesParent) return true;

        

        // Search in variants too

        const hasMatchingVariant = products.filter(v => v.parent_id === p.id).some(v => 

          v.name.toLowerCase().includes(s) || v.barcode?.includes(s)

        );

        return hasMatchingVariant;

      }

      return true;

    });

    if (s && !['stock-low','stock-out','stock-ok'].includes(sortFilter)) {

      list = list.filter(p =>

        p.name.toLowerCase().includes(s) ||

        p.brand?.toLowerCase().includes(s) ||

        p.barcode?.includes(s)

      );

    }

    return [...list].sort((a, b) => {

      // If manual sort is active, keep the order of the products array

      if (sortFilter === 'manual') return 0;



      // Grup bazlı sıralama: Ana ürün ve varyantları her zaman birlikte olsun

      const groupA = a.parent_id || a.id;

      const groupB = b.parent_id || b.id;

      

      if (groupA !== groupB) {

        // Farklı gruplarsa seçilen sort kriterine göre sırala

        if (sortFilter === 'name-az') return a.name.localeCompare(b.name, 'tr');

        if (sortFilter === 'name-za') return b.name.localeCompare(a.name, 'tr');

        if (sortFilter === 'price-asc') return a.price - b.price;

        if (sortFilter === 'price-desc') return b.price - a.price;

        if (sortFilter === 'stock-asc') return a.stock_quantity - b.stock_quantity;

        if (sortFilter === 'stock-desc') return b.stock_quantity - a.stock_quantity;

        return 0;

      } else {

        // Aynı gruptalarsa: Önce ana ürün (parent_id'si olmayan), sonra varyantlar

        if (!a.parent_id) return -1;

        if (!b.parent_id) return 1;

        // Varyantlar kendi içinde isme göre sıralansın

        return a.name.localeCompare(b.name, 'tr');

      }

    });

  }, [products, catFilter, sortFilter, debouncedSearch]);



  // ── Pagination Calculation ──

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const paginatedItems = useMemo(() => {

    const start = (currentPage - 1) * itemsPerPage;

    return filtered.slice(start, start + itemsPerPage);

  }, [filtered, currentPage, itemsPerPage]);



    const handleBatchDelete = async () => {

      if (!selectedIds.size) return;

      setIsDeleting(true);

      try {

        await inventoryApi.batchDelete(Array.from(selectedIds));

        setProducts(prev => prev.filter(p => !selectedIds.has(p.id) && (!p.parent_id || !selectedIds.has(p.parent_id))));

        setSelectedIds(new Set());

        setIsBulkSelecting(false);

        setShowBulkDeleteConfirm(false);

        await load();

      } catch (e) { 

        console.error(e); 

        alert('Bazı ürünler silinemedi.');

      } finally {

        setIsDeleting(false);

      }

    };







  // Sayfa dışına çıkarsa 1'e dön

  useEffect(() => {

    if (currentPage > totalPages && totalPages > 0) {

      setCurrentPage(1);

    }

  }, [totalPages, currentPage]);



  // ── Handlers ──

  const handleDelete = async (p: Product) => {

    setProductToDelete(p);

    setShowProductDeleteConfirm(true);

  };



  const confirmProductDelete = async () => {

    if (!productToDelete) return;

    try { 

      await inventoryApi.deleteProduct(productToDelete.id); 

      setProducts(prev => prev.filter(x => x.id !== productToDelete.id && x.parent_id !== productToDelete.id));

      setShowProductDeleteConfirm(false);

      setProductToDelete(null);

      await load(); 

    }

    catch (e) { console.error(e); alert('Ürün silinemedi.'); }

  };



  const toggleAll = () => {

    if (selectedIds.size === filtered.length && filtered.length > 0) {

      setSelectedIds(new Set());

    } else {

      setSelectedIds(new Set(filtered.map(p => p.id)));

    }

  };



  const openHistory = async (p: Product) => {

    setHistoryTarget(p);

    try {

      const h = await inventoryApi.getProductHistory(p.id);

      setHistoryData(h);

    } catch (e) { console.error(e); }

  };



  const openEdit = (p: Product) => {

    setIsEdit(true); setEditTarget(p); setFormError(null);

    // If editing a variant, find its parent and load that parent's data

    const parentId = p.parent_id || p.id;

    const parentProduct = p.parent_id ? products.find(x => x.id === p.parent_id) || p : p;

    setForm({

      name: parentProduct.name, barcode: parentProduct.barcode || '', category: parentProduct.category_id,

      brand: parentProduct.brand || '', buyPrice: parentProduct.cost?.toString() || '',

      // Formda NET fiyat gösterilir (KDV hariç). Kayıtlı fiyat KDV dahil olduğundan geri çeviriyoruz.

      tax_rate: (p.tax_rate !== undefined && p.tax_rate !== null) ? String(Math.round(p.tax_rate)) : String(Math.round(parentProduct.tax_rate ?? 18)),

      sellPrice: (parentProduct.price / (1 + (Math.round(p.tax_rate ?? parentProduct.tax_rate ?? 18)) / 100)).toFixed(2),

      stock: parentProduct.stock_quantity.toString(), criticalStock: parentProduct.critical_level.toString(),

      unit: parentProduct.unit || 'adet', image: null,

      size: '', color: ''

    });

    // Always load ALL variants of the parent product

    setFormVariants(products.filter(v => v.parent_id === parentId));

    setDeletedVariants([]);

    setImagePreview(parentProduct.image_url ? (parentProduct.image_url.startsWith('http') ? parentProduct.image_url : `${getApiBaseUrl()}${parentProduct.image_url}`) : null);

    setNewOption({ size: '', color: '', barcode: '', stock: '0' });

    setShowPanel(true); setActionMenu(null);

  };



  const openAdd = () => {

    setIsEdit(false); setEditTarget(null); setFormError(null);

    setForm({ 

      name: '', barcode: '', category: '', brand: '', 

      buyPrice: '', sellPrice: '', tax_rate: '18', stock: '0', 

      criticalStock: '10', unit: 'adet', image: null, size: '', color: ''

    });

    setFormVariants([]);

    setDeletedVariants([]);

    setNewOption({ size: '', color: '', barcode: '', stock: '0' });

    setImagePreview(null);

    setShowPanel(true);

  };



  const handleSave = async (stayOpen: boolean = false) => {

    setFormError(null);

    if (!form.name || !form.sellPrice) {

      setFormError('Ürün adı ve satış fiyatı zorunludur.');

      return;

    }

    if (form.buyPrice && parseFloat(form.buyPrice) > parseFloat(form.sellPrice)) {

      setFormError('Alış fiyatı, satış fiyatından büyük olamaz!');

      return;

    }



    setIsSaving(true);

    console.log('[DEBUG] handleSave triggered. Form tax_rate:', form.tax_rate);

    try {

      let categoryName = (form.category || "").trim();
      if (!categoryName || categoryName === "Seçin...") {
        categoryName = "Genel";
      }

      let categoryId = "";
      const existingCat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase() || c.id === categoryName);

      if (existingCat) {
        categoryId = existingCat.id;
      } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryName)) {
        // Only create if it's not a UUID and not found
        const newCat = await inventoryApi.createCategory({ name: categoryName });
        categoryId = newCat.id;
        setCategories([...categories, newCat]);
      } else {
        categoryId = categoryName;
      }



      // Kullanıcı NET fiyat girer, KDV üstüne eklenerek KDV dahil fiyat hesaplanır ve kaydedilir.

      const taxRateNum = (form.tax_rate !== undefined && form.tax_rate !== "") ? parseFloat(form.tax_rate) : 18.0;

      const netPrice = parseFloat(form.sellPrice) || 0;

      const kdvDahilPrice = parseFloat((netPrice * (1 + taxRateNum / 100)).toFixed(2));



      const data: ProductCreate = {

        name: form.name,

        category_id: categoryId,

        barcode: form.barcode || undefined, brand: form.brand || undefined,

        price: kdvDahilPrice,

        cost: form.buyPrice ? parseFloat(form.buyPrice) : undefined,

        stock_quantity: parseInt(form.stock) || 0,

        critical_level: parseInt(form.criticalStock) || 10,

        unit: form.unit, image: form.image || undefined, is_active: true,

        tax_rate: taxRateNum,

        size: form.size || undefined,

        color: form.color || undefined,

      };



      console.log('[DEBUG] Product data to save:', data);



      let parentResult;

      if (isEdit && editTarget) {

        // Find the real parent (editTarget might be a variant)

        const realEditTarget = editTarget.parent_id 

          ? products.find(x => x.id === editTarget.parent_id) || editTarget

          : editTarget;

        parentResult = await inventoryApi.updateProduct(realEditTarget.id, data as any);

        // Upload image separately if a new file was chosen

        if (form.image) {

          await inventoryApi.updateProductImage(realEditTarget.id, form.image);

        }

      } else {

        parentResult = await inventoryApi.createProduct(data);

      }

      

      const parentId = parentResult.id;



      // Kaydedilecek veya eklenecek Seçenekler(Beden/Renk) tablosu:
      // Sadece formVariants listesinde tanımlanmış gerçek varyantlar varsa kaydet.
      // Standart/Bedensiz ürünlerde parent ürünün kendisi yeterlidir, ayrıca varyant satırı eklemeye gerek yoktur.
      const actualVariants = [...formVariants];
      if (actualVariants.length === 0 && ((newOption.size || "").trim() || (newOption.color || "").trim())) {
        actualVariants.push({
          size: newOption.size ? newOption.size.trim() : undefined,
          color: newOption.color ? newOption.color.trim() : undefined,
          stock_quantity: parseInt(newOption.stock) || 0,
          barcode: newOption.barcode || undefined,
        });
      }

      if (actualVariants && actualVariants.length > 0) {
        for (const v of actualVariants) {
          const vData = {
             name: `${form.name} - ${v.size || v.color || 'Seçenek'}`,
             category_id: categoryId,
             barcode: v.barcode || undefined,
             price: kdvDahilPrice,
             cost: form.buyPrice ? parseFloat(form.buyPrice) : undefined,
             stock_quantity: parseInt(v.stock_quantity ?? v.stock) || 0,
             critical_level: parseInt(form.criticalStock) || 10,
             unit: form.unit,
             parent_id: parentId,
             color: v.color || undefined,
             size: v.size || undefined,
             tax_rate: taxRateNum
          };

          if (v.id) await inventoryApi.updateProduct(v.id, vData as any);
          else await inventoryApi.createProduct(vData as any);
        }
      }

      

      // Silinmesi istenen eski varyantlar:

      for (const delId of deletedVariants) {

         try { await inventoryApi.deleteProduct(delId); } catch(e) {}

      }



      await load();

      

      if (stayOpen) {

        // Reset form for next entry but keep some context (category, brand, etc.)

        setForm({

          name: '', 

          barcode: '', 

          category: categoryId, 

          brand: form.brand, 

          buyPrice: '', 

          sellPrice: '', 

          stock: '0', 

          criticalStock: '10', 

          unit: 'adet', 

          image: null, 

          size: '',

          color: '',

          tax_rate: form.tax_rate,

        });

        setImagePreview(null);

        setFormVariants([]);

        setDeletedVariants([]);

        setFormError(null);

        // Optional: toast or success indicator

      } else {

        setShowPanel(false);

        setImagePreview(null);

      }

    } catch (e: any) {

      console.error('[ERROR] handleSave failed:', e);

      console.error('[ERROR] Response:', e.response?.data);

      console.error('[ERROR] Status:', e.response?.status);

      console.error('[ERROR] Message:', e.message);



      const detail = e.response?.data?.detail;

      const errorMsg = typeof detail === 'string' ? detail :

                      (Array.isArray(detail) ? detail.map(d => d.msg).join(', ') :

                      (e.message || 'Kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.'));

      setFormError(errorMsg);

    } finally { 

      setIsSaving(false); 

    }

  };



  const generateUniqueBarcode = (): string => {
    let attempts = 0;
    while (attempts < 1000) {
      const code = String(Math.floor(1e12 + Math.random() * 9e12));
      const isDuplicate = products.some(p => p.barcode === code);
      if (!isDuplicate) {
        return code;
      }
      attempts++;
    }
    return String(Math.floor(1e12 + Math.random() * 9e12));
  };

  const genBarcode = () => setForm(f => ({ ...f, barcode: generateUniqueBarcode() }));



  const handleDeleteCategory = (catId: string, e: React.MouseEvent) => {

    e.stopPropagation();

    const cat = categories.find(c => c.id === catId);

    if (!cat) return;

    setCatToDelete(cat);

    setShowCatDeleteConfirm(true);

  };



  const confirmCategoryDelete = async () => {

    if (!catToDelete) return;

    try {

      await inventoryApi.deleteCategory(catToDelete.id);

      setCategories(categories.filter(c => c.id !== catToDelete.id));

      if (catFilter === catToDelete.id) setCatFilter('all');

      setShowCatDeleteConfirm(false);

      setCatToDelete(null);

    } catch (err) {

      alert('Kategori silinemedi: ' + err);

    }

  };



  const catName = (id: string) => categories.find(c => c.id === id)?.name || '';

  const palette = (id: string) => CAT_PALETTE[getCatKey(catName(id))] ?? CAT_PALETTE.default;



  // ── Excel Export ──

  const handleExportExcel = () => {
    const exportList = products.filter(p => !p.parent_id);
    const rows = exportList.map(p => {
      // 1. Calculate stock quantity safely (sum variants if parent has no stock directly)
      let stock = p.stock_quantity;
      if (stock === null || stock === undefined) {
        const vars = products.filter(v => v.parent_id === p.id);
        if (vars.length > 0) {
          stock = vars.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
        } else {
          stock = 0;
        }
      }

      // 2. Safe default values
      let critical = p.critical_level !== null && p.critical_level !== undefined ? p.critical_level : 10;
      let unit = p.unit ? String(p.unit).trim() : 'adet';

      // 3. Clean up database shifts if previously imported incorrectly (e.g. unit="10 Adet")
      if (unit && /^\d+\s+\w+/i.test(unit)) {
        const match = unit.match(/^(\d+)\s+(.+)$/);
        if (match) {
          critical = parseInt(match[1]) || critical;
          unit = match[2];
        }
      }

      return {
        'Ürün Adı': p.name || '',
        'Marka': p.brand || '',
        'Barkod': p.barcode || '',
        'Kategori': catName(p.category_id) || 'Genel',
        'Alış Fiyatı': p.cost !== null && p.cost !== undefined ? p.cost : 0,
        'Satış Fiyatı': p.price !== null && p.price !== undefined ? p.price : 0,
        'Stok': stock,
        'Kritik Stok': critical,
        'Birim': unit,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ürünler');
    XLSX.writeFile(wb, `urunler_${new Date().toISOString().slice(0,10)}.xlsx`);
  };



  // ── Excel Import ──

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (ev) => {

      try {

        const data = new Uint8Array(ev.target!.result as ArrayBuffer);

        const wb = XLSX.read(data, { type: 'array' });

        const ws = wb.Sheets[wb.SheetNames[0]];

        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        let successCount = 0;

        for (const row of rows) {

          const name = row['Ürün Adı'] || row['name'] || row['Ad'];

          const price = parseFloat(row['Satış Fiyatı'] || row['price'] || '0');

          if (!name || !price) continue;

          try {

            await inventoryApi.createProduct({

              name: String(name),

              barcode: row['Barkod'] ? String(row['Barkod']) : undefined,

              brand: row['Marka'] ? String(row['Marka']) : undefined,

              category_id: '',

              price,

              cost: row['Alış Fiyatı'] ? parseFloat(row['Alış Fiyatı']) : undefined,

              stock_quantity: parseInt(row['Stok'] ?? '0') || 0,

              critical_level: parseInt(row['Kritik Stok'] ?? '10') || 10,

              unit: String(row['Birim'] || 'adet'),

              is_active: true,

            });

            successCount++;

          } catch (err) { console.warn('Satır hatası:', err); }

        }

        alert(`${successCount} ürün başarıyla içe aktarıldı.`);

        await load();

      } catch (err) {

        alert('Excel dosyası okunamadı. Formatı kontrol edin.');

      }

    };

    reader.readAsArrayBuffer(file);

    e.target.value = '';

  };



  // ── PDF Export (simple print) ──

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      
      const cleanTurk = (str: string) => {
        return str
          .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
          .replace(/ü/g, 'u').replace(/Ü/g, 'U')
          .replace(/ş/g, 's').replace(/Ş/g, 'S')
          .replace(/ı/g, 'i').replace(/İ/g, 'I')
          .replace(/ö/g, 'o').replace(/Ö/g, 'O')
          .replace(/ç/g, 'c').replace(/Ç/g, 'C');
      };

      const headers = [['Urun Adi', 'Marka', 'Barkod', 'Kategori', 'Fiyat', 'Stok', 'Durum']];
      
      const exportList = products.filter(p => !p.parent_id);
      const body = exportList.map(p => {
        let stock = p.stock_quantity;
        if (stock === null || stock === undefined) {
          const vars = products.filter(v => v.parent_id === p.id);
          if (vars.length > 0) {
            stock = vars.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
          } else {
            stock = 0;
          }
        }

        let critical = p.critical_level !== null && p.critical_level !== undefined ? p.critical_level : 10;
        let unit = p.unit ? String(p.unit).trim() : 'adet';

        if (unit && /^\d+\s+\w+/i.test(unit)) {
          const match = unit.match(/^(\d+)\s+(.+)$/);
          if (match) {
            critical = parseInt(match[1]) || critical;
            unit = match[2];
          }
        }

        const durum = stock === 0 ? 'Tukendi' : stock <= critical ? 'Kritik' : 'Stokta';

        return [
          cleanTurk(p.name || ''),
          cleanTurk(p.brand || '—'),
          p.barcode || '—',
          cleanTurk(catName(p.category_id) || 'Genel'),
          `TL ${p.price.toFixed(2)}`,
          `${stock} ${cleanTurk(unit)}`,
          durum
        ];
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(cleanTurk(`URUN LISTESI — ${new Date().toLocaleDateString('tr-TR')}`), 14, 15);

      autoTable(doc, {
        head: headers,
        body: body,
        startY: 22,
        theme: 'striped',
        styles: { fontSize: 8, font: 'helvetica' },
        headStyles: { fillColor: [15, 23, 42] },
      });

      doc.save(`urunler_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error(err);
      alert('PDF dosyası oluşturulurken bir hata oluştu.');
    }
  };



  const handlePrintLabels = () => {

    const printWindow = window.open('', '_blank');

    if (!printWindow) {

      alert('Yazdırma penceresi açılamadı. Lütfen pop-up engelleyicinizi kapatın.');

      return;

    }

    // Her ürünü stok adedi kadar tekrarla (minimum 1)
    const expandedLabels: Product[] = [];
    for (const p of labelTarget) {
      const qty = Math.max(1, p.stock_quantity || 1);
      for (let i = 0; i < qty; i++) {
        expandedLabels.push(p);
      }
    }

    const chunks: Product[][] = [];

    for (let i = 0; i < expandedLabels.length; i += 6) {

      chunks.push(expandedLabels.slice(i, i + 6));

    }



    const pagesHtml = chunks.map(chunk => {

      const labelsInsidePage = chunk.map(p => {

        const barcodeVal = p.barcode || p.sku || p.id;

        const svgString = getBarcodeSVGString(barcodeVal);

        const sizeHtml = p.size 

          ? `<div class="product-size">BEDEN: ${p.size}</div>`

          : `<div class="product-size">STANDART BEDEN</div>`;



        return `

          <div class="label-box">

            <div style="width: 85%; max-width: 180px; display: flex; flex-direction: column; align-items: center; margin-bottom: 2px;">

              ${svgString}

              <div class="barcode-text">${barcodeVal}</div>

            </div>

            <div class="product-title">${p.name}</div>

            ${sizeHtml}

          </div>

        `;

      }).join('');



      return `

        <div class="print-page">

          ${labelsInsidePage}

        </div>

      `;

    }).join('');



    const documentContent = `

      <html>

        <head>

          <title>Toplu Barkod Baskısı</title>

          <style>

            @page {

              margin: 0;

              size: auto;

            }

            body {

              margin: 0;

              padding: 0;

              font-family: 'Arial', sans-serif;

              background: white;

              -webkit-print-color-adjust: exact;

              print-color-adjust: exact;

            }

            .print-page {

              display: grid;

              grid-template-columns: repeat(2, 1fr);

              grid-template-rows: repeat(3, 1fr);

              width: 100vw;

              height: 100vh;

              box-sizing: border-box;

              padding: 15px;

              page-break-after: always;

              break-after: page;

              background: white;

            }

            .label-box {

              display: flex;

              flex-direction: column;

              align-items: center;

              justify-content: center;

              border: 1px dashed #cbd5e1;

              padding: 15px;

              box-sizing: border-box;

              text-align: center;

              background: white;

            }

            .barcode-text {

              font-family: monospace;

              font-size: 10px;

              font-weight: bold;

              letter-spacing: 0.15em;

              margin-top: 4px;

              color: #334155;

            }

            .product-title {

              font-size: 11px;

              font-weight: bold;

              text-transform: uppercase;

              margin-top: 6px;

              margin-bottom: 2px;

              color: #0f172a;

              max-width: 90%;

              white-space: nowrap;

              overflow: hidden;

              text-overflow: ellipsis;

            }

            .product-size {

              display: inline-block;

              background: #f1f5f9;

              color: #475569;

              padding: 1px 5px;

              border-radius: 4px;

              font-size: 9px;

              font-weight: bold;

              margin-top: 2px;

              text-transform: uppercase;

            }

          </style>

        </head>

        <body>

          ${pagesHtml}

          <script>

            window.onload = function() {

              window.print();

              setTimeout(function() { window.close(); }, 500);

            };

          </script>

        </body>

      </html>

    `;



    printWindow.document.write(documentContent);

    printWindow.document.close();

  };



  // ── Keyboard Navigation ──

  const handleKeyDown = (e: React.KeyboardEvent) => {

    if (e.key === 'Enter') {

      const target = e.target as HTMLElement;

      // Eğer bir input, select veya textarea içindeysek

      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {

        // Eğer bir butona odaklanmamışsak Enter'ın normal davranışını (form submit gibi) engelle

        e.preventDefault();

        

        const modalBody = target.closest('.max-w-4xl') || document.body;

        if (!modalBody) return;

        

        // Odaklanılabilir tüm form elemanlarını bul

        const focusableNodes = modalBody.querySelectorAll('input:not([disabled]):not([type="file"]):not(.hidden), select:not([disabled]):not(.hidden), textarea:not([disabled]):not(.hidden)');

        const focusable = Array.from(focusableNodes) as HTMLElement[];

        

        const index = focusable.indexOf(target);

        if (index > -1 && index < focusable.length - 1) {

          // Bir sonraki elemana geç

          focusable[index + 1].focus();

        }

      }

    }

  };



  return (

    <div className="min-h-screen flex flex-col bg-slate-50 font-sans antialiased text-slate-800">

      

      <header className="sticky top-0 bg-white border-b border-slate-200 shrink-0 z-30 shadow-sm">

        <div className="max-w-[1600px] mx-auto w-full px-6 py-3 flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="w-1.5 h-6 bg-slate-900 rounded-lg" />

            <h1 className="text-sm font-bold tracking-tight text-slate-900 uppercase">STOK VE ENVANTER YÖNETİMİ</h1>

          </div>

        </div>

      </header>



      <main className="flex-1 overflow-y-auto p-2 lg:p-4 pb-32 bg-slate-50">

        <div className="max-w-[1600px] mx-auto space-y-5">

          <input ref={importExcelRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} />



      {/* ── TOP STATS ─────────────────────────────────────────────────── */}

      <div className={cn(

        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-500 transition-opacity",

        isLoading && "opacity-60 pointer-events-none"

      )}>

          <KPICard 

            title="TOPLAM STOK MALİYETİ" 

            value={`₺${calculatedKPIs.totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`} 

            icon={Wallet} 

            color="bg-blue-50 text-blue-600" 

            trend="Aktif Sermaye"

          />

          <KPICard 
            title="TOPLAM ÜRÜN ÇEŞİDİ" 
            value={`${calculatedKPIs.uniqueProductsCount} Çeşit`} 
            icon={Package} 
            color="bg-emerald-50 text-emerald-600"
            trend="Benzersiz Ürün Girişi"
          />

          <KPICard 
            title="TOPLAM STOK ADEDİ" 
            value={`${calculatedKPIs.totalItemsCount.toLocaleString('tr-TR')} Adet`} 
            icon={Layers} 
            color="bg-indigo-50 text-indigo-600"
            trend="Depodaki Toplam Ürün"
          />

          <KPICard 

            title="TÜKENEN STOKLAR" 

            value={calculatedKPIs.outOfStockCount + " Ürün"} 

            icon={AlertCircle} 

            color={calculatedKPIs.outOfStockCount > 0 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-400"}

            trend={calculatedKPIs.outOfStockCount > 0 ? "Acil Stok/Sipariş Gerekli" : "Tüm Stoklar Yeterli"}

          />

      </div>



      {/* ── FILTER BAR ──────────────────────────────────────────────────── */}
      <div className="bg-slate-100 rounded-xl border border-slate-400 shadow-sm p-1.5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setSortMenuOpen(!sortMenuOpen)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-[10px] font-bold text-slate-600 uppercase tracking-wider border border-slate-400 hover:border-slate-500 transition-all select-none"
          >
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            {sortFilter === 'name-az' ? 'A-Z SIRALA' : sortFilter === 'name-za' ? 'Z-A SIRALA' : sortFilter === 'price-asc' ? 'UCUZDAN PAHALIYA' : sortFilter === 'price-desc' ? 'PAHALIDAN UCUZA' : sortFilter === 'stock-asc' ? 'STOK: AZALAN' : sortFilter === 'stock-desc' ? 'STOK: ARTAN' : 'SIRALAMA'}
            <ChevronDown className={cn("w-3 h-3 transition-transform", sortMenuOpen && "rotate-180")} />
          </button>

          {sortMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setSortMenuOpen(false)} />
              <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-200 z-40 overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                <div className="p-1 max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
                  <div className="px-3 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">Akıllı Sıralama</div>
                  {[
                    { id: 'name-az', label: "A'DAN Z'YE" },
                    { id: 'name-za', label: "Z'DEN A'YA" },
                    { id: 'price-asc', label: "FİYAT: EN DÜŞÜK" },
                    { id: 'price-desc', label: "FİYAT: EN YÜKSEK" },
                    { id: 'stock-asc', label: "STOK: EN AZ" },
                    { id: 'stock-desc', label: "STOK: EN ÇOK" }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { setSortFilter(opt.id); setSortMenuOpen(false); }}
                      className={cn(
                        "w-full px-3 py-2.5 rounded-lg text-left text-[11px] font-semibold transition-all duration-150",
                        sortFilter === opt.id 
                          ? "bg-slate-900 text-white shadow-sm" 
                          : "hover:bg-slate-100/80 text-slate-650 hover:text-slate-900"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="w-px h-6 bg-slate-200 mx-1" />

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            data-barcode-target="true"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Ürün adı, barkod veya marka ile ara..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-400 bg-white focus:bg-white text-[13px] font-medium hover:border-slate-500 focus:border-slate-500 outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 pr-1">
          <div className="relative">
            <button
              onClick={() => setCatMenuOpen(!catMenuOpen)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-[10px] font-bold text-slate-600 uppercase tracking-wider border border-slate-400 hover:border-slate-500 transition-all select-none"
            >
              <Package className="w-3 h-3 text-slate-400" />
              {catFilter === 'all' ? 'TÜM KATEGORİLER' : categories.find(c => c.id === catFilter)?.name.toUpperCase()}
              <ChevronDown className={cn("w-3 h-3 transition-transform", catMenuOpen && "rotate-180")} />
            </button>

            {catMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setCatMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-200 z-40 overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-1 max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
                    <div className="px-3 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">Kategoriler</div>
                    <button
                      onClick={() => { setCatFilter('all'); setCatMenuOpen(false); }}
                      className={cn(
                        "w-full px-3 py-2.5 rounded-lg text-left text-[11px] font-semibold transition-all duration-150",
                        catFilter === 'all' 
                          ? "bg-slate-900 text-white shadow-sm" 
                          : "hover:bg-slate-100/80 text-slate-650 hover:text-slate-900"
                      )}
                    >
                      TÜM KATEGORİLER
                    </button>
                    {categories.filter(c => products.some(p => p.category_id === c.id)).map(c => (
                      <div key={c.id} className="group flex items-center">
                        <button
                          onClick={() => { setCatFilter(c.id); setCatMenuOpen(false); }}
                          className={cn(
                            "flex-1 px-3 py-2.5 rounded-lg text-left text-[11px] font-semibold transition-all duration-150 truncate",
                            catFilter === c.id 
                              ? "bg-slate-900 text-white shadow-sm" 
                              : "hover:bg-slate-100/80 text-slate-650 hover:text-slate-900"
                          )}
                        >
                          {c.name.toUpperCase()}
                        </button>
                        <button 
                          onClick={(e) => handleDeleteCategory(c.id, e)}
                          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 rounded-md text-slate-300 transition-all ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="w-px h-6 bg-slate-200 mx-1" />

          <div className="relative">
            <button
              onClick={() => {
                setAddMenuOpen(v => !v);
                setOpenMenuSection(null);
              }}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600 border border-slate-400 hover:border-slate-500 transition-all active:scale-95 shadow-sm select-none"
            >
              ENVANTER YÖNETİMİ
              <ChevronDown className={cn('w-3 h-3 ml-0.5 transition-transform duration-300', addMenuOpen && 'rotate-180')} />
            </button>

            {addMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAddMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-200 z-40 overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Envanter Yönetimi</p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <button
                      onClick={() => { setAddMenuOpen(false); openAdd(); }}
                      className="w-full flex items-center gap-3 px-2.5 py-2 hover:bg-slate-50 rounded-lg transition-all text-left group"
                    >
                      <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">
                        <PenLine className="w-3 h-3" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11.5px] font-black text-slate-800 leading-tight">Manuel Ürün Girişi</p>
                        <p className="text-[8.5px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Sıfırdan Ürün Tanımla</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { setAddMenuOpen(false); setShowInvoice(true); }}
                      className="w-full flex items-center gap-3 px-2.5 py-2 hover:bg-slate-50 rounded-lg transition-all text-left group"
                    >
                      <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">
                        <Sparkles className="w-3 h-3" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11.5px] font-black text-slate-800 leading-tight">Otomatik (AI)</p>
                        <p className="text-[8.5px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Fatura Tarayarak Ekle</p>
                      </div>
                    </button>
                  </div>

                  <div className="px-4 py-2 border-y border-slate-100 bg-slate-50/50">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Dosya & Veri Aktarımı</p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <div className="space-y-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuSection(openMenuSection === 'import' ? null : 'import'); }}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all group",
                          openMenuSection === 'import' ? "bg-slate-50 shadow-inner" : "hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={cn("w-6 h-6 rounded-md flex items-center justify-center transition-all", openMenuSection === 'import' ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500")}>
                            <FileUp className="w-3 h-3" />
                          </div>
                          <p className="text-[11px] font-bold text-slate-700">İçe Aktar</p>
                        </div>
                        <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform duration-300", openMenuSection === 'import' && "rotate-180")} />
                      </button>
                      
                      {openMenuSection === 'import' && (
                        <div className="pl-11 pr-2 py-0.5 space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                          <button
                            onClick={() => { setAddMenuOpen(false); importExcelRef.current?.click(); }}
                            className="w-full text-left px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-all flex items-center gap-1.5"
                          >
                            <FileSpreadsheet className="w-3 h-3 text-emerald-600" /> Excel'den Yükle
                          </button>

                        </div>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuSection(openMenuSection === 'export' ? null : 'export'); }}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all group",
                          openMenuSection === 'export' ? "bg-slate-50 shadow-inner" : "hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={cn("w-6 h-6 rounded-md flex items-center justify-center transition-all", openMenuSection === 'export' ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500")}>
                            <FileDown className="w-3 h-3" />
                          </div>
                          <p className="text-[11px] font-bold text-slate-700">Dışa Aktar</p>
                        </div>
                        <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform duration-300", openMenuSection === 'export' && "rotate-180")} />
                      </button>
                      
                      {openMenuSection === 'export' && (
                        <div className="pl-11 pr-2 py-0.5 space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                          <button
                            onClick={() => { setAddMenuOpen(false); handleExportExcel(); }}
                            className="w-full text-left px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-all flex items-center gap-1.5"
                          >
                            <FileSpreadsheet className="w-3 h-3 text-blue-500" /> Excel İndir
                          </button>
                          <button
                            onClick={() => { setAddMenuOpen(false); handleExportPDF(); }}
                            className="w-full text-left px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-all flex items-center gap-1.5"
                          >
                            <FileDown className="w-3 h-3 text-rose-500" /> PDF Liste Çıktısı
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => { 
                        setAddMenuOpen(false); 
                        setIsBulkSelecting(!isBulkSelecting);
                        setSelectedIds(new Set());
                      }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-1.5 mt-1 rounded-lg transition-all text-left group",
                        isBulkSelecting ? "bg-amber-600 text-white hover:bg-amber-700" : "bg-amber-50 hover:bg-amber-100/70 text-amber-800"
                      )}
                    >
                      <div className={cn("w-6 h-6 rounded-md flex items-center justify-center transition-all", isBulkSelecting ? "bg-white/20 text-white" : "bg-amber-600 text-white")}>
                        <CheckSquare className="w-3 h-3" />
                      </div>
                      <div className="flex-1">
                        <p className={cn("text-[10px] font-black leading-none", isBulkSelecting ? "text-white" : "text-amber-850")}>Seç/Sil Düzenleme Modu</p>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>






      {/* ── CONTENT ─────────────────────────────────────────────────────── */}

      <div 

        ref={contentScrollRef}

        className="h-[calc(100vh-360px)] min-h-[450px] overflow-y-auto bg-slate-100 border border-slate-300 shadow-sm rounded-2xl p-6 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-350 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[2.5px] [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding pb-20 flex flex-col"

      >

        {isLoading ? (

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-5">

            {[...Array(8)].map((_, i) => <ProductSkeleton key={i} />)}

          </div>

        ) : filtered.length === 0 ? (

          <div className="flex flex-col items-center justify-center py-40 text-center">

            <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-5">

              <Package className="w-10 h-10 text-slate-300" />

            </div>

            <h3 className="text-lg font-bold text-slate-700">Ürün bulunamadı</h3>

            <p className="text-sm text-slate-400 mt-1 max-w-xs">

              Arama veya filtre kriterlerinizi değiştirin ya da yeni ürün ekleyin.

            </p>

          </div>

        ) : (



        /* ── GRID / LIST ────────────────────────────────────────────────── */

        <div key={viewMode}>

          <div className="space-y-4">

            {viewMode === 'grid' ? (

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-2">

                {paginatedItems.map(p => (

                  <ProductCard

                    key={p.id}

                    product={p}

                    variants={variantMap[p.id] || []}

                    catName={catName}

                    palette={palette}

                    isSelected={selectedIds.has(p.id)}

                    isBulkSelecting={isBulkSelecting}

                    onToggleSelect={(id: string) => {

                      const next = new Set(selectedIds);

                      if (next.has(id)) next.delete(id); else next.add(id);

                      setSelectedIds(next);

                    }}

                    actionMenu={actionMenu}

                    setActionMenu={setActionMenu}

                    actionMenuRef={actionMenuRef}

                    openEdit={openEdit}

                    openHistory={openHistory}

                    setForm={setForm}

                    setShowPanel={setShowPanel}

                    setEditTarget={setEditTarget}

                    setIsEdit={setIsEdit}

                    setLabelTarget={setLabelTarget}

                    setShowLabelModal={setShowLabelModal}

                    handleDelete={handleDelete}

                    isDragging={draggedProductId === p.id}

                    isDragOver={dragOverProductId === p.id}

                    onDragStart={() => setDraggedProductId(p.id)}

                    onDragOver={(e: any) => { e.preventDefault(); setDragOverProductId(p.id); }}

                    onDrop={() => {

                      if (draggedProductId && draggedProductId !== p.id) {

                        const items = [...products];

                        const fromIdx = items.findIndex(x => x.id === draggedProductId);

                        const toIdx = items.findIndex(x => x.id === p.id);

                        const [moved] = items.splice(fromIdx, 1);

                        items.splice(toIdx, 0, moved);

                        setProducts(items);

                      }

                      setDraggedProductId(null);

                      setDragOverProductId(null);

                    }}

                    onDragEnd={() => { setDraggedProductId(null); setDragOverProductId(null); }}

                    load={load}

                    searchString={debouncedSearch}

                  />

                ))}

              </div>

            ) : (

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mt-4">

                <table className="w-full border-collapse">

                  <thead>

                    <tr className="bg-slate-50/70 border-b border-slate-100/80 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">

                       <th className="w-[40px] pl-6 pr-2 py-4 text-center">#</th>

                       <th className="w-[60px] pl-2 pr-4 py-4 text-left">GÖRSEL</th>

                       <th className="py-4 px-4 w-[20%] text-left">ÜRÜN TANIMI</th>

                       <th className="py-4 px-4 w-[16%] text-left">BARKOD</th>

                       <th className="py-4 px-4 w-[12%] text-left">KATEGORİ</th>

                       <th className="py-4 px-4 w-[8%] text-center">SEÇENEK</th>

                       <th className="py-4 px-4 w-[12%] text-right">FİYATLAR</th>

                       <th className="py-4 px-3 w-[6%] text-center">KDV</th>

                       <th className="py-4 px-4 w-[11%] text-right">KAZANÇ</th>

                       <th className="py-4 px-4 w-[10%] text-right">MİKTAR</th>

                       <th className="w-[80px] py-4 pl-4 pr-6 text-right">İŞLEM</th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-50">

                    {paginatedItems.map(p => (

                      <ProductListRow

                        key={p.id}

                        product={p}

                        variants={variantMap[p.id] || []}

                        catName={catName}

                        isSelected={selectedIds.has(p.id)}

                        isBulkSelecting={isBulkSelecting}

                        onToggleSelect={() => {

                          const next = new Set(selectedIds);

                          if (next.has(p.id)) next.delete(p.id); else next.add(p.id);

                          setSelectedIds(next);

                        }}

                        openEdit={openEdit}

                        handleDelete={handleDelete}

                        isDragging={draggedProductId === p.id}

                        isDragOver={dragOverProductId === p.id}

                        onDragStart={() => setDraggedProductId(p.id)}

                        onDragOver={(e: any) => { e.preventDefault(); setDragOverProductId(p.id); }}

                        onDrop={() => {

                          if (draggedProductId && draggedProductId !== p.id) {

                            const items = [...products];

                            const fromIdx = items.findIndex(x => x.id === draggedProductId);

                            const toIdx = items.findIndex(x => x.id === p.id);

                            const [moved] = items.splice(fromIdx, 1);

                            items.splice(toIdx, 0, moved);

                            setProducts(items);

                          }

                          setDraggedProductId(null);

                          setDragOverProductId(null);

                        }}

                        onDragEnd={() => { setDraggedProductId(null); setDragOverProductId(null); }}

                        onCopy={triggerCopyToast}

                      />

                    ))}

                  </tbody>

                </table>

              </div>

            )}



          </div>



          {/* Pagination Controls */}

          {totalPages > 1 && (

            <div className="flex items-center justify-center gap-2 pt-8 pb-12">

              <button

                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}

                disabled={currentPage === 1}

                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"

              >

                Geri

              </button>

              

              <div className="flex items-center gap-1.5 px-3">

                {[...Array(totalPages)].map((_, i) => {

                  const p = i + 1;

                  // Sadece aktif sayfanın etrafındaki birkaç sayfayı göster (Sayfa sayısı çoksa)

                  if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {

                    if (p === 2 || p === totalPages - 1) return <span key={p} className="text-slate-300">...</span>;

                    return null;

                  }

                  return (

                    <button

                      key={p}

                      onClick={() => { setCurrentPage(p); contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}

                      className={cn(

                        "w-9 h-9 rounded-lg text-xs font-black transition-all",

                        currentPage === p 

                          ? "bg-slate-900 text-white shadow-lg shadow-slate-200 scale-110" 

                          : "text-slate-400 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200"

                      )}

                    >

                      {p}

                    </button>

                  );

                })}

              </div>



              <button

                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}

                disabled={currentPage === totalPages}

                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"

              >

                İleri

              </button>

            </div>

          )}

        </div>

      )}

      </div>



      {/* ── ADD/EDIT PRODUCT MODAL ─────────────────────────────────────── */}

      {showPanel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={() => setShowPanel(false)} 
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-[1150px] bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-98 slide-in-from-top-4 duration-300 ease-out overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between pl-6 pr-4 py-5.5 bg-slate-900 rounded-t-2xl relative overflow-hidden border-b border-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white shadow-inner">
                  {isEdit 
                    ? <Edit className="w-4 h-4 text-indigo-400" /> 
                    : <Package className="w-4 h-4 text-emerald-400" />
                  }
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">{isEdit ? 'Ürün Düzenle' : 'Yeni Ürün Kaydı'}</h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Ürün bilgilerini düzenleyin ve kaydedin</p>
                </div>
              </div>
              <button
                onClick={() => setShowPanel(false)}
                className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Floating Error Banner (Clean Toast Style) */}
            {formError && (
              <div className="absolute top-16 left-0 right-0 mx-auto w-max max-w-[90%] z-[110] px-4.5 py-2.5 rounded-full bg-rose-600 text-white flex items-center gap-2 shadow-lg shadow-rose-600/30 border border-rose-500/20 animate-in fade-in slide-in-from-top-2 duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-white" />
                <span className="text-xs font-semibold tracking-tight leading-none">{formError}</span>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="ml-2.5 p-0.5 hover:bg-white/10 rounded-full transition duration-150 flex items-center justify-center shrink-0"
                  title="Kapat"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 bg-slate-100/75 custom-scrollbar" onKeyDown={handleKeyDown}>
              <div className="grid grid-cols-12 gap-5 h-full items-start">

                {/* Left Column: Kimlik + Fiyat/Stok */}
                <div className="col-span-12 md:col-span-5 space-y-4">
                  
                  {/* Bölüm 1: Ürün Kimliği */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-1">
                      <Package className="w-4 h-4 text-slate-500" />
                      <h4 className="text-xs font-bold text-black uppercase tracking-wider">Ürün Kimliği</h4>
                    </div>
                    
                    <div className="space-y-3.5">
                      {/* Ürün Adı */}
                      <div>
                        <label className="text-[10px] font-semibold text-black uppercase tracking-wider mb-1.5 block">Ürün Adı *</label>
                        <input
                          autoFocus
                          value={form.name}
                          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                          list="product-name-list"
                          placeholder="Ürün adını girin..."
                          className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-sm bg-white text-slate-900 font-bold focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all placeholder-slate-500"
                        />
                        <datalist id="product-name-list">
                          {products
                            .filter(p => !p.parent_id && p.name.toLowerCase().startsWith(form.name.toLowerCase()) && form.name.length >= 2)
                            .slice(0, 5)
                            .map(p => <option key={p.id} value={p.name} />)
                          }
                        </datalist>
                      </div>

                      {/* Marka + Kategori */}
                      <div className="grid grid-cols-2 gap-3">
                        <SmartCombobox
                          value={form.brand}
                          options={brandList}
                          onValueChange={(value) => setForm(f => ({ ...f, brand: value }))}
                          onCreateNew={(name) => setForm(f => ({ ...f, brand: name }))}
                          placeholder="Marka seçin..."
                          label="Marka"
                        />
                        <SmartCombobox
                          value={(categories.find(c => c.id === form.category)?.name || form.category) || ""}
                          options={categories}
                          onValueChange={(value, id) => {
                            if (id) {
                              setForm(f => ({ ...f, category: id }));
                            } else {
                              setForm(f => ({ ...f, category: value }));
                            }
                          }}
                          onCreateNew={async (name) => {
                            try {
                              const newCat = await inventoryApi.createCategory({ name, description: '' });
                              setCategories([...categories, newCat]);
                              setForm(f => ({ ...f, category: newCat.id }));
                            } catch (error) {
                              console.error('Kategori oluşturma hatası:', error);
                              alert('Kategori oluşturulurken bir hata oluştu.');
                            }
                          }}
                          onDelete={async (catId: string) => {
                            try {
                              const categoryProducts = products.filter(p => p.category_id === catId && !p.parent_id);
                              if (categoryProducts.length > 0) {
                                alert(`Bu kategoride ${categoryProducts.length} ürün var. Lütfen önce ürünleri taşıyın.`);
                                return;
                              }
                              if (confirm('Kategoriyi silmek istediğinize emin misiniz?')) {
                                  await inventoryApi.deleteCategory(catId);
                                  setCategories(categories.filter(c => c.id !== catId));
                                  if (form.category === catId) {
                                    setForm(f => ({ ...f, category: '' }));
                                  }
                              }
                            } catch (error) {
                              console.error('Kategori silme hatası:', error);
                              alert('Kategori silinirken bir hata oluştu.');
                            }
                          }}
                          placeholder="Seçin..."
                          label="Kategori *"
                        />
                      </div>

                      {/* Barkod + Birim */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-semibold text-black uppercase tracking-wider mb-1.5 block">Barkod</label>
                          <div className="flex gap-1.5">
                            <input
                              value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                              className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm font-mono bg-white text-slate-900 font-bold focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all min-w-0 placeholder-slate-500"
                              placeholder="Otomatik..."
                            />
                            <button onClick={genBarcode} className="shrink-0 h-10 w-10 bg-slate-900 rounded-lg hover:bg-slate-800 transition text-white flex items-center justify-center active:scale-95 shadow-sm" title="Çakışmayan Barkod Üret">
                              <Tag className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-black uppercase tracking-wider mb-1.5 block">Birim</label>
                          <select
                            value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white text-slate-900 font-bold focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all"
                          >
                            {['adet', 'kg', 'gram', 'litre', 'ml', 'paket', 'kutu', 'çift'].map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bölüm 2: Fiyat ve Stok */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-1">
                      <Wallet className="w-4 h-4 text-slate-500" />
                      <h4 className="text-xs font-bold text-black uppercase tracking-wider">Fiyat ve Stok</h4>
                    </div>
                    
                    <div className="space-y-3.5">
                      {/* Alış & Net Satış */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-semibold text-black uppercase tracking-wider mb-1.5 block">Alış Fiyatı (Net)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₺</span>
                            <input
                              type="number" value={form.buyPrice} onChange={e => setForm(f => ({ ...f, buyPrice: e.target.value }))}
                              className="w-full h-10 pl-6 pr-3 rounded-lg border border-slate-200 text-sm font-bold bg-white text-slate-900 focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all placeholder-slate-550"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-black uppercase tracking-wider mb-1.5 block">Net Satış *</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₺</span>
                            <input
                              type="number"
                              value={form.sellPrice}
                              onChange={e => setForm(f => ({ ...f, sellPrice: e.target.value }))}
                              className="w-full h-10 pl-6 pr-3 rounded-lg border border-slate-200 text-sm font-bold bg-white text-slate-900 focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all placeholder-slate-550"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Rozet Hesaplamaları */}
                      {form.sellPrice && parseFloat(form.sellPrice) > 0 && (
                        <div className="flex items-center gap-2.5 flex-wrap">
                          {(() => {
                            const net = parseFloat(form.sellPrice) || 0;
                            const buy = parseFloat(form.buyPrice) || 0;
                            const rate = parseFloat(form.tax_rate) || 0;
                            const kdv = net * rate / 100;
                            const total = net + kdv;
                            const profit = net - buy;
                            const margin = buy > 0 ? (((net - buy) / buy) * 100).toFixed(1) : null;
                            return (
                              <>
                                <span className="text-[9px] text-slate-500 font-medium">KDV (%{rate}): <span className="font-bold text-slate-700">₺{kdv.toFixed(2)}</span></span>
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                  Müşteri Öder: ₺{total.toFixed(2)}
                                </span>
                                {margin && (
                                  <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                    Kar: %{margin}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* KDV Oranı + Başlangıç Stok + Kritik Stok */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-black uppercase tracking-wider mb-1.5 block">KDV</label>
                          <select
                            value={String(form.tax_rate)}
                            onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))}
                            className="w-full h-10 px-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-900 font-bold focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all"
                          >
                            {['20', '18', '10', '8', '1', '0'].map(v => (
                              <option key={v} value={v}>%{v}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-black uppercase tracking-wider mb-1.5 block">Stok</label>
                          <input
                            type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                            className="w-full h-10 px-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-900 font-bold focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all text-center"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-black uppercase tracking-wider mb-1.5 block">Kritik</label>
                          <input
                            type="number" value={form.criticalStock} onChange={e => setForm(f => ({ ...f, criticalStock: e.target.value }))}
                            className="w-full h-10 px-2 rounded-lg border border-slate-200 text-sm bg-white text-slate-900 font-bold focus:border-black focus:ring-4 focus:ring-black/10 outline-none transition-all text-center"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Right Column: Varyantlar */}
                <div className="col-span-12 md:col-span-7 h-full flex flex-col">
                  
                  {/* Bölüm 3: Varyantlar */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm flex flex-col h-full min-h-[460px]">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 mb-1 shrink-0">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-500" />
                        <h4 className="text-xs font-bold text-black uppercase tracking-wider">Varyantlar (Beden / Renk)</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const sizes = ['XS','S','M','L','XL','2XL','3XL'];
                          const existing = new Set(formVariants.map((v: any) => v.size));
                          const toAdd = sizes.filter(s => !existing.has(s));
                          if (toAdd.length === 0) return;
                          setFormVariants((prev: any[]) => [...prev, ...toAdd.map(s => ({ size: s, color: '', stock_quantity: 0, barcode: '' }))]);
                        }}
                        className="text-[9px] font-bold text-indigo-600 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 transition-all border border-indigo-100 shadow-sm active:scale-95 duration-200"
                      >
                        <Zap className="w-3 h-3" /> TÜM BEDENLERİ EKLE
                      </button>
                    </div>

                    {/* Ekleme satırı */}
                    <div className="grid grid-cols-[1fr_1fr_64px_1fr_auto] gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 shrink-0">
                      {/* Beden */}
                      <div className="relative size-select-container">
                        <input
                          type="text"
                          value={newOption.size}
                          onFocus={() => setSizeOpen(true)}
                          onChange={e => {
                            setNewOption(o => ({ ...o, size: e.target.value }));
                            if (formError === 'Beden veya renk giriniz.') setFormError(null);
                            setSizeOpen(true);
                          }}
                          placeholder="Beden"
                          className="w-full h-9 px-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 focus:border-slate-900 outline-none bg-white transition-all shadow-sm placeholder-slate-500"
                        />
                        {sizeOpen && (
                          <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg custom-scrollbar">
                            {['XS','S','M','L','XL','2XL','3XL','36','37','38','39','40','41','42','43','44','45','Standart']
                              .filter(s => s.toLowerCase().includes(newOption.size.toLowerCase()))
                              .map(s => (
                                <button
                                  key={s}
                                  type="button"
                                  onMouseDown={() => {
                                    setNewOption(o => ({ ...o, size: s }));
                                    if (formError === 'Beden veya renk giriniz.') setFormError(null);
                                    setSizeOpen(false);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-800"
                                >
                                  {s}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                      {/* Renk */}
                      <div className="relative color-select-container">
                        <input
                          type="text"
                          value={newOption.color}
                          onFocus={() => setColorOpen(true)}
                          onChange={e => {
                            setNewOption(o => ({ ...o, color: e.target.value }));
                            if (formError === 'Beden veya renk giriniz.') setFormError(null);
                            setColorOpen(true);
                          }}
                          placeholder="Renk"
                          className="w-full h-9 px-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 focus:border-slate-900 outline-none bg-white transition-all shadow-sm placeholder-slate-500"
                        />
                        {colorOpen && (
                          <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg custom-scrollbar">
                            {['Siyah','Beyaz','Gri','Lacivert','Mavi','Kırmızı','Yeşil','Sarı','Turuncu','Pembe','Mor','Kahverengi']
                              .filter(c => c.toLowerCase().includes(newOption.color.toLowerCase()))
                              .map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  onMouseDown={() => {
                                    setNewOption(o => ({ ...o, color: c }));
                                    if (formError === 'Beden veya renk giriniz.') setFormError(null);
                                    setColorOpen(false);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 hover:bg-slate-55 transition-colors text-xs font-bold text-slate-800"
                                >
                                  {c}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                      {/* Stok */}
                      <input
                        type="number"
                        value={newOption.stock}
                        onChange={e => setNewOption(o => ({ ...o, stock: e.target.value }))}
                        placeholder="Stok"
                        className="h-9 px-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 focus:border-slate-900 outline-none bg-white text-center shadow-sm placeholder-slate-500"
                      />
                      {/* Barkod */}
                      <div className="flex gap-1">
                        <input
                          value={newOption.barcode}
                          onChange={e => setNewOption(o => ({ ...o, barcode: e.target.value }))}
                          placeholder="Barkod"
                          className="w-full h-9 px-2 rounded-lg border border-slate-200 text-[10px] font-mono text-slate-900 font-semibold focus:border-slate-900 outline-none bg-white min-w-0 shadow-sm placeholder-slate-500"
                        />
                        <button
                          type="button"
                          onClick={() => setNewOption(o => ({ ...o, barcode: generateUniqueBarcode() }))}
                          className="h-9 w-9 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition duration-150 shrink-0 active:scale-95 flex items-center justify-center border border-slate-300/30"
                          title="Barkod üret"
                        >
                          <Tag className="w-3 h-3 text-slate-600" />
                        </button>
                      </div>
                      {/* Ekle */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          if (!newOption.size && !newOption.color) { setFormError('Beden veya renk giriniz.'); return; }
                          setFormVariants((prev: any[]) => [...prev, {
                            size: newOption.size,
                            color: newOption.color,
                            stock_quantity: parseInt(newOption.stock) || 0,
                            barcode: newOption.barcode || '',
                          }]);
                          setNewOption({ size: '', color: '', barcode: '', stock: '0' });
                          setFormError(null);
                        }}
                        className="h-9 px-3 rounded-lg bg-slate-950 text-white text-[10px] font-bold hover:bg-slate-900 transition-all duration-150 flex items-center justify-center gap-1 active:scale-95 shadow-sm"
                      >
                        <Plus className="w-3 h-3" /> EKLE
                      </button>
                    </div>

                    {/* Varyant tablosu */}
                    <div className="flex-1 min-h-0 mt-3 overflow-hidden flex flex-col">
                      {formVariants.length > 0 ? (() => {
                        const COLOR_HEX: Record<string,string> = {
                          'Siyah':'#1f2937','Beyaz':'#f9fafb','Gri':'#9ca3af','Lacivert':'#1e3a5f',
                          'Mavi':'#3b82f6','Kırmızı':'#ef4444','Yeşil':'#22c55e','Sarı':'#eab308',
                          'Turuncu':'#f97316','Pembe':'#ec4899','Mor':'#a855f7','Kahverengi':'#92400e',
                        };
                        const totalStock = formVariants.reduce((s: number, v: any) => s + (v.stock_quantity || 0), 0);
                        return (
                          <div className="border border-slate-200/50 rounded-xl bg-white overflow-hidden shadow-sm h-full flex flex-col min-h-[200px]">
                            <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 border-b border-slate-100 shrink-0">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{formVariants.length} Varyant</span>
                              <span className="text-[9px] font-bold text-slate-500 font-semibold">Toplam: <span className="text-slate-800 font-bold">{totalStock}</span></span>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                              <table className="w-full text-[10px]">
                                <thead className="border-b border-slate-100 bg-slate-50/30 sticky top-0 z-10">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-[9px] font-bold text-slate-400 uppercase w-[18%]">Beden</th>
                                    <th className="px-3 py-2 text-left text-[9px] font-bold text-slate-400 uppercase w-[22%]">Renk</th>
                                    <th className="px-3 py-2 text-center text-[9px] font-bold text-slate-400 uppercase w-[12%]">Stok</th>
                                    <th className="px-3 py-2 text-left text-[9px] font-bold text-slate-400 uppercase">Barkod</th>
                                    <th className="px-3 py-2 text-center text-[9px] font-bold text-slate-400 uppercase w-[8%]">Web</th>
                                    <th className="w-8" />
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {formVariants.map((v: any, i: number) => {
                                    const stockQty = v.stock_quantity ?? 0;
                                    const stockColor = stockQty === 0 ? 'text-red-600 font-bold' : stockQty <= 3 ? 'text-amber-600 font-bold' : 'text-slate-800 font-bold';
                                    const hexColor = COLOR_HEX[v.color] || null;
                                    return (
                                      <tr key={i} className="hover:bg-slate-50/70 group transition-colors duration-105">
                                        <td className="px-3 py-1">
                                          <div className="flex items-center gap-1">
                                            {v.size && (
                                              <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded text-[9px] font-bold leading-none shrink-0">
                                                {v.size}
                                              </span>
                                            )}
                                            <input
                                              list="size-datalist-edit"
                                              className="flex-1 min-w-0 bg-transparent border border-transparent focus:border-slate-200 focus:bg-slate-50 rounded px-1 py-0.5 font-bold text-black outline-none text-[10px]"
                                              value={v.size || ''}
                                              placeholder="Beden..."
                                              onChange={(e) => { const nv = [...formVariants]; nv[i] = { ...nv[i], size: e.target.value }; setFormVariants(nv); }}
                                            />
                                            <datalist id="size-datalist-edit">
                                              {['XS','S','M','L','XL','2XL','3XL','36','37','38','39','40','41','42','43','44','45'].map(s => <option key={s} value={s} />)}
                                            </datalist>
                                          </div>
                                        </td>
                                        <td className="px-3 py-1">
                                          <div className="flex items-center gap-1">
                                            {hexColor && (
                                              <span
                                                className="w-3 h-3 rounded-full border border-slate-200 shrink-0"
                                                style={{ backgroundColor: hexColor }}
                                              />
                                            )}
                                            <input
                                              list="color-datalist-edit"
                                              className="flex-1 min-w-0 bg-transparent border border-transparent focus:border-slate-200 focus:bg-slate-50 rounded px-1 py-0.5 text-black font-bold outline-none text-[10px]"
                                              value={v.color || ''}
                                              placeholder="Renk..."
                                              onChange={(e) => { const nv = [...formVariants]; nv[i] = { ...nv[i], color: e.target.value }; setFormVariants(nv); }}
                                            />
                                            <datalist id="color-datalist-edit">
                                              {['Siyah','Beyaz','Gri','Lacivert','Mavi','Kırmızı','Yeşil','Sarı','Turuncu','Pembe','Mor','Kahverengi'].map(c => <option key={c} value={c} />)}
                                            </datalist>
                                          </div>
                                        </td>
                                        <td className="px-3 py-1 text-center">
                                          <input
                                            type="number"
                                            className={cn("w-full bg-transparent border border-transparent focus:border-slate-200 focus:bg-slate-50 rounded px-1 py-0.5 text-center outline-none text-[10px]", stockColor)}
                                            value={stockQty}
                                            onChange={(e) => { const nv = [...formVariants]; nv[i] = { ...nv[i], stock_quantity: parseInt(e.target.value) || 0 }; setFormVariants(nv); }}
                                          />
                                        </td>
                                        <td className="px-3 py-1">
                                          <div className="flex items-center gap-1">
                                            <input
                                              className="w-full bg-transparent border border-transparent focus:border-slate-200 focus:bg-slate-50 rounded px-1 py-0.5 font-mono text-[9px] text-black font-bold outline-none"
                                              value={v.barcode || ''}
                                              placeholder="—"
                                              onChange={(e) => { const nv = [...formVariants]; nv[i] = { ...nv[i], barcode: e.target.value }; setFormVariants(nv); }}
                                            />
                                            <button
                                              type="button"
                                              onClick={() => { const nv = [...formVariants]; nv[i] = { ...nv[i], barcode: generateUniqueBarcode() }; setFormVariants(nv); }}
                                              className="p-0.5 text-slate-800 hover:text-black transition shrink-0"
                                              title="Barkod üret"
                                            >
                                              <Tag className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </td>
                                        <td className="px-3 py-1 text-center">
                                          <button
                                            type="button"
                                            onClick={() => { const nv = [...formVariants]; nv[i] = { ...nv[i], marketplaceStatus: nv[i].marketplaceStatus === 'active' ? 'passive' : 'active' }; setFormVariants(nv); }}
                                            className={cn("p-1 rounded transition-all", v.marketplaceStatus === 'active' ? "text-emerald-600 bg-emerald-50" : "text-slate-600 hover:text-black")}
                                            title={v.marketplaceStatus === 'active' ? 'Online aktif' : 'Online pasif'}
                                          >
                                            <Globe className="w-3 h-3" />
                                          </button>
                                        </td>
                                        <td className="px-2 py-1 text-center">
                                          <button
                                            type="button"
                                            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-600 transition-all"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              setFormVariants((fv: any[]) => fv.filter((_, idx) => idx !== i));
                                              if (v.id) setDeletedVariants((d: string[]) => [...d, v.id]);
                                            }}
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                              <p className="text-[9px] text-slate-400 font-medium">Stoklar ayrı takip edilir</p>
                              {formVariants.some((v: any) => !v.stock_quantity || v.stock_quantity === 0) && (
                                <span className="text-[9px] font-semibold text-red-500 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> Stoğu 0 olan varyant var
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })() : (
                        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-6 text-center text-slate-400 min-h-[220px]">
                          <Package className="w-8 h-8 text-slate-300 mb-2" />
                          <p className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">Henüz seçenek eklenmedi</p>
                          <p className="text-[9px] text-slate-400 mt-1 max-w-[200px]">Beden veya renk bazında stok takibi yapmak için yukarıdan seçenek ekleyebilirsiniz.</p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50 rounded-b-2xl shrink-0">
              <button
                onClick={() => setShowPanel(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-100 hover:text-slate-700 transition-all active:scale-95"
              >
                İptal
              </button>

              {isEdit ? (
                <button
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70 shadow-sm hover:shadow"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'KAYDET'}
                </button>
              ) : (
                <button
                  onClick={() => handleSave(true)}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-orange-600 text-white font-bold text-xs hover:bg-orange-700 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-70 shadow-orange-600/10 shadow-lg hover:shadow-orange-600/20"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                    <>
                      KAYDET VE DEVAM ET
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}
      {showInvoice && (

        <QuickInvoiceAddModal

          isOpen={showInvoice}

          onClose={() => setShowInvoice(false)}

          onCompleted={async () => { setShowInvoice(false); await load(); }}

          categories={categories}

          selectedCategoryId={catFilter !== 'all' ? catFilter : null}

        />

      )}











      {/* ── FORMAL DELETE CONFIRM MODAL ────────────────────────── */}

      {showBulkDeleteConfirm && (

        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">

          <div 

            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 

            onClick={() => !isDeleting && setShowBulkDeleteConfirm(false)} 

          />

          <div className="relative bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-200">

            <div className="p-6">

              <div className="flex items-center gap-4 mb-4">

                <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-red-600 shrink-0 border border-red-100">

                  <Trash2 className="w-5 h-5" />

                </div>

                <div>

                  <h3 className="text-base font-bold text-slate-900">İşlemi Onaylayın</h3>

                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Kalıcı Silme İşlemi</p>

                </div>

              </div>

              

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 mb-6">

                <p className="text-xs text-slate-600 leading-relaxed">

                  Seçili <span className="font-bold text-slate-900">{selectedIds.size}</span> ürün ve bunlara bağlı tüm varyantlar sistemden kalıcı olarak silinecektir. Bu işlem geri alınamaz.

                </p>

              </div>



              <div className="flex gap-3">

                <button 

                  onClick={() => setShowBulkDeleteConfirm(false)}

                  disabled={isDeleting}

                  className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50"

                >

                  Vazgeç

                </button>

                <button 

                  onClick={handleBatchDelete}

                  disabled={isDeleting}

                  className="flex-1 py-2.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 shadow-red-200"

                >

                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'SİLMEYİ ONAYLA'}

                </button>

              </div>

            </div>

          </div>

        </div>

      )}



      {/* ── CATEGORY DELETE CONFIRM MODAL ────────────────────────── */}

      {showCatDeleteConfirm && catToDelete && (

        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">

          <div 

            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 

            onClick={() => setShowCatDeleteConfirm(false)} 

          />

          <div className="relative bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-200">

            <div className="p-7">

              <div className="flex items-center gap-4 mb-6">

                <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 shrink-0 border border-rose-100">

                  <Package className="w-6 h-6" />

                </div>

                <div>

                  <h3 className="text-base font-black text-slate-900 tracking-tight">Kategoriyi Sil</h3>

                  <p className="text-[10px] text-rose-500 font-black uppercase tracking-widest mt-0.5">Dikkat: Kritik İşlem</p>

                </div>

              </div>

              

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-6">

                <p className="text-xs text-slate-600 leading-relaxed font-medium">

                  <span className="font-black text-slate-900">"{catToDelete.name}"</span> kategorisini silmek istediğinizden emin misiniz? Bu işlem sadece kategoriyi siler, içerisindeki ürünler "Genel" kategorisine aktarılmaz.

                </p>

              </div>



              <div className="flex gap-3">

                <button 

                  onClick={() => setShowCatDeleteConfirm(false)}

                  className="flex-1 py-3 text-xs font-black text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all active:scale-[0.98]"

                >

                  VAZGEÇ

                </button>

                <button 

                  onClick={confirmCategoryDelete}

                  className="flex-1 py-3 text-xs font-black text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 active:scale-[0.98]"

                >

                  SİLMEYİ ONAYLA

                </button>

              </div>

            </div>

          </div>

        </div>

      )}



      {/* ── PRODUCT DELETE CONFIRM MODAL ────────────────────────── */}

      {showProductDeleteConfirm && productToDelete && (

        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">

          <div 

            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 

            onClick={() => setShowProductDeleteConfirm(false)} 

          />

          <div className="relative bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-200">

            <div className="p-7">

              <div className="flex items-center gap-4 mb-6">

                <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 shrink-0 border border-rose-100">

                  <Trash2 className="w-6 h-6" />

                </div>

                <div>

                  <h3 className="text-base font-black text-slate-900 tracking-tight">Ürünü Sil</h3>

                  <p className="text-[10px] text-rose-500 font-black uppercase tracking-widest mt-0.5">Kalıcı Veri Silme</p>

                </div>

              </div>

              

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-6">

                <p className="text-xs text-slate-600 leading-relaxed font-medium">

                  <span className="font-black text-slate-900">"{productToDelete.name}"</span> isimli ürünü ve tüm varyantlarını silmek üzeresiniz. Bu işlem geri alınamaz.

                </p>

              </div>



              <div className="flex gap-3">

                <button 

                  onClick={() => setShowProductDeleteConfirm(false)}

                  className="flex-1 py-3 text-xs font-black text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all active:scale-[0.98]"

                >

                  VAZGEÇ

                </button>

                <button 

                  onClick={confirmProductDelete}

                  className="flex-1 py-3 text-xs font-black text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 active:scale-[0.98]"

                >

                  SİLMEYİ ONAYLA

                </button>

              </div>

            </div>

          </div>

        </div>

      )}



      {/* ── HISTORY MODAL ──────────────────────────────────────────────── */}
      {historyTarget && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 font-sans">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setHistoryTarget(null)} />

          <div className="relative bg-white rounded-2xl w-full max-w-md shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200 border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                <History className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <h3 className="text-xs font-black text-black tracking-wider uppercase leading-none">Hareket Geçmişi</h3>
                  <span className="text-[10px] font-black text-black truncate mt-1">{historyTarget.name}</span>
                </div>
              </div>
              <button 
                onClick={() => setHistoryTarget(null)} 
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-650 transition-all active:scale-95 shrink-0"
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              {historyData.length === 0 ? (
                <div className="py-16 text-center">
                  <Clock className="w-7 h-7 text-slate-350 mx-auto mb-3 opacity-60" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Stok hareketi bulunmuyor</p>
                </div>
              ) : (
                <div className="relative pl-3.5 border-l border-slate-100 space-y-5 ml-1">
                  {historyData.map((h, i) => (
                    <div key={i} className="relative group">
                      {/* Timeline Bullet */}
                      <div className={cn(
                        "absolute -left-[19.5px] top-1.5 w-2 h-2 rounded-full ring-[3px] bg-white transition-all",
                        h.quantity_change > 0 ? "ring-emerald-100 bg-emerald-600" : "ring-red-100 bg-red-650"
                      )} />
                      
                      {/* Details */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-black text-slate-950 font-black uppercase tracking-tight leading-none">{h.reason}</span>
                            <span className="text-[9px] font-black text-slate-950">{new Date(h.created_at).toLocaleDateString('tr-TR')} {new Date(h.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-[10px] text-slate-950 mt-1 leading-normal">{h.notes || 'Açıklama belirtilmedi.'}</p>
                        </div>
                        <div className={cn(
                          "px-2 py-0.5 rounded text-[9.5px] font-black shrink-0 tabular-nums uppercase tracking-wider",
                          h.quantity_change > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        )}>
                          {h.quantity_change > 0 ? `+${h.quantity_change}` : h.quantity_change}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {/* ── LABEL MODAL ────────────────────────────────────────────────── */}
      {showLabelModal && (
        <div className="fixed inset-0 z-[10003] flex items-center justify-center p-4 font-sans">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #print-area, #print-area * {
                visibility: visible !important;
              }
              #print-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                display: block !important;
              }
              .print-page-layout {
                display: grid !important;
                grid-template-columns: repeat(2, 1fr) !important;
                grid-template-rows: repeat(3, 1fr) !important;
                width: 100vw !important;
                height: 100vh !important;
                page-break-after: always !important;
                break-after: page !important;
                border: none !important;
                box-shadow: none !important;
                padding: 15px !important;
                background: white !important;
              }
              .print-label-box {
                border: 1px dashed #cbd5e1 !important;
                box-shadow: none !important;
                padding: 10px !important;
                margin: 0 !important;
                background: white !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
              }
            }
          `}} />

          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={() => setShowLabelModal(false)} 
          />

          <div className="relative bg-white rounded-2xl w-full max-w-[340px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col animate-in zoom-in-95 duration-200 border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <h3 className="text-[10px] font-black text-slate-800 tracking-wider uppercase">Barkod Yazdır <span className="text-slate-400 font-bold ml-0.5">({labelTarget.length})</span></h3>
              </div>
              <button 
                onClick={() => setShowLabelModal(false)} 
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-650 transition-all active:scale-95"
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[45vh] bg-slate-50/50 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              <div id="print-area" className="flex flex-col gap-3">
                {labelChunks.map((chunk, chunkIdx) => (
                  <div key={chunkIdx} className="grid grid-cols-2 gap-2.5 p-2 bg-white border border-slate-200 rounded-xl shadow-sm print-page-layout">
                    {chunk.map(p => (
                      <div key={p.id} className="bg-white p-2.5 border border-slate-100 rounded-lg flex flex-col items-center justify-between print-label-box">
                        {/* Top: Barcode */}
                        <div className="w-full flex flex-col items-center mb-1">
                          <div className="w-full max-w-[100px] mb-0.5">
                            <BarcodeSVG value={p.barcode || p.sku || p.id} />
                          </div>
                          <span className="font-mono text-[7px] font-bold tracking-[0.12em] text-slate-400 mt-0.5">{p.barcode || p.sku || 'BARKOD YOK'}</span>
                        </div>
                        {/* Bottom: Name & Size */}
                        <div className="w-full text-center border-t border-slate-100 pt-1 mt-1 flex flex-col items-center">
                          <p className="text-[9px] font-black text-slate-800 uppercase tracking-tight line-clamp-1 leading-tight">{p.name}</p>
                          {p.size ? (
                            <div className="inline-block bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[7px] font-black mt-0.5 uppercase tracking-wider">
                              {p.size}
                            </div>
                          ) : (
                            <div className="inline-block bg-slate-50 text-slate-400 px-1 py-0.5 rounded text-[7px] font-bold mt-0.5 uppercase tracking-wider">
                              STANDART
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
 
            <div className="px-4 py-2.5 border-t border-slate-100 flex bg-white">
              <button 
                onClick={handlePrintLabels}
                className="w-full py-2 bg-slate-900 text-white rounded-lg font-black shadow-md hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] text-[9.5px] uppercase tracking-wider"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Yazdır</span>
              </button>
            </div>
          </div>
        </div>
      )}
        </div>

      </main>



      {/* Copy Toast - Centered in Content Area */}

      {/* Copy Toast - Global Root Positioned */}

      {showCopyToast && (

        <div 

          className={cn(

            "fixed inset-x-0 bottom-24 z-[100000] flex justify-center animate-in slide-in-from-bottom-3 fade-in duration-500 pointer-events-none transition-all duration-300",

            sidebarCollapsed ? "pl-20" : "pl-64"

          )}

        >

          <div className="bg-slate-900/60 backdrop-blur-xl text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2.5 border border-white/5">

             <div className="w-4 h-4 rounded-full bg-emerald-500/80 flex items-center justify-center">

                <Check className="w-2.5 h-2.5 text-white" />

             </div>

             <span className="text-[10px] font-black uppercase tracking-[0.1em] leading-none">Barkod Kopyalandı</span>

          </div>

        </div>

      )}



      {/* Bulk Action Bar - Fixed Bottom Root */}

      {isBulkSelecting && (

        <div 

          className={cn(

            "fixed inset-x-0 bottom-8 z-[99999] flex justify-center animate-in slide-in-from-bottom-5 fade-in duration-500 pointer-events-none transition-all duration-300",

            sidebarCollapsed ? "pl-20" : "pl-64"

          )}

        >

          <div className="bg-slate-900 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] px-4 py-2 flex items-center gap-3 pointer-events-auto">

            {/* Selection Count Pill */}

            <div className="flex items-center gap-2">



                <div className="h-5 w-5 flex items-center justify-center bg-amber-500 rounded-md text-slate-900 font-black text-[10px]">

                  {selectedIds.size}

                </div>

                <span className="text-[11px] font-bold text-slate-300">Ürün Seçili</span>


            </div>



            <button

              onClick={() => {

                if (selectedIds.size === filtered.length) {

                  setSelectedIds(new Set());

                } else {

                  setSelectedIds(new Set(filtered.map(p => p.id)));

                }

              }}

              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-slate-800/80 hover:bg-slate-700 active:scale-95 transition-all text-slate-300 text-[10px] font-bold pointer-events-auto border border-slate-700/60"

            >

              <CheckSquare className="w-3.5 h-3.5" />

              <span>{selectedIds.size === filtered.length ? 'Seçimi Temizle' : 'Tümünü Seç'}</span>

            </button>



            <div className="h-5 w-px bg-slate-700/50" />



            <div className="flex items-center gap-1.5">

              



              <button

onClick={() => selectedIds.size > 0 && setShowBulkBarcodeChoice(true)}

                disabled={selectedIds.size === 0 || isDeleting}

                className="flex items-center justify-center gap-1.5 h-7 px-3 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition-all border border-slate-700/60 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none"

              >

                <Printer className="w-3 h-3 text-slate-500" />

                <span className="whitespace-nowrap">Toplu Barkod Bastır</span>

              </button>



              <button

                onClick={() => setShowBulkDeleteConfirm(true)}

                disabled={selectedIds.size === 0 || isDeleting}

                className="flex items-center justify-center gap-1.5 h-7 px-3 rounded-md bg-red-500/90 hover:bg-red-500 text-white text-[10px] font-semibold transition-all active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none"

              >

                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}

                <span className="whitespace-nowrap">Toplu Sil</span>

              </button>

            </div>



            {/* Dismiss */}

            <button

              onClick={() => {

                setIsBulkSelecting(false);

                setSelectedIds(new Set());

              }}

              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-white hover:bg-slate-700 transition-all ml-1"

              title="İşlemi İptal Et"

            >

              <X className="w-4 h-4" />

            </button>

          </div>

        </div>

      )}


{/* Bulk Barcode Choice Modal */}
{showBulkBarcodeChoice && (
<div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
<div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-[320px] overflow-hidden animate-in zoom-in-95 duration-300">
<div className="px-5 py-4 border-b border-slate-100">
<h3 className="text-sm font-black text-slate-900 tracking-tight">Barkod Yazdırma Seçeneği</h3>
<p className="text-[11px] text-slate-500 mt-1">Seçili ürünlerin barkodlarını nasıl eklemek istersiniz?</p>
</div>
<div className="p-3 space-y-2">
<button
onClick={() => {
const selectedParents = filtered.filter(p => selectedIds.has(p.id));
const expandedTargets: Product[] = [];
for (const parent of selectedParents) {
const vars = products.filter(v => v.parent_id === parent.id);
if (vars.length > 0) { expandedTargets.push(...vars); } else { expandedTargets.push(parent); }
}
setLabelTarget(expandedTargets);
setShowLabelModal(true);
setShowBulkBarcodeChoice(false);
}}
className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold transition-all active:scale-[0.98]"
>
<Layers className="w-4 h-4 opacity-60" />
<div className="text-left">
<p className="leading-none">Tüm Bedenleri Ekle</p>
<span className="text-[9px] text-slate-400 font-medium">Seçili ürünlerin tüm varyantları</span>
</div>
</button>
<button
onClick={() => {
const selectedParents = filtered.filter(p => selectedIds.has(p.id));
setLabelTarget(selectedParents);
setShowLabelModal(true);
setShowBulkBarcodeChoice(false);
}}
className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800 text-[12px] font-bold transition-all border border-slate-200 active:scale-[0.98]"
>
<Package className="w-4 h-4 text-slate-400" />
<div className="text-left">
<p className="leading-none">Sadece Seçili Ürünü Ekle</p>
<span className="text-[9px] text-slate-400 font-medium">Yalnızca ana ürün barkodları</span>
</div>
</button>
</div>
<div className="px-3 pb-3">
<button
onClick={() => setShowBulkBarcodeChoice(false)}
className="w-full py-2 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-all"
>
İptal
</button>
</div>
</div>
</div>
)}

    </div>

  );

}

