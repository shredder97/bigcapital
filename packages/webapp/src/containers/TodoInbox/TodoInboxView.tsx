import { useState } from 'react';
import { answerTodo } from './answer';
import { categoryTip, categoryToTransactionType, toTodoKind } from './kind';
import { matchSource, planRule } from './planRule';
import { buildQuestion } from './question';
import type { ExistingRule, RuleDto } from './planRule';
import type { AnswerPill } from './question';
import type { ReactNode } from 'react';

export interface TodoRow {
  id: number;
  amount?: number | null;
  date?: string | null;
  payee?: string | null;
  description?: string | null;
  isDepositTransaction?: boolean;
  isWithdrawalTransaction?: boolean;
  assignedAccountId?: number | null;
  assignedAccountName?: string | null;
  assignedCategory?: string | null;
}

export interface CategorizeValues {
  creditAccountId: number;
  transactionType: string;
  date: string;
}

const LAYOUT = `
.todo-inbox { box-sizing: border-box; width: 100%; max-width: 40rem; margin: 0 auto; padding: 24px 16px 64px; background: #f6f1e7; color: #1a2744; overflow-x: hidden; }
.todo-inbox * { box-sizing: border-box; }
.todo-title { margin: 0 0 8px; font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: clamp(2rem, 6vw, 3rem); line-height: 1.1; }
.todo-count, .todo-empty, .todo-error, .todo-note, .todo-remember, .todo-choices { font-family: 'Inter Tight', system-ui, sans-serif; }
.todo-count { margin: 0 0 28px; font-size: 1.05rem; }
.todo-empty, .todo-error { margin: 0 0 16px; font-size: 1.15rem; }
.todo-item { margin: 0 0 28px; }
.todo-question { margin: 0 0 12px; font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: 1.35rem; line-height: 1.3; }
.todo-pills { display: flex; flex-wrap: wrap; gap: 8px; max-width: 100%; }
.todo-pill-pair { display: inline-flex; max-width: 100%; gap: 8px; }
.todo-pill { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; max-width: 100%; padding: 10px 16px; border: 0; border-radius: 999px; background: #f3ebdf; color: #31404e; font-family: 'Inter Tight', system-ui, sans-serif; font-size: 1rem; }
.todo-help { min-width: 44px; min-height: 44px; padding: 0 12px; }
.todo-jargon { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.todo-remember { display: flex; align-items: center; gap: 8px; min-height: 44px; margin-top: 8px; }
.todo-note { margin: 8px 0 0; }
.todo-note button { min-height: 44px; background: none; border: 0; padding: 0; color: #1a2744; text-decoration: underline; font: inherit; }
.todo-choices { margin-top: 36px; }
.todo-choices h2 { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: 1.6rem; }
.todo-choice-form, .todo-choice-list { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.todo-choice-form label, .todo-choice-list li { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.todo-choice-form input, .todo-choice-form select, .todo-choice-form button, .todo-choice-list button { min-height: 44px; font: inherit; }
`;

function dateOnly(value: string | null | undefined): string {
  if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function displayName(row: TodoRow): string {
  return (
    row.payee?.replace(/\s+/g, ' ').trim() ||
    row.description?.replace(/\s+/g, ' ').trim() ||
    'this charge'
  );
}

export interface TodoInboxViewProps {
  rows: TodoRow[];
  pills: AnswerPill[];
  rules?: ExistingRule[];
  loading?: boolean;
  error?: boolean;
  onCategorize: (id: number, values: CategorizeValues) => Promise<void>;
  onCreateRule: (dto: RuleDto) => Promise<void>;
  onSomethingElse: (id: number) => void;
  onEditRule: (ruleId: number) => void;
  choices?: ReactNode;
}

export function TodoInboxView({
  rows,
  pills,
  rules = [],
  loading = false,
  error = false,
  onCategorize,
  onCreateRule,
  onSomethingElse,
  onEditRule,
  choices,
}: TodoInboxViewProps) {
  const [gone, setGone] = useState<number[]>([]);
  const [remember, setRemember] = useState<Record<number, boolean>>({});
  const [failed, setFailed] = useState(false);
  const [conflictId, setConflictId] = useState<number | null>(null);
  const visible = rows.filter((row) => !gone.includes(row.id));
  const showError = failed || error;

  const finish = (id: number) => {
    setGone((ids) => (ids.includes(id) ? ids : [...ids, id]));
  };

  const categorizeRow = (row: TodoRow, values: CategorizeValues) =>
    onCategorize(row.id, {
      ...values,
      date: dateOnly(values.date || row.date),
    });

  const confirm = async (row: TodoRow) => {
    const transactionType = categoryToTransactionType(row.assignedCategory);
    if (!transactionType || row.assignedAccountId == null) {
      return;
    }
    try {
      await answerTodo({
        categorize: () =>
          categorizeRow(row, {
            creditAccountId: row.assignedAccountId as number,
            transactionType,
            date: dateOnly(row.date),
          }),
        createRule: () => Promise.resolve(),
        plan: { kind: 'none' },
      });
      finish(row.id);
    } catch {
      setFailed(true);
    }
  };

  const choose = async (row: TodoRow, pill: AnswerPill) => {
    const plan = planRule(row, pill, rules, remember[row.id] === true);
    try {
      await answerTodo({
        categorize: () =>
          categorizeRow(row, {
            creditAccountId: pill.accountId,
            transactionType:
              categoryToTransactionType(pill.assignCategory) ?? '',
            date: dateOnly(row.date),
          }),
        createRule: () =>
          plan.kind === 'create' ? onCreateRule(plan.dto) : Promise.resolve(),
        plan,
      });
      if (plan.kind === 'conflict') {
        setConflictId(plan.ruleId);
      }
      finish(row.id);
    } catch {
      setFailed(true);
    }
  };

  return (
    <main className="todo-inbox">
      <style>{LAYOUT}</style>
      <h1 className="todo-title">To-do</h1>
      {loading ? <p className="todo-count">Looking…</p> : null}
      {!loading && visible.length > 0 ? (
        <p className="todo-count">
          {visible.length === 1
            ? '1 thing to check'
            : `${visible.length} things to check`}
        </p>
      ) : null}
      {showError ? (
        <p className="todo-error" role="alert">
          That didn't work. Try again.
        </p>
      ) : null}
      {!loading && visible.length === 0 ? (
        <p className="todo-empty">All done! Nothing to check.</p>
      ) : null}
      {conflictId != null ? (
        <p className="todo-note">
          You already have a rule for this.{' '}
          <button type="button" onClick={() => onEditRule(conflictId)}>
            Change it?
          </button>
        </p>
      ) : null}
      {visible.map((row) => {
        const kind = toTodoKind(row);
        const source = matchSource(row);
        const question =
          kind === 'check'
            ? `We put this in ${row.assignedAccountName || 'that account'}. OK?`
            : buildQuestion(row, pills).text;
        const confirmType =
          kind === 'check'
            ? categoryToTransactionType(row.assignedCategory)
            : null;
        return (
          <section className="todo-item" key={row.id}>
            <h2 className="todo-question">{question}</h2>
            <div className="todo-pills">
              {kind === 'check' && confirmType ? (
                <button
                  type="button"
                  className="todo-pill"
                  onClick={() => confirm(row)}
                >
                  Confirm
                </button>
              ) : null}
              {kind === 'unsure'
                ? pills.map((pill) => {
                    const tip = `Puts it in: ${pill.accountName || 'that account'} (${categoryTip(pill.assignCategory)})`;
                    return (
                      <span className="todo-pill-pair" key={pill.label}>
                        <button
                          type="button"
                          className="todo-pill"
                          onClick={() => choose(row, pill)}
                        >
                          {pill.label}
                        </button>
                        <button
                          type="button"
                          className="todo-pill todo-help"
                          title={tip}
                          aria-label={`About ${pill.label}`}
                        >
                          ?
                          <span className="todo-jargon" data-jargon="true">
                            {tip}
                          </span>
                        </button>
                      </span>
                    );
                  })
                : null}
              <button
                type="button"
                className="todo-pill"
                onClick={() => onSomethingElse(row.id)}
              >
                Something else
              </button>
            </div>
            {kind === 'unsure' && source.text ? (
              <label className="todo-remember">
                <input
                  type="checkbox"
                  checked={remember[row.id] === true}
                  onChange={(event) =>
                    setRemember((current) => ({
                      ...current,
                      [row.id]: event.target.checked,
                    }))
                  }
                />
                Do this every time for {displayName(row)}
              </label>
            ) : null}
          </section>
        );
      })}
      {choices}
    </main>
  );
}
