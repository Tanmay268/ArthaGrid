import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Spinner, ErrorState, EmptyState } from '@/components/ui/state';
import { useAuthStore } from '@/store/authStore';
import { useBudgets, useCreateBudget, useDeleteBudget } from '@/api/budgets';
import { formatCurrency } from '@/lib/utils';
import { ApiError } from '@/lib/api';

const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'housing',
  'utilities',
  'healthcare',
  'entertainment',
  'education',
  'shopping',
  'other_expense',
];

export function BudgetsPage() {
  const budgets = useBudgets();
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && <NewBudgetForm />}

      <Card>
        <CardHeader>
          <CardTitle>This month's budgets</CardTitle>
        </CardHeader>
        <CardContent>
          {budgets.isLoading && <Spinner />}
          {budgets.isError && <ErrorState message="Couldn't load budgets." />}
          {budgets.data && budgets.data.length === 0 && (
            <EmptyState message={isAdmin ? 'No budgets yet — create one above.' : 'No budgets have been set up yet.'} />
          )}
          {budgets.data && budgets.data.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {budgets.data.map((b) => (
                <BudgetCard key={b.id} budgetId={b.id} category={b.category} spent={b.spent} limit={b.monthlyLimit} percentage={b.percentage} isOverBudget={b.isOverBudget} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BudgetCard({
  budgetId,
  category,
  spent,
  limit,
  percentage,
  isOverBudget,
  isAdmin,
}: {
  budgetId: string;
  category: string;
  spent: number;
  limit: number;
  percentage: number;
  isOverBudget: boolean;
  isAdmin: boolean;
}) {
  const deleteBudget = useDeleteBudget();

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium capitalize">{category.replace(/_/g, ' ')}</span>
        {isAdmin && (
          <button
            className="text-xs text-muted-foreground hover:text-destructive"
            onClick={() => deleteBudget.mutate(budgetId)}
            disabled={deleteBudget.isPending}
          >
            Remove
          </button>
        )}
      </div>
      <Progress value={percentage} indicatorClassName={isOverBudget ? 'bg-destructive' : 'bg-primary'} />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {formatCurrency(spent)} / {formatCurrency(limit)}
        </span>
        <span className={isOverBudget ? 'font-medium text-destructive' : ''}>{percentage}%</span>
      </div>
    </div>
  );
}

function NewBudgetForm() {
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const createBudget = useCreateBudget();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBudget.mutate(
      { category, monthlyLimit: Number(monthlyLimit) },
      { onSuccess: () => setMonthlyLimit('') }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a budget</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category</Label>
            <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-48">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="limit">Monthly limit (₹)</Label>
            <Input
              id="limit"
              type="number"
              min={1}
              step="0.01"
              required
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(e.target.value)}
              className="w-40"
            />
          </div>
          <Button type="submit" disabled={createBudget.isPending}>
            {createBudget.isPending ? 'Creating…' : 'Create budget'}
          </Button>
          {createBudget.isError && (
            <p className="w-full text-sm text-destructive">
              {createBudget.error instanceof ApiError ? createBudget.error.message : 'Something went wrong.'}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
