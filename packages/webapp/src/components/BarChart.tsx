import React from 'react';
import './Ask.css';

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
      <div className="ask-bar-chart__bars" aria-hidden="true">
        {values.map((value, index) => (
          <div key={labels[index]} className="ask-bar-chart__col">
            <div
              className="ask-bar-chart__bar"
              style={{ height: max ? `${(value / max) * 100}%` : 0 }}
            />
            <span>{labels[index]}</span>
          </div>
        ))}
      </div>
      <table className="ask-bar-chart__table" hidden>
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
