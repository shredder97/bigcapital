export const ANTHROPIC_MODEL = 'claude-sonnet-4-5';
export const anthropicFetch = { current: fetch };

export async function completeAnthropic(fetchImpl: typeof fetch, request: any) {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
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
    const body = response?.ok ? await response.json() : null;
    if (!Array.isArray(body?.content)) throw new Error('shape');
    return { stopReason: body.stop_reason ?? null, content: body.content };
  } catch {
    throw new Error('AI upstream request failed');
  }
}
