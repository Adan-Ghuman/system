import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createBatchSchema,
  createGatePassSchema,
  receiveGatePassSchema,
  updateBatchSchema,
  settleBatchSchema,
  queryBatchesSchema,
  createDyeingUnitSchema,
  updateDyeingUnitSchema
} from './dyeing.schema.js';
import {
  handleCreateBatch,
  handleCreateGatePass,
  handleSettleBatch,
  handleSettleGatePass,
  handleListBatches,
  handleGetMetrics,
  handleGetNextBatchNo,
  handleUpdateBatch,
  handleDeleteBatch,
  handleGetDyeingUnits,
  handleCreateDyeingUnit,
  handleUpdateDyeingUnit,
  handleDeleteDyeingUnit
} from './dyeing.controller.js';

const router = Router();

router.use(authenticate);

router.get('/batches', requirePermission('dyeing:read'), validateQuery(queryBatchesSchema), asyncHandler(handleListBatches));
router.get('/batches/next-no', requirePermission('dyeing:read'), asyncHandler(handleGetNextBatchNo));
router.post('/batches', requirePermission('dyeing:write'), validateBody(createBatchSchema), asyncHandler(handleCreateBatch));
router.post('/gate-passes', requirePermission('dyeing:write'), validateBody(createGatePassSchema), asyncHandler(handleCreateGatePass));
router.post('/gate-passes/receive', requirePermission('dyeing:write'), validateBody(receiveGatePassSchema), asyncHandler(handleSettleGatePass));
router.put('/batches/:id', requirePermission('dyeing:write'), validateBody(updateBatchSchema), asyncHandler(handleUpdateBatch));
router.delete('/batches/:id', requirePermission('dyeing:write'), asyncHandler(handleDeleteBatch));
router.put('/batches/:id/settle', requirePermission('dyeing:write'), validateBody(settleBatchSchema), asyncHandler(handleSettleBatch));
router.get('/metrics', requirePermission('dyeing:read'), asyncHandler(handleGetMetrics));

// Dyeing Units & Locations Management Endpoints
router.get('/units', requirePermission('dyeing:read'), asyncHandler(handleGetDyeingUnits));
router.post('/units', requirePermission('dyeing:write'), validateBody(createDyeingUnitSchema), asyncHandler(handleCreateDyeingUnit));
router.put('/units/:id', requirePermission('dyeing:write'), validateBody(updateDyeingUnitSchema), asyncHandler(handleUpdateDyeingUnit));
router.delete('/units/:id', requirePermission('dyeing:write'), asyncHandler(handleDeleteDyeingUnit));


export default router;
