import { Types } from 'mongoose';
import { Dispatch } from '../models/Dispatch.js';
import { Invoice } from '../models/Invoice.js';
import { Party } from '../models/Party.js';
import { BusinessDocument, BillAllocation } from './commerce.models.js';
import { postCommand, nextDocumentNo, weight } from './posting.js';
import { moveFabric, validateLocation } from './stock.js';
import { postPartyAmount } from './finance.js';
import { referenceFields } from './references.js';
import { businessContext } from './context.js';
import { calculateInvoiceFinancials } from '../modules/dispatch/dispatch.service.js';
import { CreateDispatchInput } from '../modules/dispatch/dispatch.schema.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export async function postDelivery(input: CreateDispatchInput) {
  return postCommand('DELIVERY', input, async session => {
    const draft = input.draftId ? await BusinessDocument.findOne({ _id: input.draftId, kind: 'DELIVERY_DRAFT', status: 'DRAFT' }).session(session) : null;
    if (input.draftId && !draft) throw new BadRequestError('This delivery draft was already posted or is unavailable in this business.');
    const party = await Party.findById(input.customerId).session(session);
    if (!party) throw new NotFoundError('Choose a customer in this business.');
    await validateLocation(input.fromLocation, session);
    if (input.fromLocation === 'IN_TRANSIT') throw new BadRequestError('Receive the goods into store before delivering them.');
    const numbers = new Set<number>();
    const rolls = input.rolls.map(roll => {
      if (numbers.has(roll.rollNumber)) throw new BadRequestError('Roll numbers must be unique within this delivery.');
      numbers.add(roll.rollNumber);
      const netWeightKg = weight(roll.grossWeightKg - roll.tareKg);
      if (netWeightKg <= 0) throw new BadRequestError('Each roll needs gross weight greater than tare weight.');
      return { ...roll, grossWeightKg: weight(roll.grossWeightKg), tareKg: weight(roll.tareKg), netWeightKg };
    });
    const totalNetWeightKg = weight(rolls.reduce((sum, roll) => sum + roll.netWeightKg, 0));
    const date = new Date(input.date), id = new Types.ObjectId();
    await moveFabric({ fabricType: input.fabricType, yarnSpec: input.yarnSpec, state: input.state, color: input.color, ownerKey: 'OWN', rolls: rolls.length, weightKg: totalNetWeightKg }, input.fromLocation, -1, id, date, 'Customer delivery', session);
    const [dispatch] = await Dispatch.create([{ _id: id, ...input, ...referenceFields(input), dispatchNo: await nextDocumentNo('DSP', session), ogpNo: await nextDocumentNo('OGP-DISP', session), rolls, totalRolls: rolls.length, totalNetWeightKg, date, status: 'POSTED' }], { session });
    if (draft) { draft.status = 'POSTED';draft.sourceId = id;draft.reference = dispatch.dispatchNo;await draft.save({ session }); }
    if (!input.billNow) return { dispatch, invoice: null };
    const financials = calculateInvoiceFinancials(totalNetWeightKg, input.ratePerKg, input.invoiceType);
    const invoiceNo = await nextDocumentNo(input.invoiceType === 'NON_GST' ? 'INV-NT' : 'INV-GST', session);
    const [invoice] = await Invoice.create([{ ...financials, invoiceNo, invoiceType: input.invoiceType, dispatchId: id, customerId: party._id, ratePerKg: input.ratePerKg, totalWeightKg: totalNetWeightKg, date, ...referenceFields(input), remarks: input.remarks }], { session });
    await BusinessDocument.create([{ _id: invoice._id, number: invoiceNo, kind: 'CUSTOMER_BILL', direction: 'RECEIVABLE', partyId: party._id, date, ...referenceFields(input), reference: dispatch.ogpNo, location: input.fromLocation, sourceId: id, items: [{ fabricType: input.fabricType, yarnSpec: input.yarnSpec, color: input.color, state: input.state, rolls: rolls.length, weightKg: totalNetWeightKg, rate: input.ratePerKg, basis: 'KG', sourceLineId: String(id) }], baseAmount: financials.baseAmount, taxPercent: financials.taxPercent, taxAmount: financials.taxAmount, total: financials.grandTotal, actorId: businessContext.getStore()!.actorId }], { session });
    await BillAllocation.create([{ sourceId: id, sourceLineId: String(id), direction: 'RECEIVABLE', billId: invoice._id, fraction: 1 }], { session });
    await postPartyAmount(party._id, financials.grandTotal, invoice._id, invoiceNo, date, `Delivery ${dispatch.dispatchNo}`, session);
    return { dispatch, invoice };
  });
}

export async function reverseDelivery(id: string, input: { reason: string; requestId?: string }) {
  return postCommand('REVERSE_DELIVERY', { ...input, id }, async session => {
    const dispatch = await Dispatch.findOne({ _id: id, status: 'POSTED' }).session(session);
    if (!dispatch) throw new NotFoundError('Posted delivery not found.');
    const bills = await BusinessDocument.find({ sourceId: id, status: 'POSTED' }).session(session);
    if (bills.some(bill => bill.paid > 0)) throw new BadRequestError('Reverse its recorded payments before reversing this delivery.');
    if (bills.some(bill => bill.credited > 0)) throw new BadRequestError('Reverse its return / credit notes before reversing this delivery.');
    for (const bill of bills) {
      if (bill.partyId) await postPartyAmount(bill.partyId, -bill.total, bill._id, bill.number, new Date(), `Delivery reversed: ${input.reason}`, session);
      bill.status = 'REVERSED';bill.remarks += ` | ${input.reason}`;await bill.save({ session });
    }
    await BillAllocation.deleteMany({ sourceId: id }).session(session);
    await moveFabric({ fabricType: dispatch.fabricType, yarnSpec: dispatch.yarnSpec, state: dispatch.state || 'FINISHED_DYED', color: dispatch.color, ownerKey: 'OWN', rolls: dispatch.totalRolls, weightKg: dispatch.totalNetWeightKg }, dispatch.fromLocation, 1, dispatch._id, new Date(), `Delivery reversed: ${input.reason}`, session);
    dispatch.status = 'REVERSED';dispatch.remarks = `${dispatch.remarks || ''} | ${input.reason}`;await dispatch.save({ session });
    return dispatch.toObject();
  });
}
