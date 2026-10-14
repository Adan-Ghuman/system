import { Types } from 'mongoose';
import { DyeingBatch } from '../models/DyeingBatch.js';
import { DyeingUnit } from '../models/DyeingUnit.js';
import { Party } from '../models/Party.js';
import { businessContext } from './context.js';
import { postCommand, nextDocumentNo, weight } from './posting.js';
import { moveFabric } from './stock.js';
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
    for (const item of input.entries) {
      if (item.allocatedCustomerId && !await Party.findById(item.allocatedCustomerId).session(session)) throw new BadRequestError('The reserved buyer must belong to this business.');
      const [batch] = await DyeingBatch.create([{ batchNo: await nextDocumentNo('LOT', session), millName: mill.code, millPartyId: party._id, customMillName: mill.name, ...referenceFields(input),
        ogpNo: input.ogpNo, dateIssued: new Date(input.dateIssued), driverName: input.driverName, vehicleNo: input.vehicleNo, fabricType: item.fabricType, yarnSpec: item.yarnSpec || item.yarnSpecs?.join(' + '), targetColor: item.targetColor,
        ownerKey: input.ownerKey, ecruRollsCount: item.ecruRollsCount, ecruWeightKg: item.ecruWeightKg, machineNo: item.machineNo, width: item.width, gsm: item.gsm, allocatedCustomerId: item.allocatedCustomerId || undefined, remarks: item.remarks || input.remarks, status: 'ISSUED', receivedRawKg: 0, receivedRawRolls: 0
      }], { session });
      const stockItem = { fabricType: batch.fabricType, yarnSpec: batch.yarnSpec, state: 'RAW_ECRU' as const, color: 'ECRU', ownerKey: input.ownerKey, rolls: item.ecruRollsCount, weightKg: item.ecruWeightKg };
      await moveFabric(stockItem, 'ZR_GODOWN', -1, batch._id, batch.dateIssued, `Sent for dyeing: ${mill.name}`, session);
      await moveFabric(stockItem, mill.code, 1, batch._id, batch.dateIssued, `In process: ${mill.name}`, session);
      batches.push(batch.toObject());
    }
    return batches;
  });
}

export async function postSingleDyeingIssue(input: CreateBatchInput) {
  return (await postDyeingIssue({ ...input, ogpNo: input.ogpNo || await nextDocumentNo('OGP'), entries: [input] }))[0];
}

export async function postDyeingReceipt(input: ReceiveGatePassInput, complete = false) {
  return postCommand('DYEING_RECEIPT', input, async session => {
    const result = [], receiptItems = [];
    const date = new Date(input.dateReceived);
    for (const item of input.items) {
      const batch = item.batchId ? await DyeingBatch.findById(item.batchId).session(session) : item.lotNo ? await DyeingBatch.findOne({ batchNo: item.lotNo }).session(session) : null;
      if (!batch || batch.status === 'COMPLETED') throw new BadRequestError('Choose an open batch in this business. Record its outgoing challan before receiving it.');
      if (batch.status === 'REVERSED') throw new BadRequestError('This outgoing batch was reversed.');
      if (batch.millName !== input.millName && !(input.millName === 'OTHER' && batch.customMillName === input.customMillName)) throw new BadRequestError('The selected batch belongs to a different dyeing mill.');
      if (date < batch.dateIssued) throw new BadRequestError('A receipt cannot be earlier than its dyeing issue.');
      const remainingKg = weight(batch.ecruWeightKg - (batch.receivedRawKg || 0));
      const remainingRolls = batch.ecruRollsCount - (batch.receivedRawRolls || 0);
      const rawKg = complete ? remainingKg : item.ecruWeightKg;
      const rawRolls = complete ? remainingRolls : item.ecruRollsCount;
      if (!rawKg || !rawRolls || rawKg > remainingKg + 0.000001 || rawRolls > remainingRolls) throw new BadRequestError('Enter the raw kg and raw rolls covered by this return, within the remaining issued quantity.');
      if ((rawRolls === remainingRolls) !== (Math.abs(rawKg - remainingKg) < 0.000001)) throw new BadRequestError('The final raw roll count and kg must reconcile together. Leave both remaining for a partial return.');
      if (item.finishWeightKg > rawKg) throw new BadRequestError('Finished kg exceeds the raw kg allocated to this return. Check the two measurements.');
      const ownerKey = batch.ownerKey || 'OWN';
      await moveFabric({ fabricType: batch.fabricType, yarnSpec: batch.yarnSpec, state: 'RAW_ECRU', color: 'ECRU', ownerKey, rolls: rawRolls, weightKg: rawKg }, batch.millName, -1, batch._id, date, 'Raw fabric processed', session);
      await moveFabric({ fabricType: batch.fabricType, yarnSpec: batch.yarnSpec, state: 'FINISHED_DYED', color: batch.targetColor, ownerKey, rolls: item.finishRollsCount, weightKg: item.finishWeightKg }, batch.millName, 1, batch._id, date, 'Dyed fabric received', session);
      batch.receivedRawKg = weight((batch.receivedRawKg || 0) + rawKg);batch.receivedRawRolls = (batch.receivedRawRolls || 0) + rawRolls;
      batch.finishWeightKg = weight((batch.finishWeightKg || 0) + item.finishWeightKg);batch.finishRollsCount = (batch.finishRollsCount || 0) + item.finishRollsCount;
      batch.dateReceived = date;batch.igpNo = input.igpNo;batch.shortageWeightKg = weight(batch.receivedRawKg - batch.finishWeightKg);batch.shortagePercent = Math.round(batch.shortageWeightKg / batch.receivedRawKg * 10000) / 100;
      batch.status = batch.receivedRawKg >= batch.ecruWeightKg - 0.000001 && batch.receivedRawRolls === batch.ecruRollsCount ? 'COMPLETED' : 'IN_PROCESS';
      await batch.save({ session });result.push(batch.toObject());
      receiptItems.push({ batchId: batch._id, fabricType: batch.fabricType, yarnSpec: batch.yarnSpec, color: batch.targetColor, rawKg, rawRolls, weightKg: item.finishWeightKg, rolls: item.finishRollsCount, wastageKg: weight(rawKg - item.finishWeightKg) });
    }
    await DyeingReceipt.create([{ number: await nextDocumentNo('DR', session), gatePassNo: input.igpNo, partyId: result[0]?.millPartyId, date, ...referenceFields(input), actorId: businessContext.getStore()!.actorId, items: receiptItems }], { session });
    return result;
  });
}

export async function completeDyeingBatch(id: string, input: SettleBatchInput) {
  const batch = await DyeingBatch.findById(id);if (!batch) throw new NotFoundError('Batch not found.');
  return (await postDyeingReceipt({ ...input, igpNo: input.igpNo || `RETURN-${batch.batchNo}`, millName: batch.millName, customMillName: '', driverName: '', vehicleNo: '', remarks: input.remarks || '', items: [{ ...input, batchId: id }] }, true))[0];
}

export async function reverseDyeingReceipt(id: string, input: { reason: string; requestId?: string }) {
  return postCommand('REVERSE_DYEING_RECEIPT', { ...input, id }, async session => {
    const receipt = await DyeingReceipt.findOne({ _id: id, status: 'POSTED' }).session(session);
    if (!receipt) throw new NotFoundError('Posted dyeing receipt not found.');
    if (await BillAllocation.exists({ sourceId: id }).session(session)) throw new BadRequestError('Reverse the processing bill before reversing its receipt.');
    for (const item of receipt.items) {
      const batch = await DyeingBatch.findById(item.batchId).session(session);
      if (!batch) throw new NotFoundError('The source batch is missing.');
      const shared = { fabricType: batch.fabricType, yarnSpec: batch.yarnSpec, ownerKey: batch.ownerKey || 'OWN' };
      await moveFabric({ ...shared, state: 'FINISHED_DYED', color: batch.targetColor, rolls: item.rolls!, weightKg: item.weightKg! }, batch.millName, -1, receipt._id, new Date(), input.reason, session);
      await moveFabric({ ...shared, state: 'RAW_ECRU', color: 'ECRU', rolls: item.rawRolls!, weightKg: item.rawKg! }, batch.millName, 1, receipt._id, new Date(), input.reason, session);
      batch.receivedRawKg = weight(batch.receivedRawKg - item.rawKg!);batch.receivedRawRolls -= item.rawRolls!;
      batch.finishWeightKg = weight((batch.finishWeightKg || 0) - item.weightKg!);batch.finishRollsCount = (batch.finishRollsCount || 0) - item.rolls!;
      batch.shortageWeightKg = weight(batch.receivedRawKg - batch.finishWeightKg);batch.shortagePercent = batch.receivedRawKg ? Math.round(batch.shortageWeightKg / batch.receivedRawKg * 10000) / 100 : 0;
      batch.status = batch.receivedRawKg ? 'IN_PROCESS' : 'ISSUED';await batch.save({ session });
    }
    receipt.status = 'REVERSED';await receipt.save({ session });return receipt.toObject();
  });
}

export async function reverseDyeingIssue(id: string, input: { reason: string; requestId?: string }) {
  return postCommand('REVERSE_DYEING_ISSUE', { ...input, id }, async session => {
    const batch = await DyeingBatch.findOne({ _id: id, status: { $ne: 'REVERSED' } }).session(session);
    if (!batch) throw new NotFoundError('Open dyeing batch not found.');
    if (batch.receivedRawKg || await DyeingReceipt.exists({ status: 'POSTED', 'items.batchId': batch._id }).session(session)) throw new BadRequestError('Reverse its received fabric first.');
    const item = { fabricType: batch.fabricType, yarnSpec: batch.yarnSpec, state: 'RAW_ECRU' as const, color: 'ECRU', rolls: batch.ecruRollsCount, weightKg: batch.ecruWeightKg, ownerKey: batch.ownerKey || 'OWN' };
    await moveFabric(item, batch.millName, -1, batch._id, new Date(), input.reason, session);
    await moveFabric(item, 'ZR_GODOWN', 1, batch._id, new Date(), input.reason, session);
    batch.status = 'REVERSED';batch.remarks = `${batch.remarks || ''} | ${input.reason}`;await batch.save({ session });return batch.toObject();
  });
}
