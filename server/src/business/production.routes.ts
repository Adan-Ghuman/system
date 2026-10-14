import { Router } from 'express';
import { PipelineStage } from 'mongoose';
import ExcelJS from 'exceljs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requirePermission } from '../middleware/auth.middleware.js';
import { parsePagination } from '../utils/pagination.js';
import { KnittingReceipt, DyeingReceipt, StockMovement } from './records.js';
import { DyeingBatch } from '../models/DyeingBatch.js';
import { businessContext, businessObjectId } from './context.js';
import { escapeRegex } from '../utils/search.js';
import { weight } from './posting.js';
import { BadRequestError } from '../utils/errors.js';
import { YarnTransaction } from '../models/YarnTransaction.js';
import { BusinessDocument } from './commerce.models.js';

export interface ProductionRow { _id: string; date: Date; number: string; reference: string; kind: string; fabricType: string; yarnSpec: string; rolls: number; weightKg: number; wastageKg: number; color?: string; poNo?: string; externalReference?: string; }
export const productionRoutes = Router();
productionRoutes.get('/', requirePermission('knitting:read', 'dyeing:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20);
  const date: Record<string, Date> = {};
  if (req.query.from) date.$gte = new Date(String(req.query.from) + 'T00:00:00+05:00');
  if (req.query.to) date.$lte = new Date(String(req.query.to) + 'T23:59:59.999+05:00');
  if (Object.values(date).some(value => !Number.isFinite(value.valueOf())) || (date.$gte && date.$lte && date.$gte > date.$lte)) throw new BadRequestError('Choose a valid date range.');
  const filter = { ...(Object.keys(date).length ? { date } : {}), ...(req.query.partyId ? { partyId: String(req.query.partyId) } : {}), ...(req.query.color ? { color: new RegExp('^' + escapeRegex(String(req.query.color)) + '$', 'i') } : {}), ...(req.query.search ? { $or: ['fabricType', 'yarnSpec', 'reference', 'number', 'color'].map(field => ({ [field]: new RegExp(escapeRegex(String(req.query.search)), 'i') })) } : {}) };
  const pipeline: PipelineStage[] = [
    { $match: { status: 'POSTED' } }, { $unwind: '$items' },
    { $project: { partyId: { $toString: '$partyId' }, color: { $literal: 'ECRU' }, poNo: 1, externalReference: 1, date: 1, number: '$receiptNo', reference: '$gatePassNo', kind: { $literal: 'KNITTING' }, fabricType: '$items.fabricType', yarnSpec: '$items.yarnSpec', rolls: '$items.rollsCount', weightKg: '$items.weightKg', wastageKg: '$items.wastageKg' } },
    { $unionWith: { coll: DyeingReceipt.collection.name, pipeline: [{ $match: { businessId: businessObjectId(), status: 'POSTED' } }, { $unwind: '$items' }, { $project: { partyId: { $toString: '$partyId' }, color: '$items.color', poNo: 1, externalReference: 1, date: 1, number: 1, reference: '$gatePassNo', kind: { $literal: 'DYEING_RECEIVED' }, fabricType: '$items.fabricType', yarnSpec: '$items.yarnSpec', rolls: '$items.rolls', weightKg: '$items.weightKg', wastageKg: '$items.wastageKg' } }] } },
    { $unionWith: { coll: DyeingBatch.collection.name, pipeline: [{ $match: { businessId: businessObjectId(), status: { $ne: 'REVERSED' } } }, { $project: { partyId: { $toString: '$millPartyId' }, color: '$targetColor', poNo: 1, externalReference: 1, date: '$dateIssued', number: '$batchNo', reference: '$ogpNo', kind: { $literal: 'DYEING_SENT' }, fabricType: 1, yarnSpec: 1, rolls: '$ecruRollsCount', weightKg: '$ecruWeightKg', wastageKg: { $literal: 0 } } }] } },
    { $match: filter }, { $sort: { date: -1, _id: -1, fabricType: 1 } }
  ];
  if (req.query.format) {
    const rows = await KnittingReceipt.aggregate<ProductionRow>(pipeline);
    const headers = ['Date', 'Document', 'Paper reference', 'Stage', 'Fabric', 'Yarn', 'Rolls', 'Actual kg', 'Actual loss kg', 'Color / shade', 'PO', 'External reference'];
    const values = rows.map(row => [row.date.toISOString().slice(0, 10), row.number, row.reference, row.kind, row.fabricType, row.yarnSpec, row.rolls, row.weightKg, row.wastageKg, row.color, row.poNo, row.externalReference]);
    if (req.query.format === 'csv') {
      const quote = (value: unknown) => '"' + String(typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : value ?? '').replace(/"/g, '""') + '"';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');res.setHeader('Content-Disposition', 'attachment; filename="Production.csv"');res.send('\uFEFF' + [headers, ...values].map(row => row.map(quote).join(',')).join('\r\n'));return;
    }
    const workbook = new ExcelJS.Workbook();const sheet = workbook.addWorksheet('Production');sheet.addRow([businessContext.getStore()!.name + ' · Production']);sheet.addRow(headers);values.forEach(row => sheet.addRow(row));sheet.views = [{ state: 'frozen', ySplit: 2 }];sheet.columns.forEach(column => { column.width = 22; });sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '2:2' };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition', 'attachment; filename="Production.xlsx"');await workbook.xlsx.write(res);res.end();return;
  }
  const [result] = await KnittingReceipt.aggregate([...pipeline, { $facet: { items: [{ $skip: skip }, { $limit: limit }], count: [{ $count: 'total' }], totals: [{ $group: { _id: '$kind', kg: { $sum: '$weightKg' }, rolls: { $sum: '$rolls' }, loss: { $sum: '$wastageKg' } } }] } }]);
  const total = result.count[0]?.total || 0;
  res.json({ success: true, data: { items: result.items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), summary: result.totals.map((value: { _id: string; kg: number; rolls: number; loss: number }) => ({ kind: value._id, weightKg: weight(value.kg), rolls: value.rolls, wastageKg: weight(value.loss) })) } });
}));

productionRoutes.get('/movements', (req, res, next) => requirePermission(req.query.material === 'YARN' ? 'knitting:read' : 'inventory:read')(req, res, next), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20);
  const match = { ...(req.query.material ? { material: String(req.query.material) } : {}), ...(req.query.search ? { $or: ['item', 'reason'].map(field => ({ [field]: new RegExp(escapeRegex(String(req.query.search)), 'i') })) } : {}) };
  const [items, total] = await Promise.all([StockMovement.find(match).sort({ date: -1, _id: -1 }).skip(skip).limit(limit), StockMovement.countDocuments(match)]);
  res.json({ success: true, data: { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } });
}));

productionRoutes.get('/balances', requirePermission('knitting:read', 'dyeing:read', 'inventory:read'), asyncHandler(async (req, res) => {
  const asOf = req.query.to ? new Date(String(req.query.to) + 'T23:59:59.999+05:00') : new Date();
  if (!Number.isFinite(asOf.valueOf())) throw new BadRequestError('Choose a valid balance date.');
  const stock = await StockMovement.aggregate([{ $match: { date: { $lte: asOf } } }, { $group: { _id: { material: '$material', location: '$location' }, weightKg: { $sum: '$weightKg' }, quantity: { $sum: '$quantity' } } }, { $sort: { '_id.material': 1, '_id.location': 1 } }]);
  const issues = await YarnTransaction.find({ transactionType: 'OUTWARD_TO_KNITTER', date: { $lte: asOf }, status: { $ne: 'REVERSED' } });
  const receipts = await KnittingReceipt.find({ date: { $lte: asOf }, $or: [{ status: 'POSTED' }, { reversedAt: { $gt: asOf } }] });
  const returns = await BusinessDocument.find({ kind: 'YARN_RETURN', date: { $lte: asOf }, $or: [{ status: 'POSTED' }, { reversedAt: { $gt: asOf } }] });
  const consumption = receipts.reduce((sum, receipt) => sum + receipt.items.reduce((total, item) => total + item.weightKg + item.wastageKg, 0), 0);
  const returned = returns.reduce((sum, entry) => sum + entry.items.reduce((total, item) => total + item.weightKg, 0), 0);
  res.json({ success: true, data: { asOf, yarnWithKnittersKg: weight(issues.reduce((sum, issue) => sum + issue.grossWeightKg, 0) - consumption - returned), locations: stock.map(row => ({ material: row._id.material, location: row._id.location, weightKg: weight(row.weightKg), quantity: row.quantity })) } });
}));
