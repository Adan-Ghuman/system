import { Router } from 'express';
import { z } from 'zod';
import { DyeingBatch } from '../models/DyeingBatch.js';
import { Party } from '../models/Party.js';
import { DyeingReceipt } from './records.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requirePermission } from '../middleware/auth.middleware.js';
import { escapeRegex } from '../utils/search.js';
import { parsePagination } from '../utils/pagination.js';
import { BadRequestError } from '../utils/errors.js';
import { sendTable } from './export.js';
import { weight } from './posting.js';

export function lotQuantities(batch: { ecruWeightKg: number; ecruRollsCount: number; receivedRawKg?: number; receivedRawRolls?: number; finishWeightKg?: number; finishRollsCount?: number; status: string }) {
  const processedKg = batch.receivedRawKg ?? (batch.status === 'COMPLETED' ? batch.ecruWeightKg : undefined);
  const processedRolls = batch.receivedRawRolls ?? (batch.status === 'COMPLETED' ? batch.ecruRollsCount : undefined);
  const receivedKg = batch.finishWeightKg ?? 0;
  const shortageKg = processedKg === undefined ? undefined : weight(processedKg - receivedKg);
  return { processedKg, processedRolls, receivedKg, receivedRolls: batch.finishRollsCount || 0, pendingKg: processedKg === undefined ? undefined : weight(batch.ecruWeightKg - processedKg), pendingRolls: processedRolls === undefined ? undefined : batch.ecruRollsCount - processedRolls, shortageKg, shortagePercent: processedKg && shortageKg !== undefined ? Math.round(shortageKg / processedKg * 10000) / 100 : undefined };
}

export const dyeingReportRoutes = Router();
dyeingReportRoutes.get('/status-report', requirePermission('dyeing:read'), asyncHandler(async (req, res) => {
  const query = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), millName: z.string().optional(), ownerKey: z.string().optional(), shade: z.string().optional(), status: z.enum(['ISSUED', 'IN_PROCESS', 'COMPLETED']).optional(), search: z.string().max(150).optional(), format: z.enum(['csv', 'xlsx']).optional() }).parse(req.query);
  const from = query.from ? new Date(query.from + 'T00:00:00+05:00') : undefined;
  const to = query.to ? new Date(query.to + 'T23:59:59.999+05:00') : undefined;
  if ((from && !Number.isFinite(+from)) || (to && !Number.isFinite(+to)) || (from && to && from > to)) throw new BadRequestError('Choose a valid date range.');
  const batches = await DyeingBatch.find({ status: query.status || { $ne: 'REVERSED' }, ...(from || to ? { dateIssued: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {}), ...(query.millName ? { millName: query.millName } : {}), ...(query.ownerKey ? { ownerKey: query.ownerKey } : {}), ...(query.shade ? { targetColor: new RegExp('^' + escapeRegex(query.shade) + '$', 'i') } : {}), ...(query.search ? { $or: ['batchNo', 'fabricType', 'yarnSpec', 'ogpNo'].map(field => ({ [field]: new RegExp(escapeRegex(query.search!), 'i') })) } : {}) }).populate('millPartyId', 'name').sort({ dateIssued: -1, _id: -1 }).lean();
  const owners = await Party.find({ _id: { $in: batches.map(batch => batch.ownerKey).filter(value => value && value !== 'OWN') } }).select('name').lean();
  const receipts = await DyeingReceipt.find({ status: 'POSTED', 'items.batchId': { $in: batches.map(batch => batch._id) } }).sort({ date: 1, _id: 1 }).lean();
  const items = batches.map(batch => ({ ...batch, ...lotQuantities(batch), millLabel: (batch.millPartyId as unknown as { name?: string })?.name || batch.customMillName || batch.millName, ownerName: !batch.ownerKey || batch.ownerKey === 'OWN' ? 'Rozain Textile' : owners.find(owner => String(owner._id) === batch.ownerKey)?.name || 'Owner not recorded', receipts: receipts.flatMap(receipt => receipt.items.filter(item => String(item.batchId) === String(batch._id)).map(item => ({ date: receipt.date, number: receipt.number, challan: receipt.gatePassNo, rawKg: item.rawKg, weightKg: item.weightKg, rolls: item.rolls, wastageKg: item.wastageKg }))) }));
  const summary = items.reduce((total, item) => ({ sentKg: weight(total.sentKg + item.ecruWeightKg), processedKg: weight(total.processedKg + (item.processedKg || 0)), receivedKg: weight(total.receivedKg + item.receivedKg), pendingKg: weight(total.pendingKg + (item.pendingKg || 0)), shortageKg: weight(total.shortageKg + (item.shortageKg || 0)), unknownLots: total.unknownLots + (item.processedKg === undefined ? 1 : 0) }), { sentKg: 0, processedKg: 0, receivedKg: 0, pendingKg: 0, shortageKg: 0, unknownLots: 0 });
  if (query.format) {
    const headers = ['Lot', 'Mill', 'Owner', 'Fabric', 'Yarn', 'Shade', 'GSM', 'Width / dia', 'Sent date', 'OGP', 'Status', 'Sent rolls', 'Sent kg', 'Processed kg', 'Received rolls', 'Received kg', 'Pending rolls', 'Pending kg', 'Shortage kg', 'Shortage %', 'Receipt history'];
    await sendTable(res, query.format, 'Dyeing status and wastage', headers, items.map(item => [item.batchNo, item.millLabel, item.ownerName, item.fabricType, item.yarnSpec, item.targetColor, item.gsm, item.width, item.dateIssued, item.ogpNo, item.status, item.ecruRollsCount, item.ecruWeightKg, item.processedKg, item.receivedRolls, item.receivedKg, item.pendingRolls, item.pendingKg, item.shortageKg, item.shortagePercent, item.receipts.map(receipt => `${receipt.date.toISOString().slice(0, 10)} · ${receipt.challan} · raw ${receipt.rawKg} kg · received ${receipt.weightKg} kg · loss ${receipt.wastageKg} kg`).join('\n')]));return;
  }
  const { page, limit, skip } = parsePagination(req.query, 20);
  res.json({ success: true, data: { items: items.slice(skip, skip + limit), total: items.length, page, limit, totalPages: Math.max(1, Math.ceil(items.length / limit)), summary: { ...summary, shortagePercent: summary.processedKg ? Math.round(summary.shortageKg / summary.processedKg * 10000) / 100 : null } } });
}));
