import { useRef, useState, type ReactNode } from 'react';
import './TodoInbox.css';
import { answerTodo } from './answer';
import { categoryTip, categoryToTransactionType, toTodoKind } from './kind';
import { planRule, type ExistingRule, type RuleDto } from './planRule';
import {
  buildQuestion,
  pillsForDirection,
  who,
  type AnswerPill,
} from './question';
import { toRuleMatchText } from './ruleMatch';

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

const day = (value?: string | null) =>
  value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value || '';

// prettier-ignore
export function TodoInboxView({
  rows, pills, rules = [], loading = false, error = false,
  onCategorize, onCreateRule, onSomethingElse, choices,
}: {
  rows: TodoRow[];
  pills: AnswerPill[];
  rules?: ExistingRule[];
  loading?: boolean;
  error?: boolean;
  onCategorize: (id: number, values: { creditAccountId: number; transactionType: string; date: string }) => Promise<void>;
  onCreateRule: (dto: RuleDto) => Promise<void>;
  onSomethingElse: (id: number) => void;
  choices?: ReactNode;
}) {
  const [gone, setGone] = useState<number[]>([]);
  const [remember, setRemember] = useState<Record<number, boolean>>({});
  const [failed, setFailed] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [ruleRetry, setRuleRetry] = useState<RuleDto | null>(null);
  const pendingRef = useRef<number | null>(null);
  const visible = rows.filter((row) => !gone.includes(row.id));
  const begin = (id: number) => {
    if (pendingRef.current != null) return false;
    pendingRef.current = id;
    setPendingId(id);
    return true;
  };
  const end = () => {
    pendingRef.current = null;
    setPendingId(null);
  };
  const send = (row: TodoRow, accountId: number, category: string) =>
    onCategorize(row.id, {
      creditAccountId: accountId,
      transactionType: categoryToTransactionType(category) ?? '',
      date: day(row.date),
    });
  const finish = (id: number) => setGone((ids) => [...ids, id]);
  const confirm = async (row: TodoRow) => {
    if (!categoryToTransactionType(row.assignedCategory) || row.assignedAccountId == null || !begin(row.id)) return;
    try {
      await answerTodo({ categorize: () => send(row, row.assignedAccountId as number, row.assignedCategory as string) });
      finish(row.id);
    } catch {
      setFailed(true);
    } finally {
      end();
    }
  };
  const choose = async (row: TodoRow, pill: AnswerPill) => {
    if (!begin(row.id)) return;
    const plan = planRule(row, pill, rules, remember[row.id] === true);
    let categorized = false;
    try {
      await answerTodo({
        categorize: async () => {
          await send(row, pill.accountId, pill.assignCategory);
          categorized = true;
        },
        createRule: plan.kind === 'create' ? () => onCreateRule(plan.dto) : undefined,
      });
      finish(row.id);
    } catch {
      if (categorized && plan.kind === 'create') {
        finish(row.id);
        setRuleRetry(plan.dto);
      } else setFailed(true);
    } finally {
      end();
    }
  };
  const saveRule = async () => {
    if (!ruleRetry || !begin(-1)) return;
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
      {!loading && visible.length > 0 ? (
        <p className="todo-count">{visible.length === 1 ? '1 thing to check' : `${visible.length} things to check`}</p>
      ) : null}
      {failed || error ? <p className="todo-error" role="alert">That didn't work. Try again.</p> : null}
      {!loading && !visible.length ? <p className="todo-empty">All done! Nothing to check.</p> : null}
      {ruleRetry ? (
        <p className="todo-note"><button type="button" onClick={() => saveRule()}>Save rule</button></p>
      ) : null}
      {visible.map((row) => {
        const kind = toTodoKind(row);
        const busy = pendingId === row.id;
        const matchText = toRuleMatchText(row.payee?.trim() ? row.payee : row.description);
        return (
          <section className="todo-item" key={row.id}>
            <h2 className="todo-question">
              {kind === 'check' ? `We put this in ${row.assignedAccountName || 'that account'}. OK?` : buildQuestion(row)}
            </h2>
            <div className="todo-pills">
              {kind === 'check' && categoryToTransactionType(row.assignedCategory) ? (
                <button type="button" className="todo-pill" disabled={busy} onClick={() => confirm(row)}>Confirm</button>
              ) : null}
              {kind === 'unsure' ? pillsForDirection(row, pills).map((pill) => {
                const tip = `Puts it in: ${pill.accountName || 'that account'} (${categoryTip(pill.assignCategory)})`;
                return (
                  <span className="todo-pill-pair" key={pill.label}>
                    <button type="button" className="todo-pill" disabled={busy} onClick={() => choose(row, pill)}>{pill.label}</button>
                    <button type="button" className="todo-pill todo-help" title={tip} aria-label={`About ${pill.label}`}>
                      ?<span className="todo-jargon" data-jargon="true">{tip}</span>
                    </button>
                  </span>
                );
              }) : null}
              <button type="button" className="todo-pill" disabled={busy} onClick={() => onSomethingElse(row.id)}>Something else</button>
            </div>
            {kind === 'unsure' && matchText ? (
              <label className="todo-remember">
                <input type="checkbox" disabled={busy} checked={remember[row.id] === true} onChange={(event) => setRemember((current) => ({ ...current, [row.id]: event.target.checked }))} />
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
