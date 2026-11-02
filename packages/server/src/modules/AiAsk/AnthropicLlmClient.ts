export const ANTHROPIC_MODEL = 'claude-sonnet-4-5';
export const LLM_CLIENT = Symbol('LLM_CLIENT');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export interface LlmToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LlmToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LlmToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export interface LlmTextBlock {
  type: 'text';
  text: string;
}

export type LlmContentBlock =
  | LlmToolUseBlock
  | LlmToolResultBlock
  | LlmTextBlock;

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string | LlmContentBlock[];
}

export interface LlmCompletionRequest {
  system: string;
  messages: LlmMessage[];
  tools: LlmToolDefinition[];
  maxTokens: number;
  signal: AbortSignal;
}

export interface LlmCompletionResponse {
  stopReason: string | null;
  content: LlmContentBlock[];
}

export interface LlmClient {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}

export class AnthropicLlmClient implements LlmClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async complete(
    request: LlmCompletionRequest,
  ): Promise<LlmCompletionResponse> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('AI upstream request failed');

    let response: Response;
    try {
      response = await this.fetchImpl(ANTHROPIC_URL, {
        method: 'POST',
        signal: request.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: request.maxTokens,
          system: request.system,
          tools: request.tools,
          messages: request.messages,
        }),
      });
    } catch {
      throw new Error('AI upstream request failed');
    }

    if (!response.ok) throw new Error('AI upstream request failed');

    let body: { stop_reason?: string; content?: unknown };
    try {
      body = await response.json();
    } catch {
      throw new Error('AI upstream request failed');
    }
    if (!body || !Array.isArray(body.content)) {
      throw new Error('AI upstream request failed');
    }
    return {
      stopReason: body.stop_reason ?? null,
      content: body.content as LlmContentBlock[],
    };
  }
}
