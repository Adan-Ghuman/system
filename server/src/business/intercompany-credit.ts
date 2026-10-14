import { Types } from 'mongoose';
import { z } from 'zod';
import { IUser } from '../models/User.js';
import { BusinessDocument } from './commerce.models.js';
import { businessContext } from './context.js';
import { inBusiness } from './intercompany.js';
import { money, weight, postCommand, nextDocumentNo } from './posting.js';
import { moveFabric } from './stock.js';
import { postPartyAmount } from './finance.js';
import { itemInput } from './commerce.schema.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export const pairedCreditInput = z.object({ requestId: z.string().uuid(), date: z.string().datetime(), reason: z.string().trim().min(3), disposition: z.enum(['RETURN', 'SHORTAGE']).default('RETURN'), location: z.enum(['IN_TRANSIT', 'ZR_GODOWN']).default('IN_TRANSIT'), items: z.array(z.object({ lineId: z.string(), rolls: z.number().int().positive(), weightKg: z.number().positive() })).min(1).max(100) });

export async function creditIntercompany(id: string, input: z.infer<typeof pairedCreditInput>, user: IUser) {
  const origin = businessContext.getStore()!;
  const original = await BusinessDocument.findOne({ _id: id, kind: 'INTERCOMPANY_PURCHASE', status: 'POSTED' });
  if (!original?.counterpartBusinessId) throw new NotFoundError('Open the purchase in the receiving business to record its return or shortage.');
  const sellerId = String(original.counterpartBusinessId);
  await inBusiness(sellerId, user, async () => true);
  return postCommand('INTERCOMPANY_CREDIT', { ...input, id }, async session => {
    const purchase = await BusinessDocument.findOne({ _id: id, status: 'POSTED' }).session(session);
    if (!purchase?.partyId) throw new NotFoundError('Purchase not found.');
    if (new Date(input.date) < purchase.date) throw new BadRequestError('The correction cannot be earlier than the trade.');
    const purchaseCreditId = new Types.ObjectId(), saleCreditId = new Types.ObjectId();
    let baseAmount = 0;const seen = new Set<string>();const items: Array<z.infer<typeof itemInput> & { sourceLocation: string }> = [];
    for (const entry of input.items) {
      if (seen.has(entry.lineId)) throw new BadRequestError('Each line can appear only once.');seen.add(entry.lineId);
      const line = purchase.items.find(item => String(item._id) === entry.lineId);if (!line) throw new BadRequestError('Original purchase line not found.');
      const store = input.location === 'ZR_GODOWN';
      const availableRolls = store ? line.receivedRolls - line.returnedReceivedRolls : line.rolls - line.receivedRolls - line.returnedRolls + line.returnedReceivedRolls;
      const availableKg = weight(store ? line.receivedWeightKg - line.returnedReceivedKg : line.weightKg - line.receivedWeightKg - line.returnedWeightKg + line.returnedReceivedKg);
      if (entry.rolls > availableRolls || entry.weightKg > availableKg) throw new BadRequestError('The correction exceeds the quantity at the selected receiving location.');
      if ((entry.rolls === availableRolls) !== (Math.abs(entry.weightKg - availableKg) < 0.000001)) throw new BadRequestError('The final roll count and kg must reconcile together.');
      const item = { ...itemInput.parse({ ...line.toObject(), sourceLineId: line.sourceLineId, rolls: entry.rolls, weightKg: entry.weightKg, description: input.disposition }), _id: undefined, sourceLocation: input.location };
      await moveFabric(item, input.location, -1, purchaseCreditId, new Date(input.date), `${input.disposition}: ${input.reason}`, session);
      line.returnedRolls += entry.rolls;line.returnedWeightKg = weight(line.returnedWeightKg + entry.weightKg);
      if (store) { line.returnedReceivedRolls += entry.rolls;line.returnedReceivedKg = weight(line.returnedReceivedKg + entry.weightKg); }
      baseAmount = money(baseAmount + money((line.basis === 'KG' ? entry.weightKg : entry.rolls) * line.rate));items.push(item);
    }
    const taxAmount = money(baseAmount * purchase.taxPercent / 100), total = money(baseAmount + taxAmount);
    if (money(purchase.credited + total) > purchase.total) throw new BadRequestError('The paired credit exceeds the original bill.');
    const shared = { kind: 'INTERCOMPANY_CREDIT', date: new Date(input.date), items, baseAmount, taxPercent: purchase.taxPercent, taxAmount, total, remarks: input.reason, actorId: origin.actorId, intercompanyId: purchase.intercompanyId };
    const [credit] = await BusinessDocument.create([{ ...shared, _id: purchaseCreditId, number: await nextDocumentNo('IC-CREDIT', session), direction: 'RECEIVABLE', sourceId: purchase._id, partyId: purchase.partyId, reference: purchase.number, counterpartId: saleCreditId, counterpartBusinessId: sellerId }], { session });
    await postPartyAmount(purchase.partyId, total, credit._id, credit.number, shared.date, input.reason, session);purchase.credited = money(purchase.credited + total);await purchase.save({ session });
    await inBusiness(sellerId, user, async () => {
      const sale = await BusinessDocument.findOne({ _id: purchase.counterpartId, status: 'POSTED' }).session(session);if (!sale?.partyId) throw new BadRequestError('The original sale is unavailable.');
      for (const item of items) {
        const line = sale.items.find(value => String(value._id) === item.sourceLineId);if (!line) throw new BadRequestError('The matching sale line is unavailable.');
        line.returnedRolls += item.rolls;line.returnedWeightKg = weight(line.returnedWeightKg + item.weightKg);
        if (input.disposition === 'RETURN') await moveFabric(item, line.sourceLocation, 1, saleCreditId, shared.date, input.reason, session);
      }
      const [saleCredit] = await BusinessDocument.create([{ ...shared, _id: saleCreditId, number: await nextDocumentNo('IC-CREDIT', session), direction: 'PAYABLE', sourceId: sale._id, partyId: sale.partyId, reference: sale.number, counterpartId: purchaseCreditId, counterpartBusinessId: origin.businessId }], { session });
      await postPartyAmount(sale.partyId, -total, saleCredit._id, saleCredit.number, shared.date, input.reason, session);sale.credited = money(sale.credited + total);await sale.save({ session });
    });return credit.toObject();
  });
}

export async function reverseIntercompanyCredit(id: string, input: { reason: string; requestId?: string }, user: IUser) {
  const originalContext = businessContext.getStore()!;const credit = await BusinessDocument.findOne({ _id: id, kind: 'INTERCOMPANY_CREDIT' });
  if (!credit?.counterpartBusinessId) throw new NotFoundError('Paired credit not found.');
  await inBusiness(String(credit.counterpartBusinessId), user, async () => true);
  return postCommand('REVERSE_INTERCOMPANY_CREDIT', { ...input, id }, async session => {
    async function reverse(localId: string, isPurchase: boolean, businessId: string) {
      return inBusiness(businessId, user, async () => {
        const note = await BusinessDocument.findOne({ _id: localId, status: 'POSTED' }).session(session);if (!note?.partyId) throw new BadRequestError('The paired credit is already reversed.');
        const bill = await BusinessDocument.findById(note.sourceId).session(session);if (!bill?.partyId) throw new BadRequestError('Original trade not found.');
        if (bill.paid > money(bill.total - bill.credited)) throw new BadRequestError('Record or reverse the paired refund before correcting this credit.');
        for (const item of note.items) {
          const line = bill.items.find(value => isPurchase ? value.sourceLineId === item.sourceLineId : String(value._id) === item.sourceLineId);if (!line) throw new BadRequestError('Original line not found.');
          if (isPurchase) {
            await moveFabric(item.toObject(), item.sourceLocation, 1, note._id, new Date(), input.reason, session);
            if (item.sourceLocation === 'ZR_GODOWN') { line.returnedReceivedRolls -= item.rolls;line.returnedReceivedKg = weight(line.returnedReceivedKg - item.weightKg); }
          } else if (item.description === 'RETURN') await moveFabric(item.toObject(), line.sourceLocation, -1, note._id, new Date(), input.reason, session);
          line.returnedRolls -= item.rolls;line.returnedWeightKg = weight(line.returnedWeightKg - item.weightKg);
        }
        await postPartyAmount(note.partyId, isPurchase ? -note.total : note.total, note._id, note.number, new Date(), input.reason, session);
        bill.credited = money(bill.credited - note.total);await bill.save({ session });note.status = 'REVERSED';await note.save({ session });return note.toObject();
      });
    }
    const localPurchase = credit.direction === 'RECEIVABLE';
    const local = await reverse(id, localPurchase, originalContext.businessId);
    await reverse(String(credit.counterpartId), !localPurchase, String(credit.counterpartBusinessId));return local;
  });
}
