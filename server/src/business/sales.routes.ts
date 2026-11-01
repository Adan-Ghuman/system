import { Router, Request } from 'express';
import { PipelineStage, Types } from 'mongoose';
import { z } from 'zod';
import { requirePermission } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { parsePagination, formatPaginatedResult } from '../utils/pagination.js';
import { escapeRegex } from '../utils/search.js';
import { sendTable } from './export.js';
import { BusinessDocument, BillPayment, BillAllocation } from './commerce.models.js';
import { PaymentVoucher } from '../models/PaymentVoucher.js';
import { Dispatch } from '../models/Dispatch.js';
import { Party } from '../models/Party.js';
import { businessRecordFilter, businessContext } from './context.js';
import { postCommand } from './posting.js';
import { customerSources, quoteSale, postSale, assignSource } from './sales.js';
import { saleInput, sourceAssignmentInput } from './sales.schema.js';

export const salesRoutes = Router();
salesRoutes.use(requirePermission('accounts:read'));
const canPost = (req: Request, mode: string, billNow: boolean) => {
  const permissions = [...(mode === 'FABRIC' ? ['dispatch:write'] : []), ...(billNow ? ['accounts:write'] : [])];
  if (req.user?.role !== 'admin' && !permissions.every(p => req.user?.permissions.includes(p))) throw new ForbiddenError('Your account needs permission for every delivery, bill and receipt in this entry.');
};
salesRoutes.get('/sources', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await customerSources(String(req.query.kind), String(req.query.customerId)) });
}));
salesRoutes.get('/receipts', asyncHandler(async (req, res) => {
  if (!Types.ObjectId.isValid(String(req.query.customerId))) throw new BadRequestError('Choose a customer.');
  const linked = await BillPayment.find({ status: 'POSTED' }).select('voucherId');
  const items = await PaymentVoucher.find({ partyId: String(req.query.customerId), voucherType: 'RECEIPT', status: { $ne: 'REVERSED' }, _id: { $nin: linked.map(r => r.voucherId) } }).select('voucherNo amount date paymentMode').sort({ date: -1 });
  res.json({ success: true, data: items });
}));
salesRoutes.post('/assign-source', requirePermission('accounts:write'), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await assignSource(sourceAssignmentInput.parse(req.body)) });
}));
salesRoutes.post('/quote', asyncHandler(async (req, res) => {
  const input = saleInput.parse(req.body);canPost(req, input.mode, input.billNow);res.json({ success: true, data: await quoteSale(input) });
}));
salesRoutes.post('/', asyncHandler(async (req, res) => {
  const input = saleInput.parse(req.body);canPost(req, input.mode, input.billNow);res.status(201).json({ success: true, data: await postSale(input) });
}));
salesRoutes.post('/drafts', requirePermission('accounts:write'), asyncHandler(async (req, res) => {
  const body = z.object({ requestId: z.string().uuid(), draftId: z.string().regex(/^[a-f0-9]{24}$/i).optional(), customerId: z.string().default(''), date: z.string().optional(), reference: z.string().trim().max(150).default('') }).passthrough().parse(req.body);
  const result = await postCommand('SAVE_SALES_DRAFT', body, async session => {
    if (body.draftId) {
      const draft = await BusinessDocument.findOneAndUpdate({ _id: body.draftId, status: 'DRAFT', kind: { $in: ['SALES_DRAFT', 'DELIVERY_DRAFT', 'CUSTOMER_BILL', 'KNITTING_CHARGE', 'DYEING_CHARGE'] } }, { $set: { draft: body, reference: body.reference, ...(Types.ObjectId.isValid(body.customerId) ? { partyId: body.customerId } : {}) } }, { new: true, session });
      if (!draft) throw new NotFoundError('This draft is already posted or unavailable.');return draft.toObject();
    }
    const [draft] = await BusinessDocument.create([{ number: 'DRAFT-' + new Types.ObjectId(), kind: 'SALES_DRAFT', direction: 'RECEIVABLE', date: body.date && Number.isFinite(new Date(body.date).valueOf()) ? new Date(body.date) : new Date(), reference: body.reference, ...(Types.ObjectId.isValid(body.customerId) ? { partyId: body.customerId } : {}), actorId: businessContext.getStore()!.actorId, status: 'DRAFT', draft: body }], { session });return draft.toObject();
  });res.status(201).json({ success: true, data: result });
}));
salesRoutes.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const scope = businessRecordFilter();
  const active = { $eq: [{ $ifNull: ['$status', 'POSTED'] }, 'POSTED'] };
  const pipeline: PipelineStage[] = [
    { $match: { $or: [{ kind: { $in: ['CUSTOMER_BILL', 'KNITTING_CHARGE', 'DYEING_CHARGE'] }, direction: 'RECEIVABLE' }, { status: 'DRAFT', kind: { $in: ['CUSTOMER_BILL', 'SALES_DRAFT', 'DELIVERY_DRAFT'] } }, { status: 'DRAFT', kind: { $in: ['KNITTING_CHARGE', 'DYEING_CHARGE'] }, 'draft.direction': 'RECEIVABLE' }] } },
    { $sort: { date: 1, _id: 1 } },
    { $group: { _id: { $cond: [{ $and: [{ $eq: ['$kind', 'CUSTOMER_BILL'] }, { $ne: ['$status', 'DRAFT'] }, { $ifNull: ['$sourceId', false] }] }, '$sourceId', '$_id'] }, partyId: { $last: '$partyId' }, date: { $max: '$date' }, reference: { $last: '$reference' }, kind: { $last: '$kind' }, number: { $last: '$number' }, statuses: { $addToSet: { $ifNull: ['$status', 'POSTED'] } }, total: { $sum: { $cond: [active, '$total', 0] } }, paid: { $sum: { $cond: [active, '$paid', 0] } }, credited: { $sum: { $cond: [active, '$credited', 0] } }, unknown: { $max: { $cond: [{ $and: [active, { $eq: ['$settlementStatus', 'NOT_RECORDED'] }] }, 1, 0] } }, documents: { $push: { _id: '$_id', number: '$number', kind: '$kind', status: { $ifNull: ['$status', 'POSTED'] } } } } },
    { $lookup: { from: Dispatch.collection.name, localField: '_id', foreignField: '_id', pipeline: [{ $match: scope }], as: 'delivery' } },
    { $set: { deliveryId: { $first: '$delivery._id' }, deliveryNo: { $first: '$delivery.ogpNo' }, deliveryStatus: { $first: '$delivery.status' }, status: { $cond: [{ $in: ['DRAFT', '$statuses'] }, 'DRAFT', { $cond: [{ $in: ['POSTED', '$statuses'] }, 'POSTED', { $cond: [{ $eq: [{ $first: '$delivery.status' }, 'POSTED'] }, 'TO_BILL', 'REVERSED'] }] }] } } },
    { $project: { delivery: 0, statuses: 0 } },
    { $unionWith: { coll: Dispatch.collection.name, pipeline: [
      { $match: { ...scope, purpose: { $ne: 'CLIENT_RETURN' } } },
      { $lookup: { from: BusinessDocument.collection.name, localField: '_id', foreignField: 'sourceId', pipeline: [{ $match: { ...scope, kind: 'CUSTOMER_BILL' } }], as: 'bills' } },
      { $match: { 'bills.0': { $exists: false } } },
      { $project: { partyId: '$customerId', date: 1, reference: '$ogpNo', number: '$dispatchNo', kind: { $literal: 'DELIVERY' }, total: { $literal: 0 }, paid: { $literal: 0 }, credited: { $literal: 0 }, unknown: { $literal: 0 }, documents: { $literal: [] }, deliveryId: '$_id', deliveryNo: '$ogpNo', deliveryStatus: { $ifNull: ['$status', 'POSTED'] }, status: { $cond: [{ $eq: ['$status', 'REVERSED'] }, 'REVERSED', 'TO_BILL'] } } }
    ] } },
    { $lookup: { from: Party.collection.name, localField: 'partyId', foreignField: '_id', pipeline: [{ $match: scope }, { $project: { name: 1, code: 1 } }], as: 'customer' } },
    { $lookup: { from: BillAllocation.collection.name, localField: '_id', foreignField: 'sourceId', pipeline: [{ $match: { ...scope, direction: 'RECEIVABLE' } }], as: 'billingAllocations' } },
    { $set: { customer: { $first: '$customer' }, canBill: { $and: [{ $ifNull: ['$deliveryId', false] }, { $ne: ['$deliveryStatus', 'REVERSED'] }, { $lt: [{ $sum: '$billingAllocations.fraction' }, 0.9999999] }] }, paid: { $cond: ['$unknown', null, '$paid'] }, outstanding: { $cond: ['$unknown', null, { $round: [{ $subtract: [{ $subtract: ['$total', '$credited'] }, '$paid'] }, 2] }] } } },
    { $project: { billingAllocations: 0 } }
  ];
  const filters: Record<string, unknown> = {};
  if (req.query.customerId) { if (!Types.ObjectId.isValid(String(req.query.customerId))) throw new BadRequestError('Choose a customer.');filters.partyId = new Types.ObjectId(String(req.query.customerId)); }
  const dates: Record<string, Date> = {};
  if (req.query.from) dates.$gte = new Date(String(req.query.from) + 'T00:00:00+05:00');
  if (req.query.to) dates.$lte = new Date(String(req.query.to) + 'T23:59:59.999+05:00');
  if (Object.values(dates).some(date => !Number.isFinite(+date)) || (dates.$gte && dates.$lte && dates.$gte > dates.$lte)) throw new BadRequestError('Choose a valid date range.');
  if (Object.keys(dates).length) filters.date = dates;
  if (req.query.search) { const search = new RegExp(escapeRegex(String(req.query.search)), 'i');filters.$or = [{ number: search }, { reference: search }, { deliveryNo: search }, { 'customer.name': search }, { 'documents.number': search }]; }
  if (req.query.status === 'UNPAID') { filters.status = 'POSTED';filters.outstanding = { $gt: 0 }; }
  else if (req.query.status === 'PAID') { filters.status = 'POSTED';filters.outstanding = 0;filters.total = { $gt: 0 }; }
  else if (req.query.status === 'UNKNOWN') filters.unknown = 1;
  else if (['DRAFT', 'TO_BILL', 'REVERSED'].includes(String(req.query.status))) filters.status = String(req.query.status);
  pipeline.push({ $match: filters }, { $sort: { date: -1, _id: -1 } });
  if (req.query.format) {
    z.enum(['csv', 'xlsx']).parse(req.query.format);
    const rows = await BusinessDocument.aggregate(pipeline);
    await sendTable(res, String(req.query.format), 'Sales and billing', ['Customer', 'Date', 'Document', 'Type', 'Paper reference', 'Gate pass', 'Status', 'Bill total', 'Paid / linked', 'Outstanding'], rows.map(row => [row.customer?.name, row.date, row.number, row.kind, row.reference, row.deliveryNo, row.status, row.total, row.unknown ? 'Not recorded' : row.paid, row.unknown ? 'Not recorded' : row.status === 'TO_BILL' ? 'Not billed' : row.outstanding]));return;
  }
  pipeline.push({ $facet: { items: [{ $skip: skip }, { $limit: limit }], count: [{ $count: 'total' }] } });
  const [result] = await BusinessDocument.aggregate(pipeline);
  res.json({ success: true, data: formatPaginatedResult(result.items, result.count[0]?.total || 0, page, limit) });
}));
