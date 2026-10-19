import { requestReason } from '../components/ui/ReasonDialog.js';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { useQueryPagination } from '../hooks/useQueryPagination.js';
import { PaginatedData } from '../lib/requestPolicy.js';
import { FormFeedback } from '../components/ui/WorkflowForm.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { LoadingState } from '../components/ui/LoadingState.js';
import { QueryError } from '../components/ui/QueryError.js';
import { ScrollableTable } from '../components/ui/ScrollableTable.js';
import { PaginationControls } from '../components/ui/Pagination.js';
import { IssueYarnModal } from '../features/knitting/components/IssueYarnModal.js';
import { OperationForm } from './OperationForm.js';
import { OperationKind } from './types.js';
import { useBusinessStore } from './store.js';

interface YarnStock { _id: string; yarnSpec: string; packageUnit: string; quantity: number; totalWeightKg: number; ownerKey: string; }
interface Movement { _id: string; sourceId: string; item: string; date: string; quantity: number; weightKg: number; reason: string; }
export function YarnPage() {
  const client = useQueryClient();const [error, setError] = useState<string | null>(null);
  const businessId = useBusinessStore(state => state.id);const [receiving, setReceiving] = useState(false);const [kind, setKind] = useState<OperationKind | null>(null);const [tab, setTab] = useState('stock');const [search, setSearch] = useState('');const debounced = useDebounce(search, 300);
  const { page, limit, setPage, setLimit } = useQueryPagination([tab, debounced]);
  const query = useQuery({ queryKey: ['yarn-store', tab, debounced, page, limit], queryFn: async () => (await api.get<{ data: PaginatedData<YarnStock & Movement> }>(tab === 'stock' ? '/workspace/yarn' : '/production/movements', { params: { material: 'YARN', search: debounced, page, limit } })).data.data, enabled: Boolean(businessId) });
  return <div className="space-y-6"><PageHeader title="Yarn stock" description="See yarn available in the store, record a receipt, or make a traceable correction."><Button disabled={!businessId} onClick={() => setReceiving(true)}>Receive yarn</Button></PageHeader><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!businessId} onClick={() => setKind('YARN_ADJUSTMENT')}>Add / correct stock</Button><Button variant="outline" disabled={!businessId} onClick={() => setKind('YARN_RETURN')}>Return unused yarn</Button><Link className="self-center px-2 text-sm text-brand hover:underline" to="/knitting">Yarn with knitters →</Link></div><p className="text-xs leading-relaxed text-soft">Use Add / correct stock to record a counted opening or adjustment with a reason. Issuing yarn moves it out of store stock and into the selected knitter’s balance.</p><div className="flex flex-wrap gap-2"><Button variant={tab === 'stock' ? 'primary' : 'outline'} onClick={() => setTab('stock')}>Available in store</Button><Button variant={tab === 'history' ? 'primary' : 'outline'} onClick={() => setTab('history')}>Movement history</Button></div><FormFeedback error={error} success={null} /><Card><div className="p-4"><Input label="Find yarn" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, count or movement note" /></div>{query.isError && <QueryError onRetry={() => query.refetch()} />}<ScrollableTable><table className="min-w-[600px] w-full text-left text-xs"><thead className="border-y border-line bg-subtle text-soft"><tr><th className="p-3">Yarn / item</th><th className="p-3">{tab === 'stock' ? 'Unit / ownership' : 'Date / reason'}</th><th className="p-3 text-right">Packages</th><th className="p-3 text-right">Actual kg</th>{tab === "history" && <th className="p-3">Correction</th>}</tr></thead><tbody className="divide-y divide-line">{query.isLoading ? <LoadingState isTableRow colSpan={4} /> : query.data?.items.map(item => <tr key={item._id}><td className="p-3 font-medium text-strong">{tab === 'stock' ? item.yarnSpec : item.item}</td><td className="p-3 text-soft">{tab === 'stock' ? `${item.packageUnit} · ${item.ownerKey === 'OWN' ? 'Rozain Textile' : 'Client-owned'}` : `${new Date(item.date).toLocaleDateString()} · ${item.reason}`}</td><td className="p-3 text-right font-mono text-ink">{item.quantity}</td><td className="p-3 text-right font-mono text-strong">{item.totalWeightKg !== undefined ? item.totalWeightKg.toFixed(3) : item.weightKg.toFixed(3)}</td>{tab === 'history' && <td className="p-3"><Button size="sm" variant="ghost" onClick={async () => { const reason = await requestReason('Why is this source movement being reversed?');if (!reason?.trim()) return;setError(null);try { await api.post('/workspace/yarn-movements/' + item.sourceId + '/reverse', { reason, requestId: crypto.randomUUID() });await client.invalidateQueries(); } catch (failure) { setError((failure as { response?: { data?: { error?: string } } }).response?.data?.error || 'This source has already been reversed or used. Reverse later movements first.'); } }}>Reverse source</Button></td>}</tr>)}{!query.isLoading && !query.data?.total && <tr><td colSpan={4} className="p-10 text-center text-soft">No yarn records yet. Receive yarn or add an opening count above.</td></tr>}</tbody></table></ScrollableTable><PaginationControls page={page} totalPages={query.data?.totalPages || 1} total={query.data?.total || 0} limit={limit} onPageChange={setPage} onLimitChange={setLimit} /></Card>{receiving && <IssueYarnModal isOpen initialType="INWARD_FROM_CLIENT" onClose={() => setReceiving(false)} onSuccess={() => { void query.refetch(); }} />}{kind && <OperationForm kind={kind} onClose={() => setKind(null)} onSaved={() => { setKind(null);void query.refetch(); }} />}</div>;
}
