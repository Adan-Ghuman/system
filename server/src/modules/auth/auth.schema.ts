import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  password: z.string().min(6, 'Password must be at least 6 characters long')
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long').max(128),
  confirmPassword: z.string()
}).refine((value) => value.newPassword === value.confirmPassword, {
  path: ['confirmPassword'], message: 'Passwords do not match'
}).refine((value) => value.currentPassword !== value.newPassword, {
  path: ['newPassword'], message: 'Choose a password different from your current password'
});
