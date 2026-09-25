import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  Wallet,
  TrendingUp,
  Lightbulb,
  Receipt,
  Settings,
  MessageCircleQuestion,
  ShieldCheck,
  BookOpen,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { Button } from '@/components/ui/button';
import type { Role } from '@/types/api';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[]; // omitted = every authenticated role can see it
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['analyst', 'admin'] },
  { to: '/forecast', label: 'Forecast', icon: TrendingUp, roles: ['analyst', 'admin'] },
  { to: '/insights', label: 'Insights', icon: Lightbulb, roles: ['analyst', 'admin'] },
  { to: '/copilot', label: 'Ask ArthaGrid', icon: MessageCircleQuestion, roles: ['analyst', 'admin'] },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const role = useAuthStore((s) => s.user?.role);
  const items = NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)));

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="Main">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              isActive && 'bg-muted text-foreground'
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </NavLink>
      ))}

      <div className="mt-auto pt-2">
        {/* The API's Swagger UI lives on the backend's domain, not this one. */}
        <a
          href={`${API_BASE_URL}/api-docs/`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <BookOpen className="h-4 w-4 shrink-0" />
          API docs
        </a>
      </div>
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2 border-b border-border px-4">
      <img src="/favicon.svg" alt="" className="h-6 w-6 dark:invert" />
      <span className="text-base font-semibold tracking-tight">ArthaGrid</span>
    </div>
  );
}

export function Sidebar() {
  const { mobileNavOpen, setMobileNav } = useUiStore();
  const { pathname } = useLocation();

  // Close the drawer whenever the route changes, and on Escape.
  useEffect(() => setMobileNav(false), [pathname, setMobileNav]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileNav(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen, setMobileNav]);

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-card md:flex">
        <Brand />
        <NavList />
      </aside>

      {/* Mobile: slide-in drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNav(false)} aria-hidden="true" />
          <aside
            className="absolute inset-y-0 left-0 flex w-64 max-w-[80vw] animate-drawer-in flex-col border-r border-border bg-card shadow-xl"
            aria-label="Navigation"
          >
            <div className="flex items-center justify-between">
              <Brand />
              <Button variant="ghost" size="icon" className="mr-2" onClick={() => setMobileNav(false)} aria-label="Close menu">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <NavList onNavigate={() => setMobileNav(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
