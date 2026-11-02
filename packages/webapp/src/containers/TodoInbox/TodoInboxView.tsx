import { useRef, useState } from 'react';
import './TodoInbox.css';
import { answerTodo } from './answer';
import { categoryTip, categoryToTransactionType, toTodoKind } from './kind';
import { matchSource, planRule } from './planRule';
import { buildQuestion, pillsForDirection, who } from './question';
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
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [ruleRetry, setRuleRetry] = useState<RuleDto | null>(null);
  const pendingRef = useRef<number | null>(null);
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

  const begin = (id: number) => {
    if (pendingRef.current != null) {
      return false;
    }
    pendingRef.current = id;
    setPendingId(id);
    return true;
  };

  const end = () => {
    pendingRef.current = null;
    setPendingId(null);
  };

  const confirm = async (row: TodoRow) => {
    const transactionType = categoryToTransactionType(row.assignedCategory);
    if (!transactionType || row.assignedAccountId == null || !begin(row.id)) {
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
        plan: { kind: 'none' },
      });
      finish(row.id);
    } catch {
      setFailed(true);
    } finally {
      end();
    }
  };

  const choose = async (row: TodoRow, pill: AnswerPill) => {
    if (!begin(row.id)) {
      return;
    }
    const plan = planRule(row, pill, rules, remember[row.id] === true);
    let categorized = false;
    try {
      await answerTodo({
        categorize: async () => {
          await categorizeRow(row, {
            creditAccountId: pill.accountId,
            transactionType:
              categoryToTransactionType(pill.assignCategory) ?? '',
            date: dateOnly(row.date),
          });
          categorized = true;
        },
        createRule:
          plan.kind === 'create' ? () => onCreateRule(plan.dto) : undefined,
      });
      if (plan.kind === 'conflict') {
        setConflictId(plan.ruleId);
      }
      finish(row.id);
    } catch {
      if (categorized && plan.kind === 'create') {
        finish(row.id);
        setRuleRetry(plan.dto);
      } else {
        setFailed(true);
      }
    } finally {
      end();
    }
  };

  const saveRule = async () => {
    if (!ruleRetry || !begin(-1)) {
      return;
    }
    try {
      await onCreateRule(ruleRetry);
      setRuleRetry(null);
    } catch {
      setFailed(true);
    } finally {
      end();
    }
  };

  return (
    <main className="todo-inbox">
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
      {ruleRetry ? (
        <p className="todo-note">
          <button type="button" onClick={() => saveRule()}>
            Save rule
          </button>
        </p>
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
        const rowPills = pillsForDirection(row, pills);
        const question =
          kind === 'check'
            ? `We put this in ${row.assignedAccountName || 'that account'}. OK?`
            : buildQuestion(row, pills).text;
        const confirmType =
          kind === 'check'
            ? categoryToTransactionType(row.assignedCategory)
            : null;
        const busy = pendingId === row.id;
        return (
          <section className="todo-item" key={row.id}>
            <h2 className="todo-question">{question}</h2>
            <div className="todo-pills">
              {kind === 'check' && confirmType ? (
                <button
                  type="button"
                  className="todo-pill"
                  disabled={busy}
                  onClick={() => confirm(row)}
                >
                  Confirm
                </button>
              ) : null}
              {kind === 'unsure'
                ? rowPills.map((pill) => {
                    const tip = `Puts it in: ${pill.accountName || 'that account'} (${categoryTip(pill.assignCategory)})`;
                    return (
                      <span className="todo-pill-pair" key={pill.label}>
                        <button
                          type="button"
                          className="todo-pill"
                          disabled={busy}
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
                disabled={busy}
                onClick={() => onSomethingElse(row.id)}
              >
                Something else
              </button>
            </div>
            {kind === 'unsure' && source.text ? (
              <label className="todo-remember">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={remember[row.id] === true}
                  onChange={(event) =>
                    setRemember((current) => ({
                      ...current,
                      [row.id]: event.target.checked,
                    }))
                  }
                />
                Do this every time for {who(row)}
              </label>
            ) : null}
          </section>
        );
      })}
      {choices}
    </main>
  );
}
