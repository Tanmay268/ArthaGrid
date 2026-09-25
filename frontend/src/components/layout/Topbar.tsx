import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { useLogout } from '@/api/auth';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const setMobileNav = useUiStore((s) => s.setMobileNav);
  const logout = useLogout();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/90 px-3 backdrop-blur sm:px-4">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="min-w-0 flex-1 truncate text-sm font-medium">
        {greeting()}
        {user ? <span className="text-muted-foreground">, {user.name.split(' ')[0]}</span> : ''}
      </div>

      {user && (
        <span className="hidden rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground sm:inline">
          {user.role}
        </span>
      )}
      <ThemeToggle />
      <Button variant="ghost" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending} aria-label="Log out">
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Log out</span>
      </Button>
    </header>
  );
}
