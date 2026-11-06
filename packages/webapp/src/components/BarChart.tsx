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
      <div className="ask-bar-chart__bars">
        {values.map((value, index) => (
          <div key={labels[index]} className="ask-bar-chart__col">
            <div
              className="ask-bar-chart__bar"
              style={{ height: max ? `${(value / max) * 100}%` : 0 }}
              aria-label={`${labels[index]} ${value}`}
            />
            <span>{labels[index]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
