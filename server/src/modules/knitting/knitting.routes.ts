import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createYarnTransactionSchema,
  receiveFabricSchema,
  queryTransactionsSchema
} from './knitting.schema.js';
import {
  handleCreateTransaction,
  handleReceiveFabric,
  handleGetBalances,
  handleListTransactions
} from './knitting.controller.js';

const router = Router();

router.use(authenticate);

router.get('/transactions', requirePermission('knitting:read'), validateQuery(queryTransactionsSchema), asyncHandler(handleListTransactions));
router.post('/transactions', requirePermission('knitting:write'), validateBody(createYarnTransactionSchema), asyncHandler(handleCreateTransaction));
router.get('/balances', requirePermission('knitting:read'), asyncHandler(handleGetBalances));
router.post('/receive', requirePermission('knitting:write'), validateBody(receiveFabricSchema), asyncHandler(handleReceiveFabric));

export default router;
