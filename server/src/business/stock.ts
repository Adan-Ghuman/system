import { ClientSession } from 'mongoose';
import { FabricInventory } from '../models/FabricInventory.js';
import { DyeingUnit } from '../models/DyeingUnit.js';
import { StockMovement } from './records.js';
import { OperationItem } from './commerce.schema.js';
import { BadRequestError } from '../utils/errors.js';
import { businessContext } from './context.js';
import { weight } from './posting.js';

export async function validateLocation(location: string, session?: ClientSession) {
  if (['ZR_GODOWN', 'IN_TRANSIT'].includes(location)) return;
  if (!await DyeingUnit.findOne({ code: location, isActive: true }).session(session || null)) throw new BadRequestError('Choose an active location in this business.');
}
export async function moveFabric(item: Pick<OperationItem, 'fabricType' | 'yarnSpec' | 'state' | 'color' | 'rolls' | 'weightKg' | 'ownerKey'>, location: string, sign: 1 | -1, sourceId: unknown, date: Date, reason: string, session: ClientSession) {
  const match = { fabricType: item.fabricType, yarnSpec: item.yarnSpec, state: item.state, color: item.color.toUpperCase(), location, ownerKey: item.ownerKey || 'OWN' };
  if (!item.fabricType || !item.yarnSpec || !item.color || item.rolls < 1 || item.weightKg <= 0) throw new BadRequestError('Each fabric needs its name, yarn count, shade, positive roll count and measured kg.');
  if (sign === -1) {
    const changed = await FabricInventory.findOneAndUpdate({ ...match, totalRolls: { $gte: item.rolls }, totalWeightKg: { $gte: weight(item.weightKg) - 0.0000001 } }, { $inc: { totalRolls: -item.rolls, totalWeightKg: -weight(item.weightKg) } }, { new: true, session });
    if (!changed) throw new BadRequestError(`Not enough ${item.fabricType} / ${item.yarnSpec} at this location. Check rolls, measured kg, shade and ownership.`);
    changed.totalWeightKg = weight(changed.totalWeightKg);await changed.save({ session });
    if ((changed.totalRolls === 0) !== (changed.totalWeightKg === 0)) throw new BadRequestError('The final roll count and measured kg do not reconcile. Correct the measurement or record the discrepancy before moving the final rolls.');
  } else await FabricInventory.findOneAndUpdate(match, { $setOnInsert: match, $inc: { totalRolls: item.rolls, totalWeightKg: weight(item.weightKg) } }, { upsert: true, new: true, session });
  await StockMovement.create([{ sourceId, material: 'FABRIC', item: `${item.fabricType} / ${item.yarnSpec} / ${item.color}`, quantity: sign * item.rolls, weightKg: sign * weight(item.weightKg), location, date, reason, actorId: businessContext.getStore()!.actorId }], { session });
}
