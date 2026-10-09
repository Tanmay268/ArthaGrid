import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, Legend, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { ArrowDownRight, ArrowUpRight, PiggyBank, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/ui/state';
import { useDashboardByCategory, useDashboardSummary, useDashboardTrends, useRecentTransactions } from '@/api/dashboard';
import { useTransactions } from '@/api/transactions';
import { useBudgets } from '@/api/budgets';
import { useAuthStore } from '@/store/authStore';
import { axisTick, CHART_COLORS, compactInr, gridStroke, tooltipStyle } from '@/lib/chart';
import { cn, formatCurrency, humanize } from '@/lib/utils';

type Series = 'income' | 'expenses' | 'net';
const SERIES: { key: Series; label: string; color: string }[] = [
  { key: 'income', label: 'Income', color: 'hsl(var(--success))' },
  { key: 'expenses', label: 'Expenses', color: 'hsl(var(--destructive))' },
  { key: 'net', label: 'Net', color: 'hsl(var(--foreground))' },
];

export function OverviewPage() {
  const role = useAuthStore((s) => s.user?.role);
  // The dashboard endpoints are analyst/admin only (same gate as the API's
  // read:analytics), so viewers get their own, smaller overview rather than
  // a page full of "forbidden" errors.
  return role === 'viewer' ? <ViewerOverview /> : <AnalystOverview />;
}

function AnalystOverview() {
  const summary = useDashboardSummary();
  const trends = useDashboardTrends('monthly');
  const byCategory = useDashboardByCategory();
  const recent = useRecentTransactions(6);
  const [visible, setVisible] = useState<Series[]>(['income', 'expenses', 'net']);
  // Always keep at least one series on so the chart never goes blank.
  const toggleSeries = (key: Series) =>
    setVisible((v) => (v.includes(key) ? (v.length > 1 ? v.filter((k) => k !== key) : v) : [...v, key]));

  const s = summary.data;
  const pieData = (byCategory.data?.expense ?? []).slice(0, 6).map((c) => ({ name: humanize(c.category), value: c.total }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Overview" description="Where your money stands, at a glance." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Income" value={s && formatCurrency(s.totalIncome)} loading={summary.isLoading} tone="success" />
        <StatCard icon={TrendingDown} label="Expenses" value={s && formatCurrency(s.totalExpenses)} loading={summary.isLoading} tone="destructive" />
        <StatCard
          icon={Wallet}
          label="Net balance"
          value={s && formatCurrency(s.netBalance)}
          loading={summary.isLoading}
          tone={s && s.netBalance < 0 ? 'destructive' : 'success'}
        />
        <StatCard icon={PiggyBank} label="Savings rate" value={s && `${s.savingsRate}%`} loading={summary.isLoading} />
      </div>
      {summary.isError && <ErrorState message="Couldn't load your summary." onRetry={() => summary.refetch()} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Income, expenses &amp; net, by month</CardTitle>
              <div className="flex gap-1.5" role="group" aria-label="Chart series">
                {SERIES.map((x) => {
                  const on = visible.includes(x.key);
                  return (
                    <button
                      key={x.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSeries(x.key)}
                      className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors', on ? 'border-foreground/30 bg-muted' : 'border-border text-muted-foreground')}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: x.color, opacity: on ? 1 : 0.3 }} />
                      {x.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {trends.isLoading && <Skeleton className="h-64 w-full" />}
            {trends.isError && <ErrorState message="Couldn't load trends." onRetry={() => trends.refetch()} />}
            {trends.data && trends.data.length === 0 && <EmptyState message="No transactions yet — add one to see your trend." />}
            {trends.data && trends.data.length > 0 && (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trends.data} margin={{ left: -8, right: 8, top: 4 }}>
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={compactInr} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                  {visible.includes('income') && <Area type="monotone" dataKey="income" name="Income" stroke="hsl(var(--success))" fill="url(#incomeFill)" strokeWidth={2} />}
                  {visible.includes('expenses') && <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(var(--destructive))" fill="url(#expenseFill)" strokeWidth={2} />}
                  {visible.includes('net') && <Area type="monotone" dataKey="net" name="Net" stroke="hsl(var(--foreground))" fill="none" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2 }} />}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Where it goes</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.isLoading && <Skeleton className="h-64 w-full" />}
            {byCategory.data && pieData.length === 0 && <EmptyState message="No expenses yet." />}
            {pieData.length > 0 && (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="hsl(var(--card))">
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {pieData.map((d, i) => (
                    <li key={d.name} className="flex items-center gap-1.5 truncate">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="truncate capitalize text-muted-foreground">{d.name}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent transactions</CardTitle>
            <Link to="/transactions" className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recent.isLoading && <Skeleton className="h-24 w-full" />}
          {recent.isError && <ErrorState message="Couldn't load recent transactions." onRetry={() => recent.refetch()} />}
          {recent.data && recent.data.length === 0 && <EmptyState icon={Receipt} message="No transactions yet." />}
          {recent.data && recent.data.length > 0 && (
            <ul className="divide-y divide-border">
              {recent.data.map((t) => (
                <TransactionRow key={t._id} category={t.category} date={t.date} amount={t.amount} type={t.type} merchant={t.merchant} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Viewers can read transactions and budgets, but not the analytics endpoints.
function ViewerOverview() {
  const recent = useTransactions({ page: 1, limit: 8, sortBy: 'date', sortOrder: 'desc' });
  const budgets = useBudgets();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Overview" description="Your latest activity and budgets." />

      <Card>
        <CardContent className="flex items-start gap-3 pt-4 text-sm text-muted-foreground">
          <Badge variant="outline" className="mt-0.5 shrink-0">Viewer</Badge>
          <p>
            Charts, forecasts, and insights are available to Analyst and Admin accounts. Ask an admin to upgrade your role if you need them.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latest transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.isLoading && <Skeleton className="h-24 w-full" />}
            {recent.isError && <ErrorState message="Couldn't load transactions." onRetry={() => recent.refetch()} />}
            {recent.data && recent.data.transactions.length === 0 && <EmptyState icon={Receipt} message="No transactions yet." />}
            {recent.data && recent.data.transactions.length > 0 && (
              <ul className="divide-y divide-border">
                {recent.data.transactions.map((t) => (
                  <TransactionRow key={t._id} category={t.category} date={t.date} amount={t.amount} type={t.type} merchant={t.merchant} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Budgets this month</CardTitle>
              <Link to="/budgets" className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {budgets.isLoading && <Skeleton className="h-24 w-full" />}
            {budgets.data && budgets.data.length === 0 && <EmptyState icon={Wallet} message="No budgets set up yet." />}
            {budgets.data && budgets.data.length > 0 && (
              <ul className="flex flex-col gap-2 text-sm">
                {budgets.data.slice(0, 5).map((b) => (
                  <li key={b.id} className="flex items-center justify-between">
                    <span className="capitalize">{humanize(b.category)}</span>
                    <Badge variant={b.isOverBudget ? 'destructive' : b.percentage >= 80 ? 'warning' : 'success'}>{b.percentage}%</Badge>
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

function TransactionRow({
  category,
  date,
  amount,
  type,
  merchant,
}: {
  category: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  merchant?: string | null;
}) {
  const Icon = type === 'income' ? ArrowUpRight : ArrowDownRight;
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', type === 'income' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium capitalize">{merchant || humanize(category)}</p>
        <p className="truncate text-xs capitalize text-muted-foreground">
          {merchant ? `${humanize(category)} · ` : ''}
          {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </p>
      </div>
      <span className={cn('tabular shrink-0 font-medium', type === 'income' && 'text-success')}>
        {type === 'income' ? '+' : '−'}
        {formatCurrency(amount)}
      </span>
    </li>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value?: string;
  loading?: boolean;
  tone?: 'success' | 'destructive';
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium">{label}</span>
          <Icon className="h-4 w-4" />
        </div>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-24" />
        ) : (
          <p className={cn('tabular text-lg font-semibold sm:text-xl', tone === 'success' && 'text-success', tone === 'destructive' && 'text-destructive')}>
            {value ?? '—'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
