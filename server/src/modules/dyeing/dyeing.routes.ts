import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createBatchSchema,
  settleBatchSchema,
  queryBatchesSchema
} from './dyeing.schema.js';
import {
  handleCreateBatch,
  handleSettleBatch,
  handleListBatches,
  handleGetMetrics,
  handleGetNextBatchNo
} from './dyeing.controller.js';

const router = Router();

router.use(authenticate);

router.get('/batches', requirePermission('dyeing:read'), validateQuery(queryBatchesSchema), asyncHandler(handleListBatches));
router.get('/batches/next-no', requirePermission('dyeing:read'), asyncHandler(handleGetNextBatchNo));
router.post('/batches', requirePermission('dyeing:write'), validateBody(createBatchSchema), asyncHandler(handleCreateBatch));
router.put('/batches/:id/settle', requirePermission('dyeing:write'), validateBody(settleBatchSchema), asyncHandler(handleSettleBatch));
router.get('/metrics', requirePermission('dyeing:read'), asyncHandler(handleGetMetrics));

export default router;
