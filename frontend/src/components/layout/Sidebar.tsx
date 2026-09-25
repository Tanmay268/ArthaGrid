import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  Wallet,
  TrendingUp,
  Lightbulb,
  Receipt,
  Settings,
  MessageCircleQuestion,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@/types/api';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[]; // omitted = every authenticated role can see it
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['analyst', 'admin'] },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/forecast', label: 'Forecast', icon: TrendingUp, roles: ['analyst', 'admin'] },
  { to: '/insights', label: 'Insights', icon: Lightbulb, roles: ['analyst', 'admin'] },
  { to: '/copilot', label: 'Ask ArthaGrid', icon: MessageCircleQuestion, roles: ['analyst', 'admin'] },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const role = useAuthStore((s) => s.user?.role);

  const items = NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)));

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-card md:block">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-base font-semibold">ArthaGrid</span>
      </div>
      <nav className="flex flex-col gap-1 p-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                isActive && 'bg-muted text-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
