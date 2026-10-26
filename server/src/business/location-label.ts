import { businessContext } from './context.js';

export function locationName(unit: { code: string; name: string }) {
  const business = businessContext.getStore();
  return unit.code === 'ZR_GODOWN' ? business && !business.usesExistingRecords ? `${business.name} Godown` : 'Rozain Textile' : unit.name;
}
