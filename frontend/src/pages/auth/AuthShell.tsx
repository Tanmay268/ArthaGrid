import type { ReactNode } from 'react';
import { BarChart3, Lightbulb, ShieldCheck, TrendingUp } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

const POINTS = [
  { icon: BarChart3, text: 'Budgets, trends, and a transparent Financial Health Score' },
  { icon: TrendingUp, text: 'Simple, explainable forecasts — no black boxes' },
  { icon: Lightbulb, text: 'Plain-language insights and an AI assistant' },
  { icon: ShieldCheck, text: 'Your raw transactions never leave the server' },
];

// Shared frame for login/register: a brand panel on wide screens, and just the
// form (with the theme toggle in reach) on phones.
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-7 w-7 invert dark:invert-0" />
          <span className="text-lg font-semibold tracking-tight">ArthaGrid</span>
        </div>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">Understand your money, not just track it.</h2>
          <ul className="mt-8 flex flex-col gap-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm opacity-90">
                <Icon className="h-4 w-4 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs opacity-60">Sanskrit "artha" — wealth, prosperity.</p>
      </aside>

      <main className="relative flex items-center justify-center p-5 sm:p-8">
        <div className="absolute right-3 top-3">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <img src="/favicon.svg" alt="" className="h-6 w-6 dark:invert" />
            <span className="text-base font-semibold tracking-tight">ArthaGrid</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
