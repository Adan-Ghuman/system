import { AsyncLocalStorage } from 'node:async_hooks';
import { Types } from 'mongoose';

export interface BusinessContext { businessId: string; actorId: string; name: string; usesExistingRecords?: boolean; ownPartyIds?: string[]; }
export const businessContext = new AsyncLocalStorage<BusinessContext>();
export function currentBusinessId() { return businessContext.getStore()?.businessId; }
export function businessObjectId() { const id = currentBusinessId(); return id ? new Types.ObjectId(id) : undefined; }
export function usesExistingRecords() { return businessContext.getStore()?.usesExistingRecords === true; }
export function businessRecordFilter() { const businessId = businessObjectId();return usesExistingRecords() ? { $or: [{ businessId }, { businessId: null }] } : { businessId }; }
export function partyModelName() { return usesExistingRecords() ? 'RozainPartyAccount' : currentBusinessId() ? 'PartyAccount' : 'Party'; }
