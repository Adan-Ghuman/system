import { Router } from 'express';
import { z } from 'zod';
import { CatalogChoice } from './records.js';
import { YarnSpecification } from '../models/YarnSpecification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
import { parsePagination, formatPaginatedResult } from '../utils/pagination.js';
import { escapeRegex } from '../utils/search.js';

const input = z.object({ name: z.string().trim().min(1).max(120), code: z.string().trim().max(60).optional(), notes: z.string().trim().max(500).optional() });
const kind = z.enum(['FABRIC', 'COLOR', 'YARN']);
export const catalogRoutes = Router();
catalogRoutes.get('/:kind', asyncHandler(async (req, res) => {
  const type = kind.parse(String(req.params.kind));
  const { page, limit, skip } = parsePagination(req.query, 20);
  const match = { ...(type !== 'YARN' ? { kind: type } : {}), ...(req.query.search ? { name: new RegExp(escapeRegex(String(req.query.search)), 'i') } : {}), ...(req.query.archived === 'true' ? {} : { isActive: true }) };
  const [items, total] = type === 'YARN' ? await Promise.all([YarnSpecification.find(match).sort({ name: 1, _id: 1 }).skip(skip).limit(limit), YarnSpecification.countDocuments(match)]) : await Promise.all([CatalogChoice.find(match).sort({ name: 1, _id: 1 }).skip(skip).limit(limit), CatalogChoice.countDocuments(match)]);
  res.json({ success: true, data: formatPaginatedResult<unknown>(items, total, page, limit) });
}));
catalogRoutes.use((req, _res, next) => { if (req.user?.role !== 'admin' && !req.user?.permissions.some(value => ['knitting:write', 'dyeing:write', 'inventory:write'].includes(value))) throw new ForbiddenError('You do not have permission to change this list.'); next(); });
catalogRoutes.post('/:kind', asyncHandler(async (req, res) => {
  const type = kind.parse(String(req.params.kind)); const values = input.parse(req.body);
  const match = { ...(type !== 'YARN' ? { kind: type } : {}), name: new RegExp('^' + escapeRegex(values.name) + '$', 'i') };
  const existing = type === 'YARN' ? await YarnSpecification.findOne(match) : await CatalogChoice.findOne(match);
  if (existing) { res.json({ success: true, data: existing }); return; }
  const value = type === 'YARN' ? await YarnSpecification.create({ name: values.name, category: 'Other', description: values.notes, isActive: true, sortOrder: 0 }) : await CatalogChoice.create({ ...values, kind: type, normalized: values.name.toLocaleLowerCase(), isActive: true });
  res.status(201).json({ success: true, data: value });
}));
catalogRoutes.patch('/:kind/:id', asyncHandler(async (req, res) => {
  const type = kind.parse(String(req.params.kind)); const values = z.object({ isActive: z.boolean() }).parse(req.body);
  const match = { _id: req.params.id, ...(type !== 'YARN' ? { kind: type } : {}) };
  const value = type === 'YARN' ? await YarnSpecification.findOneAndUpdate(match, { $set: values }, { new: true }) : await CatalogChoice.findOneAndUpdate(match, { $set: values }, { new: true });
  if (!value) throw new NotFoundError('Choice not found.');
  res.json({ success: true, data: value });
}));
