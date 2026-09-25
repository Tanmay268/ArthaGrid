import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiEnvelope, Transaction, TransactionsResponse } from '@/types/api';

export interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: 'income' | 'expense';
  category?: string;
  sortBy?: 'date' | 'amount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

const buildQuery = (filters: TransactionFilters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
};

export function useTransactions(filters: TransactionFilters) {
  const query = buildQuery(filters);
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => api.get<{ success: boolean } & TransactionsResponse>(`/api/v1/transactions?${query}`),
  });
}

export interface TransactionInput {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  merchant?: string;
  date?: string;
  description?: string;
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TransactionInput) =>
      api.post<ApiEnvelope<Transaction> & { unusual?: { flagged: boolean; score: number } }>(
        '/api/v1/transactions',
        input
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: TransactionInput & { id: string }) =>
      api.patch<ApiEnvelope<Transaction>>(`/api/v1/transactions/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/transactions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
}
