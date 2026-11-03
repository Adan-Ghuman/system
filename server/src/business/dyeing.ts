import { Reconciliation } from './reconciliation.models.js';
import { Types, ClientSession } from 'mongoose';
import { DyeingBatch } from '../models/DyeingBatch.js';
import { DyeingUnit } from '../models/DyeingUnit.js';
import { Party } from '../models/Party.js';
import { FabricInventory } from '../models/FabricInventory.js';
import { businessContext, currentShortageReason } from './context.js';
import { postCommand, nextDocumentNo, weight } from './posting.js';
import { moveFabric, validateLocation } from './stock.js';
import { referenceFields } from './references.js';
import { DyeingReceipt } from './records.js';
import { BillAllocation } from './commerce.models.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { escapeRegex } from '../utils/search.js';
import { CreateGatePassInput, CreateBatchInput, ReceiveGatePassInput, SettleBatchInput } from '../modules/dyeing/dyeing.schema.js';

export async function postDyeingIssue(input: CreateGatePassInput) {
  return postCommand('DYEING_ISSUE', input, async session => {
    let mill = await DyeingUnit.findOne(input.millName === 'OTHER' ? { name: new RegExp('^' + escapeRegex(input.customMillName.trim()) + '$', 'i'), isActive: true } : { code: input.millName, isActive: true }).session(session);
    if (!mill && input.millName === 'OTHER' && input.customMillName.trim()) {
      [mill] = await DyeingUnit.create([{ code: await nextDocumentNo('MILL', session), name: input.customMillName.trim(), shortName: input.customMillName.trim(), type: 'DYEING_MILL', isActive: true }], { session });
    }
    if (!mill) throw new BadRequestError('Choose an active dyeing mill or add its name under Another mill.');
    let party = mill.partyId ? await Party.findById(mill.partyId).session(session) : await Party.findOne({ name: new RegExp('^' + escapeRegex(mill.name) + '$', 'i') }).session(session);
    if (!party) [party] = await Party.create([{ name: mill.name, code: await nextDocumentNo('PARTY', session), tags: { isDyeingMill: true }, openingBalance: 0, currentBalance: 0 }], { session });
    mill.partyId = party._id as Types.ObjectId;await mill.save({ session });
    const batches = [];
    const ogpNo = input.ogpNo || await nextDocumentNo('OGP', session);
    for (const item of input.entries) {
      const source = item.inventoryId ? await FabricInventory.findOne({ _id: item.inventoryId, state: 'RAW_ECRU', location: 'ZR_GODOWN', ownerKey: input.ownerKey }).session(session) : null;
      if (item.inventoryId && !source) throw new BadRequestError('Choose raw stock at Rozain Textile belonging to the selected fabric owner. Refresh stock and select it again.');
      if (source && source.color !== 'ECRU') throw new BadRequestError(`This raw stock has current shade ${source.color}. Confirm it is undyed grey and use Correct raw shade to ECRU before sending. Enter the desired shade in Color / shade to dye.`);
      if (item.allocatedCustomerId && !await Party.findById(item.allocatedCustomerId).session(session)) throw new BadRequestError('The reserved buyer must belong to this business.');
      const [batch] = await DyeingBatch.create([{ batchNo: await nextDocumentNo('LOT', session), millName: mill.code, millPartyId: party._id, customMillName: mill.name, ...referenceFields(input),
        sourceInventoryId: source?._id, ogpNo, dateIssued: new Date(input.dateIssued), driverName: input.driverName, vehicleNo: input.vehicleNo, fabricType: source?.fabricType || item.fabricType, yarnSpec: source?.yarnSpec || item.yarnSpec || item.yarnSpecs?.join(' + '), targetColor: item.targetColor,
        ownerKey: input.ownerKey, ecruRollsCount: item.ecruRollsCount, ecruWeightKg: item.ecruWeightKg, machineNo: item.machineNo, width: item.width, gsm: item.gsm, allocatedCustomerId: item.allocatedCustomerId || undefined, remarks: item.remarks || input.remarks, status: 'ISSUED', receivedRawKg: 0, receivedRawRolls: 0
      }], { session });
      const stockItem = { fabricType: batch.fabricType, yarnSpec: batch.yarnSpec, state: 'RAW_ECRU' as const, color: 'ECRU', ownerKey: input.ownerKey, rolls: item.ecruRollsCount, weightKg: item.ecruWeightKg };
      if (input.shortageReason && !source) {
        const sameFabric = { fabricType: batch.fabricType, yarnSpec: batch.yarnSpec, state: 'RAW_ECRU', location: 'ZR_GODOWN', ownerKey: input.ownerKey };
        const ecru = await FabricInventory.exists({ ...sameFabric, color: 'ECRU' }).session(session);
        const colored = !ecru && await FabricInventory.exists({ ...sameFabric, color: { $ne: 'ECRU' }, totalRolls: { $gt: 0 } }).session(session);
        if (colored) throw new BadRequestError('Correct the current shade to ECRU for the existing undyed stock before sending it.');
      }
      try {
        await moveFabric({ ...stockItem, inventoryId: item.inventoryId }, 'ZR_GODOWN', -1, batch._id, batch.dateIssued, `Sent for dyeing: ${mill.name}`, session);
      } catch (error) {
        if (error instanceof BadRequestError && error.message.startsWith('Not enough')) {
          if (source) throw new BadRequestError(`Available stock for ${source.fabricType} / ${source.yarnSpec} is ${source.totalRolls} rolls / ${weight(source.totalWeightKg).toFixed(3)} kg. This line requests ${item.ecruRollsCount} rolls / ${weight(item.ecruWeightKg).toFixed(3)} kg. Check other lines using the same stock or refresh its balance.`);
          const coloredRaw = await FabricInventory.findOne({ fabricType: stockItem.fabricType, yarnSpec: stockItem.yarnSpec, state: 'RAW_ECRU', location: 'ZR_GODOWN', ownerKey: stockItem.ownerKey, color: { $ne: 'ECRU' }, totalRolls: { $gt: 0 }, totalWeightKg: { $gt: 0 } }).session(session);
          if (coloredRaw) throw new BadRequestError(`This raw stock is recorded with current shade ${coloredRaw.color}. If it is undyed grey, open Fabric stock → Edit → Correct raw shade to ECRU, then retry. Enter the target shade only in Color / shade to dye.`);
        }
        throw error;
      }
      await moveFabric(stockItem, mill.code, 1, batch._id, batch.dateIssued, `In process: ${mill.name}`, session);
      batches.push(batch.toObject());
    }
    return batches;
  });
}

export async function postSingleDyeingIssue(input: CreateBatchInput) {
  return (await postDyeingIssue({ ...input, ogpNo: input.ogpNo || '', entries: [input] }))[0];
}

export async function postDyeingReceipt(input: ReceiveGatePassInput, complete = false) {
  return postCommand('DYEING_RECEIPT', input, async session => (await postDyeingReceiptInSession(input, session, complete)).batches);
}

export function updateDyeingBatch(batch: import('../models/DyeingBatch.js').IDyeingBatch, rawKg: number, rawRolls: number, finishedKg: number, finishedRolls: number, date: Date, reference: string) {
  batch.receivedRawKg = weight((batch.receivedRawKg || 0) + rawKg);
  batch.receivedRawRolls = (batch.receivedRawRolls || 0) + rawRolls;
  batch.finishWeightKg = weight((batch.finishWeightKg || 0) + finishedKg);
  batch.finishRollsCount = (batch.finishRollsCount || 0) + finishedRolls;
  if (!batch.dateReceived || batch.dateReceived <= date) {
    batch.dateReceived = date;
    batch.igpNo = reference;
  }
  batch.shortageWeightKg = weight(batch.receivedRawKg - batch.finishWeightKg);
  batch.shortagePercent = Math.round(batch.shortageWeightKg / batch.receivedRawKg * 10000) / 100;
  batch.status = batch.receivedRawKg >= batch.ecruWeightKg - 0.000001 && batch.receivedRawRolls === batch.ecruRollsCount ? 'COMPLETED' : 'IN_PROCESS';
}

export function fitsDyeingBatch(batch: import('../models/DyeingBatch.js').IDyeingBatch, rawKg: number, rawRolls: number) {
  const remainingKg = weight(batch.ecruWeightKg - (batch.receivedRawKg || 0));
  const remainingRolls = batch.ecruRollsCount - (batch.receivedRawRolls || 0);
  return rawKg > 0 && rawRolls > 0 && rawKg <= remainingKg && rawRolls <= remainingRolls
    && ((rawRolls === remainingRolls) === (rawKg === remainingKg));
}

export async function postDyeingReceiptInSession(input: ReceiveGatePassInput, session: ClientSession, complete = false) {
  const result = [], receiptItems = [], gaps = [];
  const date = new Date(input.dateReceived);
  const receiptId = new Types.ObjectId();
  const shortageReason = currentShortageReason();
  const actorId = businessContext.getStore()!.actorId;
  let partyId: Types.ObjectId | undefined;
  for (const item of input.items) {
    const batch = item.batchId ? await DyeingBatch.findById(item.batchId).session(session) : item.lotNo ? await DyeingBatch.findOne({ batchNo: item.lotNo }).session(session) : null;
    if ((item.batchId || item.lotNo) && !batch) throw new BadRequestError('The selected dyeing batch was not found.');
    if (!batch && !shortageReason) throw new BadRequestError('Choose an open batch in this business. Record its outgoing challan before receiving it.');
    if (batch?.status === 'REVERSED') throw new BadRequestError('This outgoing batch was reversed.');
    if (batch && batch.millName !== input.millName && !(input.millName === 'OTHER' && batch.customMillName === input.customMillName)) throw new BadRequestError('The selected batch belongs to a different dyeing mill.');
    if (batch && date < batch.dateIssued) throw new BadRequestError('A receipt cannot be earlier than its dyeing issue.');

    const millMatch = !batch && input.millName === 'OTHER'
      ? { name: new RegExp('^' + escapeRegex(input.customMillName.trim()) + '$', 'i') }
      : { code: batch?.millName || input.millName };
    let mill = await DyeingUnit.findOne({ ...millMatch, isActive: true }).session(session);
    if (!mill && !batch && input.millName === 'OTHER' && input.customMillName.trim()) {
      [mill] = await DyeingUnit.create([{ code: await nextDocumentNo('MILL', session), name: input.customMillName.trim(),
        shortName: input.customMillName.trim(), type: 'DYEING_MILL', isActive: true }], { session });
    }
    if (!mill) throw new BadRequestError('Choose a registered dyeing mill.');
    let millPartyId = batch?.millPartyId || mill.partyId;
    if (!millPartyId) {
      let party = await Party.findOne({ name: new RegExp('^' + escapeRegex(mill.name) + '$', 'i') }).session(session);
      if (!party) [party] = await Party.create([{ name: mill.name, code: await nextDocumentNo('PARTY', session),
        tags: { isDyeingMill: true }, openingBalance: 0, currentBalance: 0 }], { session });
      millPartyId = party._id as Types.ObjectId;
      mill.partyId = millPartyId;
      await mill.save({ session });
    }
    if (partyId && String(partyId) !== String(millPartyId)) throw new BadRequestError('Use a separate receipt for each dyeing mill.');
    partyId = millPartyId as Types.ObjectId;
    const ownerKey = batch?.ownerKey || input.ownerKey;
    const fabricType = batch?.fabricType || item.fabricType;
    const yarnSpec = batch?.yarnSpec || item.yarnSpec;
    const color = batch?.targetColor || item.targetColor;
    if (!fabricType || !yarnSpec || !color) throw new BadRequestError('Enter the fabric, yarn count and finished shade.');
    const rawKg = weight(complete && batch ? batch.ecruWeightKg - (batch.receivedRawKg || 0) : item.ecruWeightKg || 0);
    const rawRolls = complete && batch ? batch.ecruRollsCount - (batch.receivedRawRolls || 0) : item.ecruRollsCount || 0;
    if (Boolean(rawKg) !== Boolean(rawRolls) || (rawKg && item.finishWeightKg > rawKg)) throw new BadRequestError('Enter both measured raw rolls and kg, with raw kg at least the finished kg.');
    const linked = Boolean(batch && batch.status !== 'COMPLETED' && fitsDyeingBatch(batch, rawKg, rawRolls));
    if (!linked && !shortageReason) {
      if (batch && rawKg && rawRolls && rawKg <= weight(batch.ecruWeightKg - batch.receivedRawKg) && rawRolls <= batch.ecruRollsCount - batch.receivedRawRolls) {
        throw new BadRequestError('The final raw roll count and kg must reconcile together. Leave both remaining for a partial return.');
      }
      throw new BadRequestError('Enter the raw kg and raw rolls covered by this return, within the remaining issued quantity.');
    }
    const finishedLocation = input.destination || mill.code;
    await validateLocation(finishedLocation, session);
    if (finishedLocation === 'IN_TRANSIT') throw new BadRequestError('Choose the receiving stock location.');
    const shared = { ownerKey, fabricType, yarnSpec };
    if (linked && batch) {
      await moveFabric({ ...shared, state: 'RAW_ECRU', color: 'ECRU', rolls: rawRolls, weightKg: rawKg },
        mill.code, -1, batch._id, date, 'Raw fabric processed', session);
      updateDyeingBatch(batch, rawKg, rawRolls, item.finishWeightKg, item.finishRollsCount, date, input.igpNo);
      await batch.save({ session });
      result.push(batch.toObject());
    }
    const lineId = new Types.ObjectId();
    await moveFabric({ ...shared, state: 'FINISHED_DYED', color, rolls: item.finishRollsCount, weightKg: item.finishWeightKg },
      finishedLocation, 1, receiptId, date, 'Dyed fabric received', session);
    receiptItems.push({ _id: lineId, ...shared, color, finishedLocation, batchId: linked ? batch?._id : undefined,
      rawKg: rawKg || undefined, rawRolls: rawRolls || undefined, weightKg: item.finishWeightKg, rolls: item.finishRollsCount,
      wastageKg: rawKg ? weight(rawKg - item.finishWeightKg) : undefined });
    if (!linked) gaps.push({ ...shared, kind: 'DYEING', sourceId: receiptId, lineId, item: fabricType, color, location: mill.code,
      partyId, reference: input.igpNo, date, reason: shortageReason, actorId, quantity: -rawRolls, weightKg: -rawKg, finishedQuantity: item.finishRollsCount, finishedKg: item.finishWeightKg });
  }
  const [receipt] = await DyeingReceipt.create([{ _id: receiptId, receiptReferenceKey: String(partyId) + ':' + input.igpNo.trim().toUpperCase(),
    number: await nextDocumentNo('DR', session), gatePassNo: input.igpNo, partyId, date, ...referenceFields(input), actorId, items: receiptItems }], { session });
  if (gaps.length) await Reconciliation.insertMany(gaps, { session });
  return { batches: result, receipt: receipt.toObject() };
}

export async function completeDyeingBatch(id: string, input: SettleBatchInput) {
  const batch = await DyeingBatch.findById(id);if (!batch) throw new NotFoundError('Batch not found.');
  return postCommand('DYEING_SETTLE', { ...input, id }, async session => {
    const result = await postDyeingReceiptInSession({ ...input, ownerKey: batch.ownerKey || 'OWN', igpNo: input.igpNo || `RETURN-${batch.batchNo}`, millName: batch.millName, customMillName: '', driverName: '', vehicleNo: '', remarks: input.remarks || '', items: [{ ...input, batchId: id }] }, session, true);
    return result.batches[0] || batch.toObject();
  });
}

export async function reverseDyeingReceipt(id: string, input: { reason: string; requestId?: string; shortageReason?: string }) {
  return postCommand('REVERSE_DYEING_RECEIPT', { ...input, id }, async session => {
    const receipt = await DyeingReceipt.findOne({ _id: id, status: 'POSTED' }).session(session);
    if (!receipt) throw new NotFoundError('Posted dyeing receipt not found.');
    if (await BillAllocation.exists({ sourceId: id }).session(session)) throw new BadRequestError('Reverse the processing bill before reversing its receipt.');
    if (receipt.receiptOrigin === 'EXTERNAL_PROCESSING_RETURN') {
      for (const item of receipt.items) await moveFabric({ fabricType: item.fabricType || '', yarnSpec: item.yarnSpec || '', color: item.color || '', state: 'FINISHED_DYED', ownerKey: item.ownerKey || '', rolls: item.rolls || 0, weightKg: item.weightKg || 0 }, receipt.location, -1, receipt._id, new Date(), `External return reversed: ${input.reason}`, session);
      receipt.status = 'REVERSED';await receipt.save({ session });return receipt.toObject();
    }
    for (const item of receipt.items) {
      const allocations = item.batchId ? [item] : item.allocations;
      const batches = await DyeingBatch.find({ _id: { $in: allocations.map(allocation => allocation.batchId) } }).session(session);
      const legacy = batches.find(batch => String(batch._id) === String(item.batchId));
      const shared = { fabricType: item.fabricType || legacy?.fabricType || '', yarnSpec: item.yarnSpec || legacy?.yarnSpec || '',
        ownerKey: item.ownerKey || legacy?.ownerKey || 'OWN' };
      await moveFabric({ ...shared, state: 'FINISHED_DYED', color: item.color || legacy?.targetColor || '', rolls: item.rolls!, weightKg: item.weightKg! },
        item.finishedLocation || legacy?.millName || receipt.location, -1, receipt._id, new Date(), input.reason, session);
      for (const allocation of allocations) {
        const batch = batches.find(value => String(value._id) === String(allocation.batchId));
        if (!batch) throw new NotFoundError('A linked dyeing batch is missing.');
        await moveFabric({ ...shared, state: 'RAW_ECRU', color: 'ECRU', rolls: allocation.rawRolls!, weightKg: allocation.rawKg! },
          batch.millName, 1, receipt._id, new Date(), input.reason, session);
        batch.receivedRawKg = weight(batch.receivedRawKg - allocation.rawKg!);
        batch.receivedRawRolls -= allocation.rawRolls!;
        batch.finishWeightKg = weight((batch.finishWeightKg || 0) - allocation.weightKg!);
        batch.finishRollsCount = (batch.finishRollsCount || 0) - allocation.rolls!;
        batch.shortageWeightKg = weight(batch.receivedRawKg - batch.finishWeightKg);
        batch.shortagePercent = batch.receivedRawKg ? Math.round(batch.shortageWeightKg / batch.receivedRawKg * 10000) / 100 : 0;
        batch.status = batch.receivedRawKg ? 'IN_PROCESS' : 'ISSUED';
        await batch.save({ session });
      }
    }
    await Reconciliation.updateMany({ sourceId: receipt._id, kind: 'DYEING', open: true }, {
      $set: { open: false, quantity: 0, weightKg: 0, finishedKg: 0, finishedQuantity: 0 },
      $push: { events: { sourceId: receipt._id, date: new Date(), recordedAt: new Date(), reason: input.reason,
        actorId: businessContext.getStore()!.actorId, quantity: 0, weightKg: 0 } }
    }, { session });
    receipt.status = 'REVERSED';await receipt.save({ session });return receipt.toObject();
  });
}

export async function reverseDyeingIssue(id: string, input: { reason: string; requestId?: string; shortageReason?: string }) {
  return postCommand('REVERSE_DYEING_ISSUE', { ...input, id }, async session => {
    const batch = await DyeingBatch.findOne({ _id: id, status: { $ne: 'REVERSED' } }).session(session);
    if (!batch) throw new NotFoundError('Open dyeing batch not found.');
    if (batch.receivedRawKg || await DyeingReceipt.exists({ status: 'POSTED', 'items.batchId': batch._id }).session(session)) throw new BadRequestError('Reverse its received fabric first.');
    const item = { fabricType: batch.fabricType, yarnSpec: batch.yarnSpec, state: 'RAW_ECRU' as const, color: 'ECRU', rolls: batch.ecruRollsCount, weightKg: batch.ecruWeightKg, ownerKey: batch.ownerKey || 'OWN' };
    await moveFabric(item, batch.millName, -1, batch._id, new Date(), input.reason, session);
    await moveFabric({ ...item, inventoryId: batch.sourceInventoryId?.toString() }, 'ZR_GODOWN', 1, batch._id, new Date(), input.reason, session);
    batch.status = 'REVERSED';batch.remarks = `${batch.remarks || ''} | ${input.reason}`;await batch.save({ session });return batch.toObject();
  });
}
