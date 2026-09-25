import { AlertTriangle, CalendarClock, Lightbulb, PiggyBank, Repeat, Sparkles, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/ui/state';
import { useInsights, useWeeklyReport } from '@/api/analytics';
import { cn, formatCurrency, humanize } from '@/lib/utils';
import type { Insight, WeeklyReport } from '@/types/api';

const TYPE_META: Record<Insight['type'], { label: string; icon: LucideIcon; className: string }> = {
  spending: { label: 'Spending', icon: CalendarClock, className: 'bg-chart-1/10' },
  category: { label: 'Category', icon: TrendingUp, className: 'bg-chart-3/10' },
  budget: { label: 'Budget', icon: Wallet, className: 'bg-warning/15 text-warning' },
  forecast: { label: 'Forecast', icon: Sparkles, className: 'bg-chart-4/10' },
  anomaly: { label: 'Unusual', icon: AlertTriangle, className: 'bg-destructive/10 text-destructive' },
  recurring: { label: 'Recurring', icon: Repeat, className: 'bg-chart-6/10' },
};

export function InsightsPage() {
  const insights = useInsights();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Insights" description="Rule-based observations, recomputed from your data each time you open this page." />

      <WeeklyReportCard />

      <Card>
        <CardHeader>
          <CardTitle>What ArthaGrid noticed</CardTitle>
        </CardHeader>
        <CardContent>
          {insights.isLoading && <CardSkeleton lines={4} />}
          {insights.isError && <ErrorState message="Couldn't load insights." onRetry={() => insights.refetch()} />}
          {insights.data && insights.data.length === 0 && (
            <EmptyState icon={Lightbulb} message="Nothing stands out yet. Keep tracking and observations will show up here." />
          )}
          {insights.data && insights.data.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {insights.data.map((insight, i) => {
                const meta = TYPE_META[insight.type];
                const Icon = meta.icon;
                return (
                  <li key={i} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted', meta.className)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Badge variant="outline" className="mb-1">{meta.label}</Badge>
                      <p className="text-sm">{insight.text}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const change = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n}%`);

function WeeklyReportCard() {
  const report = useWeeklyReport();

  return (
    <Card>
      <CardHeader>
        <CardTitle>This week</CardTitle>
      </CardHeader>
      <CardContent>
        {report.isLoading && <CardSkeleton lines={3} />}
        {report.isError && <ErrorState message="Couldn't load the weekly report." onRetry={() => report.refetch()} />}
        {report.data && <ReportBody r={report.data} />}
      </CardContent>
    </Card>
  );
}

function ReportBody({ r }: { r: WeeklyReport }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Last 7 days vs. the 7 before. Turn on the weekly email in Settings to get this every Sunday.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Figure label="Income" value={formatCurrency(r.income)} note={change(r.vsLastWeek.incomeChangePercent)} />
        <Figure label="Expenses" value={formatCurrency(r.expenses)} note={change(r.vsLastWeek.expensesChangePercent)} />
        <Figure label="Saved" value={formatCurrency(r.savings)} icon={PiggyBank} tone={r.savings < 0 ? 'destructive' : 'success'} />
      </div>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <Row label="Top category" value={r.topCategory ? `${humanize(r.topCategory.category)} · ${formatCurrency(r.topCategory.total)}` : 'No expenses'} />
        <Row label="Unusual transactions" value={String(r.unusualTransactions.count)} />
        <Row
          label="Budgets within limit"
          value={r.budgets.total ? `${r.budgets.withinLimit} of ${r.budgets.total}` : 'None set'}
          note={r.budgets.overBudget.length ? `Over: ${r.budgets.overBudget.map(humanize).join(', ')}` : undefined}
        />
      </dl>
    </div>
  );
}

function Figure({ label, value, note, tone, icon: Icon }: { label: string; value: string; note?: string; tone?: 'success' | 'destructive'; icon?: LucideIcon }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p className={cn('tabular mt-0.5 text-base font-semibold sm:text-lg', tone === 'success' && 'text-success', tone === 'destructive' && 'text-destructive')}>{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note} vs last wk</p>}
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium capitalize">{value}</dd>
      {note && <dd className="text-xs capitalize text-destructive">{note}</dd>}
    </div>
  );
}
