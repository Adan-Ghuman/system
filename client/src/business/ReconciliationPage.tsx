import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { getLocalDateInput } from '../lib/formatters.js';
import { useAuthStore } from '../features/auth/stores/useAuthStore.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Dialog } from '../components/ui/Dialog.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { PaginationControls } from '../components/ui/Pagination.js';
import { FormFeedback } from '../components/ui/WorkflowForm.js';
import { useQueryPagination } from '../hooks/useQueryPagination.js';
import { useDebounce } from '../hooks/useDebounce.js';

const labels = { FABRIC: 'Fabric stock', YARN: 'Yarn stock', KNITTING: 'Knitting receipt', DYEING: 'Dyeing receipt', YARN_RETURN: 'Unused yarn return' };
type Kind = keyof typeof labels;

interface Entry {
  _id: string;
  kind: Kind;
  sourceId: string;
  reference?: string;
  sourceKind?: string;
  item: string;
  yarnSpec: string;
  location: string;
  processor?: string;
  ownerName?: string;
  ownerKey: string;
  packageUnit?: string;
  date: string;
  reason: string;
  quantity: number;
  weightKg: number;
  finishedQuantity?: number;
  finishedKg?: number;
  open: boolean;
  canWrite: boolean;
  events: Array<{ _id: string; sourceId: string; date: string; reference?: string; reason: string; quantity: number; weightKg: number }>;
}
interface Source { id: string; reference: string; quantity: number; weightKg: number; date: string; }
interface Closing { _id: string; date: string; reason: string; items: Array<{ entryId: string }>; }
interface Register { items: Entry[]; total: number; totalPages: number; }
const endpoint = '/workspace/reconciliation';
const errorText = (error: unknown) => (error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Could not complete the request. Please try again.';
const sourcePages: Record<string, string> = {
  DYEING_ISSUE: '/dyeing', CUSTOMER_SALE: '/dispatch', DELIVERY: '/dispatch', FABRIC_TRANSFER: '/inventory', YARN_DELIVERY: '/knitting'
};
const day = (date: string) => new Date(date).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' });
const stock = (entry: Entry) => entry.kind === 'FABRIC' || entry.kind === 'YARN';
const quantityName = (entry: Entry) => entry.packageUnit || (entry.kind === 'KNITTING' ? 'packages' : 'rolls');
function balance(entry: Entry) {
  if (entry.kind === 'DYEING' && entry.open) {
    const raw = entry.quantity || entry.weightKg ? entry.quantity + ' raw rolls / ' + entry.weightKg.toFixed(3) + ' kg' : 'Raw rolls and kg to confirm';
    return raw + ' · ' + entry.finishedQuantity + ' finished rolls / ' + (entry.finishedKg || 0).toFixed(3) + ' kg awaiting link';
  }
  return (entry.kind === 'KNITTING' ? '' : entry.quantity + ' ' + quantityName(entry) + ' / ') + entry.weightKg.toFixed(3) + ' kg';
}

export function ReconciliationPage() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  const client = useQueryClient();
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('');
  const [location, setLocation] = useState('');
  const [since, setSince] = useState('');
  const [expanded, setExpanded] = useState('');
  const [entry, setEntry] = useState<Entry | null>(null);
  const [closing, setClosing] = useState(false);
  const [success, setSuccess] = useState('');
  const debounced = useDebounce(search, 250);
  const { page, limit, setPage, setLimit } = useQueryPagination([kind, status, debounced, owner, location, since]);
  const params = { kind: kind || undefined, status, search: debounced || undefined, owner: owner || undefined, location: location || undefined, since: since || undefined, page, limit };
  const register = useQuery({ queryKey: ['reconciliation', params], queryFn: async () => (await api.get<{ data: Register }>(endpoint, { params })).data.data });
  const history = useQuery({ queryKey: ['reconciliation-closings'], enabled: admin,
    queryFn: async () => (await api.get<{ data: Closing[] }>(endpoint + '/closing')).data.data });
  async function saved(message: string) {
    setEntry(null);
    setClosing(false);
    setSuccess(message);
    await client.invalidateQueries();
  }

  return <div className="space-y-5">
    <PageHeader title="Reconciliation" description="Review negative stock, roll and weight differences, and receipts awaiting a production issue.">
      {admin && <Button onClick={() => setClosing(true)}>Record closing review</Button>}
    </PageHeader>
    <FormFeedback error={register.isError ? errorText(register.error) : null} success={success || null} />
    <Card className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select label="Section" value={kind} onChange={event => setKind(event.target.value)}
          options={[{ value: '', label: 'All sections' }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))]} />
        <Select label="Status" value={status} onChange={event => setStatus(event.target.value)}
          options={[{ value: 'OPEN', label: 'Open' }, { value: 'RESOLVED', label: 'Resolved' }, { value: 'ALL', label: 'All' }]} />
        <Input label="Search item or challan" value={search} onChange={event => setSearch(event.target.value)} />
        <Input label="Owner name" value={owner} onChange={event => setOwner(event.target.value)} />
        <Input label="Location or processor" value={location} onChange={event => setLocation(event.target.value)} />
        <Input label="Opened on or after" type="date" value={since} onChange={event => setSince(event.target.value)} />
      </div>
      {register.isLoading && <p>Loading reconciliation items…</p>}
      {register.data?.items.length === 0 && <p className="p-4 text-center text-soft">No reconciliation items match these filters.</p>}
      <div className="divide-y divide-line">
        {register.data?.items.map(row => <article key={row._id} className="space-y-2 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-medium text-strong">{row.item}</h2>
              <p className="text-sm text-soft">{labels[row.kind]} · {row.processor || row.location} · {row.ownerName || row.ownerKey}</p>
              {row.sourceKind && sourcePages[row.sourceKind] && <Link className="text-sm text-brand underline" to={sourcePages[row.sourceKind]}>Open source register</Link>}
              <p className="text-sm">{day(row.date)} · {row.reference || row.sourceId} · {row.reason}</p>
            </div>
            <div className="space-y-1">
              <p className={row.open ? 'font-semibold text-warning' : 'text-soft'}>{row.open ? balance(row) : 'Resolved'}</p>
              <div className="flex flex-wrap gap-2">
                {row.open && row.canWrite && <Button size="sm" onClick={() => setEntry(row)}>{stock(row) ? 'Post measured correction' : 'Link existing issue'}</Button>}
                {row.open && row.canWrite && stock(row) && <Link className="self-center text-sm text-brand underline" to={row.kind === 'YARN' ? '/transactions?action=SUPPLIER&mode=YARN&billNow=false' : '/transactions?action=SUPPLIER&mode=FABRIC&billNow=false'}>Record receipt</Link>}
                <Button size="sm" variant="outline" onClick={() => setExpanded(expanded === row._id ? '' : row._id)}>{expanded === row._id ? 'Hide history' : 'Show history'}</Button>
              </div>
            </div>
          </div>
          {expanded === row._id && <div className="rounded-lg bg-subtle p-3 text-sm">
            <p>Original entry {row.sourceId}</p>
            {row.events.map(event => <p key={event._id} className="mt-1">{day(event.date)} · {event.reason} · {event.quantity} / {event.weightKg.toFixed(3)} kg · {event.reference || event.sourceId}</p>)}
          </div>}
        </article>)}
      </div>
      <PaginationControls page={page} limit={limit} total={register.data?.total || 0} totalPages={register.data?.totalPages || 1} onPageChange={setPage} onLimitChange={setLimit} />
    </Card>
    {admin && Boolean(history.data?.length) && <Card className="space-y-2 p-4">
      <h2 className="font-semibold">Recent closing reviews</h2>
      {history.data?.map(record => <p key={record._id} className="text-sm">{record.date} · {record.items.length} carried forward · {record.reason}</p>)}
    </Card>}
    {entry && <ReconcileDialog entry={entry} onClose={() => setEntry(null)} onSaved={saved} />}
    {closing && <ClosingDialog onClose={() => setClosing(false)} onSaved={saved} />}
  </div>;
}

function ReconcileDialog({ entry, onClose, onSaved }: { entry: Entry; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const correction = stock(entry);
  const [sourceId, setSourceId] = useState('');
  const [quantity, setQuantity] = useState(entry.quantity < 0 ? String(-entry.quantity) : '0');
  const [kg, setKg] = useState(entry.weightKg < 0 ? String(-entry.weightKg) : '0');
  const [finishedQuantity, setFinishedQuantity] = useState(String(entry.finishedQuantity || ''));
  const [finishedKg, setFinishedKg] = useState(String(entry.finishedKg || ''));
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(getLocalDateInput());
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sources = useQuery({ queryKey: ['reconciliation-sources', entry._id], enabled: !correction,
    queryFn: async () => (await api.get<{ data: Source[] }>(endpoint + '/' + entry._id + '/sources')).data.data });

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { quantity: Number(quantity), weightKg: Number(kg), reason, requestId };
      await api.post(endpoint + '/' + entry._id + (correction ? '/correct' : '/link'), correction
        ? { ...body, expectedQuantity: entry.quantity, expectedKg: entry.weightKg, date: new Date(date + 'T00:00:00+05:00').toISOString() } : { ...body, sourceId, ...(entry.kind === 'DYEING' ? { finishedQuantity: Number(finishedQuantity), finishedKg: Number(finishedKg) } : {}) });
      await onSaved(correction ? 'Stock correction posted.' : 'Supporting issue linked.');
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  return <Dialog isOpen onClose={() => { if (!busy) onClose(); }} title={correction ? 'Post measured correction' : 'Link existing issue'}
    description={entry.item + ' · ' + balance(entry)} footer={<Button form="reconcile-item" type="submit" isLoading={busy}
      disabled={!correction && !sourceId}>Save</Button>}>
    <form id="reconcile-item" className="space-y-4" onSubmit={save}>
      <FormFeedback error={error || (sources.isError ? errorText(sources.error) : null)} success={null} />
      {!correction && <Select label="Supporting issue" value={sourceId} onChange={event => setSourceId(event.target.value)} required
        options={[{ value: '', label: sources.isFetching ? 'Loading issues…' : 'Choose an issue' },
          ...(sources.data || []).map(source => ({ value: source.id, label: source.reference + ' · ' + day(source.date) + ' · ' + source.weightKg.toFixed(3) + ' kg' }))]} />}
      {!correction && sources.data?.length === 0 && <p className="text-sm text-soft">Record the original issue in {entry.kind === 'DYEING' ? 'Dyeing' : 'Knitting'}, then return here to link it.</p>}
      {entry.kind !== 'KNITTING' && <Input label={quantityName(entry)} type="number" step="1" min={correction ? undefined : '0'} value={quantity}
        onChange={event => setQuantity(event.target.value)} required />}
      <Input label="Measured kg" type="number" step="0.001" min={correction ? undefined : '0'} value={kg}
        onChange={event => setKg(event.target.value)} required />
      {entry.kind === 'DYEING' && <div className="grid grid-cols-2 gap-3">
        <Input label="Finished rolls covered" type="number" min="1" step="1" value={finishedQuantity} onChange={event => setFinishedQuantity(event.target.value)} required />
        <Input label="Finished kg covered" type="number" min="0.001" step="0.001" value={finishedKg} onChange={event => setFinishedKg(event.target.value)} required />
      </div>}
      {correction && <Input label="Correction date" type="date" value={date} onChange={event => setDate(event.target.value)} required />}
      <Input label="Reason" value={reason} onChange={event => setReason(event.target.value)} required minLength={3} maxLength={500} />
    </form>
  </Dialog>;
}

function ClosingDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post(endpoint + '/closing', { requestId, reason: reason.trim() || undefined });
      await onSaved('Closing review recorded.');
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }
  return <Dialog isOpen onClose={() => { if (!busy) onClose(); }} title="Record closing review"
    description="Open items are carried forward with their current balances and your reason."
    footer={<Button type="submit" form="reconcile-close" isLoading={busy}>Record closing</Button>}>
    <form id="reconcile-close" className="space-y-3" onSubmit={save}>
      <FormFeedback error={error} success={null} />
      <Input label="Reason for carrying open items forward" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} />
    </form>
  </Dialog>;
}
