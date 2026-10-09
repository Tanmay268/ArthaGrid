import { useState } from 'react';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/ui/state';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { useBudgets, useCreateBudget, useDeleteBudget } from '@/api/budgets';
import { EXPENSE_CATEGORIES } from '@/lib/categories';
import { useDemoGuard } from '@/lib/demo';
import { cn, errorMessage, formatCurrency, humanize } from '@/lib/utils';
import type { Budget } from '@/types/api';

// Over 100% is red, 80%+ is an early warning, otherwise calm.
const tone = (b: Budget) => (b.isOverBudget ? 'destructive' : b.percentage >= 80 ? 'warning' : 'ok');

export function BudgetsPage() {
  const budgets = useBudgets();
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Budget | undefined>();
  const remove = useDeleteBudget();
  const guard = useDemoGuard();
  const openCreate = guard(() => setCreating(true));
  const askRemove = guard((b: Budget) => setRemoving(b));

  const confirmRemove = () => {
    if (!removing) return;
    remove.mutate(removing.id, {
      onSuccess: () => {
        toast.success('Budget removed');
        setRemoving(undefined);
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Budgets"
        description="Monthly spending limits and how much of each you've used so far."
        action={
          isAdmin && (
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              New budget
            </Button>
          )
        }
      />

      {budgets.isLoading && (
        <Card>
          <CardContent className="p-4">
            <CardSkeleton lines={4} />
          </CardContent>
        </Card>
      )}
      {budgets.isError && <ErrorState message="Couldn't load budgets." onRetry={() => budgets.refetch()} />}
      {budgets.data && budgets.data.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              icon={Wallet}
              message={isAdmin ? 'No budgets yet. Set a monthly limit for a category to start tracking it.' : 'No budgets have been set up yet.'}
              action={isAdmin ? <Button size="sm" onClick={openCreate}>Create the first budget</Button> : undefined}
            />
          </CardContent>
        </Card>
      )}

      {budgets.data && budgets.data.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.data.map((b) => {
            const t = tone(b);
            return (
              <Card key={b.id}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{humanize(b.category)}</span>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8 hover:text-destructive" onClick={() => askRemove(b)} aria-label={`Remove ${humanize(b.category)} budget`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <Progress
                    value={b.percentage}
                    indicatorClassName={cn(t === 'destructive' && 'bg-destructive', t === 'warning' && 'bg-warning', t === 'ok' && 'bg-success')}
                  />
                  <div className="flex items-end justify-between text-sm">
                    <div>
                      <p className="tabular font-semibold">{formatCurrency(b.spent)}</p>
                      <p className="text-xs text-muted-foreground">of {formatCurrency(b.monthlyLimit)}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('tabular font-semibold', t === 'destructive' && 'text-destructive', t === 'warning' && 'text-warning')}>{b.percentage}%</p>
                      <p className="text-xs text-muted-foreground">
                        {b.isOverBudget ? `${formatCurrency(-b.remaining)} over` : `${formatCurrency(b.remaining)} left`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <NewBudgetDialog open={creating} onClose={() => setCreating(false)} />
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(undefined)}
        onConfirm={confirmRemove}
        pending={remove.isPending}
        confirmLabel="Remove"
        title="Remove this budget?"
        description={removing ? `Stops tracking ${humanize(removing.category)}. Your transactions aren't affected.` : ''}
      />
    </div>
  );
}

function NewBudgetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const create = useCreateBudget();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { category, monthlyLimit: Number(monthlyLimit) },
      {
        onSuccess: () => {
          toast.success('Budget created');
          setMonthlyLimit('');
          onClose();
        },
        onError: (err) => toast.error(errorMessage(err)),
      }
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title="New budget" description="One monthly limit per expense category.">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget-category">Category</Label>
          <Select id="budget-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget-limit">Monthly limit (₹)</Label>
          <Input id="budget-limit" type="number" inputMode="decimal" min={1} step="0.01" required value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} />
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create budget'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
