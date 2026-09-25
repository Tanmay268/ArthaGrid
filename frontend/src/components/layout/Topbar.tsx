import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/api/auth';

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="text-sm font-medium">
        {greeting}
        {user ? `, ${user.name.split(' ')[0]}` : ''}
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
            {user.role}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>
    </header>
  );
}
