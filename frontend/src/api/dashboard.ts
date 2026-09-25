import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiEnvelope, CategoryBreakdown, DashboardSummary, Transaction, TrendPoint } from '@/types/api';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get<ApiEnvelope<DashboardSummary>>('/api/v1/dashboard/summary'),
    select: (res) => res.data,
  });
}

export function useDashboardTrends(period: 'monthly' | 'weekly' = 'monthly') {
  return useQuery({
    queryKey: ['dashboard', 'trends', period],
    queryFn: () => api.get<ApiEnvelope<TrendPoint[]>>(`/api/v1/dashboard/trends?period=${period}`),
    select: (res) => res.data,
  });
}

export function useDashboardByCategory() {
  return useQuery({
    queryKey: ['dashboard', 'by-category'],
    queryFn: () => api.get<ApiEnvelope<CategoryBreakdown>>('/api/v1/dashboard/by-category'),
    select: (res) => res.data,
  });
}

export function useRecentTransactions(limit = 5) {
  return useQuery({
    queryKey: ['dashboard', 'recent', limit],
    queryFn: () => api.get<ApiEnvelope<Transaction[]>>(`/api/v1/dashboard/recent?limit=${limit}`),
    select: (res) => res.data,
  });
}
