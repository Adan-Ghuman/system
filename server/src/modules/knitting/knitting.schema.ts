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

export const receiveFabricSchema = z.object({
  partyId: z.string().min(1, 'Party ID is required'),
  yarnSpec: z.string().min(1, 'Yarn specification is required').trim(),
  rollsCount: z.number().int().min(1, 'Roll count must be at least 1'),
  weightKg: z.number().positive('Received weight must be positive'),
  date: z.string().datetime().optional().default(() => new Date().toISOString()),
  gatePassNo: z.string().optional().default(''),
  remarks: z.string().optional().default('')
});

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

export type CreateYarnTransactionInput = z.infer<typeof createYarnTransactionSchema>;
export type UpdateYarnTransactionInput = z.infer<typeof updateYarnTransactionSchema>;
export type ReceiveFabricInput = z.infer<typeof receiveFabricSchema>;
export type QueryTransactionsInput = z.infer<typeof queryTransactionsSchema>;

