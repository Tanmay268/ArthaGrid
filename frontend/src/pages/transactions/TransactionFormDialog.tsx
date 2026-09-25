import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { toast } from '@/store/toastStore';
import { useCreateTransaction, useSuggestCategory, useUpdateTransaction } from '@/api/transactions';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/categories';
import { errorMessage, humanize } from '@/lib/utils';
import type { CategorySuggestion, Transaction } from '@/types/api';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Present = edit mode; absent = create mode. */
  transaction?: Transaction;
}

const today = () => new Date().toISOString().slice(0, 10);

export function TransactionFormDialog({ open, onClose, transaction }: Props) {
  const editing = Boolean(transaction);
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const suggest = useSuggestCategory();

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today());
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const latestRequest = useRef(0);

  // Reset the form each time it opens (with the transaction's values when editing).
  useEffect(() => {
    if (!open) return;
    setType(transaction?.type ?? 'expense');
    setCategory(transaction?.category ?? EXPENSE_CATEGORIES[0]);
    setAmount(transaction ? String(transaction.amount) : '');
    setMerchant(transaction?.merchant ?? '');
    setDescription(transaction?.description ?? '');
    setDate(transaction ? transaction.date.slice(0, 10) : today());
    setSuggestion(null);
  }, [open, transaction]);

  // Ask the classifier as the user types (debounced). Ignore answers that
  // arrive after a newer request was sent, so a slow reply can't overwrite a fresh one.
  useEffect(() => {
    if (!open) return;
    if (`${merchant}${description}`.trim().length < 3) {
      setSuggestion(null);
      return;
    }
    const handle = setTimeout(() => {
      const id = ++latestRequest.current;
      suggest.mutate(
        { merchant: merchant || undefined, description: description || undefined, type },
        { onSuccess: (res) => id === latestRequest.current && setSuggestion(res.data) }
      );
    }, 450);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant, description, type, open]);

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const pending = create.isPending || update.isPending;
  const suggested = suggestion?.suggestion;

  const changeType = (next: 'income' | 'expense') => {
    setType(next);
    setCategory(next === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
    setSuggestion(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      type,
      category,
      amount: Number(amount),
      merchant: merchant.trim() || undefined,
      description: description.trim() || undefined,
      date,
    };

    if (transaction) {
      update.mutate(
        { id: transaction._id, ...payload, merchant: merchant.trim(), description: description.trim() },
        {
          onSuccess: () => {
            toast.success('Transaction updated');
            onClose();
          },
          onError: (err) => toast.error(errorMessage(err)),
        }
      );
      return;
    }

    create.mutate(payload, {
      onSuccess: (res) => {
        toast.success('Transaction added');
        // A heads-up, never a block: the transaction is already saved either way.
        if (res.unusual?.flagged) {
          toast.info(`That amount looks unusual for ${humanize(category)} compared with your history.`);
        }
        onClose();
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Edit transaction' : 'Add a transaction'}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Type" htmlFor="tx-type">
          <Select id="tx-type" value={type} onChange={(e) => changeType(e.target.value as 'income' | 'expense')}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </Select>
        </Field>
        <Field label="Amount (₹)" htmlFor="tx-amount">
          <Input id="tx-amount" type="number" inputMode="decimal" min={0.01} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>

        <Field label="Merchant (optional)" htmlFor="tx-merchant" className="col-span-2 sm:col-span-1">
          <Input id="tx-merchant" value={merchant} maxLength={100} onChange={(e) => setMerchant(e.target.value)} placeholder="Swiggy, Netflix…" />
        </Field>
        <Field label="Date" htmlFor="tx-date" className="col-span-2 sm:col-span-1">
          <Input id="tx-date" type="date" required max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label="Description (optional)" htmlFor="tx-description" className="col-span-2">
          <Input id="tx-description" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="What was this for?" />
        </Field>

        <Field label="Category" htmlFor="tx-category" className="col-span-2">
          <Select id="tx-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </Select>
          {suggested && suggested.category !== category && (
            <button
              type="button"
              onClick={() => setCategory(suggested.category)}
              className="mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium hover:bg-muted/70"
            >
              <Sparkles className="h-3 w-3" />
              Suggested: <span className="capitalize">{humanize(suggested.category)}</span> — use it
            </button>
          )}
          {suggested && suggested.category === category && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Matches the suggestion
            </p>
          )}
        </Field>

        <div className="col-span-2 mt-1 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Add transaction'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Field({ label, htmlFor, className, children }: { label: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
