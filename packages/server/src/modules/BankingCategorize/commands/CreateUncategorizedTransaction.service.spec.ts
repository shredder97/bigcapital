import { events } from '@/common/events/events';
import { CreateUncategorizedTransactionService } from './CreateUncategorizedTransaction.service';

describe('CreateUncategorizedTransactionService', () => {
  const existing = {
    id: 4,
    accountId: 9,
    plaidTransactionId: 'txn-dup',
    pending: false,
  };

  const build = (insertAndFetch: jest.Mock) => {
    const emitAsync = jest.fn().mockResolvedValue([]);
    const service = new CreateUncategorizedTransactionService(
      { withTransaction: (work, trx) => work(trx) } as any,
      { emitAsync } as any,
      (() => ({
        query: () => ({
          insertAndFetch,
          findOne: () => ({
            throwIfNotFound: () => Promise.resolve(existing),
          }),
        }),
      })) as any,
    );
    return { service, emitAsync };
  };

  it('does not emit the created event on a duplicate key, so the uncategorized counter stays unchanged', async () => {
    const { service, emitAsync } = build(
      jest.fn().mockRejectedValue({ code: 'ER_DUP_ENTRY', errno: 1062 }),
    );

    const result = await service.create(
      { accountId: 9, plaidTransactionId: 'txn-dup', amount: -1 } as any,
      {} as any,
    );

    expect(result).toBe(existing);
    expect(emitAsync).toHaveBeenCalledTimes(1);
    expect(emitAsync).toHaveBeenCalledWith(
      events.cashflow.onTransactionUncategorizedCreating,
      expect.anything(),
    );
    expect(emitAsync).not.toHaveBeenCalledWith(
      events.cashflow.onTransactionUncategorizedCreated,
      expect.anything(),
    );
  });

  it('emits the created event when the insert succeeds', async () => {
    const created = { id: 8, accountId: 9, pending: false };
    const { service, emitAsync } = build(jest.fn().mockResolvedValue(created));

    const result = await service.create(
      { accountId: 9, plaidTransactionId: 'txn-new', amount: -1 } as any,
      {} as any,
    );

    expect(result).toBe(created);
    expect(emitAsync).toHaveBeenCalledWith(
      events.cashflow.onTransactionUncategorizedCreated,
      expect.objectContaining({ uncategorizedTransaction: created }),
    );
  });

  it('rethrows an insert error that is not a duplicate Plaid id', async () => {
    const error = { code: 'ER_NO_REFERENCED_ROW', errno: 1452 };
    const { service } = build(jest.fn().mockRejectedValue(error));

    await expect(
      service.create(
        { accountId: 9, plaidTransactionId: 'txn-new' } as any,
        {} as any,
      ),
    ).rejects.toBe(error);
  });

  it('rethrows a duplicate key when the transaction has no Plaid id', async () => {
    const error = { code: 'ER_DUP_ENTRY', errno: 1062 };
    const { service, emitAsync } = build(jest.fn().mockRejectedValue(error));

    await expect(
      service.create({ accountId: 9, amount: -1 } as any, {} as any),
    ).rejects.toBe(error);
    expect(emitAsync).not.toHaveBeenCalledWith(
      events.cashflow.onTransactionUncategorizedCreated,
      expect.anything(),
    );
  });
});
