import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const KEY = 'arthagrid-theme';

// localStorage can throw (private windows, blocked site data) — the theme
// must still work, it just won't be remembered.
const read = (): Theme => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* fall through to default */
  }
  return 'system';
};

const systemPrefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export const resolveTheme = (theme: Theme): ResolvedTheme =>
  theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme;

const apply = (theme: Theme) => {
  document.documentElement.classList.toggle('dark', resolveTheme(theme) === 'dark');
};

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: read(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* remembered for this session only */
    }
    apply(theme);
    set({ theme });
  },
}));

// Keep "system" live: if the OS flips between light/dark while the app is open, follow it.
apply(read());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useThemeStore.getState().theme === 'system') apply('system');
});
