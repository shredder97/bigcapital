// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerTodo } from './answer';
import {
  ANSWER_KIND_OPTIONS,
  categoryToTransactionType,
  toTodoKind,
} from './kind';
import { mergeTodoPages } from './merge';
import { planRule } from './planRule';
import { buildQuestion, parseAnswerChoices } from './question';
import { toRuleMatchText } from './ruleMatch';
import { TodoInboxView } from './TodoInboxView';
import type { RulePlan } from './planRule';
import type { ExistingRule, RuleDto } from './planRule';
import type { TodoRow } from './TodoInboxView';

const fixture = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../server/test/fixtures/rule-match-text.json'),
    'utf8',
  ),
) as Array<{ input: string | null; expected: string | null }>;

afterEach(() => cleanup());

const pill = {
  label: 'Farm',
  accountId: 55,
  assignCategory: 'Expense',
  accountName: 'Repairs & Maintenance',
};

const withdrawal: TodoRow = {
  id: 1,
  amount: -42,
  date: '2026-10-02',
  payee: 'Home Depot',
  description: 'HOME DEPOT #4521',
  isWithdrawalTransaction: true,
  isDepositTransaction: false,
};

const rulesFor = (overrides: Partial<ExistingRule> = {}): ExistingRule[] => [
  {
    id: 9,
    applyIfTransactionType: 'withdrawal',
    applyIfAccountId: null,
    assignAccountId: 55,
    conditions: [
      { field: 'payee', comparator: 'contains', value: 'home depot' },
    ],
    ...overrides,
  },
];

function created(plan: RulePlan): RuleDto {
  if (plan.kind !== 'create') {
    throw new Error(`expected a new rule, got ${plan.kind}`);
  }
  return plan.dto;
}

async function click(element: HTMLElement) {
  fireEvent.click(element);
  await act(async () => {
    await Promise.resolve();
  });
}

describe('to-do inbox', () => {
  it('matches every fixture row with toRuleMatchText', () => {
    fixture.forEach((row) => {
      expect(toRuleMatchText(row.input)).toBe(row.expected);
    });
  });

  it('trims merchant text', () => {
    const row = fixture.find((item) => item.input === '  Home Depot  ');
    expect(toRuleMatchText(row?.input)).toBe('Home Depot');
  });

  it('collapses repeated spaces', () => {
    const row = fixture.find((item) => item.input === 'Home    Depot');
    expect(toRuleMatchText(row?.input)).toBe('Home Depot');
  });

  it('strips store numbers', () => {
    expect(toRuleMatchText('HOME DEPOT #4521')).toBe('HOME DEPOT');
    expect(toRuleMatchText('Starbucks Store 1234')).toBe('Starbucks');
    expect(toRuleMatchText('Walmart 8891')).toBe('Walmart');
    expect(toRuleMatchText('COSTCO WHOLESALE # 109')).toBe('COSTCO WHOLESALE');
  });

  it('returns null when the text is under 4 characters', () => {
    expect(toRuleMatchText('pay')).toBeNull();
    expect(toRuleMatchText('a b')).toBeNull();
  });

  it('returns null for the generic word purchase', () => {
    expect(toRuleMatchText('purchase')).toBeNull();
    expect(toRuleMatchText('  Purchase  ')).toBeNull();
  });

  it('returns null for generic bank words and empty text', () => {
    expect(toRuleMatchText('  payment  ')).toBeNull();
    expect(toRuleMatchText('ACH')).toBeNull();
    expect(toRuleMatchText('Online')).toBeNull();
    expect(toRuleMatchText('Transfer')).toBeNull();
    expect(toRuleMatchText('Deposit')).toBeNull();
    expect(toRuleMatchText('POS')).toBeNull();
    expect(toRuleMatchText('Debit')).toBeNull();
    expect(toRuleMatchText('')).toBeNull();
    expect(toRuleMatchText('   ')).toBeNull();
    expect(toRuleMatchText(null)).toBeNull();
  });

  it('creates a rule when none exists', () => {
    const dto = created(planRule(withdrawal, pill, [], true));
    expect(dto.conditions[0]).toEqual({
      field: 'payee',
      comparator: 'contains',
      value: 'Home Depot',
    });
    expect(dto.name).toBe('Home Depot → Farm');
    expect(dto.assignAccountId).toBe(55);
    expect(dto.assignCategory).toBe('Expense');
    const described = created(
      planRule(
        { ...withdrawal, payee: '  ', description: 'HOME DEPOT #4521' },
        pill,
        [],
        true,
      ),
    );
    expect(described.conditions[0].field).toBe('description');
    expect(described.conditions[0].value).toBe('HOME DEPOT');
  });

  it('skips when an identical rule exists, ignoring case', () => {
    expect(planRule(withdrawal, pill, rulesFor(), true)).toEqual({
      kind: 'skip',
    });
  });

  it('skips when an account-scoped rule has the same text and direction', () => {
    expect(
      planRule(withdrawal, pill, rulesFor({ applyIfAccountId: 3 }), true),
    ).toEqual({ kind: 'skip' });
  });

  it('conflicts when the same text points at another account', () => {
    expect(
      planRule(
        withdrawal,
        pill,
        rulesFor({ assignAccountId: 80, id: 4 }),
        true,
      ),
    ).toEqual({ kind: 'conflict', ruleId: 4 });
  });

  it('does nothing when every time is off', () => {
    expect(planRule(withdrawal, pill, [], false)).toEqual({ kind: 'none' });
  });

  it('never puts an amount or a date on the rule', () => {
    const dto = created(planRule(withdrawal, pill, [], true));
    expect(dto).not.toHaveProperty('amount');
    expect(dto).not.toHaveProperty('date');
    expect(dto.conditions.map((condition) => condition.field)).not.toContain(
      'amount',
    );
    expect(JSON.stringify(dto)).not.toMatch(/"date"/);
  });

  it('omits the account scope and always sets a direction', () => {
    const dto = created(planRule(withdrawal, pill, [], true));
    expect(dto).not.toHaveProperty('applyIfAccountId');
    expect(dto.applyIfTransactionType).toBe('withdrawal');
    const deposit = created(
      planRule(
        {
          ...withdrawal,
          amount: 18,
          isDepositTransaction: true,
          isWithdrawalTransaction: false,
        },
        pill,
        [],
        true,
      ),
    );
    expect(deposit.applyIfTransactionType).toBe('deposit');
    expect(deposit).not.toHaveProperty('applyIfAccountId');
  });

  it('leaves "do this every time" unchecked', () => {
    render(
      <TodoInboxView
        rows={[withdrawal]}
        pills={[pill]}
        onCategorize={async () => undefined}
        onCreateRule={async () => undefined}
        onSomethingElse={() => undefined}
        onEditRule={() => undefined}
      />,
    );
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it('calls a row with no assigned account unsure', () => {
    expect(toTodoKind({ assignedAccountId: null })).toBe('unsure');
    expect(toTodoKind({})).toBe('unsure');
  });

  it('calls a row with an assigned account check', () => {
    expect(toTodoKind({ assignedAccountId: 12 })).toBe('check');
  });

  it('maps all five categories', () => {
    expect(categoryToTransactionType('Expense')).toBe('other_expense');
    expect(categoryToTransactionType('OwnerDrawings')).toBe('owner_drawing');
    expect(categoryToTransactionType('OtherIncome')).toBe('other_income');
    expect(categoryToTransactionType('InterestIncome')).toBe('other_income');
    expect(categoryToTransactionType('Deposit')).toBe('other_income');
  });

  it('returns null for an unknown category', () => {
    expect(categoryToTransactionType('Nope')).toBeNull();
    expect(categoryToTransactionType(null)).toBeNull();
  });

  it('asks "at" when money went out', () => {
    expect(buildQuestion(withdrawal, [pill]).text).toBe(
      'Was this $42 at Home Depot for…?',
    );
  });

  it('asks "from" when money came in', () => {
    expect(
      buildQuestion(
        {
          ...withdrawal,
          amount: 18,
          payee: 'Northwind',
          isDepositTransaction: true,
          isWithdrawalTransaction: false,
        },
        [pill],
      ).text,
    ).toBe('Was this $18 from Northwind for…?');
  });

  it('formats the amount', () => {
    expect(
      buildQuestion({ ...withdrawal, amount: -42.5 }, [pill]).text,
    ).toContain('$42.50');
    expect(
      buildQuestion({ ...withdrawal, amount: -1200 }, [pill]).text,
    ).toContain('$1,200');
  });

  it('falls back to the description and always offers something else', () => {
    const question = buildQuestion(
      { ...withdrawal, payee: '  ', description: 'Blue Bottle' },
      [pill],
    );
    expect(question.text).toBe('Was this $42 at Blue Bottle for…?');
    expect(question.answers.map((answer) => answer.label)).toContain(
      'Something else',
    );
  });

  it('offers only something else when there are no pills', () => {
    expect(buildQuestion(withdrawal, []).answers).toEqual([
      { kind: 'else', label: 'Something else' },
    ]);
  });

  it('drops bad or stale answer choices without crashing', () => {
    expect(parseAnswerChoices('not json')).toEqual([]);
    expect(parseAnswerChoices('{')).toEqual([]);
    expect(parseAnswerChoices(null)).toEqual([]);
    expect(parseAnswerChoices({ label: 'Farm' })).toEqual([]);
    expect(
      parseAnswerChoices(
        JSON.stringify([
          { label: 'Farm', accountId: 55, assignCategory: 'Expense' },
          { label: '', accountId: 1, assignCategory: 'Expense' },
          { label: 'Old', accountId: 404, assignCategory: 'Nope' },
          { label: 'Gone', accountId: 404, assignCategory: 'Expense' },
        ]),
        [{ id: 55 }],
      ),
    ).toEqual([{ label: 'Farm', accountId: 55, assignCategory: 'Expense' }]);
  });

  it('confirms a check-this item and does not create a rule', async () => {
    const categorize = vi.fn(async () => undefined);
    const createRule = vi.fn(async () => undefined);
    const row: TodoRow = {
      ...withdrawal,
      assignedAccountId: 70,
      assignedAccountName: 'Repairs',
      assignedCategory: 'OwnerDrawings',
    };
    render(
      <TodoInboxView
        rows={[row]}
        pills={[pill]}
        onCategorize={categorize}
        onCreateRule={createRule}
        onSomethingElse={() => undefined}
        onEditRule={() => undefined}
      />,
    );
    expect(
      screen.getByText('We put this in Repairs. OK?').textContent,
    ).toContain('We put this in Repairs. OK?');
    await click(screen.getByRole('button', { name: 'Confirm' }));
    expect(categorize).toHaveBeenCalledWith(1, {
      creditAccountId: 70,
      transactionType: 'owner_drawing',
      date: '2026-10-02',
    });
    expect(createRule).not.toHaveBeenCalled();
    expect(screen.queryByText('We put this in Repairs. OK?')).toBeNull();
  });

  it('hides confirm when the category does not map', () => {
    render(
      <TodoInboxView
        rows={[
          {
            ...withdrawal,
            assignedAccountId: 70,
            assignedAccountName: 'Repairs',
            assignedCategory: 'Nope',
          },
        ]}
        pills={[]}
        onCategorize={async () => undefined}
        onCreateRule={async () => undefined}
        onSomethingElse={() => undefined}
        onEditRule={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Something else' })).toBeTruthy();
  });

  it('shows two identical charges as two items', () => {
    render(
      <TodoInboxView
        rows={[withdrawal, { ...withdrawal, id: 2 }]}
        pills={[pill]}
        onCategorize={async () => undefined}
        onCreateRule={async () => undefined}
        onSomethingElse={() => undefined}
        onEditRule={() => undefined}
      />,
    );
    expect(
      screen.getAllByText('Was this $42 at Home Depot for…?'),
    ).toHaveLength(2);
  });

  it('shows only pills for the same direction', async () => {
    const categorize = vi.fn(async () => undefined);
    render(
      <TodoInboxView
        rows={[
          {
            ...withdrawal,
            amount: 18,
            payee: 'Northwind',
            isDepositTransaction: true,
            isWithdrawalTransaction: false,
          },
        ]}
        pills={[
          pill,
          {
            label: 'Shop',
            accountId: 9,
            assignCategory: 'OtherIncome',
            accountName: 'Sales',
          },
          {
            label: 'Interest',
            accountId: 10,
            assignCategory: 'InterestIncome',
          },
          { label: 'Came in', accountId: 11, assignCategory: 'Deposit' },
          {
            label: 'Personal',
            accountId: 12,
            assignCategory: 'OwnerDrawings',
          },
        ]}
        onCategorize={categorize}
        onCreateRule={async () => undefined}
        onSomethingElse={() => undefined}
        onEditRule={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Farm' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Personal' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Shop' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Interest' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Came in' })).toBeTruthy();
    await click(screen.getByRole('button', { name: 'Shop' }));
    const sent = categorize.mock.calls.map(
      (call) => (call[1] as { transactionType: string }).transactionType,
    );
    expect(sent).toEqual(['other_income']);
    expect(sent).not.toContain('other_expense');
  });

  it('ignores a second tap while a save is in flight', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const categorize = vi.fn(() => gate);
    const createRule = vi.fn(async () => undefined);
    render(
      <TodoInboxView
        rows={[withdrawal]}
        pills={[pill]}
        onCategorize={categorize}
        onCreateRule={createRule}
        onSomethingElse={() => undefined}
        onEditRule={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    const farm = screen.getByRole('button', { name: 'Farm' });
    fireEvent.click(farm);
    fireEvent.click(farm);
    expect(categorize).toHaveBeenCalledTimes(1);
    expect((farm as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      release();
      await gate;
    });
    expect(createRule).toHaveBeenCalledTimes(1);
  });

  it('retries only the rule after categorize has already worked', async () => {
    const categorize = vi.fn(async () => undefined);
    const createRule = vi
      .fn()
      .mockRejectedValueOnce(new Error('rule'))
      .mockResolvedValueOnce(undefined);
    render(
      <TodoInboxView
        rows={[withdrawal]}
        pills={[pill]}
        onCategorize={categorize}
        onCreateRule={createRule}
        onSomethingElse={() => undefined}
        onEditRule={() => undefined}
      />,
    );
    await click(screen.getByRole('checkbox'));
    await click(screen.getByRole('button', { name: 'Farm' }));
    expect(screen.queryByText('Was this $42 at Home Depot for…?')).toBeNull();
    await click(screen.getByRole('button', { name: /save rule/i }));
    expect(categorize).toHaveBeenCalledTimes(1);
    expect(createRule).toHaveBeenCalledTimes(2);
  });

  it('categorizes before creating a rule, and skips the rule when categorize fails', async () => {
    const order: string[] = [];
    const categorize = vi.fn(async () => {
      order.push('categorize');
    });
    const createRule = vi.fn(async (_dto: RuleDto) => {
      order.push('rule');
    });
    const { rerender } = render(
      <TodoInboxView
        rows={[withdrawal]}
        pills={[pill]}
        onCategorize={categorize}
        onCreateRule={createRule}
        onSomethingElse={() => undefined}
        onEditRule={() => undefined}
      />,
    );
    await click(screen.getByRole('checkbox'));
    await click(screen.getByRole('button', { name: 'Farm' }));
    expect(order).toEqual(['categorize', 'rule']);

    const failedCategorize = vi.fn(async () => {
      throw new Error('no');
    });
    const failedRule = vi.fn(async () => undefined);
    rerender(
      <TodoInboxView
        rows={[{ ...withdrawal, id: 8 }]}
        pills={[pill]}
        onCategorize={failedCategorize}
        onCreateRule={failedRule}
        onSomethingElse={() => undefined}
        onEditRule={() => undefined}
      />,
    );
    await click(screen.getAllByRole('checkbox')[0]);
    await click(screen.getByRole('button', { name: 'Farm' }));
    expect(failedRule).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(
      "That didn't work. Try again.",
    );
  });

  it('merges three accounts newest first and sums the badge', async () => {
    const pages: Record<
      number,
      { data: TodoRow[]; pagination: { total: number } }
    > = {
      1: {
        data: [
          { id: 1, date: '2026-01-02', amount: -5 },
          { id: 2, date: '2026-01-01', amount: -6 },
        ],
        pagination: { total: 2 },
      },
      2: {
        data: [{ id: 3, date: '2026-03-01', amount: -7 }],
        pagination: { total: 1 },
      },
      3: {
        data: [{ id: 4, date: '2026-02-01', amount: -8 }],
        pagination: { total: 5 },
      },
    };
    const merged = mergeTodoPages([pages[1], pages[2], pages[3]]);
    expect(merged.rows.map((row) => row.id)).toEqual([3, 4, 1, 2]);
    expect(merged.badge).toBe(8);
    const duplicated = mergeTodoPages([
      pages[1],
      {
        data: [{ id: 1, date: '2026-01-02', amount: -5 }],
        pagination: { total: 3 },
      },
    ]);
    expect(duplicated.rows.map((row) => row.id)).toEqual([1, 2]);
    expect(duplicated.badge).toBe(5);
  });

  it('shows the empty state', () => {
    render(
      <TodoInboxView
        rows={[]}
        pills={[]}
        onCategorize={async () => undefined}
        onCreateRule={async () => undefined}
        onSomethingElse={() => undefined}
        onEditRule={() => undefined}
      />,
    );
    expect(screen.getByText('All done! Nothing to check.')).toBeTruthy();
  });

  /* The phone check reads layout styles Testing Library does not expose. */
  /* eslint-disable testing-library/no-container, testing-library/no-node-access */
  it('wraps pills on a phone without a sideways scroll', () => {
    const { container } = render(
      <TodoInboxView
        rows={[withdrawal]}
        pills={[
          pill,
          {
            ...pill,
            label: 'Personal',
            accountId: 56,
            assignCategory: 'OwnerDrawings',
          },
          { ...pill, label: 'Shop', accountId: 57, assignCategory: 'Expense' },
          { ...pill, label: 'Fuel', accountId: 58, assignCategory: 'Expense' },
        ]}
        onCategorize={async () => undefined}
        onCreateRule={async () => undefined}
        onSomethingElse={() => undefined}
        onEditRule={() => undefined}
      />,
    );
    const root = container.querySelector('.todo-inbox') as HTMLElement;
    root.style.width = '375px';
    const pills = container.querySelector('.todo-pills') as HTMLElement;
    const button = container.querySelector('.todo-pill') as HTMLElement;
    expect(getComputedStyle(pills).flexWrap).toBe('wrap');
    expect(getComputedStyle(root).overflowX).toBe('hidden');
    expect(
      parseFloat(getComputedStyle(button).minHeight),
    ).toBeGreaterThanOrEqual(44);
    expect(root.scrollWidth).toBeLessThanOrEqual(
      Math.max(root.clientWidth, 375),
    );
  });

  it('keeps jargon inside tooltips', () => {
    const { container } = render(
      <TodoInboxView
        rows={[
          withdrawal,
          {
            ...withdrawal,
            id: 2,
            assignedAccountId: 70,
            assignedAccountName: 'Repairs',
            assignedCategory: 'Expense',
          },
        ]}
        pills={[pill]}
        onCategorize={async () => undefined}
        onCreateRule={async () => undefined}
        onSomethingElse={() => undefined}
        onEditRule={() => undefined}
      />,
    );
    container
      .querySelectorAll('[data-jargon]')
      .forEach((node: Element) => node.remove());
    const visible = container.textContent || '';
    const banned = [
      /uncategorized/i,
      /categorize/i,
      /credit account/i,
      /transaction type/i,
      /withdrawal/i,
      /\bdeposit\b/i,
      /recognized/i,
      /general ledger/i,
      /assignCategory/,
      /bank rule/i,
    ];
    banned.forEach((pattern) => {
      expect(visible).not.toMatch(pattern);
    });
    ANSWER_KIND_OPTIONS.forEach((option) => {
      expect(option.label).not.toMatch(
        /assign|transaction type|uncategorized/i,
      );
    });
    expect(container.querySelector('[data-jargon]')?.textContent || '').toBe(
      '',
    );
    const tip =
      container.querySelector('.todo-help')?.getAttribute('title') || '';
    expect(tip).toMatch(/Puts it in: Repairs & Maintenance \(expense\)/);
  });
  /* eslint-enable testing-library/no-container, testing-library/no-node-access */

  it('runs categorize before the rule helper', async () => {
    const order: string[] = [];
    await answerTodo({
      categorize: async () => {
        order.push('categorize');
      },
      createRule: async () => {
        order.push('rule');
      },
      plan: {
        kind: 'create',
        dto: {
          name: 'Home Depot → Farm',
          order: 1,
          applyIfTransactionType: 'withdrawal',
          conditionsType: 'and',
          conditions: [
            { field: 'payee', comparator: 'contains', value: 'Home Depot' },
          ],
          assignCategory: 'Expense',
          assignAccountId: 55,
        },
      },
    });
    expect(order).toEqual(['categorize', 'rule']);
    const createRule = vi.fn(async () => undefined);
    await expect(
      answerTodo({
        categorize: async () => {
          throw new Error('no');
        },
        createRule,
        plan: { kind: 'create', dto: {} as RuleDto },
      }),
    ).rejects.toThrow('no');
    expect(createRule).not.toHaveBeenCalled();
  });
});
