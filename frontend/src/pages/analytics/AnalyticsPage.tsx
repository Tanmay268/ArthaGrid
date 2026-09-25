import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner, ErrorState, EmptyState } from '@/components/ui/state';
import {
  useAnalyticsMetrics,
  useAnomalies,
  useHealthScore,
  useRecurringExpenses,
} from '@/api/analytics';
import { formatCurrency, formatPercent } from '@/lib/utils';

const RATING_TONE: Record<string, 'success' | 'default' | 'destructive'> = {
  EXCELLENT: 'success',
  GOOD: 'success',
  FAIR: 'default',
  'NEEDS ATTENTION': 'destructive',
};

export function AnalyticsPage() {
  const metrics = useAnalyticsMetrics();
  const health = useHealthScore();
  const anomalies = useAnomalies();
  const recurring = useRecurringExpenses();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Financial Health Score</CardTitle>
          </CardHeader>
          <CardContent>
            {health.isLoading && <Spinner />}
            {health.isError && <ErrorState message="Couldn't load the health score." />}
            {health.data && (
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold">{health.data.score}</span>
                  <Badge variant={RATING_TONE[health.data.rating]}>{health.data.rating}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Savings rate: {health.data.components.savingsRate}</span>
                  <span>Cash-flow stability: {health.data.components.cashFlowStability}</span>
                  <span>Spending consistency: {health.data.components.spendingConsistency}</span>
                  <span>Budget adherence: {health.data.components.budgetAdherence}</span>
                  <span>Emergency reserve: {health.data.components.emergencyReserve}</span>
                </div>
                <p className="text-xs text-muted-foreground">{health.data.methodology}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key metrics</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.isLoading && <Spinner />}
            {metrics.isError && <ErrorState message="Couldn't load metrics." />}
            {metrics.data && (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Metric label="Burn rate / mo" value={formatCurrency(metrics.data.burnRate)} />
                <Metric
                  label="Expense/income ratio"
                  value={metrics.data.expenseToIncomeRatio !== null ? metrics.data.expenseToIncomeRatio.toFixed(2) : '—'}
                />
                <Metric label="Avg daily spend" value={formatCurrency(metrics.data.avgDailySpending)} />
                <Metric label="Avg monthly spend" value={formatCurrency(metrics.data.avgMonthlySpending)} />
                <Metric label="Top category" value={metrics.data.mostExpensiveCategory ?? '—'} capitalize />
                <Metric label="Most frequent" value={metrics.data.mostFrequentCategory ?? '—'} capitalize />
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekday vs. weekend spending</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.isLoading && <Spinner />}
            {metrics.data && (
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weekday, avg/day</span>
                  <span className="font-medium">{formatCurrency(metrics.data.weekdayVsWeekend.weekday.avgPerDay)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weekend, avg/day</span>
                  <span className="font-medium">{formatCurrency(metrics.data.weekdayVsWeekend.weekend.avgPerDay)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Category growth (this month vs. last)</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.data && metrics.data.categoryGrowth.length === 0 && (
              <EmptyState message="Not enough history yet." />
            )}
            {metrics.data && metrics.data.categoryGrowth.length > 0 && (
              <ul className="flex flex-col gap-2">
                {metrics.data.categoryGrowth.map((row) => (
                  <li key={row.category} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{row.category.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{formatCurrency(row.thisMonth)}</span>
                      <Badge variant={row.changePercent > 0 ? 'destructive' : 'success'}>
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
            {anomalies.isLoading && <Spinner />}
            {anomalies.isError && <ErrorState message="Couldn't load anomalies." />}
            {anomalies.data && anomalies.data.length === 0 && (
              <EmptyState message="Nothing flagged — spending looks normal." />
            )}
            {anomalies.data && anomalies.data.length > 0 && (
              <ul className="flex flex-col gap-2">
                {anomalies.data.slice(0, 6).map((a) => (
                  <li key={a._id} className="flex items-center justify-between text-sm">
                    <div className="flex flex-col">
                      <span className="capitalize">{a.category.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-muted-foreground">{new Date(a.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatCurrency(a.amount)}</span>
                      <Badge variant="destructive">z={a.zScore}</Badge>
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
          {recurring.isLoading && <Spinner />}
          {recurring.isError && <ErrorState message="Couldn't load recurring expenses." />}
          {recurring.data && recurring.data.length === 0 && <EmptyState message="No recurring expenses detected yet." />}
          {recurring.data && recurring.data.length > 0 && (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recurring.data.map((r, i) => (
                <li key={`${r.merchant ?? r.category}-${i}`} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{r.merchant ?? r.category.replace(/_/g, ' ')}</span>
                    <span className="text-xs capitalize text-muted-foreground">{r.interval} · {r.occurrences}x</span>
                  </div>
                  <span className="font-medium">{formatCurrency(r.averageAmount)}</span>
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
      <dd className={capitalize ? 'font-medium capitalize' : 'font-medium'}>{value.replace(/_/g, ' ')}</dd>
    </div>
  );
}
