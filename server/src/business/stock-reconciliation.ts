import { ClientSession, Types } from 'mongoose';
import { businessContext, currentShortageReason, postingContext } from './context.js';
import { Reconciliation } from './reconciliation.models.js';
import { YarnInventory, StockMovement } from './records.js';
import { weight } from './posting.js';
import { BadRequestError } from '../utils/errors.js';

interface Balance {
  quantity: number;
  weightKg: number;
}

interface StockChange {
  kind: 'FABRIC' | 'YARN';
  item: string;
  fabricType?: string;
  yarnSpec: string;
  ownerKey: string;
  location: string;
  packageUnit?: string;
  state?: string;
  color?: string;
  partyId?: Types.ObjectId;
  sourceId: Types.ObjectId;
  sourceKind?: string;
  date: Date;
  reason: string;
}

const negative = (balance: Balance) => balance.quantity < 0 || balance.weightKg < 0;
export const mismatchedFabric = (balance: Balance) => (balance.quantity === 0) !== (balance.weightKg === 0);

export function needsShortageReason(before: Balance, after: Balance, checkFabric = false) {
  const worsensShortage = Math.min(after.quantity, 0) < Math.min(before.quantity, 0)
    || Math.min(after.weightKg, 0) < Math.min(before.weightKg, 0);
  return worsensShortage || (checkFabric && !negative(after) && mismatchedFabric(after) && !mismatchedFabric(before));
}

export async function recordStockChange(change: StockChange, stockId: Types.ObjectId, delta: Balance, balance: Balance, session: ClientSession) {
  const actorId = businessContext.getStore()!.actorId;
  const reason = currentShortageReason();
  await StockMovement.create([{ ...change, ...delta, material: change.kind, actorId }], { session });
  const key = change.kind + ':' + stockId;
  const existing = await Reconciliation.findOne({ key, open: true }).session(session);
  const open = negative(balance) || (change.kind === 'FABRIC' && mismatchedFabric(balance));
  if (!open && !existing) return;
  const posting = postingContext.getStore();
  const source = { reference: posting?.reference, sourceKind: posting?.kind };
  const event = { ...source, sourceId: change.sourceId, date: change.date, recordedAt: new Date(), reason: reason || change.reason, actorId, ...balance };
  if (existing) {
    existing.set({ ...balance, open });
    existing.events.push(event);
    await existing.save({ session });
  } else {
    await Reconciliation.create([{ ...change, ...balance, ...source, key, reason: reason || change.reason, actorId, events: [event] }], { session });
  }
}

export async function moveYarn(change: Omit<StockChange, 'kind' | 'item' | 'location'> & { packageUnit: string }, delta: Balance, session: ClientSession, errorMessage: string) {
  if (!Number.isSafeInteger(delta.quantity) || !Number.isFinite(delta.weightKg) || Math.abs(delta.weightKg) > 1e9) throw new BadRequestError('Enter valid packages and measured kg.');
  const match = { yarnSpec: change.yarnSpec, ownerKey: change.ownerKey, packageUnit: change.packageUnit };
  const stock = await YarnInventory.findOne(match).session(session);
  const before = { quantity: stock?.quantity || 0, weightKg: stock?.totalWeightKg || 0 };
  const after = { quantity: before.quantity + delta.quantity, weightKg: weight(before.weightKg + delta.weightKg) };
  if (needsShortageReason(before, after) && !currentShortageReason()) throw new BadRequestError(errorMessage);
  const updated = await YarnInventory.findOneAndUpdate(stock ? { _id: stock._id } : match, { $set: { quantity: after.quantity, totalWeightKg: after.weightKg }, $setOnInsert: match }, { upsert: !stock, new: true, session });
  await recordStockChange({ ...change, kind: 'YARN', item: change.yarnSpec, location: 'ZR_GODOWN' }, updated!._id, delta, after, session);
}
