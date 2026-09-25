import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiEnvelope, Budget } from '@/types/api';

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: () => api.get<ApiEnvelope<Budget[]>>('/api/v1/budgets'),
    select: (res) => res.data,
  });
}

export interface BudgetInput {
  category: string;
  monthlyLimit: number;
  isActive?: boolean;
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BudgetInput) => api.post<ApiEnvelope<Budget>>('/api/v1/budgets', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<BudgetInput> & { id: string }) =>
      api.patch<ApiEnvelope<Budget>>(`/api/v1/budgets/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/budgets/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  });
}
