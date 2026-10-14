import { AsyncLocalStorage } from 'node:async_hooks';
import { Types } from 'mongoose';

export interface BusinessContext { businessId: string; actorId: string; name: string; }
export const businessContext = new AsyncLocalStorage<BusinessContext>();
export function currentBusinessId() { return businessContext.getStore()?.businessId; }
export function businessObjectId() { const id = currentBusinessId(); return id ? new Types.ObjectId(id) : undefined; }
export function partyModelName() { return currentBusinessId() ? 'PartyAccount' : 'Party'; }
