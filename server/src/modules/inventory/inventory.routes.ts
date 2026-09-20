import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createTransferSchema,
  createAdjustmentSchema,
  updateInventoryItemSchema,
  queryInventorySchema,
  queryTransfersSchema
} from './inventory.schema.js';
import {
  handleCreateTransfer,
  handleCreateAdjustment,
  handleListInventory,
  handleGetSummary,
  handleListTransfers,
  handleGetNextTransferNo,
  handleUpdateInventoryItem
} from './inventory.controller.js';

const router = Router();

router.use(authenticate);

router.get('/items', requirePermission('inventory:read'), validateQuery(queryInventorySchema), asyncHandler(handleListInventory));
router.get('/summary', requirePermission('inventory:read'), asyncHandler(handleGetSummary));
router.get('/transfers', requirePermission('inventory:read'), validateQuery(queryTransfersSchema), asyncHandler(handleListTransfers));
router.get('/transfers/next-no', requirePermission('inventory:read'), asyncHandler(handleGetNextTransferNo));
router.post('/transfers', requirePermission('inventory:write'), validateBody(createTransferSchema), asyncHandler(handleCreateTransfer));
router.post('/adjustments', requirePermission('inventory:write'), validateBody(createAdjustmentSchema), asyncHandler(handleCreateAdjustment));
router.put('/items/:id', requirePermission('inventory:write'), validateBody(updateInventoryItemSchema), asyncHandler(handleUpdateInventoryItem));

export default router;
