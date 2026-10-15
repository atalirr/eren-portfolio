/**
 * Personnel Page Component
 * Personel Yönetimi Sayfası
 * Modern ve profesyonel personel yönetim arayüzü
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  TrendingUp,
  Briefcase,
  X,
} from 'lucide-react';
import { PageHeader } from '@/shared/components';
import { personnelApi } from '../services/personnelApi';
import type { Employee, EmployeeCreate, EmployeeUpdate, EmployeeFinance, EmployeeStats, Advance } from '../types/personnel.types';

// Para formatı fonksiyonu
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Tarih formatı fonksiyonu
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

export function PersonnelPage() {
  // State'ler
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'finance' | 'stats'>('profile');
  
  // Modal state'leri
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  
  // Form state'leri
  const [formData, setFormData] = useState<Partial<EmployeeCreate>>({});
  const [editFormData, setEditFormData] = useState<Partial<EmployeeUpdate>>({});
  const [advanceFormData, setAdvanceFormData] = useState({ amount: 0, date: new Date().toISOString().split('T')[0], description: '' });
  
  // Detay state'leri
  const [employeeFinance, setEmployeeFinance] = useState<EmployeeFinance | null>(null);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats | null>(null);
  const [advances, setAdvances] = useState<Advance[]>([]);
  
  // Filtrelenmiş personel listesi
  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employees;
    const term = searchTerm.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.full_name.toLowerCase().includes(term) ||
        emp.username.toLowerCase().includes(term) ||
        emp.role.toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);
  
  // Personelleri yükle
  useEffect(() => {
    loadEmployees();
  }, []);
  
  // Seçili personel değiştiğinde detayları yükle
  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeDetails(selectedEmployee.id);
    }
  }, [selectedEmployee, activeTab]);
  
  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await personnelApi.getAll();
      setEmployees(data);
    } catch (error) {
      console.error('Personeller yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadEmployeeDetails = async (employeeId: string) => {
    try {
      if (activeTab === 'finance') {
        const finance = await personnelApi.getFinance(employeeId);
        setEmployeeFinance(finance);
        const advancesData = await personnelApi.getAdvances(employeeId);
        setAdvances(advancesData);
      } else if (activeTab === 'stats') {
        const stats = await personnelApi.getStats(employeeId);
        setEmployeeStats(stats);
      }
    } catch (error) {
      console.error('Personel detayları yüklenirken hata:', error);
    }
  };
  
  const handleAddEmployee = async () => {
    try {
      if (!formData.user_id || !formData.salary || !formData.bonus_rate || !formData.start_date) {
        alert('Lütfen tüm zorunlu alanları doldurun');
        return;
      }
      await personnelApi.create(formData as EmployeeCreate);
      setShowAddModal(false);
      setFormData({});
      loadEmployees();
    } catch (error: any) {
      alert('Personel eklenirken hata: ' + (error.response?.data?.detail || error.message));
    }
  };
  
  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return;
    try {
      await personnelApi.update(selectedEmployee.id, editFormData);
      setShowEditModal(false);
      setEditFormData({});
      loadEmployees();
      // Seçili personeli güncelle
      const updated = await personnelApi.getById(selectedEmployee.id);
      setSelectedEmployee(updated);
    } catch (error: any) {
      alert('Personel güncellenirken hata: ' + (error.response?.data?.detail || error.message));
    }
  };
  
  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Bu personeli pasif yapmak istediğinize emin misiniz?')) return;
    try {
      await personnelApi.delete(id);
      loadEmployees();
      if (selectedEmployee?.id === id) {
        setSelectedEmployee(null);
      }
    } catch (error: any) {
      alert('Personel silinirken hata: ' + (error.response?.data?.detail || error.message));
    }
  };
  
  const handleAddAdvance = async () => {
    if (!selectedEmployee) return;
    try {
      if (advanceFormData.amount <= 0) {
        alert('Avans tutarı 0\'dan büyük olmalıdır');
        return;
      }
      await personnelApi.addAdvance(
        selectedEmployee.id,
        advanceFormData.amount,
        advanceFormData.date,
        advanceFormData.description || undefined
      );
      setShowAdvanceModal(false);
      setAdvanceFormData({ amount: 0, date: new Date().toISOString().split('T')[0], description: '' });
      loadEmployeeDetails(selectedEmployee.id);
    } catch (error: any) {
      alert('Avans eklenirken hata: ' + (error.response?.data?.detail || error.message));
    }
  };
  
  const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
      ADMIN: 'Yönetici',
      CASHIER: 'Kasiyer',
      MANAGER: 'Müdür',
    };
    return labels[role] || role;
  };
  
  const getRoleColor = (role: string): string => {
    const colors: Record<string, string> = {
      ADMIN: 'bg-purple-100 text-purple-700',
      CASHIER: 'bg-blue-100 text-blue-700',
      MANAGER: 'bg-green-100 text-green-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans antialiased text-slate-800">
      
      <PageHeader
        title="PERSONEL VE MAAŞ TAKİBİ"
        icon={true}
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition text-[10px] font-black uppercase tracking-widest shadow-sm"
          >
            <Plus className="w-4 h-4" />
            YENİ PERSONEL
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1600px] mx-auto">
      
      {/* Ana İçerik - İki Kolonlu Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol Panel - Personel Listesi */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-400 dark:border-slate-700/80 shadow-sm">
            {/* Arama Çubuğu */}
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Personel ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* Personel Listesi */}
            <div className="p-4 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8 text-slate-500">Yükleniyor...</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-8 text-slate-500">Personel bulunamadı</div>
              ) : (
                filteredEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    onClick={() => setSelectedEmployee(employee)}
                    className={`p-4 rounded-lg border cursor-pointer transition ${
                      selectedEmployee?.id === employee.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-400 dark:border-slate-700/80 hover:border-slate-500 dark:hover:border-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{employee.full_name}</h3>
                        <p className="text-sm text-slate-500">{employee.username}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(employee.role)}`}>
                            {getRoleLabel(employee.role)}
                          </span>
                          {!employee.is_active && (
                            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
                              Pasif
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditFormData({
                              salary: employee.salary,
                              bonus_rate: employee.bonus_rate,
                              pin: employee.pin,
                              is_active: employee.is_active,
                            });
                            setShowEditModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEmployee(employee.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Sağ Panel - Detay Alanı (Tab Yapısı) */}
        <div className="lg:col-span-2">
          {selectedEmployee ? (
            <div className="bg-white rounded-xl border border-slate-400 dark:border-slate-700/80 shadow-sm">
              {/* Tab Başlıkları */}
              <div className="border-b border-slate-200">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`px-6 py-4 font-medium transition ${
                      activeTab === 'profile'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Profil
                  </button>
                  <button
                    onClick={() => setActiveTab('finance')}
                    className={`px-6 py-4 font-medium transition ${
                      activeTab === 'finance'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Finans
                  </button>
                  <button
                    onClick={() => setActiveTab('stats')}
                    className={`px-6 py-4 font-medium transition ${
                      activeTab === 'stats'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    İstatistik
                  </button>
                </div>
              </div>
              
              {/* Tab İçerikleri */}
    <div className="p-6">
                {/* Tab 1: Profil */}
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Ad Soyad</label>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          {selectedEmployee.full_name}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Kullanıcı Adı</label>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          {selectedEmployee.username}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Rol</label>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(selectedEmployee.role)}`}>
                            {getRoleLabel(selectedEmployee.role)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">PIN</label>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          {selectedEmployee.pin || 'Belirtilmemiş'}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">İşe Başlama Tarihi</label>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          {formatDate(selectedEmployee.start_date)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Durum</label>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            selectedEmployee.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {selectedEmployee.is_active ? 'Aktif' : 'Pasif'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Tab 2: Finans */}
                {activeTab === 'finance' && (
                  <div className="space-y-6">
                    {employeeFinance ? (
                      <>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <div className="flex items-center gap-2 text-blue-700 mb-2">
                              <DollarSign className="w-5 h-5" />
                              <span className="font-medium">Maaş</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-900">{formatCurrency(employeeFinance.salary)} ₺</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <div className="flex items-center gap-2 text-green-700 mb-2">
                              <TrendingUp className="w-5 h-5" />
                              <span className="font-medium">Prim Oranı</span>
                            </div>
                            <p className="text-2xl font-bold text-green-900">%{employeeFinance.bonus_rate}</p>
                          </div>
                        </div>
                        
                        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                          <div className="flex items-center gap-2 text-purple-700 mb-2">
                            <Briefcase className="w-5 h-5" />
                            <span className="font-medium">Tahmini Hakediş</span>
                          </div>
                          <p className="text-2xl font-bold text-purple-900">
                            {formatCurrency(employeeFinance.estimated_earnings || 0)} ₺
                          </p>
                          <p className="text-sm text-purple-600 mt-1">
                            = Maaş ({formatCurrency(employeeFinance.salary)} ₺) + (Satışlar ({formatCurrency(employeeFinance.total_sales || 0)} ₺) × Prim Oranı (%{employeeFinance.bonus_rate}))
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-slate-900">Avanslar</h3>
                          <button
                            onClick={() => setShowAdvanceModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          >
                            <Plus className="w-4 h-4" />
                            Avans Ekle
                          </button>
                        </div>
                        
                        <div className="space-y-2">
                          {advances.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">Henüz avans kaydı yok</div>
                          ) : (
                            advances.map((advance) => (
                              <div key={advance.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-slate-900">{formatCurrency(advance.amount)} ₺</p>
                                    <p className="text-sm text-slate-500">{formatDate(advance.advance_date)}</p>
                                    {advance.description && (
                                      <p className="text-sm text-slate-600 mt-1">{advance.description}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-slate-500">Yükleniyor...</div>
                    )}
                  </div>
                )}
                
                {/* Tab 3: İstatistik */}
                {activeTab === 'stats' && (
                  <div className="space-y-6">
                    {employeeStats ? (
                      <div className="grid grid-cols-3 gap-6">
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <div className="text-blue-700 text-sm font-medium mb-2">Toplam Satış</div>
                          <p className="text-2xl font-bold text-blue-900">{formatCurrency(employeeStats.total_sales)} ₺</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                          <div className="text-green-700 text-sm font-medium mb-2">Toplam İşlem</div>
                          <p className="text-2xl font-bold text-green-900">{employeeStats.total_transactions}</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                          <div className="text-purple-700 text-sm font-medium mb-2">Ortalama Sepet</div>
                          <p className="text-2xl font-bold text-purple-900">{formatCurrency(employeeStats.average_basket)} ₺</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">Yükleniyor...</div>
                    )}
                    <div className="bg-slate-50 rounded-lg p-8 border border-slate-200 text-center text-slate-500">
                      <p>Satış grafiği yakında eklenecek</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Bir personel seçin veya yeni personel ekleyin</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Yeni Personel Ekleme Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">Yeni Personel Ekle</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">User ID *</label>
                <input
                  type="text"
                  value={formData.user_id || ''}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="User ID (UUID)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Maaş (TL) *</label>
                <input
                  type="number"
                  value={formData.salary || ''}
                  onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Prim Oranı (%) *</label>
                <input
                  type="number"
                  value={formData.bonus_rate || ''}
                  onChange={(e) => setFormData({ ...formData, bonus_rate: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">PIN</label>
                <input
                  type="text"
                  value={formData.pin || ''}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="4-10 haneli PIN"
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">İşe Başlama Tarihi *</label>
                <input
                  type="date"
                  value={formData.start_date || ''}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddEmployee}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Kaydet
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Personel Düzenleme Modal */}
      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">Personel Düzenle</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Maaş (TL)</label>
                <input
                  type="number"
                  value={editFormData.salary || selectedEmployee.salary}
                  onChange={(e) => setEditFormData({ ...editFormData, salary: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Prim Oranı (%)</label>
                <input
                  type="number"
                  value={editFormData.bonus_rate || selectedEmployee.bonus_rate}
                  onChange={(e) => setEditFormData({ ...editFormData, bonus_rate: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.01"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">PIN</label>
                <input
                  type="text"
                  value={editFormData.pin !== undefined ? editFormData.pin : selectedEmployee.pin || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, pin: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={10}
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editFormData.is_active !== undefined ? editFormData.is_active : selectedEmployee.is_active}
                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-slate-700">Aktif</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateEmployee}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Kaydet
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Avans Ekleme Modal */}
      {showAdvanceModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">Avans Ekle</h2>
              <button onClick={() => setShowAdvanceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tutar (TL) *</label>
                <input
                  type="number"
                  value={advanceFormData.amount}
                  onChange={(e) => setAdvanceFormData({ ...advanceFormData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tarih *</label>
                <input
                  type="date"
                  value={advanceFormData.date}
                  onChange={(e) => setAdvanceFormData({ ...advanceFormData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Açıklama</label>
                <textarea
                  value={advanceFormData.description}
                  onChange={(e) => setAdvanceFormData({ ...advanceFormData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Avans açıklaması (opsiyonel)"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddAdvance}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Kaydet
              </button>
              <button
                onClick={() => setShowAdvanceModal(false)}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </main>
    </div>
  );
}
