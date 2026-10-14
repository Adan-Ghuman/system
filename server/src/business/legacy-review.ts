import mongoose from 'mongoose';
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parsePagination, formatPaginatedResult } from '../utils/pagination.js';
import { BadRequestError } from '../utils/errors.js';

const collections = ['parties', 'yarntransactions', 'dyeingbatches', 'fabricinventories', 'dispatches', 'invoices', 'paymentvouchers', 'partyledgerentries', 'stocktransfers', 'stockadjustments'] as const;
export const legacyReviewRoutes = Router();
legacyReviewRoutes.use(authenticate, requireRole('admin'));
legacyReviewRoutes.get('/', asyncHandler(async (_req, res) => {
  const counts = await Promise.all(collections.map(async name => ({ collection: name, count: await mongoose.connection.collection(name).countDocuments({}) })));
  res.json({ success: true, data: { mode: 'READ_ONLY_REVIEW', records: counts, migrationApplied: false, instruction: 'Assign ownership and reconcile openings on a protected copy before cutover. No record is assigned to a business automatically.' } });
}));
legacyReviewRoutes.get('/:collection', asyncHandler(async (req, res) => {
  const name = String(req.params.collection);if (!collections.includes(name as typeof collections[number])) throw new BadRequestError('Choose a listed historical record type.');
  const { page, limit, skip } = parsePagination(req.query);const source = mongoose.connection.collection(name);
  if (req.query.format === 'csv') {
    const quote = (value: unknown) => '"' + String(typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : value ?? '').replace(/"/g, '""') + '"';
    const rows = await source.find({}, { projection: { passwordHash: 0 } }).sort({ _id: 1 }).toArray();
    const headers = ['Collection', 'Record ID', 'Paper / document number', 'Party / customer ID', 'Date', 'Kg', 'Balance', 'Reviewed business ID', 'Reviewed opening', 'Review note'];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');res.setHeader('Content-Disposition', `attachment; filename="Ownership-review-${name}.csv"`);
    res.send('\uFEFF' + [headers, ...rows.map(row => [name, row._id, row.gatePassNo || row.dispatchNo || row.invoiceNo || row.voucherNo || row.batchNo || row.code || '', row.partyId || row.customerId || '', row.date || row.dateIssued || '', row.totalWeightKg ?? row.grossWeightKg ?? row.ecruWeightKg ?? row.totalNetWeightKg ?? '', row.currentBalance ?? '', '', '', ''])].map(row => row.map(quote).join(',')).join('\r\n'));return;
  }
  const [items, total] = await Promise.all([source.find({}, { projection: { passwordHash: 0 } }).sort({ _id: 1 }).skip(skip).limit(limit).toArray(), source.countDocuments({})]);
  res.json({ success: true, data: formatPaginatedResult(items, total, page, limit) });
}));
