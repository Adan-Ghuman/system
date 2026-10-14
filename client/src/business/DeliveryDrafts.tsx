import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { OperationDocument } from './types.js';
import { PaginatedData } from '../lib/requestPolicy.js';
import { useQueryPagination } from '../hooks/useQueryPagination.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { PaginationControls } from '../components/ui/Pagination.js';
import { useBusinessStore } from './store.js';

export function DeliveryDrafts({ onContinue }: { onContinue: (document: OperationDocument) => void }) {
  const businessId = useBusinessStore(state => state.id);const { page, limit, setPage, setLimit } = useQueryPagination([]);
  const query = useQuery({ queryKey: ['delivery-drafts', page, limit], queryFn: async () => (await api.get<{ data: PaginatedData<OperationDocument> }>('/dispatch/drafts', { params: { page, limit } })).data.data, enabled: Boolean(businessId) });
  if (!query.data?.total) return null;
  return <Card className="space-y-4 p-4"><h2 className="text-sm font-medium text-strong">Draft deliveries</h2>{query.data.items.map(document => <div className="flex flex-wrap items-center justify-between gap-3" key={document._id}><p className="text-xs text-soft">{document.number} · {String(document.draft?.fabricType || 'Unfinished entry')}</p><Button size="sm" variant="outline" onClick={() => onContinue(document)}>Continue delivery draft</Button></div>)}<PaginationControls page={page} totalPages={query.data.totalPages} total={query.data.total} limit={limit} onPageChange={setPage} onLimitChange={setLimit} /></Card>;
}
