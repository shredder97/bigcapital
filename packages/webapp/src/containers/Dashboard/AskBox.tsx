import React, { useState } from 'react';
import { BarChart } from '@/components/BarChart';
import {
  AiAnswer,
  AiChart,
  useAiQuestions,
  useAskQuestion,
} from '@/hooks/query/ai';

function Chart({ chart }: { chart: AiChart | null }) {
  return chart ? (
    <BarChart title={chart.title} labels={chart.labels} values={chart.values} />
  ) : null;
}

export function AskBox() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [latest, setLatest] = useState<AiAnswer | null>(null);
  const history = useAiQuestions(open);
  const ask = useAskQuestion();

  return (
    <div>
      <button
        type="button"
        className="ask-launcher"
        data-testId="ask-ai-open"
        onClick={() => setOpen((value) => !value)}
      >
        Ask
      </button>
      {open ? (
        <div className="ask-panel" data-testId="ask-ai-panel">
          <div className="ask-panel__title">Ask</div>
          {(history.data ?? []).map((row) => (
            <div key={row.id}>
              <div>{row.question}</div>
              <div>{row.answer}</div>
              <Chart chart={row.chart} />
            </div>
          ))}
          {latest ? (
            <div>
              <div>{latest.answer}</div>
              <Chart chart={latest.chart} />
            </div>
          ) : null}
          {ask.error ? <p>{ask.error.message}</p> : null}
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
            <button type="submit">Ask</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
