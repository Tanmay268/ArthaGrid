import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AdminStats, ApiEnvelope } from '@/types/api';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<ApiEnvelope<AdminStats>>('/api/v1/admin/stats'),
    select: (res) => res.data,
    refetchInterval: 30_000, // live-ish without hammering a free-tier server
  });
}
