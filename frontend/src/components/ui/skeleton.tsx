import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden="true" />;
}

// Placeholder shaped like the content it stands in for, so the page doesn't
// jump when data arrives — better than a lone spinner on a blank card.
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === 0 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}
