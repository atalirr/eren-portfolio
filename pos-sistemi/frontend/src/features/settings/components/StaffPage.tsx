/**
 * Staff Page Component
 * Personel Yönetimi
 */

import { useState } from 'react';
import { UserPlus, Edit, Trash2, X, Save, Users, Shield, Lock } from 'lucide-react';

interface Staff {
  id: string;
  name: string;
  password: string; // Gerçek uygulamada şifre hash'lenmiş olacak
  role: 'admin' | 'cashier' | 'manager';
  permissions: {
    canDiscount: boolean;
    canDeleteStock: boolean;
    canManageStaff: boolean;
    canCloseShift: boolean;
    canViewReports: boolean;
  };
}

const initialStaff: Staff[] = [
  {
    id: '1',
    name: 'Ahmet Yılmaz',
    password: '****',
    role: 'admin',
    permissions: {
      canDiscount: true,
      canDeleteStock: true,
      canManageStaff: true,
      canCloseShift: true,
      canViewReports: true,
    },
  },
  {
    id: '2',
    name: 'Ayşe Demir',
    password: '****',
    role: 'cashier',
    permissions: {
      canDiscount: false,
      canDeleteStock: false,
      canManageStaff: false,
      canCloseShift: false,
      canViewReports: false,
    },
  },
  {
    id: '3',
    name: 'Mehmet Kaya',
    password: '****',
    role: 'manager',
    permissions: {
      canDiscount: true,
      canDeleteStock: true,
      canManageStaff: false,
      canCloseShift: true,
      canViewReports: true,
    },
  },
];

export function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>(initialStaff);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    role: 'cashier' as 'admin' | 'cashier' | 'manager',
    permissions: {
      canDiscount: false,
      canDeleteStock: false,
      canManageStaff: false,
      canCloseShift: false,
      canViewReports: false,
    },
  });

  const handleAddStaff = () => {
    if (!formData.name || !formData.password) {
      alert('Lütfen ad ve şifre alanlarını doldurun!');
      return;
    }

    const newStaff: Staff = {
      id: Date.now().toString(),
      ...formData,
      password: '****', // Gerçek uygulamada hash'lenecek
    };

    setStaff([...staff, newStaff]);
    setFormData({
      name: '',
      password: '',
      role: 'cashier',
      permissions: {
        canDiscount: false,
        canDeleteStock: false,
        canManageStaff: false,
        canCloseShift: false,
        canViewReports: false,
      },
    });
    setShowAddModal(false);
  };

  const handleEditStaff = () => {
    if (!editingStaff || !formData.name) {
      alert('Lütfen ad alanını doldurun!');
      return;
    }

    setStaff(
      staff.map((s) =>
        s.id === editingStaff.id
          ? {
              ...s,
              name: formData.name,
              role: formData.role,
              permissions: formData.permissions,
              password: formData.password ? '****' : s.password,
            }
          : s
      )
    );
    setShowEditModal(false);
    setEditingStaff(null);
  };

  const handleDeleteStaff = (id: string) => {
    if (confirm('Bu personeli silmek istediğinize emin misiniz?')) {
      setStaff(staff.filter((s) => s.id !== id));
    }
  };

  const handleOpenEdit = (staffMember: Staff) => {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name,
      password: '',
      role: staffMember.role,
      permissions: { ...staffMember.permissions },
    });
    setShowEditModal(true);
  };

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      password: '',
      role: 'cashier',
      permissions: {
        canDiscount: false,
        canDeleteStock: false,
        canManageStaff: false,
        canCloseShift: false,
        canViewReports: false,
      },
    });
    setShowAddModal(true);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Yönetici',
      cashier: 'Kasiyer',
      manager: 'Müdür',
    };
    return labels[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      cashier: 'bg-blue-100 text-blue-800',
      manager: 'bg-green-100 text-green-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Personel Yönetimi
        </h2>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <UserPlus className="w-5 h-5" />
          Yeni Personel Ekle
        </button>
      </div>

      {/* Personel Tablosu */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Ad
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Rol
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Yetkiler
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {staff.map((staffMember) => (
              <tr key={staffMember.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-medium text-gray-900">{staffMember.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getRoleColor(
                      staffMember.role
                    )}`}
                  >
                    {getRoleLabel(staffMember.role)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {staffMember.permissions.canDiscount && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                        İndirim
                      </span>
                    )}
                    {staffMember.permissions.canDeleteStock && (
                      <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                        Stok Sil
                      </span>
                    )}
                    {staffMember.permissions.canManageStaff && (
                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                        Personel Yönet
                      </span>
                    )}
                    {staffMember.permissions.canCloseShift && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        Vardiya Kapat
                      </span>
                    )}
                    {staffMember.permissions.canViewReports && (
                      <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded">
                        Rapor Görüntüle
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(staffMember)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Düzenle"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteStaff(staffMember.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Yeni Personel Ekle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Yeni Personel Ekle</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ad Soyad *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Örn: Ahmet Yılmaz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Şifre *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as 'admin' | 'cashier' | 'manager',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cashier">Kasiyer</option>
                  <option value="manager">Müdür</option>
                  <option value="admin">Yönetici</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Yetkiler
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canDiscount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canDiscount: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">İndirim yapabilir</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canDeleteStock}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canDeleteStock: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Stok silebilir</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canManageStaff}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageStaff: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Personel yönetebilir</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canCloseShift}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canCloseShift: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Vardiya kapatabilir</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canViewReports}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canViewReports: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Rapor görüntüleyebilir</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleAddStaff}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Düzenle Modal */}
      {showEditModal && editingStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Personel Düzenle</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingStaff(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ad Soyad *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as 'admin' | 'cashier' | 'manager',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cashier">Kasiyer</option>
                  <option value="manager">Müdür</option>
                  <option value="admin">Yönetici</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Yetkiler
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canDiscount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canDiscount: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">İndirim yapabilir</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canDeleteStock}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canDeleteStock: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Stok silebilir</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canManageStaff}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageStaff: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Personel yönetebilir</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canCloseShift}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canCloseShift: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Vardiya kapatabilir</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.permissions.canViewReports}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canViewReports: e.target.checked },
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Rapor görüntüleyebilir</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingStaff(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleEditStaff}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

