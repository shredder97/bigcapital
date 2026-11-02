import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Knex from 'knex';
import { knexSnakeCaseMappers } from 'objection';
import { lowerCase } from 'lodash';
import { DATE_ONLY_COLUMNS_OPTIONS } from '@/common/constants/database.constants';
import { EntityRepository } from '@/common/repository/EntityRepository';
import { Account } from '@/modules/Accounts/models/Account.model';
import { CategorizeBankTransaction } from '@/modules/BankingCategorize/commands/CategorizeBankTransaction';
import { MatchedBankTransaction } from '@/modules/BankingMatching/models/MatchedBankTransaction';
import { TriggerRecognizedTransactionsSubscriber } from '@/modules/BankingTranasctionsRegonize/events/TriggerRecognizedTransactions';
import { RecognizeTranasctionsService } from '@/modules/BankingTranasctionsRegonize/commands/RecognizeTranasctions.service';
import { RevertRecognizedTransactionsService } from '@/modules/BankingTranasctionsRegonize/commands/RevertRecognizedTransactions.service';
import { RecognizedBankTransaction } from '@/modules/BankingTranasctionsRegonize/models/RecognizedBankTransaction';
import { bankRulesMatchTransaction } from '@/modules/BankingTranasctionsRegonize/_utils';
import { BankTransaction } from '@/modules/BankingTransactions/models/BankTransaction';
import { UncategorizedBankTransaction } from '@/modules/BankingTransactions/models/UncategorizedBankTransaction';
import { CommandBankTransactionValidator } from '@/modules/BankingTransactions/commands/CommandCasflowValidator.service';
import { CreateBankTransactionService } from '@/modules/BankingTransactions/commands/CreateBankTransaction.service';
import { GetUncategorizedTransactions } from '@/modules/BankingTransactions/queries/GetUncategorizedTransactions';
import { CreateBankRuleService } from '@/modules/BankRules/commands/CreateBankRule.service';
import { BankRuleCondition } from '@/modules/BankRules/models/BankRuleCondition';
import { BankRule } from '@/modules/BankRules/models/BankRule';
import { SaveSettingsService } from '@/modules/Settings/commands/SaveSettings.service';
import { Setting } from '@/modules/Settings/models/Setting';
import { SettingsStore } from '@/modules/Settings/SettingsStore';
import { UnitOfWork } from '@/modules/Tenancy/TenancyDB/UnitOfWork.service';

const DATABASE_A = 'bigcapital_tenant_todo_a';
const DATABASE_B = 'bigcapital_tenant_todo_b';

function loadServerEnv() {
  const file = join(__dirname, '../.env');
  if (!existsSync(file)) {
    return;
  }
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
}

loadServerEnv();
require('ts-node/register/transpile-only');

function dbConnection(database?: string) {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'bigcapital',
    password: process.env.DB_PASSWORD || 'bigcapital',
    database,
    charset: 'utf8',
    ...DATE_ONLY_COLUMNS_OPTIONS,
  };
}

function tenantKnex(database: string) {
  return Knex({
    client: 'mysql',
    connection: dbConnection(database),
    pool: { min: 0, max: 5 },
    ...knexSnakeCaseMappers({ upperCase: true }),
  });
}

class BoundSettingRepository extends EntityRepository {
  constructor(private readonly boundKnex: import('knex').Knex) {
    super();
  }

  get model() {
    return Setting.bindKnex(this.boundKnex) as typeof Setting;
  }
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/rule-match-text.json'), 'utf8'),
) as Array<{ input: string | null; expected: string | null }>;

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

function bindModels(knex: import('knex').Knex) {
  Account.knex(knex);
  UncategorizedBankTransaction.knex(knex);
  RecognizedBankTransaction.knex(knex);
  BankRule.knex(knex);
  BankRuleCondition.knex(knex);
  MatchedBankTransaction.knex(knex);
  BankTransaction.knex(knex);
}

describe('rule match text round trip', () => {
  it('matches each fixture description with a contains condition of the expected text', () => {
    const pairs = fixture.filter(
      (row): row is { input: string; expected: string } =>
        typeof row.expected === 'string' && typeof row.input === 'string',
    );
    expect(pairs.length).toBeGreaterThan(0);
    pairs.forEach((row) => {
      const transaction = UncategorizedBankTransaction.fromJson({
        amount: -12,
        description: row.input,
        accountId: 1,
        categorized: false,
        pending: false,
      });
      const matched = bankRulesMatchTransaction(transaction, [
        {
          applyIfTransactionType: 'withdrawal',
          conditionsType: 'and',
          conditions: [
            {
              field: 'description',
              comparator: 'contains',
              value: row.expected,
            },
          ],
        } as BankRule,
      ]);
      expect(matched).toBeTruthy();
      expect(lowerCase(row.input).includes(lowerCase(row.expected))).toBe(true);
    });
  });
});

describe('To-do inbox on a tenant database', () => {
  let knexA: import('knex').Knex;
  let knexB: import('knex').Knex;
  let list: GetUncategorizedTransactions;
  let recognize: RecognizeTranasctionsService;
  let revert: RevertRecognizedTransactionsService;
  let categorize: CategorizeBankTransaction;
  let createRule: CreateBankRuleService;

  beforeAll(async () => {
    const admin = Knex({ client: 'mysql', connection: dbConnection() });
    await admin.raw(`CREATE DATABASE IF NOT EXISTS \`${DATABASE_A}\``);
    await admin.raw(`CREATE DATABASE IF NOT EXISTS \`${DATABASE_B}\``);
    await admin.destroy();

    knexA = tenantKnex(DATABASE_A);
    knexB = tenantKnex(DATABASE_B);
    const migrate = {
      directory: join(__dirname, '../src/database/tenant/migrations'),
      loadExtensions: ['.ts', '.js'],
    };
    await knexA.migrate.latest(migrate);
    await knexB.migrate.latest(migrate);

    bindModels(knexA);
    const emitter = new EventEmitter2();
    const uow = new UnitOfWork((() => knexA) as any);
    const validator = new CommandBankTransactionValidator();
    const transformer = {
      async transform(object, instance) {
        instance.setContext({
          i18n: { t: (key: string) => key },
          exportAls: { isExport: false },
          organization: { baseCurrency: 'USD' },
        });
        instance.setDateFormat('YYYY-MM-DD');
        return instance.work(object);
      },
    };
    list = new GetUncategorizedTransactions(
      transformer as any,
      (() => UncategorizedBankTransaction) as any,
    );
    recognize = new RecognizeTranasctionsService(
      emitter,
      (() => UncategorizedBankTransaction) as any,
      (() => RecognizedBankTransaction) as any,
      (() => BankRule) as any,
    );
    revert = new RevertRecognizedTransactionsService(
      emitter,
      uow,
      (() => RecognizedBankTransaction) as any,
      (() => UncategorizedBankTransaction) as any,
    );
    const creator = new CreateBankTransactionService(
      validator,
      uow,
      emitter,
      { getNextTransactionNumber: async () => 'CF-1' } as any,
      { transformDTO: async (dto) => dto } as any,
      (() => BankTransaction) as any,
      (() => Account) as any,
    );
    categorize = new CategorizeBankTransaction(
      emitter,
      uow,
      validator,
      creator,
      (() => UncategorizedBankTransaction) as any,
    );
    createRule = new CreateBankRuleService(
      uow,
      emitter,
      (() => BankRule) as any,
    );
  }, 180000);

  afterAll(async () => {
    await knexA?.destroy();
    await knexB?.destroy();
  });

  beforeEach(async () => {
    bindModels(knexA);
    await Promise.all(
      [
        UncategorizedBankTransaction,
        MatchedBankTransaction,
        RecognizedBankTransaction,
        Account,
        BankRule,
        BankRuleCondition,
        BankTransaction,
      ].map((model) => model.fetchTableMetadata()),
    );
    for (const knex of [knexA, knexB]) {
      await knex.raw('SET FOREIGN_KEY_CHECKS=0');
      for (const table of [
        'matched_bank_transactions',
        'recognized_bank_transactions',
        'uncategorized_cashflow_transactions',
        'bank_rule_conditions',
        'bank_rules',
        'cashflow_transactions',
        'accounts',
        'settings',
      ]) {
        await knex(table).delete();
      }
      await knex.raw('SET FOREIGN_KEY_CHECKS=1');
    }
  });

  const account = (values: Record<string, unknown>) =>
    Account.query().insert({
      currencyCode: 'USD',
      active: true,
      ...values,
    } as any);

  const txn = (values: Record<string, unknown>) =>
    UncategorizedBankTransaction.query().insert({
      date: '2026-10-02',
      currencyCode: 'USD',
      categorized: false,
      pending: false,
      amount: -10,
      description: 'HOME DEPOT #4521',
      ...values,
    } as any);

  const rowsFor = async (accountId: number) => {
    const page = await list.getTransactions(accountId, {
      page: 1,
      pageSize: 50,
    } as any);
    return page.data as Array<Record<string, any>>;
  };

  const makeRule = async (values: Record<string, unknown> = {}) => {
    const expense =
      (values.assignAccountId as number) ||
      (await account({ name: 'Repairs', accountType: 'expense' })).id;
    return createRule.createBankRule({
      name: 'HOME DEPOT → Farm',
      order: 1,
      applyIfTransactionType: 'withdrawal',
      conditionsType: 'and',
      conditions: [
        { field: 'description', comparator: 'contains', value: 'HOME DEPOT' },
      ],
      assignCategory: 'Expense',
      assignAccountId: expense,
      ...values,
    } as any);
  };

  it('returns unrecognized and recognized rows, with the assignment on recognized rows', async () => {
    const bank = await account({ name: 'Checking', accountType: 'bank' });
    const repairs = await account({ name: 'Repairs', accountType: 'expense' });
    const plain = await txn({
      accountId: bank.id,
      description: 'PLAIN MARKET',
    });
    const sorted = await txn({
      accountId: bank.id,
      description: 'SORTED MARKET',
    });
    const recognized = await RecognizedBankTransaction.query().insert({
      uncategorizedTransactionId: sorted.id,
      assignedCategory: 'Expense',
      assignedAccountId: repairs.id,
    });
    await UncategorizedBankTransaction.query()
      .findById(sorted.id)
      .patch({ recognizedTransactionId: recognized.id });

    const rows = await rowsFor(bank.id);
    const descriptions = rows.map((row) => row.description);
    expect(descriptions).toEqual(
      expect.arrayContaining(['PLAIN MARKET', 'SORTED MARKET']),
    );
    const recognizedRow = rows.find(
      (row) => row.description === 'SORTED MARKET',
    );
    expect(recognizedRow.assignedAccountId).toBe(repairs.id);
    expect(recognizedRow.assignedCategory).toBe('Expense');
    expect(
      rows.find((row) => row.id === plain.id).assignedAccountId,
    ).toBeFalsy();
  });

  it('leaves out excluded, pending, categorized, and matched rows', async () => {
    const bank = await account({ name: 'Checking', accountType: 'bank' });
    const keeper = await txn({
      accountId: bank.id,
      description: 'KEEPER MARKET',
    });
    await txn({
      accountId: bank.id,
      description: 'EXCLUDED MARKET',
      excludedAt: '2026-10-01',
    });
    await txn({
      accountId: bank.id,
      description: 'PENDING MARKET',
      pending: true,
    });
    await txn({
      accountId: bank.id,
      description: 'BOOKED MARKET',
      categorized: true,
      categorizeRefType: 'CashflowTransaction',
      categorizeRefId: 1,
    });
    const matched = await txn({
      accountId: bank.id,
      description: 'MATCHED MARKET',
    });
    await knexA('matched_bank_transactions').insert({
      uncategorizedTransactionId: matched.id,
      referenceType: 'SaleInvoice',
      referenceId: 1,
      amount: 10,
    });

    const rows = await rowsFor(bank.id);
    expect(rows.map((row) => row.description)).toEqual(['KEEPER MARKET']);
    expect(rows.map((row) => row.id)).toEqual([keeper.id]);
  });

  it('does not show another tenant’s rows', async () => {
    const bank = await account({ name: 'Checking', accountType: 'bank' });
    await txn({ accountId: bank.id, description: 'TENANT A MARKET' });
    const [otherAccountId] = await knexB('accounts').insert({
      name: 'Other checking',
      accountType: 'bank',
      currencyCode: 'USD',
      active: true,
    });
    await knexB('uncategorizedCashflowTransactions').insert({
      date: '2026-10-02',
      amount: -8,
      currencyCode: 'USD',
      accountId: otherAccountId,
      description: 'TENANT B ONLY',
      categorized: false,
      pending: false,
    });

    const rows = await rowsFor(bank.id);
    expect(rows.map((row) => row.description)).toEqual(['TENANT A MARKET']);
    expect(JSON.stringify(rows)).not.toContain('TENANT B ONLY');
  });

  it('recognizes the same text on two bank accounts when the rule has no account', async () => {
    const first = await account({ name: 'Checking', accountType: 'bank' });
    const second = await account({ name: 'Savings', accountType: 'bank' });
    const left = await txn({
      accountId: first.id,
      description: 'HOME DEPOT #11',
    });
    const right = await txn({
      accountId: second.id,
      description: 'HOME DEPOT #22',
    });
    const rule = await makeRule();
    expect(rule.applyIfAccountId ?? null).toBeNull();

    await recognize.recognizeTransactions(rule.id);
    await settle();

    const leftRow = await UncategorizedBankTransaction.query().findById(
      left.id,
    );
    const rightRow = await UncategorizedBankTransaction.query().findById(
      right.id,
    );
    expect(leftRow.recognizedTransactionId).toBeTruthy();
    expect(rightRow.recognizedTransactionId).toBeTruthy();
  });

  it('does not let a withdrawal rule recognize a deposit with the same text', async () => {
    const bank = await account({ name: 'Checking', accountType: 'bank' });
    const spent = await txn({
      accountId: bank.id,
      amount: -15,
      description: 'HOME DEPOT #11',
    });
    const refund = await txn({
      accountId: bank.id,
      amount: 15,
      description: 'HOME DEPOT #11',
    });
    const rule = await makeRule();
    await recognize.recognizeTransactions(rule.id);
    await settle();

    const spentRow = await UncategorizedBankTransaction.query().findById(
      spent.id,
    );
    const refundRow = await UncategorizedBankTransaction.query().findById(
      refund.id,
    );
    expect(spentRow.recognizedTransactionId).toBeTruthy();
    expect(refundRow.recognizedTransactionId).toBeFalsy();
  });

  it('categorizes the tapped row before the rule, and only recognizes the others', async () => {
    const bank = await account({ name: 'Checking', accountType: 'bank' });
    const equity = await account({ name: 'Drawings', accountType: 'equity' });
    const tapped = await txn({
      accountId: bank.id,
      amount: -42,
      description: 'HOME DEPOT #11',
    });
    const other = await txn({
      accountId: bank.id,
      amount: -18,
      description: 'HOME DEPOT #22',
    });

    await categorize.categorize(tapped.id, {
      date: '2026-10-02',
      creditAccountId: equity.id,
      transactionType: 'owner_drawing',
      exchangeRate: 1,
    } as any);
    await settle();
    const rule = await makeRule();
    await recognize.recognizeTransactions(rule.id);
    await settle();

    const tappedRow = await UncategorizedBankTransaction.query().findById(
      tapped.id,
    );
    const otherRow = await UncategorizedBankTransaction.query().findById(
      other.id,
    );
    const booked = await BankTransaction.query().findById(
      tappedRow.categorizeRefId,
    );
    expect(tappedRow.categorized).toBeTruthy();
    expect(tappedRow.recognizedTransactionId).toBeFalsy();
    expect(booked.creditAccountId).toBe(equity.id);
    expect(otherRow.recognizedTransactionId).toBeTruthy();
    expect(otherRow.categorized).toBeFalsy();
  });

  it('keeps a booked row’s account, flag, exclusion, and match when a rule edit reverts', async () => {
    const bank = await account({ name: 'Checking', accountType: 'bank' });
    const equity = await account({ name: 'Drawings', accountType: 'equity' });
    const row = await txn({
      accountId: bank.id,
      amount: -42,
      description: 'HOME DEPOT #11',
    });
    const rule = await makeRule();
    await recognize.recognizeTransactions(rule.id);
    await settle();
    await categorize.categorize(row.id, {
      date: '2026-10-02',
      creditAccountId: equity.id,
      transactionType: 'owner_drawing',
      exchangeRate: 1,
    } as any);
    await settle();
    await UncategorizedBankTransaction.query()
      .findById(row.id)
      .patch({ excludedAt: '2026-10-03' as any });
    await knexA('matched_bank_transactions').insert({
      uncategorizedTransactionId: row.id,
      referenceType: 'SaleInvoice',
      referenceId: 4,
      amount: 42,
    });

    const queued: Array<Record<string, unknown>> = [];
    const subscriber = new TriggerRecognizedTransactionsSubscriber(
      {
        getTenantJobPayload: async () => ({
          organizationId: 'tenant-a',
          userId: 1,
        }),
      } as any,
      { add: async (_name, payload) => queued.push(payload) } as any,
    );
    await subscriber.recognizedTransactionsOnRuleEdited({
      editRuleDTO: { name: 'edited' },
      oldBankRule: { id: rule.id, name: 'old', assignAccountId: 1 },
      bankRule: { id: rule.id, name: 'new', assignAccountId: 2 },
    } as any);
    expect(queued[0].shouldRevert).toBe(true);
    expect(queued[0].ruleId).toBe(rule.id);

    const before = await UncategorizedBankTransaction.query().findById(row.id);
    await revert.revertRecognizedTransactions(rule.id);
    await settle();
    const after = await UncategorizedBankTransaction.query().findById(row.id);
    const matches = await knexA('matched_bank_transactions').where(
      'uncategorizedTransactionId',
      row.id,
    );

    expect(Boolean(after.categorized)).toBe(true);
    expect(after.categorized).toEqual(before.categorized);
    expect(after.accountId).toBe(bank.id);
    expect(after.accountId).toBe(before.accountId);
    expect(new Date(after.excludedAt).toISOString().slice(0, 10)).toBe(
      '2026-10-03',
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].referenceId).toBe(4);
  });

  it('books a recognized row to its assigned account and drops it from the list', async () => {
    const bank = await account({ name: 'Checking', accountType: 'bank' });
    const equity = await account({ name: 'Drawings', accountType: 'equity' });
    const row = await txn({
      accountId: bank.id,
      amount: -42,
      description: 'HOME DEPOT #11',
    });
    const recognized = await RecognizedBankTransaction.query().insert({
      uncategorizedTransactionId: row.id,
      assignedCategory: 'OwnerDrawings',
      assignedAccountId: equity.id,
    });
    await UncategorizedBankTransaction.query()
      .findById(row.id)
      .patch({ recognizedTransactionId: recognized.id });

    expect((await rowsFor(bank.id)).map((item) => item.id)).toContain(row.id);
    await categorize.categorize(row.id, {
      date: '2026-10-02',
      creditAccountId: equity.id,
      transactionType: 'owner_drawing',
      exchangeRate: 1,
    } as any);
    await settle();

    const bookedRow = await UncategorizedBankTransaction.query().findById(
      row.id,
    );
    const booked = await BankTransaction.query().findById(
      bookedRow.categorizeRefId,
    );
    expect(booked.creditAccountId).toBe(equity.id);
    expect(bookedRow.categorized).toBeTruthy();
    expect((await rowsFor(bank.id)).map((item) => item.id)).not.toContain(
      row.id,
    );
  });

  const saveChoices = async (
    knex: import('knex').Knex,
    value: string,
    key = 'todo_answer_choices',
  ) => {
    const store = new SettingsStore(new BoundSettingRepository(knex));
    await store.load();
    const service = new SaveSettingsService((async () => store) as any);
    await service.saveSettings({
      options: [{ group: 'cashflow', key, value }],
    });
    const fresh = new SettingsStore(new BoundSettingRepository(knex));
    await fresh.load();
    return fresh.all();
  };

  it('saves and reads cashflow.todo_answer_choices', async () => {
    const value = JSON.stringify([
      { label: 'Farm', accountId: 55, assignCategory: 'Expense' },
    ]);
    const saved = await saveChoices(knexA, value);
    const choice = saved.find(
      (item) => item.group === 'cashflow' && item.key === 'todo_answer_choices',
    );
    expect(choice?.value).toBe(value);
  });

  it('rejects a settings key that was not declared', async () => {
    await expect(saveChoices(knexA, 'nope', 'not_a_real_key')).rejects.toThrow(
      /OPTIONS\.KEY\.NOT\.DEFINED/,
    );
  });

  it('does not show tenant A’s answer choices to tenant B', async () => {
    const value = JSON.stringify([
      { label: 'Farm', accountId: 55, assignCategory: 'Expense' },
    ]);
    await saveChoices(knexA, value);
    const other = new SettingsStore(new BoundSettingRepository(knexB));
    await other.load();
    expect(
      other
        .all()
        .some(
          (item) =>
            item.key === 'todo_answer_choices' ||
            String(item.value).includes('Farm'),
        ),
    ).toBe(false);
  });
});
