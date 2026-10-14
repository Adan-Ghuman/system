import { BillAllocation } from './commerce.models.js';
import { weight } from './posting.js';

interface Source { _id: unknown; label: string; items: Array<Record<string, unknown> & { sourceLineId: string }>; }
export async function billableSources<T extends Source>(sources: T[], direction: string) {
  const allocations = await BillAllocation.find({ sourceId: { $in: sources.map(source => source._id) }, direction });
  return sources.map(source => {
    let partial = false;
    const items = source.items.flatMap(item => {
      const used = allocations.filter(allocation => String(allocation.sourceId) === String(source._id) && allocation.sourceLineId === item.sourceLineId).reduce((sum, allocation) => sum + allocation.fraction, 0);
      const left = Math.max(0, 1 - used);if (left < 0.0000001) return [];
      if (used > 0) partial = true;
      return [{ ...item, weightKg: weight(Number(item.weightKg || 0) * left), rolls: Math.floor(Number(item.rolls || 0) * left), unbilledFraction: left }];
    });
    return { ...source, items, disabled: items.length === 0, label: source.label + (items.length === 0 ? ' · Fully billed' : partial ? ' · Remaining unbilled quantity' : '') };
  });
}
