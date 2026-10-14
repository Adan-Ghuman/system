import { requestReason } from '../components/ui/ReasonDialog.js';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { useQueryPagination } from '../hooks/useQueryPagination.js';
import { PaginatedData } from '../lib/requestPolicy.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { QueryError } from '../components/ui/QueryError.js';
import { LoadingState } from '../components/ui/LoadingState.js';
import { PaginationControls } from '../components/ui/Pagination.js';
import { FormFeedback } from '../components/ui/WorkflowForm.js';
import { DocumentPreview } from './DocumentPreview.js';
import { OperationDocument, blankOperationLine } from './types.js';

interface Receipt { _id: string; receiptNo?: string; number?: string; gatePassNo: string; date: string; businessName: string; partyId: { _id: string; name: string }; status: 'POSTED' | 'REVERSED'; remarks: string; poNo?: string; externalReference?: string; items: Array<{ fabricType: string; yarnSpec: string; rollsCount?: number; rolls?: number; weightKg: number; wastageKg: number; remarks?: string }>; }
export function ReceiptHistory({ mode = 'knitting' }: { mode?: 'knitting' | 'dyeing' }) {
  const client = useQueryClient();const [search, setSearch] = useState('');const debounced = useDebounce(search, 300);const { page, limit, setPage, setLimit } = useQueryPagination([debounced]);const [preview, setPreview] = useState<OperationDocument | null>(null);const [error, setError] = useState<string | null>(null);const [working, setWorking] = useState('');
  const query = useQuery({ queryKey: [mode + '-receipts', debounced, page, limit], queryFn: async () => (await api.get<{ data: PaginatedData<Receipt> }>(mode === 'knitting' ? '/workspace/receipts' : '/workspace/dyeing-receipts', { params: { search: debounced, page, limit } })).data.data });
  async function reverse(receipt: Receipt) { const reason = await requestReason(`Why are you reversing receipt ${receipt.gatePassNo}?`);if (!reason?.trim()) return;setWorking(receipt._id);setError(null);try { await api.post(`/workspace/${mode === 'knitting' ? 'receipts' : 'dyeing-receipts'}/${receipt._id}/reverse`, { reason, requestId: crypto.randomUUID() });await client.invalidateQueries(); } catch (failure) { const value = failure as { response?: { data?: { error?: string } } };setError(value.response?.data?.error || 'Could not reverse this receipt.'); } finally { setWorking(''); } }
  function view(receipt: Receipt) { setPreview({ ...receipt, number: receipt.receiptNo || receipt.number || '', reference: receipt.gatePassNo, kind: mode === 'knitting' ? 'KNITTED_FABRIC_RECEIPT' : 'DYED_FABRIC_RECEIPT', direction: 'PAYABLE', location: 'ZR_GODOWN', total: 0, paid: 0, baseAmount: 0, taxPercent: 0, taxAmount: 0, items: receipt.items.map(item => ({ ...blankOperationLine(), ...item, rolls: item.rollsCount || item.rolls || 0, description: `Actual wastage: ${item.wastageKg.toFixed(3)} kg${item.remarks ? ' · ' + item.remarks : ''}` })) }); }
  return <Card className="space-y-4 p-4"><Input label="Find a fabric receipt" value={search} onChange={event => setSearch(event.target.value)} placeholder="Challan or receipt number" /><FormFeedback error={error} success={null} />{query.isError && <QueryError onRetry={() => query.refetch()} />}{query.isLoading ? <LoadingState /> : <div className="divide-y divide-line">{query.data?.items.map(receipt => <div className="space-y-3 py-4" key={receipt._id}><div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="text-sm text-strong">{receipt.gatePassNo} · {receipt.partyId?.name}</strong><p className="mt-1 text-xs text-soft">{new Date(receipt.date).toLocaleDateString()} · {receipt.receiptNo || receipt.number} · {receipt.status}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => view(receipt)}>View / print</Button>{receipt.status === 'POSTED' && <Button size="sm" variant="ghost" isLoading={working === receipt._id} onClick={() => reverse(receipt)}>Reverse receipt</Button>}</div></div>{receipt.items.map((item, index) => <p key={index} className="text-xs leading-relaxed text-ink">{item.fabricType} · {item.yarnSpec}: {item.rollsCount || item.rolls} rolls / {item.weightKg.toFixed(3)} kg · actual wastage {item.wastageKg.toFixed(3)} kg</p>)}</div>)}{!query.data?.total && <p className="py-6 text-center text-sm text-soft">Fabric receipts will appear here after you save them.</p>}</div>}<PaginationControls page={page} totalPages={query.data?.totalPages || 1} total={query.data?.total || 0} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />{preview && <DocumentPreview document={preview} onClose={() => setPreview(null)} />}</Card>;
}
