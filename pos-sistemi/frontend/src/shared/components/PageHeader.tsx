import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, User, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/shared/utils/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  hideUser?: boolean;
}

/** Kullanıcı profili butonu — store'dan otomatik okur */
function UserProfileButton() {
  const { user, logout } = useAppStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(v => !v)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <p className="text-[12px] font-bold text-slate-800 leading-none">{user.name}</p>
      </button>

      {menuOpen && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="fixed right-5 top-[53px] w-48 bg-white rounded-xl border border-slate-200 shadow-xl z-50 py-1 overflow-hidden">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-[13px] font-semibold text-rose-500 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              Oturumu Kapat
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  className = '',
  hideUser = false
}: PageHeaderProps) {
  return (
    <header className={`sticky top-0 bg-white border-b border-slate-200 shrink-0 z-30 shadow-sm ${className}`}>
      <div className="max-w-[1600px] mx-auto w-full px-6 py-3 flex items-center justify-between">
        {/* Sol taraf: Icon + Title */}
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="w-1.5 h-6 bg-slate-900 rounded-lg shrink-0" />
          )}
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-slate-900 uppercase truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Sağ taraf: Actions + User */}
        <div className="flex items-center gap-3 shrink-0">
          {actions && (
            <div className="flex items-center gap-3">
              {actions}
            </div>
          )}
          {!hideUser && (
            <>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <UserProfileButton />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default PageHeader;

