import { saveBlob } from '../lib/fileDownload.js';
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useBusinessStore } from './store.js';
import { useAuthStore } from '../features/auth/stores/useAuthStore.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { useQueryPagination } from '../hooks/useQueryPagination.js';
import { PaginatedData } from '../lib/requestPolicy.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Card } from '../components/ui/Card.js';
import { ScrollableTable } from '../components/ui/ScrollableTable.js';
import { PaginationControls } from '../components/ui/Pagination.js';
import { QueryError } from '../components/ui/QueryError.js';
import { FormFeedback } from '../components/ui/WorkflowForm.js';
import { formatCurrency, formatDate } from '../lib/formatters.js';
import { requestStockReversal } from '../components/ui/ReasonDialog.js';
import { SaleEntryCache, SaleMode, SaleResult, SaleRow } from './sales.types.js';
import { SalesForm } from './SalesForm.js';
import { OperationDocument } from './types.js';
import { DocumentPreview } from './DocumentPreview.js';
import { PaymentForm } from './PaymentForm.js';
import { ReturnForm } from './ReturnForm.js';
import { VoucherPreview, PrintableVoucher } from './VoucherPreview.js';
import { PrintDocumentModal } from '../features/export/components/PrintDocumentModal.js';
import { DispatchItem } from '../features/dispatch/types/dispatch.types.js';

const modeLabels: Record<string, string> = { FABRIC: 'Fabric sale', CUSTOMER_BILL: 'Customer bill', KNITTING_CHARGE: 'Knitting charge', DYEING_CHARGE: 'Dyeing charge', SALES_DRAFT: 'Customer draft', DELIVERY_DRAFT: 'Delivery draft', DELIVERY: 'Delivery awaiting bill' };
const errorText = (failure: unknown) => (failure as { response?: { data?: { error?: string } } }).response?.data?.error || 'Could not load the saved transaction. Please retry.';
export function SalesPage() {
  const businessId = useBusinessStore(state => state.id);const user = useAuthStore(state => state.user);const client = useQueryClient();
  const [params, setParams] = useSearchParams();const cacheKey = `sales-entry:${user?.id}:${businessId}`;
  const [entry, setEntry] = useState<{ key: string; draft?: OperationDocument; initial?: SaleEntryCache } | null>(null);
  const [recovery, setRecovery] = useState<SaleEntryCache | null>(null);const [result, setResult] = useState<SaleResult | null>(null);
  const [from, setFrom] = useState('');const [to, setTo] = useState('');const [search, setSearch] = useState('');const [status, setStatus] = useState('ALL');const debounced = useDebounce(search, 300);
  const { page, limit, setPage, setLimit } = useQueryPagination([debounced, status, from, to]);
  const [error, setError] = useState<string | null>(null);const [notice, setNotice] = useState<string | null>(null);const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState<OperationDocument | null>(null);const [paying, setPaying] = useState<OperationDocument | null>(null);const [returning, setReturning] = useState<OperationDocument | null>(null);const [voucher, setVoucher] = useState<PrintableVoucher | null>(null);const [gatePass, setGatePass] = useState<DispatchItem | null>(null);
  const canWrite = user?.role === 'admin' || user?.permissions.includes('accounts:write');
  const query = useQuery({ queryKey: ['sales-register', businessId, debounced, status, from, to, page, limit], queryFn: async () => (await api.get<{ data: PaginatedData<SaleRow> }>('/workspace/sales', { params: { page, limit, search: debounced || undefined, status, from: from || undefined, to: to || undefined } })).data.data, enabled: Boolean(businessId) });
  useEffect(() => { try { const saved = sessionStorage.getItem(cacheKey);setRecovery(saved ? JSON.parse(saved) : null); } catch { setRecovery(null); } }, [cacheKey, entry]);
  useEffect(() => {
    if (params.get('new') !== '1') return;
    const requested = params.get('mode');const mode: SaleMode = requested === 'KNITTING_CHARGE' || requested === 'DYEING_CHARGE' || requested === 'EXISTING_DELIVERY' ? requested : 'FABRIC';
    setEntry({ key: crypto.randomUUID(), initial: { body: { mode, customerId: params.get('customerId') || '', sourceId: params.get('sourceId') || '' } as SaleEntryCache['body'] } });setParams({}, { replace: true });
  }, [params, setParams]);
  function start() {
    setResult(null);setError(null);setNotice(null);
    if (recovery?.pending) { setEntry({ key: crypto.randomUUID(), initial: recovery });return; }
    setEntry({ key: crypto.randomUUID() });
  }
  async function document(id: string) { return (await api.get<{ data: OperationDocument }>('/workspace/documents/' + id)).data.data; }
  async function open(row: SaleRow, action: 'VIEW' | 'PAY' | 'DRAFT' | 'BILL' | 'OGP' | 'RETURN' | 'REVERSE', id?: string) {
    setBusy(row._id);setError(null);
    try {
      if (action === 'OGP') { const saved = (await api.get<{ data: { dispatch: DispatchItem; invoice: DispatchItem['invoice'] } }>('/dispatch/' + row.deliveryId)).data.data;setGatePass({ ...saved.dispatch, invoice: saved.invoice });return; }
      if (action === 'BILL') { setEntry({ key: crypto.randomUUID(), initial: { body: { customerId: row.customer?._id || '', mode: 'EXISTING_DELIVERY', sourceId: row.deliveryId } as SaleEntryCache['body'] } });return; }
      const target = id || row.documents.find(d => d.status === 'POSTED')?._id || row.documents[0]?._id || row._id;
      const bill = await document(target);
      if (action === 'DRAFT') setEntry({ key: crypto.randomUUID(), draft: bill });
      else if (action === 'PAY') setPaying(bill);
      else if (action === 'RETURN') setReturning(bill);
      else if (action === 'REVERSE') {
        const reversal = await requestStockReversal(`Why is ${bill.number} being reversed? Recorded payments and credits must be reconciled first.`);
        if (reversal?.reason) { await api.post('/workspace/documents/' + bill._id + '/reverse', { ...reversal, requestId: crypto.randomUUID() });await client.invalidateQueries(); }
      } else setPreview(bill);
    } catch (failure) { setError(errorText(failure)); } finally { setBusy(''); }
  }
  async function printReceipt(bill: OperationDocument) {
    setBusy(bill._id);setError(null);
    try { const rows = (await api.get<{ data: Array<{ status: string; voucherId?: PrintableVoucher }> }>('/workspace/documents/' + bill._id + '/payments')).data.data;const found = rows.find(r => r.status === 'POSTED' && r.voucherId);if (found?.voucherId) setVoucher({ ...found.voucherId, partyId: bill.partyId });else setNotice('No receipt has been recorded against this bill.'); }
    catch (failure) { setError(errorText(failure)); } finally { setBusy(''); }
  }
  async function download(format: 'csv' | 'xlsx') { setBusy(format);setError(null);try { const response = await api.get('/workspace/sales', { params: { search: search || undefined, status, from: from || undefined, to: to || undefined, format }, responseType: 'blob' });saveBlob(response.data, 'Sales.' + format); } catch (failure) { setError(errorText(failure)); } finally { setBusy(''); } }
  return <div className="space-y-6"><PageHeader title="Sales & billing" description="Create customer sales and service bills, receive payments, and print the linked documents here."><Button variant="outline" disabled={Boolean(busy)} onClick={() => void download('csv')}>CSV</Button><Button variant="outline" disabled={Boolean(busy)} onClick={() => void download('xlsx')}>Excel</Button><Button variant="outline" onClick={() => query.refetch()}>Refresh</Button>{canWrite && <Button disabled={Boolean(entry)} onClick={start}>New sale / charge</Button>}</PageHeader><FormFeedback error={error} success={notice} />
    {!entry && recovery && <Card className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-sm text-soft">{recovery.pending ? 'A submitted transaction is awaiting confirmation. Recover it before starting another.' : 'An unfinished customer entry is saved in this tab.'}</p><Button variant="outline" onClick={() => { setResult(null);setEntry({ key: crypto.randomUUID(), initial: recovery }); }}>{recovery.pending ? 'Recover submitted transaction' : 'Resume unfinished entry'}</Button></Card>}
    {entry && <SalesForm key={entry.key} draft={entry.draft} initial={entry.initial} cacheKey={cacheKey} onClose={() => setEntry(null)} onDraftSaved={() => { setEntry(null);setRecovery(null);setNotice('Draft saved. Continue it from the customer register.'); }} onSaved={saved => { setEntry(null);setRecovery(null);setResult(saved);setNotice('Transaction saved. Its documents and balances are linked.'); }} />}
    {result && <Card role="region" className="space-y-4 p-5" aria-label="Saved transaction"><h2 className="text-lg font-semibold text-strong">{result.bill?.number || 'Delivery saved'}</h2><p className="text-sm text-soft">{result.bill?.partyId?.name} · {result.bill?.reference}</p><div className="grid gap-3 sm:grid-cols-3"><p>Bill total <strong className="block font-mono">{formatCurrency(result.total)}</strong></p><p>Received / linked <strong className="block font-mono">{result.outstanding === null ? 'Not recorded' : formatCurrency(result.received)}</strong></p><p>Remaining bill balance <strong className="block font-mono">{result.outstanding === null ? 'Not recorded' : formatCurrency(result.outstanding)}</strong></p></div><div className="flex flex-wrap gap-2">{result.bill && <Button variant="outline" onClick={() => setPreview(result.bill)}>Print bill</Button>}{result.deliveryId && <Button variant="outline" onClick={() => void open({ _id: result.deliveryId!, deliveryId: result.deliveryId, documents: [] } as unknown as SaleRow, 'OGP')}>Print gate pass</Button>}{result.bill && result.received > 0 && <Button variant="outline" onClick={() => void printReceipt(result.bill!)}>Print receipt</Button>}{result.bill && result.outstanding !== null && <Button variant="outline" onClick={() => setPaying(result.bill)}>{result.outstanding > 0 ? 'Record later payment' : 'View receipts'}</Button>}<Button onClick={start}>Start another entry</Button></div></Card>}
    <Card><div className="grid gap-4 p-4 sm:grid-cols-2"><Input label="From date" type="date" value={from} onChange={e => setFrom(e.target.value)} /><Input label="To date" type="date" value={to} onChange={e => setTo(e.target.value)} /><Input label="Find a customer transaction" value={search} onChange={e => setSearch(e.target.value)} placeholder="Customer, paper bill, invoice or gate pass" /><Select label="Transaction status" value={status} onChange={e => setStatus(e.target.value)} options={[{ value: 'ALL', label: 'All customer transactions' }, { value: 'DRAFT', label: 'Drafts' }, { value: 'TO_BILL', label: 'Deliveries to bill' }, { value: 'UNPAID', label: 'Unpaid / part paid' }, { value: 'PAID', label: 'Paid' }, { value: 'UNKNOWN', label: 'Payment history not recorded' }, { value: 'REVERSED', label: 'Reversed' }]} /></div>{query.isError ? <QueryError onRetry={() => query.refetch()} /> : <><ScrollableTable><table className="min-w-[820px] w-full text-left text-xs"><thead className="border-y border-line bg-subtle text-soft"><tr>{['Customer / date', 'Transaction', 'Bill total', 'Paid / linked', 'Balance', 'Actions'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-line">{query.isLoading ? <tr><td colSpan={6} className="p-6 text-soft">Loading customer transactions…</td></tr> : query.data?.items.map(row => <tr key={row._id}><td className="px-4 py-4"><strong>{row.customer?.name || 'Customer not recorded'}</strong><p className="mt-1 text-soft">{formatDate(row.date)}</p></td><td className="px-4 py-4"><strong>{row.number}</strong><p>{modeLabels[row.kind] || row.kind}</p><p className="text-soft">{row.reference || row.deliveryNo || '—'} · {row.status === 'TO_BILL' ? 'Awaiting bill' : row.status}</p>{row.deliveryNo && <p>Gate pass {row.deliveryNo}</p>}</td><td className="px-4 py-4 font-mono">{row.status === 'DRAFT' ? 'Draft' : formatCurrency(row.total)}</td><td className="px-4 py-4 font-mono">{row.unknown ? 'Not recorded' : formatCurrency(row.paid || 0)}</td><td className="px-4 py-4 font-mono">{row.unknown ? 'Not recorded' : row.status === 'TO_BILL' ? 'Not billed' : formatCurrency(row.outstanding || 0)}</td><td className="px-4 py-4"><div className="flex max-w-xs flex-wrap gap-2">{row.status === 'DRAFT' ? <Button size="sm" variant="outline" disabled={!canWrite || Boolean(busy)} onClick={() => void open(row, 'DRAFT')}>Continue draft</Button> : <>{row.documents.map(doc => <Button size="sm" variant="outline" key={doc._id} disabled={Boolean(busy)} onClick={() => void open(row, 'VIEW', doc._id)}>View / print{row.documents.length > 1 ? ' ' + doc.number : ''}</Button>)}{row.deliveryId && <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void open(row, 'OGP')}>Gate pass</Button>}{row.deliveryId && row.canBill && <Button size="sm" variant="outline" disabled={!canWrite || Boolean(busy)} onClick={() => void open(row, 'BILL')}>Bill remaining delivery</Button>}{row.status === 'POSTED' && !row.unknown && row.documents.filter(d => d.status === 'POSTED').map(doc => <div className="flex flex-wrap gap-2" key={'actions-' + doc._id}><Button size="sm" variant="outline" disabled={!canWrite || Boolean(busy)} onClick={() => void open(row, 'PAY', doc._id)}>{(row.outstanding || 0) > 0 ? 'Record receipt' : 'Receipts'}{row.documents.length > 1 ? ' · ' + doc.number : ''}</Button><Button size="sm" variant="ghost" disabled={!canWrite || Boolean(busy)} onClick={() => void open(row, 'RETURN', doc._id)}>Return / credit{row.documents.length > 1 ? ' · ' + doc.number : ''}</Button><Button size="sm" variant="ghost" disabled={!canWrite || Boolean(busy)} onClick={() => void open(row, 'REVERSE', doc._id)}>Reverse bill{row.documents.length > 1 ? ' · ' + doc.number : ''}</Button></div>)}</>}</div></td></tr>)}{!query.isLoading && !query.data?.total && <tr><td colSpan={6} className="p-8 text-center text-soft">No matching customer transactions. Start a new sale or service charge above.</td></tr>}</tbody></table></ScrollableTable><PaginationControls page={page} totalPages={query.data?.totalPages || 1} total={query.data?.total || 0} limit={limit} onPageChange={setPage} onLimitChange={setLimit} /></>}</Card><p className="text-xs text-soft">Supplier invoices and processing costs are in <Link className="text-brand underline" to="/bills">Supplier bills & charges</Link>. Full customer statements remain in <Link className="text-brand underline" to="/accounts">Accounts & ledgers</Link>.</p>
    {preview && <DocumentPreview document={preview} onClose={() => setPreview(null)} />}{paying && <PaymentForm document={paying} onClose={() => { setPaying(null);setResult(null); }} />}{returning && <ReturnForm document={returning} onClose={() => { setReturning(null);setResult(null); }} />}{voucher && <VoucherPreview voucher={voucher} onClose={() => setVoucher(null)} />}{gatePass && <PrintDocumentModal isOpen onClose={() => setGatePass(null)} type="OGP" dispatch={gatePass} />}
  </div>;
}
