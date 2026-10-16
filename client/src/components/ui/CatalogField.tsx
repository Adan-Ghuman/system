import { useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { loadAllRecords } from '../../lib/pagedResources.js';
import { Input } from './Input.js';
import { Button } from './Button.js';
import { useBusinessStore } from '../../business/store.js';

export interface CatalogOption { _id: string; name: string; code?: string; isActive: boolean; }
export function CatalogField({ kind, label, value, onChange, required = false, id, placeholder, suggestions = [] }: {
  kind: 'FABRIC' | 'COLOR' | 'YARN'; label: string; value: string; onChange: (value: string) => void; required?: boolean; id?: string; placeholder?: string; suggestions?: string[];
}) {
  const listId = useId();const client = useQueryClient();const businessId = useBusinessStore(state => state.id);
  const [other, setOther] = useState(false);const [saving, setSaving] = useState(false);const [error, setError] = useState('');
  const { data } = useQuery({ queryKey: ['catalog-options', kind], queryFn: () => loadAllRecords<CatalogOption>('/catalog/' + kind), enabled: Boolean(businessId), staleTime: 30000 });
  const names = [...new Set([...(data?.items.map(option => option.name) || []), ...suggestions])];
  const exists = names.some(name => name.toLowerCase() === value.trim().toLowerCase());
  async function saveChoice() {
    if (!value.trim() || exists || saving) return;setSaving(true);setError('');
    try { await api.post('/catalog/' + kind, { name: value.trim() });await client.invalidateQueries({ queryKey: ['catalog-options', kind] });await client.invalidateQueries({ queryKey: ['catalog-list', kind] });if (kind === 'YARN') await client.invalidateQueries({ queryKey: ['yarn-specs'] }); }
    catch { setError('Could not save this name. Your entry is still here.'); }
    finally { setSaving(false); }
  }
  return <div className="min-w-0 space-y-1.5"><Input id={id} label={label} list={listId} value={value} required={required} onBlur={() => { void saveChoice(); }} onChange={event => { if (event.target.value === "Other — add new name") { setOther(true);onChange(''); } else onChange(event.target.value); }} placeholder={placeholder || 'Choose or type a name'} /><datalist id={listId}>{names.map(name => <option key={name} value={name} />)}<option value="Other — add new name" /></datalist><Button type="button" variant="ghost" size="sm" className="text-brand" onClick={() => { setOther(true);onChange(''); }}>Other / add {kind === 'FABRIC' ? 'fabric' : kind === 'COLOR' ? 'shade' : 'yarn'}</Button>{other && <p className="text-xs text-soft">Type the new name above. It is saved for future entries.</p>}{value.trim() && !exists && businessId && <Button type="button" variant="ghost" size="sm" onClick={saveChoice} isLoading={saving} className="max-w-full text-brand">Save this {kind === 'COLOR' ? 'shade' : kind === 'FABRIC' ? 'fabric' : 'yarn'} name for reuse</Button>}{error && <p role="alert" className="text-xs text-danger">{error}</p>}</div>;
}
