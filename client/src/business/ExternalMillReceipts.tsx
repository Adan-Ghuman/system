import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { useQueryPagination } from '../hooks/useQueryPagination.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { PaginationControls } from '../components/ui/Pagination.js';
import { QueryError } from '../components/ui/QueryError.js';
import { LoadingState } from '../components/ui/LoadingState.js';
import { OperationDocument } from './types.js';
import { DocumentPreview } from './DocumentPreview.js';
import { PartyLink } from './PartyLink.js';

export function ExternalMillReceipts() {
  const [search, setSearch] = useState('');const debounced = useDebounce(search, 300);const { page, limit, setPage, setLimit } = useQueryPagination([debounced]);const [preview, setPreview] = useState<OperationDocument | null>(null);
  const query = useQuery({ queryKey: ['external-mill-receipts', debounced, page, limit], queryFn: async () => (await api.get<{ data: { items: OperationDocument[]; total: number; totalPages: number } }>('/workspace/external-mill-receipts', { params: { search: debounced, page, limit } })).data.data });
  return <Card className="space-y-4 p-4"><div><h2 className="text-sm font-semibold text-strong">Mill gate passes received without a prior issue</h2><p className="mt-1 text-xs text-soft">These are inward stock receipts against the sending mill’s paper gate pass. They do not invent raw-fabric issues or wastage.</p></div><Input label="Find a mill gate pass" value={search} onChange={event => setSearch(event.target.value)} placeholder="e.g. 0033/26" />{query.isError && <QueryError onRetry={() => query.refetch()} />}{query.isLoading ? <LoadingState /> : <div className="divide-y divide-line">{query.data?.items.map(document => <div key={document._id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong className="text-sm text-strong">{document.reference} · {document.status}</strong><p className="mt-1 text-xs text-soft"><PartyLink party={document.partyId} /> · {document.items.reduce((sum, item) => sum + item.rolls, 0)} rolls · {document.items.reduce((sum, item) => sum + item.weightKg, 0).toFixed(3)} kg</p></div><Button size="sm" variant="outline" onClick={() => setPreview(document)}>View mill receipt / print</Button></div>)}{!query.data?.total && <p className="py-4 text-xs text-soft">No external mill gate passes received yet.</p>}</div>}<PaginationControls page={page} limit={limit} total={query.data?.total || 0} totalPages={query.data?.totalPages || 1} onPageChange={setPage} onLimitChange={setLimit} />{preview && <DocumentPreview document={preview} onClose={() => setPreview(null)} />}</Card>;
}
