import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createPartySchema, updatePartySchema, queryPartiesSchema } from './party.schema.js';
import {
  handleCreateParty,
  handleUpdateParty,
  handleGetParty,
  handleListParties,
  handleGetNextCode
} from './party.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('parties:read'), validateQuery(queryPartiesSchema), asyncHandler(handleListParties));
router.get('/next-code', requirePermission('parties:read'), asyncHandler(handleGetNextCode));
router.post('/', requirePermission('parties:write'), validateBody(createPartySchema), asyncHandler(handleCreateParty));
router.get('/:id', requirePermission('parties:read'), asyncHandler(handleGetParty));
router.put('/:id', requirePermission('parties:write'), validateBody(updatePartySchema), asyncHandler(handleUpdateParty));

export default router;
