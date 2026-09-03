import { z } from 'zod';

export const createPartySchema = z.object({
  code: z.string().trim().toUpperCase().optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  contactPerson: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
  mlNo: z.string().trim().optional().default(''),
  tags: z.object({
    isYarnClient: z.boolean().default(false),
    isKnitter: z.boolean().default(false),
    isFabricBuyer: z.boolean().default(false),
    isDyeingMill: z.boolean().default(false)
  }).default({
    isYarnClient: false,
    isKnitter: false,
    isFabricBuyer: false,
    isDyeingMill: false
  }),
  openingBalance: z.number().default(0)
});

export const updatePartySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim().optional(),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  mlNo: z.string().trim().optional(),
  tags: z.object({
    isYarnClient: z.boolean().optional(),
    isKnitter: z.boolean().optional(),
    isFabricBuyer: z.boolean().optional(),
    isDyeingMill: z.boolean().optional()
  }).optional(),
  isActive: z.boolean().optional()
});

export const queryPartiesSchema = z.object({
  search: z.string().optional(),
  tag: z.enum(['isYarnClient', 'isKnitter', 'isFabricBuyer', 'isDyeingMill']).optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  skip: z.coerce.number().optional()
});

export type CreatePartyInput = z.infer<typeof createPartySchema>;
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
export type QueryPartiesInput = z.infer<typeof queryPartiesSchema>;
