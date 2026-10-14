import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useBusinessStore } from './store.js';
import { Select } from '../components/ui/Select.js';

export interface BusinessItem { _id: string; name: string; code: string; }
export function BusinessPicker() {
  const navigate = useNavigate();const location = useLocation();
  const { id, setBusiness } = useBusinessStore();
  const { data = [], isError, refetch } = useQuery({ queryKey: ['businesses'], queryFn: async () => (await api.get<{ data: BusinessItem[] }>('/businesses')).data.data });
  return <div className="w-40 sm:w-52"><Select aria-label="Active business" value={id} onChange={event => {
    if (document.querySelector('[data-erp-dialog] form') && !window.confirm('Switch business and discard this unsaved form?')) return;
    const path = location.pathname.replace(/^\/b\/[^/]+/, '') || '/';
    setBusiness(event.target.value);navigate((event.target.value ? '/b/' + event.target.value : '') + path);
  }} options={data.map(item => ({ value: item._id, label: item.name }))} />{isError && <button className="text-xs text-danger" onClick={() => refetch()}>Retry company list</button>}</div>;
}
