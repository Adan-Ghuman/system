import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createVoucherSchema,
  updateVoucherSchema,
  queryVouchersSchema,
  queryLedgerSchema,
  updateLedgerEntrySchema
} from './accounts.schema.js';
import {
  handleCreateVoucher,
  handleUpdateVoucher,
  handleDeleteVoucher,
  handleListVouchers,
  handleGetLedgerStatement,
  handleUpdateLedgerEntry,
  handleDeleteLedgerEntry,
  handleGetMetrics
} from './accounts.controller.js';

const router = Router();

router.use(authenticate);

router.get('/vouchers', requirePermission('accounts:read'), validateQuery(queryVouchersSchema), asyncHandler(handleListVouchers));
router.post('/vouchers', requirePermission('accounts:write'), validateBody(createVoucherSchema), asyncHandler(handleCreateVoucher));
router.put('/vouchers/:id', requirePermission('accounts:write'), validateBody(updateVoucherSchema), asyncHandler(handleUpdateVoucher));
router.delete('/vouchers/:id', requirePermission('accounts:write'), asyncHandler(handleDeleteVoucher));

router.get('/ledger/:partyId', requirePermission('accounts:read'), validateQuery(queryLedgerSchema), asyncHandler(handleGetLedgerStatement));
router.put('/ledger/entry/:id', requirePermission('accounts:write'), validateBody(updateLedgerEntrySchema), asyncHandler(handleUpdateLedgerEntry));
router.delete('/ledger/entry/:id', requirePermission('accounts:write'), asyncHandler(handleDeleteLedgerEntry));

router.get('/metrics', requirePermission('accounts:read'), asyncHandler(handleGetMetrics));

export default router;
