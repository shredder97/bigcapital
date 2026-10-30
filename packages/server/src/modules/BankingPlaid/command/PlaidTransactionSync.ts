/**
 * Decisions for one Plaid sync batch. Callers load the account's rows, apply
 * the commands in order, and log skips. The functions throw until the sync
 * behavior is implemented.
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

export interface PlaidSyncPatch {
  date: Date | string;
  amount: number;
  description?: string;
  payee?: string;
  referenceNo?: string | null;
}

export type PlaidSyncCommand<T> =
  | { type: 'insert'; transaction: T }
  | { type: 'patch'; id: number; values: PlaidSyncPatch }
  | { type: 'delete'; id: number }
  | { type: 'skip'; message: string };

export function planPlaidSync<T extends PlaidSyncTransaction>(
  _incoming: T[],
  _existing: PlaidSyncedRow[],
): PlaidSyncCommand<T>[] {
  throw new Error('planPlaidSync is not implemented');
}

export function planPlaidRemovals(
  _removedIds: string[] | undefined,
  _existing: PlaidSyncedRow[],
): PlaidSyncCommand<PlaidSyncTransaction>[] {
  throw new Error('planPlaidRemovals is not implemented');
}

export function plaidSyncLookupIds(
  _incoming: PlaidSyncTransaction[],
): string[] {
  throw new Error('plaidSyncLookupIds is not implemented');
}
