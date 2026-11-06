import { rawRequest } from '@bigcapital/sdk-ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiFetcher } from '@/hooks/useRequest';

export type AiChart = {
  type: 'bar';
  title?: string;
  labels: string[];
  values: number[];
};
export type AiAnswer = { answer: string; chart: AiChart | null };
export type AiHistoryRow = AiAnswer & {
  id: number;
  question: string;
  createdAt: string;
};

const NOT_CONFIGURED = "AI helper isn't set up on this server.";

export async function requestAi<T>(
  fetcher: ReturnType<typeof useApiFetcher>,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  try {
    return await rawRequest<T>(fetcher, method, path, body);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('HTTP 503')) {
      throw Object.assign(new Error(NOT_CONFIGURED), { status: 503 });
    }
    throw error;
  }
}

export function useAiQuestions(enabled: boolean) {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  return useQuery({
    queryKey: ['ai', 'questions'],
    enabled,
    queryFn: () =>
      requestAi<AiHistoryRow[]>(fetcher, 'GET', '/api/ai/questions'),
  });
}

export function useAskQuestion() {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  const client = useQueryClient();
  return useMutation({
    mutationFn: (question: string) =>
      requestAi<AiAnswer>(fetcher, 'POST', '/api/ai/ask', { question }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['ai', 'questions'] }),
  });
}
