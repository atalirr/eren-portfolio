import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, Plus, Search, Filter, CheckCircle, Clock, XCircle,
  ArrowRightLeft, AlertTriangle, Trash2, Building, Calendar, User, Building2, X
} from 'lucide-react';
import apiClient from '@/shared/utils/api.client';

interface CheckItem {
  id: string;
  check_type: 'INCOMING' | 'OUTGOING';
  check_number: string;
  bank_name: string;
  branch_name?: string;
  account_number?: string;
  issuer: string;
  customer_id?: string;
  supplier_id?: string;
  customer_name?: string;
  supplier_name?: string;
  issue_date: string;
  due_date: string;
  amount: number;
  status: 'IN_PORTFOLIO' | 'COLLECTED' | 'TRANSFERRED' | 'BOUNCED';
  notes?: string;
  created_at?: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  IN_PORTFOLIO: { label: 'Portföyde', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Clock size={13} /> },
  COLLECTED:    { label: 'Tahsil Edildi', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle size={13} /> },
  TRANSFERRED:  { label: 'Ciro Edildi', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: <ArrowRightLeft size={13} /> },
  BOUNCED:      { label: 'Karşılıksız', color: 'bg-red-50 text-red-700 border-red-200', icon: <AlertTriangle size={13} /> },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n || 0);

const formatDate = (d: string) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('tr-TR'); } catch { return d; }
};

// ── Official Minimal KPI Card ────────────────────────────────────────────────
function KPICard({
  label,
  value,
  subtext,
  badgeText,
  valueColor = "text-slate-900"
}: {
  label: string;
  value: string;
  subtext?: string;
  badgeText?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
          {label}
        </span>
        {badgeText && (
          <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap shrink-0">
            {badgeText}
          </span>
        )}
      </div>
      <div className="mt-1">
        <div className={`text-xl font-bold tracking-tight ${valueColor}`}>
          {value}
        </div>
        {subtext && (
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}

export const ChecksView: React.FC = () => {
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'INCOMING' | 'OUTGOING'>('INCOMING');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const fetchChecks = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { check_type: activeTab };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      const res = await apiClient.get('/checks', { params });
      setChecks(res.data.checks || []);
    } catch (e) {
      console.error('Çekler yüklenemedi', e);
    }
    setLoading(false);
  }, [activeTab, statusFilter, searchTerm]);

  const fetchStatsAndMeta = async () => {
    try {
      const [stRes, cRes, sRes] = await Promise.allSettled([
        apiClient.get('/checks/stats'),
        apiClient.get('/customers'),
        apiClient.get('/suppliers'),
      ]);
      if (stRes.status === 'fulfilled') setStats(stRes.value.data);
      if (cRes.status === 'fulfilled') setCustomers(cRes.value.data.customers || cRes.value.data || []);
      if (sRes.status === 'fulfilled') setSuppliers(sRes.value.data.suppliers || sRes.value.data || []);
    } catch {}
  };

  useEffect(() => {
    fetchChecks();
  }, [fetchChecks]);

  useEffect(() => {
    fetchStatsAndMeta();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await apiClient.patch(`/checks/${id}/status`, { status: newStatus });
      fetchChecks();
      fetchStatsAndMeta();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Durum güncellenemedi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu çek kaydını silmek istediğinize emin misiniz?')) return;
    try {
      await apiClient.delete(`/checks/${id}`);
      fetchChecks();
      fetchStatsAndMeta();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Silinemedi');
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* ── Üst Araç Çubuğu ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          {(['INCOMING', 'OUTGOING'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === tab ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab === 'INCOMING' ? '📥 Alınan Müşteri Çekleri' : '📤 Verilen Kendi Çeklerimiz'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
        >
          <Plus size={15} />
          <span>Yeni Çek Girişi</span>
        </button>
      </div>

      {/* ── 4 KPI KARTI ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Portföydeki Çekler"
          value={fmt(stats?.incoming_in_portfolio || 0)}
          badgeText="Müşteri"
          subtext="Kasada vadesini bekleyen alınan çekler"
          valueColor="text-slate-900"
        />

        <KPICard
          label="Verilen Vadeli Çekler"
          value={fmt(stats?.outgoing_portfolio || 0)}
          badgeText="Kendi Çeklerimiz"
          subtext="Tedarikçilere verilen vadeli çekler"
          valueColor="text-amber-600"
        />

        <KPICard
          label="Tahsil Edilen Toplam"
          value={fmt(stats?.total_collected || 0)}
          badgeText="Tamamlanan"
          subtext="Bankaya/kasaya intikal eden tutar"
          valueColor="text-emerald-600"
        />

        <KPICard
          label="Karşılıksız / Protesto"
          value={fmt(stats?.total_bounced || 0)}
          badgeText="Sorunlu"
          subtext="Takibe alınan çek tutarı"
          valueColor="text-rose-600"
        />
      </div>

      {/* ── Arama & Durum Filtreleri ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Çek no, banka veya keşideci ara..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
          {[
            { v: 'ALL', l: 'Tümü' },
            { v: 'IN_PORTFOLIO', l: 'Portföyde' },
            { v: 'COLLECTED', l: 'Tahsil' },
            { v: 'TRANSFERRED', l: 'Ciro' },
            { v: 'BOUNCED', l: 'Karşılıksız' },
          ].map(f => (
            <button
              key={f.v}
              onClick={() => setStatusFilter(f.v)}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                statusFilter === f.v ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Tablo */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : checks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-xs">
          <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-sm mb-1">Kayıtlı Çek Bulunamadı</h3>
          <p className="text-slate-400 text-xs mb-4">Seçili kriterlerde portföyde herhangi bir çek mevcut değil</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
          >
            + Yeni Çek Ekle
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100/85 text-[10px] font-bold text-slate-600 uppercase tracking-wider divide-x divide-slate-200 border-b border-slate-300">
                  <th className="py-2.5 px-3">Seri No / Banka</th>
                  <th className="py-2.5 px-3">Keşideci (Borçlu)</th>
                  <th className="py-2.5 px-3">{activeTab === 'INCOMING' ? 'Cari Müşteri' : 'Tedarikçi'}</th>
                  <th className="py-2.5 px-3">Vade Tarihi</th>
                  <th className="py-2.5 px-3 text-right">Tutar</th>
                  <th className="py-2.5 px-3 text-center">Durum</th>
                  <th className="py-2.5 px-3 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                {checks.map((c, idx) => {
                  const st = STATUS_MAP[c.status] || STATUS_MAP.IN_PORTFOLIO;
                  return (
                    <tr
                      key={c.id}
                      className={`divide-x divide-slate-200 hover:bg-sky-50/60 transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                      }`}
                    >
                      <td className="py-2 px-3 font-medium text-slate-900">
                        <div className="font-mono font-bold text-slate-900">{c.check_number}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{c.bank_name} {c.branch_name ? `- ${c.branch_name}` : ''}</div>
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{c.issuer}</td>
                      <td className="py-2 px-3 text-slate-500">{c.customer_name || c.supplier_name || '-'}</td>
                      <td className="py-2 px-3 font-medium text-slate-700 whitespace-nowrap">{formatDate(c.due_date)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">{fmt(c.amount)}</td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${st.color}`}>
                          {st.icon} {st.label}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {c.status === 'IN_PORTFOLIO' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(c.id, 'COLLECTED')}
                                className="px-2 py-0.5 text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-semibold transition"
                                title="Tahsil Et"
                              >
                                Tahsil
                              </button>
                              <button
                                onClick={() => handleStatusChange(c.id, 'TRANSFERRED')}
                                className="px-2 py-0.5 text-[11px] bg-purple-50 text-purple-700 hover:bg-purple-100 rounded font-semibold transition"
                                title="Ciro Et"
                              >
                                Ciro
                              </button>
                              <button
                                onClick={() => handleStatusChange(c.id, 'BOUNCED')}
                                className="px-2 py-0.5 text-[11px] bg-red-50 text-red-700 hover:bg-red-100 rounded font-semibold transition"
                                title="Karşılıksız"
                              >
                                Karşılıksız
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition"
                            title="Sil"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Yeni Çek Ekleme Modalı */}
      {showModal && (
        <CreateCheckModal
          initialType={activeTab}
          customers={customers}
          suppliers={suppliers}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            fetchChecks();
            fetchStatsAndMeta();
          }}
        />
      )}
    </div>
  );
};

interface CreateCheckModalProps {
  initialType: 'INCOMING' | 'OUTGOING';
  customers: any[];
  suppliers: any[];
  onClose: () => void;
  onSaved: () => void;
}

const CreateCheckModal: React.FC<CreateCheckModalProps> = ({
  initialType, customers, suppliers, onClose, onSaved
}) => {
  const [saving, setSaving] = useState(false);
  const [checkType, setCheckType] = useState(initialType);
  const [checkNumber, setCheckNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [issuer, setIssuer] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkNumber || !bankName || !issuer || !amount || !dueDate) {
      alert('Lütfen zorunlu alanları (Seri No, Banka, Keşideci, Vade ve Tutar) doldurun.');
      return;
    }

    setSaving(true);
    try {
      await apiClient.post('/checks', {
        check_type: checkType,
        check_number: checkNumber,
        bank_name: bankName,
        branch_name: branchName || undefined,
        account_number: accountNumber || undefined,
        issuer,
        customer_id: checkType === 'INCOMING' ? customerId || undefined : undefined,
        supplier_id: checkType === 'OUTGOING' ? supplierId || undefined : undefined,
        issue_date: issueDate,
        due_date: dueDate,
        amount: Number(amount),
        notes: notes || undefined,
      });
      onSaved();
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Çek kaydedilemedi');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            <span>Yeni Çek Girişi</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Çek Tipi */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setCheckType('INCOMING')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                checkType === 'INCOMING' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              📥 Alınan Müşteri Çeki
            </button>
            <button
              type="button"
              onClick={() => setCheckType('OUTGOING')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                checkType === 'OUTGOING' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              📤 Verilen Kendi Çekimiz
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Çek Seri No *</label>
              <input
                required
                value={checkNumber}
                onChange={e => setCheckNumber(e.target.value)}
                placeholder="Örn: CK-982341"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tutar (TL) *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Banka Adı *</label>
              <input
                required
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                placeholder="Örn: Garanti BBVA"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Şube Adı</label>
              <input
                value={branchName}
                onChange={e => setBranchName(e.target.value)}
                placeholder="Örn: Kadıköy Şb."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Keşideci (Borçlu Adı/Unvanı) *</label>
            <input
              required
              value={issuer}
              onChange={e => setIssuer(e.target.value)}
              placeholder="Çekin üzerindeki borçlu kişi/şirket"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* İlgili Cari */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              {checkType === 'INCOMING' ? 'İlgili Müşteri (Cari Kart)' : 'İlgili Tedarikçi (Cari Kart)'}
            </label>
            <select
              value={checkType === 'INCOMING' ? customerId : supplierId}
              onChange={e => checkType === 'INCOMING' ? setCustomerId(e.target.value) : setSupplierId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Seçiniz (Opsiyonel)</option>
              {checkType === 'INCOMING'
                ? customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} {c.last_name || ''}</option>
                  ))
                : suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))
              }
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Düzenleme Tarihi</label>
              <input
                type="date"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Vade Tarihi *</label>
              <input
                required
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notlar / Açıklama</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Çek hakkında özel notlar..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : 'Çeki Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
