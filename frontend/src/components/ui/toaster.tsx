import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore, type ToastKind } from '@/store/toastStore';

const STYLES: Record<ToastKind, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-success' },
  error: { icon: XCircle, className: 'text-destructive' },
  info: { icon: Info, className: 'text-muted-foreground' },
};

// aria-live="polite" so screen readers announce results (saved / failed)
// without interrupting whatever the user is doing.
export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end"
    >
      {toasts.map((t) => {
        const { icon: Icon, className } = STYLES[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm animate-slide-in items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm shadow-lg"
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', className)} />
            <p className="flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
