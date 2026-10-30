import { Logger } from '@nestjs/common';
import { PlaidSyncDb } from './PlaidSyncDB';
import { PlaidUpdateTransactions } from './PlaidUpdateTransactions';

type Row = Record<string, any>;

function createQuery(rows: Row[]) {
  const filters: Array<(row: Row) => boolean> = [];
  const matched = () => rows.filter((row) => filters.every((fn) => fn(row)));
  const builder: any = {
    where(column: any, value?: any) {
      if (typeof column === 'object') {
        filters.push((row) =>
          Object.entries(column).every(
            ([key, expected]) => row[key] === expected,
          ),
        );
      } else {
        filters.push((row) => row[column] === value);
      }
      return builder;
    },
    whereIn(column: string, values: any[]) {
      const set = new Set(values);
      filters.push((row) => set.has(row[column]));
      return builder;
    },
    withGraphFetched() {
      return builder;
    },
    findOne(criteria: any, value?: any) {
      const found =
        typeof criteria === 'string'
          ? rows.find((row) => row[criteria] === value)
          : rows.find((row) =>
              Object.entries(criteria).every(
                ([key, expected]) => row[key] === expected,
              ),
            );
      return {
        throwIfNotFound: () => {
          if (!found) {
            throw new Error('NotFound');
          }
          return Promise.resolve(found);
        },
        forUpdate: () => Promise.resolve(found),
        patch: (values: Row) => {
          if (found) {
            Object.assign(found, values);
          }
          return Promise.resolve(found ? 1 : 0);
        },
      };
    },
    findById(id: number) {
      const found = rows.find((row) => row.id === id);
      return {
        patch: (values: Row) => {
          if (found) {
            Object.assign(found, values);
          }
          return Promise.resolve(found);
        },
      };
    },
    patch(values: Row) {
      matched().forEach((row) => Object.assign(row, values));
      return Promise.resolve(1);
    },
    then(onFulfilled: any, onRejected: any) {
      return Promise.resolve(matched()).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

const modelOf = (rows: Row[]) => () => ({ query: () => createQuery(rows) });

const plaidTxn = (overrides: Record<string, any> = {}) =>
  ({
    account_id: 'plaid-acc',
    date: '2026-10-28',
    amount: 12.34,
    name: 'COFFEE',
    iso_currency_code: 'USD',
    transaction_id: 'txn-1',
    pending: false,
    pending_transaction_id: null,
    payment_meta: null,
    ...overrides,
  }) as any;

const bankRow = (overrides: Row = {}): Row => ({
  id: 1,
  accountId: 7,
  plaidTransactionId: 'txn-1',
  pending: false,
  categorized: false,
  categorizeRefId: null,
  excludedAt: null,
  matchedBankTransactions: [],
  amount: -1,
  date: '2026-10-01',
  description: 'old',
  payee: 'old',
  referenceNo: 'old',
  ...overrides,
});

describe('PlaidSyncDb transactions', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  const build = (rows: Row[], items: Row[] = []) => {
    let nextId = 100;
    const create = jest.fn(async (dto: Row) => {
      const row = bankRow({
        id: nextId++,
        matchedBankTransactions: [],
        ...dto,
      });
      rows.push(row);
      return row;
    });
    const remove = jest.fn(async (id: number) => {
      const index = rows.findIndex((row) => row.id === id);
      if (!rows[index]?.pending) {
        throw new Error('TRANSACTION_NOT_PENDING');
      }
      rows.splice(index, 1);
    });
    const accounts = [{ id: 7, plaidAccountId: 'plaid-acc' }];
    const sync = new PlaidSyncDb(
      {} as any,
      { create } as any,
      { removePendingTransaction: remove } as any,
      { emitAsync: jest.fn().mockResolvedValue([]) } as any,
      modelOf(accounts) as any,
      modelOf(items) as any,
      modelOf(rows) as any,
    );
    return { sync, create, remove };
  };

  it('inserts one row when the same transaction id appears twice in a batch', async () => {
    const rows: Row[] = [];
    const { sync, create } = build(rows);

    await sync.syncAccountTranactions('plaid-acc' as any, [
      plaidTxn({ transaction_id: 'txn-1', name: 'first', amount: 5 }),
      plaidTxn({ transaction_id: 'txn-1', name: 'second', amount: 9 }),
    ]);

    expect(create).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].plaidTransactionId).toBe('txn-1');
    expect(rows[0].description).toBe('second');
    expect(rows[0].amount).toBe(-9);
  });

  it('keeps two charges that share an amount, date and description when their Plaid ids differ', async () => {
    const rows: Row[] = [];
    const { sync, create } = build(rows);

    await sync.syncAccountTranactions('plaid-acc' as any, [
      plaidTxn({ transaction_id: 'txn-1' }),
      plaidTxn({ transaction_id: 'txn-2' }),
    ]);

    expect(create).toHaveBeenCalledTimes(2);
    expect(rows.map((row) => row.plaidTransactionId)).toEqual([
      'txn-1',
      'txn-2',
    ]);
  });

  it('does not treat a transaction id on another account as a duplicate', async () => {
    const rows = [
      bankRow({ id: 1, accountId: 99, plaidTransactionId: 'txn-1' }),
    ];
    const { sync, create } = build(rows);

    await sync.syncAccountTranactions('plaid-acc' as any, [
      plaidTxn({ transaction_id: 'txn-1' }),
    ]);

    expect(create).toHaveBeenCalledTimes(1);
    expect(rows.map((row) => row.accountId)).toEqual([99, 7]);
  });

  it('patches an untouched row and leaves pending and a booked row unchanged', async () => {
    const rows = [
      bankRow({
        id: 1,
        plaidTransactionId: 'open-1',
        pending: true,
      }),
      bankRow({
        id: 2,
        plaidTransactionId: 'booked-1',
        categorized: true,
        amount: -1,
        description: 'booked',
      }),
    ];
    const { sync, create } = build(rows);

    await sync.syncAccountTranactions('plaid-acc' as any, [
      plaidTxn({
        transaction_id: 'open-1',
        pending: false,
        amount: 12.34,
        date: '2026-10-28',
        name: 'new',
        payment_meta: { payee: 'Cafe', reference_number: 'R1' },
      }),
      plaidTxn({
        transaction_id: 'booked-1',
        amount: 99,
        name: 'changed',
        date: '2026-11-01',
      }),
    ]);

    expect(rows[0].pending).toBe(true);
    expect(rows[0].amount).toBe(-12.34);
    expect(rows[0].date).toBe('2026-10-28');
    expect(rows[0].description).toBe('new');
    expect(rows[0].payee).toBe('Cafe');
    expect(rows[0].referenceNo).toBe('R1');
    expect(rows[1]).toMatchObject({ amount: -1, description: 'booked' });
    expect(create).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('booked-1'));
  });

  it('does not insert or patch a row that was excluded', async () => {
    const rows = [
      bankRow({
        id: 1,
        plaidTransactionId: 'ex-1',
        excludedAt: '2026-10-02',
        amount: -4,
        description: 'kept',
      }),
    ];
    const { sync, create } = build(rows);

    await sync.syncAccountTranactions('plaid-acc' as any, [
      plaidTxn({ transaction_id: 'ex-1', amount: 50, name: 'changed' }),
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        plaidTransactionId: 'ex-1',
        amount: -4,
        description: 'kept',
      }),
    ]);
    expect(create).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ex-1'));
  });

  it('replaces an untouched pending row with the posted transaction', async () => {
    const rows = [
      bankRow({
        id: 1,
        plaidTransactionId: 'pending-1',
        pending: true,
      }),
    ];
    const { sync, remove, create } = build(rows);

    await sync.syncAccountTranactions('plaid-acc' as any, [
      plaidTxn({
        transaction_id: 'posted-1',
        pending: false,
        pending_transaction_id: 'pending-1',
      }),
    ]);

    expect(remove).toHaveBeenCalledWith(1, undefined);
    expect(create).toHaveBeenCalledTimes(1);
    expect(rows.map((row) => row.plaidTransactionId)).toEqual(['posted-1']);
  });

  it('keeps a booked pending row, skips the posted transaction, and logs it', async () => {
    const rows = [
      bankRow({
        id: 1,
        plaidTransactionId: 'pending-1',
        pending: true,
        matchedBankTransactions: [{ id: 50 }],
      }),
    ];
    const { sync, remove, create } = build(rows);

    await sync.syncAccountTranactions('plaid-acc' as any, [
      plaidTxn({
        transaction_id: 'posted-1',
        pending_transaction_id: 'pending-1',
      }),
    ]);

    expect(remove).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(rows.map((row) => row.plaidTransactionId)).toEqual(['pending-1']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('pending-1'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('posted-1'));
  });

  it('skips a removed booked or non-pending row and still saves the cursor', async () => {
    const rows = [
      bankRow({
        id: 1,
        plaidTransactionId: 'booked-1',
        pending: true,
        categorizeRefId: 12,
      }),
      bankRow({
        id: 2,
        plaidTransactionId: 'posted-1',
        pending: false,
      }),
      bankRow({
        id: 3,
        plaidTransactionId: 'pending-1',
        pending: true,
      }),
    ];
    const items = [
      {
        plaidItemId: 'item-1',
        plaidAccessToken: 'access-token',
        lastCursor: 'cursor-1',
        isPaused: false,
      },
    ];
    const { sync, remove } = build(rows, items);
    const plaidClient = {
      transactionsSync: jest.fn().mockResolvedValue({
        data: {
          added: [],
          modified: [],
          removed: [
            { transaction_id: 'booked-1' },
            { transaction_id: 'posted-1' },
            { transaction_id: 'pending-1' },
          ],
          has_more: false,
          next_cursor: 'cursor-next',
        },
      }),
      accountsGet: jest.fn().mockResolvedValue({
        data: {
          accounts: [],
          item: { institution_id: 'ins_1', item_id: 'item-1' },
        },
      }),
      institutionsGetById: jest.fn().mockResolvedValue({
        data: { institution: { name: 'Capital One' } },
      }),
    };
    const updater = new PlaidUpdateTransactions(
      sync,
      {} as any,
      modelOf(items) as any,
      plaidClient as any,
    );

    await expect(
      updater.updateTransactionsWork('item-1', {} as any),
    ).resolves.toEqual({
      addedCount: 0,
      modifiedCount: 0,
      removedCount: 3,
    });

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(3, expect.anything());
    expect(rows.map((row) => row.plaidTransactionId)).toEqual([
      'booked-1',
      'posted-1',
    ]);
    expect(items[0].lastCursor).toBe('cursor-next');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('booked-1'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('posted-1'));
  });
});
