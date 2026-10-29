import { Logger } from '@nestjs/common';
import { DisconnectPlaidItemOnAccountDeleted } from './DisconnectPlaidItemOnAccountDeleted';

type Row = { id: number; [key: string]: any };

class MemoryQuery<T extends Row> implements PromiseLike<T | undefined> {
  private filters: Array<(row: T) => boolean> = [];

  constructor(private readonly rows: T[]) {}

  findById(id: number) {
    this.filters.push((row) => row.id === id);
    return this;
  }

  where(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  whereNot(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  findOne(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  private matched() {
    return this.rows.filter((row) =>
      this.filters.every((filter) => filter(row)),
    );
  }

  async patch(values: Partial<T>) {
    const targets = this.matched();
    targets.forEach((row) => Object.assign(row, values));
    return targets.length;
  }

  async delete() {
    const targets = this.matched();
    targets.forEach((row) => {
      const index = this.rows.indexOf(row);
      if (index >= 0) this.rows.splice(index, 1);
    });
    return targets.length;
  }

  async resultSize() {
    return this.matched().length;
  }

  then<TResult1 = T | undefined, TResult2 = never>(
    onfulfilled?:
      | ((value: T | undefined) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.matched()[0]).then(onfulfilled, onrejected);
  }
}

const settle = async () => {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

describe('DisconnectPlaidItemOnAccountDeleted', () => {
  const plaidItemId = 'item-test-1';
  const accessToken = 'access-token-test';

  let accounts: Row[];
  let tenantItems: Row[];
  let systemItems: Row[];
  let accountTrx: unknown[];
  let tenantItemTrx: unknown[];
  let systemTrx: unknown[];
  let plaidClient: { itemRemove: jest.Mock };
  let subscriber: DisconnectPlaidItemOnAccountDeleted;
  let resolveCommit: () => void;
  let trx: { executionPromise: Promise<void> };
  let logs: unknown[][];

  const loggerMethods = ['error', 'warn', 'log', 'debug', 'verbose'] as const;
  const consoleMethods = ['error', 'warn', 'log', 'info', 'debug'] as const;

  beforeEach(() => {
    accounts = [];
    tenantItems = [];
    systemItems = [];
    accountTrx = [];
    tenantItemTrx = [];
    systemTrx = [];
    logs = [];
    plaidClient = { itemRemove: jest.fn().mockResolvedValue({ data: {} }) };

    let resolve: () => void;
    const executionPromise = new Promise<void>((res) => {
      resolve = res;
    });
    resolveCommit = resolve;
    trx = { executionPromise };

    const accountModel = () => ({
      query: (queryTrx?: unknown) => {
        accountTrx.push(queryTrx);
        return new MemoryQuery(accounts);
      },
    });
    const plaidItemModel = () => ({
      query: (queryTrx?: unknown) => {
        tenantItemTrx.push(queryTrx);
        return new MemoryQuery(tenantItems);
      },
    });
    const systemPlaidItemModel = {
      query: (queryTrx?: unknown) => {
        systemTrx.push(queryTrx);
        return new MemoryQuery(systemItems);
      },
    };

    subscriber = new DisconnectPlaidItemOnAccountDeleted(
      plaidClient as any,
      plaidItemModel as any,
      accountModel as any,
      systemPlaidItemModel as any,
    );

    loggerMethods.forEach((method) => {
      jest.spyOn(Logger.prototype, method).mockImplementation((...args) => {
        logs.push([method, ...args]);
      });
    });
    consoleMethods.forEach((method) => {
      jest.spyOn(console, method).mockImplementation((...args) => {
        logs.push(['console', method, ...args]);
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const seedItem = () => {
    tenantItems.push({
      id: 1,
      plaidItemId,
      plaidAccessToken: accessToken,
    });
    systemItems.push({ id: 10, plaidItemId, tenantId: 7 });
  };

  const deleteAccount = (account: Row) =>
    subscriber.handleDisconnectPlaidItemOnAccountDelete({
      accountId: account.id,
      oldAccount: account,
      trx,
    } as any);

  it('keeps the Plaid item when a sibling account is still linked', async () => {
    seedItem();
    const deleted = {
      id: 1,
      plaidItemId,
      plaidAccountId: 'plaid-acct-1',
    };
    const sibling = {
      id: 2,
      plaidItemId,
      plaidAccountId: 'plaid-acct-2',
    };
    accounts.push({ ...deleted }, sibling);

    await deleteAccount(deleted);
    resolveCommit();
    await settle();

    expect(accounts[0]).toMatchObject({
      plaidItemId: null,
      plaidAccountId: null,
    });
    expect(sibling).toEqual({
      id: 2,
      plaidItemId,
      plaidAccountId: 'plaid-acct-2',
    });
    expect(tenantItems).toEqual([
      { id: 1, plaidItemId, plaidAccessToken: accessToken },
    ]);
    expect(systemItems).toEqual([{ id: 10, plaidItemId, tenantId: 7 }]);
    expect(plaidClient.itemRemove).not.toHaveBeenCalled();
    expect(accountTrx.every((queryTrx) => queryTrx === trx)).toBe(true);
    expect(tenantItemTrx).toEqual([]);
    expect(systemTrx).toEqual([]);
  });

  it('removes the Plaid item after commit when the last linked account is deleted', async () => {
    seedItem();
    const deleted = {
      id: 1,
      plaidItemId,
      plaidAccountId: 'plaid-acct-1',
    };
    accounts.push({ ...deleted });

    await deleteAccount(deleted);

    expect(accounts[0]).toMatchObject({
      plaidItemId: null,
      plaidAccountId: null,
    });
    expect(tenantItems).toEqual([]);
    expect(systemItems).toEqual([]);
    expect(plaidClient.itemRemove).not.toHaveBeenCalled();
    expect(accountTrx.every((queryTrx) => queryTrx === trx)).toBe(true);
    expect(tenantItemTrx.every((queryTrx) => queryTrx === trx)).toBe(true);
    expect(systemTrx.every((queryTrx) => queryTrx === undefined)).toBe(true);

    resolveCommit();
    await settle();

    expect(plaidClient.itemRemove).toHaveBeenCalledTimes(1);
    expect(plaidClient.itemRemove).toHaveBeenCalledWith({
      access_token: accessToken,
    });
  });

  it('still deletes the account when itemRemove fails and does not log the access token', async () => {
    seedItem();
    const deleted = {
      id: 1,
      plaidItemId,
      plaidAccountId: 'plaid-acct-1',
    };
    accounts.push({ ...deleted });
    const failure = Object.assign(new Error(`Plaid rejected ${accessToken}`), {
      config: { data: JSON.stringify({ access_token: accessToken }) },
      response: { data: { access_token: accessToken } },
    });
    plaidClient.itemRemove.mockRejectedValue(failure);

    await expect(deleteAccount(deleted)).resolves.toBeUndefined();
    expect(accounts[0]).toMatchObject({
      plaidItemId: null,
      plaidAccountId: null,
    });
    expect(tenantItems).toEqual([]);
    expect(systemItems).toEqual([]);

    resolveCommit();
    await settle();

    expect(plaidClient.itemRemove).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(logs);
    expect(logged).not.toContain(accessToken);
    expect(logs.some((entry) => entry[0] === 'error')).toBe(true);
  });
});
