import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AnalyticsMetrics,
  AnomalyTransaction,
  ApiEnvelope,
  ForecastResponse,
  HealthScore,
  Insight,
  RecurringExpense,
  WeeklyReport,
} from '@/types/api';

export function useAnalyticsMetrics() {
  return useQuery({
    queryKey: ['analytics', 'metrics'],
    queryFn: () => api.get<ApiEnvelope<AnalyticsMetrics>>('/api/v1/analytics/metrics'),
    select: (res) => res.data,
  });
}

export function useForecast(months = 3, metric: 'income' | 'expenses' | 'net' = 'expenses') {
  return useQuery({
    queryKey: ['analytics', 'forecast', months, metric],
    queryFn: () =>
      api.get<ApiEnvelope<ForecastResponse>>(`/api/v1/analytics/forecast?months=${months}&metric=${metric}`),
    select: (res) => res.data,
  });
}

export function useAnomalies() {
  return useQuery({
    queryKey: ['analytics', 'anomalies'],
    queryFn: () => api.get<ApiEnvelope<AnomalyTransaction[]>>('/api/v1/analytics/anomalies'),
    select: (res) => res.data,
  });
}

export function useRecurringExpenses() {
  return useQuery({
    queryKey: ['analytics', 'recurring'],
    queryFn: () => api.get<ApiEnvelope<RecurringExpense[]>>('/api/v1/analytics/recurring'),
    select: (res) => res.data,
  });
}

export function useHealthScore() {
  return useQuery({
    queryKey: ['analytics', 'health-score'],
    queryFn: () => api.get<ApiEnvelope<HealthScore>>('/api/v1/analytics/health-score'),
    select: (res) => res.data,
  });
}

export function useInsights() {
  return useQuery({
    queryKey: ['analytics', 'insights'],
    queryFn: () => api.get<ApiEnvelope<Insight[]>>('/api/v1/analytics/insights'),
    select: (res) => res.data,
  });
}

export function useWeeklyReport() {
  return useQuery({
    queryKey: ['analytics', 'weekly-report'],
    queryFn: () => api.get<ApiEnvelope<WeeklyReport>>('/api/v1/analytics/weekly-report'),
    select: (res) => res.data,
  });
}
