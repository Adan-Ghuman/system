import { canonicalOwnerKey } from './ownership.js';
import { rememberFabricNames } from './catalog-names.js';
import { Types, ClientSession } from 'mongoose';
import { Party } from '../models/Party.js';
import { YarnTransaction } from '../models/YarnTransaction.js';
import { FabricInventory } from '../models/FabricInventory.js';
import { YarnInventory, KnittingReceipt, StockMovement } from './records.js';
import { businessContext } from './context.js';
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
  const [party] = await Party.create([{ name: value.trim(), code: await nextDocumentNo('PARTY', session), tags: { isKnitter, isYarnClient: !isKnitter }, openingBalance: 0, currentBalance: 0 }], { session });
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
      const stockMatch = { yarnSpec: item.yarnSpec, ownerKey, packageUnit: item.packageUnit };
      if (outward) {
        const stock = await YarnInventory.findOneAndUpdate({ ...stockMatch, totalWeightKg: { $gte: actual }, quantity: { $gte: item.boxCount } }, { $inc: { totalWeightKg: -actual, quantity: -item.boxCount } }, { new: true, session });
        if (!stock) throw new BadRequestError(`Not enough ${item.yarnSpec} yarn in stock. Add yarn or record its receipt first, and check the package count and owner.`);
      } else {
        await YarnInventory.findOneAndUpdate(stockMatch, { $inc: { totalWeightKg: actual, quantity: item.boxCount }, $setOnInsert: stockMatch }, { upsert: true, new: true, session });
      }
      const [transaction] = await YarnTransaction.create([{
        transactionType: input.transactionType, partyId: party._id, yarnSpec: item.yarnSpec, gatePassNo: input.gatePassNo, date,
        boxCount: item.boxCount, netWeightPerBox: actual / item.boxCount, totalWeightKg: actual, packageUnit: item.packageUnit, ownerKey,
        grossWeightKg: actual, wastagePercent: 0, wastageWeightKg: 0, netExpectedFabricKg: actual, receivedFabricKg: 0,
        actualWastageKg: 0, remainingYarnBalanceKg: outward ? actual : 0, ...referenceFields(input), remarks: [item.remarks, input.remarks].filter(Boolean).join(' | ')
      }], { session });
      await StockMovement.create([{ sourceId: transaction._id, material: 'YARN', item: item.yarnSpec, weightKg: outward ? -actual : actual, quantity: outward ? -item.boxCount : item.boxCount, location: 'ZR_GODOWN', date, reason: outward ? `Issued to ${party.name}` : `Received from ${party.name}`, actorId: businessContext.getStore()!.actorId }], { session });
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
  return postCommand('KNITTING_RECEIPT', input, async session => {
    if (!input.gatePassNo?.trim()) throw new BadRequestError('Enter the receipt challan number.');
    const party = await resolveParty(input.partyId, true, session);
    const date = new Date(input.date);
    const items = input.items || [{ fabricType: input.fabricType || '', yarnSpec: input.yarnSpec || '', rollsCount: input.rollsCount || 0, weightKg: input.weightKg || 0, wastageKg: input.wastageKg, remarks: input.remarks }];
    const stored = [];
    let totalReceivedKg = 0, totalRolls = 0, totalWastageKg = 0;
    for (const item of items) {
      if (item.wastageKg === undefined) throw new BadRequestError('Enter actual wastage in kg for each fabric, including 0 if there was none.');
      const received = weight(item.weightKg), waste = weight(item.wastageKg);
      let remaining = weight(received + waste);
      const allocations: Array<{ transactionId: string; weightKg: number; fabricKg: number; wastageKg: number }> = [];
      const components = 'components' in item && item.components?.length ? item.components : [{ yarnSpec: item.yarnSpec, weightKg: remaining }];
      if (item.yarnSpec.includes('+') && !('components' in item && item.components?.length)) throw new BadRequestError('For blended fabric, enter the actual kg consumed from each yarn component.');
      if (Math.abs(weight(components.reduce((sum, component) => sum + component.weightKg, 0)) - remaining) > 0.000001) throw new BadRequestError('Component kg must equal fabric kg plus actual wastage kg.');
      const ownerKeys = new Set<string>();
      let fabricLeft = received;
      for (const component of components) {
      let needed = weight(component.weightKg);
      const issues = await YarnTransaction.find({ partyId: party._id, ownerKey: input.ownerKey, yarnSpec: component.yarnSpec, status: { $ne: 'REVERSED' }, transactionType: 'OUTWARD_TO_KNITTER', date: { $lte: date }, remainingYarnBalanceKg: { $gt: 0 } }).sort({ date: 1, _id: 1 }).session(session);
      for (const issue of issues) {
        if (!needed) break;
        const consumed = Math.min(needed, issue.remainingYarnBalanceKg);
        ownerKeys.add(issue.ownerKey || 'OWN');
        const fabricKg = Math.min(fabricLeft, consumed), wastageKg = weight(consumed - fabricKg);
        issue.receivedFabricKg = weight(issue.receivedFabricKg + fabricKg);
        issue.actualWastageKg = weight((issue.actualWastageKg || 0) + wastageKg);
        issue.remainingYarnBalanceKg = weight(issue.remainingYarnBalanceKg - consumed);
        await issue.save({ session });
        allocations.push({ transactionId: String(issue._id), weightKg: consumed, fabricKg, wastageKg });
        remaining = weight(remaining - consumed);needed = weight(needed - consumed);fabricLeft = weight(fabricLeft - fabricKg);
      }
      if (needed > 0) throw new BadRequestError(`${component.yarnSpec}: not enough eligible yarn at this knitter on the receipt date.`);
      }
      if (remaining > 0) throw new BadRequestError(`${item.yarnSpec}: fabric plus wastage exceeds eligible yarn by ${remaining} kg. Check the knitter, yarn count and date; future issues cannot be used.`);
      const owners = [...ownerKeys];
      if (owners.length !== 1) throw new BadRequestError('This receipt mixes yarn owners. Record a separate receipt for each owner.');
      await rememberFabricNames([item], session);
      const stockMatch = { fabricType: item.fabricType, yarnSpec: item.yarnSpec, state: 'RAW_ECRU', color: 'ECRU', location: 'ZR_GODOWN', ownerKey: owners[0] };
      await FabricInventory.findOneAndUpdate(stockMatch, { $setOnInsert: stockMatch, $inc: { totalRolls: item.rollsCount, totalWeightKg: received } }, { upsert: true, session });
      stored.push({ ...item, weightKg: received, wastageKg: waste, allocations });
      totalReceivedKg = weight(totalReceivedKg + received);totalWastageKg = weight(totalWastageKg + waste);totalRolls += item.rollsCount;
    }
    const [receipt] = await KnittingReceipt.create([{ receiptNo: await nextDocumentNo('KR', session), partyId: party._id, gatePassNo: input.gatePassNo, date, ...referenceFields(input), remarks: input.remarks, actorId: businessContext.getStore()!.actorId, items: stored }], { session });
    for (const item of stored) await StockMovement.create([{ sourceId: receipt._id, material: 'FABRIC', item: `${item.fabricType} / ${item.yarnSpec}`, weightKg: item.weightKg, quantity: item.rollsCount, location: 'ZR_GODOWN', date, reason: 'Knitted fabric received', actorId: businessContext.getStore()!.actorId }], { session });
    const remainingIssues = await YarnTransaction.find({ partyId: party._id, transactionType: 'OUTWARD_TO_KNITTER' }).session(session);
    return { receipt: receipt.toObject(), reconciledKg: totalReceivedKg, totalReceivedKg, totalRolls, totalWastageKg, itemsCount: stored.length, remainingYarnInFieldKg: weight(remainingIssues.reduce((sum, issue) => sum + issue.remainingYarnBalanceKg, 0)) };
  });
}

export async function reverseYarnDelivery(id: string, input: { reason: string; requestId?: string }) {
  return postCommand('REVERSE_YARN_DELIVERY', { ...input, id }, async session => {
    const transaction = await YarnTransaction.findOne({ _id: id, status: { $ne: 'REVERSED' } }).session(session);
    if (!transaction) throw new NotFoundError('Posted yarn movement not found.');
    if (await KnittingReceipt.exists({ status: 'POSTED', 'items.allocations.transactionId': transaction._id }).session(session) || transaction.returnedPackages || (transaction.transactionType === 'OUTWARD_TO_KNITTER' && transaction.remainingYarnBalanceKg !== transaction.grossWeightKg)) throw new BadRequestError('This yarn issue has fabric receipts or yarn returns. Reverse those source documents first.');
    const sign = transaction.transactionType === 'OUTWARD_TO_KNITTER' ? 1 : -1;
    const match = { yarnSpec: transaction.yarnSpec, ownerKey: transaction.ownerKey, packageUnit: transaction.packageUnit };
    const stock = await YarnInventory.findOne(match).session(session);
    if (!stock || weight(stock.totalWeightKg + sign * transaction.grossWeightKg) < 0 || stock.quantity + sign * transaction.boxCount < 0) throw new BadRequestError('This received yarn has already been used. Reverse later movements first.');
    stock.totalWeightKg = weight(stock.totalWeightKg + sign * transaction.grossWeightKg);stock.quantity += sign * transaction.boxCount;await stock.save({ session });
    transaction.status = 'REVERSED';transaction.remainingYarnBalanceKg = 0;transaction.remarks = `${transaction.remarks || ''} | ${input.reason}`;await transaction.save({ session });
    await StockMovement.create([{ sourceId: transaction._id, material: 'YARN', item: transaction.yarnSpec, quantity: sign * transaction.boxCount, weightKg: sign * transaction.grossWeightKg, location: 'ZR_GODOWN', date: new Date(), reason: `Yarn delivery reversed: ${input.reason}`, actorId: businessContext.getStore()!.actorId }], { session });return transaction.toObject();
  });
}
