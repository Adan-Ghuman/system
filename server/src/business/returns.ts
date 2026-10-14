import { Types } from 'mongoose';
import { z } from 'zod';
import { BusinessDocument } from './commerce.models.js';
import { Dispatch } from '../models/Dispatch.js';
import { postCommand, nextDocumentNo, weight, money } from './posting.js';
import { moveFabric } from './stock.js';
import { postPartyAmount } from './finance.js';
import { businessContext } from './context.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export const returnInput = z.object({ requestId: z.string().uuid(), date: z.string().datetime(), reason: z.string().trim().min(3).max(1000), items: z.array(z.object({ lineId: z.string(), rolls: z.number().int().nonnegative(), weightKg: z.number().nonnegative() })).min(1).max(100) });
export async function postReturn(id: string, input: z.infer<typeof returnInput>) {
  return postCommand('SOURCE_RETURN', { ...input, id }, async session => {
    const original = await BusinessDocument.findOne({ _id: id, status: 'POSTED' }).session(session);
    if (!original?.partyId) throw new NotFoundError('Posted bill not found.');
    if (original.intercompanyId || ['CREDIT_NOTE', 'FABRIC_RECEIPT'].includes(original.kind)) throw new BadRequestError('Open the original sale, purchase or processing bill. Linked trades require a paired correction.');
    if (new Date(input.date) < original.date) throw new BadRequestError('The return cannot be earlier than the bill.');
    const purchase = original.kind === 'FABRIC_PURCHASE' || original.kind === 'SUPPLIER_BILL';
    const sale = original.kind === 'CUSTOMER_BILL';
    const delivery = sale ? await Dispatch.findOne({ _id: original.sourceId, status: 'POSTED' }).session(session) : null;
    if (sale && !delivery) throw new BadRequestError('The original delivery is unavailable.');
    const previous = await BusinessDocument.find({ sourceId: id, kind: 'CREDIT_NOTE', status: 'POSTED' }).session(session);
    const items = [];let baseAmount = 0;const seen = new Set<string>();
    const creditId = new Types.ObjectId();
    for (const entry of input.items) {
      if (seen.has(entry.lineId)) throw new BadRequestError('A bill line can appear only once.');seen.add(entry.lineId);
      const line = original.items.find(item => String(item._id) === entry.lineId);if (!line) throw new BadRequestError('Original bill line not found.');
      const already = previous.flatMap(document => document.items).filter(item => item.sourceLineId === entry.lineId);
      if (entry.rolls + already.reduce((sum, item) => sum + item.rolls, 0) > line.rolls || weight(entry.weightKg + already.reduce((sum, item) => sum + item.weightKg, 0)) > line.weightKg) throw new BadRequestError('The return exceeds the quantity on the original bill.');
      if ((purchase || sale) && (!entry.rolls || !entry.weightKg)) throw new BadRequestError('Fabric returns need positive rolls and measured kg.');
      const fraction = line.basis === 'KG' ? entry.weightKg / line.weightKg : line.basis === 'ROLL' ? entry.rolls / line.rolls : previous.length ? 0 : 1;
      if (!(fraction > 0)) throw new BadRequestError('Enter a positive credited quantity. A fixed job can be credited once.');
      const value = { ...line.toObject(), _id: undefined, sourceLineId: entry.lineId, rolls: entry.rolls, weightKg: entry.weightKg };
      items.push(value);baseAmount = money(baseAmount + money((line.basis === 'KG' ? entry.weightKg : line.basis === 'ROLL' ? entry.rolls : 1) * line.rate));
      if (purchase || sale) await moveFabric(value, delivery?.fromLocation || original.location, purchase ? -1 : 1, creditId, new Date(input.date), `Return: ${input.reason}`, session);
    }
    const taxAmount = money(baseAmount * original.taxPercent / 100), total = money(baseAmount + taxAmount);
    if (money(original.credited + total) > original.total) throw new BadRequestError('The credit exceeds the remaining bill amount.');
    const number = await nextDocumentNo('CN', session);
    const [credit] = await BusinessDocument.create([{ _id: creditId, kind: 'CREDIT_NOTE', direction: original.direction === 'PAYABLE' ? 'RECEIVABLE' : 'PAYABLE', number, sourceId: original._id, partyId: original.partyId, date: new Date(input.date), reference: original.number, location: delivery?.fromLocation || original.location, items, baseAmount, taxPercent: original.taxPercent, taxAmount, total, remarks: input.reason, actorId: businessContext.getStore()!.actorId }], { session });
    await postPartyAmount(original.partyId, original.direction === 'PAYABLE' ? total : -total, creditId, number, new Date(input.date), `Credit against ${original.number}: ${input.reason}`, session);
    original.credited = money(original.credited + total);await original.save({ session });return credit.toObject();
  });
}
