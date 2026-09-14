import { z } from 'zod';

export const millNameEnum = z.enum([
  'GHUMMAN_DYEING',
  'RAJPUT_DYEING',
  'HAFIZ_SAAD_DYEING',
  'HB_DYEING',
  'OTHER'
]);

export const createBatchSchema = z.object({
  batchNo: z.string().trim().toUpperCase().optional(),
  millName: millNameEnum,
  millPartyId: z.string().optional(),
  fabricType: z.string().min(1, 'Fabric type is required').trim(),
  yarnSpec: z.string().min(1, 'Yarn specification is required').trim(),
  targetColor: z.string().min(1, 'Target color is required').trim().toUpperCase(),
  ogpNo: z.string().optional().default(''),
  igpNo: z.string().optional().default(''),
  dateIssued: z.string().datetime().optional().default(() => new Date().toISOString()),
  ecruRollsCount: z.number().int().min(1, 'Ecru roll count must be at least 1'),
  ecruWeightKg: z.number().positive('Ecru weight must be positive'),
  allocatedCustomerId: z.string().optional(),
  remarks: z.string().optional().default('')
});

export const settleBatchSchema = z.object({
  finishRollsCount: z.number().int().min(1, 'Finish roll count must be at least 1'),
  finishWeightKg: z.number().positive('Finished weight must be positive'),
  dateReceived: z.string().datetime().optional().default(() => new Date().toISOString()),
  igpNo: z.string().optional(),
  remarks: z.string().optional()
});

export const updateBatchSchema = z.object({
  batchNo: z.string().trim().toUpperCase().optional(),
  millName: millNameEnum.optional(),
  millPartyId: z.string().optional(),
  fabricType: z.string().min(1).trim().optional(),
  yarnSpec: z.string().min(1).trim().optional(),
  targetColor: z.string().min(1).trim().toUpperCase().optional(),
  ogpNo: z.string().optional(),
  igpNo: z.string().optional(),
  dateIssued: z.string().optional(),
  ecruRollsCount: z.number().int().min(1).optional(),
  ecruWeightKg: z.number().positive().optional(),
  finishRollsCount: z.number().int().min(0).optional(),
  finishWeightKg: z.number().min(0).optional(),
  allocatedCustomerId: z.string().nullable().optional(),
  remarks: z.string().optional()
});

export const queryBatchesSchema = z.object({
  millName: millNameEnum.optional(),
  status: z.enum(['ISSUED', 'IN_PROCESS', 'COMPLETED', 'ACTIVE']).optional(),
  fabricType: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  skip: z.coerce.number().optional()
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type SettleBatchInput = z.infer<typeof settleBatchSchema>;
export type QueryBatchesInput = z.infer<typeof queryBatchesSchema>;

