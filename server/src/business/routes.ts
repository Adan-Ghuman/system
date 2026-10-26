import { Router } from 'express';
import { Types } from 'mongoose';
import { authenticate } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
import { Business } from './Business.js';
import { businessContext } from './context.js';
import { prepareExistingIndexes } from './existing-records.js';
import { canAccessBusiness } from './access.js';
import { ensureSiblingUnit } from './unit-setup.js';
import { Party } from '../models/Party.js';
import { ownPartyName } from './ownership.js';

async function loadOwnPartyIds() {
  const context = businessContext.getStore();
  if (context?.usesExistingRecords) context.ownPartyIds = (await Party.find({ name: ownPartyName }).select('_id')).map(party => String(party._id));
}

export const businessRoutes = Router();
businessRoutes.use(authenticate);
businessRoutes.get('/', asyncHandler(async (req, res) => {
  await Business.updateOne({ code: 'ROZAIN' }, { $setOnInsert: { code: 'ROZAIN', name: 'Rozain Textile' } }, { upsert: true });
  const filter = req.user?.role === 'admin' ? {} : { $or: [{ _id: { $in: req.user?.businessIds || [] } }, ...(req.user?.$isDefault('businessIds') ? [{ code: 'ROZAIN' }] : [])] };
  res.json({ success: true, data: await Business.find({ ...filter, isActive: true }).sort({ code: 1 }) });
}));

export const businessScope = Router({ mergeParams: true });
businessScope.use(authenticate, asyncHandler(async (req, _res, next) => {
  const id = String(req.params.businessId);
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Business not found.');
  const business = await Business.findOne({ _id: id, isActive: true });
  if (!business) throw new NotFoundError('Business not found.');
  if (!canAccessBusiness(req.user!, business)) throw new ForbiddenError('You do not have access to this business.');
  if (business.code === 'ROZAIN') await prepareExistingIndexes();
  await businessContext.run({ businessId: id, actorId: String(req.user!._id), name: business.name, usesExistingRecords: business.code === 'ROZAIN' }, async () => { if (business.code === 'ROZAIN') await ensureSiblingUnit();await loadOwnPartyIds();next(); });
}));

export const defaultBusinessScope = Router();
defaultBusinessScope.use(authenticate, asyncHandler(async (req, _res, next) => {
  const business = await Business.findOneAndUpdate({ code: 'ROZAIN' }, { $setOnInsert: { code: 'ROZAIN', name: 'Rozain Textile' } }, { upsert: true, new: true });
  const id = String(business!._id);
  if (!business!.isActive || !canAccessBusiness(req.user!, business!)) throw new ForbiddenError('You do not have access to Rozain Textile.');
  await prepareExistingIndexes();
  await businessContext.run({ businessId: id, actorId: String(req.user!._id), name: business!.name, usesExistingRecords: true }, async () => { await ensureSiblingUnit();await loadOwnPartyIds();next(); });
}));
