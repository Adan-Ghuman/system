import { z } from 'zod';

export const createUserSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').trim(),
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  role: z.enum(['admin', 'operator', 'viewer']).default('operator'),
  permissions: z.array(z.string()).default([])
});

export const queryUsersSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  skip: z.coerce.number().optional()
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type QueryUsersInput = z.infer<typeof queryUsersSchema>;
