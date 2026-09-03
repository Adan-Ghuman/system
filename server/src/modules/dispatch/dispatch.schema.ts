import { z } from 'zod';
import { locationEnum } from '../inventory/inventory.schema.js';

export const dispatchRollInputSchema = z.object({
  rollNumber: z.number().int().min(1),
  grossWeightKg: z.number().positive(),
  tareKg: z.number().min(0).default(0),
  netWeightKg: z.number().positive()
});

export const createDispatchSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  fromLocation: locationEnum,
  fabricType: z.string().min(1, 'Fabric type is required').trim(),
  yarnSpec: z.string().min(1, 'Yarn spec is required').trim(),
  color: z.string().min(1, 'Color is required').trim().toUpperCase(),
  rolls: z.array(dispatchRollInputSchema).min(1, 'At least one roll is required for dispatch'),
  ratePerKg: z.number().positive('Rate per Kg must be positive'),
  invoiceType: z.enum(['TAX_18_PERCENT', 'NON_GST']),
  driverName: z.string().optional().default(''),
  vehicleNo: z.string().optional().default(''),
  date: z.string().datetime().optional().default(() => new Date().toISOString()),
  remarks: z.string().optional().default('')
});

export const queryDispatchesSchema = z.object({
  customerId: z.string().optional(),
  fromLocation: locationEnum.optional(),
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  skip: z.coerce.number().optional()
});

export type CreateDispatchInput = z.infer<typeof createDispatchSchema>;
export type QueryDispatchesInput = z.infer<typeof queryDispatchesSchema>;
