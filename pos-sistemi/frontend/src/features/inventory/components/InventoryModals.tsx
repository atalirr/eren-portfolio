import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  X, Upload, Plus, Minus, CheckCircle2, Loader2, Package, Search, ChevronDown, Trash2 
} from 'lucide-react';
import { Product, Category, inventoryApi } from '../services/inventoryApi';
import { cn } from '@/shared/utils/cn';
import { getApiBaseUrl } from '@/shared/config/api.config';

// Smart Combobox Component
export function SmartCombobox({
  value,
  options,
  onValueChange,
  onDelete,
  placeholder,
  label,
  onCreateNew,
  inputRef,
  onKeyDown,
}: {
  value: string;
  options: Array<{ id?: string; name: string } | string>;
  onValueChange: (value: string, id?: string) => void;
  onDelete?: (id: string | string, e: React.MouseEvent) => void;
  placeholder: string;
  label: string;
  onCreateNew?: (name: string) => void;
  inputRef?: (el: HTMLInputElement | null) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const comboboxRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement | null>(null);

  const normalizedOptions = options.map((opt) =>
    typeof opt === 'string' ? { id: opt, name: opt } : opt
  );

  const filteredOptions = useMemo(() => {
    if (searchQuery.length < 2) return normalizedOptions;
    return normalizedOptions.filter((opt) =>
      opt.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, normalizedOptions]);

  const showCreateNew = searchQuery.length >= 2 && 
    !normalizedOptions.some(opt => opt.name.toLowerCase() === searchQuery.toLowerCase());

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setSearchQuery(inputValue);
    setIsOpen(inputValue.length >= 2);
    
    const matched = normalizedOptions.find(
      opt => opt.name.toLowerCase() === inputValue.toLowerCase()
    );
    
    if (matched) {
      onValueChange(matched.name, matched.id);
    } else {
      onValueChange(inputValue);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (isOpen && filteredOptions.length > 0) {
        handleSelect(filteredOptions[0]);
        e.preventDefault();
        return;
      } else if (isOpen && showCreateNew && onCreateNew) {
        handleCreateNew();
        e.preventDefault();
        return;
      }
    }
    if (onKeyDown) onKeyDown(e);
  };

  const handleSelect = (option: { id?: string; name: string }) => {
    onValueChange(option.name, option.id);
    setIsOpen(false);
    setSearchQuery('');
    if (internalInputRef.current) {
      internalInputRef.current.blur();
    }
  };

  const handleCreateNew = () => {
    if (onCreateNew && searchQuery.trim()) {
      onCreateNew(searchQuery.trim());
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <div className="relative" ref={comboboxRef}>
      <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <input
          ref={(el) => {
            internalInputRef.current = el;
            if (inputRef) inputRef(el);
          }}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (value.length >= 2) setIsOpen(true);
            setSearchQuery(value);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-bold text-slate-900 focus:bg-white focus:border-black focus:ring-4 focus:ring-black/10 transition-all outline-none"
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      </div>

      {isOpen && (filteredOptions.length > 0 || showCreateNew) && (
        <div className="absolute z-[100] w-full mt-2 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="max-h-64 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.id || option.name}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-100 transition-colors group text-left border-b border-slate-100 last:border-0"
                >
                  <span className="text-sm font-medium text-slate-700">{option.name}</span>
                  {onDelete && option.id && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(option.id!, e);
                      }}
                      className="p-1 text-slate-300 hover:text-red-600 rounded transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </div>
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-center">
                <p className="text-xs font-medium text-slate-400">Sonuç bulunamadı</p>
              </div>
            )}

            {showCreateNew && onCreateNew && (
              <button
                type="button"
                onClick={handleCreateNew}
                className="w-full px-3 py-2 border-t border-slate-100 text-left hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-white flex-shrink-0">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">YENİ</p>
                    <p className="text-xs font-medium text-slate-700 line-clamp-1">"{searchQuery}"</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Add Product Modal Component
export function AddProductModal({
  newProduct,
  setNewProduct,
  categories,
  brands,
  onClose,
  onSave,
  isSaving,
  fileInputRef,
  handleFileSelect,
  generateBarcode,
  onDeleteCategory,
  onDeleteBrand,
  loadData,
  isEditMode = false,
  product = null,
  products = [],
}: any) {
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | HTMLSelectElement | null }>({});
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);

  const handleKeyDown = (currentField: string, e: React.KeyboardEvent<any>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const fieldOrder = [
        'name', 'barcode', 'category', 'brand', 'size', 'unit', 
        'buyPrice', 'sellPrice', 'vat', 'stock', 'criticalStock'
      ];
      const currentIndex = fieldOrder.indexOf(currentField);
      if (currentIndex < fieldOrder.length - 1) {
        const nextField = fieldOrder[currentIndex + 1];
        inputRefs.current[nextField]?.focus();
      } else {
        const saveButton = document.querySelector('[data-save-button]') as HTMLButtonElement;
        saveButton?.focus();
      }
    }
  };

  const handleCategoryChange = async (value: string, id?: string) => {
    if (id) {
      setNewProduct({ ...newProduct, category: id, categoryName: '' });
    } else {
      setNewProduct({ ...newProduct, category: '', categoryName: value });
    }
  };

  const handleCategoryCreate = async (name: string) => {
    try {
      const newCategory = await inventoryApi.createCategory({ name, description: '' });
      setNewProduct({ ...newProduct, category: newCategory.id, categoryName: '' });
      await loadData();
    } catch (error) {
      console.error('Kategori oluşturma hatası:', error);
      alert('Kategori oluşturulurken bir hata oluştu.');
    }
  };

  const handleBrandChange = (value: string) => {
    setNewProduct({ ...newProduct, brand: value });
  };

  const handleBrandCreate = (name: string) => {
    setNewProduct({ ...newProduct, brand: name });
  };

  const categoryOptions = categories.map((cat: any) => ({ id: cat.id, name: cat.name }));
  const brandOptions = brands.map((brand: any) => ({ id: brand, name: brand }));

  const selectedCategoryName = newProduct.category
    ? categories.find((c: any) => c.id === newProduct.category)?.name || ''
    : newProduct.categoryName || '';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-500"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in slide-in-from-bottom-5 duration-500 max-h-[90vh]">
        {/* Header */}
        <div className="p-10 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
              {isEditMode ? 'ÜRÜNÜ GÜNCELLE' : 'YENİ ÜRÜN EKLE'}
            </h2>
            <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Envanterinize yeni bir üye ekleyin</p>
          </div>
          <button
            onClick={onClose}
            className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-95"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-10 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
            {/* Left Column: Core Info */}
            <div className="space-y-10">
              <section>
                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.25em] mb-6">TEMEL BİLGİLER</h4>
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">ÜRÜN ADI *</label>
                    <div className="relative">
                      <input
                        ref={(el) => (inputRefs.current['name'] = el)}
                        type="text"
                        className="w-full px-5 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                        placeholder="Örn: Nike Air Max 90"
                        value={newProduct.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewProduct({ ...newProduct, name: val });

                          // İlk 2 harften önerileri göster
                          if (val.length >= 2) {
                            const suggestions = Array.from(new Set(
                              (products as Product[])
                                .filter((p: Product) => !p.parent_id) // Parent ürünleri göster
                                .filter((p: Product) => p.name.toLowerCase().startsWith(val.toLowerCase()))
                                .map((p: Product) => p.name)
                                .slice(0, 5)
                            ));
                            setNameSuggestions(suggestions as string[]);
                            setShowNameSuggestions(suggestions.length > 0);
                          } else {
                            setShowNameSuggestions(false);
                          }
                        }}
                        onKeyDown={(e) => handleKeyDown('name', e)}
                      />

                      {/* Ürün adı önerileri dropdown'ı */}
                      {showNameSuggestions && nameSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg z-50 overflow-hidden">
                          {nameSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => {
                                setNewProduct({ ...newProduct, name: suggestion });
                                setShowNameSuggestions(false);
                              }}
                              className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-800 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">BARKOD</label>
                    <div className="flex gap-2">
                      <input
                        ref={(el) => (inputRefs.current['barcode'] = el)}
                        type="text"
                        className="flex-1 px-5 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                        placeholder="000000000000"
                        value={newProduct.barcode}
                        onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                        onKeyDown={(e) => handleKeyDown('barcode', e)}
                      />
                      <button
                        onClick={generateBarcode}
                        type="button"
                        className="px-6 py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                      >
                        ÜRET
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-2 gap-6">
                <SmartCombobox
                  value={selectedCategoryName}
                  options={categoryOptions}
                  onValueChange={handleCategoryChange}
                  onDelete={onDeleteCategory}
                  placeholder="Seç veya Yaz"
                  label="KATEGORİ *"
                  onCreateNew={handleCategoryCreate}
                  inputRef={(el) => (inputRefs.current['category'] = el)}
                  onKeyDown={(e) => handleKeyDown('category', e)}
                />
                <SmartCombobox
                  value={newProduct.brand}
                  options={brandOptions}
                  onValueChange={handleBrandChange}
                  onDelete={onDeleteBrand}
                  placeholder="Seç veya Yaz"
                  label="MARKA"
                  onCreateNew={handleBrandCreate}
                  inputRef={(el) => (inputRefs.current['brand'] = el)}
                  onKeyDown={(e) => handleKeyDown('brand', e)}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">BEDEN</label>
                  <select
                    ref={(el: any) => (inputRefs.current['size'] = el)}
                    className="w-full px-5 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none cursor-pointer"
                    value={newProduct.size}
                    onChange={(e) => setNewProduct({ ...newProduct, size: e.target.value })}
                    onKeyDown={(e) => handleKeyDown('size', e)}
                  >
                    <option value="Standart">Standart</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">BİRİM</label>
                  <select
                    ref={(el: any) => (inputRefs.current['unit'] = el)}
                    className="w-full px-5 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none cursor-pointer"
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                    onKeyDown={(e) => handleKeyDown('unit', e)}
                  >
                    <option value="adet">Adet</option>
                    <option value="kg">Kilogram</option>
                    <option value="lt">Litre</option>
                    <option value="m">Metre</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Column: Pricing & Stock */}
            <div className="space-y-10">
              <section>
                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.25em] mb-6">FİYATLANDIRMA & STOK</h4>
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">ALIŞ FİYATI (₺) *</label>
                      <input
                        ref={(el) => (inputRefs.current['buyPrice'] = el)}
                        type="number"
                        step="0.01"
                        className="w-full px-5 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                        placeholder="0.00"
                        value={newProduct.buyPrice}
                        onChange={(e) => setNewProduct({ ...newProduct, buyPrice: e.target.value })}
                        onKeyDown={(e) => handleKeyDown('buyPrice', e)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">SATIŞ FİYATI (₺) *</label>
                      <input
                        ref={(el) => (inputRefs.current['sellPrice'] = el)}
                        type="number"
                        step="0.01"
                        className="w-full px-5 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                        placeholder="0.00"
                        value={newProduct.sellPrice}
                        onChange={(e) => setNewProduct({ ...newProduct, sellPrice: e.target.value })}
                        onKeyDown={(e) => handleKeyDown('sellPrice', e)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">MEVCUT STOK</label>
                      <input
                        ref={(el) => (inputRefs.current['stock'] = el)}
                        type="number"
                        className="w-full px-5 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                        placeholder="0"
                        value={newProduct.stock}
                        onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                        onKeyDown={(e) => handleKeyDown('stock', e)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">KRİTİK LİMİT</label>
                      <input
                        ref={(el) => (inputRefs.current['criticalStock'] = el)}
                        type="number"
                        className="w-full px-5 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                        placeholder="10"
                        value={newProduct.criticalStock}
                        onChange={(e) => setNewProduct({ ...newProduct, criticalStock: e.target.value })}
                        onKeyDown={(e) => handleKeyDown('criticalStock', e)}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-1">ÜRÜN GÖRSELİ</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative border-2 border-dashed border-slate-100 rounded-[2rem] p-10 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  
                  {newProduct.image ? (
                    <div className="space-y-4">
                      <div className="relative w-40 h-40 mx-auto rounded-3xl overflow-hidden shadow-2xl">
                        <img
                          src={URL.createObjectURL(newProduct.image)}
                          alt="Önizleme"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-sm font-black text-slate-900">{newProduct.image.name}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewProduct({ ...newProduct, image: null });
                        }}
                        className="text-xs font-black text-rose-500 uppercase tracking-widest hover:text-rose-600"
                      >
                        GÖRSELİ KALDIR
                      </button>
                    </div>
                  ) : product?.image_url ? (
                    <div className="space-y-4">
                      <div className="relative w-40 h-40 mx-auto rounded-3xl overflow-hidden shadow-2xl">
                        <img
                          src={product.image_url.startsWith('http') ? product.image_url : `${getApiBaseUrl()}${product.image_url}`}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-8">YENİ GÖRSEL YÜKLEMEK İÇİN TIKLAYIN</p>
                    </div>
                  ) : (
                    <div className="py-6 space-y-4">
                      <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto group-hover:bg-indigo-100 transition-colors">
                        <Upload className="w-8 h-8 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Görsel Yükle</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">PNG, JPG (MAX 5MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-10 border-t border-slate-50 bg-white sticky bottom-0 z-10 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-5 bg-slate-50 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-[0.25em] hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95"
          >
            İPTAL
          </button>
          <button
            data-save-button
            onClick={onSave}
            disabled={isSaving}
            className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {isSaving ? (
              <><Loader2 className="w-6 h-6 animate-spin" /> İŞLENİYOR...</>
            ) : (
              <><CheckCircle2 className="w-6 h-6" /> {isEditMode ? 'DEĞİŞİKLİKLERİ KAYDET' : 'ÜRÜNÜ SİSTEME EKLE'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
