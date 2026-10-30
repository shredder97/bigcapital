import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Knex from 'knex';
import { knexSnakeCaseMappers } from 'objection';
import { events } from '@/common/events/events';
import { DATE_ONLY_COLUMNS_OPTIONS } from '@/common/constants/database.constants';
import { Account } from '@/modules/Accounts/models/Account.model';
import { CreateUncategorizedTransactionService } from '@/modules/BankingCategorize/commands/CreateUncategorizedTransaction.service';
import { PlaidSyncDb } from '@/modules/BankingPlaid/command/PlaidSyncDB';
import { PlaidUpdateTransactions } from '@/modules/BankingPlaid/command/PlaidUpdateTransactions';
import { PlaidItem } from '@/modules/BankingPlaid/models/PlaidItem';
import { UncategorizedBankTransaction } from '@/modules/BankingTransactions/models/UncategorizedBankTransaction';
import { RemovePendingUncategorizedTransaction } from '@/modules/BankingTransactions/commands/RemovePendingUncategorizedTransaction.service';
import { DecrementUncategorizedTransactionOnCategorizeSubscriber } from '@/modules/BankingTransactions/subscribers/DecrementUncategorizedTransactionOnCategorize';
import { ServiceError } from '@/modules/Items/ServiceError';
import { UnitOfWork } from '@/modules/Tenancy/TenancyDB/UnitOfWork.service';

/**
 * Real tenant database (the MariaDB the server e2e job already runs), not a
 * query mock. The counter moves only through
 * DecrementUncategorizedTransactionOnCategorizeSubscriber: a pending insert
 * does not increment, and deleting a pending row does not decrement, so a
 * pending row replaced by its posted row changes the counter by exactly +1.
 */
const DATABASE = 'bigcapital_tenant_plaid_sync_test';
const ITEM = 'item-counter';
const PLAID_ACCOUNT = 'plaid-acc-counter';

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

// A fresh object every time. Knex marks `password` non-enumerable on the
// object it is given, so a shared config would connect without a password.
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

function tenantKnex() {
  return Knex({
    client: 'mysql',
    connection: dbConnection(DATABASE),
    pool: { min: 0, max: 5 },
    ...knexSnakeCaseMappers({ upperCase: true }),
  });
}

const plaidTxn = (overrides: Record<string, any> = {}) => ({
  account_id: PLAID_ACCOUNT,
  date: '2026-10-28',
  amount: 12.34,
  name: 'COFFEE',
  iso_currency_code: 'USD',
  transaction_id: 'txn-1',
  pending: false,
  pending_transaction_id: null,
  payment_meta: null,
  ...overrides,
});

describe('Plaid sync counter on a tenant database', () => {
  let knex: import('knex').Knex;
  let updater: PlaidUpdateTransactions;
  let plaidSync: PlaidSyncDb;
  let create: CreateUncategorizedTransactionService;
  let remove: RemovePendingUncategorizedTransaction;

  beforeAll(async () => {
    const admin = Knex({ client: 'mysql', connection: dbConnection() });
    await admin.raw(`CREATE DATABASE IF NOT EXISTS \`${DATABASE}\``);
    await admin.destroy();

    knex = tenantKnex();
    await knex.migrate.latest({
      directory: join(__dirname, '../src/database/tenant/migrations'),
      loadExtensions: ['.ts', '.js'],
    });

    Account.knex(knex);
    UncategorizedBankTransaction.knex(knex);
    PlaidItem.knex(knex);

    const emitter = new EventEmitter2();
    const subscriber =
      new DecrementUncategorizedTransactionOnCategorizeSubscriber(
        (() => Account) as any,
      );
    emitter.on(events.cashflow.onTransactionUncategorizedCreated, (payload) =>
      subscriber.incrementUncategoirzedTransactionsOnCreated(payload),
    );

    const uow = new UnitOfWork((() => knex) as any);
    create = new CreateUncategorizedTransactionService(
      uow,
      emitter,
      (() => UncategorizedBankTransaction) as any,
    );
    remove = new RemovePendingUncategorizedTransaction(
      emitter,
      uow,
      (() => UncategorizedBankTransaction) as any,
      (() => Account) as any,
    );
    plaidSync = new PlaidSyncDb(
      {} as any,
      create,
      remove,
      emitter,
      (() => Account) as any,
      (() => PlaidItem) as any,
      (() => UncategorizedBankTransaction) as any,
    );
    updater = new PlaidUpdateTransactions(
      plaidSync,
      uow,
      (() => PlaidItem) as any,
      client([]) as any,
    );
  }, 180000);

  afterAll(async () => {
    await knex?.destroy();
  });

  beforeEach(async () => {
    await knex.raw('SET FOREIGN_KEY_CHECKS=0');
    await knex('matched_bank_transactions').delete();
    await knex('uncategorized_cashflow_transactions').delete();
    await knex('accounts').delete();
    await knex('plaid_items').delete();
    await knex.raw('SET FOREIGN_KEY_CHECKS=1');

    await PlaidItem.query().insert({
      plaidItemId: ITEM,
      plaidInstitutionId: 'ins_1',
      plaidAccessToken: 'access-token',
      lastCursor: 'cursor-1',
    });
    await Account.query().insert({
      name: 'Capital One',
      accountType: 'bank',
      currencyCode: 'USD',
      active: true,
      plaidAccountId: PLAID_ACCOUNT,
      plaidItemId: ITEM,
      uncategorizedTransactions: 0,
    } as any);
  });

  const counter = async () => {
    const account = await Account.query().findOne({
      plaidAccountId: PLAID_ACCOUNT,
    });
    return Number((account as any).uncategorizedTransactions);
  };

  const sync = (
    added: any[] = [],
    modified: any[] = [],
    removed: string[] = [],
  ) => {
    (updater as any).plaidClient = client(added, modified, removed);
    return updater.updateTransactions(ITEM);
  };

  it('does not change the counter when an existing row is patched', async () => {
    const account = await Account.query().findOne({
      plaidAccountId: PLAID_ACCOUNT,
    });
    await UncategorizedBankTransaction.query().insert({
      date: '2026-10-01',
      amount: -5,
      currencyCode: 'USD',
      accountId: account.id,
      plaidTransactionId: 'txn-1',
      pending: false,
      categorized: false,
      description: 'old',
    } as any);

    await sync(
      [],
      [plaidTxn({ transaction_id: 'txn-1', amount: 20, name: 'new' })],
    );

    const stored = await UncategorizedBankTransaction.query().where(
      'plaidTransactionId',
      'txn-1',
    );
    expect(stored).toHaveLength(1);
    expect(Number(stored[0].amount)).toBe(-20);
    expect(stored[0].pending).toBeFalsy();
    expect(await counter()).toBe(0);
  });

  it('increments the counter by 1 when a posted transaction replaces an untouched pending row', async () => {
    const account = await Account.query().findOne({
      plaidAccountId: PLAID_ACCOUNT,
    });
    await create.create({
      date: '2026-10-01',
      amount: -5,
      currencyCode: 'USD',
      accountId: account.id,
      plaidTransactionId: 'pending-1',
      pending: true,
      description: 'pending',
    });
    expect(await counter()).toBe(0);

    await sync([
      plaidTxn({
        transaction_id: 'posted-1',
        pending: false,
        pending_transaction_id: 'pending-1',
        amount: 12.34,
      }),
    ]);

    const stored = await UncategorizedBankTransaction.query();
    expect(stored.map((row) => row.plaidTransactionId)).toEqual(['posted-1']);
    expect(await counter()).toBe(1);
  });

  it('increments the counter by 1 when one batch contains the same id twice', async () => {
    await sync([
      plaidTxn({ transaction_id: 'txn-1', name: 'first', amount: 5 }),
      plaidTxn({ transaction_id: 'txn-1', name: 'second', amount: 9 }),
    ]);

    const stored = await UncategorizedBankTransaction.query().where(
      'plaidTransactionId',
      'txn-1',
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].description).toBe('second');
    expect(await counter()).toBe(1);
  });

  it('does not change the counter when a booked pending row is kept and the posted row is skipped', async () => {
    const account = await Account.query().findOne({
      plaidAccountId: PLAID_ACCOUNT,
    });
    await UncategorizedBankTransaction.query().insert({
      date: '2026-10-01',
      amount: -5,
      currencyCode: 'USD',
      accountId: account.id,
      plaidTransactionId: 'pending-1',
      pending: true,
      categorized: true,
      description: 'booked pending',
    } as any);

    await sync([
      plaidTxn({
        transaction_id: 'posted-1',
        pending_transaction_id: 'pending-1',
      }),
    ]);

    const stored = await UncategorizedBankTransaction.query();
    expect(stored.map((row) => row.plaidTransactionId)).toEqual(['pending-1']);
    expect(await counter()).toBe(0);
  });

  it('adds nothing the second time the same batch is synced', async () => {
    const batch = [
      plaidTxn({ transaction_id: 'txn-1', amount: 12.34, name: 'COFFEE' }),
    ];
    await sync(batch);
    expect(await counter()).toBe(1);

    await sync([
      plaidTxn({ transaction_id: 'txn-1', amount: 15, name: 'COFFEE updated' }),
    ]);

    const stored = await UncategorizedBankTransaction.query().where(
      'plaidTransactionId',
      'txn-1',
    );
    expect(stored).toHaveLength(1);
    expect(Number(stored[0].amount)).toBe(-15);
    expect(await counter()).toBe(1);
  });

  it('decrements the counter by 1 when an untouched posted row is removed', async () => {
    const account = await Account.query().findOne({
      plaidAccountId: PLAID_ACCOUNT,
    });
    await create.create({
      date: '2026-10-28',
      amount: -12.34,
      currencyCode: 'USD',
      accountId: account.id,
      plaidTransactionId: 'posted-1',
      pending: false,
      description: 'COFFEE',
    });
    expect(await counter()).toBe(1);

    await sync([], [], ['posted-1']);

    expect(await UncategorizedBankTransaction.query()).toHaveLength(0);
    expect(await counter()).toBe(0);
  });

  it('throws when removeUncategorizedTransaction is called on a booked row and leaves the row and counter unchanged', async () => {
    const account = await Account.query().findOne({
      plaidAccountId: PLAID_ACCOUNT,
    });
    await Account.query()
      .findById(account.id)
      .patch({ uncategorizedTransactions: 1 } as any);
    const stored = await UncategorizedBankTransaction.query().insert({
      date: '2026-10-28',
      amount: -12.34,
      currencyCode: 'USD',
      accountId: account.id,
      plaidTransactionId: 'posted-booked',
      pending: false,
      categorized: true,
      description: 'booked',
    } as any);

    await expect(
      remove.removeUncategorizedTransaction(stored.id),
    ).rejects.toBeInstanceOf(ServiceError);

    const rows = await UncategorizedBankTransaction.query().where(
      'plaidTransactionId',
      'posted-booked',
    );
    expect(rows).toHaveLength(1);
    expect(await counter()).toBe(1);
  });

  it('keeps a booked posted row and does not change the counter when Plaid removes it', async () => {
    const account = await Account.query().findOne({
      plaidAccountId: PLAID_ACCOUNT,
    });
    await UncategorizedBankTransaction.query().insert({
      date: '2026-10-28',
      amount: -12.34,
      currencyCode: 'USD',
      accountId: account.id,
      plaidTransactionId: 'posted-1',
      pending: false,
      categorized: true,
      description: 'booked',
    } as any);

    await sync([], [], ['posted-1']);

    const stored = await UncategorizedBankTransaction.query();
    expect(stored.map((row) => row.plaidTransactionId)).toEqual(['posted-1']);
    expect(await counter()).toBe(0);
  });

  it('rethrows a mid-pagination Plaid error and applies nothing', async () => {
    (updater as any).plaidClient = client(
      [],
      [],
      [],
      jest
        .fn()
        .mockResolvedValueOnce({
          data: {
            added: [plaidTxn({ transaction_id: 'page-1' })],
            modified: [],
            removed: [],
            has_more: true,
            next_cursor: 'cursor-page-2',
          },
        })
        .mockRejectedValueOnce(new Error('plaid page failed')),
    );

    await expect(updater.updateTransactions(ITEM)).rejects.toThrow(
      'plaid page failed',
    );

    const item = await PlaidItem.query().findOne({ plaidItemId: ITEM });
    expect(item.lastCursor).toBe('cursor-1');
    expect(await UncategorizedBankTransaction.query()).toHaveLength(0);
    expect(await counter()).toBe(0);
  });

  it('locks the Plaid item for update before looking up accounts or transactions', async () => {
    const queries: string[] = [];
    const onQuery = (query: { sql: string }) => {
      queries.push(query.sql);
    };
    knex.on('query', onQuery);

    try {
      await sync([plaidTxn({ transaction_id: 'txn-lock' })]);
    } finally {
      knex.off('query', onQuery);
    }

    const sql = queries.map((query) => query.toLowerCase());
    const lockAt = sql.findIndex(
      (query) => query.includes('plaid_items') && query.includes('for update'),
    );
    const lookupAt = sql.findIndex(
      (query) =>
        query.includes('uncategorized_cashflow_transactions') ||
        (query.includes('from') &&
          query.includes('accounts') &&
          !query.includes('plaid_items')),
    );
    expect(lockAt).toBeGreaterThanOrEqual(0);
    expect(lookupAt).toBeGreaterThan(lockAt);
  });

  it('rolls back the cursor and the inserted rows when sync throws', async () => {
    jest
      .spyOn(plaidSync, 'updateLastFeedsUpdatedAt')
      .mockRejectedValue(new Error('mid-sync'));

    await expect(
      sync([plaidTxn({ transaction_id: 'txn-rollback' })]),
    ).rejects.toThrow('mid-sync');

    const item = await PlaidItem.query().findOne({ plaidItemId: ITEM });
    const stored = await UncategorizedBankTransaction.query();
    expect(item.lastCursor).toBe('cursor-1');
    expect(stored).toHaveLength(0);
    expect(await counter()).toBe(0);
  });
});

function client(
  added: any[],
  modified: any[] = [],
  removed: string[] = [],
  transactionsSync?: jest.Mock,
) {
  return {
    transactionsSync:
      transactionsSync ??
      jest.fn().mockResolvedValue({
        data: {
          added,
          modified,
          removed: removed.map((transaction_id) => ({ transaction_id })),
          has_more: false,
          next_cursor: 'cursor-next',
        },
      }),
    accountsGet: jest.fn().mockResolvedValue({
      data: {
        accounts: [
          {
            account_id: PLAID_ACCOUNT,
            name: 'Checking',
            official_name: 'Checking',
            mask: '1234',
            type: 'depository',
            balances: { current: 10, iso_currency_code: 'USD' },
          },
        ],
        item: { institution_id: 'ins_1', item_id: ITEM },
      },
    }),
    institutionsGetById: jest.fn().mockResolvedValue({
      data: { institution: { name: 'Capital One', institution_id: 'ins_1' } },
    }),
  };
}
