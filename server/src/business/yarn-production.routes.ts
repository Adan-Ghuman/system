import { Router } from 'express';
import { PipelineStage, Types } from 'mongoose';
import { z } from 'zod';
import { requirePermission, requireRole } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { formatPaginatedResult, parsePagination } from '../utils/pagination.js';
import { escapeRegex } from '../utils/search.js';
import { sendTable } from './export.js';
import { YarnMachine, YarnProductionRun } from './yarn-production.models.js';
import {
  availableReceipts, correctRun, handoffStock, objectId, productionDay, reason, requestId, runInput,
  saveRun, undoHandoff, voidRun
} from './yarn-production.js';
import { postCommand } from './posting.js';

export const yarnProductionRoutes = Router();
yarnProductionRoutes.use(requirePermission('knitting:read'));
const write = requirePermission('knitting:write');

const machineFields = z.object({
  name: z.string().trim().min(1).max(100),
  process: z.enum(['SPINNING', 'REWINDING']),
  location: z.string().trim().min(1).max(100)
});
const newMachine = machineFields.extend({
  requestId,
  code: z.string().trim().min(1).max(40).transform(value => value.toUpperCase())
});
const updateMachine = machineFields.extend({ requestId, active: z.boolean() });

yarnProductionRoutes.get('/machines', asyncHandler(async (_req, res) => {
  const [machines, locations] = await Promise.all([
    YarnMachine.find({}).sort({ code: 1 }),
    YarnProductionRun.distinct('location')
  ]);
  res.json({ success: true, data: { machines, locations: locations.sort() } });
}));

yarnProductionRoutes.post('/machines', requireRole('admin'), asyncHandler(async (req, res) => {
  const input = newMachine.parse(req.body);
  const machine = await postCommand('ADD_YARN_MACHINE', input, async session => {
    const [saved] = await YarnMachine.create([input], { session });
    return saved;
  });
  res.status(201).json({ success: true, data: machine });
}));

yarnProductionRoutes.put('/machines/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const { requestId: key, ...fields } = updateMachine.parse(req.body);
  const id = objectId.parse(req.params.id);
  const machine = await postCommand('UPDATE_YARN_MACHINE', { requestId: key, id, ...fields }, async session => {
    const saved = await YarnMachine.findByIdAndUpdate(id, { $set: fields }, { new: true, session });
    if (!saved) throw new NotFoundError('Machine not found.');
    return saved;
  });
  res.json({ success: true, data: machine });
}));

const reportQuery = z.object({
  from: productionDay.optional(),
  to: productionDay.optional(),
  shift: z.enum(['DAY', 'NIGHT']).optional(),
  machineId: objectId.optional(),
  yarnSpec: z.string().trim().max(100).optional(),
  reference: z.string().trim().max(100).optional(),
  location: z.string().trim().max(100).optional(),
  history: z.enum(['true', 'false']).optional(),
  format: z.enum(['xlsx']).optional()
});

yarnProductionRoutes.get('/runs', asyncHandler(async (req, res) => {
  const query = reportQuery.parse(req.query);
  if (query.from && query.to && query.from > query.to) throw new BadRequestError('The end date must follow the start date.');
  const match = {
    ...(query.from || query.to ? { productionDate: { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) } } : {}),
    ...(query.shift ? { shift: query.shift } : {}),
    ...(query.machineId ? { machineId: new Types.ObjectId(query.machineId) } : {}),
    ...(query.yarnSpec ? { 'output.yarnSpec': new RegExp(escapeRegex(query.yarnSpec), 'i') } : {}),
    ...(query.location ? { location: query.location } : {}),
    ...(query.reference ? { reference: query.reference.toUpperCase() } : {}),
    ...(query.history === 'true' ? {} : { status: 'POSTED' })
  };
  if (query.format) {
    const rows = await YarnProductionRun.find(match).sort({ productionDate: -1, _id: -1 }).lean();
    await sendTable(res, query.format, 'Yarn machine production', [
      'Production date', 'Shift', 'Machine code', 'Machine name', 'Location', 'Process', 'Run reference',
      'Yarn count', 'Package unit', 'Packages', 'Usable kg', 'Waste kg', 'Input yarn', 'Input unit',
      'Input packages', 'Input kg', 'Stock handoff', 'Entry status', 'Correction reason'
    ], rows.map(run => [run.productionDate, run.shift, run.machineCode, run.machineName, run.location,
      run.process, run.reference, run.output.yarnSpec, run.output.packageUnit, run.output.quantity,
      run.output.weightKg, run.wasteKg, run.input?.yarnSpec, run.input?.packageUnit, run.input?.quantity,
      run.input?.weightKg, run.stockStatus, run.status, run.correctionReason]));
    return;
  }
  const { page, limit, skip } = parsePagination(req.query);
  const summary: PipelineStage.FacetPipelineStage[] = [
    { $match: { status: 'POSTED' } },
    { $sort: { productionDate: -1, _id: -1 } },
    { $group: {
      _id: '$machineId', code: { $first: '$machineCode' }, name: { $first: '$machineName' },
      runs: { $sum: 1 }, usableKg: { $sum: '$output.weightKg' }, wasteKg: { $sum: '$wasteKg' },
      awaiting: { $sum: { $cond: [{ $eq: ['$stockStatus', 'AWAITING'] }, 1, 0] } }
    } },
    { $sort: { code: 1 } },
    { $set: { usableKg: { $round: ['$usableKg', 3] }, wasteKg: { $round: ['$wasteKg', 3] } } }
  ];
  const [result] = await YarnProductionRun.aggregate([
    { $match: match },
    { $facet: {
      items: [{ $sort: { productionDate: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }],
      total: [{ $count: 'count' }], summary
    } }
  ]);
  res.json({ success: true, data: {
    ...formatPaginatedResult(result.items, result.total[0]?.count || 0, page, limit), summary: result.summary
  } });
}));

yarnProductionRoutes.get('/runs/:id', asyncHandler(async (req, res) => {
  const run = await YarnProductionRun.findById(objectId.parse(req.params.id));
  if (!run) throw new NotFoundError('Production entry not found.');
  res.json({ success: true, data: run });
}));

yarnProductionRoutes.post('/runs', write, asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await saveRun(runInput.parse(req.body)) });
}));

yarnProductionRoutes.post('/runs/:id/correct', write, asyncHandler(async (req, res) => {
  const input = runInput.extend({ reason }).parse(req.body);
  res.status(201).json({ success: true, data: await correctRun(objectId.parse(req.params.id), input) });
}));

yarnProductionRoutes.post('/runs/:id/void', write, asyncHandler(async (req, res) => {
  const input = z.object({ reason, requestId }).parse(req.body);
  res.json({ success: true, data: await voidRun(objectId.parse(req.params.id), input) });
}));

yarnProductionRoutes.get('/runs/:id/receipts', write, asyncHandler(async (req, res) => {
  const run = await YarnProductionRun.findOne({ _id: objectId.parse(req.params.id), status: 'POSTED', stockStatus: 'AWAITING' });
  if (!run) throw new NotFoundError('Production entry is unavailable for a stock handoff.');
  if (run.process !== 'SPINNING') {
    res.json({ success: true, data: [] });
    return;
  }
  const receipts = await availableReceipts(run);
  res.json({ success: true, data: receipts.map(receipt => ({
    id: receipt._id, date: receipt.date, reference: receipt.reference, number: receipt.number
  })) });
}));

const handoffInput = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('POST'), requestId, date: productionDay, distinctReceiptReason: reason.optional() }),
  z.object({ mode: z.literal('LINK'), requestId, receiptId: objectId })
]);

yarnProductionRoutes.post('/runs/:id/stock', write, asyncHandler(async (req, res) => {
  const input = handoffInput.parse(req.body);
  res.json({ success: true, data: await handoffStock(objectId.parse(req.params.id), input) });
}));

yarnProductionRoutes.post('/runs/:id/stock/undo', write, asyncHandler(async (req, res) => {
  const input = z.object({ reason, requestId }).parse(req.body);
  res.json({ success: true, data: await undoHandoff(objectId.parse(req.params.id), input) });
}));
