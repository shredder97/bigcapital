import { categoryToTransactionType } from './kind';

export interface QuestionTransaction {
  amount?: number | null;
  payee?: string | null;
  description?: string | null;
  isDepositTransaction?: boolean;
  isWithdrawalTransaction?: boolean;
}

export interface AnswerPill {
  label: string;
  accountId: number;
  assignCategory: string;
  accountName?: string;
}

export type QuestionAnswer =
  | (AnswerPill & { kind: 'pill' })
  | { kind: 'else'; label: 'Something else' };

export interface Question {
  text: string;
  answers: QuestionAnswer[];
}

export function formatTodoAmount(amount: number | null | undefined): string {
  const abs = Math.abs(Number(amount) || 0);
  const whole = Math.round(abs * 100) % 100 === 0;
  const formatted = whole
    ? abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : abs.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  return `$${formatted}`;
}

const MONEY_IN = new Set(['Deposit', 'OtherIncome', 'InterestIncome']);
const MONEY_OUT = new Set(['Expense', 'OwnerDrawings']);

function moneyIn(tx: QuestionTransaction): boolean {
  if (tx.isDepositTransaction) {
    return true;
  }
  if (tx.isWithdrawalTransaction) {
    return false;
  }
  return Number(tx.amount) > 0;
}

export function who(tx: QuestionTransaction): string {
  const payee = tx.payee?.replace(/\s+/g, ' ').trim();
  if (payee) {
    return payee;
  }
  const description = tx.description?.replace(/\s+/g, ' ').trim();
  return description || 'this charge';
}

export function parseAnswerChoices(
  raw: unknown,
  accounts?: Array<{ id?: number | null }>,
): AnswerPill[] {
  let value = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    try {
      value = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) {
    return [];
  }
  const known = accounts
    ? new Set(
        accounts
          .map((account) => account?.id)
          .filter((id): id is number => id != null),
      )
    : null;
  const pills: AnswerPill[] = [];
  value.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const label = String((item as AnswerPill).label ?? '').trim();
    const accountId = Number((item as AnswerPill).accountId);
    const assignCategory = String((item as AnswerPill).assignCategory ?? '');
    if (!label || !Number.isFinite(accountId) || accountId <= 0) {
      return;
    }
    if (!categoryToTransactionType(assignCategory)) {
      return;
    }
    if (known && !known.has(accountId)) {
      return;
    }
    pills.push({ label, accountId, assignCategory });
  });
  return pills;
}

export function pillsForDirection<T extends { assignCategory: string }>(
  tx: QuestionTransaction,
  pills: T[] | null | undefined,
): T[] {
  const allowed = moneyIn(tx) ? MONEY_IN : MONEY_OUT;
  return (pills ?? []).filter((pill) => allowed.has(pill.assignCategory));
}

export function buildQuestion(
  tx: QuestionTransaction,
  pills: AnswerPill[] | null | undefined,
): Question {
  const place = moneyIn(tx) ? 'from' : 'at';
  const answers: QuestionAnswer[] = [
    ...(pills ?? [])
      .filter((pill) => pill && pill.label && pill.accountId)
      .map((pill) => ({ ...pill, kind: 'pill' as const })),
    { kind: 'else', label: 'Something else' },
  ];
  return {
    text: `Was this ${formatTodoAmount(tx.amount)} ${place} ${who(tx)} for…?`,
    answers,
  };
}
