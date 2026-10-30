/**
 * Pure decisions for one Plaid sync batch. The caller loads rows for a single
 * account, applies the commands in order, and logs skips.
 */
export interface PlaidSyncTransaction {
  plaidTransactionId?: string | null;
  pending?: boolean;
  pendingPlaidTransactionId?: string | null;
  date: Date | string;
  amount: number;
  description?: string;
  payee?: string;
  referenceNo?: string | null;
}

export interface PlaidSyncedRow {
  id: number;
  plaidTransactionId: string;
  pending: boolean;
  categorized: boolean;
  categorizeRefId: number | null;
  excludedAt: Date | string | null;
  matched: boolean;
}

type PlaidSyncPatch = Pick<
  PlaidSyncTransaction,
  'date' | 'amount' | 'description' | 'payee' | 'referenceNo'
>;

export type PlaidSyncCommand<T> =
  | { type: 'insert'; transaction: T }
  | { type: 'patch'; id: number; values: PlaidSyncPatch }
  | { type: 'delete'; id: number }
  | { type: 'skip'; message: string };

/**
 * Plans inserts, patches, pending deletions, and skips for one account batch.
 * A repeated Plaid id keeps its first position and its last payload. Amount,
 * date, and description are not identity.
 */
export function planPlaidSync<T extends PlaidSyncTransaction>(
  incoming: T[],
  existing: PlaidSyncedRow[],
): PlaidSyncCommand<T>[] {
  const byId = rowsByPlaidId(existing);
  const commands: PlaidSyncCommand<T>[] = [];

  for (const transaction of dedupeLast(incoming)) {
    const rows = transaction.plaidTransactionId
      ? (byId.get(transaction.plaidTransactionId) ?? [])
      : [];

    if (rows.length) {
      for (const row of rows) {
        commands.push(
          isBooked(row)
            ? {
                type: 'skip',
                message: `Skipping booked Plaid transaction ${row.plaidTransactionId}`,
              }
            : { type: 'patch', id: row.id, values: patchValues(transaction) },
        );
      }
      continue;
    }

    if (!transaction.pending && transaction.pendingPlaidTransactionId) {
      const pendingRows = byId.get(transaction.pendingPlaidTransactionId) ?? [];
      if (pendingRows.some((row) => isBooked(row) || !row.pending)) {
        commands.push({
          type: 'skip',
          message: `Keeping Plaid transaction ${transaction.pendingPlaidTransactionId}; skipping posted ${transaction.plaidTransactionId}`,
        });
        continue;
      }
      for (const row of pendingRows) {
        commands.push({ type: 'delete', id: row.id });
      }
    }

    commands.push({ type: 'insert', transaction });
  }

  return commands;
}

/**
 * Plans deletions for removed Plaid ids. A booked row is skipped. An
 * untouched posted row is deleted so the caller can decrement the counter.
 */
export function planPlaidRemovals(
  removedIds: string[] | undefined,
  existing: PlaidSyncedRow[],
): Array<Extract<PlaidSyncCommand<never>, { type: 'delete' | 'skip' }>> {
  if (!removedIds?.length) {
    return [];
  }
  const removed = new Set(removedIds);
  const commands: Array<
    Extract<PlaidSyncCommand<never>, { type: 'delete' | 'skip' }>
  > = [];

  for (const row of existing) {
    if (!removed.has(row.plaidTransactionId)) {
      continue;
    }
    if (isBooked(row)) {
      commands.push({
        type: 'skip',
        message: `Skipping removal of Plaid transaction ${row.plaidTransactionId}`,
      });
      continue;
    }
    commands.push({ type: 'delete', id: row.id });
  }

  return commands;
}

/**
 * Plaid ids the caller must load before planning: the batch ids and any
 * pending id a posted transaction might replace.
 */
export function plaidSyncLookupIds(incoming: PlaidSyncTransaction[]): string[] {
  const ids = new Set<string>();
  for (const item of incoming) {
    if (item.plaidTransactionId) {
      ids.add(item.plaidTransactionId);
    }
    if (item.pendingPlaidTransactionId) {
      ids.add(item.pendingPlaidTransactionId);
    }
  }
  return [...ids];
}

function dedupeLast<T extends PlaidSyncTransaction>(items: T[]): T[] {
  const indexById = new Map<string, number>();
  const result: T[] = [];

  for (const item of items) {
    const id = item.plaidTransactionId;
    if (!id) {
      result.push(item);
      continue;
    }
    const index = indexById.get(id);
    if (index === undefined) {
      indexById.set(id, result.length);
      result.push(item);
    } else {
      result[index] = item;
    }
  }

  return result;
}

function rowsByPlaidId(rows: PlaidSyncedRow[]) {
  const map = new Map<string, PlaidSyncedRow[]>();
  for (const row of rows) {
    const group = map.get(row.plaidTransactionId) ?? [];
    group.push(row);
    map.set(row.plaidTransactionId, group);
  }
  return map;
}

function patchValues(transaction: PlaidSyncTransaction): PlaidSyncPatch {
  return {
    date: transaction.date,
    amount: transaction.amount,
    description: transaction.description,
    payee: transaction.payee,
    referenceNo: transaction.referenceNo,
  };
}

function isBooked(row: PlaidSyncedRow): boolean {
  return (
    !!row.categorized ||
    row.categorizeRefId != null ||
    row.excludedAt != null ||
    !!row.matched
  );
}
