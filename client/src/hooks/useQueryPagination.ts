import { useEffect, useState } from 'react';

export function useQueryPagination(filters: unknown[], initialLimit = 20) {
  const filterKey = JSON.stringify(filters);
  const [state, setState] = useState({ page: 1, limit: initialLimit, filterKey });
  const page = state.filterKey === filterKey ? state.page : 1;
  useEffect(() => {
    setState(current => current.filterKey === filterKey ? current : { ...current, page: 1, filterKey });
  }, [filterKey]);
  return {
    page, limit: state.limit,
    setPage: (nextPage: number) => setState(current => ({ ...current, page: Math.max(1, nextPage), filterKey })),
    setLimit: (limit: number) => setState({ page: 1, limit, filterKey })
  };
}
