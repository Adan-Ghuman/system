import { DyeingBatch } from '../models/DyeingBatch.js';
import { Router, Request } from 'express';
import { PipelineStage, Types } from 'mongoose';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requirePermission } from '../middleware/auth.middleware.js';
import { ForbiddenError, BadRequestError, NotFoundError } from '../utils/errors.js';
import { purchaseInput } from './purchases.schema.js';
import { supplierSources, receiptOptions, quotePurchase, postPurchase } from './purchases.js';
import { BusinessDocument, BillAllocation, BillPayment } from './commerce.models.js';
import { KnittingReceipt, DyeingReceipt, StockMovement } from './records.js';
import { Dispatch } from '../models/Dispatch.js';
import { PaymentVoucher } from '../models/PaymentVoucher.js';
import { YarnTransaction } from '../models/YarnTransaction.js';
import { Party } from '../models/Party.js';
import { businessContext, businessRecordFilter } from './context.js';
import { parsePagination, formatPaginatedResult } from '../utils/pagination.js';
import { escapeRegex } from '../utils/search.js';
import { sendTable } from './export.js';
import { postCommand } from './posting.js';

export const transactionRoutes = Router();
const requireAll = (req: Request, permissions: string[]) => { if (req.user?.role !== 'admin' && permissions.some(p => !req.user?.permissions.includes(p))) throw new ForbiddenError('Your account needs permission for each goods/work movement, bill and payment in this entry.'); };
function canPost(req: Request, input: z.infer<typeof purchaseInput>) { requireAll(req, [...(input.billNow ? ['accounts:write'] : []), ...(input.situation === 'NOW' ? [input.mode === 'YARN' || input.mode === 'KNITTING' ? 'knitting:write' : input.mode === 'DYEING' ? 'dyeing:write' : 'inventory:write'] : [])]); }
transactionRoutes.get('/supplier-sources', requirePermission('accounts:read'), asyncHandler(async (req, res) => { res.json({ success: true, data: await supplierSources(String(req.query.mode), String(req.query.partyId)) }); }));
transactionRoutes.get('/receipt-options', asyncHandler(async (req, res) => { requireAll(req, [req.query.mode === 'KNITTING' ? 'knitting:read' : 'dyeing:read']);res.json({ success: true, data: await receiptOptions(String(req.query.mode), String(req.query.partyId)) }); }));
transactionRoutes.get('/payments', requirePermission('accounts:read'), asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(String(req.query.partyId))) throw new BadRequestError('Choose a supplier.');
  const linked = await BillPayment.find({ status: 'POSTED' }).distinct('voucherId');
  res.json({ success: true, data: await PaymentVoucher.find({ partyId: req.query.partyId, voucherType: 'PAYMENT', status: { $ne: 'REVERSED' }, _id: { $nin: linked } }).select('voucherNo date amount paymentMode').sort({ date: -1 }) });
}));
transactionRoutes.get('/voucher/:id', requirePermission('accounts:read'), asyncHandler(async (req, res) => { const voucher = await PaymentVoucher.findById(req.params.id).populate('partyId', 'name code');if (!voucher) throw new NotFoundError('Voucher not found.');res.json({ success: true, data: voucher }); }));
transactionRoutes.post('/quote', asyncHandler(async (req, res) => { const input = purchaseInput.parse(req.body);canPost(req, input);res.json({ success: true, data: await quotePurchase(input) }); }));
transactionRoutes.post('/', asyncHandler(async (req, res) => { const input = purchaseInput.parse(req.body);canPost(req, input);res.status(201).json({ success: true, data: await postPurchase(input) }); }));
transactionRoutes.post('/drafts', asyncHandler(async (req, res) => {
  const body = z.object({ requestId: z.string().uuid(), draftId: z.string().regex(/^[a-f0-9]{24}$/i).optional(), partyId: z.string().default(''), mode: z.enum(['YARN', 'FABRIC', 'KNITTING', 'DYEING']), date: z.string().datetime(), reference: z.string().trim().max(150).default('') }).passthrough().parse(req.body);
  const billNow = body.billNow !== false;const permissions = billNow ? ['accounts:write'] : [body.mode === 'KNITTING' || body.mode === 'YARN' ? 'knitting:write' : body.mode === 'DYEING' ? 'dyeing:write' : 'inventory:write'];requireAll(req, permissions);
  const result = await postCommand('SUPPLIER_DRAFT', body, async session => {
    if (body.draftId) {
      const draft = await BusinessDocument.findOneAndUpdate({ _id: body.draftId, status: 'DRAFT', direction: 'PAYABLE' }, { $set: { draft: body, reference: body.reference, date: new Date(body.date), ...(Types.ObjectId.isValid(body.partyId) ? { partyId: body.partyId } : {}) } }, { new: true, session });if (!draft) throw new NotFoundError('Draft is unavailable.');return draft.toObject();
    }
    const [draft] = await BusinessDocument.create([{ kind: 'SUPPLIER_DRAFT', direction: 'PAYABLE', number: 'DRAFT-' + new Types.ObjectId(), date: new Date(body.date), reference: body.reference, ...(Types.ObjectId.isValid(body.partyId) ? { partyId: body.partyId } : {}), status: 'DRAFT', actorId: businessContext.getStore()!.actorId, draft: body }], { session });return draft.toObject();
  });res.status(201).json({ success: true, data: result });
}));
transactionRoutes.get('/activity/:id', requirePermission('accounts:read'), asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(String(req.params.id))) throw new BadRequestError('Choose a saved activity.');
  const id = new Types.ObjectId(String(req.params.id));
  const allocations = await BillAllocation.find({ $or: [{ sourceId: id }, { billId: id }] });
  const roots = [...new Set([String(id), ...allocations.map(a => String(a.sourceId))])];
  const knitting = await KnittingReceipt.find({ $or: [{ _id: { $in: roots } }, { 'items.allocations.transactionId': { $in: roots } }] });
  const dyeing = await DyeingReceipt.find({ $or: [{ _id: { $in: roots } }, { 'items.batchId': { $in: roots } }, { 'items.allocations.batchId': { $in: roots } }] });
  const sources = [...new Set([...roots, ...knitting.map(r => String(r._id)), ...dyeing.map(r => String(r._id))])];
  const allAllocations = await BillAllocation.find({ sourceId: { $in: sources } });
  let documents = await BusinessDocument.find({ $or: [{ _id: { $in: [id, ...allAllocations.map(a => a.billId)] } }, { sourceId: { $in: sources } }, { 'items.sourceId': { $in: sources } }] }).populate('partyId', 'name code').sort({ date: 1, _id: 1 });
  const credits = await BusinessDocument.find({ kind: 'CREDIT_NOTE', sourceId: { $in: documents.map(d => d._id) } }).populate('partyId', 'name code');
  documents = [...documents, ...credits.filter(c => !documents.some(d => String(d._id) === String(c._id)))].sort((a, b) => +a.date - +b.date);
  const payments = await BillPayment.find({ billId: { $in: documents.map(d => d._id) } }).populate('voucherId').sort({ date: 1 });
  const movementSources = [...sources, ...dyeing.flatMap(r => r.items.flatMap(i => [i.batchId, ...i.allocations.map(allocation => allocation.batchId)]).filter(Boolean).map(String)), ...knitting.flatMap(r => r.items.flatMap(i => i.allocations.map(a => String(a.transactionId))))];
  const movements = await StockMovement.find({ sourceId: { $in: movementSources } }).sort({ date: 1 });
  const work = [...knitting.map(r => ({ _id: r._id, number: r.receiptNo, reference: r.gatePassNo, date: r.date, kind: 'KNITTING', status: r.status })), ...dyeing.map(r => ({ _id: r._id, number: r.number, reference: r.gatePassNo, date: r.date, kind: 'DYEING_RECEIVED', status: r.status }))];
  res.json({ success: true, data: { documents, payments, movements, work } });
}));
transactionRoutes.get('/', requirePermission('accounts:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);const scope = businessRecordFilter();
  const physical = ['FABRIC_RECEIPT', 'YARN_RECEIPT'];
  const commonProjection = { recordId: '$_id', date: 1, reference: 1, number: 1, partyId: 1, kind: 1, status: { $ifNull: ['$status', 'POSTED'] }, total: { $ifNull: ['$total', 0] }, paid: { $ifNull: ['$paid', 0] }, credited: { $ifNull: ['$credited', 0] }, settlementStatus: 1, sourceId: 1, sourceKind: 1, receiptMode: 1, side: 1, rootId: 1, billable: 1, sourceDate: 1, lineIds: 1 };
  const pipelines: PipelineStage[] = [
    { $match: { $or: [{ total: { $gt: 0 }, kind: { $nin: ['CREDIT_NOTE', 'INTERCOMPANY_CREDIT'] } }, { status: 'DRAFT' }, { kind: { $in: [...physical, 'YARN_CLIENT_RETURN', 'YARN_RETURN', 'YARN_ADJUSTMENT'] } }] } },
    { $match: { $nor: [{ kind: { $in: ['SUPPLIER_DRAFT', 'SALES_DRAFT', 'DELIVERY_DRAFT'] }, status: { $ne: 'DRAFT' } }] } },
    { $set: { side: { $cond: [{ $or: [{ $gt: ['$total', 0] }, { $eq: ['$status', 'DRAFT'] }] }, { $cond: [{ $or: [{ $in: ['$kind', ['CUSTOMER_BILL', 'SALES_DRAFT', 'DELIVERY_DRAFT']] }, { $eq: ['$draft.direction', 'RECEIVABLE'] }] }, 'RECEIVABLE', '$direction'] }, { $cond: [{ $in: ['$kind', physical] }, 'PAYABLE', 'MOVEMENT'] }] }, rootId: { $cond: [{ $and: [{ $ne: ['$status', 'DRAFT'] }, { $ifNull: ['$sourceId', false] }, { $gt: ['$total', 0] }] }, '$sourceId', '$_id'] }, receiptMode: { $cond: [{ $eq: ['$kind', 'YARN_RECEIPT'] }, 'YARN', { $cond: [{ $eq: ['$kind', 'FABRIC_RECEIPT'] }, 'FABRIC', null] }] }, lineIds: '$items._id', sourceKind: '$kind', billable: { $in: ['$kind', physical] }, sourceDate: '$date' } },
    { $project: commonProjection },
    { $unionWith: { coll: KnittingReceipt.collection.name, pipeline: [{ $match: scope }, { $project: { _id: 1, recordId: '$_id', rootId: '$_id', partyId: 1, date: 1, sourceDate: '$date', reference: '$gatePassNo', number: '$receiptNo', lineIds: '$items._id', kind: { $literal: 'KNITTING_RECEIPT' }, sourceKind: { $literal: 'KNITTING' }, receiptMode: { $literal: 'KNITTING' }, side: { $cond: [{ $eq: ['$productionType', 'IN_HOUSE'] }, 'MOVEMENT', 'PAYABLE'] }, status: 1, total: { $literal: 0 }, paid: { $literal: 0 }, credited: { $literal: 0 }, billable: { $ne: ['$productionType', 'IN_HOUSE'] } } }] } },
    { $unionWith: { coll: DyeingReceipt.collection.name, pipeline: [{ $match: scope }, { $project: { _id: 1, recordId: '$_id', rootId: '$_id', partyId: 1, date: 1, sourceDate: '$date', reference: '$gatePassNo', number: 1, lineIds: '$items._id', kind: { $literal: 'DYEING_RECEIPT' }, sourceKind: { $literal: 'DYEING_RECEIVED' }, receiptMode: { $literal: 'DYEING' }, side: { $literal: 'PAYABLE' }, status: 1, total: { $literal: 0 }, paid: { $literal: 0 }, credited: { $literal: 0 }, billable: { $literal: true } } }] } },
    { $unionWith: { coll: Dispatch.collection.name, pipeline: [{ $match: scope }, { $project: { _id: 1, recordId: '$_id', rootId: '$_id', partyId: '$customerId', date: 1, sourceDate: '$date', reference: '$ogpNo', number: '$dispatchNo', lineIds: ['$_id'], kind: { $literal: 'DELIVERY' }, sourceKind: { $literal: 'DELIVERY' }, receiptMode: { $literal: 'EXISTING_DELIVERY' }, side: { $cond: [{ $eq: ['$purpose', 'CLIENT_RETURN'] }, 'MOVEMENT', 'RECEIVABLE'] }, status: 1, total: { $literal: 0 }, paid: { $literal: 0 }, credited: { $literal: 0 }, billable: { $ne: ['$purpose', 'CLIENT_RETURN'] } } }] } },
    { $unionWith: { coll: DyeingBatch.collection.name, pipeline: [{ $match: scope }, { $project: { _id: 1, recordId: '$_id', rootId: '$_id', partyId: '$millPartyId', date: '$dateIssued', reference: '$ogpNo', number: '$batchNo', kind: { $literal: 'DYEING_ISSUE' }, sourceKind: { $literal: 'DYEING_SENT' }, side: { $literal: 'MOVEMENT' }, status: { $cond: [{ $eq: ['$status', 'REVERSED'] }, 'REVERSED', 'POSTED'] }, total: { $literal: 0 }, paid: { $literal: 0 }, credited: { $literal: 0 }, billable: { $literal: false } } }] } },
    { $unionWith: { coll: PaymentVoucher.collection.name, pipeline: [{ $match: scope }, { $lookup: { from: BillPayment.collection.name, localField: '_id', foreignField: 'voucherId', pipeline: [{ $match: { ...scope, status: 'POSTED' } }], as: 'allocations' } }, { $match: { 'allocations.0': { $exists: false } } }, { $project: { _id: 1, recordId: '$_id', rootId: '$_id', partyId: 1, date: 1, reference: '$remarks', number: '$voucherNo', kind: '$voucherType', sourceKind: { $literal: 'VOUCHER' }, side: { $literal: 'MONEY' }, status: { $ifNull: ['$status', 'POSTED'] }, total: '$amount', paid: { $literal: 0 }, credited: { $literal: 0 }, billable: { $literal: false } } }] } },
    { $unionWith: { coll: YarnTransaction.collection.name, pipeline: [{ $match: scope }, { $project: { _id: 1, recordId: '$_id', rootId: '$_id', partyId: 1, date: 1, reference: '$gatePassNo', number: '$gatePassNo', kind: '$transactionType', sourceKind: { $literal: 'YARN_MOVEMENT' }, side: { $literal: 'MOVEMENT' }, status: { $ifNull: ['$status', 'POSTED'] }, total: { $literal: 0 }, paid: { $literal: 0 }, credited: { $literal: 0 }, billable: { $literal: false } } }] } },
    { $sort: { date: 1, _id: 1 } },
    { $group: { _id: { rootId: '$rootId', side: '$side' }, recordId: { $first: '$rootId' }, side: { $first: '$side' }, date: { $max: '$date' }, number: { $last: '$number' }, reference: { $last: '$reference' }, partyId: { $last: '$partyId' }, total: { $sum: { $cond: [{ $eq: ['$status', 'POSTED'] }, '$total', 0] } }, paid: { $sum: { $cond: [{ $eq: ['$status', 'POSTED'] }, '$paid', 0] } }, credited: { $sum: { $cond: [{ $eq: ['$status', 'POSTED'] }, '$credited', 0] } }, unknown: { $max: { $cond: [{ $and: [{ $eq: ['$status', 'POSTED'] }, { $eq: ['$settlementStatus', 'NOT_RECORDED'] }] }, 1, 0] } }, documents: { $push: { _id: '$recordId', number: '$number', reference: '$reference', kind: '$kind', sourceKind: '$sourceKind', status: '$status', total: '$total', settlementStatus: '$settlementStatus' } }, states: { $addToSet: '$status' }, billable: { $max: '$billable' }, lineIds: { $first: '$lineIds' }, receipts: { $push: { $cond: ['$billable', { mode: '$receiptMode', kind: '$sourceKind', id: '$recordId' }, null] } } } },
    { $lookup: { from: Party.collection.name, localField: 'partyId', foreignField: '_id', pipeline: [{ $match: scope }, { $project: { name: 1, code: 1 } }], as: 'party' } },
    { $lookup: { from: BillAllocation.collection.name, localField: 'recordId', foreignField: 'sourceId', pipeline: [{ $match: scope }], as: 'allocations' } },
    { $set: { party: { $first: '$party' }, _id: { $concat: ['$_id.side', ':', { $toString: '$_id.rootId' }] }, receipt: { $first: { $filter: { input: '$receipts', as: 'r', cond: { $ne: ['$$r', null] } } } }, status: { $cond: [{ $in: ['DRAFT', '$states'] }, 'DRAFT', { $cond: [{ $in: ['POSTED', '$states'] }, 'POSTED', 'REVERSED'] }] }, paid: { $cond: ['$unknown', null, '$paid'] }, outstanding: { $cond: [{ $or: ['$unknown', { $eq: ['$side', 'MONEY'] }, { $eq: ['$total', 0] }] }, null, { $round: [{ $subtract: [{ $subtract: ['$total', '$credited'] }, '$paid'] }, 2] }] } } },
    { $set: { awaitingBill: { $and: ['$billable', { $ne: ['$status', 'REVERSED'] }, { $anyElementTrue: [{ $map: { input: { $ifNull: ['$lineIds', []] }, as: 'line', in: { $lt: [{ $sum: { $map: { input: { $filter: { input: '$allocations', as: 'a', cond: { $and: [{ $eq: ['$$a.direction', '$side'] }, { $eq: ['$$a.sourceLineId', { $toString: '$$line' }] }] } } }, as: 'a', in: '$$a.fraction' } } }, 0.9999999] } } }] }] } } },
    { $project: { allocations: 0, states: 0, receipts: 0 } }
  ];
  const filters: Record<string, unknown> = {};
  if (req.query.view === 'CUSTOMER') filters.side = 'RECEIVABLE';
  if (req.query.view === 'SUPPLIER') filters.side = 'PAYABLE';
  if (req.query.view === 'MONEY') filters.side = 'MONEY';
  if (req.query.view === 'MOVEMENTS') filters.$and = [{ $or: [{ billable: true }, { side: 'MOVEMENT' }] }];
  if (req.query.view === 'AWAITING') filters.awaitingBill = true;
  if (req.query.view === 'DRAFTS') filters.status = 'DRAFT';
  if (req.query.search) { const search = new RegExp(escapeRegex(String(req.query.search)), 'i');filters.$or = [{ number: search }, { reference: search }, { 'party.name': search }, { 'documents.number': search }, { 'documents.reference': search }]; }
  const dates: Record<string, Date> = {};if (req.query.from) dates.$gte = new Date(String(req.query.from) + 'T00:00:00+05:00');if (req.query.to) dates.$lte = new Date(String(req.query.to) + 'T23:59:59.999+05:00');if (Object.values(dates).some(d => !Number.isFinite(+d))) throw new BadRequestError('Enter a valid date range.');if (Object.keys(dates).length) filters.date = dates;
  pipelines.push({ $match: filters }, { $sort: { date: -1, _id: -1 } });
  if (req.query.format) { const format = z.enum(['csv', 'xlsx']).parse(req.query.format);const rows = await BusinessDocument.aggregate(pipelines);await sendTable(res, format, 'Transactions', ['Party', 'Date', 'Reference', 'Document', 'Direction', 'Status', 'Total', 'Paid / linked', 'Bill balance'], rows.map(row => [row.party?.name, row.date, row.reference, row.number, row.side, row.status, row.total, row.unknown ? 'Not recorded' : row.side === 'MONEY' ? null : row.paid, row.unknown ? 'Not recorded' : row.outstanding]));return; }
  pipelines.push({ $facet: { items: [{ $skip: skip }, { $limit: limit }], count: [{ $count: 'total' }] } });const [result] = await BusinessDocument.aggregate(pipelines);res.json({ success: true, data: formatPaginatedResult(result.items, result.count[0]?.total || 0, page, limit) });
}));
