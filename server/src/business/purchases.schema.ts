import { canonicalOwnerKey } from './ownership.js';
import { z } from 'zod';
import { itemInput, additionalChargeInput } from './commerce.schema.js';
import { saleInput } from './sales.schema.js';
import { documentReferenceFields } from './references.js';
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Choose a saved record.');
export const purchaseInput = z.object({
  ...documentReferenceFields, requestId: z.string().uuid(), draftId: objectId.optional(),
  partyId: objectId, mode: z.enum(['YARN', 'FABRIC', 'KNITTING', 'DYEING']), situation: z.enum(['NOW', 'EXISTING', 'PAPER']).default('NOW'),
  date: z.string().datetime(), receiptDate: z.string().datetime().optional(), reference: z.string().trim().max(150).default(''), receiptReference: z.string().trim().max(150).default(''),
  location: z.string().trim().max(80).default('ZR_GODOWN'), remarks: z.string().trim().max(1000).default(''), billNow: z.boolean().default(true),
  ownerKey: z.string().default('OWN').transform(canonicalOwnerKey).refine(value => value === 'OWN' || /^[a-f0-9]{24}$/i.test(value), 'Choose the material owner.'), productionType: z.enum(['IN_HOUSE', 'OUTSOURCED']).default('OUTSOURCED'),
  receiptOrigin: z.enum(['BATCH', 'EXTERNAL']).default('BATCH'), evidence: z.object({ confirmed: z.literal(true), reason: z.string().trim().min(10).max(1000) }).optional(),
  items: z.array(itemInput.extend({ rolls: z.number().int().nonnegative().max(2000000).default(0), weightKg: z.number().finite().nonnegative().max(1e9).multipleOf(0.001).default(0), rate: z.number().finite().nonnegative().default(0), wastageKg: z.number().finite().nonnegative().optional(), batchId: objectId.optional(), rawKg: z.number().finite().positive().optional(), rawRolls: z.number().int().positive().optional(), components: z.array(z.object({ yarnSpec: z.string().trim().min(1), weightKg: z.number().finite().positive() })).max(20).optional() })).min(1).max(100),
  additionalCharges: z.array(additionalChargeInput).max(20).default([]), taxPercent: z.union([z.literal(0), z.literal(18)]).default(0), payment: saleInput.innerType().shape.payment
}).superRefine((input, ctx) => {
  const fail = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (input.situation !== 'NOW' && !input.billNow) fail('billNow', 'Choose arriving now to record a receipt without its bill.');
  if (input.billNow && !input.reference) fail('reference', 'Enter the supplier bill number.');
  if (input.situation === 'NOW' && !input.receiptReference) fail('receiptReference', 'Enter the goods or work receipt challan number.');
  if (input.situation === 'PAPER' && !input.evidence) fail('evidence', 'Verify the original bill and explain its missing operational history.');
  if (input.mode === 'DYEING' && input.situation === 'NOW' && input.receiptOrigin === 'EXTERNAL' && !input.evidence) fail('evidence', 'Confirm the material owner and external mill return evidence.');
  if (input.situation === 'EXISTING' && input.items.some(i => !i.sourceId || !i.sourceLineId)) fail('items', 'Choose the receipts and quantities to bill.');
  if (input.payment.kind === 'UNKNOWN' && input.situation !== 'PAPER') fail('payment', 'Unknown settlement is only for historical bills.');
  if (!input.billNow && input.payment.kind !== 'LATER') fail('payment', 'A receipt without a bill cannot record a bill payment.');
  if (input.payment.kind === 'EXISTING' && !input.payment.voucherId) fail('payment', 'Choose an existing supplier payment.');
  if (input.mode === 'KNITTING' && input.situation === 'NOW' && input.productionType === 'IN_HOUSE' && input.billNow) fail('billNow', 'In-house production cannot create an external knitter bill. Save the production receipt only.');
  if (input.receiptDate && input.situation === 'NOW' && input.receiptDate > input.date && input.billNow) fail('date', 'The bill date cannot precede its receipt.');
});
export type PurchaseInput = z.infer<typeof purchaseInput>;
export const purchaseKinds = { YARN: 'YARN_SUPPLIER_BILL', FABRIC: 'SUPPLIER_BILL', KNITTING: 'KNITTING_CHARGE', DYEING: 'DYEING_CHARGE' } as const;
