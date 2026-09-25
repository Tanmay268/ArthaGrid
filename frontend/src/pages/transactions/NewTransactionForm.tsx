import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { useCreateTransaction } from '@/api/transactions';

const INCOME_CATEGORIES = ['salary', 'freelance', 'investment', 'gift', 'other_income'];
const EXPENSE_CATEGORIES = [
  'food', 'transport', 'housing', 'utilities', 'healthcare',
  'entertainment', 'education', 'shopping', 'other_expense',
];

export function NewTransactionForm() {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const createTransaction = useCreateTransaction();

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleTypeChange = (next: 'income' | 'expense') => {
    setType(next);
    setCategory(next === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTransaction.mutate(
      { type, category, amount: Number(amount), merchant: merchant || undefined, description: description || undefined },
      {
        onSuccess: (res) => {
          setAmount('');
          setMerchant('');
          setDescription('');
          if (res.unusual?.flagged) {
            // A lightweight, non-blocking nudge — the transaction is already saved either way.
            window.alert(
              `Saved. Heads up: this amount looks unusual for ${category.replace(/_/g, ' ')} (z-score ${res.unusual.score}).`
            );
          }
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a transaction</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Type</Label>
            <Select id="type" value={type} onChange={(e) => handleTypeChange(e.target.value as 'income' | 'expense')} className="w-32">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category</Label>
            <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-44">
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input id="amount" type="number" min={0.01} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-32" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="merchant">Merchant (optional)</Label>
            <Input id="merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Netflix" className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="w-48" />
          </div>
          <Button type="submit" disabled={createTransaction.isPending}>
            {createTransaction.isPending ? 'Saving…' : 'Add'}
          </Button>
        </form>
        {createTransaction.isError && (
          <p className="mt-2 text-sm text-destructive">
            {createTransaction.error instanceof ApiError ? createTransaction.error.message : 'Something went wrong.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
