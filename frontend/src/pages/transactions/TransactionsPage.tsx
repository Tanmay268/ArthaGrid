import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Spinner, ErrorState, EmptyState } from '@/components/ui/state';
import { useAuthStore } from '@/store/authStore';
import { useDeleteTransaction, useTransactions, type TransactionFilters } from '@/api/transactions';
import { formatCurrency } from '@/lib/utils';
import { NewTransactionForm } from './NewTransactionForm';

const CATEGORIES = [
  'salary', 'freelance', 'investment', 'gift', 'other_income',
  'food', 'transport', 'housing', 'utilities', 'healthcare',
  'entertainment', 'education', 'shopping', 'other_expense',
];

export function TransactionsPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, limit: 20, sortBy: 'date', sortOrder: 'desc' });

  const { data, isLoading, isError } = useTransactions(filters);
  const deleteTransaction = useDeleteTransaction();

  const updateFilter = (patch: Partial<TransactionFilters>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && <NewTransactionForm />}

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-type">Type</Label>
              <Select
                id="filter-type"
                value={filters.type ?? ''}
                onChange={(e) => updateFilter({ type: (e.target.value || undefined) as TransactionFilters['type'] })}
                className="w-36"
              >
                <option value="">All</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-category">Category</Label>
              <Select
                id="filter-category"
                value={filters.category ?? ''}
                onChange={(e) => updateFilter({ category: e.target.value || undefined })}
                className="w-44"
              >
                <option value="">All</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-sort">Sort by</Label>
              <Select
                id="filter-sort"
                value={filters.sortBy}
                onChange={(e) => updateFilter({ sortBy: e.target.value as TransactionFilters['sortBy'] })}
                className="w-36"
              >
                <option value="date">Date</option>
                <option value="amount">Amount</option>
                <option value="createdAt">Created</option>
              </Select>
            </div>
          </div>

          {isLoading && <Spinner />}
          {isError && <ErrorState message="Couldn't load transactions." />}
          {data && data.transactions.length === 0 && <EmptyState message="No transactions match these filters." />}

          {data && data.transactions.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {isAdmin && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((t) => (
                    <TableRow key={t._id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(t.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="capitalize">{t.category.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-muted-foreground">{t.merchant || '—'}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">
                        {t.description || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={t.type === 'income' ? 'success' : 'default'}>
                          {t.type === 'income' ? '+' : '-'}
                          {formatCurrency(t.amount)}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <button
                            className="text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => deleteTransaction.mutate(t._id)}
                            disabled={deleteTransaction.isPending}
                          >
                            Delete
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Page {data.pagination.page} of {data.pagination.pages} ({data.pagination.total} total)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!data.pagination.hasPrev}
                    onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!data.pagination.hasNext}
                    onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
