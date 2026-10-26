import { businessContext, usesExistingRecords } from './context.js';

export const ownPartyName = /^\s*roz(?:ain|in)\s+(?:text(?:ile|itle)(?:\s+godown)?|knitting)\s*$/i;

export function canonicalOwnerKey(value: string | null | undefined): string {
  if (!value || value === 'OWN') return 'OWN';
  return usesExistingRecords() && businessContext.getStore()?.ownPartyIds?.includes(String(value)) ? 'OWN' : value;
}

export function ownOwnerKeys() {
  return ['OWN', null, ...(businessContext.getStore()?.ownPartyIds || [])];
}
