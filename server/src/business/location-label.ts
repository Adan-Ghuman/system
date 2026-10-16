import { businessContext } from './context.js';

export function locationName(unit: { code: string; name: string }) {
  return unit.code === 'ZR_GODOWN' ? `${businessContext.getStore()?.name || 'Rozain Textile'} Godown` : unit.name;
}
