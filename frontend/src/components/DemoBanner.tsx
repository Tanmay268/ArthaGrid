import { useState } from 'react';
import { ChevronDown, FlaskConical } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

// Small inline callout used wherever a restricted area needs explaining.
export function DemoNotice({ children }: { children: React.ReactNode }) {
  return (
    <div role="note" className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

// Shown on every page for demo accounts: they run in an isolated sandbox
// database, can use every feature, and are told exactly what is locked.
export function DemoBanner() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  if (!user?.isDemo) return null;

  const restrictions = user.demoRestrictions ?? [];

  return (
    <div role="note" className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left font-medium"
      >
        <FlaskConical className="h-4 w-4 shrink-0" />
        <span className="flex-1">Demo account — explore freely, but some features are restricted.</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-2 pl-6">
          <p>This is a separate sandbox database, so anything you change here never affects real accounts. Restricted on demo accounts:</p>
          <ul className="mt-1 list-disc pl-5">
            {restrictions.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
