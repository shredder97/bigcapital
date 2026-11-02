export interface TodoPage<T> {
  data?: T[] | null;
  pagination?: { total?: number | null } | null;
}

export interface MergedTodos<T> {
  rows: T[];
  badge: number;
}

function timeOf(row: { date?: string | number | Date | null }): number {
  const ms = new Date(row.date ?? 0).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Merges one page per bank account, newest first. Drops duplicate ids.
 * The badge is the sum of each page's total, not the deduped length.
 */
export function mergeTodoPages<
  T extends { id?: number | null; date?: string | null },
>(pages: Array<TodoPage<T> | null | undefined>): MergedTodos<T> {
  const seen = new Set<number>();
  const rows: T[] = [];
  let badge = 0;
  (pages ?? []).forEach((page) => {
    badge += Number(page?.pagination?.total ?? 0);
    (page?.data ?? []).forEach((row) => {
      if (row?.id == null || seen.has(row.id)) {
        return;
      }
      seen.add(row.id);
      rows.push(row);
    });
  });
  rows.sort((a, b) => timeOf(b) - timeOf(a));
  return { rows, badge };
}
