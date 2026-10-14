import { PipelineStage, Types } from 'mongoose';
import { KnittingReceipt, DyeingReceipt } from './records.js';
import { DyeingBatch } from '../models/DyeingBatch.js';
import { YarnTransaction } from '../models/YarnTransaction.js';
import { Dispatch } from '../models/Dispatch.js';
import { BusinessDocument } from './commerce.models.js';
import { businessObjectId } from './context.js';
import { escapeRegex } from '../utils/search.js';

export interface RegisterRow { _id: string; date: Date; number: string; partyId: string; fabricType: string; yarnSpec: string; color: string; rolls: number; weightKg: number; poNo: string; externalReference: string; source: string; }
export function registerPipeline(type: string, filter: { from?: string; to?: string; partyId?: string; search?: string; millName?: string }) {
  const union = (collection: string, pipeline: PipelineStage.UnionWithPipelineStage[]): PipelineStage => ({ $unionWith: { coll: collection, pipeline: [{ $match: { businessId: businessObjectId() } }, ...pipeline] } });
  const fields = { date: 1, poNo: 1, externalReference: 1 };
  const pipeline: PipelineStage[] = [{ $match: type === 'IGP' ? { status: 'POSTED' } : { _id: { $exists: false } } }, { $unwind: '$items' }, { $project: { ...fields, number: '$gatePassNo', partyId: 1, fabricType: '$items.fabricType', yarnSpec: '$items.yarnSpec', color: { $literal: 'ECRU' }, rolls: '$items.rollsCount', weightKg: '$items.weightKg', source: { $literal: 'Knitting receipt' } } }];
  if (type === 'IGP') {
    pipeline.push(union(DyeingReceipt.collection.name, [{ $match: { status: 'POSTED' } }, { $unwind: '$items' }, { $lookup: { from: DyeingBatch.collection.name, localField: 'items.batchId', foreignField: '_id', as: 'batch' } }, { $project: { ...fields, millName: { $arrayElemAt: ['$batch.millName', 0] }, number: '$gatePassNo', partyId: 1, fabricType: '$items.fabricType', yarnSpec: '$items.yarnSpec', color: '$items.color', rolls: '$items.rolls', weightKg: '$items.weightKg', source: { $literal: 'Dyeing receipt' } } }]));
    pipeline.push(union(BusinessDocument.collection.name, [{ $match: { status: 'POSTED', kind: { $in: ['FABRIC_RECEIPT', 'FABRIC_PURCHASE'] } } }, { $unwind: '$items' }, { $project: { ...fields, number: '$reference', partyId: 1, fabricType: '$items.fabricType', yarnSpec: '$items.yarnSpec', color: '$items.color', rolls: '$items.rolls', weightKg: '$items.weightKg', source: { $literal: 'Fabric purchased / received' } } }]));
  } else {
    pipeline.push(union(DyeingBatch.collection.name, [{ $match: { status: { $ne: 'REVERSED' } } }, { $project: { date: '$dateIssued', poNo: 1, externalReference: 1, millName: 1, number: '$ogpNo', partyId: '$millPartyId', fabricType: 1, yarnSpec: 1, color: '$targetColor', rolls: '$ecruRollsCount', weightKg: '$ecruWeightKg', source: { $literal: 'Sent for dyeing' } } }]));
    pipeline.push(union(Dispatch.collection.name, [{ $match: { status: 'POSTED' } }, { $project: { ...fields, number: '$ogpNo', partyId: '$customerId', fabricType: 1, yarnSpec: 1, color: 1, rolls: '$totalRolls', weightKg: '$totalNetWeightKg', source: { $literal: 'Customer delivery' } } }]));
    pipeline.push(union(BusinessDocument.collection.name, [{ $match: { status: 'POSTED', kind: 'INTERCOMPANY_SALE' } }, { $unwind: '$items' }, { $project: { ...fields, number: 1, partyId: 1, fabricType: '$items.fabricType', yarnSpec: '$items.yarnSpec', color: '$items.color', rolls: '$items.rolls', weightKg: '$items.weightKg', source: { $literal: 'Inter-company sale' } } }]));
  }
  pipeline.push(union(YarnTransaction.collection.name, [{ $match: { transactionType: type === 'IGP' ? 'INWARD_FROM_CLIENT' : 'OUTWARD_TO_KNITTER', status: { $ne: 'REVERSED' } } }, { $project: { ...fields, number: '$gatePassNo', partyId: 1, yarnSpec: 1, fabricType: { $literal: 'Yarn' }, color: { $literal: '' }, rolls: '$boxCount', weightKg: '$grossWeightKg', source: { $literal: 'Yarn packages' } } }]));
  const match: Record<string, unknown> = {};
  if (filter.partyId && Types.ObjectId.isValid(filter.partyId)) match.partyId = new Types.ObjectId(filter.partyId);
  if (filter.millName && filter.millName !== 'ALL') match.millName = filter.millName;
  if (filter.from || filter.to) match.date = { ...(filter.from ? { $gte: new Date(filter.from + 'T00:00:00+05:00') } : {}), ...(filter.to ? { $lte: new Date(filter.to + 'T23:59:59.999+05:00') } : {}) };
  if (filter.search) match.$or = ['number', 'fabricType', 'yarnSpec', 'color', 'poNo', 'externalReference'].map(field => ({ [field]: new RegExp(escapeRegex(filter.search!), 'i') }));
  pipeline.push({ $match: match }, { $sort: { date: -1, _id: -1, fabricType: 1 } });
  return pipeline;
}
