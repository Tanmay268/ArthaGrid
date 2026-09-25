import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner, ErrorState, EmptyState } from '@/components/ui/state';
import { useForecast } from '@/api/analytics';
import { formatCurrency } from '@/lib/utils';

type Metric = 'income' | 'expenses' | 'net';

export function ForecastPage() {
  const [metric, setMetric] = useState<Metric>('expenses');
  const forecast = useForecast(3, metric);

  const chartData =
    forecast.data && forecast.data.method !== 'insufficient_data'
      ? [
          ...forecast.data.history.map((h) => ({ label: h.label, actual: h[metric] })),
          ...forecast.data.forecast.map((f) => ({
            label: `+${f.monthsAhead}mo`,
            projected: f.linearRegression,
          })),
        ]
      : [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Spending forecast</CardTitle>
            <Select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="w-36">
              <option value="expenses">Expenses</option>
              <option value="income">Income</option>
              <option value="net">Net</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {forecast.isLoading && <Spinner />}
          {forecast.isError && <ErrorState message="Couldn't load the forecast." />}
          {forecast.data?.method === 'insufficient_data' && (
            <EmptyState message={forecast.data.message ?? 'Not enough history to forecast yet.'} />
          )}
          {forecast.data && forecast.data.method !== 'insufficient_data' && (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={40} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                  <Line
                    type="monotone"
                    dataKey="projected"
                    name="Projected"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{forecast.data.method.replace(/_/g, ' ')}</Badge>
                {forecast.data.source && (
                  <Badge variant="outline">
                    source: {forecast.data.source === 'postgres_rollup' ? 'Postgres rollup' : 'live from MongoDB'}
                  </Badge>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {forecast.data && forecast.data.forecast.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Projected next {forecast.data.forecast.length} month(s)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {forecast.data.forecast.map((f) => (
                <li key={f.monthsAhead} className="rounded-md border border-border p-3 text-sm">
                  <div className="text-xs text-muted-foreground">+{f.monthsAhead} month(s)</div>
                  <div className="font-semibold">{formatCurrency(f.linearRegression)}</div>
                  <div className="text-xs text-muted-foreground">moving avg: {formatCurrency(f.movingAverage)}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
