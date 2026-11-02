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

export function transactionDirection(tx: RuleTransaction): RuleDirection {
  if (tx.isDepositTransaction) {
    return 'deposit';
  }
  if (tx.isWithdrawalTransaction) {
    return 'withdrawal';
  }
  return Number(tx.amount) > 0 ? 'deposit' : 'withdrawal';
}

export function matchSource(tx: RuleTransaction): {
  field: 'description' | 'payee';
  text: string | null;
} {
  const payee = tx.payee?.trim();
  if (payee) {
    return { field: 'payee', text: toRuleMatchText(payee) };
  }
  return { field: 'description', text: toRuleMatchText(tx.description) };
}

function sameMatch(
  rule: ExistingRule,
  field: string,
  value: string,
  direction: RuleDirection,
): boolean {
  if ((rule.applyIfTransactionType || '').toLowerCase() !== direction) {
    return false;
  }
  return (rule.conditions ?? []).some((condition) => {
    return (
      (condition.field || '').toLowerCase() === field &&
      (condition.comparator || '').toLowerCase() === 'contains' &&
      (condition.value || '').toLowerCase() === value.toLowerCase()
    );
  });
}

/**
 * Decides whether a pill tap should create a rule, skip, or ask to edit.
 * Account scope is ignored: an account-scoped rule with the same text counts.
 */
export function planRule(
  tx: RuleTransaction,
  pill: RulePill,
  existingRules: ExistingRule[],
  everyTime: boolean,
): RulePlan {
  if (!everyTime) {
    return { kind: 'none' };
  }
  const source = matchSource(tx);
  if (!source.text) {
    return { kind: 'none' };
  }
  const direction = transactionDirection(tx);
  const matches = (existingRules ?? []).filter((rule) =>
    sameMatch(rule, source.field, source.text as string, direction),
  );
  const conflict = matches.find(
    (rule) => Number(rule.assignAccountId) !== Number(pill.accountId),
  );
  if (conflict) {
    return { kind: 'conflict', ruleId: conflict.id };
  }
  if (matches.length > 0) {
    return { kind: 'skip' };
  }
  return {
    kind: 'create',
    dto: {
      name: `${source.text} → ${pill.label}`,
      order: 1,
      applyIfTransactionType: direction,
      conditionsType: 'and',
      conditions: [
        {
          field: source.field,
          comparator: 'contains',
          value: source.text,
        },
      ],
      assignCategory: pill.assignCategory,
      assignAccountId: pill.accountId,
    },
  };
}
