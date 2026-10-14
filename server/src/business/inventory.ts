import { Types } from 'mongoose';
import { FabricInventory } from '../models/FabricInventory.js';
import { StockTransfer } from '../models/StockTransfer.js';
import { StockAdjustment } from '../models/StockAdjustment.js';
import { Party } from '../models/Party.js';
import { StockMovement } from './records.js';
import { postCommand, nextDocumentNo, weight } from './posting.js';
import { moveFabric, validateLocation } from './stock.js';
import { businessContext } from './context.js';
import { referenceFields } from './references.js';
import { CreateTransferInput, CreateAdjustmentInput, UpdateInventoryItemInput } from '../modules/inventory/inventory.schema.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export async function postStockTransfer(input: CreateTransferInput) {
  return postCommand('FABRIC_TRANSFER', input, async session => {
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
    if (input.ownerKey !== 'OWN' && !await Party.exists({ _id: input.ownerKey }).session(session)) throw new BadRequestError('Choose a fabric owner in this business.');
    await validateLocation(input.location, session);
    if (input.location === 'IN_TRANSIT') throw new BadRequestError('Correct stock in transit from its linked trade.');
    if (!input.adjustmentRolls && !input.adjustmentWeightKg) throw new BadRequestError('Enter a roll or kg change.');
    const match = { fabricType: input.fabricType, yarnSpec: input.yarnSpec, state: input.state, color: input.color.toUpperCase(), location: input.location, ownerKey: input.ownerKey };
    const stock = await FabricInventory.findOne(match).session(session);
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
  const item = await FabricInventory.findById(id);
  if (!item) throw new NotFoundError('Stock item not found.');
  if (Object.entries(input).some(([key, value]) => !['totalRolls', 'totalWeightKg'].includes(key) && value !== undefined && value !== item.get(key))) throw new BadRequestError('Stock identities cannot be overwritten. Record a signed correction against the original item and add the correct item.');
  await postStockAdjustment({ ...input, fabricType: item.fabricType, yarnSpec: item.yarnSpec, state: item.state, color: item.color, location: item.location, ownerKey: item.get('ownerKey') || 'OWN', adjustmentRolls: (input.totalRolls ?? item.totalRolls) - item.totalRolls, adjustmentWeightKg: weight((input.totalWeightKg ?? item.totalWeightKg) - item.totalWeightKg), reason: 'MANUAL_CORRECTION', remarks: 'Stock count correction', date: new Date().toISOString(), requestId: String(new Types.UUID()) });
  return (await FabricInventory.findById(id))!;
}
