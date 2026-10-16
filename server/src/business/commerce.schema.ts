import { z } from 'zod';
import { documentReferenceFields } from './references.js';

export const operationKinds = ['FABRIC_RECEIPT', 'FABRIC_PURCHASE', 'SUPPLIER_BILL', 'CUSTOMER_BILL', 'KNITTING_CHARGE', 'DYEING_CHARGE', 'YARN_ADJUSTMENT', 'YARN_RETURN'] as const;
export const itemInput = z.object({
  fabricType: z.string().trim().max(150).default(''), yarnSpec: z.string().trim().max(150).default(''),
  color: z.string().trim().max(120).default('ECRU'), state: z.enum(['RAW_ECRU', 'FINISHED_DYED']).default('RAW_ECRU'),
  rolls: z.number().int().default(0), weightKg: z.number().finite().default(0), rate: z.number().nonnegative().default(0),
  basis: z.enum(['KG', 'ROLL', 'JOB']).default('KG'), description: z.string().trim().max(500).default(''), sourceLineId: z.string().default(''),
  packageUnit: z.enum(['cartons', 'bags', 'cones', 'packages']).default('cartons'), ownerKey: z.string().default('OWN')
});
export const operationInput = z.object({
  ...documentReferenceFields, receiptOrigin: z.enum(['EXTERNAL_MILL']).optional(), kind: z.enum(operationKinds), direction: z.enum(['PAYABLE', 'RECEIVABLE']).default('PAYABLE'),
  partyId: z.string().optional(), date: z.string().refine(value => Number.isFinite(new Date(value).valueOf()), 'Enter a valid date.'),
  reference: z.string().trim().max(150).default(''), location: z.string().trim().max(80).default('ZR_GODOWN'), items: z.array(itemInput).min(1).max(100),
  remarks: z.string().trim().max(1000).default(''), taxPercent: z.union([z.literal(0), z.literal(18)]).default(0), sourceId: z.string().optional()
});
export type OperationInput = z.infer<typeof operationInput>;
export type OperationItem = z.infer<typeof itemInput>;
