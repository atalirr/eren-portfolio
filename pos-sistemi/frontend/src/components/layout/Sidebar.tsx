/**
 * Sidebar Component
 * Sol tarafta sabit, koyu renkli modern sidebar
 */

import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  Wallet,
  BarChart3,
  Store,
  FileText,
  Globe,
  Settings,
  ChevronLeft,
  ChevronRight,
  Users,
  LayoutDashboard,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useAppStore } from '@/store/appStore';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Gösterge Paneli', path: '/dashboard',         icon: LayoutDashboard, adminOnly: true },
  { label: 'Satış / POS',       path: '/sales',            icon: ShoppingCart },
  { label: 'Stok Yönetimi',     path: '/inventory',        icon: Package,     adminOnly: true },
  { label: 'Finans & Raporlar', path: '/transactions',     icon: BarChart3,   adminOnly: true },
  { label: 'Müşteri & Personel',path: '/customers-staff',  icon: Users,       adminOnly: true },
  { label: 'Faturalar',         path: '/invoices',         icon: FileText,    adminOnly: true },
  { label: 'Tedarikçiler & Cari', path: '/suppliers',      icon: Briefcase,   adminOnly: true },
  { label: 'E-Ticaret',         path: '/ecommerce',        icon: Globe,       adminOnly: true },
  { label: 'Ayarlar',           path: '/settings',         icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar, user } = useAppStore();
  const isAdmin = user?.role === 'admin';

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className={cn(
      "fixed left-0 top-0 h-full bg-slate-900 text-white flex flex-col shadow-2xl z-50 transition-all duration-300 border-r border-white/5",
      sidebarCollapsed ? "w-20" : "w-64"
    )}>
      {/* Logo Alanı */}
      <div className="h-20 flex items-center px-5 border-b border-white/5 overflow-hidden">
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div className={cn(
            "transition-all duration-300 ease-in-out origin-left overflow-hidden flex flex-col",
            sidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[150px] opacity-100"
          )}>
            <h1 className="text-sm font-semibold text-white tracking-wide whitespace-nowrap">ATLI MEDİKAL</h1>
            <p className="text-xs text-slate-400 whitespace-nowrap">ERP &amp; Finans</p>
          </div>
        </Link>
      </div>

      {/* Navigasyon Linkleri */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto overflow-x-hidden sidebar-scroll">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              title={sidebarCollapsed ? item.label : ''}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors duration-150 group relative outline-none focus:outline-none focus-visible:outline-none border',
                isActive
                  ? 'bg-slate-800/90 text-white font-medium shadow-sm border-slate-700/60'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white border-transparent'
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0 transition-all", isActive ? "text-sky-400" : "text-slate-400 group-hover:text-white")} />
              <span className={cn(
                "text-sm font-medium transition-all duration-300 ease-in-out origin-left whitespace-nowrap overflow-hidden flex-1",
                sidebarCollapsed ? "max-w-0 opacity-0" : "max-w-[150px] opacity-100"
              )}>
                {item.label}
              </span>
              {item.path === '/invoices' && !sidebarCollapsed && (
                <span className="text-xs bg-slate-700/60 px-2 py-0.5 rounded text-slate-300 font-normal">
                  148
                </span>
              )}
              {sidebarCollapsed && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl border border-white/5 uppercase tracking-widest pointer-events-none">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Alt Bölüm - GİB Canlı Durumu ve Daraltma */}
      <div className="border-t border-slate-800/60 px-5 py-3.5 flex items-center justify-between text-xs text-slate-400 shrink-0">
        {!sidebarCollapsed ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-300 font-medium text-xs">GİB Canlı</span>
            </div>
            <span className="text-slate-500 font-mono text-[11px]">v2.4</span>
          </>
        ) : (
          <span className="w-2 h-2 mx-auto rounded-full bg-emerald-500" title="GİB Canlı"></span>
        )}
        <button
          onClick={toggleSidebar}
          className="ml-2 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition"
          title={sidebarCollapsed ? "Genişlet" : "Daralt"}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </div>
  );
}
