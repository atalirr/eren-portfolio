/**
 * App Store (Zustand)
 * Genel uygulama durumu
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'admin' | 'personnel';

export interface AuthUser {
  name: string;
  role: UserRole;
}

interface AppState {
  isInitialized: boolean;
  apiPort: number | null;
  error: string | null;
  sidebarCollapsed: boolean;
  // Auth
  user: AuthUser | null;
  isLoggedIn: boolean;
  setInitialized: (value: boolean) => void;
  setApiPort: (port: number) => void;
  setError: (error: string | null) => void;
  setSidebarCollapsed: (value: boolean) => void;
  toggleSidebar: () => void;
  login: (user: AuthUser) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isInitialized: false,
      apiPort: null,
      error: null,
      sidebarCollapsed: false,
      user: null,
      isLoggedIn: false,
      setInitialized: (value) => set({ isInitialized: value }),
      setApiPort: (port) => set({ apiPort: port }),
      setError: (error) => set({ error }),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      login: (user) => set({ user, isLoggedIn: true }),
      logout: () => set({ user: null, isLoggedIn: false }),
    }),
    {
      name: 'pos6-auth',
      partialize: (state) => ({ user: state.user, isLoggedIn: state.isLoggedIn, sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
);
