import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, type LucideIcon } from 'lucide-react';

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-1 font-medium underline underline-offset-2">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ message, icon: Icon = Inbox, action }: { message: string; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
      <Icon className="h-8 w-8 opacity-40" />
      <p className="max-w-xs">{message}</p>
      {action}
    </div>
  );
}
