import { z } from 'zod';

export const locationEnum = z.enum(['ZR_GODOWN', 'GHUMMAN_DYEING', 'RAJPUT_DYEING']);
export const stateEnum = z.enum(['RAW_ECRU', 'FINISHED_DYED']);
export const reasonEnum = z.enum([
  'AUDIT_DISCREPANCY',
  'DAMAGE',
  'SAMPLE_CUTTING',
  'SCRAP',
  'MANUAL_CORRECTION'
]);

export const createTransferSchema = z
  .object({
    fromLocation: locationEnum,
    toLocation: locationEnum,
    fabricType: z.string().min(1, 'Fabric type is required').trim(),
    yarnSpec: z.string().min(1, 'Yarn spec is required').trim(),
    state: stateEnum,
    color: z.string().min(1, 'Color is required').trim().toUpperCase(),
    rollsCount: z.number().int().min(1, 'Rolls count must be at least 1'),
    weightKg: z.number().positive('Weight must be positive'),
    gatePassNo: z.string().optional().default(''),
    driverName: z.string().optional().default(''),
    vehicleNo: z.string().optional().default(''),
    date: z.string().datetime().optional().default(() => new Date().toISOString()),
    remarks: z.string().optional().default('')
  })
  .refine((data) => data.fromLocation !== data.toLocation, {
    message: 'Source and destination locations cannot be identical',
    path: ['toLocation']
  });

export const createAdjustmentSchema = z.object({
  fabricType: z.string().min(1, 'Fabric type is required').trim(),
  yarnSpec: z.string().min(1, 'Yarn spec is required').trim(),
  state: stateEnum,
  color: z.string().min(1, 'Color is required').trim().toUpperCase(),
  location: locationEnum,
  adjustmentRolls: z.number().int(),
  adjustmentWeightKg: z.number(),
  reason: reasonEnum,
  date: z.string().datetime().optional().default(() => new Date().toISOString()),
  remarks: z.string().optional().default('')
});

export const queryInventorySchema = z.object({
  location: locationEnum.optional(),
  state: stateEnum.optional(),
  fabricType: z.string().optional(),
  color: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  skip: z.coerce.number().optional()
});

export const queryTransfersSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  skip: z.coerce.number().optional()
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
export type QueryInventoryInput = z.infer<typeof queryInventorySchema>;
export type QueryTransfersInput = z.infer<typeof queryTransfersSchema>;
