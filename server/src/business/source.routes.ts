import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requirePermission } from '../middleware/auth.middleware.js';
import { BusinessDocument, BillPayment } from './commerce.models.js';
import { KnittingReceipt, DyeingReceipt } from './records.js';
import { DyeingBatch } from '../models/DyeingBatch.js';
import { NotFoundError } from '../utils/errors.js';

export const sourceRoutes = Router();
sourceRoutes.get('/bill/:id', requirePermission('accounts:read'), asyncHandler(async (req, res) => {
  let document = await BusinessDocument.findById(req.params.id).populate('partyId', 'name code');
  if (!document) { const payment = await BillPayment.findOne({ $or: [{ voucherId: req.params.id }, { _id: req.params.id }] });if (payment) document = await BusinessDocument.findById(payment.billId).populate('partyId', 'name code'); }
  if (!document) throw new NotFoundError('Open Accounts for this voucher. No bill is linked to this entry.');res.json({ success: true, data: document });
}));
sourceRoutes.get('/production/:kind/:id', (req, res, next) => requirePermission(req.params.kind === 'KNITTING' ? 'knitting:read' : 'dyeing:read')(req, res, next), asyncHandler(async (req, res) => {
  const kind = String(req.params.kind);
  const source = kind === 'KNITTING' ? await KnittingReceipt.findById(req.params.id).populate('partyId', 'name code') : kind === 'DYEING_RECEIVED' ? await DyeingReceipt.findById(req.params.id).populate('partyId', 'name code') : await DyeingBatch.findById(req.params.id).populate('millPartyId', 'name code');
  if (!source) throw new NotFoundError('Source document not found.');
  const value = source.toObject() as Record<string, unknown>;
  const rows = value.items as Array<Record<string, unknown>> | undefined;
  const items = rows ? rows.map(item => ({ ...item, rolls: item.rolls || item.rollsCount, color: item.color || 'ECRU', rate: 0, basis: 'KG', description: `Actual wastage: ${Number(item.wastageKg || 0).toFixed(3)} kg` })) : [{ fabricType: value.fabricType, yarnSpec: value.yarnSpec, color: value.targetColor, rolls: value.ecruRollsCount, weightKg: value.ecruWeightKg, rate: 0, basis: 'KG' }];
  res.json({ success: true, data: { ...value, number: value.receiptNo || value.number || value.batchNo, kind, reference: value.gatePassNo || value.ogpNo, partyId: value.partyId || value.millPartyId, date: value.date || value.dateIssued, direction: 'PAYABLE', total: 0, paid: 0, taxPercent: 0, taxAmount: 0, baseAmount: 0, items } });
}));
