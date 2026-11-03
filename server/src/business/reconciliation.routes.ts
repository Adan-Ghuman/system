import { Router, Request } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Reconciliation, ReconciliationClosing } from './reconciliation.models.js';
import { YarnTransaction } from '../models/YarnTransaction.js';
import { DyeingBatch } from '../models/DyeingBatch.js';
import { Party } from '../models/Party.js';
import { DyeingReceipt, KnittingReceipt } from './records.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parsePagination, formatPaginatedResult } from '../utils/pagination.js';
import { businessContext } from './context.js';
import { postCommand, weight } from './posting.js';
import { fitsDyeingBatch, updateDyeingBatch } from './dyeing.js';
import { moveFabric } from './stock.js';
import { postStockAdjustmentInSession } from './inventory.js';
import { createAdjustmentSchema } from '../modules/inventory/inventory.schema.js';
import { operationInput } from './commerce.schema.js';
import { submitOperationInSession } from './commerce.js';
import { escapeRegex } from '../utils/search.js';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const note = z.string().trim().min(3).max(500);
const units = {
  FABRIC: 'inventory', YARN: 'knitting', KNITTING: 'knitting', DYEING: 'dyeing', YARN_RETURN: 'knitting'
} as const;
type Kind = keyof typeof units;
const kinds = z.enum(['FABRIC', 'YARN', 'KNITTING', 'DYEING', 'YARN_RETURN']);

function allowed(req: Request, kind: Kind, access: 'read' | 'write') {
  return req.user?.role === 'admin' || req.user?.permissions.includes(units[kind] + ':' + access);
}

function requireAccess(req: Request, kind: string, access: 'read' | 'write') {
  if (!allowed(req, kinds.parse(kind), access)) throw new ForbiddenError('You do not have access to this reconciliation item.');
}

function yarnSources(entry: { yarnSpec: string; partyId?: Types.ObjectId | null; ownerKey: string; date: Date }) {
  return { transactionType: 'OUTWARD_TO_KNITTER', status: { $ne: 'REVERSED' }, partyId: entry.partyId,
    yarnSpec: entry.yarnSpec, ownerKey: entry.ownerKey, date: { $lte: entry.date } };
}

function dyeingSources(entry: { partyId?: Types.ObjectId | null; ownerKey: string; location: string; item: string; yarnSpec: string; color?: string | null; date: Date }) {
  return { millName: entry.location, millPartyId: entry.partyId, ownerKey: entry.ownerKey, fabricType: entry.item,
    yarnSpec: entry.yarnSpec, targetColor: entry.color?.toUpperCase(), dateIssued: { $lte: entry.date }, status: { $in: ['ISSUED', 'IN_PROCESS'] } };
}

export const reconciliationRoutes = Router();
reconciliationRoutes.get('/', asyncHandler(async (req, res) => {
  const visible = kinds.options.filter(kind => allowed(req, kind, 'read'));
  if (!visible.length) throw new ForbiddenError('You do not have access to reconciliation.');
  const query = z.object({ kind: kinds.optional(), status: z.enum(['OPEN', 'RESOLVED', 'ALL']).default('OPEN'),
    search: z.string().trim().max(150).optional(), owner: z.string().trim().max(150).optional(), location: z.string().trim().max(150).optional(), since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.query);
  const { page, limit, skip } = parsePagination(req.query);
  const pattern = query.search ? new RegExp(escapeRegex(query.search), 'i') : undefined;
  const ownerPattern = query.owner ? new RegExp(escapeRegex(query.owner), 'i') : undefined;
  const locationPattern = query.location ? new RegExp(escapeRegex(query.location), 'i') : undefined;
  const ownerIds = ownerPattern ? (await Party.find({ name: ownerPattern }).select('_id')).map(party => String(party._id)) : [];
  if (ownerPattern?.test(businessContext.getStore()!.name)) ownerIds.push('OWN');
  const locationParties = locationPattern ? (await Party.find({ name: locationPattern }).select('_id')).map(party => party._id) : [];
  const since = query.since ? new Date(query.since + 'T00:00:00+05:00') : undefined;
  if (since && !Number.isFinite(+since)) throw new BadRequestError('Choose a valid opening date.');
  const filters = [];
  if (locationPattern) filters.push({ $or: [{ location: locationPattern }, { partyId: { $in: locationParties } }] });
  if (pattern) filters.push({ $or: [{ item: pattern }, { yarnSpec: pattern }, { location: pattern }, { reference: pattern }] });
  const filter = {
    kind: { $in: query.kind ? visible.filter(kind => kind === query.kind) : visible },
    ...(query.status === 'ALL' ? {} : { open: query.status === 'OPEN' }),
    ...(ownerPattern ? { ownerKey: { $in: ownerIds } } : {}),
    ...(since ? { date: { $gte: since } } : {}),
    ...(filters.length ? { $and: filters } : {})
  };
  const [items, total] = await Promise.all([
    Reconciliation.find(filter).sort({ date: -1, _id: -1 }).skip(skip).limit(limit),
    Reconciliation.countDocuments(filter)
  ]);
  const ids = [...new Set(items.flatMap(item => [String(item.partyId || ''), item.ownerKey]).filter(id => Types.ObjectId.isValid(id)))];
  const parties = await Party.find({ _id: { $in: ids } }).select('name');
  const names = new Map(parties.map(party => [String(party._id), party.name]));
  const rows = items.map(item => ({ ...item.toObject(),
    ownerName: item.ownerKey === 'OWN' ? businessContext.getStore()!.name : names.get(item.ownerKey),
    processor: names.get(String(item.partyId)), canWrite: allowed(req, kinds.parse(item.kind), 'write') }));
  res.json({ success: true, data: formatPaginatedResult(rows, total, page, limit) });
}));

reconciliationRoutes.get('/closing', asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin') throw new ForbiddenError('Closing is available to supervisors.');
  const items = await ReconciliationClosing.find({}).sort({ createdAt: -1 }).limit(30);
  res.json({ success: true, data: items });
}));

reconciliationRoutes.post('/closing', asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin') throw new ForbiddenError('Closing is available to supervisors.');
  const input = z.object({ reason: note.optional(), requestId: z.string().uuid() }).parse(req.body);
  const closing = await postCommand('RECONCILIATION_CLOSE', input, async session => {
    const open = await Reconciliation.find({ open: true }).session(session);
    if (open.length && !input.reason) throw new BadRequestError('Enter why the open items are being carried forward.');
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const [snapshot] = await ReconciliationClosing.create([{ date, reason: input.reason || 'All items reconciled',
      actorId: businessContext.getStore()!.actorId,
      items: open.map(entry => ({ entryId: entry._id, quantity: entry.quantity, weightKg: entry.weightKg, finishedQuantity: entry.finishedQuantity, finishedKg: entry.finishedKg })) }], { session });
    return snapshot;
  });
  res.status(201).json({ success: true, data: closing });
}));

reconciliationRoutes.get('/:id/sources', asyncHandler(async (req, res) => {
  const entry = await Reconciliation.findOne({ _id: objectId.parse(req.params.id), open: true });
  if (!entry) throw new NotFoundError('Open item not found.');
  requireAccess(req, entry.kind, 'read');
  let sources: Array<{ id: unknown; reference: string; quantity: number; weightKg: number; date: Date }> = [];
  if (entry.kind === 'DYEING') {
    const batches = await DyeingBatch.find(dyeingSources(entry)).sort({ dateIssued: -1 }).limit(100);
    sources = batches.map(batch => ({ id: batch._id, reference: [batch.batchNo, batch.ogpNo].filter(Boolean).join(' · '),
      quantity: batch.ecruRollsCount - batch.receivedRawRolls, weightKg: weight(batch.ecruWeightKg - batch.receivedRawKg), date: batch.dateIssued }));
  }
  if (entry.kind === 'KNITTING' || entry.kind === 'YARN_RETURN') {
    const receipt = entry.kind === 'KNITTING' ? await KnittingReceipt.findById(entry.sourceId) : null;
    const original = entry.kind === 'YARN_RETURN' ? await YarnTransaction.findById(entry.lineId) : null;
    const productionType = receipt?.productionType || original?.productionType;
    const issues = await YarnTransaction.find({ ...yarnSources(entry), _id: { $ne: entry.lineId },
      ...(productionType ? { $or: [{ productionType }, { productionType: { $exists: false } }] } : {}),
      ...(entry.kind === 'YARN_RETURN' ? { packageUnit: entry.packageUnit } : { remainingYarnBalanceKg: { $gt: 0 } })
    }).sort({ date: -1 }).limit(100);
    sources = issues.map(issue => ({ id: issue._id, reference: issue.gatePassNo, quantity: issue.boxCount - (issue.returnedPackages || 0),
      weightKg: issue.remainingYarnBalanceKg, date: issue.date }));
  }
  res.json({ success: true, data: sources });
}));

reconciliationRoutes.post('/:id/link', asyncHandler(async (req, res) => {
  const input = z.object({ sourceId: objectId, weightKg: z.number().finite().nonnegative().multipleOf(0.001),
    quantity: z.number().int().nonnegative().default(0), finishedQuantity: z.number().int().positive().optional(), finishedKg: z.number().finite().positive().multipleOf(0.001).optional(), reason: note, requestId: z.string().uuid() }).parse(req.body);
  const id = objectId.parse(req.params.id);
  const visible = await Reconciliation.findById(id).select('kind');
  if (!visible) throw new NotFoundError('Reconciliation item not found.');
  requireAccess(req, visible.kind, 'write');
  const result = await postCommand('RECONCILE_WORK', { ...input, id }, async session => {
    const entry = await Reconciliation.findOne({ _id: id, open: true }).session(session);
    if (!entry) throw new NotFoundError('Open item not found.');
    if (entry.kind === 'DYEING') {
      const receipt = await DyeingReceipt.findOne({ _id: entry.sourceId, status: 'POSTED' }).session(session);
      const line = receipt?.items.id(entry.lineId || '');
      const batch = await DyeingBatch.findOne({ ...dyeingSources(entry), _id: input.sourceId }).session(session);
      if (!receipt || !line || line.batchId || !batch) throw new BadRequestError('Choose a matching open dyeing issue for this receipt.');
      const rawKg = input.weightKg;
      const rawRolls = input.quantity;
      const finishRolls = entry.finishedQuantity ?? line.rolls!;
      const finishKg = entry.finishedKg ?? line.weightKg!;
      const allocatedRolls = input.finishedQuantity ?? finishRolls;
      const allocatedKg = input.finishedKg ?? finishKg;
      const remainingFinishRolls = finishRolls - allocatedRolls;
      const remainingFinishKg = weight(finishKg - allocatedKg);
      if (remainingFinishRolls < 0 || remainingFinishKg < 0 || ((remainingFinishRolls === 0) !== (remainingFinishKg === 0))) {
        throw new BadRequestError('The allocation must leave both finished rolls and kg, or clear both.');
      }
      const fullyLinked = remainingFinishRolls === 0;
      const knownRaw = Boolean(line.rawKg && line.rawRolls);
      if (knownRaw) {
        const remainingRawRolls = -entry.quantity - rawRolls;
        const remainingRawKg = weight(-entry.weightKg - rawKg);
        if (remainingRawRolls < 0 || remainingRawKg < remainingFinishKg
          || (fullyLinked ? Boolean(remainingRawRolls || remainingRawKg) : !(remainingRawRolls && remainingRawKg))) {
          throw new BadRequestError('Match the recorded raw quantity and leave enough raw fabric for any remaining finished output.');
        }
      }
      if (rawKg < allocatedKg || !fitsDyeingBatch(batch, rawKg, rawRolls)) throw new BadRequestError('This batch does not cover the measured raw rolls and kg.');
      await moveFabric({ fabricType: batch.fabricType, yarnSpec: batch.yarnSpec, color: 'ECRU', state: 'RAW_ECRU',
        ownerKey: entry.ownerKey, rolls: rawRolls, weightKg: rawKg }, batch.millName, -1, batch._id, receipt.date, input.reason, session);
      updateDyeingBatch(batch, rawKg, rawRolls, allocatedKg, allocatedRolls, receipt.date, receipt.gatePassNo);
      const allocation = { batchId: batch._id, rawKg, rawRolls, weightKg: allocatedKg, rolls: allocatedRolls, wastageKg: weight(rawKg - allocatedKg) };
      if (fullyLinked && !line.allocations.length) {
        line.set({ batchId: batch._id, rawKg, rawRolls, wastageKg: allocation.wastageKg });
      } else {
        line.allocations.push(allocation);
        if (fullyLinked) {
          const totalRawKg = weight(line.allocations.reduce((sum, part) => sum + (part.rawKg || 0), 0));
          line.set({ rawKg: totalRawKg, rawRolls: line.allocations.reduce((sum, part) => sum + (part.rawRolls || 0), 0),
            wastageKg: weight(totalRawKg - line.weightKg!) });
        }
      }
      await batch.save({ session });
      await receipt.save({ session });
      entry.set({ weightKg: knownRaw ? weight(entry.weightKg + rawKg) : 0, quantity: knownRaw ? entry.quantity + rawRolls : 0,
        finishedKg: remainingFinishKg, finishedQuantity: remainingFinishRolls, open: !fullyLinked });
    } else if (entry.kind === 'KNITTING' || entry.kind === 'YARN_RETURN') {
      const issue = await YarnTransaction.findOne({ ...yarnSources(entry), _id: input.sourceId }).session(session);
      if (!issue || input.weightKg > Math.max(0, issue.remainingYarnBalanceKg) || input.weightKg > -entry.weightKg || input.quantity > -entry.quantity || (!input.weightKg && !input.quantity)) {
        throw new BadRequestError('Choose a matching issue with enough unused yarn for this allocation.');
      }
      if (entry.kind === 'KNITTING') {
        const receipt = await KnittingReceipt.findOne({ _id: entry.sourceId, status: 'POSTED' }).session(session);
        const line = receipt?.items.id(entry.lineId || '');
        if (!line || !receipt || (receipt.productionType && issue.productionType && issue.productionType !== receipt.productionType)) {
          throw new BadRequestError('Choose an issue for the same knitting production type.');
        }
        const fabricKg = Math.min(entry.fabricKg || 0, input.weightKg);
        const wastageKg = weight(input.weightKg - fabricKg);
        line.allocations.push({ transactionId: issue._id as Types.ObjectId, weightKg: input.weightKg, fabricKg, wastageKg });
        issue.receivedFabricKg = weight(issue.receivedFabricKg + fabricKg);
        issue.actualWastageKg = weight((issue.actualWastageKg || 0) + wastageKg);
        entry.fabricKg = weight((entry.fabricKg || 0) - fabricKg);
        await receipt.save({ session });
      } else {
        const original = await YarnTransaction.findById(entry.lineId).session(session);
        if (!original || issue.id === original.id || issue.packageUnit !== original.packageUnit ||
          (original.productionType && issue.productionType && original.productionType !== issue.productionType) ||
          input.quantity > issue.boxCount - (issue.returnedPackages || 0)) throw new BadRequestError('Choose a second issue with the same production type and package unit.');
        original.remainingYarnBalanceKg = weight(original.remainingYarnBalanceKg + input.weightKg);
        original.returnedPackages -= input.quantity;
        issue.returnedPackages = (issue.returnedPackages || 0) + input.quantity;
        await original.save({ session });
      }
      issue.remainingYarnBalanceKg = weight(issue.remainingYarnBalanceKg - input.weightKg);
      await issue.save({ session });
      entry.weightKg = weight(entry.weightKg + input.weightKg);
      entry.quantity += input.quantity;
      entry.open = Boolean(entry.weightKg || entry.quantity);
    } else {
      throw new BadRequestError('Use a stock receipt or correction for this item.');
    }
    entry.events.push({ sourceId: new Types.ObjectId(input.sourceId), date: new Date(), recordedAt: new Date(),
      reason: input.reason, actorId: businessContext.getStore()!.actorId, quantity: entry.quantity, weightKg: entry.weightKg,
      appliedQuantity: input.quantity, appliedKg: input.weightKg });
    await entry.save({ session });
    return entry.toObject();
  });
  res.json({ success: true, data: result });
}));

reconciliationRoutes.post('/:id/correct', asyncHandler(async (req, res) => {
  const id = objectId.parse(req.params.id);
  const input = z.object({ quantity: z.number().int(), weightKg: z.number().finite().multipleOf(0.001), reason: note,
    date: z.string().datetime(), requestId: z.string().uuid(),
    expectedQuantity: z.number().int(), expectedKg: z.number().finite() }).parse(req.body);
  const visible = await Reconciliation.findById(id).select('kind');
  if (!visible) throw new NotFoundError('Reconciliation item not found.');
  requireAccess(req, visible.kind, 'write');
  if (!input.quantity && !input.weightKg) throw new BadRequestError('Enter the measured change in quantity or kg.');
  const document = await postCommand('RECONCILE_STOCK', { ...input, id, shortageReason: input.reason }, async session => {
    const entry = await Reconciliation.findById(id).session(session);
    if (!entry?.open || entry.quantity !== input.expectedQuantity || entry.weightKg !== input.expectedKg) {
      throw new ConflictError('This balance changed. Refresh Reconciliation and review the current quantity before correcting it.');
    }
    if (entry.kind === 'FABRIC') {
      return postStockAdjustmentInSession(createAdjustmentSchema.parse({
        ...input, reason: 'MANUAL_CORRECTION', remarks: input.reason, externalReference: id,
        fabricType: entry.fabricType, yarnSpec: entry.yarnSpec,
        state: entry.state, color: entry.color, location: entry.location, ownerKey: entry.ownerKey,
        adjustmentRolls: input.quantity, adjustmentWeightKg: input.weightKg
      }), session);
    }
    if (entry.kind === 'YARN') {
      return submitOperationInSession(operationInput.parse({
        ...input, kind: 'YARN_ADJUSTMENT', remarks: input.reason, externalReference: id,
        items: [{ yarnSpec: entry.yarnSpec, ownerKey: entry.ownerKey, packageUnit: entry.packageUnit, rolls: input.quantity, weightKg: input.weightKg }]
      }), session);
    }
    throw new BadRequestError('Link the supporting production issue for this item.');
  });
  res.status(201).json({ success: true, data: document });
}));
