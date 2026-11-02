import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthOrganizationId, useAuthToken } from '@/hooks/state';

export interface AiChart {
  type: 'bar';
  title?: string;
  labels: string[];
  values: number[];
}

export interface AiAnswer {
  answer: string;
  chart: AiChart | null;
}

export interface AiHistoryRow {
  id: number;
  question: string;
  answer: string;
  chart: AiChart | null;
  createdAt?: string;
  created_at?: string;
}

const NOT_CONFIGURED = "AI helper isn't set up on this server.";

async function aiFetch(
  path: string,
  token: string | undefined,
  organizationId: string | undefined,
  init: RequestInit,
) {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(organizationId ? { 'organization-id': organizationId } : {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data?.code === 'AI_NOT_CONFIGURED'
        ? NOT_CONFIGURED
        : data?.message || 'The AI helper could not answer that question.',
    ) as Error & { status: number; code?: string };
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}

export function useAiQuestions(enabled: boolean) {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  return useQuery({
    queryKey: ['ai', 'questions', organizationId],
    enabled,
    queryFn: () =>
      aiFetch('/ai/questions', token, organizationId, { method: 'GET' }),
  });
}

export function useAskQuestion() {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (question: string) =>
      aiFetch('/ai/ask', token, organizationId, {
        method: 'POST',
        body: JSON.stringify({ question }),
      }) as Promise<AiAnswer>,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['ai', 'questions', organizationId],
      });
    },
  });
}
