import { z } from 'zod';

export const shortageReasonField = z.string().trim().min(3).max(500).optional();

export const documentReferenceFields = { shortageReason: shortageReasonField, poNo: z.string().trim().max(100).optional(), externalReference: z.string().trim().max(150).optional(), requestId: z.string().uuid().optional() };
export function referenceFields(input: { poNo?: string; externalReference?: string }) {
  return { ...(input.poNo !== undefined ? { poNo: input.poNo } : {}), ...(input.externalReference !== undefined ? { externalReference: input.externalReference } : {}) };
}
