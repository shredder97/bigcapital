export const ANTHROPIC_MODEL = 'claude-sonnet-4-5';

/** Tests replace `current` so the suite never calls Anthropic. */
export const anthropicFetch = { current: fetch };

/** One Messages API call. Tests pass their own `fetchImpl`. */
export async function completeAnthropic(fetchImpl: typeof fetch, request: any) {
  const key = process.env.ANTHROPIC_API_KEY;
  try {
    if (!key) throw new Error('missing');
    const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
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
    if (!response?.ok) throw new Error('status');
    const body = await response.json();
    if (!Array.isArray(body?.content)) throw new Error('shape');
    return { stopReason: body.stop_reason ?? null, content: body.content };
  } catch {
    throw new Error('AI upstream request failed');
  }
}
