import React from 'react';

export function BarChart({
  title,
  labels,
  values,
}: {
  title?: string;
  labels: string[];
  values: number[];
}) {
  const max = Math.max(0, ...values);
  return (
    <div className="ask-bar-chart">
      {title ? <div>{title}</div> : null}
      <div
        aria-hidden="true"
        style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}
      >
        {values.map((value, index) => (
          <div
            key={labels[index]}
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
            }}
          >
            <div
              className="ask-bar-chart__bar"
              style={{
                height: max ? `${(value / max) * 100}%` : 0,
                background: '#1a2744',
              }}
            />
            <span>{labels[index]}</span>
          </div>
        ))}
      </div>
      <table className="ask-bar-chart__table" hidden>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Label</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label, index) => (
            <tr key={label}>
              <td>{label}</td>
              <td>{values[index]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
