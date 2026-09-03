import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createVoucherSchema,
  queryVouchersSchema,
  queryLedgerSchema
} from './accounts.schema.js';
import {
  handleCreateVoucher,
  handleListVouchers,
  handleGetLedgerStatement,
  handleGetMetrics
} from './accounts.controller.js';

const router = Router();

router.use(authenticate);

router.get('/vouchers', requirePermission('accounts:read'), validateQuery(queryVouchersSchema), asyncHandler(handleListVouchers));
router.post('/vouchers', requirePermission('accounts:write'), validateBody(createVoucherSchema), asyncHandler(handleCreateVoucher));
router.get('/ledger/:partyId', requirePermission('accounts:read'), validateQuery(queryLedgerSchema), asyncHandler(handleGetLedgerStatement));
router.get('/metrics', requirePermission('accounts:read'), asyncHandler(handleGetMetrics));

export default router;
