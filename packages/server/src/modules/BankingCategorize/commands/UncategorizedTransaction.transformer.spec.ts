import { readFileSync } from 'fs';
import { join } from 'path';
import { BankRuleAssignCategory } from '@/modules/BankRules/types';
import { GetRecognizedTransactionTransformer } from '@/modules/BankingTranasctionsRegonize/queries/GetRecognizedTransactionTransformer';
import { UncategorizedTransactionTransformer } from './UncategorizedTransaction.transformer';

const catalog = (name: string) =>
  JSON.parse(
    readFileSync(join(process.cwd(), 'src/i18n/en', name), 'utf8'),
  ) as Record<string, string>;

const LABELS: Record<string, string> = {
  'banking.assigned_category.interest_income': 'Interest Income',
  'banking.assigned_category.other_income': 'Other Income',
  'banking.assigned_category.deposit': 'Deposit',
  'transaction_type.expense': 'Expense',
  'transaction_type.owner_drawing': 'Owner drawing',
};

const render = (transformer, category: BankRuleAssignCategory) => {
  transformer.setContext({ i18n: { t: (key: string) => LABELS[key] } });
  return transformer.assignedCategoryFormatted({
    recognizedTransaction: { assignedCategory: category },
  });
};

describe.each([
  ['UncategorizedTransactionTransformer', UncategorizedTransactionTransformer],
  ['GetRecognizedTransactionTransformer', GetRecognizedTransactionTransformer],
])('%s', (_name, TransformerClass) => {
  it.each([
    [BankRuleAssignCategory.InterestIncome, 'Interest Income'],
    [BankRuleAssignCategory.OtherIncome, 'Other Income'],
    [BankRuleAssignCategory.Deposit, 'Deposit'],
    [BankRuleAssignCategory.Expense, 'Expense'],
    [BankRuleAssignCategory.OwnerDrawings, 'Owner drawing'],
  ])('renders %s as %s', (category, label) => {
    expect(render(new TransformerClass(), category)).toBe(label);
  });

  it('does not label an unrecognized transaction as Other Income', () => {
    const transformer = new TransformerClass();
    transformer.setContext({
      i18n: { t: (key: string) => LABELS[key] ?? key },
    });
    const format = transformer.assignedCategoryFormatted as (
      transaction?: any,
    ) => string;

    expect(format.call(transformer, {})).toBe('');
    expect(format.call(transformer, { recognizedTransaction: null })).toBe('');
  });

  it('does not fall back to Other Income for an unknown category', () => {
    expect(render(new TransformerClass(), 'NotACategory' as any)).toBe('');
  });
});

describe('bank rule category catalogs', () => {
  it('has a label for every assign-category key the transformers request', () => {
    const banking = catalog('banking.json');
    const transactionType = catalog('transaction_type.json');

    expect(banking['assigned_category.interest_income']).toBe(
      'Interest Income',
    );
    expect(banking['assigned_category.other_income']).toBe('Other Income');
    expect(banking['assigned_category.deposit']).toBe('Deposit');
    expect(transactionType.expense).toBe('Expense');
    expect(transactionType.owner_drawing).toBe('Owner drawing');
  });
});
