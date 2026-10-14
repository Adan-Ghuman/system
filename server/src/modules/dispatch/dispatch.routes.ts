import { Router } from 'express';
import { z } from 'zod';
import { reverseDelivery } from '../../business/delivery.js';
import { BusinessDocument } from '../../business/commerce.models.js';
import { saveDraft } from '../../business/commerce.js';
import { NotFoundError } from '../../utils/errors.js';
import { parsePagination, formatPaginatedResult } from '../../utils/pagination.js';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createDispatchSchema,
  queryDispatchesSchema
} from './dispatch.schema.js';
import {
  handleCreateDispatch,
  handleListDispatches,
  handleGetDispatch
} from './dispatch.controller.js';

const router = Router();

router.use(authenticate);
router.get('/drafts', requirePermission('dispatch:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);const match = { kind: 'DELIVERY_DRAFT', status: 'DRAFT' };
  const [items, total] = await Promise.all([BusinessDocument.find(match).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit), BusinessDocument.countDocuments(match)]);res.json({ success: true, data: formatPaginatedResult(items, total, page, limit) });
}));
router.post('/drafts', requirePermission('dispatch:write'), asyncHandler(async (req, res) => {
  const body = z.object({ requestId: z.string().uuid(), date: z.string().optional() }).passthrough().parse(req.body);res.status(201).json({ success: true, data: await saveDraft({ ...body, kind: 'DELIVERY_DRAFT' }) });
}));
router.patch('/drafts/:id', requirePermission('dispatch:write'), asyncHandler(async (req, res) => {
  const body = z.object({ requestId: z.string().uuid() }).passthrough().parse(req.body);
  const document = await BusinessDocument.findOneAndUpdate({ _id: req.params.id, kind: 'DELIVERY_DRAFT', status: 'DRAFT' }, { $set: { draft: { ...body, kind: 'DELIVERY_DRAFT' } } }, { new: true });if (!document) throw new NotFoundError('Editable delivery draft not found.');res.json({ success: true, data: document });
}));

router.get('/', requirePermission('dispatch:read'), validateQuery(queryDispatchesSchema), asyncHandler(handleListDispatches));
router.post('/', requirePermission('dispatch:write'), validateBody(createDispatchSchema), asyncHandler(handleCreateDispatch));
router.post('/:id/reverse', requirePermission('dispatch:write'), requirePermission('accounts:write'), asyncHandler(async (req, res) => { res.json({ success: true, data: await reverseDelivery(String(req.params.id), z.object({ reason: z.string().trim().min(3), requestId: z.string().uuid() }).parse(req.body)) }); }));
router.get('/:id', requirePermission('dispatch:read'), asyncHandler(handleGetDispatch));

export default router;
