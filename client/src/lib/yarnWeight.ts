export interface YarnWeightEntry { boxCount: string; netWeightPerBox: string; totalWeightKg: string; weightMode: 'TOTAL' | 'PER_PACKAGE'; }
export function yarnLineWeight(item: YarnWeightEntry) { return item.weightMode === 'TOTAL' ? Number(item.totalWeightKg) || 0 : (Number(item.boxCount) || 0) * (Number(item.netWeightPerBox) || 0); }
