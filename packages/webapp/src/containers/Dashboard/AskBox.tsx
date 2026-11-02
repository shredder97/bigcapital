import React, { useState } from 'react';
import { BarChart } from '@/components/BarChart';
import {
  AiAnswer,
  AiHistoryRow,
  useAiQuestions,
  useAskQuestion,
} from '@/hooks/query/ai';

const NOT_CONFIGURED = "AI helper isn't set up on this server.";

function historyRows(data: unknown): AiHistoryRow[] {
  if (Array.isArray(data)) return data;
  const record = data as {
    questions?: AiHistoryRow[];
    results?: AiHistoryRow[];
  };
  return record?.questions || record?.results || [];
}

export function AskBox() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [latest, setLatest] = useState<AiAnswer | null>(null);
  const history = useAiQuestions(open);
  const ask = useAskQuestion();
  const error = ask.error as
    | (Error & { status?: number; code?: string })
    | null;
  const rows = historyRows(history.data);

  return (
    <div>
      <button
        type="button"
        data-testId="ask-ai-open"
        onClick={() => setOpen((value) => !value)}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 20,
          border: 0,
          borderRadius: 999,
          padding: '10px 16px',
          background: '#1a2744',
          color: '#f3ebdf',
        }}
      >
        Ask
      </button>
      {open ? (
        <div
          data-testId="ask-ai-panel"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 64,
            zIndex: 20,
            width: 320,
            maxHeight: 420,
            overflow: 'auto',
            padding: 16,
            background: '#f3ebdf',
            color: '#1a2744',
          }}
        >
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 24 }}>
            Ask
          </div>
          {rows.map((row) => (
            <div key={row.id} data-testId="ask-ai-history-item">
              <div>{row.question}</div>
              <div>{row.answer}</div>
              {row.chart?.type === 'bar' ? (
                <BarChart
                  title={row.chart.title}
                  labels={row.chart.labels}
                  values={row.chart.values}
                />
              ) : null}
            </div>
          ))}
          {latest ? (
            <div>
              <div>{latest.answer}</div>
              {latest.chart ? (
                <BarChart
                  title={latest.chart.title}
                  labels={latest.chart.labels}
                  values={latest.chart.values}
                />
              ) : null}
            </div>
          ) : null}
          {error?.status === 503 || error?.code === 'AI_NOT_CONFIGURED' ? (
            <p>{NOT_CONFIGURED}</p>
          ) : error ? (
            <p>{error.message}</p>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const next = question.trim();
              if (!next) return;
              void ask
                .mutateAsync(next)
                .then((result) => {
                  setLatest(result);
                  setQuestion('');
                })
                .catch(() => undefined);
            }}
          >
            <input
              data-testId="ask-ai-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={500}
            />
            <button type="submit" data-testId="ask-ai-send">
              Ask
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
