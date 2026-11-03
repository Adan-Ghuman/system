import { z } from 'zod';
import { itemInput, additionalChargeInput } from './commerce.schema.js';
import { dispatchRollInputSchema } from '../modules/dispatch/dispatch.schema.js';
import { documentReferenceFields } from './references.js';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Choose a saved record.');
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(new Date(value).valueOf()) && new Date(value).toISOString().slice(0, 10) === value, 'Enter a valid date.');
export const saleInput = z.object({
  ...documentReferenceFields,
  requestId: z.string().uuid(), customerId: objectId,
  mode: z.enum(['FABRIC', 'EXISTING_DELIVERY', 'KNITTING_CHARGE', 'DYEING_CHARGE']),
  date: z.string().datetime(), reference: z.string().trim().max(150).default(''), remarks: z.string().trim().max(1000).default(''),
  location: z.string().trim().max(80).default('ZR_GODOWN'), inventoryId: objectId.optional(), sourceId: objectId.optional(), draftId: objectId.optional(),
  billNow: z.boolean().default(true), sourceMode: z.enum(['WORK', 'PAPER']).default('WORK'),
  paper: z.object({ confirmed: z.literal(true), reason: z.string().trim().min(10).max(1000), periodFrom: day.optional(), periodTo: day.optional() }).optional(),
  items: z.array(itemInput.extend({ rolls: z.number().int().nonnegative().default(0), weightKg: z.number().finite().nonnegative().default(0), rate: z.number().finite().nonnegative().default(0) })).min(1).max(100), rolls: z.array(dispatchRollInputSchema).max(2000).default([]),
  taxPercent: z.union([z.literal(0), z.literal(18)]).default(0), additionalCharges: z.array(additionalChargeInput).max(20).default([]),
  driverName: z.string().trim().max(150).default(''), vehicleNo: z.string().trim().max(150).default(''),
  payment: z.object({ kind: z.enum(['LATER', 'PART', 'FULL', 'EXISTING', 'UNKNOWN']).default('LATER'), amount: z.number().finite().nonnegative().multipleOf(0.01).default(0), date: z.string().datetime().optional(), method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE']).default('CASH'), bankName: z.string().trim().max(150).default(''), chequeNo: z.string().trim().max(100).default(''), chequeDate: z.string().datetime().optional(), transactionRef: z.string().trim().max(150).default(''), voucherId: objectId.optional() }).default({})
}).superRefine((input, ctx) => {
  const fail = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  const service = ['KNITTING_CHARGE', 'DYEING_CHARGE'].includes(input.mode);
  if (input.mode === 'FABRIC' && ((!input.inventoryId && !input.shortageReason) || !input.rolls.length || input.items.length !== 1)) fail('inventoryId', 'Choose fabric stock and enter its roll weights.');
  if (input.mode === 'FABRIC' && input.additionalCharges.length) fail('additionalCharges', 'Additional charges can be entered when billing an existing delivery.');
  if (input.mode === 'FABRIC' && input.items[0].basis !== 'KG') fail('items', 'Fabric delivery rates use measured kg.');
  if (input.mode !== 'FABRIC' && !input.billNow) fail('billNow', 'Only a new delivery can be billed later.');
  if (input.sourceMode === 'PAPER' && (!service || !input.paper || !input.reference)) fail('paper', 'A paper service bill needs its reference, confirmation and evidence note.');
  if (input.mode !== 'FABRIC' && input.sourceMode !== 'PAPER' && !input.sourceId && !input.items.every(i => i.sourceId)) fail('sourceId', 'Choose the delivery or completed work being billed.');
  if (input.payment.kind === 'UNKNOWN' && !(service && input.sourceMode === 'PAPER')) fail('payment', 'Unknown payment history is available for existing paper service bills.');
  if (input.payment.kind === 'EXISTING' && !input.payment.voucherId) fail('payment', 'Choose the existing receipt to link.');
  if (!input.billNow && input.payment.kind !== 'LATER') fail('payment', 'A delivery without a bill cannot receive a bill payment.');
  if (input.paper?.periodFrom && input.paper.periodTo && input.paper.periodFrom > input.paper.periodTo) fail('paper', 'The service period end must follow its start.');
  if (input.paper?.periodTo && input.paper.periodTo > input.date.slice(0, 10)) fail('date', 'The bill date cannot precede the completed service period.');
});
export type SaleInput = z.infer<typeof saleInput>;
export const sourceAssignmentInput = z.object({ requestId: z.string().uuid(), customerId: objectId, kind: z.enum(['KNITTING_CHARGE', 'DYEING_CHARGE']), sourceId: objectId, sourceLineId: objectId, reason: z.string().trim().min(10).max(1000) });
