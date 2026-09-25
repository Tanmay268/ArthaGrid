import { Repeat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/ui/state';
import { useAnalyticsMetrics, useAnomalies, useHealthScore, useRecurringExpenses } from '@/api/analytics';
import { cn, formatCurrency, formatDate, formatPercent, humanize } from '@/lib/utils';

const RATING_TONE: Record<string, 'success' | 'warning' | 'destructive'> = {
  EXCELLENT: 'success',
  GOOD: 'success',
  FAIR: 'warning',
  'NEEDS ATTENTION': 'destructive',
};

const COMPONENT_LABELS: Record<string, string> = {
  savingsRate: 'Savings rate',
  cashFlowStability: 'Cash-flow stability',
  spendingConsistency: 'Spending consistency',
  budgetAdherence: 'Budget adherence',
  emergencyReserve: 'Emergency reserve',
};

export function AnalyticsPage() {
  const metrics = useAnalyticsMetrics();
  const health = useHealthScore();
  const anomalies = useAnomalies();
  const recurring = useRecurringExpenses();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Analytics" description="How you spend, what's changing, and what looks unusual." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Financial Health Score</CardTitle>
          </CardHeader>
          <CardContent>
            {health.isLoading && <CardSkeleton lines={5} />}
            {health.isError && <ErrorState message="Couldn't load the health score." onRetry={() => health.refetch()} />}
            {health.data && (
              <div className="flex flex-col gap-4">
                <div className="flex items-baseline gap-3">
                  <span className="tabular text-4xl font-semibold">{health.data.score}</span>
                  <Badge variant={RATING_TONE[health.data.rating]}>{health.data.rating.toLowerCase()}</Badge>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {Object.entries(health.data.components).map(([key, value]) => (
                    <li key={key}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-muted-foreground">{COMPONENT_LABELS[key] ?? key}</span>
                        <span className="tabular font-medium">{value}</span>
                      </div>
                      <Progress value={value} indicatorClassName={cn(value >= 60 ? 'bg-success' : value >= 40 ? 'bg-warning' : 'bg-destructive')} />
                    </li>
                  ))}
                </ul>
                <p className="text-xs leading-relaxed text-muted-foreground">{health.data.methodology}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Key metrics</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.isLoading && <CardSkeleton lines={4} />}
            {metrics.isError && <ErrorState message="Couldn't load metrics." onRetry={() => metrics.refetch()} />}
            {metrics.data && (
              <>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-3">
                  <Metric label="Burn rate / month" value={formatCurrency(metrics.data.burnRate)} />
                  <Metric label="Expense-to-income" value={metrics.data.expenseToIncomeRatio !== null ? metrics.data.expenseToIncomeRatio.toFixed(2) : '—'} />
                  <Metric label="Avg daily spend" value={formatCurrency(metrics.data.avgDailySpending)} />
                  <Metric label="Avg monthly spend" value={formatCurrency(metrics.data.avgMonthlySpending)} />
                  <Metric label="Biggest category" value={metrics.data.mostExpensiveCategory ? humanize(metrics.data.mostExpensiveCategory) : '—'} capitalize />
                  <Metric label="Most frequent" value={metrics.data.mostFrequentCategory ? humanize(metrics.data.mostFrequentCategory) : '—'} capitalize />
                </dl>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Weekday spend, per day</p>
                    <p className="tabular font-semibold">{formatCurrency(metrics.data.weekdayVsWeekend.weekday.avgPerDay)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Weekend spend, per day</p>
                    <p className="tabular font-semibold">{formatCurrency(metrics.data.weekdayVsWeekend.weekend.avgPerDay)}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Category change — this month vs. last</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.isLoading && <CardSkeleton />}
            {metrics.data && metrics.data.categoryGrowth.length === 0 && <EmptyState message="Not enough history yet." />}
            {metrics.data && metrics.data.categoryGrowth.length > 0 && (
              <ul className="divide-y divide-border">
                {metrics.data.categoryGrowth.map((row) => (
                  <li key={row.category} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="capitalize">{humanize(row.category)}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular text-muted-foreground">{formatCurrency(row.thisMonth)}</span>
                      <Badge variant={row.changePercent > 0 ? 'destructive' : 'success'} className="tabular w-16 justify-center">
                        {formatPercent(row.changePercent)}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unusual transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {anomalies.isLoading && <CardSkeleton />}
            {anomalies.isError && <ErrorState message="Couldn't load anomalies." onRetry={() => anomalies.refetch()} />}
            {anomalies.data && anomalies.data.length === 0 && <EmptyState message="Nothing flagged — spending looks normal." />}
            {anomalies.data && anomalies.data.length > 0 && (
              <ul className="divide-y divide-border">
                {anomalies.data.slice(0, 6).map((a) => (
                  <li key={a._id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate capitalize">{humanize(a.category)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(a.date)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular font-medium">{formatCurrency(a.amount)}</span>
                      <Badge variant="destructive">{a.zScore > 0 ? '+' : ''}{a.zScore}σ</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recurring expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {recurring.isLoading && <CardSkeleton />}
          {recurring.isError && <ErrorState message="Couldn't load recurring expenses." onRetry={() => recurring.refetch()} />}
          {recurring.data && recurring.data.length === 0 && <EmptyState icon={Repeat} message="No recurring expenses detected yet. They show up once a charge repeats at least three times." />}
          {recurring.data && recurring.data.length > 0 && (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recurring.data.map((r, i) => (
                <li key={`${r.merchant ?? r.category}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium capitalize">{r.merchant ?? humanize(r.category)}</p>
                    <p className="text-xs capitalize text-muted-foreground">{r.interval} · seen {r.occurrences}×</p>
                  </div>
                  <span className="tabular shrink-0 font-semibold">{formatCurrency(r.averageAmount)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('tabular font-semibold', capitalize && 'capitalize')}>{value}</dd>
    </div>
  );
}
