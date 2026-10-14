import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { fetchAllPages, PaginatedData } from '../lib/requestPolicy.js';
import { useQueryPagination } from '../hooks/useQueryPagination.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { Dialog } from '../components/ui/Dialog.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { ScrollableTable } from '../components/ui/ScrollableTable.js';
import { PaginationControls } from '../components/ui/Pagination.js';
import { QueryError } from '../components/ui/QueryError.js';
import { FormFeedback } from '../components/ui/WorkflowForm.js';
import { saveBlob } from '../lib/fileDownload.js';
import { useBusinessStore } from './store.js';
import { BusinessItem } from './BusinessPicker.js';

interface Row { _id: string; date: string; number: string; source: string; fabricType: string; yarnSpec: string; color: string; rolls: number; weightKg: number; poNo?: string; externalReference?: string; }
export function RegisterModal({ onClose, defaultType = 'OGP' }: { onClose: () => void; defaultType?: 'IGP' | 'OGP' }) {
  const businessId = useBusinessStore(state => state.id);const [type, setType] = useState(defaultType);const [from, setFrom] = useState('');const [to, setTo] = useState('');const [search, setSearch] = useState('');const debounced = useDebounce(search, 300);const { page, limit, setPage, setLimit } = useQueryPagination([type, from, to, debounced]);const [printRows, setPrintRows] = useState<Row[] | null>(null);const [working, setWorking] = useState('');const [error, setError] = useState<string | null>(null);
  const params = { type, from: from || undefined, to: to || undefined, search: debounced };
  const businesses = useQuery({ queryKey: ['businesses'], queryFn: async () => (await api.get<{ data: BusinessItem[] }>('/businesses')).data.data });
  const company = businesses.data?.find(item => item._id === businessId)?.name || '';
  const query = useQuery({ queryKey: ['register', type, from, to, debounced, page, limit], queryFn: async () => (await api.get<{ data: PaginatedData<Row> }>('/workspace/register', { params: { ...params, page, limit } })).data.data });
  async function download(format: string) { setWorking(format);setError(null);try { if (format === 'pdf') { const rows = await fetchAllPages<Row>(async pagination => (await api.get<{ data: PaginatedData<Row> }>('/workspace/register', { params: { ...params, ...pagination } })).data.data);setPrintRows(rows.items); } else { const response = await api.get('/workspace/register', { params: { ...params, format }, responseType: 'blob' });saveBlob(response.data, `${company} ${type} register.${format}`); } } catch { setError('Could not generate this register. Try again.'); } finally { setWorking(''); } }
  function table(rows: Row[]) { return <table className="w-full min-w-[700px] text-left text-xs"><thead><tr className="border-b border-line"><th className="p-2">Date / pass</th><th className="p-2">Movement</th><th className="p-2">Fabric / yarn / shade</th><th className="p-2 text-right">Rolls / packages</th><th className="p-2 text-right">Kg</th><th className="p-2">PO / reference</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row._id + index} className="border-b border-line"><td className="p-2">{new Date(row.date).toLocaleDateString()}<p>{row.number}</p></td><td className="p-2">{row.source}</td><td className="p-2">{row.fabricType} · {row.yarnSpec} · {row.color}</td><td className="p-2 text-right">{row.rolls}</td><td className="p-2 text-right">{row.weightKg.toFixed(3)}</td><td className="p-2">{row.poNo || '—'} / {row.externalReference || '—'}</td></tr>)}</tbody></table>; }
  return <Dialog isOpen onClose={onClose} title="Gate pass register" description="Inward means received by this business; outward means sent out. Only posted source documents are included." className="max-w-5xl" footer={<><Button variant="outline" disabled={Boolean(working)} onClick={() => download('csv')}>CSV</Button><Button variant="outline" disabled={Boolean(working)} onClick={() => download('xlsx')}>Excel</Button><Button isLoading={working === 'pdf'} disabled={Boolean(working)} onClick={() => download('pdf')}>Prepare PDF</Button></>}><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Select label="Direction" value={type} onChange={event => { setType(event.target.value as typeof type);setPrintRows(null); }} options={[{ value: 'IGP', label: 'Inward · received' }, { value: 'OGP', label: 'Outward · sent' }]} /><Input label="From date" type="date" value={from} onChange={event => setFrom(event.target.value)} /><Input label="To date" type="date" value={to} onChange={event => setTo(event.target.value)} /><Input label="Find a reference or item" value={search} onChange={event => setSearch(event.target.value)} placeholder="e.g. 0033/26" /></div><FormFeedback error={error} success={null} />{query.isError && <QueryError onRetry={() => query.refetch()} />}<ScrollableTable>{table(query.data?.items || [])}</ScrollableTable><PaginationControls page={page} totalPages={query.data?.totalPages || 1} total={query.data?.total || 0} limit={limit} onPageChange={setPage} onLimitChange={setLimit} />{printRows && <div className="space-y-3"><Button onClick={() => window.print()}>Print all {printRows.length} matching rows / Save PDF</Button><div id="print-area" className="overflow-auto bg-white p-5 text-slate-950"><h1 className="text-xl font-semibold">{company} · {type} register</h1><p className="my-3 text-xs">{from || 'All dates'} to {to || 'Present'}</p>{table(printRows)}</div></div>}</div></Dialog>;
}
