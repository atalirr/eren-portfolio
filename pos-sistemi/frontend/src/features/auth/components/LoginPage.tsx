/**
 * Login Page
 * Şifre ekranı — Yönetici / Personel seçimi
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Eye, EyeOff, ShieldCheck, User } from 'lucide-react';
import { useAppStore, type UserRole } from '@/store/appStore';
import { cn } from '@/shared/utils/cn';

const PASSWORD = '123456';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAppStore((s) => s.login);

  const [role, setRole] = useState<UserRole>('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== PASSWORD) {
      setError('Hatalı şifre. Tekrar deneyin.');
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }
    const name = role === 'admin' ? 'Yönetici' : 'Personel';
    login({ name, role });
    navigate('/sales', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Arka plan deseni */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-slate-900 pointer-events-none" />

      <div className={cn(
        'relative w-full max-w-sm',
        shaking && 'animate-[shake_0.4s_ease-in-out]'
      )}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30 mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-black text-white uppercase tracking-widest">ATLI MEDİKAL</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Satış Yönetim Sistemi</p>
        </div>

        {/* Kart */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-5">

          {/* Rol Seçimi */}
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Giriş Türü</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all',
                  role === 'admin'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                    : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                )}
              >
                <ShieldCheck className="w-5 h-5" />
                <span className="text-[11px] font-bold uppercase tracking-wide">Yönetici</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('personnel')}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all',
                  role === 'personnel'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                    : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                )}
              >
                <User className="w-5 h-5" />
                <span className="text-[11px] font-bold uppercase tracking-wide">Personel</span>
              </button>
            </div>
            {role === 'personnel' && (
              <p className="text-[10px] text-slate-500 mt-2 text-center">
                Personel yalnızca Satış ekranına erişebilir
              </p>
            )}
          </div>

          {/* Şifre */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Şifre</p>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••"
                  autoFocus
                  className={cn(
                    'w-full px-4 py-3 bg-slate-700 border rounded-xl text-white placeholder-slate-500 text-sm font-semibold tracking-widest outline-none transition-all pr-12',
                    error ? 'border-rose-500 focus:border-rose-400' : 'border-slate-600 focus:border-blue-500'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && (
                <p className="text-[11px] text-rose-400 font-semibold mt-1.5 flex items-center gap-1">
                  <span>⚠</span> {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className={cn(
                'w-full py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all shadow-lg',
                role === 'admin'
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
              )}
            >
              Giriş Yap
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-4">
          POS 6 · Offline-First Satış Sistemi
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
