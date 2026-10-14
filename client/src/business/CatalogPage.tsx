import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { useQueryPagination } from '../hooks/useQueryPagination.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Card } from '../components/ui/Card.js';
import { Dialog } from '../components/ui/Dialog.js';
import { PaginationControls } from '../components/ui/Pagination.js';
import { QueryError } from '../components/ui/QueryError.js';
import { LoadingState } from '../components/ui/LoadingState.js';
import { FormFeedback } from '../components/ui/WorkflowForm.js';
import { CatalogOption } from '../components/ui/CatalogField.js';
import { PaginatedData } from '../lib/requestPolicy.js';
import { useBusinessStore } from './store.js';

export function CatalogPage() {
  const businessId = useBusinessStore(state => state.id);const client = useQueryClient();
  const [archived, setArchived] = useState(false);const [kind, setKind] = useState('COLOR');const [search, setSearch] = useState('');const debounced = useDebounce(search, 300);
  const [adding, setAdding] = useState(false);const [name, setName] = useState('');const [code, setCode] = useState('');const [saving, setSaving] = useState(false);const [error, setError] = useState<string | null>(null);
  const { page, limit, setPage, setLimit } = useQueryPagination([kind, debounced, archived]);
  const query = useQuery({ queryKey: ['catalog-list', kind, debounced, archived, page, limit], queryFn: async () => (await api.get<{ data: PaginatedData<CatalogOption> }>('/catalog/' + kind, { params: { search: debounced, page, limit, archived } })).data.data, enabled: Boolean(businessId) });
  async function save() {
    if (!name.trim()) return;setSaving(true);setError(null);
    try { await api.post('/catalog/' + kind, { name, code });await client.invalidateQueries({ queryKey: ['catalog-list', kind] });await client.invalidateQueries({ queryKey: ['catalog-options', kind] });await client.invalidateQueries({ queryKey: ['yarn-specs'] });setAdding(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save this name.'); }
    finally { setSaving(false); }
  }
  async function archive(option: CatalogOption) {
    setError(null);try { await api.patch(`/catalog/${kind}/${option._id}`, { isActive: option.isActive === false });await client.invalidateQueries({ queryKey: ['catalog-list', kind] });await client.invalidateQueries({ queryKey: ['catalog-options', kind] }); }
    catch { setError('The name could not be archived. Try again.'); }
  }
  return <div className="space-y-6"><PageHeader title={kind === 'COLOR' ? 'Color program' : 'Fabric & yarn names'} description="Keep reusable names in one place. You can also add them while entering a transaction."><Button disabled={!businessId} onClick={() => { setName('');setCode('');setError(null);setAdding(true); }}>Add {kind === 'COLOR' ? 'color / shade' : kind === 'FABRIC' ? 'fabric' : 'yarn'}</Button></PageHeader><Card className="space-y-4 p-4"><div className="grid gap-4 sm:grid-cols-2"><Select label="List" value={kind} onChange={event => setKind(event.target.value)} options={[{ value: 'COLOR', label: 'Color program · colors & shades' }, { value: 'FABRIC', label: 'Fabric names' }, { value: 'YARN', label: 'Yarn names / counts' }]} /><Input label="Find a name" value={search} onChange={event => setSearch(event.target.value)} placeholder="e.g. Navy blue" /></div><label className="flex items-center gap-2 text-xs text-ink"><input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)} />Include archived names</label><FormFeedback error={error} success={null} />{query.isError && <QueryError onRetry={() => query.refetch()} />}{query.isLoading ? <LoadingState /> : <div className="divide-y divide-line">{query.data?.items.map(option => <div key={option._id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-medium text-strong">{option.name}</p>{option.code && <p className="text-xs text-soft">{option.code}</p>}</div><Button variant="ghost" size="sm" onClick={() => archive(option)}>{option.isActive === false ? 'Restore' : 'Archive'}</Button></div>)}{!query.data?.total && <p className="py-8 text-center text-sm text-soft">No names yet. Add the first one above or type it in a transaction.</p>}</div>}<PaginationControls page={page} totalPages={query.data?.totalPages || 1} total={query.data?.total || 0} limit={limit} onPageChange={setPage} onLimitChange={setLimit} /></Card><Dialog isOpen={adding} onClose={() => { if (!saving) setAdding(false); }} title="Add a reusable name" description="Use the name you recognize on your challans." footer={<Button form="catalog-create" type="submit" isLoading={saving}>Save name</Button>}><form id="catalog-create" className="space-y-4" onSubmit={event => { event.preventDefault();void save(); }}><FormFeedback error={error} success={null} /><Input label="Name" required value={name} onChange={event => setName(event.target.value)} placeholder={kind === 'COLOR' ? 'e.g. Navy blue' : kind === 'FABRIC' ? 'e.g. Interlock' : 'e.g. 75/72'} />{kind === 'COLOR' && <Input label="Shade code (optional)" value={code} onChange={event => setCode(event.target.value)} placeholder="e.g. 1234" />}</form></Dialog></div>;
}
