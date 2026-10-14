import { useEffect, useState } from 'react';

export function useListPagination<T>(items: T[], filters: unknown[]) {
  const [requestedPage, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const filterKey = JSON.stringify(filters);
  const totalPages = Math.max(1, Math.ceil(items.length / limit));
  const page = Math.min(requestedPage, totalPages);
  useEffect(() => { setPage(1); }, [filterKey, limit]);
  return { items: items.slice((page - 1) * limit, page * limit), page, limit, total: items.length, totalPages, setPage, setLimit };
}
