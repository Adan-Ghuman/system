import { ClientSession, Types } from 'mongoose';
import { SaleInput } from './sales.schema.js';
import { BusinessDocument, BillPayment, SourceBillingAssignment } from './commerce.models.js';
import { FabricInventory } from '../models/FabricInventory.js';
import { Party } from '../models/Party.js';
import { PaymentVoucher } from '../models/PaymentVoucher.js';
import { billTotals, submitOperationInSession, payBillInSession, getChargeSource } from './commerce.js';
import { postDeliveryInSession } from './delivery.js';
import { operationInput } from './commerce.schema.js';
import { postCommand, money, weight } from './posting.js';
import { businessContext } from './context.js';
import { canonicalOwnerKey } from './ownership.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { escapeRegex } from '../utils/search.js';

export { customerSources } from './sales-sources.js';
import { customerSources } from './sales-sources.js';

async function prepareSale(input: SaleInput, session?: ClientSession) {
  const customer = await Party.findOne({ _id: input.customerId, isActive: { $ne: false } }).session(session || null);
  if (!customer) throw new NotFoundError('Choose an active customer.');
  const kind = input.mode === 'FABRIC' || input.mode === 'EXISTING_DELIVERY' ? 'CUSTOMER_BILL' : input.mode;
  if (input.reference) {
    const duplicate = await BusinessDocument.findOne({ partyId: input.customerId, direction: 'RECEIVABLE', status: 'POSTED', kind: { $in: ['CUSTOMER_BILL', 'KNITTING_CHARGE', 'DYEING_CHARGE'] }, reference: new RegExp('^' + escapeRegex(input.reference) + '$', 'i') }).session(session || null);
    if (duplicate) throw new BadRequestError(`Paper reference ${input.reference} is already recorded as ${duplicate.number}. Open that bill instead.`);
  }
  if (input.draftId) {
    const draft = await BusinessDocument.findOne({ _id: input.draftId, status: 'DRAFT', kind: { $in: ['SALES_DRAFT', 'DELIVERY_DRAFT', 'CUSTOMER_BILL', 'KNITTING_CHARGE', 'DYEING_CHARGE'] } }).session(session || null);
    if (!draft || (draft.partyId && String(draft.partyId) !== input.customerId)) throw new BadRequestError('This draft is unavailable or belongs to another customer.');
  }
  let items = input.items.map(item => ({ ...item }));
  let stock;
  if (input.mode === 'FABRIC') {
    stock = await FabricInventory.findById(input.inventoryId).session(session || null);
    if (!stock || canonicalOwnerKey(stock.ownerKey || 'OWN') !== 'OWN' || stock.location !== input.location) throw new BadRequestError('Choose Rozain-owned fabric at the selected location.');
    if (stock.state === 'RAW_ECRU' && stock.color !== 'ECRU') throw new BadRequestError('Correct this raw fabric shade to ECRU in Fabric stock before selling it.');
    const numbers = new Set<number>();
    const kg = weight(input.rolls.reduce((sum, roll) => { if (numbers.has(roll.rollNumber)) throw new BadRequestError('Roll numbers must be unique.');numbers.add(roll.rollNumber);const net = weight(roll.grossWeightKg - roll.tareKg);if (net <= 0) throw new BadRequestError('Gross weight must exceed tare for every roll.');return sum + net; }, 0));
    if (input.rolls.length > stock.totalRolls || kg > stock.totalWeightKg + 0.000001) throw new BadRequestError('Available rolls or measured kg have changed. Review Fabric stock and reduce the delivery.');
    items = [{ ...items[0], fabricType: stock.fabricType, yarnSpec: stock.yarnSpec, color: stock.color, state: stock.state, rolls: input.rolls.length, weightKg: kg, ownerKey: 'OWN', basis: 'KG' }];
  } else if (input.sourceMode === 'WORK') {
    const available = await customerSources(input.mode, input.customerId, session);
    const seen = new Set<string>();
    items = items.map(item => {
      const source = available.items.find(s => s._id === (item.sourceId || input.sourceId));
      if (!source) throw new BadRequestError('Choose eligible completed work or a delivery for this customer. Unassigned work needs a confirmed customer first.');
      if (input.date < source.date) throw new BadRequestError('The bill date cannot precede the delivery or completed work.');
      const line = source.items.find(l => l.sourceLineId === item.sourceLineId);const key = source._id + ':' + item.sourceLineId;
      if (!line || seen.has(key)) throw new BadRequestError('Each selected receipt line can be billed once in this entry.');seen.add(key);
      if (item.weightKg > line.weightKg + 0.000001 || item.rolls > line.rolls) throw new BadRequestError('The quantity exceeds the remaining unbilled work.');
      return { ...item, sourceId: source._id, fabricType: line.fabricType, yarnSpec: line.yarnSpec, color: line.color, state: line.state };
    });
  }
  if (input.billNow && items.some(i => !(i.rate > 0) || (i.basis === 'KG' && !(i.weightKg > 0)) || (i.basis === 'ROLL' && !(i.rolls > 0)))) throw new BadRequestError('Enter a positive rate and billed quantity on each line.');
  if (input.sourceMode === 'PAPER' && items.some(i => !(i.description || i.fabricType).trim())) throw new BadRequestError('Describe each line of the paper service bill.');
  const totals = input.billNow ? billTotals({ items, taxPercent: input.taxPercent, additionalCharges: input.additionalCharges }) : { baseAmount: 0, taxPercent: 0, taxAmount: 0, total: 0 };
  if (input.billNow && !(totals.total > 0)) throw new BadRequestError('The bill must total at least 0.01.');
  let received = input.payment.kind === 'FULL' ? totals.total : input.payment.kind === 'PART' ? money(input.payment.amount) : 0;
  if (input.payment.kind === 'EXISTING') {
    const voucher = await PaymentVoucher.findOne({ _id: input.payment.voucherId, partyId: input.customerId, voucherType: 'RECEIPT', status: { $ne: 'REVERSED' } }).session(session || null);
    if (!voucher) throw new BadRequestError('Choose an existing customer receipt.');
    if (await BillPayment.exists({ voucherId: voucher._id, status: 'POSTED' }).session(session || null)) throw new BadRequestError('This receipt is already allocated to a bill.');
    received = money(voucher.amount);
  }
  if (['PART', 'FULL', 'EXISTING'].includes(input.payment.kind) && (!(received > 0) || received > totals.total)) throw new BadRequestError('The received amount must be positive and cannot exceed this bill.');
  if (['PART', 'FULL'].includes(input.payment.kind)) {
    if (input.payment.date && input.payment.date < input.date) throw new BadRequestError('The receipt date cannot precede the bill.');
    if (input.payment.method === 'CHEQUE' && !input.payment.chequeNo) throw new BadRequestError('Enter the cheque number.');
    if (['BANK_TRANSFER', 'ONLINE'].includes(input.payment.method) && !input.payment.transactionRef) throw new BadRequestError('Enter the bank/provider transaction reference.');
  }
  return { kind, items, stock, totals, received, outstanding: input.payment.kind === 'UNKNOWN' ? null : money(totals.total - received) };
}
export async function quoteSale(input: SaleInput) {
  const { totals, received, outstanding, items } = await prepareSale(input);
  return { ...totals, received, outstanding, items };
}
export async function postSale(input: SaleInput) {
  return postCommand('CUSTOMER_SALE', input, async session => {
    const prepared = await prepareSale(input, session);
    let deliveryId: string | undefined;
    let billId: string | undefined;
    let payment: unknown;
    if (input.mode === 'FABRIC') {
      const stock = prepared.stock!;
      const result = await postDeliveryInSession({ requestId: input.requestId, customerId: input.customerId, purpose: 'SALE', billNow: input.billNow, state: stock.state, fromLocation: stock.location, fabricType: stock.fabricType, yarnSpec: stock.yarnSpec, color: stock.color, rolls: input.rolls, ratePerKg: input.billNow ? prepared.items[0].rate : 1, invoiceType: input.taxPercent === 18 ? 'TAX_18_PERCENT' : 'NON_GST', date: input.date, driverName: input.driverName, vehicleNo: input.vehicleNo, remarks: input.remarks, poNo: input.poNo, externalReference: input.externalReference }, session, input.reference, String(stock._id));
      deliveryId = String(result.dispatch._id);billId = result.invoice ? String(result.invoice._id) : undefined;
      if (input.draftId) await BusinessDocument.updateOne({ _id: input.draftId, status: 'DRAFT' }, { $set: { kind: 'SALES_DRAFT', status: 'POSTED', sourceId: result.dispatch._id } }, { session });
    } else {
      const paper = input.sourceMode === 'PAPER' ? { reference: input.reference, reason: input.paper!.reason, confirmedBy: businessContext.getStore()!.actorId, confirmedAt: new Date(), periodFrom: input.paper?.periodFrom ? new Date(input.paper.periodFrom) : undefined, periodTo: input.paper?.periodTo ? new Date(input.paper.periodTo) : undefined } : undefined;
      const selectedSources = [...new Set(prepared.items.map(i => i.sourceId).filter(Boolean))];
      const result = await submitOperationInSession(operationInput.parse({ ...input, kind: prepared.kind, partyId: input.customerId, direction: 'RECEIVABLE', sourceId: paper || selectedSources.length > 1 ? undefined : selectedSources[0] || input.sourceId, items: prepared.items }), session, input.draftId, paper);
      billId = String(result._id);deliveryId = input.mode === 'EXISTING_DELIVERY' ? input.sourceId : undefined;
    }
    if (billId) {
      await BusinessDocument.updateOne({ _id: billId }, { $set: { ...(input.reference ? { salesReferenceKey: input.customerId + ':' + input.reference.toUpperCase() } : {}), ...(input.payment.kind === 'UNKNOWN' ? { settlementStatus: 'NOT_RECORDED' } : {}) } }, { session });
      if (['FULL', 'PART', 'EXISTING'].includes(input.payment.kind)) payment = await payBillInSession(billId, { amount: prepared.received, date: input.payment.date || input.date, reference: input.reference, existingVoucherId: input.payment.kind === 'EXISTING' ? input.payment.voucherId : undefined, paymentMode: input.payment.method, bankName: input.payment.bankName, chequeNo: input.payment.chequeNo, chequeDate: input.payment.chequeDate, transactionRef: input.payment.transactionRef }, session);
    }
    const bill = billId ? await BusinessDocument.findById(billId).populate('partyId', 'name code').session(session) : null;
    if (bill && money(bill.total) !== money(prepared.totals.total)) throw new BadRequestError('The bill totals changed. Review the transaction again.');
    return { deliveryId, bill: bill?.toObject() || null, payment, ...prepared.totals, received: prepared.received, outstanding: prepared.outstanding };
  });
}

export async function assignSource(input: { requestId: string; customerId: string; kind: string; sourceId: string; sourceLineId: string; reason: string }) {
  return postCommand('BILLING_CUSTOMER_ASSIGNMENT', input, async session => {
    if (!await Party.exists({ _id: input.customerId, isActive: { $ne: false } }).session(session)) throw new NotFoundError('Customer not found.');
    const available = await customerSources(input.kind, input.customerId, session);
    if (!available.unassigned.some(s => s._id === input.sourceId && s.items.some(i => i.sourceLineId === input.sourceLineId))) throw new BadRequestError('This work is already assigned, billed or belongs to another customer.');
    const { source } = await getChargeSource(input.kind, input.sourceId, session);
    await source.updateOne({ $inc: { postingVersion: 1 } }, { session });
    const [assignment] = await SourceBillingAssignment.create([{ ...input, actorId: businessContext.getStore()!.actorId }], { session });return assignment.toObject();
  });
}
