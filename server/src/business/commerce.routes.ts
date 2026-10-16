import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { sendTable } from './export.js';
import { registerPipeline, RegisterRow } from './register.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requirePermission } from '../middleware/auth.middleware.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { parsePagination, formatPaginatedResult } from '../utils/pagination.js';
import { escapeRegex } from '../utils/search.js';
import { BusinessDocument, BillPayment, BillAllocation } from './commerce.models.js';
import { KnittingReceipt, DyeingReceipt, YarnInventory, StockMovement } from './records.js';
import { DyeingBatch } from '../models/DyeingBatch.js';
import { Dispatch } from '../models/Dispatch.js';
import { DyeingUnit } from '../models/DyeingUnit.js';
import { reverseDyeingReceipt, reverseDyeingIssue } from './dyeing.js';
import { reverseYarnDelivery } from './knitting.js';
import { postReturn, returnInput } from './returns.js';
import { billableSources } from './billable-sources.js';
import { YarnTransaction } from '../models/YarnTransaction.js';
import { FabricInventory } from '../models/FabricInventory.js';
import { Party } from '../models/Party.js';
import { PaymentVoucher } from '../models/PaymentVoucher.js';
import { operationInput, operationKinds } from './commerce.schema.js';
import { submitOperation, saveDraft, postDraft, payBill, reverseOperation } from './commerce.js';
import { businessContext } from './context.js';
import { postCommand, weight, money } from './posting.js';
import { postPartyAmount } from './finance.js';
import { ensureDefaultDyeingUnits } from '../modules/dyeing/dyeing.service.js';
import { locationName } from './location-label.js';

export const workspaceRoutes = Router();
workspaceRoutes.get('/locations', asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin' && !req.user?.permissions.some(permission => ['inventory:read', 'dyeing:read', 'dispatch:read'].includes(permission))) throw new ForbiddenError('You do not have permission to view locations.');
  await ensureDefaultDyeingUnits();
  const units = await DyeingUnit.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });res.json({ success: true, data: units.map(unit => ({ value: unit.code, label: locationName(unit) })) });
}));
workspaceRoutes.post('/documents/:id/returns', requirePermission('accounts:write'), requirePermission('inventory:write'), asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await postReturn(String(req.params.id), returnInput.parse(req.body)) }); }));
workspaceRoutes.post('/yarn-deliveries/:id/reverse', requirePermission('knitting:write'), asyncHandler(async (req, res) => { res.json({ success: true, data: await reverseYarnDelivery(String(req.params.id), z.object({ reason: z.string().trim().min(3), requestId: z.string().uuid() }).parse(req.body)) }); }));
workspaceRoutes.post('/yarn-movements/:id/reverse', requirePermission('knitting:write'), asyncHandler(async (req, res) => {
  const input = z.object({ reason: z.string().trim().min(3), requestId: z.string().uuid() }).parse(req.body);const document = await BusinessDocument.findById(req.params.id);
  if (document && !document.kind.startsWith('YARN')) throw new ForbiddenError('This is not a yarn movement.');
  res.json({ success: true, data: document ? await reverseOperation(String(req.params.id), input) : await reverseYarnDelivery(String(req.params.id), input) });
}));
workspaceRoutes.get('/register', requirePermission('knitting:read', 'dyeing:read', 'dispatch:read', 'inventory:read'), asyncHandler(async (req, res) => {
  const type = req.query.type === 'IGP' ? 'IGP' : 'OGP';const { page, limit, skip } = parsePagination(req.query);
  const filter = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), partyId: z.string().optional(), search: z.string().optional(), millName: z.string().optional() }).parse(req.query);
  const pipeline = registerPipeline(type, filter);
  if (req.query.format) {
    const rows = await KnittingReceipt.aggregate<RegisterRow>(pipeline);await sendTable(res, String(req.query.format), type + ' register', ['Date', 'Gate pass', 'Movement', 'Fabric', 'Yarn', 'Shade', 'Rolls / packages', 'Actual kg', 'PO', 'External reference'], rows.map(row => [row.date, row.number, row.source, row.fabricType, row.yarnSpec, row.color, row.rolls, row.weightKg, row.poNo, row.externalReference]));return;
  }
  const [result] = await KnittingReceipt.aggregate([...pipeline, { $facet: { items: [{ $skip: skip }, { $limit: limit }], count: [{ $count: 'total' }] } }]);
  res.json({ success: true, data: formatPaginatedResult(result.items, result.count[0]?.total || 0, page, limit) });
}));
workspaceRoutes.get('/dyeing-receipts', requirePermission('dyeing:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);const search = req.query.search ? new RegExp(escapeRegex(String(req.query.search)), 'i') : undefined;
  const match = search ? { $or: [{ number: search }, { gatePassNo: search }, { poNo: search }, { externalReference: search }] } : {};
  const [items, total] = await Promise.all([DyeingReceipt.find(match).populate('partyId', 'name code').sort({ date: -1, _id: -1 }).skip(skip).limit(limit), DyeingReceipt.countDocuments(match)]);
  res.json({ success: true, data: formatPaginatedResult(items, total, page, limit) });
}));
workspaceRoutes.post('/dyeing-receipts/:id/reverse', requirePermission('dyeing:write'), asyncHandler(async (req, res) => { res.json({ success: true, data: await reverseDyeingReceipt(String(req.params.id), z.object({ reason: z.string().trim().min(3), requestId: z.string().uuid() }).parse(req.body)) }); }));
workspaceRoutes.post('/dyeing-issues/:id/reverse', requirePermission('dyeing:write'), asyncHandler(async (req, res) => { res.json({ success: true, data: await reverseDyeingIssue(String(req.params.id), z.object({ reason: z.string().trim().min(3), requestId: z.string().uuid() }).parse(req.body)) }); }));
const permitted = (req: Parameters<Parameters<typeof asyncHandler>[0]>[0], permissions: string[]) => {
  if (req.user?.role !== 'admin' && !permissions.every(permission => req.user?.permissions.includes(permission))) throw new ForbiddenError('You do not have permission for this action.');
};
workspaceRoutes.get('/yarn', requirePermission('knitting:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20);
  const match = req.query.search ? { yarnSpec: new RegExp(escapeRegex(String(req.query.search)), 'i') } : {};
  const [items, total] = await Promise.all([YarnInventory.find(match).sort({ yarnSpec: 1, packageUnit: 1 }).skip(skip).limit(limit), YarnInventory.countDocuments(match)]);
  res.json({ success: true, data: formatPaginatedResult(items, total, page, limit) });
}));
workspaceRoutes.get('/receipts', requirePermission('knitting:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20);
  const match = req.query.search ? { $or: [{ gatePassNo: new RegExp(escapeRegex(String(req.query.search)), 'i') }, { receiptNo: new RegExp(escapeRegex(String(req.query.search)), 'i') }] } : {};
  const [items, total] = await Promise.all([KnittingReceipt.find(match).populate('partyId', 'name code').sort({ date: -1, _id: -1 }).skip(skip).limit(limit), KnittingReceipt.countDocuments(match)]);
  res.json({ success: true, data: formatPaginatedResult(items, total, page, limit) });
}));
workspaceRoutes.post('/receipts/:id/reverse', requirePermission('knitting:write'), asyncHandler(async (req, res) => {
  const input = z.object({ reason: z.string().trim().min(3), requestId: z.string().uuid() }).parse(req.body);
  const result = await postCommand('REVERSE_KNITTING_RECEIPT', { ...input, id: req.params.id }, async session => {
    const receipt = await KnittingReceipt.findOne({ _id: req.params.id, status: 'POSTED' }).session(session);
    if (!receipt) throw new NotFoundError('Posted receipt not found.');
    if (await BillAllocation.countDocuments({ sourceId: receipt._id }).session(session)) throw new BadRequestError('Reverse its processing bills before reversing this receipt.');
    for (const item of receipt.items) {
      const issues = await YarnTransaction.find({ _id: { $in: item.allocations.map(allocation => allocation.transactionId) } }).session(session);
      const ownerKey = issues[0]?.ownerKey || 'OWN';
      const stock = await FabricInventory.findOneAndUpdate({ fabricType: item.fabricType, yarnSpec: item.yarnSpec, color: 'ECRU', state: 'RAW_ECRU', location: 'ZR_GODOWN', ownerKey, totalRolls: { $gte: item.rollsCount }, totalWeightKg: { $gte: item.weightKg } }, { $inc: { totalRolls: -item.rollsCount, totalWeightKg: -item.weightKg } }, { new: true, session });
      if (!stock) throw new BadRequestError('This fabric has already moved. Return or reverse the later movement first.');
      for (const allocation of item.allocations) {
        const issue = issues.find(value => String(value._id) === String(allocation.transactionId));
        if (!issue) throw new BadRequestError('A linked yarn issue is missing.');
        issue.receivedFabricKg = weight(issue.receivedFabricKg - (allocation.fabricKg || 0));issue.actualWastageKg = weight(issue.actualWastageKg - (allocation.wastageKg || 0));issue.remainingYarnBalanceKg = weight(issue.remainingYarnBalanceKg + (allocation.weightKg || 0));await issue.save({ session });
      }
      await StockMovement.create([{ sourceId: receipt._id, material: 'FABRIC', item: `${item.fabricType} / ${item.yarnSpec}`, weightKg: -item.weightKg, quantity: -item.rollsCount, location: 'ZR_GODOWN', date: new Date(), reason: `Receipt reversed: ${input.reason}`, actorId: businessContext.getStore()!.actorId }], { session });
    }
    receipt.status = 'REVERSED';receipt.remarks += ` | ${input.reason}`;await receipt.save({ session });return receipt.toObject();
  });res.json({ success: true, data: result });
}));
workspaceRoutes.get('/documents', asyncHandler(async (req, res) => {
  const kinds = req.query.kinds ? String(req.query.kinds).split(',') : [];
  permitted(req, kinds.length && kinds.every(kind => kind.startsWith('YARN')) ? ['knitting:read'] : ['accounts:read']);
  const { page, limit, skip } = parsePagination(req.query, 20);
  const search = req.query.search ? new RegExp(escapeRegex(String(req.query.search)), 'i') : undefined;
  const match = { ...(kinds.length ? { kind: { $in: kinds } } : {}), ...(search ? { $or: [{ number: search }, { reference: search }, { poNo: search }, { externalReference: search }] } : {}) };
  if (req.query.format) {
    const rows = await BusinessDocument.find(match).populate('partyId', 'name').sort({ date: -1, _id: -1 });
    await sendTable(res, String(req.query.format), 'Documents', ['Document', 'Type', 'Status', 'Party', 'Date', 'Paper reference', 'PO', 'External reference', 'Fabric', 'Yarn', 'Shade', 'Rolls', 'Kg', 'Rate', 'Basis', 'Bill total', 'Paid', 'Outstanding'], rows.flatMap(document => document.items.map(item => [document.number, document.kind, document.status, (document.partyId as unknown as { name?: string })?.name, document.date, document.reference, document.get('poNo'), document.get('externalReference'), item.fabricType, item.yarnSpec, item.color, item.rolls, item.weightKg, item.rate, item.basis, document.total, document.paid, money(document.total - document.credited - document.paid)])));return;
  }
  const [items, total] = await Promise.all([BusinessDocument.find(match).populate('partyId', 'name code').sort({ date: -1, _id: -1 }).skip(skip).limit(limit), BusinessDocument.countDocuments(match)]);
  res.json({ success: true, data: formatPaginatedResult(items, total, page, limit) });
}));
workspaceRoutes.post('/documents', asyncHandler(async (req, res) => {
  const kind = z.enum(operationKinds).parse(req.body.kind);
  permitted(req, kind.startsWith('YARN') ? ['knitting:write'] : kind === 'FABRIC_RECEIPT' ? ['inventory:write'] : kind === 'FABRIC_PURCHASE' ? ['inventory:write', 'accounts:write'] : ['accounts:write']);
  const result = req.body.saveAsDraft === true ? await saveDraft(req.body) : await submitOperation(operationInput.parse(req.body));
  res.status(201).json({ success: true, data: result });
}));
workspaceRoutes.post('/documents/:id/post', asyncHandler(async (req, res) => {
  const document = await BusinessDocument.findById(req.params.id);if (!document) throw new NotFoundError('Draft not found.');
  permitted(req, document.kind.startsWith('YARN') ? ['knitting:write'] : document.kind === 'FABRIC_RECEIPT' ? ['inventory:write'] : document.kind === 'FABRIC_PURCHASE' ? ['inventory:write', 'accounts:write'] : ['accounts:write']);res.json({ success: true, data: await postDraft(String(req.params.id)) });
}));
workspaceRoutes.post('/documents/:id/reverse', requirePermission('accounts:write'), asyncHandler(async (req, res) => {
  const original = await BusinessDocument.findById(req.params.id);if (original && ['FABRIC_RECEIPT', 'FABRIC_PURCHASE', 'CREDIT_NOTE'].includes(original.kind)) permitted(req, ['inventory:write']);
  res.json({ success: true, data: await reverseOperation(String(req.params.id), z.object({ reason: z.string().trim().min(3), requestId: z.string().uuid() }).parse(req.body)) });
}));
workspaceRoutes.post('/documents/:id/payments', requirePermission('accounts:write'), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await payBill(String(req.params.id), z.object({ amount: z.number().min(0.01).multipleOf(0.01), date: z.string().datetime(), reference: z.string().optional(), refund: z.boolean().optional(), requestId: z.string().uuid() }).parse(req.body)) });
}));
workspaceRoutes.get('/documents/:id/payments', requirePermission('accounts:read'), asyncHandler(async (req, res) => { res.json({ success: true, data: await BillPayment.find({ billId: req.params.id }).sort({ date: -1 }) }); }));
workspaceRoutes.post('/payments/:id/reverse', requirePermission('accounts:write'), asyncHandler(async (req, res) => {
  const input = z.object({ reason: z.string().trim().min(3), requestId: z.string().uuid() }).parse(req.body);
  const result = await postCommand('REVERSE_BILL_PAYMENT', { ...input, paymentId: req.params.id }, async session => {
    const payment = await BillPayment.findOne({ _id: req.params.id, status: 'POSTED' }).session(session);if (!payment) throw new NotFoundError('Payment not found.');
    const bill = await BusinessDocument.findById(payment.billId).session(session);if (!bill || !bill.partyId) throw new NotFoundError('Bill not found.');
    if (bill.intercompanyId) throw new BadRequestError('Reverse a linked settlement from the inter-company transaction.');
    if (money(bill.paid - payment.amount) < 0) throw new BadRequestError('Reverse the refund before reversing the original payment.');
    await postPartyAmount(bill.partyId, bill.direction === 'PAYABLE' ? -payment.amount : payment.amount, payment._id, bill.number, new Date(), `Payment reversed: ${input.reason}`, session);
    await PaymentVoucher.updateOne({ _id: payment.voucherId }, { $set: { status: 'REVERSED' } }, { session });
    bill.paid = money(bill.paid - payment.amount);await bill.save({ session });payment.status = 'REVERSED';await payment.save({ session });return payment.toObject();
  });res.json({ success: true, data: result });
}));
workspaceRoutes.get('/sources', requirePermission('accounts:read'), asyncHandler(async (req, res) => {
  const kind = String(req.query.kind);const { page, limit, skip } = parsePagination(req.query, 20);
  if (kind === 'CUSTOMER_BILL') {
    const match = { status: 'POSTED' };const [rows, total] = await Promise.all([Dispatch.find(match).populate('customerId', 'name').sort({ date: -1 }).skip(skip).limit(limit), Dispatch.countDocuments(match)]);
    const items = rows.map(row => ({ _id: row._id, label: row.dispatchNo + ' · ' + row.ogpNo, partyId: (row.customerId as unknown as { _id: Types.ObjectId })._id, items: [{ fabricType: row.fabricType, yarnSpec: row.yarnSpec, state: row.state, color: row.color, weightKg: row.totalNetWeightKg, rolls: row.totalRolls, sourceLineId: String(row._id), rate: 0, basis: 'KG' }] }));
    res.json({ success: true, data: formatPaginatedResult(await billableSources(items, 'RECEIVABLE'), total, page, limit) });return;
  }
  const sources = kind === 'KNITTING_CHARGE' ? await KnittingReceipt.find({ status: 'POSTED' }).populate('partyId', 'name').sort({ date: -1 }).skip(skip).limit(limit) : kind === 'DYEING_CHARGE' ? await DyeingReceipt.find({ status: 'POSTED' }).populate('partyId', 'name').sort({ date: -1 }).skip(skip).limit(limit) : await BusinessDocument.find({ kind: 'FABRIC_RECEIPT', status: 'POSTED' }).populate('partyId', 'name').sort({ date: -1 }).skip(skip).limit(limit);
  const total = kind === 'KNITTING_CHARGE' ? await KnittingReceipt.countDocuments({ status: 'POSTED' }) : kind === 'DYEING_CHARGE' ? await DyeingReceipt.countDocuments({ status: 'POSTED' }) : await BusinessDocument.countDocuments({ kind: 'FABRIC_RECEIPT', status: 'POSTED' });
  const items = sources.map(source => {
    const value = source.toObject() as Record<string, unknown>;
    const party = (value.partyId || value.millPartyId) as { _id?: unknown; name?: string } | undefined;
    const rows = (value.items as Array<Record<string, unknown>> | undefined) || [{ _id: value._id, fabricType: value.fabricType, yarnSpec: value.yarnSpec, weightKg: value.finishWeightKg, rolls: value.finishRollsCount }];
    return { _id: value._id, label: `${value.gatePassNo || value.igpNo || value.number || value.receiptNo || value.batchNo} · ${party?.name || 'Processor'}`, partyId: party?._id, items: rows.map(item => ({ ...item, sourceLineId: String(item._id), rolls: item.rolls || item.rollsCount, rate: 0, basis: 'KG' })) };
  });res.json({ success: true, data: formatPaginatedResult(await billableSources(items, req.query.direction === 'RECEIVABLE' ? 'RECEIVABLE' : 'PAYABLE'), total, page, limit) });
}));

workspaceRoutes.get('/documents/:id', requirePermission('accounts:read'), asyncHandler(async (req, res) => {
  const document = await BusinessDocument.findById(req.params.id).populate('partyId', 'name code');if (!document) throw new NotFoundError('Document not found.');res.json({ success: true, data: document });
}));
workspaceRoutes.get('/documents/:id/export', requirePermission('accounts:read'), asyncHandler(async (req, res) => {
  const document = await BusinessDocument.findById(req.params.id).populate('partyId', 'name');if (!document) throw new NotFoundError('Document not found.');
  await sendTable(res, String(req.query.format || 'xlsx'), document.number, ['Date', 'Party', 'Paper reference', 'PO', 'External reference', 'Status', 'Fabric', 'Yarn', 'Shade', 'Description', 'Quantity', 'Kg', 'Rate', 'Basis', 'Subtotal', 'Tax', 'Total', 'Paid', 'Outstanding'], document.items.map(item => [document.date, (document.partyId as unknown as { name?: string })?.name, document.reference, document.get('poNo'), document.get('externalReference'), document.status, item.fabricType, item.yarnSpec, item.color, item.description, item.rolls, item.weightKg, item.rate, item.basis, document.baseAmount, document.taxAmount, document.total, document.paid, money(document.total - document.credited - document.paid)]));
}));
workspaceRoutes.patch('/documents/:id/draft', asyncHandler(async (req, res) => {
  const kind = z.enum(operationKinds).parse(req.body.kind);permitted(req, kind.startsWith('YARN') ? ['knitting:write'] : kind === 'FABRIC_RECEIPT' ? ['inventory:write'] : kind === 'FABRIC_PURCHASE' ? ['inventory:write', 'accounts:write'] : ['accounts:write']);const document = await BusinessDocument.findOneAndUpdate({ _id: req.params.id, kind, status: 'DRAFT' }, { $set: { draft: req.body, reference: String(req.body.reference || ''), partyId: Types.ObjectId.isValid(String(req.body.partyId)) ? req.body.partyId : undefined, date: Number.isFinite(new Date(req.body.date).valueOf()) ? new Date(req.body.date) : new Date() } }, { new: true });if (!document) throw new NotFoundError('Editable draft not found.');res.json({ success: true, data: document });
}));
workspaceRoutes.get('/yarn-issues', requirePermission('knitting:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, 20);const match = { transactionType: 'OUTWARD_TO_KNITTER', remainingYarnBalanceKg: { $gt: 0 } };
  const [rows, total] = await Promise.all([YarnTransaction.find(match).populate('partyId', 'name').sort({ date: 1, _id: 1 }).skip(skip).limit(limit), YarnTransaction.countDocuments(match)]);
  const items = rows.map(row => ({ _id: row._id, label: row.gatePassNo + ' · ' + row.yarnSpec + ' · ' + row.remainingYarnBalanceKg + ' kg unused', partyId: String((row.partyId as unknown as { _id: Types.ObjectId })._id), items: [{ yarnSpec: row.yarnSpec, weightKg: row.remainingYarnBalanceKg, rolls: 0, packageUnit: row.packageUnit, ownerKey: row.ownerKey }] }));
  res.json({ success: true, data: formatPaginatedResult(items, total, page, limit) });
}));
