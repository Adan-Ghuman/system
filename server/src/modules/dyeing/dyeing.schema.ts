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
  customMillName: z.string().trim().optional().default(''),
  fabricType: z.string().min(1, 'Fabric type is required').trim(),
  yarnSpec: z.string().trim().optional(),
  yarnSpecs: z.array(z.string().trim()).optional(),
  targetColor: z.string().min(1, 'Target color is required').trim().toUpperCase(),
  ogpNo: z.string().optional().default(''),
  igpNo: z.string().optional().default(''),
  dateIssued: z.string().datetime().optional().default(() => new Date().toISOString()),
  ecruRollsCount: z.number().int().min(1, 'Ecru roll count must be at least 1'),
  ecruWeightKg: z.number().positive('Ecru weight must be positive'),
  allocatedCustomerId: z.string().optional(),
  remarks: z.string().optional().default('')
}).refine(
  (data) => (data.yarnSpec && data.yarnSpec.length > 0) || (data.yarnSpecs && data.yarnSpecs.length > 0),
  { message: 'At least one yarn specification is required', path: ['yarnSpec'] }
);

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
  customMillName: z.string().trim().optional(),
  fabricType: z.string().min(1).trim().optional(),
  yarnSpec: z.string().trim().optional(),
  yarnSpecs: z.array(z.string().trim()).optional(),
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
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  skip: z.coerce.number().optional()
});

export const createDyeingUnitSchema = z.object({
  code: z.string().min(1, 'Unit code is required').trim().toUpperCase(),
  name: z.string().min(1, 'Unit name is required').trim(),
  shortName: z.string().min(1, 'Short display label is required').trim(),
  type: z.enum(['DYEING_MILL', 'GODOWN', 'OTHER']).optional().default('DYEING_MILL'),
  partyId: z.string().optional(),
  address: z.string().optional().default(''),
  contactPhone: z.string().optional().default(''),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().optional().default(0)
});

export const updateDyeingUnitSchema = z.object({
  name: z.string().min(1, 'Unit name cannot be empty').trim().optional(),
  shortName: z.string().min(1, 'Short display label cannot be empty').trim().optional(),
  type: z.enum(['DYEING_MILL', 'GODOWN', 'OTHER']).optional(),
  partyId: z.string().nullable().optional(),
  address: z.string().optional(),
  contactPhone: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional()
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type SettleBatchInput = z.infer<typeof settleBatchSchema>;
export type QueryBatchesInput = z.infer<typeof queryBatchesSchema>;
export type CreateDyeingUnitInput = z.infer<typeof createDyeingUnitSchema>;
export type UpdateDyeingUnitInput = z.infer<typeof updateDyeingUnitSchema>;

