import { fetchAccountUncategorizedTransactions } from '@bigcapital/sdk-ts';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { mergeTodoPages } from './merge';
import type { TodoRow } from './TodoInboxView';
import { useCashflowAccounts } from '@/hooks/query/cashflow-accounts/queries';
import { cashflowAccountsKeys } from '@/hooks/query/cashflow-accounts/query-keys';
import { useApiFetcher } from '@/hooks/useRequest';

export function useTodoInbox(pageSize = 100) {
  const page = useMemo(() => ({ page: 1, pageSize }), [pageSize]);
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  const accountsQuery = useCashflowAccounts();
  const accounts = Array.isArray(accountsQuery.data) ? accountsQuery.data : [];
  const ids = accounts
    .map((account) => account.id)
    .filter((id): id is number => id != null);

  const results = useQueries({
    queries: ids.map((accountId) => ({
      queryKey: cashflowAccountsKeys.uncategorizedInfinity(accountId, page),
      queryFn: () =>
        fetchAccountUncategorizedTransactions(fetcher, accountId, page),
    })),
  });

  const merged = mergeTodoPages<TodoRow>(
    results.map((result) => ({
      data: (result.data?.data ?? []) as TodoRow[],
      pagination: result.data?.pagination,
    })),
  );

  return {
    rows: merged.rows,
    badge: merged.badge,
    loading:
      accountsQuery.isLoading || results.some((result) => result.isLoading),
    error: accountsQuery.isError || results.some((result) => result.isError),
  };
}
