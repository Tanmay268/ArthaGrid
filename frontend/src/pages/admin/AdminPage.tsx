import { Activity, Clock, Cpu, Gauge, Receipt, ShieldAlert, UserCheck, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/ui/state';
import { useAdminStats } from '@/api/admin';
import { cn, humanize } from '@/lib/utils';

const fmt = (n: number) => n.toLocaleString('en-IN');

const duration = (seconds: number) => {
  if (seconds < 90) return `${seconds}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1)} h`;
  return `${Math.round(seconds / 86400)} days`;
};

export function AdminPage() {
  const stats = useAdminStats();
  const d = stats.data;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Admin"
        description="How the platform is doing. Aggregate numbers only — no individual transactions appear here."
      />

      {stats.isError && <ErrorState message="Couldn't load platform stats." onRetry={() => stats.refetch()} />}

      <section aria-label="Users" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} label="Total users" value={d && fmt(d.users.total)} loading={stats.isLoading} />
        <Stat icon={UserCheck} label="Active (30 days)" value={d && fmt(d.users.activeLast30Days)} loading={stats.isLoading} />
        <Stat icon={UserPlus} label="New this month" value={d && fmt(d.users.newThisMonth)} loading={stats.isLoading} />
        <Stat icon={Receipt} label="Transactions" value={d && fmt(d.transactions.total)} note={d && `${d.transactions.dailyAverage}/day avg`} loading={stats.isLoading} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Popular expense categories</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.isLoading && <CardSkeleton lines={5} />}
            {d && d.transactions.popularExpenseCategories.length === 0 && <EmptyState message="No expenses recorded yet." />}
            {d && d.transactions.popularExpenseCategories.length > 0 && (
              <ul className="flex flex-col gap-3">
                {d.transactions.popularExpenseCategories.map((c) => (
                  <li key={c.category}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="capitalize">{humanize(c.category)}</span>
                      <span className="tabular text-muted-foreground">{c.sharePercent}%</span>
                    </div>
                    <Progress value={c.sharePercent} indicatorClassName="bg-chart-1" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users by role</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.isLoading && <CardSkeleton lines={3} />}
            {d && (
              <ul className="flex flex-col gap-2 text-sm">
                {Object.entries(d.users.byRole).map(([role, count]) => (
                  <li key={role} className="flex items-center justify-between">
                    <span className="capitalize">{role}</span>
                    <Badge variant="outline" className="tabular">{count}</Badge>
                  </li>
                ))}
                <li className="mt-1 flex items-center justify-between border-t border-border pt-2 text-muted-foreground">
                  <span>Deactivated</span>
                  <span className="tabular">{d.users.total - d.users.active}</span>
                </li>
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section aria-label="System health">
        <h2 className="mb-2 text-sm font-semibold">System</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Request numbers are counted in the API's memory, so they reset when the server restarts or a free host puts it to sleep
          {d && <> — these cover the last {duration(d.system.uptimeSeconds)}.</>}
        </p>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={Activity} label="Requests" value={d && fmt(d.system.http.totalRequests)} loading={stats.isLoading} />
          <Stat icon={Gauge} label="Avg latency" value={d && `${d.system.http.avgLatencyMs} ms`} note={d && `p95 ${d.system.http.p95Ms} ms · p99 ${d.system.http.p99Ms} ms`} loading={stats.isLoading} />
          <Stat
            icon={ShieldAlert}
            label="Server error rate"
            value={d && `${d.system.http.serverErrorRatePercent}%`}
            note={d && `client errors ${d.system.http.clientErrorRatePercent}%`}
            tone={d && d.system.http.serverErrorRatePercent > 1 ? 'destructive' : undefined}
            loading={stats.isLoading}
          />
          <Stat icon={Cpu} label="Memory" value={d && `${d.system.memoryMb.rss} MB`} note={d && `heap ${d.system.memoryMb.heapUsed} MB`} loading={stats.isLoading} />
        </div>

        {d && (
          <Card className="mt-3">
            <CardContent className="grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
              {(Object.entries(d.system.services) as [string, string][]).map(([name, state]) => (
                <div key={name}>
                  <p className="text-xs capitalize text-muted-foreground">{name}</p>
                  <Badge variant={state === 'connected' || state === 'configured' ? 'success' : state === 'unavailable' || state === 'disconnected' ? 'destructive' : 'default'}>
                    {state}
                  </Badge>
                </div>
              ))}
              <div className="col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-4">
                <Clock className="h-3 w-3" /> Up {duration(d.system.uptimeSeconds)} · Node {d.system.nodeVersion} · refreshes every 30 s
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
  loading,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  note?: string;
  loading?: boolean;
  tone?: 'destructive';
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">{label}</span>
          <Icon className="h-4 w-4" />
        </div>
        {loading ? <Skeleton className="mt-1 h-7 w-20" /> : <p className={cn('tabular text-lg font-semibold sm:text-xl', tone === 'destructive' && 'text-destructive')}>{value ?? '—'}</p>}
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}
