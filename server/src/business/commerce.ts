import { ClientSession, Types } from 'mongoose';
import { BusinessDocument, BillAllocation, BillPayment } from './commerce.models.js';
import { OperationInput, operationInput } from './commerce.schema.js';
import { YarnInventory, StockMovement, KnittingReceipt, DyeingReceipt } from './records.js';
import { YarnTransaction } from '../models/YarnTransaction.js';
import { Dispatch } from '../models/Dispatch.js';
import { Party } from '../models/Party.js';
import { PaymentVoucher } from '../models/PaymentVoucher.js';
import { businessContext } from './context.js';
import { postCommand, nextDocumentNo, money, weight } from './posting.js';
import { postPartyAmount } from './finance.js';
import { moveFabric, validateLocation } from './stock.js';
import { referenceFields } from './references.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export function billTotals(input: Pick<OperationInput, 'items' | 'taxPercent'>) {
  const baseAmount = money(input.items.reduce((sum, item) => sum + money((item.basis === 'KG' ? item.weightKg : item.basis === 'ROLL' ? item.rolls : 1) * item.rate), 0));
  const taxAmount = money(baseAmount * input.taxPercent / 100);
  return { baseAmount, taxPercent: input.taxPercent, taxAmount, total: money(baseAmount + taxAmount) };
}

export async function getChargeSource(kind: string, id: string, session?: ClientSession) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Source document not found.');
  if (kind === 'CUSTOMER_BILL') {
    const source = await Dispatch.findOne({ _id: id, status: 'POSTED' }).session(session || null);
    if (!source) throw new NotFoundError('Posted delivery not found.');
    return { source, partyId: source.customerId, items: [{ id: String(source._id), fabricType: source.fabricType, yarnSpec: source.yarnSpec, weightKg: source.totalNetWeightKg, rolls: source.totalRolls }] };
  }
  if (kind === 'KNITTING_CHARGE') {
    const source = await KnittingReceipt.findOne({ _id: id, status: 'POSTED' }).session(session || null);
    if (!source) throw new NotFoundError('Posted knitting receipt not found.');
    return { source, partyId: source.partyId, items: source.items.map(item => ({ id: String(item._id), fabricType: item.fabricType, yarnSpec: item.yarnSpec, weightKg: item.weightKg, rolls: item.rollsCount })) };
  }
  if (kind === 'DYEING_CHARGE') {
    const receipt = await DyeingReceipt.findOne({ _id: id, status: 'POSTED' }).session(session || null);
    if (receipt) return { source: receipt, partyId: receipt.partyId, items: receipt.items.map(item => ({ id: String(item._id), fabricType: item.fabricType || '', yarnSpec: item.yarnSpec || '', weightKg: item.weightKg || 0, rolls: item.rolls || 0 })) };
    throw new NotFoundError('Choose a posted dyeing receipt. The outgoing batch cannot be billed separately from its receipts.');
  }
  const source = await BusinessDocument.findOne({ _id: id, kind: 'FABRIC_RECEIPT', status: 'POSTED' }).session(session || null);
  if (!source) throw new NotFoundError('Fabric receipt not found.');
  return { source, partyId: source.partyId, items: source.items.map(item => ({ id: String(item._id), fabricType: item.fabricType, yarnSpec: item.yarnSpec, weightKg: item.weightKg, rolls: item.rolls })) };
}

async function allocateBill(input: OperationInput, billId: Types.ObjectId, session: ClientSession) {
  if (!input.sourceId) return;
  const { source, partyId, items } = await getChargeSource(input.kind, input.sourceId, session);
  if ((input.direction === 'PAYABLE' || input.kind === 'CUSTOMER_BILL') && String(partyId || '') !== input.partyId) throw new BadRequestError('This source belongs to a different party.');
  if ('date' in source && new Date(input.date) < source.date) throw new BadRequestError('The bill cannot be earlier than its source.');
  await source.updateOne({ $inc: { postingVersion: 1 } }, { session });
  for (const item of input.items) {
    const sourceItem = items.find(value => value.id === item.sourceLineId);
    if (!sourceItem) throw new BadRequestError('Choose the source line for every bill item.');
    const denominator = item.basis === 'KG' ? sourceItem.weightKg : item.basis === 'ROLL' ? sourceItem.rolls : 1;
    const numerator = item.basis === 'KG' ? item.weightKg : item.basis === 'ROLL' ? item.rolls : 1;
    const fraction = numerator / denominator;
    const previous = await BillAllocation.find({ sourceId: source._id, sourceLineId: item.sourceLineId, direction: input.direction }).session(session);
    if (!(fraction > 0) || fraction + previous.reduce((sum, value) => sum + value.fraction, 0) > 1.0000001) throw new BadRequestError('The quantity exceeds the unbilled work on this source line.');
    await BillAllocation.create([{ sourceId: source._id, sourceLineId: item.sourceLineId, direction: input.direction, billId, fraction }], { session });
  }
}

export async function submitOperation(input: OperationInput, draftId?: string) {
  return postCommand(input.kind, { ...input, draftId }, async session => {
    await validateLocation(input.location, session);
    const isStock = ['FABRIC_RECEIPT', 'FABRIC_PURCHASE'].includes(input.kind);
    const isYarn = ['YARN_ADJUSTMENT', 'YARN_RETURN'].includes(input.kind);
    if (!isYarn && (!input.partyId || !await Party.findById(input.partyId).session(session))) throw new BadRequestError('Choose a party in the active business.');
    if (input.kind === 'SUPPLIER_BILL' && !input.sourceId) throw new BadRequestError('Choose the fabric receipt to bill.');
    if (input.kind === 'CUSTOMER_BILL' && !input.sourceId) throw new BadRequestError('Choose the delivery to bill. A bill never moves stock a second time.');
    if (['KNITTING_CHARGE', 'DYEING_CHARGE'].includes(input.kind) && !input.sourceId) throw new BadRequestError('Choose the completed work this charge belongs to.');
    if (input.sourceId && ['SUPPLIER_BILL', 'CUSTOMER_BILL', 'KNITTING_CHARGE', 'DYEING_CHARGE'].includes(input.kind)) {
      const source = await getChargeSource(input.kind, input.sourceId, session);
      for (const item of input.items) { const line = source.items.find(value => value.id === item.sourceLineId);if (!line) throw new BadRequestError('Choose the original source line for each bill item.');item.fabricType = line.fabricType;item.yarnSpec = line.yarnSpec; }
    }
    if (input.items.some(item => !isYarn && ((item.basis === 'KG' && item.weightKg <= 0) || (item.basis === 'ROLL' && item.rolls <= 0)))) throw new BadRequestError('Bill quantities must be positive.');
    const hasBill = !['FABRIC_RECEIPT', 'YARN_ADJUSTMENT', 'YARN_RETURN'].includes(input.kind);
    const totals = hasBill ? billTotals(input) : { baseAmount: 0, taxPercent: 0, taxAmount: 0, total: 0 };
    if (hasBill && totals.total <= 0) throw new BadRequestError('Enter a positive rate for the bill.');
    const direction = ['FABRIC_PURCHASE', 'SUPPLIER_BILL'].includes(input.kind) ? 'PAYABLE' : input.kind === 'CUSTOMER_BILL' ? 'RECEIVABLE' : input.direction;
    const id = draftId ? new Types.ObjectId(draftId) : new Types.ObjectId();
    if (draftId && !await BusinessDocument.findOne({ _id: id, status: 'DRAFT' }).session(session)) throw new BadRequestError('This draft has already been posted or removed.');
    const number = await nextDocumentNo(isYarn ? 'YARN' : isStock ? 'GR' : direction === 'PAYABLE' ? 'PB' : 'INV', session);
    const values = { ...input, ...referenceFields(input), ...totals, direction, number, date: new Date(input.date), partyId: input.partyId || undefined, sourceId: input.sourceId || undefined, actorId: businessContext.getStore()!.actorId, status: 'POSTED' as const, draft: undefined };
    let document;
    if (draftId) { const { draft: _draft, ...postedValues } = values;document = await BusinessDocument.findOneAndUpdate({ _id: id, status: 'DRAFT' }, { $set: postedValues, $unset: { draft: 1 } }, { new: true, session }); }
    else { [document] = await BusinessDocument.create([{ _id: id, ...values }], { session }); }
    if (!document) throw new BadRequestError('The document could not be posted.');
    if (isStock) for (const item of input.items) {
      if (item.ownerKey !== 'OWN') throw new BadRequestError('Purchased fabric belongs to this business.');
      await moveFabric(item, input.location, 1, id, values.date, 'Fabric purchase received', session);
    }
    if (isYarn) {
      if (!input.remarks.trim()) throw new BadRequestError('Explain why the yarn quantity is changing.');
      for (const item of input.items) {
        if (!item.yarnSpec || (!item.weightKg && !item.rolls)) throw new BadRequestError('Enter the yarn name and the signed quantity or weight change.');
        if (item.ownerKey !== 'OWN' && !await Party.findById(item.ownerKey).session(session)) throw new BadRequestError('Choose a yarn owner in this business.');
        let deltaWeight = weight(item.weightKg), deltaQuantity = item.rolls;
        if (input.kind === 'YARN_RETURN') {
          if (!input.sourceId || deltaWeight <= 0 || deltaQuantity < 0) throw new BadRequestError('Choose the yarn issue and enter positive returned kg.');
          const issue = await YarnTransaction.findOne({ _id: input.sourceId, yarnSpec: item.yarnSpec, transactionType: 'OUTWARD_TO_KNITTER', remainingYarnBalanceKg: { $gte: deltaWeight } }).session(session);
          if (!issue) throw new BadRequestError('Returned weight exceeds unused yarn at this knitter.');
          if (item.packageUnit !== issue.packageUnit) throw new BadRequestError('Returned yarn must use the original package unit.');
          if (deltaQuantity > issue.boxCount - (issue.returnedPackages || 0)) throw new BadRequestError('The return exceeds the original package count.');
          issue.returnedPackages = (issue.returnedPackages || 0) + deltaQuantity;
          issue.remainingYarnBalanceKg = weight(issue.remainingYarnBalanceKg - deltaWeight);await issue.save({ session });
          if (issue.ownerKey !== item.ownerKey) throw new BadRequestError('Returned yarn must retain its original owner.');
        }
        const match = { yarnSpec: item.yarnSpec, ownerKey: item.ownerKey, packageUnit: item.packageUnit };
        const stock = await YarnInventory.findOne(match).session(session);
        if ((stock?.totalWeightKg || 0) + deltaWeight < -0.000001 || (stock?.quantity || 0) + deltaQuantity < 0) throw new BadRequestError('The correction would make yarn stock negative.');
        await YarnInventory.findOneAndUpdate(match, { $inc: { totalWeightKg: deltaWeight, quantity: deltaQuantity }, $setOnInsert: match }, { upsert: true, session });
        await StockMovement.create([{ sourceId: id, material: 'YARN', item: item.yarnSpec, weightKg: deltaWeight, quantity: deltaQuantity, location: 'ZR_GODOWN', date: values.date, reason: input.remarks, actorId: values.actorId }], { session });
      }
    }
    if (hasBill) {
      await allocateBill({ ...input, direction }, id, session);
      await postPartyAmount(input.partyId, direction === 'PAYABLE' ? -totals.total : totals.total, id, number, values.date, `${input.kind.replaceAll('_', ' ')} ${input.reference}`, session);
    }
    return document.toObject();
  });
}

export async function saveDraft(body: unknown) {
  const raw = body as Record<string, unknown>;
  const kind = String(raw.kind || 'FABRIC_RECEIPT');
  return postCommand('SAVE_DRAFT', { requestId: typeof raw.requestId === 'string' ? raw.requestId + ':draft' : undefined, body }, async session => {
    const [document] = await BusinessDocument.create([{ number: `DRAFT-${new Types.ObjectId()}`, kind, partyId: Types.ObjectId.isValid(String(raw.partyId)) ? raw.partyId : undefined, reference: String(raw.reference || ''), ...referenceFields(raw), date: Number.isFinite(new Date(String(raw.date)).valueOf()) ? new Date(String(raw.date)) : new Date(), status: 'DRAFT', actorId: businessContext.getStore()!.actorId, draft: body }], { session });
    return document;
  });
}

export async function payBill(id: string, input: { amount: number; date: string; reference?: string; requestId?: string; refund?: boolean }) {
  return postCommand('BILL_PAYMENT', { ...input, billId: id }, async session => {
    const bill = await BusinessDocument.findOne({ _id: id, status: 'POSTED' }).session(session);
    if (!bill || !bill.partyId || bill.total <= 0) throw new NotFoundError('Posted bill not found.');
    if (bill.intercompanyId) throw new BadRequestError('Use the linked inter-company settlement so both businesses are updated.');
    if (bill.kind === 'CREDIT_NOTE') throw new BadRequestError('Record a refund against the original bill.');
    if (new Date(input.date) < bill.date) throw new BadRequestError('The payment cannot be earlier than the bill.');
    const amount = money(input.amount) * (input.refund ? -1 : 1);
    if (!(input.amount >= 0.01) || (input.refund ? bill.paid <= bill.total - bill.credited || money(bill.paid + amount) < bill.total - bill.credited : money(bill.paid + amount) > bill.total - bill.credited)) throw new BadRequestError('The amount exceeds the bill’s outstanding payment or refund.');
    const number = await nextDocumentNo(bill.direction === 'PAYABLE' ? 'PAY' : 'RCPT', session);
    const payable = bill.direction === 'PAYABLE';
    const [voucher] = await PaymentVoucher.create([{ voucherNo: number, voucherType: input.refund ? payable ? 'RECEIPT' : 'PAYMENT' : payable ? 'PAYMENT' : 'RECEIPT', paymentMode: 'CASH', partyId: bill.partyId, amount: Math.abs(amount), date: new Date(input.date), remarks: input.reference || '' }], { session });
    await postPartyAmount(bill.partyId, payable ? amount : -amount, voucher._id, number, new Date(input.date), `${input.refund ? 'Refund' : 'Payment'} against ${bill.number}`, session);
    bill.paid = money(bill.paid + amount);await bill.save({ session });
    const [payment] = await BillPayment.create([{ billId: bill._id, voucherId: voucher._id, amount, date: new Date(input.date), reference: input.reference }], { session });
    return payment.toObject();
  });
}

export async function reverseOperation(id: string, input: { requestId?: string; reason: string }) {
  return postCommand('REVERSE_DOCUMENT', { ...input, id } as typeof input, async session => {
    const document = await BusinessDocument.findOne({ _id: id, status: 'POSTED' }).session(session);
    if (!document) throw new NotFoundError('Posted document not found.');
    if (document.intercompanyId) throw new BadRequestError('Reverse this from its linked inter-company transaction.');
    if (document.paid) throw new BadRequestError('Reverse the recorded payments before reversing this bill.');
    if (document.credited) throw new BadRequestError('Reverse its credit notes before reversing the bill.');
    if (document.kind === 'CREDIT_NOTE') {
      const original = await BusinessDocument.findById(document.sourceId).session(session);if (!original?.partyId) throw new BadRequestError('Original bill not found.');
      if (original.paid > money(original.total - original.credited)) throw new BadRequestError('Record or reverse the outstanding refund first.');
      if (['FABRIC_PURCHASE', 'SUPPLIER_BILL', 'CUSTOMER_BILL'].includes(original.kind)) for (const item of document.items) await moveFabric(item.toObject(), document.location, original.direction === 'PAYABLE' ? 1 : -1, document._id, new Date(), input.reason, session);
      original.credited = money(original.credited - document.total);await original.save({ session });
    }
    if (['YARN_ADJUSTMENT', 'YARN_RETURN'].includes(document.kind)) {
      for (const item of document.items) {
        const match = { yarnSpec: item.yarnSpec, ownerKey: item.ownerKey, packageUnit: item.packageUnit };
        const stock = await YarnInventory.findOne(match).session(session);
        if (!stock || weight(stock.totalWeightKg - item.weightKg) < 0 || stock.quantity - item.rolls < 0) throw new BadRequestError('This yarn has already been used. Reverse later movements first.');
        stock.totalWeightKg = weight(stock.totalWeightKg - item.weightKg);stock.quantity -= item.rolls;await stock.save({ session });
        if (document.kind === 'YARN_RETURN') {
          const issue = await YarnTransaction.findById(document.sourceId).session(session);if (!issue) throw new BadRequestError('Original yarn issue is missing.');
          issue.returnedPackages = (issue.returnedPackages || 0) - item.rolls;issue.remainingYarnBalanceKg = weight(issue.remainingYarnBalanceKg + item.weightKg);await issue.save({ session });
        }
        await StockMovement.create([{ sourceId: document._id, material: 'YARN', item: item.yarnSpec, weightKg: -item.weightKg, quantity: -item.rolls, location: 'ZR_GODOWN', date: new Date(), reason: `Reversal: ${input.reason}`, actorId: businessContext.getStore()!.actorId }], { session });
      }
    }
    if (['FABRIC_RECEIPT', 'FABRIC_PURCHASE'].includes(document.kind)) for (const item of document.items) await moveFabric({ ...item.toObject(), ownerKey: item.ownerKey || 'OWN' }, document.location, -1, document._id, new Date(), input.reason, session);
    const allocations = await BillAllocation.find({ sourceId: document._id }).session(session);
    if (allocations.length) throw new BadRequestError('Reverse the linked supplier bill first.');
    if (document.total && document.partyId) await postPartyAmount(document.partyId, document.direction === 'PAYABLE' ? document.total : -document.total, document._id, document.number, new Date(), `Reversal: ${input.reason}`, session);
    await BillAllocation.deleteMany({ billId: document._id }).session(session);
    document.status = 'REVERSED';document.remarks += ` | Reversed: ${input.reason}`;await document.save({ session });
    return document.toObject();
  });
}

export async function postDraft(id: string) {
  const draft = await BusinessDocument.findOne({ _id: id, status: 'DRAFT' });
  if (!draft) throw new NotFoundError('Draft not found.');
  return submitOperation(operationInput.parse(draft.draft), id);
}
