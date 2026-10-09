import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label, Select } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/ui/state';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { useDeleteTransaction, useTransactions, type TransactionFilters } from '@/api/transactions';
import { ALL_CATEGORIES } from '@/lib/categories';
import { cn, errorMessage, formatCurrency, formatDate, humanize } from '@/lib/utils';
import type { Transaction } from '@/types/api';
import { useDemoGuard } from '@/lib/demo';
import { TransactionFormDialog } from './TransactionFormDialog';

export function TransactionsPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const guard = useDemoGuard();
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, limit: 15, sortBy: 'date', sortOrder: 'desc' });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [deleting, setDeleting] = useState<Transaction | undefined>();

  const { data, isLoading, isError, refetch, isFetching } = useTransactions(filters);
  const remove = useDeleteTransaction();

  const updateFilter = (patch: Partial<TransactionFilters>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));
  const openCreate = guard(() => {
    setEditing(undefined);
    setFormOpen(true);
  });
  const openEdit = guard((t: Transaction) => {
    setEditing(t);
    setFormOpen(true);
  });

  const askDelete = guard((t: Transaction) => setDeleting(t));
  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting._id, {
      onSuccess: () => {
        toast.success('Transaction deleted');
        setDeleting(undefined);
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  const rows = data?.transactions ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Transactions"
        description="Every income and expense, newest first."
        action={
          isAdmin && (
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Add transaction
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
            <FilterField label="Type" id="filter-type">
              <Select id="filter-type" value={filters.type ?? ''} onChange={(e) => updateFilter({ type: (e.target.value || undefined) as TransactionFilters['type'] })}>
                <option value="">All</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </Select>
            </FilterField>
            <FilterField label="Category" id="filter-category">
              <Select id="filter-category" value={filters.category ?? ''} onChange={(e) => updateFilter({ category: e.target.value || undefined })}>
                <option value="">All</option>
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {humanize(c)}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Sort by" id="filter-sort" className="col-span-2 sm:col-span-1">
              <Select id="filter-sort" value={filters.sortBy} onChange={(e) => updateFilter({ sortBy: e.target.value as TransactionFilters['sortBy'] })}>
                <option value="date">Date</option>
                <option value="amount">Amount</option>
                <option value="createdAt">Recently added</option>
              </Select>
            </FilterField>
          </div>

          {isLoading && <CardSkeleton lines={6} />}
          {isError && <ErrorState message="Couldn't load transactions." onRetry={() => refetch()} />}
          {data && rows.length === 0 && (
            <EmptyState
              icon={Receipt}
              message={filters.type || filters.category ? 'No transactions match these filters.' : 'No transactions yet.'}
              action={isAdmin && !filters.type && !filters.category ? <Button size="sm" onClick={openCreate}>Add your first one</Button> : undefined}
            />
          )}

          {rows.length > 0 && (
            <>
              {/* Phones: cards. md and up: a table. Both are in the DOM; CSS picks one. */}
              <ul className="flex flex-col divide-y divide-border md:hidden">
                {rows.map((t) => (
                  <li key={t._id} className="flex items-start gap-3 py-3">
                    <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', t.type === 'income' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
                      {t.type === 'income' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium capitalize">{t.merchant || humanize(t.category)}</p>
                      <p className="truncate text-xs capitalize text-muted-foreground">
                        {t.merchant ? `${humanize(t.category)} · ` : ''}
                        {formatDate(t.date)}
                      </p>
                      {t.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.description}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={cn('tabular text-sm font-medium', t.type === 'income' && 'text-success')}>
                        {t.type === 'income' ? '+' : '−'}
                        {formatCurrency(t.amount)}
                      </span>
                      {t.balanceAfter !== undefined && <span className="tabular text-xs text-muted-foreground">Bal {formatCurrency(t.balanceAfter)}</span>}
                      {isAdmin && <RowActions onEdit={() => openEdit(t)} onDelete={() => askDelete(t)} />}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      {isAdmin && <TableHead className="w-20" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((t) => (
                      <TableRow key={t._id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(t.date)}</TableCell>
                        <TableCell className="capitalize">{humanize(t.category)}</TableCell>
                        <TableCell className="text-muted-foreground">{t.merchant || '—'}</TableCell>
                        <TableCell className="max-w-[240px] truncate text-muted-foreground">{t.description || '—'}</TableCell>
                        <TableCell className={cn('tabular text-right font-medium', t.type === 'income' && 'text-success')}>
                          {t.type === 'income' ? '+' : '−'}
                          {formatCurrency(t.amount)}
                        </TableCell>
                        <TableCell className={cn('tabular text-right text-muted-foreground', t.balanceAfter !== undefined && t.balanceAfter < 0 && 'text-destructive')}>
                          {t.balanceAfter !== undefined ? formatCurrency(t.balanceAfter) : '—'}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <RowActions onEdit={() => openEdit(t)} onDelete={() => askDelete(t)} />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {data && (
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground sm:text-sm">
                  <span className={cn(isFetching && 'opacity-60')}>
                    Page {data.pagination.page} of {data.pagination.pages} · {data.pagination.total} total
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={!data.pagination.hasPrev} onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={!data.pagination.hasNext} onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <TransactionFormDialog open={formOpen} onClose={() => setFormOpen(false)} transaction={editing} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(undefined)}
        onConfirm={confirmDelete}
        pending={remove.isPending}
        title="Delete this transaction?"
        description={deleting ? `${humanize(deleting.category)} · ${formatCurrency(deleting.amount)} on ${formatDate(deleting.date)}. It's hidden from all totals, but kept in the audit trail.` : ''}
      />
    </div>
  );
}

function FilterField({ label, id, className, children }: { label: string; id: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-1.5 sm:w-44', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label="Edit transaction">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={onDelete} aria-label="Delete transaction">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
