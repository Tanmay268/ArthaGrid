import { create } from 'zustand';
import type { User } from '@/types/api';

// Deliberately NOT persisted to localStorage/sessionStorage. The access
// token only ever lives in memory here, and the refresh token never
// reaches the frontend at all — it's an httpOnly cookie the browser
// manages on its own (see docs/decisions.md #21 in the main repo). That
// means a full page reload loses this store, which is why App.tsx runs a
// silent refresh against the cookie on boot to restore the session.
type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  status: AuthStatus;
  setSession: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'checking',
  setSession: (user, accessToken) => set({ user, accessToken, status: 'authenticated' }),
  setAccessToken: (accessToken) => set({ accessToken, status: 'authenticated' }),
  clearSession: () => set({ user: null, accessToken: null, status: 'unauthenticated' }),
}));
