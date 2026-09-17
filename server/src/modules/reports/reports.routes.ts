import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  exportPartyLedgerExcel,
  exportDyeingReportExcel,
  exportGatePassRegisterExcel,
  exportKnittingYarnExcel,
  exportMasterBalanceExcel
} from './reports.controller.js';

const router = Router();

router.use(authenticate);

// 1. Party Ledger Excel (Archetype 1)
router.get('/party-ledger/:partyId/excel', asyncHandler(exportPartyLedgerExcel));

// 2. Dyeing Mill Processing & Shortage Report Excel (Archetype 2)
router.get('/dyeing-mill/excel', asyncHandler(exportDyeingReportExcel));

// 3. Gate Pass Register Excel (Archetype 3 - IGP/OGP)
router.get('/gate-pass-register/excel', asyncHandler(exportGatePassRegisterExcel));

// 4. Knitting & Yarn Stock Report Excel (Archetype 4)
router.get('/knitting-yarn/excel', asyncHandler(exportKnittingYarnExcel));

// 5. Master Party Directory & Balance Audit Excel (Archetype 5)
router.get('/master-balance/excel', asyncHandler(exportMasterBalanceExcel));

export default router;
