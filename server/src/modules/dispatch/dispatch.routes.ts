import { Router } from 'express';
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

router.get('/', requirePermission('dispatch:read'), validateQuery(queryDispatchesSchema), asyncHandler(handleListDispatches));
router.post('/', requirePermission('dispatch:write'), validateBody(createDispatchSchema), asyncHandler(handleCreateDispatch));
router.get('/:id', requirePermission('dispatch:read'), asyncHandler(handleGetDispatch));

export default router;
