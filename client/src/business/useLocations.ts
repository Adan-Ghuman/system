import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useBusinessStore } from './store.js';

export function useLocations(fallback: Array<{ label: string; value: string }>) {
  const businessId = useBusinessStore(state => state.id);
  const query = useQuery({ queryKey: ['business-locations'], queryFn: async () => (await api.get<{ data: Array<{ label: string; value: string }> }>('/workspace/locations')).data.data, enabled: Boolean(businessId) });
  return businessId ? query.data || [{ value: 'ZR_GODOWN', label: 'Main store' }] : fallback;
}
