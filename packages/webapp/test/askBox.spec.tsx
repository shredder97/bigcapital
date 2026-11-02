// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter, Route, Switch } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AskBox } from '@/containers/Dashboard/AskBox';
import { BarChart } from '@/components/BarChart';

vi.mock('@/hooks/state', () => ({
  useAuthToken: () => 'test-token',
  useAuthOrganizationId: () => 'org-1',
}));

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

describe('BarChart', () => {
  it('renders one bar and one hidden table row per point', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(
        <BarChart
          title="Fuel"
          labels={['Jan', 'Feb', 'Mar']}
          values={[2, 4, 1]}
        />,
      );
    });

    expect(container.querySelectorAll('.ask-bar-chart__bar')).toHaveLength(3);
    const table = container.querySelector('table');
    expect(table?.hasAttribute('hidden')).toBe(true);
    expect(table?.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(container.textContent).toContain('Fuel');
    root.unmount();
  });
});

describe('AskBox', () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/ai/questions')) {
        return jsonResponse([
          {
            id: 1,
            question: 'Past fuel question',
            answer: 'Saved answer',
            chart: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ]);
      }
      return jsonResponse({ answer: 'unused', chart: null });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function renderAt(path: string) {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    act(() => {
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <Switch>
              <Route path="/customers" render={() => <h1>Customers page</h1>} />
              <Route path="/" render={() => <h1>Home page</h1>} />
            </Switch>
            <AskBox />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
  }

  it('renders the chat button on a non-home route and does not load history until the panel opens', async () => {
    renderAt('/customers');

    expect(container.textContent).toContain('Customers page');
    expect(container.textContent).not.toContain('Home page');
    expect(
      container.querySelector('[data-testId="ask-ai-open"]'),
    ).not.toBeNull();
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes('/ai/questions'),
      ),
    ).toBe(false);

    await act(async () => {
      container
        .querySelector('[data-testId="ask-ai-open"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Past fuel question');
    expect(
      fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes('/ai/questions'),
      ),
    ).toHaveLength(1);
  });

  it('shows the answer and chart, and the not-set-up message on 503', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/ai/questions')) return jsonResponse([]);
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (body.question === 'broken') {
        return jsonResponse({ code: 'AI_NOT_CONFIGURED' }, 503);
      }
      return jsonResponse({
        answer: 'You are making money.',
        chart: {
          type: 'bar',
          title: 'Profit',
          labels: ['Q1', 'Q2'],
          values: [4, 9],
        },
      });
    });
    renderAt('/customers');
    await act(async () => {
      container
        .querySelector('[data-testId="ask-ai-open"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const input = container.querySelector(
      '[data-testId="ask-ai-input"]',
    ) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, 'Am I making money?');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });

    expect(container.textContent).toContain('You are making money.');
    expect(container.querySelectorAll('.ask-bar-chart__bar')).toHaveLength(2);

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, 'broken');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });

    expect(container.textContent).toContain(
      "AI helper isn't set up on this server.",
    );
  });
});
