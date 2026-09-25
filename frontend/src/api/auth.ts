import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { ApiEnvelope, AuthResponseData } from '@/types/api';

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post<ApiEnvelope<AuthResponseData>>('/api/v1/auth/login', input),
    onSuccess: (res) => setSession(res.data.user, res.data.accessToken),
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      api.post<ApiEnvelope<AuthResponseData>>('/api/v1/auth/register', input),
    onSuccess: (res) => setSession(res.data.user, res.data.accessToken),
  });
}

export function useLogout() {
  const clearSession = useAuthStore((s) => s.clearSession);

  return useMutation({
    mutationFn: () => api.post('/api/v1/auth/logout', {}),
    onSettled: () => clearSession(), // clear locally even if the request itself failed
  });
}
