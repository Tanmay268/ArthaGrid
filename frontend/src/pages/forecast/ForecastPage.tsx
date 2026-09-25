import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/ui/state';
import { useForecast } from '@/api/analytics';
import { axisTick, compactInr, gridStroke, tooltipStyle } from '@/lib/chart';
import { formatCurrency } from '@/lib/utils';

type Metric = 'income' | 'expenses' | 'net';

export function ForecastPage() {
  const [metric, setMetric] = useState<Metric>('expenses');
  const forecast = useForecast(3, metric);
  const f = forecast.data;
  const usable = f && f.method !== 'insufficient_data';

  // One series for what happened and one for the projection; the projection
  // starts at the last real point so the two lines join instead of leaving a gap.
  const chartData = usable
    ? [
        ...f.history.map((h, i, all) => ({
          label: h.label,
          actual: h[metric],
          projected: i === all.length - 1 ? h[metric] : undefined,
        })),
        ...f.forecast.map((p) => ({ label: `+${p.monthsAhead} mo`, projected: p.linearRegression })),
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Forecast"
        description="A simple, explainable projection from your monthly history — a trend line, not a promise."
        action={
          <Select aria-label="Metric to forecast" value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="w-full sm:w-40">
            <option value="expenses">Expenses</option>
            <option value="income">Income</option>
            <option value="net">Net</option>
          </Select>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>History and projection</CardTitle>
        </CardHeader>
        <CardContent>
          {forecast.isLoading && <Skeleton className="h-72 w-full" />}
          {forecast.isError && <ErrorState message="Couldn't load the forecast." onRetry={() => forecast.refetch()} />}
          {f?.method === 'insufficient_data' && (
            <EmptyState icon={TrendingUp} message={f.message ?? 'Not enough history to forecast yet — keep tracking.'} />
          )}
          {usable && (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ left: -8, right: 8, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={compactInr} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="projected" name="Projected" stroke="hsl(var(--chart-3))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{f.method.replace(/_/g, ' ')}</Badge>
                {f.source && <Badge variant="outline">source: {f.source === 'postgres_rollup' ? 'Postgres rollup' : 'live from MongoDB'}</Badge>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {usable && f.forecast.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {f.forecast.map((p) => (
            <Card key={p.monthsAhead}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">In {p.monthsAhead} month{p.monthsAhead > 1 ? 's' : ''}</p>
                <p className="tabular mt-0.5 text-xl font-semibold">{formatCurrency(p.linearRegression)}</p>
                <p className="text-xs text-muted-foreground">Recent-average baseline: {formatCurrency(p.movingAverage)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
