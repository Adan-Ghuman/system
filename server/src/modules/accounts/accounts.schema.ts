import { z } from 'zod';

export const voucherTypeEnum = z.enum(['RECEIPT', 'PAYMENT', 'JOURNAL']);
export const paymentModeEnum = z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE']);

export const createVoucherSchema = z.object({
  voucherType: voucherTypeEnum,
  paymentMode: paymentModeEnum,
  partyId: z.string().min(1, 'Party is required'),
  amount: z.number().positive('Amount must be positive'),
  date: z.string().datetime().optional().default(() => new Date().toISOString()),
  bankName: z.string().optional().default(''),
  chequeNo: z.string().optional().default(''),
  chequeDate: z.string().datetime().optional(),
  transactionRef: z.string().optional().default(''),
  remarks: z.string().optional().default('')
});

export const queryVouchersSchema = z.object({
  partyId: z.string().optional(),
  voucherType: voucherTypeEnum.optional(),
  paymentMode: paymentModeEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  skip: z.coerce.number().optional()
});

export const queryLedgerSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

export type CreateVoucherInput = z.infer<typeof createVoucherSchema>;
export type QueryVouchersInput = z.infer<typeof queryVouchersSchema>;
export type QueryLedgerInput = z.infer<typeof queryLedgerSchema>;
