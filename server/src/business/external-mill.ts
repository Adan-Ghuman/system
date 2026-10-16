import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { DyeingUnit } from '../models/DyeingUnit.js';
import { Party } from '../models/Party.js';
import { BusinessDocument } from './commerce.models.js';
import { operationInput, itemInput } from './commerce.schema.js';
import { documentReferenceFields } from './references.js';
import { submitOperation } from './commerce.js';
import { requirePermission } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../utils/errors.js';
import { parsePagination, formatPaginatedResult } from '../utils/pagination.js';
import { escapeRegex } from '../utils/search.js';

const input = z.object({ ...documentReferenceFields, millName: z.string().trim().min(1), customMillName: z.string().trim().max(120).optional(), reference: z.string().trim().min(1).max(150), date: z.string().datetime(), location: z.string().default('ZR_GODOWN'), remarks: z.string().max(1000).default(''), items: z.array(itemInput.extend({ fabricType: z.string().trim().min(1).max(150), yarnSpec: z.string().trim().min(1).max(150), color: z.string().trim().min(1).max(120), rolls: z.number().int().positive(), weightKg: z.number().positive() })).min(1).max(100) });
export const externalMillRoutes = Router();
externalMillRoutes.get('/', requirePermission('dyeing:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);const match = { receiptOrigin: 'EXTERNAL_MILL', ...(req.query.search ? { reference: new RegExp(escapeRegex(String(req.query.search)), 'i') } : {}) };
  const [items, total] = await Promise.all([BusinessDocument.find(match).populate('partyId', 'name').sort({ date: -1, _id: -1 }).skip(skip).limit(limit), BusinessDocument.countDocuments(match)]);res.json({ success: true, data: formatPaginatedResult(items, total, page, limit) });
}));
externalMillRoutes.post('/', requirePermission('dyeing:write'), asyncHandler(async (req, res) => {
  const values = input.parse(req.body);
  let mill = values.millName === 'OTHER' ? null : await DyeingUnit.findOne({ code: values.millName, type: 'DYEING_MILL', isActive: true });
  if (values.millName === 'OTHER') {
    const name = values.customMillName?.trim();if (!name) throw new BadRequestError('Enter the sending mill name.');
    const code = 'MILL-' + createHash('sha256').update(name.toLowerCase()).digest('hex').slice(0, 12).toUpperCase();
    mill = await DyeingUnit.findOneAndUpdate({ code }, { $setOnInsert: { code, name, shortName: name, type: 'DYEING_MILL', isActive: true } }, { upsert: true, new: true });
  }
  if (!mill || !mill.isActive) throw new BadRequestError('Choose an active dyeing mill.');
  let party = mill.partyId ? await Party.findById(mill.partyId) : null;
  if (!party) { party = await Party.findOneAndUpdate({ code: 'MILL-' + mill.code }, { $setOnInsert: { code: 'MILL-' + mill.code, name: mill.name, tags: { isDyeingMill: true }, openingBalance: 0, currentBalance: 0, isActive: true } }, { upsert: true, new: true });mill.partyId = party!._id;await mill.save(); }
  const document = await submitOperation(operationInput.parse({ ...values, kind: 'FABRIC_RECEIPT', receiptOrigin: 'EXTERNAL_MILL', partyId: String(party!._id), items: values.items.map(item => ({ ...item, state: 'FINISHED_DYED', rate: 0 })), remarks: `Mill outgoing gate pass ${values.reference}${values.remarks ? ': ' + values.remarks : ''}` }));
  res.status(201).json({ success: true, data: document });
}));
