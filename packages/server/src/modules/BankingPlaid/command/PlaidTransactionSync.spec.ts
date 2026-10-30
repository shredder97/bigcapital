import {
  planPlaidRemovals,
  planPlaidSync,
  plaidSyncLookupIds,
  PlaidSyncedRow,
  PlaidSyncTransaction,
} from './PlaidTransactionSync';

const txn = (
  overrides: Partial<PlaidSyncTransaction> = {},
): PlaidSyncTransaction => ({
  plaidTransactionId: 'txn-1',
  pending: false,
  pendingPlaidTransactionId: null,
  date: '2026-10-28',
  amount: -12.34,
  description: 'COFFEE',
  payee: 'Cafe',
  referenceNo: 'R1',
  ...overrides,
});

const row = (overrides: Partial<PlaidSyncedRow> = {}): PlaidSyncedRow => ({
  id: 1,
  plaidTransactionId: 'txn-1',
  pending: false,
  categorized: false,
  categorizeRefId: null,
  excludedAt: null,
  matched: false,
  ...overrides,
});

const bookedFlags = [
  ['categorized', { categorized: true }],
  ['categorizeRefId', { categorizeRefId: 9 }],
  ['excludedAt', { excludedAt: '2026-10-02' }],
  ['matched', { matched: true }],
] as const;

describe('planPlaidSync', () => {
  describe('dedupe by Plaid transaction id', () => {
    it('inserts one row when the same id appears twice and keeps the last copy', () => {
      const first = txn({
        description: 'first',
        amount: -5,
        payee: 'Old',
        referenceNo: 'OLD',
        date: '2026-10-01',
      });
      const second = txn({
        description: 'second',
        amount: -9,
        payee: 'New',
        referenceNo: 'NEW',
        date: '2026-10-28',
      });

      expect(planPlaidSync([first, second], [])).toEqual([
        { type: 'insert', transaction: second },
      ]);
    });

    it('keeps the last of three copies of one id', () => {
      const third = txn({ description: 'third', amount: -3 });

      expect(
        planPlaidSync(
          [
            txn({ description: 'first', amount: -1 }),
            txn({ description: 'second', amount: -2 }),
            third,
          ],
          [],
        ),
      ).toEqual([{ type: 'insert', transaction: third }]);
    });

    it('keeps the first position of a repeated id and the last payload', () => {
      const firstA = txn({ plaidTransactionId: 'a', description: 'a1' });
      const b = txn({ plaidTransactionId: 'b', description: 'b', amount: -2 });
      const lastA = txn({
        plaidTransactionId: 'a',
        description: 'a2',
        amount: -3,
      });

      expect(planPlaidSync([firstA, b, lastA], [])).toEqual([
        { type: 'insert', transaction: lastA },
        { type: 'insert', transaction: b },
      ]);
    });

    it('keeps two charges that share an amount, date and description', () => {
      const first = txn({ plaidTransactionId: 'txn-1' });
      const second = txn({ plaidTransactionId: 'txn-2' });

      expect(planPlaidSync([first, second], [])).toEqual([
        { type: 'insert', transaction: first },
        { type: 'insert', transaction: second },
      ]);
    });

    it('does not collapse transactions that have no Plaid id', () => {
      const first = txn({ plaidTransactionId: null, description: 'one' });
      const second = txn({ plaidTransactionId: null, description: 'two' });

      expect(planPlaidSync([first, second], [])).toEqual([
        { type: 'insert', transaction: first },
        { type: 'insert', transaction: second },
      ]);
    });

    it('returns no commands for an empty batch', () => {
      expect(planPlaidSync([], [row()])).toEqual([]);
    });

    it('inserts a new id and returns the same transaction object', () => {
      const transaction = txn({
        plaidTransactionId: 'new-1',
        amount: -12.34,
      });
      const [command] = planPlaidSync([transaction], []);

      expect(command).toEqual({ type: 'insert', transaction });
      if (command.type === 'insert') {
        expect(command.transaction).toBe(transaction);
        expect(command.transaction.amount).toBe(-12.34);
      }
    });
  });

  describe('existing rows', () => {
    it('patches safe fields on an untouched row and does not insert', () => {
      const transaction = txn({
        pending: false,
        date: '2026-10-28',
        amount: -12.34,
        description: 'new',
        payee: 'Cafe',
        referenceNo: 'R1',
      });

      const commands = planPlaidSync(
        [transaction],
        [row({ id: 4, pending: true })],
      );

      expect(commands).toEqual([
        {
          type: 'patch',
          id: 4,
          values: {
            date: '2026-10-28',
            amount: -12.34,
            description: 'new',
            payee: 'Cafe',
            referenceNo: 'R1',
          },
        },
      ]);
      const patch = commands[0];
      if (patch.type !== 'patch') {
        throw new Error('expected a patch');
      }
      expect(Object.keys(patch.values).sort()).toEqual([
        'amount',
        'date',
        'description',
        'payee',
        'referenceNo',
      ]);
    });

    it('patches a null reference number through', () => {
      const commands = planPlaidSync(
        [txn({ referenceNo: null, payee: undefined })],
        [row()],
      );

      expect(commands).toEqual([
        {
          type: 'patch',
          id: 1,
          values: {
            date: '2026-10-28',
            amount: -12.34,
            description: 'COFFEE',
            payee: undefined,
            referenceNo: null,
          },
        },
      ]);
    });

    it('patches every unbooked duplicate and does not insert another', () => {
      const transaction = txn({ amount: -8, description: 'updated' });

      expect(
        planPlaidSync([transaction], [row({ id: 1 }), row({ id: 2 })]),
      ).toEqual([
        {
          type: 'patch',
          id: 1,
          values: {
            date: transaction.date,
            amount: -8,
            description: 'updated',
            payee: transaction.payee,
            referenceNo: transaction.referenceNo,
          },
        },
        {
          type: 'patch',
          id: 2,
          values: {
            date: transaction.date,
            amount: -8,
            description: 'updated',
            payee: transaction.payee,
            referenceNo: transaction.referenceNo,
          },
        },
      ]);
    });

    it('patches the unbooked duplicate and skips the booked one', () => {
      const transaction = txn({ amount: -8 });

      expect(
        planPlaidSync(
          [transaction],
          [row({ id: 1, categorized: true }), row({ id: 2 })],
        ),
      ).toEqual([
        {
          type: 'skip',
          message: 'Skipping booked Plaid transaction txn-1',
        },
        {
          type: 'patch',
          id: 2,
          values: {
            date: transaction.date,
            amount: -8,
            description: transaction.description,
            payee: transaction.payee,
            referenceNo: transaction.referenceNo,
          },
        },
      ]);
    });

    it.each(bookedFlags)(
      'skips a row booked by %s and ignores the incoming amount',
      (_name, flags) => {
        expect(planPlaidSync([txn({ amount: -99 })], [row(flags)])).toEqual([
          {
            type: 'skip',
            message: 'Skipping booked Plaid transaction txn-1',
          },
        ]);
      },
    );

    it('skips every booked duplicate', () => {
      expect(
        planPlaidSync(
          [txn()],
          [row({ id: 1, categorized: true }), row({ id: 2, matched: true })],
        ),
      ).toEqual([
        { type: 'skip', message: 'Skipping booked Plaid transaction txn-1' },
        { type: 'skip', message: 'Skipping booked Plaid transaction txn-1' },
      ]);
    });

    it('does not treat a categorized-false unmatched row as booked', () => {
      const transaction = txn();

      expect(planPlaidSync([transaction], [row()])).toEqual([
        {
          type: 'patch',
          id: 1,
          values: {
            date: transaction.date,
            amount: transaction.amount,
            description: transaction.description,
            payee: transaction.payee,
            referenceNo: transaction.referenceNo,
          },
        },
      ]);
    });
  });

  describe('pending replaced by posted', () => {
    const posted = () =>
      txn({
        plaidTransactionId: 'posted-1',
        pending: false,
        pendingPlaidTransactionId: 'pending-1',
        amount: -12.34,
      });

    it('deletes an untouched pending row and then inserts the posted one', () => {
      const transaction = posted();

      expect(
        planPlaidSync(
          [transaction],
          [row({ id: 5, plaidTransactionId: 'pending-1', pending: true })],
        ),
      ).toEqual([
        { type: 'delete', id: 5 },
        { type: 'insert', transaction },
      ]);
    });

    it('deletes every untouched pending duplicate and inserts once', () => {
      const transaction = posted();

      expect(
        planPlaidSync(
          [transaction],
          [
            row({ id: 5, plaidTransactionId: 'pending-1', pending: true }),
            row({ id: 6, plaidTransactionId: 'pending-1', pending: true }),
          ],
        ),
      ).toEqual([
        { type: 'delete', id: 5 },
        { type: 'delete', id: 6 },
        { type: 'insert', transaction },
      ]);
    });

    it.each(bookedFlags)(
      'keeps a pending row booked by %s and does not insert the posted one',
      (_name, flags) => {
        expect(
          planPlaidSync(
            [posted()],
            [
              row({
                id: 5,
                plaidTransactionId: 'pending-1',
                pending: true,
                ...flags,
              }),
            ],
          ),
        ).toEqual([
          {
            type: 'skip',
            message:
              'Keeping Plaid transaction pending-1; skipping posted posted-1',
          },
        ]);
      },
    );

    it('keeps the whole pending group when any duplicate is booked', () => {
      expect(
        planPlaidSync(
          [posted()],
          [
            row({ id: 5, plaidTransactionId: 'pending-1', pending: true }),
            row({
              id: 6,
              plaidTransactionId: 'pending-1',
              pending: true,
              excludedAt: '2026-10-02',
            }),
          ],
        ),
      ).toEqual([
        {
          type: 'skip',
          message:
            'Keeping Plaid transaction pending-1; skipping posted posted-1',
        },
      ]);
    });

    it('inserts the posted transaction when the pending id is not stored', () => {
      const transaction = posted();

      expect(planPlaidSync([transaction], [])).toEqual([
        { type: 'insert', transaction },
      ]);
    });

    it('inserts a transaction that has no pending id', () => {
      const transaction = txn({
        plaidTransactionId: 'posted-1',
        pendingPlaidTransactionId: null,
      });

      expect(planPlaidSync([transaction], [])).toEqual([
        { type: 'insert', transaction },
      ]);
    });

    it('does not delete a non-pending row found by pending id and does not insert', () => {
      expect(
        planPlaidSync(
          [posted()],
          [row({ id: 5, plaidTransactionId: 'pending-1', pending: false })],
        ),
      ).toEqual([
        {
          type: 'skip',
          message:
            'Keeping Plaid transaction pending-1; skipping posted posted-1',
        },
      ]);
    });

    it('patches an existing posted id and leaves its pending predecessor alone', () => {
      const transaction = posted();

      expect(
        planPlaidSync(
          [transaction],
          [
            row({ id: 8, plaidTransactionId: 'posted-1' }),
            row({ id: 5, plaidTransactionId: 'pending-1', pending: true }),
          ],
        ),
      ).toEqual([
        {
          type: 'patch',
          id: 8,
          values: {
            date: transaction.date,
            amount: transaction.amount,
            description: transaction.description,
            payee: transaction.payee,
            referenceNo: transaction.referenceNo,
          },
        },
      ]);
    });

    it('does not replace a pending row when the incoming transaction is still pending', () => {
      const transaction = txn({
        plaidTransactionId: 'pending-2',
        pending: true,
        pendingPlaidTransactionId: 'pending-1',
      });

      expect(
        planPlaidSync(
          [transaction],
          [row({ id: 5, plaidTransactionId: 'pending-1', pending: true })],
        ),
      ).toEqual([{ type: 'insert', transaction }]);
    });
  });
});

describe('planPlaidRemovals', () => {
  it('deletes an untouched pending row', () => {
    expect(
      planPlaidRemovals(
        ['pending-1'],
        [row({ id: 5, plaidTransactionId: 'pending-1', pending: true })],
      ),
    ).toEqual([{ type: 'delete', id: 5 }]);
  });

  it('skips a removed id whose row is not pending', () => {
    expect(
      planPlaidRemovals(
        ['posted-1'],
        [row({ id: 2, plaidTransactionId: 'posted-1', pending: false })],
      ),
    ).toEqual([
      {
        type: 'skip',
        message: 'Skipping removal of Plaid transaction posted-1',
      },
    ]);
  });

  it.each(bookedFlags)(
    'skips a removed pending row booked by %s',
    (_name, flags) => {
      expect(
        planPlaidRemovals(
          ['pending-1'],
          [
            row({
              id: 5,
              plaidTransactionId: 'pending-1',
              pending: true,
              ...flags,
            }),
          ],
        ),
      ).toEqual([
        {
          type: 'skip',
          message: 'Skipping removal of Plaid transaction pending-1',
        },
      ]);
    },
  );

  it('skips a removed booked row that is not pending', () => {
    expect(
      planPlaidRemovals(
        ['posted-1'],
        [
          row({
            id: 2,
            plaidTransactionId: 'posted-1',
            pending: false,
            categorized: true,
          }),
        ],
      ),
    ).toEqual([
      {
        type: 'skip',
        message: 'Skipping removal of Plaid transaction posted-1',
      },
    ]);
  });

  it('deletes only the untouched pending rows in a mixed removal', () => {
    expect(
      planPlaidRemovals(
        ['booked-1', 'posted-1', 'pending-1', 'missing'],
        [
          row({
            id: 1,
            plaidTransactionId: 'booked-1',
            pending: true,
            categorizeRefId: 12,
          }),
          row({ id: 2, plaidTransactionId: 'posted-1', pending: false }),
          row({ id: 3, plaidTransactionId: 'pending-1', pending: true }),
          row({ id: 4, plaidTransactionId: 'stay', pending: true }),
        ],
      ),
    ).toEqual([
      {
        type: 'skip',
        message: 'Skipping removal of Plaid transaction booked-1',
      },
      {
        type: 'skip',
        message: 'Skipping removal of Plaid transaction posted-1',
      },
      { type: 'delete', id: 3 },
    ]);
  });

  it('returns no commands when the removed id is not stored', () => {
    expect(
      planPlaidRemovals(
        ['missing'],
        [row({ plaidTransactionId: 'other', pending: true })],
      ),
    ).toEqual([]);
  });

  it('returns no commands for an empty removal list', () => {
    expect(
      planPlaidRemovals(
        [],
        [row({ pending: true, plaidTransactionId: 'pending-1' })],
      ),
    ).toEqual([]);
    expect(planPlaidRemovals(undefined, [row({ pending: true })])).toEqual([]);
  });

  it('does not throw for a booked or non-pending removal', () => {
    expect(() =>
      planPlaidRemovals(
        ['booked-1', 'posted-1'],
        [
          row({
            plaidTransactionId: 'booked-1',
            pending: true,
            matched: true,
          }),
          row({ plaidTransactionId: 'posted-1', pending: false }),
        ],
      ),
    ).not.toThrow();
  });
});

describe('plaidSyncLookupIds', () => {
  it('includes each transaction id and pending id once', () => {
    expect(
      plaidSyncLookupIds([
        txn({ plaidTransactionId: 'a', pendingPlaidTransactionId: 'p' }),
        txn({ plaidTransactionId: 'a', pendingPlaidTransactionId: 'p' }),
        txn({ plaidTransactionId: 'b', pendingPlaidTransactionId: null }),
        txn({ plaidTransactionId: null, pendingPlaidTransactionId: '' }),
      ]),
    ).toEqual(['a', 'p', 'b']);
  });

  it('returns no ids for an empty batch', () => {
    expect(plaidSyncLookupIds([])).toEqual([]);
  });
});
