import { canonicalOwnerKey } from './ownership.js';
import { Types, ClientSession } from 'mongoose';
import { Party } from '../models/Party.js';
import { YarnTransaction } from '../models/YarnTransaction.js';
import { moveFabric } from './stock.js';
import { moveYarn } from './stock-reconciliation.js';
import { Reconciliation } from './reconciliation.models.js';
import { KnittingReceipt } from './records.js';
import { businessContext, currentShortageReason } from './context.js';
import { postCommand, weight, nextDocumentNo } from './posting.js';
import { referenceFields } from './references.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { escapeRegex } from '../utils/search.js';
import { CreateBulkYarnTransactionInput, CreateYarnTransactionInput, ReceiveFabricInput } from '../modules/knitting/knitting.schema.js';

async function resolveParty(value: string, isKnitter: boolean, session: ClientSession) {
  if (Types.ObjectId.isValid(value)) {
    const party = await Party.findById(value).session(session);
    if (!party) throw new NotFoundError('The selected party is not available in this business.');
    return party;
  }
  const existing = await Party.findOne({ name: new RegExp('^' + escapeRegex(value.trim()) + '$', 'i') }).session(session);
  if (existing) return existing;
  const [party] = await Party.create([{ name: value.trim(), code: await nextDocumentNo('PRT', session), tags: { isKnitter, isYarnClient: !isKnitter }, openingBalance: 0, currentBalance: 0 }], { session });
  return party;
}

export async function postYarnDelivery(input: CreateBulkYarnTransactionInput) {
  return postCommand('YARN_DELIVERY', input, async session => {
    const outward = input.transactionType === 'OUTWARD_TO_KNITTER';
    const party = await resolveParty(input.partyId, outward, session);
    const date = new Date(input.date);
    const transactions = [];
    let totalBoxes = 0, totalGrossKg = 0;
    const requestedOwner = input.ownership === 'CLIENT' ? (outward ? input.ownerPartyId : String(party._id)) : 'OWN';
    if (!requestedOwner) throw new BadRequestError('Choose the client who owns this yarn.');
    const ownerKey = canonicalOwnerKey(requestedOwner);
    if (ownerKey !== 'OWN' && !await Party.findById(ownerKey).session(session)) throw new BadRequestError('Yarn owner not found in this business.');
    for (const item of input.items) {
      const actual = weight(item.totalWeightKg ?? item.boxCount * item.netWeightPerBox);
      if (!(actual > 0)) throw new BadRequestError('Enter the total measured yarn weight.');
      const [transaction] = await YarnTransaction.create([{
        productionType: input.productionType, transactionType: input.transactionType, partyId: party._id, yarnSpec: item.yarnSpec, gatePassNo: input.gatePassNo, date,
        boxCount: item.boxCount, netWeightPerBox: actual / item.boxCount, totalWeightKg: actual, packageUnit: item.packageUnit, ownerKey,
        grossWeightKg: actual, wastagePercent: 0, wastageWeightKg: 0, netExpectedFabricKg: actual, receivedFabricKg: 0,
        actualWastageKg: 0, remainingYarnBalanceKg: outward ? actual : 0, ...referenceFields(input), remarks: [item.remarks, input.remarks].filter(Boolean).join(' | ')
      }], { session });
      const sign = outward ? -1 : 1;
      await moveYarn({ yarnSpec: item.yarnSpec, ownerKey, packageUnit: item.packageUnit, partyId: party._id as Types.ObjectId,
        sourceId: transaction._id, date, reason: outward ? `Issued to ${party.name}` : `Received from ${party.name}` },
      { weightKg: sign * actual, quantity: sign * item.boxCount }, session,
      `Not enough ${item.yarnSpec} yarn in stock. Add yarn or record its receipt first, and check the package count and owner.`);
      transactions.push(transaction.toObject());totalBoxes += item.boxCount; totalGrossKg = weight(totalGrossKg + actual);
    }
    return { transactions, count: transactions.length, totalBoxes, totalGrossKg };
  });
}

export async function postSingleYarnDelivery(input: CreateYarnTransactionInput) {
  const result = await postYarnDelivery({ ...input, items: [input] });
  return result.transactions[0];
}

export async function postKnittingReceipt(input: ReceiveFabricInput) {
  return postCommand('KNITTING_RECEIPT', input, session => postKnittingReceiptInSession(input, session));
}

export async function postKnittingReceiptInSession(input: ReceiveFabricInput, session: ClientSession) {
    if (!input.gatePassNo?.trim()) throw new BadRequestError('Enter the receipt challan number.');
    const party = await resolveParty(input.partyId, true, session);
    const date = new Date(input.date);
    const items = input.items || [{ fabricType: input.fabricType || '', yarnSpec: input.yarnSpec || '', rollsCount: input.rollsCount || 0, weightKg: input.weightKg || 0, wastageKg: input.wastageKg, remarks: input.remarks }];
    const stored = [];
    const receiptId = new Types.ObjectId();
    const gaps = [];
    const ownerKey = canonicalOwnerKey(input.ownerKey);
    if (ownerKey !== 'OWN' && (!Types.ObjectId.isValid(ownerKey) || !await Party.exists({ _id: ownerKey }).session(session))) {
      throw new BadRequestError('Choose a yarn owner in this business.');
    }
    let totalReceivedKg = 0, totalRolls = 0, totalWastageKg = 0;
    for (const item of items) {
      if (item.wastageKg === undefined) throw new BadRequestError('Enter actual wastage in kg for each fabric, including 0 if there was none.');
      const received = weight(item.weightKg), waste = weight(item.wastageKg);
      const remaining = weight(received + waste);
      const allocations: Array<{ transactionId: string; weightKg: number; fabricKg: number; wastageKg: number }> = [];
      const components = 'components' in item && item.components?.length ? item.components : [{ yarnSpec: item.yarnSpec, weightKg: remaining }];
      if (item.yarnSpec.includes('+') && !('components' in item && item.components?.length)) throw new BadRequestError('For blended fabric, enter the actual kg consumed from each yarn component.');
      if (Math.abs(weight(components.reduce((sum, component) => sum + component.weightKg, 0)) - remaining) > 0.000001) throw new BadRequestError('Component kg must equal fabric kg plus actual wastage kg.');
      const lineId = new Types.ObjectId();
      let fabricLeft = received;
      for (const component of components) {
      let needed = weight(component.weightKg);
      const issues = await YarnTransaction.find({ partyId: party._id, ownerKey: input.ownerKey, yarnSpec: component.yarnSpec, ...(input.productionType ? { $or: [{ productionType: input.productionType }, { productionType: { $exists: false } }] } : {}), status: { $ne: 'REVERSED' }, transactionType: 'OUTWARD_TO_KNITTER', date: { $lte: date }, remainingYarnBalanceKg: { $gt: 0 } }).sort({ date: 1, _id: 1 }).session(session);
      for (const issue of issues) {
        if (!needed) break;
        const consumed = Math.min(needed, issue.remainingYarnBalanceKg);
        const fabricKg = Math.min(fabricLeft, consumed), wastageKg = weight(consumed - fabricKg);
        issue.receivedFabricKg = weight(issue.receivedFabricKg + fabricKg);
        issue.actualWastageKg = weight((issue.actualWastageKg || 0) + wastageKg);
        issue.remainingYarnBalanceKg = weight(issue.remainingYarnBalanceKg - consumed);
        await issue.save({ session });
        allocations.push({ transactionId: String(issue._id), weightKg: consumed, fabricKg, wastageKg });
        needed = weight(needed - consumed);fabricLeft = weight(fabricLeft - fabricKg);
      }
      if (needed > 0) {
        const reason = currentShortageReason();
        if (!reason) throw new BadRequestError(`${component.yarnSpec}: not enough eligible yarn at this knitter on the receipt date.`);
        const fabricKg = Math.min(fabricLeft, needed);
        fabricLeft = weight(fabricLeft - fabricKg);
        gaps.push({ kind: 'KNITTING', sourceId: receiptId, lineId, item: item.fabricType, yarnSpec: component.yarnSpec,
          ownerKey, location: party.name, partyId: party._id, reference: input.gatePassNo, date, reason,
          weightKg: -needed, fabricKg, actorId: businessContext.getStore()!.actorId });
      }
      }
      await moveFabric({ ...item, ownerKey, rolls: item.rollsCount, weightKg: received, state: 'RAW_ECRU', color: 'ECRU' },
        'ZR_GODOWN', 1, receiptId, date, 'Knitted fabric received', session);
      stored.push({ ...item, _id: lineId, ownerKey, weightKg: received, wastageKg: waste, allocations });
      totalReceivedKg = weight(totalReceivedKg + received);totalWastageKg = weight(totalWastageKg + waste);totalRolls += item.rollsCount;
    }
    const [receipt] = await KnittingReceipt.create([{ _id: receiptId, receiptReferenceKey: String(party._id) + ':' + input.gatePassNo.trim().toUpperCase(), receiptNo: await nextDocumentNo('KR', session), productionType: input.productionType, partyId: party._id, gatePassNo: input.gatePassNo, date, ...referenceFields(input), remarks: input.remarks, actorId: businessContext.getStore()!.actorId, items: stored }], { session });
    if (gaps.length) await Reconciliation.insertMany(gaps, { session });
    const remainingIssues = await YarnTransaction.find({ partyId: party._id, transactionType: 'OUTWARD_TO_KNITTER' }).session(session);
    return { receipt: receipt.toObject(), reconciledKg: totalReceivedKg, totalReceivedKg, totalRolls, totalWastageKg, itemsCount: stored.length, remainingYarnInFieldKg: weight(remainingIssues.reduce((sum, issue) => sum + issue.remainingYarnBalanceKg, 0)) };
}

export async function reverseYarnDelivery(id: string, input: { reason: string; requestId?: string; shortageReason?: string }) {
  return postCommand('REVERSE_YARN_DELIVERY', { ...input, id }, async session => {
    const transaction = await YarnTransaction.findOne({ _id: id, status: { $ne: 'REVERSED' } }).session(session);
    if (!transaction) throw new NotFoundError('Posted yarn movement not found.');
    if (await KnittingReceipt.exists({ status: 'POSTED', 'items.allocations.transactionId': transaction._id }).session(session) || transaction.returnedPackages || (transaction.transactionType === 'OUTWARD_TO_KNITTER' && transaction.remainingYarnBalanceKg !== transaction.grossWeightKg)) throw new BadRequestError('This yarn issue has fabric receipts or yarn returns. Reverse those source documents first.');
    const sign = transaction.transactionType === 'OUTWARD_TO_KNITTER' ? 1 : -1;
    await moveYarn({ yarnSpec: transaction.yarnSpec, ownerKey: transaction.ownerKey, packageUnit: transaction.packageUnit,
      sourceId: transaction._id as Types.ObjectId, partyId: transaction.partyId, date: new Date(), reason: `Yarn delivery reversed: ${input.reason}` },
    { quantity: sign * transaction.boxCount, weightKg: sign * transaction.grossWeightKg }, session,
    'This yarn has already been used. Reverse later movements first.');
    transaction.status = 'REVERSED';transaction.remainingYarnBalanceKg = 0;transaction.remarks = `${transaction.remarks || ''} | ${input.reason}`;await transaction.save({ session });
    return transaction.toObject();
  });
}
