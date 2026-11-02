export type TodoKind = 'unsure' | 'check';

export interface TodoKindRow {
  assignedAccountId?: number | string | null;
}

const CATEGORY_TO_TYPE: Record<string, string> = {
  Expense: 'other_expense',
  OwnerDrawings: 'owner_drawing',
  OtherIncome: 'other_income',
  InterestIncome: 'other_income',
  Deposit: 'other_income',
};

const CATEGORY_TIP: Record<string, string> = {
  Expense: 'expense',
  OwnerDrawings: 'owner drawing',
  OtherIncome: 'other income',
  InterestIncome: 'interest',
  Deposit: 'deposit',
};

export const ANSWER_KIND_OPTIONS: Array<{
  value: string;
  label: string;
  tip: string;
}> = [
  { value: 'Expense', label: 'A cost', tip: 'Expense' },
  { value: 'OwnerDrawings', label: 'Personal', tip: 'Owner drawing' },
  { value: 'OtherIncome', label: 'Other income', tip: 'Other income' },
  { value: 'InterestIncome', label: 'Interest', tip: 'Interest income' },
  { value: 'Deposit', label: 'Money in', tip: 'Deposit' },
];

export function toTodoKind(row: TodoKindRow): TodoKind {
  const id = row?.assignedAccountId;
  if (id == null || id === '') {
    return 'unsure';
  }
  return 'check';
}

export function categoryToTransactionType(
  category: string | null | undefined,
): string | null {
  if (!category) {
    return null;
  }
  return CATEGORY_TO_TYPE[category] ?? null;
}

export const categoryTip = (category?: string | null) =>
  (category && CATEGORY_TIP[category]) || category || 'that kind';
