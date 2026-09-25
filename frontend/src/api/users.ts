import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiEnvelope, User } from '@/types/api';

export function useMe() {
  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => api.get<ApiEnvelope<User>>('/api/v1/users/me'),
    select: (res) => res.data,
  });
}

export function useUpdateMe() {
  return useMutation({
    mutationFn: (input: { name?: string; password?: string; weeklyReport?: boolean }) =>
      api.patch<ApiEnvelope<User>>('/api/v1/users/me', input),
  });
}
