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

const MONEY_IN = new Set(['Deposit', 'OtherIncome', 'InterestIncome']);
const MONEY_OUT = new Set(['Expense', 'OwnerDrawings']);

export const moneyIn = (tx: QuestionTransaction) =>
  tx.isDepositTransaction
    ? true
    : tx.isWithdrawalTransaction
      ? false
      : Number(tx.amount) > 0;

export const formatTodoAmount = (amount?: number | null) => {
  const abs = Math.abs(Number(amount) || 0);
  const digits = Math.round(abs * 100) % 100 === 0;
  return `$${abs.toLocaleString('en-US', digits ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const who = (tx: QuestionTransaction) =>
  (tx.payee?.trim() || tx.description || '').replace(/\s+/g, ' ').trim();

export const buildQuestion = (tx: QuestionTransaction) =>
  `Was this ${formatTodoAmount(tx.amount)} ${moneyIn(tx) ? 'from' : 'at'} ${who(tx)} for…?`;

export const pillsForDirection = <T extends { assignCategory: string }>(
  tx: QuestionTransaction,
  pills?: T[] | null,
) =>
  (pills ?? []).filter((pill) =>
    (moneyIn(tx) ? MONEY_IN : MONEY_OUT).has(pill.assignCategory),
  );

export function parseAnswerChoices(
  raw: unknown,
  accounts?: Array<{ id?: number | null }>,
): AnswerPill[] {
  let value = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return [];
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const known = accounts
    ? new Set(
        accounts
          .map((account) => account?.id)
          .filter((id): id is number => id != null),
      )
    : null;
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const label = String((item as AnswerPill).label ?? '').trim();
    const accountId = Number((item as AnswerPill).accountId);
    const assignCategory = String((item as AnswerPill).assignCategory ?? '');
    if (!label || accountId <= 0 || !categoryToTransactionType(assignCategory))
      return [];
    if (known && !known.has(accountId)) return [];
    return [{ label, accountId, assignCategory }];
  });
}
