import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiEnvelope, CopilotResponse } from '@/types/api';

export function useAskCopilot() {
  return useMutation({
    mutationFn: (question: string) => api.post<ApiEnvelope<CopilotResponse>>('/api/v1/copilot/ask', { question }),
  });
}
