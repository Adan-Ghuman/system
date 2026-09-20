import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createYarnTransactionSchema,
  updateYarnTransactionSchema,
  receiveFabricSchema,
  queryTransactionsSchema,
  createYarnSpecSchema,
  updateYarnSpecSchema,
  bulkRenameYarnSpecSchema
} from './knitting.schema.js';
import {
  handleCreateTransaction,
  handleReceiveFabric,
  handleGetBalances,
  handleListTransactions,
  handleUpdateTransaction,
  handleDeleteTransaction,
  handleGetYarnSpecifications,
  handleCreateYarnSpecification,
  handleUpdateYarnSpecification,
  handleDeleteYarnSpecification,
  handleBulkRenameYarnSpec
} from './knitting.controller.js';

const router = Router();

router.use(authenticate);

router.get('/transactions', requirePermission('knitting:read'), validateQuery(queryTransactionsSchema), asyncHandler(handleListTransactions));
router.post('/transactions', requirePermission('knitting:write'), validateBody(createYarnTransactionSchema), asyncHandler(handleCreateTransaction));
router.put('/transactions/:id', requirePermission('knitting:write'), validateBody(updateYarnTransactionSchema), asyncHandler(handleUpdateTransaction));
router.delete('/transactions/:id', requirePermission('knitting:write'), asyncHandler(handleDeleteTransaction));
router.get('/balances', requirePermission('knitting:read'), asyncHandler(handleGetBalances));
router.post('/receive', requirePermission('knitting:write'), validateBody(receiveFabricSchema), asyncHandler(handleReceiveFabric));

// Yarn Specification Management Endpoints
router.get('/yarn-specs', requirePermission('knitting:read'), asyncHandler(handleGetYarnSpecifications));
router.post('/yarn-specs', requirePermission('knitting:write'), validateBody(createYarnSpecSchema), asyncHandler(handleCreateYarnSpecification));
router.put('/yarn-specs/:id', requirePermission('knitting:write'), validateBody(updateYarnSpecSchema), asyncHandler(handleUpdateYarnSpecification));
router.delete('/yarn-specs/:id', requirePermission('knitting:write'), asyncHandler(handleDeleteYarnSpecification));
router.post('/yarn-specs/bulk-rename', requirePermission('knitting:write'), validateBody(bulkRenameYarnSpecSchema), asyncHandler(handleBulkRenameYarnSpec));


export default router;
