import { toRuleMatchText } from './ruleMatch';

export type RuleDirection = 'deposit' | 'withdrawal';
export interface RuleTransaction {
  amount?: number | null;
  payee?: string | null;
  description?: string | null;
  isDepositTransaction?: boolean;
  isWithdrawalTransaction?: boolean;
}
export interface RulePill {
  label: string;
  accountId: number;
  assignCategory: string;
}
export interface ExistingRule {
  id: number;
  applyIfTransactionType?: string | null;
  applyIfAccountId?: number | null;
  assignAccountId?: number | null;
  conditions?: Array<{
    field?: string | null;
    comparator?: string | null;
    value?: string | null;
  }> | null;
}
export interface RuleDto {
  name: string;
  order: number;
  applyIfTransactionType: RuleDirection;
  conditionsType: 'and';
  conditions: Array<{
    field: 'description' | 'payee';
    comparator: 'contains';
    value: string;
  }>;
  assignCategory: string;
  assignAccountId: number;
}
export type RulePlan =
  | { kind: 'create'; dto: RuleDto }
  | { kind: 'skip' }
  | { kind: 'conflict'; ruleId: number }
  | { kind: 'none' };

const sourceOf = (tx: RuleTransaction) => {
  const payee = tx.payee?.trim();
  const field = (payee ? 'payee' : 'description') as 'payee' | 'description';
  return { field, text: toRuleMatchText(payee || tx.description) };
};

export function planRule(
  tx: RuleTransaction,
  pill: RulePill,
  existingRules: ExistingRule[] = [],
  everyTime: boolean,
): RulePlan {
  const source = sourceOf(tx);
  const dir: RuleDirection = tx.isDepositTransaction ? 'deposit' : 'withdrawal';
  if (!everyTime || !source.text) return { kind: 'none' };
  const matches = existingRules.filter(
    (rule) =>
      (rule.applyIfTransactionType || '').toLowerCase() === dir &&
      (rule.conditions ?? []).some(
        (condition) =>
          (condition.field || '').toLowerCase() === source.field &&
          (condition.comparator || '').toLowerCase() === 'contains' &&
          (condition.value || '').toLowerCase() === source.text!.toLowerCase(),
      ),
  );
  const conflict = matches.find(
    (rule) => Number(rule.assignAccountId) !== Number(pill.accountId),
  );
  if (conflict) return { kind: 'conflict', ruleId: conflict.id };
  if (matches.length) return { kind: 'skip' };
  return {
    kind: 'create',
    dto: {
      name: `${source.text} → ${pill.label}`,
      order: 1,
      applyIfTransactionType: dir,
      conditionsType: 'and',
      conditions: [
        { field: source.field, comparator: 'contains', value: source.text },
      ],
      assignCategory: pill.assignCategory,
      assignAccountId: pill.accountId,
    },
  };
}
