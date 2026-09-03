import mongoose, { Types } from 'mongoose';
import { DyeingBatch, IDyeingBatch } from '../../models/DyeingBatch.js';
import { FabricInventory } from '../../models/FabricInventory.js';
import { Party } from '../../models/Party.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';
import { parsePagination, formatPaginatedResult } from '../../utils/pagination.js';
import { CreateBatchInput, SettleBatchInput, QueryBatchesInput } from './dyeing.schema.js';

export function calculateBatchSettlement(ecruWeightKg: number, finishWeightKg: number) {
  const shortageWeightKg = Math.round((ecruWeightKg - finishWeightKg) * 100) / 100;
  const shortagePercent = ecruWeightKg > 0
    ? Math.round(((shortageWeightKg / ecruWeightKg) * 100) * 100) / 100
    : 0;
  const isShrinkageAlert = shortagePercent > 5.0;

  return {
    shortageWeightKg,
    shortagePercent,
    isShrinkageAlert
  };
}

export async function generateNextBatchNo(): Promise<string> {
  const lastBatch = await DyeingBatch.findOne({ batchNo: /^BATCH-\d+$/ }).sort({ batchNo: -1 });
  if (!lastBatch) {
    return 'BATCH-001';
  }

  const match = lastBatch.batchNo.match(/^BATCH-(\d+)$/);
  if (!match) {
    return 'BATCH-001';
  }

  const nextNumber = parseInt(match[1], 10) + 1;
  return `BATCH-${nextNumber.toString().padStart(3, '0')}`;
}

export async function createDyeingBatch(input: CreateBatchInput): Promise<IDyeingBatch> {
  let batchNo = input.batchNo;
  if (!batchNo) {
    batchNo = await generateNextBatchNo();
  }

  let millPartyId = input.millPartyId ? new Types.ObjectId(input.millPartyId) : undefined;
  if (!millPartyId) {
    const defaultParty = await Party.findOne({
      code: input.millName === 'GHUMMAN_DYEING' ? 'PRT-001' : input.millName === 'RAJPUT_DYEING' ? 'PRT-002' : undefined
    });
    if (defaultParty) {
      millPartyId = defaultParty._id as Types.ObjectId;
    }
  }

  const batch = await DyeingBatch.create({
    batchNo,
    millName: input.millName,
    millPartyId,
    fabricType: input.fabricType,
    yarnSpec: input.yarnSpec,
    targetColor: input.targetColor.toUpperCase(),
    ogpNo: input.ogpNo || '',
    igpNo: input.igpNo || '',
    dateIssued: new Date(input.dateIssued),
    ecruRollsCount: input.ecruRollsCount,
    ecruWeightKg: input.ecruWeightKg,
    allocatedCustomerId: input.allocatedCustomerId ? new Types.ObjectId(input.allocatedCustomerId) : undefined,
    status: 'ISSUED',
    remarks: input.remarks || ''
  });

  return batch;
}

export async function settleDyeingBatch(id: string, input: SettleBatchInput): Promise<IDyeingBatch> {
  const batch = await DyeingBatch.findById(id);
  if (!batch) {
    throw new NotFoundError('Dyeing batch not found');
  }

  if (batch.status === 'COMPLETED') {
    throw new BadRequestError('Batch is already marked as completed');
  }

  const { shortageWeightKg, shortagePercent } = calculateBatchSettlement(
    batch.ecruWeightKg,
    input.finishWeightKg
  );

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    batch.finishRollsCount = input.finishRollsCount;
    batch.finishWeightKg = input.finishWeightKg;
    batch.shortageWeightKg = shortageWeightKg;
    batch.shortagePercent = shortagePercent;
    batch.dateReceived = new Date(input.dateReceived);
    batch.status = 'COMPLETED';
    if (input.igpNo) batch.igpNo = input.igpNo;
    if (input.remarks) batch.remarks = input.remarks;

    await batch.save({ session });

    const location = batch.millName === 'GHUMMAN_DYEING'
      ? 'GHUMMAN_DYEING'
      : batch.millName === 'RAJPUT_DYEING'
      ? 'RAJPUT_DYEING'
      : 'ZR_GODOWN';

    await FabricInventory.findOneAndUpdate(
      {
        fabricType: batch.fabricType,
        yarnSpec: batch.yarnSpec,
        state: 'FINISHED_DYED',
        color: batch.targetColor,
        location
      },
      {
        $inc: {
          totalRolls: input.finishRollsCount,
          totalWeightKg: input.finishWeightKg
        },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, session }
    );

    await session.commitTransaction();
    return batch;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function listDyeingBatches(query: QueryBatchesInput) {
  const { page, limit, skip } = parsePagination(query, 20);
  const filter: Record<string, unknown> = {};

  if (query.millName) {
    filter.millName = query.millName;
  }
  if (query.status) {
    filter.status = query.status;
  }
  if (query.fabricType) {
    filter.fabricType = query.fabricType;
  }
  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { batchNo: searchRegex },
      { targetColor: searchRegex },
      { fabricType: searchRegex },
      { yarnSpec: searchRegex },
      { ogpNo: searchRegex },
      { igpNo: searchRegex }
    ];
  }

  const [items, total] = await Promise.all([
    DyeingBatch.find(filter)
      .populate('millPartyId', 'code name phone')
      .populate('allocatedCustomerId', 'code name')
      .sort({ dateIssued: -1 })
      .skip(skip)
      .limit(limit),
    DyeingBatch.countDocuments(filter)
  ]);

  return formatPaginatedResult(items, total, page, limit);
}

export async function getDyeingMetrics() {
  const [activeStats, completedStats] = await Promise.all([
    DyeingBatch.aggregate([
      { $match: { status: { $in: ['ISSUED', 'IN_PROCESS'] } } },
      {
        $group: {
          _id: '$millName',
          count: { $sum: 1 },
          totalEcruKg: { $sum: '$ecruWeightKg' },
          totalEcruRolls: { $sum: '$ecruRollsCount' }
        }
      }
    ]),
    DyeingBatch.aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $group: {
          _id: '$millName',
          count: { $sum: 1 },
          totalEcruKg: { $sum: '$ecruWeightKg' },
          totalFinishKg: { $sum: '$finishWeightKg' },
          totalLossKg: { $sum: '$shortageWeightKg' },
          avgShrinkagePercent: { $avg: '$shortagePercent' }
        }
      }
    ])
  ]);

  return { activeStats, completedStats };
}
