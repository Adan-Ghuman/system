import { z } from 'zod';

export const createYarnTransactionSchema = z.object({
  transactionType: z.enum(['OUTWARD_TO_KNITTER', 'INWARD_FROM_CLIENT']),
  partyId: z.string().min(1, 'Party ID is required'),
  yarnSpec: z.string().min(1, 'Yarn specification is required').trim(),
  gatePassNo: z.string().min(1, 'Gate Pass number is required').trim(),
  date: z.string().datetime().optional().default(() => new Date().toISOString()),
  boxCount: z.number().int().min(1, 'Box count must be at least 1'),
  netWeightPerBox: z.number().positive('Net weight per box must be positive'),
  wastagePercent: z.number().min(0).max(10).optional().default(1.0),
  remarks: z.string().optional().default('')
});

export const receiveFabricItemSchema = z.object({
  fabricType: z.string().trim().optional().default('Single Jersey'),
  yarnSpec: z.string().min(1, 'Yarn specification is required').trim(),
  rollsCount: z.number().int().min(1, 'Roll count must be at least 1'),
  weightKg: z.number().positive('Received weight must be positive'),
  remarks: z.string().optional().default('')
});

export const receiveFabricSchema = z.object({
  partyId: z.string().min(1, 'Party is required'),
  partyName: z.string().optional(),
  date: z.string().datetime().optional().default(() => new Date().toISOString()),
  gatePassNo: z.string().optional().default(''),
  remarks: z.string().optional().default(''),
  // Single-item fallback fields for backwards compatibility
  yarnSpec: z.string().trim().optional(),
  fabricType: z.string().trim().optional(),
  rollsCount: z.number().int().min(1).optional(),
  weightKg: z.number().positive().optional(),
  // Multi-item array
  items: z.array(receiveFabricItemSchema).optional()
}).refine(
  (data) => (data.items && data.items.length > 0) || (data.yarnSpec && data.weightKg),
  { message: 'At least one fabric line item is required', path: ['items'] }
);

export const queryTransactionsSchema = z.object({
  partyId: z.string().optional(),
  transactionType: z.enum(['OUTWARD_TO_KNITTER', 'INWARD_FROM_CLIENT']).optional(),
  yarnSpec: z.string().optional(),
  search: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  skip: z.coerce.number().optional()
});

export const updateYarnTransactionSchema = z.object({
  partyId: z.string().optional(),
  yarnSpec: z.string().min(1).trim().optional(),
  gatePassNo: z.string().min(1).trim().optional(),
  date: z.string().optional(),
  boxCount: z.number().int().min(1).optional(),
  netWeightPerBox: z.number().positive().optional(),
  wastagePercent: z.number().min(0).max(10).optional(),
  remarks: z.string().optional()
});

export const createYarnSpecSchema = z.object({
  name: z.string().min(1, 'Specification name is required').trim(),
  category: z.enum(['Polyester', 'Cotton', 'Spandex', 'Blended', 'Viscose', 'Other']).optional().default('Polyester'),
  description: z.string().optional().default(''),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().optional().default(0)
});

export const updateYarnSpecSchema = z.object({
  name: z.string().min(1, 'Specification name cannot be empty').trim().optional(),
  category: z.enum(['Polyester', 'Cotton', 'Spandex', 'Blended', 'Viscose', 'Other']).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
  propagateToTransactions: z.boolean().optional().default(false)
});

export const bulkRenameYarnSpecSchema = z.object({
  oldSpec: z.string().min(1, 'Old specification name is required').trim(),
  newSpec: z.string().min(1, 'New specification name is required').trim(),
  addToCatalogIfMissing: z.boolean().optional().default(true),
  category: z.enum(['Polyester', 'Cotton', 'Spandex', 'Blended', 'Viscose', 'Other']).optional().default('Polyester')
});

export const yarnLineItemSchema = z.object({
  yarnSpec: z.string().min(1, 'Yarn specification is required').trim(),
  boxCount: z.number().int().min(1, 'Box count must be at least 1'),
  netWeightPerBox: z.number().positive('Net weight per box must be positive'),
  wastagePercent: z.number().min(0).max(10).optional().default(1.0),
  remarks: z.string().optional().default('')
});

export const createBulkYarnTransactionSchema = z.object({
  transactionType: z.enum(['OUTWARD_TO_KNITTER', 'INWARD_FROM_CLIENT']),
  partyId: z.string().min(1, 'Party ID is required'),
  gatePassNo: z.string().min(1, 'Gate Pass number is required').trim(),
  date: z.string().optional().default(() => new Date().toISOString()),
  remarks: z.string().optional().default(''),
  items: z.array(yarnLineItemSchema).min(1, 'At least one yarn item is required')
});

export type CreateYarnTransactionInput = z.infer<typeof createYarnTransactionSchema>;
export type CreateBulkYarnTransactionInput = z.infer<typeof createBulkYarnTransactionSchema>;
export type YarnLineItemInput = z.infer<typeof yarnLineItemSchema>;
export type UpdateYarnTransactionInput = z.infer<typeof updateYarnTransactionSchema>;
export type ReceiveFabricInput = z.infer<typeof receiveFabricSchema>;
export type QueryTransactionsInput = z.infer<typeof queryTransactionsSchema>;
export type CreateYarnSpecInput = z.infer<typeof createYarnSpecSchema>;
export type UpdateYarnSpecInput = z.infer<typeof updateYarnSpecSchema>;
export type BulkRenameYarnSpecInput = z.infer<typeof bulkRenameYarnSpecSchema>;

