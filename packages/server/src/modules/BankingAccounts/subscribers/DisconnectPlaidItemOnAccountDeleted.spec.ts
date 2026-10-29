import { Logger } from '@nestjs/common';
import { DisconnectPlaidItemOnAccountDeleted } from './DisconnectPlaidItemOnAccountDeleted';

type Row = { id: number; [key: string]: any };

function queryOf(rows: Row[]) {
  const filters: Array<(row: Row) => boolean> = [];
  const matched = () => rows.filter((row) => filters.every((fn) => fn(row)));
  const api = {
    where(column: string, value: unknown) {
      filters.push((row) => row[column] === value);
      return api;
    },
    whereNot(column: string, value: unknown) {
      filters.push((row) => row[column] !== value);
      return api;
    },
    findOne: (column: string, value: unknown) =>
      Promise.resolve(rows.find((row) => row[column] === value)),
    delete() {
      matched().forEach((row) => rows.splice(rows.indexOf(row), 1));
      return Promise.resolve();
    },
    resultSize: () => Promise.resolve(matched().length),
  };
  return api;
}

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setImmediate(r));
};

describe('DisconnectPlaidItemOnAccountDeleted', () => {
  const plaidItemId = 'item-test-1';
  const accessToken = 'access-token-test';
  const deleted = { id: 1, plaidItemId, plaidAccountId: 'plaid-acct-1' };
  const systemRow = { id: 10, plaidItemId, tenantId: 7 };
  let accounts: Row[];
  let tenantItems: Row[];
  let systemItems: Row[];
  let itemRemove: jest.Mock;
  let resolveCommit: () => void;
  let rejectCommit: (reason?: unknown) => void;
  let handle: () => Promise<void>;

  beforeEach(() => {
    accounts = [{ ...deleted }];
    tenantItems = [{ id: 1, plaidItemId, plaidAccessToken: accessToken }];
    systemItems = [{ ...systemRow }];
    itemRemove = jest.fn().mockResolvedValue({});
    const executionPromise = new Promise<void>((resolve, reject) => {
      resolveCommit = resolve;
      rejectCommit = reject;
    });
    executionPromise.catch(() => undefined);
    const model = (rows: Row[]) => () => ({ query: () => queryOf(rows) });
    const subscriber = new DisconnectPlaidItemOnAccountDeleted(
      { itemRemove } as any,
      model(tenantItems) as any,
      model(accounts) as any,
      { query: () => queryOf(systemItems) } as any,
    );
    handle = () =>
      subscriber.handleDisconnectPlaidItemOnAccountDelete({
        oldAccount: deleted,
        trx: { executionPromise },
      } as any);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps the Plaid item when a sibling account is still linked', async () => {
    const sibling = { id: 2, plaidItemId, plaidAccountId: 'plaid-acct-2' };
    accounts.push(sibling);
    await handle();
    resolveCommit();
    await settle();
    expect(sibling.plaidItemId).toBe(plaidItemId);
    expect(sibling.plaidAccountId).toBe('plaid-acct-2');
    expect(tenantItems).toHaveLength(1);
    expect(systemItems).toEqual([systemRow]);
    expect(itemRemove).not.toHaveBeenCalled();
  });

  it('removes the Plaid item after commit when the last linked account is deleted', async () => {
    itemRemove.mockImplementation(() => expect(systemItems).toEqual([]));
    await handle();
    expect(tenantItems).toEqual([]);
    expect(systemItems).toEqual([systemRow]);
    expect(itemRemove).not.toHaveBeenCalled();
    resolveCommit();
    await settle();
    expect(itemRemove).toHaveBeenCalledTimes(1);
    expect(itemRemove).toHaveBeenCalledWith({ access_token: accessToken });
  });

  it('still succeeds when itemRemove throws and does not log the access token', async () => {
    const error = new Error(`Plaid rejected ${accessToken}`);
    (error as any).config = {
      data: JSON.stringify({ access_token: accessToken }),
    };
    itemRemove.mockRejectedValue(error);
    await expect(handle()).resolves.toBeUndefined();
    resolveCommit();
    await settle();
    expect(systemItems).toEqual([]);
    expect(
      JSON.stringify((Logger.prototype.error as jest.Mock).mock.calls),
    ).not.toContain(accessToken);
  });

  it('leaves the system Plaid item when the transaction rolls back', async () => {
    await handle();
    rejectCommit(new Error('rollback'));
    await settle();
    expect(itemRemove).not.toHaveBeenCalled();
    expect(systemItems).toEqual([systemRow]);
  });
});
