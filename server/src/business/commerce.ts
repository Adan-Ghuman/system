import { canonicalOwnerKey } from './ownership.js';
import { customerSources } from './sales-sources.js';
import { ClientSession, Types } from 'mongoose';
import { BusinessDocument, BillAllocation, BillPayment } from './commerce.models.js';
import { OperationInput, operationInput } from './commerce.schema.js';
import { YarnInventory, StockMovement, KnittingReceipt, DyeingReceipt } from './records.js';
import { YarnTransaction } from '../models/YarnTransaction.js';
import { Dispatch } from '../models/Dispatch.js';
import { Party } from '../models/Party.js';
import { PaymentMode } from '../models/PaymentVoucher.js';
import { PaymentVoucher } from '../models/PaymentVoucher.js';
import { businessContext } from './context.js';
import { postCommand, nextDocumentNo, money, weight } from './posting.js';
import { postPartyAmount } from './finance.js';
import { moveFabric, validateLocation, validateRawShade } from './stock.js';
import { referenceFields } from './references.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export function billTotals(input: Pick<OperationInput, 'items' | 'taxPercent'> & { additionalCharges?: OperationInput['additionalCharges'] }) {
  const baseAmount = money(input.items.reduce((sum, item) => sum + money((item.basis === 'KG' ? item.weightKg : item.basis === 'ROLL' ? item.rolls : 1) * item.rate), 0));
  const charges = input.additionalCharges || [];
  const additionalAmount = money(charges.reduce((sum, charge) => sum + money(charge.amount), 0));
  const taxableAmount = money(baseAmount + charges.filter(charge => charge.taxable).reduce((sum, charge) => sum + money(charge.amount), 0));
  const taxAmount = money(taxableAmount * input.taxPercent / 100);
  return { baseAmount, taxPercent: input.taxPercent, taxAmount, total: money(baseAmount + additionalAmount + taxAmount) };
}

export async function getChargeSource(kind: string, id: string, session?: ClientSession) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Source document not found.');
  if (kind === 'CUSTOMER_BILL') {
    const source = await Dispatch.findOne({ _id: id, status: 'POSTED' }).session(session || null);
    if (!source) throw new NotFoundError('Posted delivery not found.');
    if (source.purpose === 'CLIENT_RETURN') throw new BadRequestError('A client-owned fabric return cannot be billed as a fabric sale.');
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
  const source = await BusinessDocument.findOne({ _id: id, kind: kind === 'YARN_SUPPLIER_BILL' ? 'YARN_RECEIPT' : 'FABRIC_RECEIPT', status: 'POSTED' }).session(session || null);
  if (!source) throw new NotFoundError(kind === 'YARN_SUPPLIER_BILL' ? 'Purchased yarn receipt not found.' : 'Fabric receipt not found.');
  return { source, partyId: source.partyId, items: source.items.map(item => ({ id: String(item._id), fabricType: item.fabricType, yarnSpec: item.yarnSpec, weightKg: item.weightKg, rolls: item.rolls })) };
}

async function allocateBill(input: OperationInput, billId: Types.ObjectId, session: ClientSession) {
  const groups = new Set(input.items.map(item => item.sourceId || input.sourceId).filter(Boolean));
  for (const sourceId of groups) await allocateSource({ ...input, sourceId, items: input.items.filter(item => (item.sourceId || input.sourceId) === sourceId) }, billId, session);
}

async function allocateSource(input: OperationInput, billId: Types.ObjectId, session: ClientSession) {
  if (!input.sourceId) return;
  const { source, partyId, items } = await getChargeSource(input.kind, input.sourceId, session);
  if ((input.direction === 'PAYABLE' || input.kind === 'CUSTOMER_BILL') && String(partyId || '') !== input.partyId) throw new BadRequestError('This source belongs to a different party.');
  if (input.direction === 'RECEIVABLE' && ['KNITTING_CHARGE', 'DYEING_CHARGE'].includes(input.kind)) {
    const eligible = await customerSources(input.kind, input.partyId || '', session);
    const match = eligible.items.find(item => item._id === input.sourceId);
    if (!match || input.items.some(item => !match.items.some(line => line.sourceLineId === item.sourceLineId))) throw new BadRequestError('This completed work is not assigned to the billed customer.');
  }
  if (input.kind === 'KNITTING_CHARGE' && input.direction === 'PAYABLE' && 'productionType' in source && source.productionType === 'IN_HOUSE') throw new BadRequestError('In-house production cannot create an external knitting payable.');
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

export interface PaperServiceEvidence { reference: string; reason: string; confirmedBy: string; confirmedAt: Date; periodFrom?: Date; periodTo?: Date; }

export async function submitOperation(input: OperationInput, draftId?: string) {
  return postCommand(input.kind, { ...input, draftId }, session => submitOperationInSession(input, session, draftId));
}

export async function submitOperationInSession(input: OperationInput, session: ClientSession, draftId?: string, paperService?: PaperServiceEvidence) {
    await validateLocation(input.location, session);
    const isStock = ['FABRIC_RECEIPT', 'FABRIC_PURCHASE'].includes(input.kind);
    const isYarn = ['YARN_ADJUSTMENT', 'YARN_RETURN', 'YARN_RECEIPT', 'YARN_PURCHASE', 'YARN_CLIENT_RETURN'].includes(input.kind);
    if ((!isYarn || ['YARN_RECEIPT', 'YARN_PURCHASE', 'YARN_CLIENT_RETURN'].includes(input.kind)) && (!input.partyId || !await Party.findById(input.partyId).session(session))) throw new BadRequestError('Choose a party in the active business.');
    if (['SUPPLIER_BILL', 'YARN_SUPPLIER_BILL'].includes(input.kind) && !paperService && !input.sourceId && !input.items.every(item => item.sourceId)) throw new BadRequestError(input.kind === 'YARN_SUPPLIER_BILL' ? 'Choose the purchased yarn receipts to bill.' : 'Choose the fabric receipts to bill.');
    if (input.kind === 'CUSTOMER_BILL' && !input.sourceId && !input.items.every(item => item.sourceId)) throw new BadRequestError('Choose the delivery to bill. A bill never moves stock a second time.');
    if (['KNITTING_CHARGE', 'DYEING_CHARGE'].includes(input.kind) && !input.sourceId && !input.items.every(item => item.sourceId) && !paperService) throw new BadRequestError('Choose the completed work this charge belongs to.');
    if (['SUPPLIER_BILL', 'YARN_SUPPLIER_BILL', 'CUSTOMER_BILL', 'KNITTING_CHARGE', 'DYEING_CHARGE'].includes(input.kind)) {
      for (const item of input.items) {
        const sourceId = item.sourceId || input.sourceId;if (!sourceId) continue;
        const source = await getChargeSource(input.kind, sourceId, session);
        const line = source.items.find(value => value.id === item.sourceLineId);if (!line) throw new BadRequestError('Choose the original receipt line for each bill item.');item.fabricType = line.fabricType;item.yarnSpec = line.yarnSpec;
        const saved = source.source.toObject() as { location?: string; fromLocation?: string; ownerKey?: string; state?: 'RAW_ECRU' | 'FINISHED_DYED'; color?: string; items?: Array<{ _id: unknown; ownerKey?: string; state?: 'RAW_ECRU' | 'FINISHED_DYED'; color?: string }> };
        const detail = saved.items?.find(value => String(value._id) === item.sourceLineId);item.sourceLocation = saved.fromLocation || saved.location || 'ZR_GODOWN';item.ownerKey = canonicalOwnerKey(detail?.ownerKey || saved.ownerKey || 'OWN');item.state = detail?.state || saved.state || item.state;item.color = detail?.color || saved.color || item.color;
      }
    }
    if (input.items.some(item => !isYarn && ((item.basis === 'KG' && item.weightKg <= 0) || (item.basis === 'ROLL' && item.rolls <= 0)))) throw new BadRequestError('Bill quantities must be positive.');
    const hasBill = !['FABRIC_RECEIPT', 'YARN_ADJUSTMENT', 'YARN_RETURN', 'YARN_RECEIPT', 'YARN_CLIENT_RETURN'].includes(input.kind);
    if (!hasBill && input.additionalCharges.length) throw new BadRequestError('Additional charges belong on a bill.');
    const totals = hasBill ? billTotals(input) : { baseAmount: 0, taxPercent: 0, taxAmount: 0, total: 0 };
    if (hasBill && totals.total <= 0) throw new BadRequestError('Enter a positive rate for the bill.');
    const direction = ['FABRIC_PURCHASE', 'SUPPLIER_BILL', 'YARN_PURCHASE', 'YARN_SUPPLIER_BILL'].includes(input.kind) ? 'PAYABLE' : input.kind === 'CUSTOMER_BILL' ? 'RECEIVABLE' : input.direction;
    const id = draftId ? new Types.ObjectId(draftId) : new Types.ObjectId();
    if (draftId && !await BusinessDocument.findOne({ _id: id, status: 'DRAFT' }).session(session)) throw new BadRequestError('This draft has already been posted or removed.');
    const number = await nextDocumentNo(isYarn ? 'YARN' : isStock ? 'GR' : direction === 'PAYABLE' ? 'PB' : 'INV', session);
    const values = { ...input, ...referenceFields(input), ...totals, direction, number, date: new Date(input.date), partyId: input.partyId || undefined, sourceId: input.sourceId || undefined, actorId: businessContext.getStore()!.actorId, status: 'POSTED' as const, draft: undefined, ...(paperService ? { serviceEvidence: paperService } : {}) };
    let document;
    if (draftId) { const { draft: _draft, ...postedValues } = values;document = await BusinessDocument.findOneAndUpdate({ _id: id, status: 'DRAFT' }, { $set: postedValues, $unset: { draft: 1 } }, { new: true, session }); }
    else { [document] = await BusinessDocument.create([{ _id: id, ...values }], { session }); }
    if (!document) throw new BadRequestError('The document could not be posted.');
    if (isStock) for (const item of input.items) {
      validateRawShade(item);
      if (item.ownerKey !== 'OWN') throw new BadRequestError('Purchased fabric belongs to this business.');
      await moveFabric(item, input.location, 1, id, values.date, 'Fabric purchase received', session);
    }
    if (isYarn) {
      if (['YARN_ADJUSTMENT', 'YARN_RETURN'].includes(input.kind) && !input.remarks.trim()) throw new BadRequestError('Explain why the yarn quantity is changing.');
      for (const item of input.items) {
        if (!item.yarnSpec || (!item.weightKg && !item.rolls)) throw new BadRequestError('Enter the yarn name and the signed quantity or weight change.');
        if (item.ownerKey !== 'OWN' && !await Party.findById(item.ownerKey).session(session)) throw new BadRequestError('Choose a yarn owner in this business.');
        if (['YARN_RECEIPT', 'YARN_PURCHASE'].includes(input.kind) && (item.ownerKey !== 'OWN' || item.weightKg <= 0 || item.rolls < 1)) throw new BadRequestError('Purchased yarn needs positive packages and measured kg and belongs to this business.');
        if (input.kind === 'YARN_CLIENT_RETURN' && (item.ownerKey === 'OWN' || item.ownerKey !== input.partyId || item.weightKg <= 0 || item.rolls < 1)) throw new BadRequestError('Return positive packages and kg to the client who owns this yarn.');
        const sign = input.kind === 'YARN_CLIENT_RETURN' ? -1 : 1;
        let deltaWeight = weight(item.weightKg) * sign, deltaQuantity = item.rolls * sign;
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
        await StockMovement.create([{ sourceId: id, material: 'YARN', item: item.yarnSpec, weightKg: deltaWeight, quantity: deltaQuantity, location: 'ZR_GODOWN', date: values.date, ownerKey: item.ownerKey, packageUnit: item.packageUnit, partyId: input.partyId, reason: input.remarks || input.kind.replaceAll('_', ' '), actorId: values.actorId }], { session });
      }
    }
    if (hasBill) {
      await allocateBill({ ...input, direction }, id, session);
      await postPartyAmount(input.partyId, direction === 'PAYABLE' ? -totals.total : totals.total, id, number, values.date, `${input.kind.replaceAll('_', ' ')} ${input.reference}`, session);
    }
    return document.toObject();
}

export async function saveDraft(body: unknown) {
  const raw = body as Record<string, unknown>;
  const kind = String(raw.kind || 'FABRIC_RECEIPT');
  return postCommand('SAVE_DRAFT', { requestId: typeof raw.requestId === 'string' ? raw.requestId + ':draft' : undefined, body }, async session => {
    const [document] = await BusinessDocument.create([{ number: `DRAFT-${new Types.ObjectId()}`, kind, partyId: Types.ObjectId.isValid(String(raw.partyId)) ? raw.partyId : undefined, reference: String(raw.reference || ''), ...referenceFields(raw), date: Number.isFinite(new Date(String(raw.date)).valueOf()) ? new Date(String(raw.date)) : new Date(), status: 'DRAFT', actorId: businessContext.getStore()!.actorId, draft: body }], { session });
    return document;
  });
}

export interface BillPaymentInput { amount: number; date: string; reference?: string; requestId?: string; refund?: boolean; existingVoucherId?: string; paymentMode?: PaymentMode; bankName?: string; chequeNo?: string; chequeDate?: string; transactionRef?: string; }

export async function payBill(id: string, input: BillPaymentInput) {
  return postCommand('BILL_PAYMENT', { ...input, billId: id }, session => payBillInSession(id, input, session));
}

export async function payBillInSession(id: string, input: BillPaymentInput, session: ClientSession) {
    const bill = await BusinessDocument.findOne({ _id: id, status: 'POSTED' }).session(session);
    if (!bill || !bill.partyId || bill.total <= 0) throw new NotFoundError('Posted bill not found.');
    if (bill.settlementStatus === 'NOT_RECORDED') throw new BadRequestError('Payments and credits were not linked to this bill. Reconcile its settlement history before recording a payment or refund.');
    if (bill.intercompanyId) throw new BadRequestError('Use the linked inter-company settlement so both businesses are updated.');
    if (bill.kind === 'CREDIT_NOTE') throw new BadRequestError('Record a refund against the original bill.');
    if (input.existingVoucherId) {
      if (input.refund) throw new BadRequestError('Record refunds directly against this bill.');
      const voucher = await PaymentVoucher.findOne({ _id: input.existingVoucherId, partyId: bill.partyId, status: { $ne: 'REVERSED' }, voucherType: bill.direction === 'PAYABLE' ? 'PAYMENT' : 'RECEIPT' }).session(session);
      if (!voucher || money(voucher.amount) !== money(input.amount)) throw new BadRequestError('Choose an existing payment for this party and allocate its full amount.');
      if (await BillPayment.exists({ voucherId: voucher._id, status: 'POSTED' }).session(session)) throw new BadRequestError('This voucher is already allocated to a bill.');
      if (money(bill.paid + voucher.amount) > money(bill.total - bill.credited)) throw new BadRequestError('The voucher exceeds the bill’s outstanding balance.');
      await voucher.updateOne({ $inc: { __v: 1 } }, { session });
      bill.paid = money(bill.paid + voucher.amount);await bill.save({ session });
      const [allocation] = await BillPayment.create([{ billId: bill._id, voucherId: voucher._id, amount: voucher.amount, date: voucher.date, reference: input.reference || voucher.voucherNo, allocationOnly: true }], { session });
      return allocation.toObject();
    }
    if (new Date(input.date) < bill.date) throw new BadRequestError('The payment cannot be earlier than the bill.');
    const amount = money(input.amount) * (input.refund ? -1 : 1);
    if (!(input.amount >= 0.01) || (input.refund ? bill.paid <= bill.total - bill.credited || money(bill.paid + amount) < bill.total - bill.credited : money(bill.paid + amount) > bill.total - bill.credited)) throw new BadRequestError('The amount exceeds the bill’s outstanding payment or refund.');
    const number = await nextDocumentNo(bill.direction === 'PAYABLE' ? 'PAY' : 'RCPT', session);
    const payable = bill.direction === 'PAYABLE';
    const [voucher] = await PaymentVoucher.create([{ voucherNo: number, voucherType: input.refund ? payable ? 'RECEIPT' : 'PAYMENT' : payable ? 'PAYMENT' : 'RECEIPT', paymentMode: input.paymentMode || 'CASH', bankName: input.bankName, chequeNo: input.chequeNo, chequeDate: input.chequeDate ? new Date(input.chequeDate) : undefined, transactionRef: input.transactionRef, partyId: bill.partyId, amount: Math.abs(amount), date: new Date(input.date), remarks: input.reference || '' }], { session });
    await postPartyAmount(bill.partyId, payable ? amount : -amount, voucher._id, number, new Date(input.date), `${input.refund ? 'Refund' : 'Payment'} against ${bill.number}`, session, 'PAYMENT');
    bill.paid = money(bill.paid + amount);await bill.save({ session });
    const [payment] = await BillPayment.create([{ billId: bill._id, voucherId: voucher._id, amount, date: new Date(input.date), reference: input.reference }], { session });
    return payment.toObject();
}

export async function reverseOperation(id: string, input: { requestId?: string; reason: string }) {
  return postCommand('REVERSE_DOCUMENT', { ...input, id } as typeof input, async session => {
    const document = await BusinessDocument.findOne({ _id: id, status: 'POSTED' }).session(session);
    if (!document) throw new NotFoundError('Posted document not found.');
    if (document.settlementStatus === 'NOT_RECORDED') throw new BadRequestError('Reconcile the payment history before reversing this bill.');
    if (document.intercompanyId) throw new BadRequestError('Reverse this from its linked inter-company transaction.');
    if (document.paid) throw new BadRequestError('Reverse the recorded payments before reversing this bill.');
    if (document.credited) throw new BadRequestError('Reverse its credit notes before reversing the bill.');
    if (document.kind === 'CREDIT_NOTE') {
      const original = await BusinessDocument.findById(document.sourceId).session(session);if (!original?.partyId) throw new BadRequestError('Original bill not found.');
      if (original.paid > money(original.total - original.credited)) throw new BadRequestError('Record or reverse the outstanding refund first.');
      if (!document.financialOnly && ['FABRIC_PURCHASE', 'SUPPLIER_BILL', 'CUSTOMER_BILL'].includes(original.kind)) for (const item of document.items) await moveFabric(item.toObject(), document.returnLocationsRecorded ? item.sourceLocation || document.location : document.location, original.direction === 'PAYABLE' ? 1 : -1, document._id, new Date(), input.reason, session);
      original.credited = money(original.credited - document.total);await original.save({ session });
    }
    if (['YARN_ADJUSTMENT', 'YARN_RETURN', 'YARN_RECEIPT', 'YARN_PURCHASE', 'YARN_CLIENT_RETURN'].includes(document.kind)) {
      for (const item of document.items) {
        const match = { yarnSpec: item.yarnSpec, ownerKey: item.ownerKey, packageUnit: item.packageUnit };
        const stock = await YarnInventory.findOne(match).session(session);
        const delta = document.kind === 'YARN_CLIENT_RETURN' ? -1 : 1;
        if (!stock || weight(stock.totalWeightKg - delta * item.weightKg) < 0 || stock.quantity - delta * item.rolls < 0) throw new BadRequestError('This yarn has already been used. Reverse later movements first.');
        stock.totalWeightKg = weight(stock.totalWeightKg - delta * item.weightKg);stock.quantity -= delta * item.rolls;await stock.save({ session });
        if (document.kind === 'YARN_RETURN') {
          const issue = await YarnTransaction.findById(document.sourceId).session(session);if (!issue) throw new BadRequestError('Original yarn issue is missing.');
          issue.returnedPackages = (issue.returnedPackages || 0) - item.rolls;issue.remainingYarnBalanceKg = weight(issue.remainingYarnBalanceKg + item.weightKg);await issue.save({ session });
        }
        await StockMovement.create([{ sourceId: document._id, material: 'YARN', item: item.yarnSpec, weightKg: -delta * item.weightKg, quantity: -delta * item.rolls, ownerKey: item.ownerKey, packageUnit: item.packageUnit, partyId: document.partyId, location: 'ZR_GODOWN', date: new Date(), reason: `Reversal: ${input.reason}`, actorId: businessContext.getStore()!.actorId }], { session });
      }
    }
    if (['FABRIC_RECEIPT', 'FABRIC_PURCHASE'].includes(document.kind)) for (const item of document.items) await moveFabric({ ...item.toObject(), ownerKey: item.ownerKey || 'OWN' }, document.location, -1, document._id, new Date(), input.reason, session);
    const allocations = await BillAllocation.find({ sourceId: document._id }).session(session);
    if (allocations.length) throw new BadRequestError('Reverse the linked supplier bill first.');
    if (document.total && document.partyId) await postPartyAmount(document.partyId, document.direction === 'PAYABLE' ? document.total : -document.total, document._id, document.number, new Date(), `Reversal: ${input.reason}`, session, 'ADJUSTMENT');
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
