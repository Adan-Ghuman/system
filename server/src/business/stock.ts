import { escapeRegex } from '../utils/search.js';
import { rememberFabricNames } from './catalog-names.js';
import { ClientSession, Types } from 'mongoose';
import { FabricInventory } from '../models/FabricInventory.js';
import { DyeingUnit } from '../models/DyeingUnit.js';
import { needsShortageReason, recordStockChange } from './stock-reconciliation.js';
import { Party } from '../models/Party.js';
import { OperationItem } from './commerce.schema.js';
import { BadRequestError } from '../utils/errors.js';
import { currentShortageReason } from './context.js';
import { weight } from './posting.js';

export function validateRawShade(item: { state: string; color: string }) {
  if (item.state === 'RAW_ECRU' && item.color.trim().toUpperCase() !== 'ECRU') throw new BadRequestError('Undyed raw fabric must use ECRU as its current shade. Enter navy blue or another target shade when sending it for dyeing.');
}

export async function validateLocation(location: string, session?: ClientSession) {
  if (['ZR_GODOWN', 'IN_TRANSIT'].includes(location)) return;
  if (!await DyeingUnit.findOne({ code: location, isActive: true }).session(session || null)) throw new BadRequestError('Choose an active location in this business.');
}
export async function moveFabric(item: Pick<OperationItem, 'fabricType' | 'yarnSpec' | 'state' | 'color' | 'rolls' | 'weightKg' | 'ownerKey'> & { inventoryId?: string }, location: string, sign: 1 | -1, sourceId: unknown, date: Date, reason: string, session: ClientSession) {
  await rememberFabricNames([item], session);
  if (!item.fabricType || !item.yarnSpec || !item.color || item.rolls < 1 || item.weightKg <= 0) throw new BadRequestError('Each fabric needs its name, yarn count, shade, positive roll count and measured kg.');
  return changeFabricBalance(item, location, sign * item.rolls, sign * weight(item.weightKg), sourceId, date, reason, session, sign < 0);
}

export async function changeFabricBalance(
  item: Pick<OperationItem, 'fabricType' | 'yarnSpec' | 'state' | 'color' | 'ownerKey'> & { inventoryId?: string },
  location: string, quantity: number, kg: number, sourceId: unknown, date: Date, reason: string, session: ClientSession, checkRolls: boolean
) {
  const identity = { fabricType: item.fabricType, yarnSpec: item.yarnSpec, state: item.state, color: item.color.toUpperCase(), location, ownerKey: item.ownerKey || 'OWN' };
  if (!Number.isSafeInteger(quantity) || !Number.isFinite(kg) || Math.abs(kg) > 1e9) throw new BadRequestError('Enter a valid roll count and measured kg.');
  let stock = await FabricInventory.findOne({ ...identity, ...(item.inventoryId ? { _id: item.inventoryId } : {}) }).session(session);
  if (!stock && !item.inventoryId) {
    const matches = await FabricInventory.find({ ...identity,
      fabricType: new RegExp('^' + escapeRegex(identity.fabricType) + '$', 'i'),
      yarnSpec: new RegExp('^' + escapeRegex(identity.yarnSpec) + '$', 'i') }).limit(2).session(session);
    if (matches.length > 1) throw new BadRequestError('More than one stock item has this name. Select the exact stock row.');
    stock = matches[0] || null;
    if (stock) {
      identity.fabricType = stock.fabricType;
      identity.yarnSpec = stock.yarnSpec;
    }
  }
  if (item.inventoryId && !stock) throw new BadRequestError('The original stock item changed. Refresh stock and select it again.');
  if (identity.ownerKey !== 'OWN' && (!Types.ObjectId.isValid(identity.ownerKey) || !await Party.exists({ _id: identity.ownerKey }).session(session))) {
    throw new BadRequestError('Choose a fabric owner in this business.');
  }
  const before = { quantity: stock?.totalRolls || 0, weightKg: stock?.totalWeightKg || 0 };
  const after = { quantity: before.quantity + quantity, weightKg: weight(before.weightKg + kg) };
  if (needsShortageReason(before, after, checkRolls) && !currentShortageReason()) {
    if (after.quantity < 0 || after.weightKg < 0) throw new BadRequestError(`Not enough ${item.fabricType} / ${item.yarnSpec} at this location. Check rolls, measured kg, shade and ownership.`);
    throw new BadRequestError('The final roll count and measured kg do not reconcile. Correct the measurement or record the discrepancy before moving the final rolls.');
  }
  const updated = await FabricInventory.findOneAndUpdate(stock ? { _id: stock._id } : identity,
    { $set: { totalRolls: after.quantity, totalWeightKg: after.weightKg }, $setOnInsert: identity }, { upsert: !stock, new: true, session });
  await recordStockChange({ ...identity, kind: 'FABRIC', item: `${identity.fabricType} / ${identity.yarnSpec} / ${identity.color}`, sourceId: sourceId as Types.ObjectId, date, reason },
    updated!._id, { quantity, weightKg: kg }, after, session);
  return updated!;
}
