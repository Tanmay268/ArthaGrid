import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner, ErrorState, EmptyState } from '@/components/ui/state';
import { useDashboardSummary, useDashboardTrends, useRecentTransactions } from '@/api/dashboard';
import { formatCurrency } from '@/lib/utils';

export function OverviewPage() {
  const summary = useDashboardSummary();
  const trends = useDashboardTrends('monthly');
  const recent = useRecentTransactions(8);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Income" value={summary.data ? formatCurrency(summary.data.totalIncome) : undefined} loading={summary.isLoading} />
        <StatCard label="Expenses" value={summary.data ? formatCurrency(summary.data.totalExpenses) : undefined} loading={summary.isLoading} />
        <StatCard
          label="Net Balance"
          value={summary.data ? formatCurrency(summary.data.netBalance) : undefined}
          loading={summary.isLoading}
          tone={summary.data && summary.data.netBalance < 0 ? 'destructive' : 'success'}
        />
        <StatCard
          label="Savings Rate"
          value={summary.data ? `${summary.data.savingsRate}%` : undefined}
          loading={summary.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Spending trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trends.isLoading && <Spinner />}
            {trends.isError && <ErrorState message="Couldn't load trends." />}
            {trends.data && trends.data.length === 0 && <EmptyState message="No transactions yet." />}
            {trends.data && trends.data.length > 0 && (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trends.data}>
                  <defs>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={40} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="income" stroke="hsl(var(--success))" fill="url(#incomeFill)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" fill="url(#expenseFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.isLoading && <Spinner />}
            {recent.isError && <ErrorState message="Couldn't load recent transactions." />}
            {recent.data && recent.data.length === 0 && <EmptyState message="No transactions yet." />}
            {recent.data && recent.data.length > 0 && (
              <ul className="flex flex-col gap-3">
                {recent.data.map((t) => (
                  <li key={t._id} className="flex items-center justify-between text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium capitalize">{t.category.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString()}</span>
                    </div>
                    <Badge variant={t.type === 'income' ? 'success' : 'default'}>
                      {t.type === 'income' ? '+' : '-'}
                      {formatCurrency(t.amount)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value?: string;
  loading?: boolean;
  tone?: 'success' | 'destructive';
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-7 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <p
            className={
              tone === 'success' ? 'text-xl font-semibold text-success' : tone === 'destructive' ? 'text-xl font-semibold text-destructive' : 'text-xl font-semibold'
            }
          >
            {value ?? '—'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
