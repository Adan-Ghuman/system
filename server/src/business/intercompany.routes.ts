import { creditIntercompany, reverseIntercompanyCredit, pairedCreditInput } from './intercompany-credit.js';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requirePermission } from '../middleware/auth.middleware.js';
import { parsePagination, formatPaginatedResult } from '../utils/pagination.js';
import { escapeRegex } from '../utils/search.js';
import { BusinessDocument } from './commerce.models.js';
import { createIntercompany, receiveIntercompany, settleIntercompany, reverseIntercompany, reverseIntercompanySettlement, intercompanyInput } from './intercompany.js';

export const intercompanyRoutes = Router();
const reasonInput = z.object({ reason: z.string().trim().min(3).max(1000), requestId: z.string().uuid() });
intercompanyRoutes.get('/', requirePermission('accounts:read'), requirePermission('inventory:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const search = req.query.search ? new RegExp(escapeRegex(String(req.query.search)), 'i') : undefined;
  const match = { kind: { $in: ['INTERCOMPANY_SALE', 'INTERCOMPANY_PURCHASE', 'INTERCOMPANY_CREDIT'] }, ...(search ? { $or: [{ number: search }, { reference: search }, { poNo: search }, { externalReference: search }] } : {}) };
  const [items, total] = await Promise.all([BusinessDocument.find(match).populate('partyId', 'name code').sort({ date: -1, _id: -1 }).skip(skip).limit(limit), BusinessDocument.countDocuments(match)]);
  res.json({ success: true, data: formatPaginatedResult(items, total, page, limit) });
}));
intercompanyRoutes.post('/', requirePermission('accounts:write'), requirePermission('inventory:write'), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await createIntercompany(intercompanyInput.parse(req.body), req.user!) });
}));
intercompanyRoutes.post('/:id/receive', requirePermission('inventory:write'), asyncHandler(async (req, res) => {
  const input = z.object({ date: z.string().datetime(), requestId: z.string().uuid(), items: z.array(z.object({ lineId: z.string(), rolls: z.number().int().positive(), weightKg: z.number().positive() })).min(1).max(100) }).parse(req.body);
  res.json({ success: true, data: await receiveIntercompany(String(req.params.id), input) });
}));
intercompanyRoutes.post('/:id/settle', requirePermission('accounts:write'), asyncHandler(async (req, res) => {
  const input = z.object({ amount: z.number().min(0.01).multipleOf(0.01), refund: z.boolean().optional(), date: z.string().datetime(), reference: z.string().trim().max(150).optional(), requestId: z.string().uuid() }).parse(req.body);
  res.json({ success: true, data: await settleIntercompany(String(req.params.id), input, req.user!) });
}));
intercompanyRoutes.post('/:id/reverse', requirePermission('accounts:write'), requirePermission('inventory:write'), asyncHandler(async (req, res) => {
  const document = await BusinessDocument.findById(req.params.id);const action = document?.kind === 'INTERCOMPANY_CREDIT' ? reverseIntercompanyCredit : reverseIntercompany;res.json({ success: true, data: await action(String(req.params.id), reasonInput.parse(req.body), req.user!) });
}));
intercompanyRoutes.post('/settlements/:id/reverse', requirePermission('accounts:write'), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await reverseIntercompanySettlement(String(req.params.id), reasonInput.parse(req.body), req.user!) });
}));

intercompanyRoutes.post('/:id/returns', requirePermission('accounts:write'), requirePermission('inventory:write'), asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await creditIntercompany(String(req.params.id), pairedCreditInput.parse(req.body), req.user!) }); }));
