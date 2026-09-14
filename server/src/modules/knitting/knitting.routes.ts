import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createYarnTransactionSchema,
  updateYarnTransactionSchema,
  receiveFabricSchema,
  queryTransactionsSchema
} from './knitting.schema.js';
import {
  handleCreateTransaction,
  handleReceiveFabric,
  handleGetBalances,
  handleListTransactions,
  handleUpdateTransaction,
  handleDeleteTransaction
} from './knitting.controller.js';

const router = Router();

router.use(authenticate);

router.get('/transactions', requirePermission('knitting:read'), validateQuery(queryTransactionsSchema), asyncHandler(handleListTransactions));
router.post('/transactions', requirePermission('knitting:write'), validateBody(createYarnTransactionSchema), asyncHandler(handleCreateTransaction));
router.put('/transactions/:id', requirePermission('knitting:write'), validateBody(updateYarnTransactionSchema), asyncHandler(handleUpdateTransaction));
router.delete('/transactions/:id', requirePermission('knitting:write'), asyncHandler(handleDeleteTransaction));
router.get('/balances', requirePermission('knitting:read'), asyncHandler(handleGetBalances));
router.post('/receive', requirePermission('knitting:write'), validateBody(receiveFabricSchema), asyncHandler(handleReceiveFabric));


export default router;
