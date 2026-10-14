import { ClientSession, Types } from 'mongoose';
import { z } from 'zod';
import { Business } from './Business.js';
import { BusinessDocument, BillPayment } from './commerce.models.js';
import { FabricInventory } from '../models/FabricInventory.js';
import { Party } from '../models/Party.js';
import { IUser } from '../models/User.js';
import { PaymentVoucher } from '../models/PaymentVoucher.js';
import { businessContext, usesExistingRecords } from './context.js';
import { postCommand, nextDocumentNo, money, weight } from './posting.js';
import { billTotals } from './commerce.js';
import { itemInput } from './commerce.schema.js';
import { moveFabric } from './stock.js';
import { postPartyAmount } from './finance.js';
import { referenceFields, documentReferenceFields } from './references.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { canAccessBusiness } from './access.js';

export const intercompanyInput = z.object({ ...documentReferenceFields, targetBusinessId: z.string(), date: z.string().datetime(), reference: z.string().trim().max(150).default(''), remarks: z.string().max(1000).default(''), taxPercent: z.union([z.literal(0), z.literal(18)]).default(0), items: z.array(z.object({ inventoryId: z.string(), rolls: z.number().int().positive(), weightKg: z.number().positive(), rate: z.number().positive(), basis: z.enum(['KG', 'ROLL']).default('KG') })).min(1).max(100) });

export async function inBusiness<T>(id: string, user: IUser, action: () => Promise<T>) {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Business not found.');
  const business = await Business.findOne({ _id: id, isActive: true });if (!business) throw new NotFoundError('Business not found.');
  if (!canAccessBusiness(user, business)) throw new ForbiddenError('Access to both businesses is required for this transaction.');
  return businessContext.run({ businessId: id, actorId: String(user._id), name: business.name, usesExistingRecords: business.code === 'ROZAIN' }, action);
}
async function counterpartAccount(id: string, session: ClientSession) {
  const business = await Business.findById(id).session(session);if (!business) throw new NotFoundError('Business not found.');
  const code = usesExistingRecords() && business.code === 'ZR' ? 'ZR_TRADING' : 'INTERCO-' + business.code;
  const existing = await Party.findOne({ code }).session(session);if (existing) return existing;
  return (await Party.create([{ code, name: business.name, tags: { isFabricBuyer: true }, openingBalance: 0, currentBalance: 0 }], { session }))[0];
}

export async function createIntercompany(input: z.infer<typeof intercompanyInput>, user: IUser) {
  const source = businessContext.getStore()!;
  if (source.businessId === input.targetBusinessId) throw new BadRequestError('Choose the other business. Store transfers within one business use Fabric stock → Transfer.');
  await inBusiness(input.targetBusinessId, user, async () => true);
  return postCommand('INTERCOMPANY_SALE', input, async session => {
    const peer = await counterpartAccount(input.targetBusinessId, session);const sourceId = new Types.ObjectId(), targetId = new Types.ObjectId();
    const items: Array<z.infer<typeof itemInput> & { sourceLocation: string }> = [];
    for (const line of input.items) {
      const stock = await FabricInventory.findOne({ _id: line.inventoryId, ownerKey: 'OWN' }).session(session);
      if (!stock) throw new BadRequestError('Choose business-owned fabric from the active business. Client-owned goods cannot be sold.');
      items.push({ ...itemInput.parse({ ...stock.toObject(), rolls: line.rolls, weightKg: line.weightKg, rate: line.rate, basis: line.basis, ownerKey: 'OWN' }), sourceLocation: stock.location });
    }
    const totals = billTotals({ items, taxPercent: input.taxPercent });const date = new Date(input.date);
    const [sale] = await BusinessDocument.create([{ _id: sourceId, number: await nextDocumentNo('IC-SALE', session), kind: 'INTERCOMPANY_SALE', direction: 'RECEIVABLE', partyId: peer._id, date, ...referenceFields(input), reference: input.reference, remarks: input.remarks, items, ...totals, actorId: source.actorId, intercompanyId: sourceId, counterpartId: targetId, counterpartBusinessId: input.targetBusinessId }], { session });
    for (let index = 0; index < items.length; index++) await moveFabric(items[index], items[index].sourceLocation, -1, sourceId, date, `Sale to ${peer.name}`, session);
    await postPartyAmount(peer._id, totals.total, sourceId, sale.number, date, 'Inter-company fabric sale', session);
    const purchase = await inBusiness(input.targetBusinessId, user, async () => {
      const supplier = await counterpartAccount(source.businessId, session);
      const [document] = await BusinessDocument.create([{ _id: targetId, number: await nextDocumentNo('IC-BUY', session), kind: 'INTERCOMPANY_PURCHASE', direction: 'PAYABLE', partyId: supplier._id, date, ...referenceFields(input), reference: sale.number, remarks: input.remarks, items: items.map((item, index) => ({ ...item, sourceLineId: String(sale.items[index]._id) })), ...totals, location: 'IN_TRANSIT', actorId: source.actorId, intercompanyId: sourceId, counterpartId: sourceId, counterpartBusinessId: source.businessId }], { session });
      for (const item of items) await moveFabric(item, 'IN_TRANSIT', 1, targetId, date, 'Inter-company purchase in transit', session);
      await postPartyAmount(supplier._id, -totals.total, targetId, document.number, date, 'Inter-company fabric purchase', session);return document.toObject();
    });
    return { sale: sale.toObject(), purchase };
  });
}

export async function receiveIntercompany(id: string, input: { date: string; requestId?: string; items: Array<{ lineId: string; rolls: number; weightKg: number }> }) {
  return postCommand('INTERCOMPANY_RECEIPT', { ...input, id }, async session => {
    const purchase = await BusinessDocument.findOne({ _id: id, kind: 'INTERCOMPANY_PURCHASE', status: 'POSTED' }).session(session);if (!purchase) throw new NotFoundError('Open the purchase in the receiving business.');
    const date = new Date(input.date);if (date < purchase.date) throw new BadRequestError('Receipt date cannot be earlier than the sale.');
    const seen = new Set<string>();
    for (const entry of input.items) {
      if (seen.has(entry.lineId)) throw new BadRequestError('Each source line can appear only once in a receipt.');seen.add(entry.lineId);
      const line = purchase.items.find(item => String(item._id) === entry.lineId);if (!line) throw new BadRequestError('Source line not found.');
      const leftKg = weight(line.weightKg - line.receivedWeightKg - line.returnedWeightKg + line.returnedReceivedKg), leftRolls = line.rolls - line.receivedRolls - line.returnedRolls + line.returnedReceivedRolls;
      if (entry.rolls > leftRolls || entry.weightKg > leftKg + 0.000001) throw new BadRequestError('The receipt exceeds the quantity still in transit.');
      if ((entry.rolls === leftRolls) !== (Math.abs(entry.weightKg - leftKg) < 0.000001)) throw new BadRequestError('The final roll count and kg must reconcile together. Check the weights before completing this line.');
      const item = { ...line.toObject(), rolls: entry.rolls, weightKg: entry.weightKg };
      await moveFabric(item, 'IN_TRANSIT', -1, purchase._id, date, 'Inter-company goods accepted', session);
      await moveFabric(item, 'ZR_GODOWN', 1, purchase._id, date, 'Inter-company goods arrived in store', session);
      line.receivedWeightKg = weight(line.receivedWeightKg + entry.weightKg);line.receivedRolls += entry.rolls;
    }
    purchase.receivedWeightKg = weight(purchase.items.reduce((sum, item) => sum + item.receivedWeightKg, 0));purchase.receivedRolls = purchase.items.reduce((sum, item) => sum + item.receivedRolls, 0);await purchase.save({ session });return purchase.toObject();
  });
}

export async function settleIntercompany(id: string, input: { amount: number; date: string; reference?: string; requestId?: string; refund?: boolean }, user: IUser) {
  const origin = businessContext.getStore()!;
  const document = await BusinessDocument.findOne({ _id: id, intercompanyId: { $exists: true }, status: 'POSTED' });if (!document?.counterpartBusinessId) throw new NotFoundError('Linked transaction not found.');
  await inBusiness(String(document.counterpartBusinessId), user, async () => true);
  return postCommand('INTERCOMPANY_SETTLEMENT', { ...input, id }, async session => {
    const groupId = new Types.ObjectId();
    const post = async (billId: string) => {
      const bill = await BusinessDocument.findOne({ _id: billId, status: 'POSTED' }).session(session);if (!bill?.partyId) throw new NotFoundError('Linked bill not found.');
      if (new Date(input.date) < bill.date) throw new BadRequestError('Settlement date cannot be earlier than the bill.');
      if (bill.kind === 'INTERCOMPANY_CREDIT') throw new BadRequestError('Record a paired refund against the original trade.');
      const amount = money(input.amount) * (input.refund ? -1 : 1);
      if (input.amount < 0.01 || (input.refund ? bill.paid <= bill.total - bill.credited || money(bill.paid + amount) < bill.total - bill.credited : money(bill.paid + amount) > bill.total - bill.credited)) throw new BadRequestError('The settlement exceeds the outstanding payment or refund.');
      const number = await nextDocumentNo('IC-PAY', session);const payable = bill.direction === 'PAYABLE';
      const [voucher] = await PaymentVoucher.create([{ voucherNo: number, voucherType: input.refund ? payable ? 'RECEIPT' : 'PAYMENT' : payable ? 'PAYMENT' : 'RECEIPT', paymentMode: 'BANK_TRANSFER', partyId: bill.partyId, amount: Math.abs(amount), date: new Date(input.date), remarks: input.reference || '' }], { session });
      await postPartyAmount(bill.partyId, payable ? amount : -amount, voucher._id, number, new Date(input.date), `Inter-company settlement: ${bill.number}`, session);
      bill.paid = money(bill.paid + amount);await bill.save({ session });
      const [payment] = await BillPayment.create([{ billId: bill._id, voucherId: voucher._id, amount, date: new Date(input.date), reference: input.reference || '', settlementGroupId: groupId }], { session });return payment.toObject();
    };
    const current = await post(id);const peer = await inBusiness(String(document.counterpartBusinessId), user, () => post(String(document.counterpartId)));
    return { current, counterpart: peer, businessId: origin.businessId };
  });
}

export async function reverseIntercompanySettlement(paymentId: string, input: { reason: string; requestId?: string }, user: IUser) {
  const payment = await BillPayment.findById(paymentId);
  if (!payment?.settlementGroupId) throw new NotFoundError('Linked settlement not found.');
  const document = await BusinessDocument.findById(payment.billId);
  if (!document?.counterpartBusinessId) throw new NotFoundError('Linked transaction not found.');
  await inBusiness(String(document.counterpartBusinessId), user, async () => true);
  return postCommand('REVERSE_INTERCOMPANY_SETTLEMENT', { ...input, paymentId }, async session => {
    const reverse = async () => {
      const entry = await BillPayment.findOne({ settlementGroupId: payment.settlementGroupId, status: 'POSTED' }).session(session);
      if (!entry) throw new BadRequestError('The linked settlement has already been reversed.');
      const bill = await BusinessDocument.findById(entry.billId).session(session);
      if (!bill?.partyId || bill.status !== 'POSTED') throw new BadRequestError('The linked bill is unavailable.');
      if (money(bill.paid - entry.amount) < 0) throw new BadRequestError('Reverse the paired refund before reversing the original settlement.');
      await postPartyAmount(bill.partyId, bill.direction === 'PAYABLE' ? -entry.amount : entry.amount, entry._id, bill.number, new Date(), `Settlement reversed: ${input.reason}`, session);
      await PaymentVoucher.updateOne({ _id: entry.voucherId }, { $set: { status: 'REVERSED' } }, { session });
      bill.paid = money(bill.paid - entry.amount);await bill.save({ session });
      entry.status = 'REVERSED';await entry.save({ session });
      return entry.toObject();
    };
    const current = await reverse();
    const counterpart = await inBusiness(String(document.counterpartBusinessId), user, reverse);
    return { current, counterpart };
  });
}

export async function reverseIntercompany(id: string, input: { reason: string; requestId?: string }, user: IUser) {
  const original = businessContext.getStore()!;const current = await BusinessDocument.findOne({ _id: id, status: 'POSTED', intercompanyId: { $exists: true } });if (!current?.counterpartBusinessId) throw new NotFoundError('Linked transaction not found.');
  const sourceBusinessId = current.kind === 'INTERCOMPANY_SALE' ? original.businessId : String(current.counterpartBusinessId);
  const sourceId = current.kind === 'INTERCOMPANY_SALE' ? id : String(current.counterpartId);
  await inBusiness(String(current.counterpartBusinessId), user, async () => true);
  return postCommand('REVERSE_INTERCOMPANY', { ...input, id }, async session => {
    return inBusiness(sourceBusinessId, user, async () => {
      const sale = await BusinessDocument.findOne({ _id: sourceId, kind: 'INTERCOMPANY_SALE', status: 'POSTED' }).session(session);if (!sale?.partyId || !sale.counterpartBusinessId) throw new NotFoundError('Original sale not found.');
      if (sale.credited) throw new BadRequestError('Reverse the paired credit notes before reversing this trade.');
      if (sale.paid) throw new BadRequestError('Reverse the linked settlements before reversing this trade.');
      await inBusiness(String(sale.counterpartBusinessId), user, async () => {
        const purchase = await BusinessDocument.findOne({ _id: sale.counterpartId, status: 'POSTED' }).session(session);if (!purchase?.partyId || purchase.paid) throw new BadRequestError('The purchase is missing or has payments.');
        for (const item of purchase.items) {
          const pendingRolls = item.rolls - item.receivedRolls, pendingKg = weight(item.weightKg - item.receivedWeightKg);
          if (pendingRolls && pendingKg) await moveFabric({ ...item.toObject(), rolls: pendingRolls, weightKg: pendingKg }, 'IN_TRANSIT', -1, purchase._id, new Date(), input.reason, session);
          if (item.receivedRolls && item.receivedWeightKg) await moveFabric({ ...item.toObject(), rolls: item.receivedRolls, weightKg: item.receivedWeightKg }, 'ZR_GODOWN', -1, purchase._id, new Date(), input.reason, session);
        }
        await postPartyAmount(purchase.partyId, purchase.total, purchase._id, purchase.number, new Date(), `Inter-company reversal: ${input.reason}`, session);purchase.status = 'REVERSED';purchase.remarks += ` | Reversed: ${input.reason}`;await purchase.save({ session });
      });
      for (const item of sale.items) await moveFabric(item.toObject(), item.sourceLocation, 1, sale._id, new Date(), input.reason, session);
      await postPartyAmount(sale.partyId, -sale.total, sale._id, sale.number, new Date(), `Inter-company reversal: ${input.reason}`, session);sale.status = 'REVERSED';sale.remarks += ` | Reversed: ${input.reason}`;await sale.save({ session });return sale.toObject();
    });
  });
}
