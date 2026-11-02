import { Logger } from '@nestjs/common';
import {
  ANTHROPIC_MODEL,
  AnthropicLlmClient,
  LlmCompletionRequest,
} from './AnthropicLlmClient';

const KEY = 'sk-ant-unit-test-not-a-real-key';

function request(signal = new AbortController().signal): LlmCompletionRequest {
  return {
    system: 'Read only.',
    messages: [{ role: 'user', content: 'How much did I spend?' }],
    tools: [],
    maxTokens: 1024,
    signal,
  };
}

describe('AnthropicLlmClient', () => {
  const logs: string[] = [];
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let consoleLog: jest.SpyInstance;
  let consoleError: jest.SpyInstance;
  let consoleWarn: jest.SpyInstance;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = KEY;
    logs.length = 0;
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation((msg) => {
      logs.push(String(msg));
    });
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((msg) => {
        logs.push(String(msg));
      });
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation((msg) => {
      logs.push(String(msg));
    });
    consoleLog = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.map(String).join(' '));
    });
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation((...args) => {
        logs.push(args.map(String).join(' '));
      });
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation((...args) => {
      logs.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    consoleLog.mockRestore();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  it('builds the Messages API request from the env key', async () => {
    const signal = new AbortController().signal;
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'answer',
            input: { answer: 'Fine.' },
          },
        ],
      }),
    });
    const client = new AnthropicLlmClient(fetchImpl);

    const response = await client.complete(request(signal));
    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body);

    expect(init.method).toBe('POST');
    expect(String(fetchImpl.mock.calls[0][0])).toContain(
      'api.anthropic.com/v1/messages',
    );
    expect(init.headers['x-api-key']).toBe(KEY);
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    expect(init.signal).toBe(signal);
    expect(body.model).toBe(ANTHROPIC_MODEL);
    expect(body.max_tokens).toBe(1024);
    expect(response.content[0]).toMatchObject({
      type: 'tool_use',
      name: 'answer',
    });
    expect(logs.join('\n')).not.toContain(KEY);
  });

  it('does not put the key or the raw upstream error in a thrown error', async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValue(new Error(`socket hang up ${KEY}`));
    const client = new AnthropicLlmClient(fetchImpl);

    const error = await client.complete(request()).catch((caught) => caught);

    expect(String(error)).not.toContain(KEY);
    expect(String(error)).not.toContain('socket hang up');
    expect(logs.join('\n')).not.toContain(KEY);
  });

  it('hides a non-OK upstream body', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => `invalid x-api-key ${KEY}`,
      json: async () => ({ error: { message: KEY } }),
    });
    const client = new AnthropicLlmClient(fetchImpl);

    const error = await client.complete(request()).catch((caught) => caught);

    expect(String(error)).not.toContain(KEY);
    expect(String(error)).not.toContain('invalid x-api-key');
  });

  it('rejects malformed upstream JSON without echoing it', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token { in JSON');
      },
    });
    const client = new AnthropicLlmClient(fetchImpl);

    const error = await client.complete(request()).catch((caught) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain(KEY);
    expect(String(error)).not.toContain('Unexpected token');
  });

  it('rejects a body whose content is not tool blocks', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stop_reason: 'end_turn',
        content: 'not-json-blocks',
      }),
    });
    const client = new AnthropicLlmClient(fetchImpl);

    await expect(client.complete(request())).rejects.toThrow();
  });
});
