import { ClientSession, Types } from 'mongoose';
import { PurchaseInput, purchaseKinds } from './purchases.schema.js';
import { BusinessDocument, BillAllocation, BillPayment } from './commerce.models.js';
import { KnittingReceipt, DyeingReceipt } from './records.js';
import { Party } from '../models/Party.js';
import { YarnTransaction } from '../models/YarnTransaction.js';
import { DyeingUnit } from '../models/DyeingUnit.js';
import { DyeingBatch } from '../models/DyeingBatch.js';
import { PaymentVoucher } from '../models/PaymentVoucher.js';
import { billTotals, submitOperationInSession, payBillInSession } from './commerce.js';
import { operationInput } from './commerce.schema.js';
import { postKnittingReceiptInSession } from './knitting.js';
import { postDyeingReceiptInSession } from './dyeing.js';
import { receiveFabricSchema } from '../modules/knitting/knitting.schema.js';
import { receiveGatePassSchema } from '../modules/dyeing/dyeing.schema.js';
import { postCommand, nextDocumentNo, money, weight } from './posting.js';
import { businessContext } from './context.js';
import { canonicalOwnerKey } from './ownership.js';
import { moveFabric, validateLocation, validateRawShade } from './stock.js';
import { referenceFields } from './references.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { escapeRegex } from '../utils/search.js';

export async function supplierSources(mode: string, partyId: string, session?: ClientSession) {
  if (!Types.ObjectId.isValid(partyId) || !['YARN', 'FABRIC', 'KNITTING', 'DYEING'].includes(mode)) throw new BadRequestError('Choose a supplier and transaction type.');
  const rows = mode === 'KNITTING' ? await KnittingReceipt.find({ partyId, status: 'POSTED', productionType: { $ne: 'IN_HOUSE' } }).sort({ date: -1 }).session(session || null) : mode === 'DYEING' ? await DyeingReceipt.find({ partyId, status: 'POSTED' }).sort({ date: -1 }).session(session || null) : await BusinessDocument.find({ partyId, status: 'POSTED', kind: mode === 'YARN' ? 'YARN_RECEIPT' : 'FABRIC_RECEIPT', ...(mode === 'FABRIC' ? { receiptOrigin: { $ne: 'EXTERNAL_PROCESSING_RETURN' } } : {}) }).sort({ date: -1 }).session(session || null);
  const allocations = await BillAllocation.find({ direction: 'PAYABLE', sourceId: { $in: rows.map(row => row._id) } }).session(session || null);
  return rows.map(row => {
    const value = row.toObject() as unknown as { _id: Types.ObjectId; date: Date; reference?: string; gatePassNo?: string; number?: string; receiptNo?: string; items: Array<Record<string, unknown>> };
    return { _id: String(value._id), date: value.date.toISOString(), label: `${value.gatePassNo || value.reference || value.number} · ${value.date.toISOString().slice(0, 10)}`, items: value.items.flatMap(item => {
      const used = allocations.filter(a => String(a.sourceId) === String(value._id) && a.sourceLineId === String(item._id)).reduce((sum, a) => sum + a.fraction, 0);
      if (used > 0.9999999) return [];
      return [{ ...item, ownerKey: String(item.ownerKey || 'OWN'), sourceId: String(value._id), sourceLineId: String(item._id), rolls: Math.floor(Number(item.rollsCount || item.rolls || 0) * (1 - used) + 0.0000001), weightKg: weight(Number(item.weightKg || 0) * (1 - used)), fabricType: String(item.fabricType || ''), yarnSpec: String(item.yarnSpec || ''), color: String(item.color || 'ECRU'), state: String(item.state || (mode === 'DYEING' ? 'FINISHED_DYED' : 'RAW_ECRU')), packageUnit: String(item.packageUnit || 'cartons') }];
    }) };
  }).filter(row => row.items.length);
}
export async function receiptOptions(mode: string, partyId: string) {
  if (!Types.ObjectId.isValid(partyId)) throw new BadRequestError('Choose a processor first.');
  if (mode === 'KNITTING') return YarnTransaction.find({ partyId, transactionType: 'OUTWARD_TO_KNITTER', status: { $ne: 'REVERSED' }, remainingYarnBalanceKg: { $gt: 0 } }).select('yarnSpec ownerKey packageUnit remainingYarnBalanceKg date gatePassNo productionType').sort({ date: 1 });
  if (mode === 'DYEING') return DyeingBatch.find({ millPartyId: partyId, status: { $in: ['ISSUED', 'IN_PROCESS'] } }).sort({ dateIssued: 1 });
  return [];
}
async function prepare(input: PurchaseInput, session?: ClientSession) {
  if (!await Party.exists({ _id: input.partyId, isActive: { $ne: false } }).session(session || null)) throw new NotFoundError('Choose an active supplier or processor.');
  if (input.draftId) {
    const draft = await BusinessDocument.findOne({ _id: input.draftId, status: 'DRAFT', direction: 'PAYABLE' }).session(session || null);
    if (!draft || (draft.partyId && String(draft.partyId) !== input.partyId)) throw new BadRequestError('This supplier draft is unavailable or belongs to another party.');
  }
  if (input.billNow && await BusinessDocument.exists({ partyId: input.partyId, direction: 'PAYABLE', status: 'POSTED', kind: { $ne: 'CREDIT_NOTE' }, reference: new RegExp('^' + escapeRegex(input.reference) + '$', 'i') }).session(session || null)) throw new BadRequestError('This supplier bill number is already recorded. Open the existing bill instead.');
  let items = input.items.map(item => ({ ...item }));
  if (input.situation === 'EXISTING') {
    const available = await supplierSources(input.mode, input.partyId, session);const seen = new Set<string>();
    items = items.map(item => {
      const source = available.find(s => s._id === item.sourceId);const line = source?.items.find(i => i.sourceLineId === item.sourceLineId);const key = item.sourceId + ':' + item.sourceLineId;
      if (!line || !source || seen.has(key)) throw new BadRequestError('Select each eligible receipt line once. It may already be billed or belong to another party.');seen.add(key);
      if (input.date < source.date || item.rolls > line.rolls || item.weightKg > line.weightKg + 0.000001) throw new BadRequestError('Check the receipt date and remaining unbilled quantities.');
      return { ...item, fabricType: line.fabricType, yarnSpec: line.yarnSpec, color: line.color, state: line.state as 'RAW_ECRU' | 'FINISHED_DYED', ownerKey: String(line.ownerKey || 'OWN'), packageUnit: line.packageUnit as typeof item.packageUnit };
    });
  } else items = items.map(item => ({ ...item, sourceId: undefined, sourceLineId: '' }));
  if (input.situation === 'PAPER' && items.some(i => !(i.description || i.fabricType || i.yarnSpec).trim())) throw new BadRequestError('Describe every historical bill line.');
  if (input.situation === 'NOW') {
    const receiptDate = input.receiptDate || input.date;
    await validateLocation(input.location, session);
    if (['YARN', 'KNITTING'].includes(input.mode) && input.location !== 'ZR_GODOWN') throw new BadRequestError('Purchased yarn is received at Rozain Textile.');
    if (items.some(i => i.weightKg <= 0 || i.rolls < 1 || (!i.yarnSpec && input.mode !== 'DYEING') || (!i.fabricType && ['FABRIC', 'KNITTING'].includes(input.mode)))) throw new BadRequestError('Enter the actual item names, positive packages/rolls and measured kg.');
    if (input.mode === 'FABRIC') items.forEach(validateRawShade);
    const receipt = input.mode === 'KNITTING' ? await KnittingReceipt.exists({ partyId: input.partyId, gatePassNo: input.receiptReference, status: 'POSTED' }).session(session || null) : input.mode === 'DYEING' ? await DyeingReceipt.exists({ partyId: input.partyId, gatePassNo: input.receiptReference, status: 'POSTED' }).session(session || null) : await BusinessDocument.exists({ partyId: input.partyId, kind: input.mode === 'YARN' ? 'YARN_RECEIPT' : 'FABRIC_RECEIPT', reference: input.receiptReference, status: 'POSTED' }).session(session || null);
    if (receipt) throw new BadRequestError('This receipt challan is already recorded. Choose Already recorded to bill it.');
    if (input.mode === 'KNITTING') {
      if (items.some(i => i.wastageKg === undefined)) throw new BadRequestError('Enter actual wastage, including zero, on every knitting line.');
      receiveFabricSchema.parse({ ...input, date: receiptDate, gatePassNo: input.receiptReference, items: items.map(i => ({ ...i, rollsCount: i.rolls })) });
      const required = new Map<string, number>();
      for (const item of items) {
        const components = item.components?.length ? item.components : [{ yarnSpec: item.yarnSpec, weightKg: weight(item.weightKg + item.wastageKg!) }];
        if (Math.abs(weight(components.reduce((sum, component) => sum + component.weightKg, 0)) - weight(item.weightKg + item.wastageKg!)) > 0.000001) throw new BadRequestError('Component kg must equal received fabric plus actual wastage.');
        for (const component of components) required.set(component.yarnSpec, weight((required.get(component.yarnSpec) || 0) + component.weightKg));
      }
      for (const [yarnSpec, kg] of required) {
        const issues = await YarnTransaction.find({ partyId: input.partyId, ownerKey: input.ownerKey, yarnSpec, transactionType: 'OUTWARD_TO_KNITTER', status: { $ne: 'REVERSED' }, date: { $lte: new Date(receiptDate) }, remainingYarnBalanceKg: { $gt: 0 }, $or: [{ productionType: input.productionType }, { productionType: { $exists: false } }] }).session(session || null);
        if (!input.shortageReason && weight(issues.reduce((sum, issue) => sum + issue.remainingYarnBalanceKg, 0)) + 0.000001 < kg) throw new BadRequestError(`${yarnSpec}: not enough recorded yarn with this unit, owner and receipt date. Check the outgoing yarn challan.`);
      }
    }
    if (input.mode === 'DYEING' && input.receiptOrigin === 'BATCH') {
      for (const item of items) {
        const batch = await DyeingBatch.findOne({ _id: item.batchId, millPartyId: input.partyId, status: { $in: ['ISSUED', 'IN_PROCESS'] } }).session(session || null);
        if (!batch || receiptDate < batch.dateIssued.toISOString()) throw new BadRequestError('Choose an open batch from this processor dated before the receipt.');
        item.fabricType = batch.fabricType;item.yarnSpec = batch.yarnSpec;item.color = batch.targetColor;item.state = 'FINISHED_DYED';
      }
    }
    if (input.mode === 'DYEING' && input.receiptOrigin === 'EXTERNAL') {
      items = items.map(item => ({ ...item, state: 'FINISHED_DYED' as const, ownerKey: input.ownerKey }));
      if (items.some(i => !i.fabricType || !i.yarnSpec || !i.color.trim())) throw new BadRequestError('Enter the returned fabric, yarn and actual finished shade.');
      const owner = canonicalOwnerKey(input.ownerKey);
      if (owner !== 'OWN' && !await Party.exists({ _id: owner }).session(session || null)) throw new BadRequestError('Verify the returned material owner.');
    }
  }
  if (input.billNow && items.some(i => !(i.rate > 0) || (i.basis === 'KG' && !(i.weightKg > 0)) || (i.basis === 'ROLL' && !(i.rolls > 0)))) throw new BadRequestError('Enter a positive billed quantity and rate on every line.');
  const totals = input.billNow ? billTotals({ items, taxPercent: input.taxPercent, additionalCharges: input.additionalCharges }) : { baseAmount: 0, taxPercent: 0, taxAmount: 0, total: 0 };
  if (input.billNow && totals.total < 0.01) throw new BadRequestError('The bill must total at least 0.01.');
  let paid = input.payment.kind === 'FULL' ? totals.total : input.payment.kind === 'PART' ? money(input.payment.amount) : 0;
  if (input.payment.kind === 'EXISTING') {
    const voucher = await PaymentVoucher.findOne({ _id: input.payment.voucherId, partyId: input.partyId, voucherType: 'PAYMENT', status: { $ne: 'REVERSED' } }).session(session || null);
    if (!voucher || await BillPayment.exists({ voucherId: voucher._id, status: 'POSTED' }).session(session || null)) throw new BadRequestError('Choose an unallocated payment made to this supplier.');paid = money(voucher.amount);
  }
  if (['FULL', 'PART', 'EXISTING'].includes(input.payment.kind) && (!(paid > 0) || paid > totals.total)) throw new BadRequestError('The payment must be positive and cannot exceed this bill.');
  if (['FULL', 'PART'].includes(input.payment.kind)) {
    if (input.payment.date && input.payment.date < input.date) throw new BadRequestError('The payment date cannot precede the bill.');
    if (input.payment.method === 'CHEQUE' && !input.payment.chequeNo) throw new BadRequestError('Enter the cheque number.');
    if (['BANK_TRANSFER', 'ONLINE'].includes(input.payment.method) && !input.payment.transactionRef) throw new BadRequestError('Enter the payment transaction reference.');
  }
  return { ...totals, items, paid, received: paid, outstanding: input.payment.kind === 'UNKNOWN' ? null : money(totals.total - paid) };
}
export const quotePurchase = (input: PurchaseInput) => prepare(input);
export async function postPurchase(input: PurchaseInput) {
  return postCommand('SUPPLIER_TRANSACTION', input, async session => {
    await Party.updateOne({ _id: input.partyId }, { $inc: { __v: 1 } }, { session });
    const prepared = await prepare(input, session);let items = prepared.items;let receiptId: string | undefined;let receiptKind: string | undefined;
    if (input.situation === 'NOW') {
      const date = input.receiptDate || input.date;
      if (input.mode === 'YARN' || input.mode === 'FABRIC') {
        receiptKind = input.mode === 'YARN' ? 'YARN_RECEIPT' : 'FABRIC_RECEIPT';
        const receipt = await submitOperationInSession(operationInput.parse({ ...input, receiptOrigin: undefined, kind: receiptKind, date, reference: input.receiptReference, items: items.map(i => ({ ...i, rate: 0, ownerKey: 'OWN' })), additionalCharges: [], taxPercent: 0 }), session);
        receiptId = String(receipt._id);items = items.map((item, index) => ({ ...item, sourceId: receiptId, sourceLineId: String(receipt.items[index]._id), ownerKey: receipt.items[index].ownerKey || 'OWN' }));
      } else if (input.mode === 'KNITTING') {
        receiptKind = 'KNITTING';const result = await postKnittingReceiptInSession(receiveFabricSchema.parse({ ...input, date, gatePassNo: input.receiptReference, items: items.map(i => ({ ...i, rollsCount: i.rolls })) }), session);
        receiptId = String(result.receipt._id);items = items.map((item, index) => ({ ...item, sourceId: receiptId, sourceLineId: String(result.receipt.items[index]._id), ownerKey: result.receipt.items[index].ownerKey || input.ownerKey }));
      } else if (input.receiptOrigin === 'BATCH') {
        receiptKind = 'DYEING_RECEIVED';const first = await DyeingBatch.findById(items[0].batchId).session(session);if (!first) throw new NotFoundError('Dyeing batch not found.');
        const result = await postDyeingReceiptInSession(receiveGatePassSchema.parse({ ...input, dateReceived: date, igpNo: input.receiptReference, millName: first.millName, customMillName: first.customMillName || '', items: items.map(i => ({ batchId: i.batchId, ecruWeightKg: i.rawKg, ecruRollsCount: i.rawRolls, finishWeightKg: i.weightKg, finishRollsCount: i.rolls })) }), session);
        receiptId = String(result.receipt._id);items = items.map((item, index) => ({ ...item, sourceId: receiptId, sourceLineId: String(result.receipt.items[index]._id), ownerKey: result.receipt.items[index].ownerKey || input.ownerKey }));
      } else if (input.shortageReason) {
        const mill = await DyeingUnit.findOne({ partyId: input.partyId, type: 'DYEING_MILL', isActive: true }).session(session);
        if (!mill) throw new BadRequestError('Choose the registered dyeing mill linked to this supplier.');
        receiptKind = 'DYEING_RECEIVED';
        const result = await postDyeingReceiptInSession(receiveGatePassSchema.parse({
          ...input, dateReceived: date, igpNo: input.receiptReference, millName: mill.code, destination: input.location,
          items: items.map(item => ({ fabricType: item.fabricType, yarnSpec: item.yarnSpec, targetColor: item.color,
            ecruWeightKg: item.rawKg, ecruRollsCount: item.rawRolls, finishWeightKg: item.weightKg, finishRollsCount: item.rolls }))
        }), session);
        receiptId = String(result.receipt._id);
        items = items.map((item, index) => ({ ...item, sourceId: receiptId, sourceLineId: String(result.receipt.items[index]._id) }));
      } else {
        receiptKind = 'DYEING_RECEIVED';const [receipt] = await DyeingReceipt.create([{ receiptReferenceKey: input.partyId + ':' + input.receiptReference.toUpperCase(), number: await nextDocumentNo('DR', session), gatePassNo: input.receiptReference, partyId: input.partyId, date: new Date(date), actorId: businessContext.getStore()!.actorId, ...referenceFields(input), receiptOrigin: 'EXTERNAL_PROCESSING_RETURN', location: input.location, evidence: input.evidence!.reason, items: items.map(i => ({ fabricType: i.fabricType, yarnSpec: i.yarnSpec, color: i.color.toUpperCase(), state: 'FINISHED_DYED', rolls: i.rolls, weightKg: i.weightKg, ownerKey: canonicalOwnerKey(input.ownerKey) })) }], { session });
        receiptId = String(receipt._id);
        for (const item of items) await moveFabric({ ...item, state: 'FINISHED_DYED', ownerKey: canonicalOwnerKey(input.ownerKey) }, input.location, 1, receipt._id, new Date(date), 'Verified external processing return; raw issue and loss not recorded', session);
        items = items.map((item, index) => ({ ...item, sourceId: receiptId, sourceLineId: String(receipt.items[index]._id), ownerKey: receipt.items[index].ownerKey || 'OWN' }));
      }
    }
    let bill;
    if (input.billNow) {
      const sourceIds = [...new Set(items.map(i => i.sourceId).filter(Boolean))];
      const paper = input.situation === 'PAPER' ? { reference: input.reference, reason: input.evidence!.reason, confirmedBy: businessContext.getStore()!.actorId, confirmedAt: new Date() } : undefined;
      const saved = await submitOperationInSession(operationInput.parse({ ...input, receiptOrigin: undefined, direction: 'PAYABLE', kind: purchaseKinds[input.mode], sourceId: sourceIds.length === 1 ? sourceIds[0] : undefined, items }), session, undefined, paper);
      await BusinessDocument.updateOne({ _id: saved._id }, { $set: { financialReferenceKey: `PAYABLE:${input.partyId}:${input.reference.toUpperCase()}`, ...(input.payment.kind === 'UNKNOWN' ? { settlementStatus: 'NOT_RECORDED' } : {}) } }, { session });
      if (['FULL', 'PART', 'EXISTING'].includes(input.payment.kind)) await payBillInSession(String(saved._id), { amount: prepared.paid, date: input.payment.date || input.date, existingVoucherId: input.payment.kind === 'EXISTING' ? input.payment.voucherId : undefined, paymentMode: input.payment.method, bankName: input.payment.bankName, chequeNo: input.payment.chequeNo, chequeDate: input.payment.chequeDate, transactionRef: input.payment.transactionRef, reference: input.reference }, session);
      bill = await BusinessDocument.findById(saved._id).populate('partyId', 'name code').session(session);
      if (!bill || money(bill.total) !== prepared.total) throw new BadRequestError('The bill total changed. Review again.');
    }
    if (input.draftId) await BusinessDocument.updateOne({ _id: input.draftId, status: 'DRAFT' }, { $set: { kind: 'SUPPLIER_DRAFT', status: 'POSTED', sourceId: bill?._id || receiptId }, $unset: { draft: 1 } }, { session });
    return { ...prepared, bill: bill?.toObject() || null, receiptId, receiptKind };
  });
}
