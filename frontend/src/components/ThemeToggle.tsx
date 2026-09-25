import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveTheme, useThemeStore } from '@/store/themeStore';

// One click flips light <-> dark. (The Settings page also offers "System",
// which follows the OS — this button is just the fast path.)
export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const isDark = resolveTheme(theme) === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
