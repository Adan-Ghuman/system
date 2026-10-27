import { rememberFabricNames } from './catalog-names.js';
import { Types } from 'mongoose';
import { FabricInventory } from '../models/FabricInventory.js';
import { StockTransfer } from '../models/StockTransfer.js';
import { StockAdjustment } from '../models/StockAdjustment.js';
import { Party } from '../models/Party.js';
import { StockMovement } from './records.js';
import { postCommand, nextDocumentNo, weight } from './posting.js';
import { moveFabric, validateLocation, validateRawShade } from './stock.js';
import { businessContext } from './context.js';
import { referenceFields } from './references.js';
import { CreateTransferInput, CreateAdjustmentInput, UpdateInventoryItemInput } from '../modules/inventory/inventory.schema.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import { escapeRegex } from '../utils/search.js';

export async function postStockTransfer(input: CreateTransferInput) {
  return postCommand('FABRIC_TRANSFER', input, async session => {
    validateRawShade(input);
    await validateLocation(input.fromLocation, session);await validateLocation(input.toLocation, session);
    if ([input.fromLocation, input.toLocation].includes('IN_TRANSIT')) throw new BadRequestError('Use the linked inter-company receipt for stock in transit.');
    const [document] = await StockTransfer.create([{ ...input, ...referenceFields(input), transferNo: await nextDocumentNo('TRF', session) }], { session });
    const item = { ...input, rolls: input.rollsCount, ownerKey: input.ownerKey };
    await moveFabric(item, input.fromLocation, -1, document._id, new Date(input.date), 'Fabric transfer out', session);
    await moveFabric(item, input.toLocation, 1, document._id, new Date(input.date), 'Fabric transfer in', session);
    return document;
  });
}

export async function postStockAdjustment(input: CreateAdjustmentInput) {
  return postCommand('FABRIC_ADJUSTMENT', input, async session => {
    if (input.adjustmentRolls > 0 || input.adjustmentWeightKg > 0) validateRawShade(input);
    if (input.ownerKey !== 'OWN' && !await Party.exists({ _id: input.ownerKey }).session(session)) throw new BadRequestError('Choose a fabric owner in this business.');
    await validateLocation(input.location, session);
    if (input.location === 'IN_TRANSIT') throw new BadRequestError('Correct stock in transit from its linked trade.');
    if (!input.adjustmentRolls && !input.adjustmentWeightKg) throw new BadRequestError('Enter a roll or kg change.');
    await rememberFabricNames([input], session);
    const match = { fabricType: input.fabricType, yarnSpec: input.yarnSpec, state: input.state, color: input.color.toUpperCase(), location: input.location, ownerKey: input.ownerKey };
    const stock = await FabricInventory.findOne(match).session(session);
    if (input.onlyIfMissing) {
      const existingMatch = { ...match, fabricType: new RegExp('^' + escapeRegex(input.fabricType) + '$', 'i'), yarnSpec: new RegExp('^' + escapeRegex(input.yarnSpec) + '$', 'i'), $or: [{ totalRolls: { $gt: 0 } }, { totalWeightKg: { $gt: 0 } }] };
      if (await FabricInventory.exists(existingMatch).session(session)) throw new ConflictError('This stock already exists. Select it from the list instead of adding its quantity again.');
      if (input.state === 'RAW_ECRU' && await FabricInventory.exists({ ...existingMatch, color: { $ne: 'ECRU' } }).session(session)) throw new ConflictError('This raw fabric is already recorded with another current shade. Select that stock and correct its raw shade to ECRU instead of adding the same stock again.');
    }
    const totalRolls = (stock?.totalRolls || 0) + input.adjustmentRolls;
    const totalWeightKg = weight((stock?.totalWeightKg || 0) + input.adjustmentWeightKg);
    if (totalRolls < 0 || totalWeightKg < 0) throw new BadRequestError('This correction would make stock negative.');
    const [document] = await StockAdjustment.create([{ ...input, ...referenceFields(input) }], { session });
    await FabricInventory.findOneAndUpdate(match, { $setOnInsert: match, $set: { totalRolls, totalWeightKg } }, { upsert: true, session });
    await StockMovement.create([{ sourceId: document._id, material: 'FABRIC', item: `${input.fabricType} / ${input.yarnSpec} / ${input.color}`, quantity: input.adjustmentRolls, weightKg: input.adjustmentWeightKg, location: input.location, date: new Date(input.date), reason: `${input.reason}: ${input.remarks}`, actorId: businessContext.getStore()!.actorId }], { session });
    return document;
  });
}

export async function correctStockItem(id: string, input: UpdateInventoryItemInput) {
  if (input.correctionReason) return correctRawShade(id, input);
  const item = await FabricInventory.findById(id);
  if (!item) throw new NotFoundError('Stock item not found.');
  if (Object.entries(input).some(([key, value]) => !['totalRolls', 'totalWeightKg', 'requestId', 'poNo', 'externalReference'].includes(key) && value !== undefined && value !== item.get(key))) throw new BadRequestError('Stock identities cannot be overwritten. Use Correct raw shade for undyed stock, or record a signed correction against the original item.');
  await postStockAdjustment({ ...input, fabricType: item.fabricType, yarnSpec: item.yarnSpec, state: item.state, color: item.color, location: item.location, ownerKey: item.get('ownerKey') || 'OWN', adjustmentRolls: (input.totalRolls ?? item.totalRolls) - item.totalRolls, adjustmentWeightKg: weight((input.totalWeightKg ?? item.totalWeightKg) - item.totalWeightKg), reason: 'MANUAL_CORRECTION', remarks: 'Stock count correction', date: new Date().toISOString(), requestId: String(new Types.UUID()) });
  return (await FabricInventory.findById(id))!;
}

async function correctRawShade(id: string, input: UpdateInventoryItemInput) {
  return postCommand('CORRECT_RAW_SHADE', { ...input, id }, async session => {
    const item = await FabricInventory.findById(id).session(session);
    if (!item) throw new NotFoundError('Stock item not found.');
    if (item.state !== 'RAW_ECRU' || item.color === 'ECRU' || input.color !== 'ECRU') throw new BadRequestError('This action only corrects the current shade of undyed raw stock to ECRU.');
    if (Object.entries(input).some(([key, value]) => !['color', 'correctionReason', 'requestId', 'poNo', 'externalReference'].includes(key) && value !== undefined && value !== item.get(key))) throw new BadRequestError('A shade correction must keep the same fabric, owner, location, rolls and measured kg. Correct the stock count separately.');
    if (item.totalRolls <= 0 || item.totalWeightKg <= 0) throw new BadRequestError('There is no available stock to correct.');
    await validateLocation(item.location, session);
    const correctionId = new Types.ObjectId();
    const date = new Date();
    const oldColor = item.color;
    const rolls = item.totalRolls;
    const kg = item.totalWeightKg;
    const identity = { fabricType: item.fabricType, yarnSpec: item.yarnSpec, state: item.state, location: item.location, ownerKey: item.ownerKey || 'OWN' };
    let target = await FabricInventory.findOne({ ...identity, color: 'ECRU' }).session(session);
    if (target) {
      target.totalRolls += rolls;target.totalWeightKg = weight(target.totalWeightKg + kg);await target.save({ session });
      item.totalRolls = 0;item.totalWeightKg = 0;await item.save({ session });
    } else {
      item.color = 'ECRU';await item.save({ session });target = item;
    }
    const remarks = `Raw shade corrected from ${oldColor} to ECRU: ${input.correctionReason}`;
    const adjustments = await StockAdjustment.create([
      { ...identity, color: oldColor, adjustmentRolls: -rolls, adjustmentWeightKg: -kg, reason: 'MANUAL_CORRECTION', date, remarks, correctionId, sourceInventoryId: item._id, targetInventoryId: target._id },
      { ...identity, color: 'ECRU', adjustmentRolls: rolls, adjustmentWeightKg: kg, reason: 'MANUAL_CORRECTION', date, remarks, correctionId, sourceInventoryId: item._id, targetInventoryId: target._id }
    ], { session, ordered: true });
    for (const adjustment of adjustments) await StockMovement.create([{ sourceId: adjustment._id, material: 'FABRIC', item: `${item.fabricType} / ${item.yarnSpec} / ${adjustment.color}`, quantity: adjustment.adjustmentRolls, weightKg: adjustment.adjustmentWeightKg, location: item.location, date, reason: remarks, actorId: businessContext.getStore()!.actorId }], { session });
    return target;
  });
}
