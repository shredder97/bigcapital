import { rawRequest } from '@bigcapital/sdk-ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiFetcher } from '@/hooks/useRequest';

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
  createdAt: string;
}

const NOT_CONFIGURED = "AI helper isn't set up on this server.";

async function requestAi<T>(
  fetcher: ReturnType<typeof useApiFetcher>,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  try {
    return await rawRequest<T>(fetcher, method, path, body);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('HTTP 503')) {
      const notConfigured = new Error(NOT_CONFIGURED) as Error & {
        status: number;
      };
      notConfigured.status = 503;
      throw notConfigured;
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (question: string) =>
      requestAi<AiAnswer>(fetcher, 'POST', '/api/ai/ask', { question }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['ai', 'questions'] }),
  });
}
