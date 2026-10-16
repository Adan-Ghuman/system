import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useBusinessStore } from './store.js';
import { DEFAULT_LOCATIONS } from './locations.js';

export function useLocations(fallback: Array<{ label: string; value: string }> = DEFAULT_LOCATIONS) {
  const businessId = useBusinessStore(state => state.id);
  const query = useQuery({ queryKey: ['business-locations'], queryFn: async () => (await api.get<{ data: Array<{ label: string; value: string }> }>('/workspace/locations')).data.data, enabled: Boolean(businessId) });
  return businessId ? query.data || DEFAULT_LOCATIONS : fallback.map(item => item.value === 'ZR_GODOWN' ? DEFAULT_LOCATIONS[0] : item);
}
