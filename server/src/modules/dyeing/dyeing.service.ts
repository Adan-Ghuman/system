import mongoose, { Types } from 'mongoose';
import { DyeingBatch, IDyeingBatch } from '../../models/DyeingBatch.js';
import { DyeingUnit, IDyeingUnit, DEFAULT_DYEING_UNITS } from '../../models/DyeingUnit.js';
import { FabricInventory } from '../../models/FabricInventory.js';
import { Party } from '../../models/Party.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';
import { parsePagination, formatPaginatedResult } from '../../utils/pagination.js';
import {
  CreateBatchInput,
  UpdateBatchInput,
  SettleBatchInput,
  QueryBatchesInput,
  CreateDyeingUnitInput,
  UpdateDyeingUnitInput
} from './dyeing.schema.js';

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

  const yarnSpecs = input.yarnSpecs && input.yarnSpecs.length > 0
    ? input.yarnSpecs
    : (input.yarnSpec ? [input.yarnSpec] : []);
  const yarnSpec = input.yarnSpec || (yarnSpecs.length > 0 ? yarnSpecs.join(' + ') : '');

  const batch = await DyeingBatch.create({
    batchNo,
    millName: input.millName,
    millPartyId,
    customMillName: input.customMillName || '',
    fabricType: input.fabricType,
    yarnSpec,
    yarnSpecs,
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
      : batch.millName === 'HAFIZ_SAAD_DYEING'
      ? 'HAFIZ_SAAD_DYEING'
      : batch.millName === 'HB_DYEING'
      ? 'HB_DYEING'
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
    if (query.status === 'ACTIVE') {
      filter.status = { $in: ['ISSUED', 'IN_PROCESS'] };
    } else {
      filter.status = query.status;
    }
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
      { customMillName: searchRegex },
      { ogpNo: searchRegex },
      { igpNo: searchRegex }
    ];
  }

  const sortDirection = query.sortOrder === 'asc' ? 1 : -1;

  const [items, total] = await Promise.all([
    DyeingBatch.find(filter)
      .populate('millPartyId', 'code name phone')
      .populate('allocatedCustomerId', 'code name')
      .sort({ dateIssued: sortDirection, createdAt: sortDirection })
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

export function getBatchLocation(millName: string): string {
  if (millName === 'GHUMMAN_DYEING') return 'GHUMMAN_DYEING';
  if (millName === 'RAJPUT_DYEING') return 'RAJPUT_DYEING';
  if (millName === 'HAFIZ_SAAD_DYEING') return 'HAFIZ_SAAD_DYEING';
  if (millName === 'HB_DYEING') return 'HB_DYEING';
  return 'ZR_GODOWN';
}

export async function updateDyeingBatch(id: string, input: UpdateBatchInput): Promise<IDyeingBatch> {
  const batch = await DyeingBatch.findById(id);
  if (!batch) {
    throw new NotFoundError('Dyeing batch not found');
  }

  const isCompleted = batch.status === 'COMPLETED';

  if (isCompleted) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const oldLocation = getBatchLocation(batch.millName);
      const oldFabricType = batch.fabricType;
      const oldYarnSpec = batch.yarnSpec;
      const oldColor = batch.targetColor;
      const oldFinishRolls = batch.finishRollsCount || 0;
      const oldFinishWeight = batch.finishWeightKg || 0;

      const newMillName = input.millName ?? batch.millName;
      const newLocation = getBatchLocation(newMillName);
      const newFabricType = input.fabricType ?? batch.fabricType;
      const newYarnSpecs = input.yarnSpecs !== undefined
        ? input.yarnSpecs
        : (input.yarnSpec ? [input.yarnSpec] : (batch.yarnSpecs || []));
      const newYarnSpec = input.yarnSpec ?? (newYarnSpecs && newYarnSpecs.length > 0 ? newYarnSpecs.join(' + ') : batch.yarnSpec);
      const newCustomMillName = input.customMillName !== undefined ? input.customMillName : (batch.customMillName || '');
      const newColor = input.targetColor ? input.targetColor.toUpperCase() : batch.targetColor;
      const newEcruRolls = input.ecruRollsCount ?? batch.ecruRollsCount;
      const newEcruWeight = input.ecruWeightKg ?? batch.ecruWeightKg;
      const newFinishRolls = input.finishRollsCount !== undefined ? input.finishRollsCount : oldFinishRolls;
      const newFinishWeight = input.finishWeightKg !== undefined ? input.finishWeightKg : oldFinishWeight;

      if (oldFinishRolls > 0 || oldFinishWeight > 0) {
        await FabricInventory.findOneAndUpdate(
          {
            fabricType: oldFabricType,
            yarnSpec: oldYarnSpec,
            state: 'FINISHED_DYED',
            color: oldColor,
            location: oldLocation
          },
          {
            $inc: {
              totalRolls: -oldFinishRolls,
              totalWeightKg: -oldFinishWeight
            },
            $set: { updatedAt: new Date() }
          },
          { session }
        );
      }

      if (newFinishRolls > 0 || newFinishWeight > 0) {
        await FabricInventory.findOneAndUpdate(
          {
            fabricType: newFabricType,
            yarnSpec: newYarnSpec,
            state: 'FINISHED_DYED',
            color: newColor,
            location: newLocation
          },
          {
            $inc: {
              totalRolls: newFinishRolls,
              totalWeightKg: newFinishWeight
            },
            $set: { updatedAt: new Date() }
          },
          { upsert: true, session }
        );
      }

      const { shortageWeightKg, shortagePercent } = calculateBatchSettlement(newEcruWeight, newFinishWeight);

      if (input.batchNo) batch.batchNo = input.batchNo;
      batch.millName = newMillName;
      batch.customMillName = newCustomMillName;
      batch.fabricType = newFabricType;
      batch.yarnSpec = newYarnSpec;
      batch.yarnSpecs = newYarnSpecs;
      batch.targetColor = newColor;
      batch.ecruRollsCount = newEcruRolls;
      batch.ecruWeightKg = newEcruWeight;
      batch.finishRollsCount = newFinishRolls;
      batch.finishWeightKg = newFinishWeight;
      batch.shortageWeightKg = shortageWeightKg;
      batch.shortagePercent = shortagePercent;

      if (input.ogpNo !== undefined) batch.ogpNo = input.ogpNo;
      if (input.igpNo !== undefined) batch.igpNo = input.igpNo;
      if (input.dateIssued) batch.dateIssued = new Date(input.dateIssued);
      if (input.allocatedCustomerId !== undefined) {
        batch.allocatedCustomerId = input.allocatedCustomerId ? new Types.ObjectId(input.allocatedCustomerId) : undefined;
      }
      if (input.remarks !== undefined) batch.remarks = input.remarks;

      await batch.save({ session });
      await session.commitTransaction();

      await batch.populate('millPartyId', 'code name phone');
      await batch.populate('allocatedCustomerId', 'code name');
      return batch;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } else {
    if (input.batchNo) batch.batchNo = input.batchNo;
    if (input.millName) batch.millName = input.millName;
    if (input.customMillName !== undefined) batch.customMillName = input.customMillName;
    if (input.millPartyId) batch.millPartyId = new Types.ObjectId(input.millPartyId);
    if (input.fabricType) batch.fabricType = input.fabricType;
    const newYarnSpecs = input.yarnSpecs !== undefined
      ? input.yarnSpecs
      : (input.yarnSpec ? [input.yarnSpec] : (batch.yarnSpecs || []));
    const newYarnSpec = input.yarnSpec ?? (newYarnSpecs && newYarnSpecs.length > 0 ? newYarnSpecs.join(' + ') : batch.yarnSpec);
    batch.yarnSpec = newYarnSpec;
    batch.yarnSpecs = newYarnSpecs;
    if (input.targetColor) batch.targetColor = input.targetColor.toUpperCase();
    if (input.ogpNo !== undefined) batch.ogpNo = input.ogpNo;
    if (input.igpNo !== undefined) batch.igpNo = input.igpNo;
    if (input.dateIssued) batch.dateIssued = new Date(input.dateIssued);
    if (input.ecruRollsCount !== undefined) batch.ecruRollsCount = input.ecruRollsCount;
    if (input.ecruWeightKg !== undefined) batch.ecruWeightKg = input.ecruWeightKg;
    if (input.allocatedCustomerId !== undefined) {
      batch.allocatedCustomerId = input.allocatedCustomerId ? new Types.ObjectId(input.allocatedCustomerId) : undefined;
    }
    if (input.remarks !== undefined) batch.remarks = input.remarks;

    await batch.save();
    await batch.populate('millPartyId', 'code name phone');
    await batch.populate('allocatedCustomerId', 'code name');
    return batch;
  }
}

export async function deleteDyeingBatch(id: string): Promise<void> {
  const batch = await DyeingBatch.findById(id);
  if (!batch) {
    throw new NotFoundError('Dyeing batch not found');
  }

  if (batch.status === 'COMPLETED') {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const location = getBatchLocation(batch.millName);
      const finishRolls = batch.finishRollsCount || 0;
      const finishWeight = batch.finishWeightKg || 0;

      if (finishRolls > 0 || finishWeight > 0) {
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
              totalRolls: -finishRolls,
              totalWeightKg: -finishWeight
            },
            $set: { updatedAt: new Date() }
          },
          { session }
        );
      }

      await DyeingBatch.findByIdAndDelete(id, { session });
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } else {
    await DyeingBatch.findByIdAndDelete(id);
  }
}

export interface DyeingUnitWithMetrics {
  _id: string;
  code: string;
  name: string;
  shortName: string;
  type: string;
  partyId?: string;
  address?: string;
  contactPhone?: string;
  isActive: boolean;
  sortOrder: number;
  isSystemDefault: boolean;
  activeBatchesCount: number;
  totalBatchesCount: number;
  totalEcruWeightKg: number;
  inventoryWeightKg: number;
  inventoryRollsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function ensureDefaultDyeingUnits(): Promise<void> {
  const count = await DyeingUnit.countDocuments();
  if (count === 0) {
    await DyeingUnit.insertMany(DEFAULT_DYEING_UNITS);
  }
}

export async function getDyeingUnitsWithMetrics(): Promise<DyeingUnitWithMetrics[]> {
  await ensureDefaultDyeingUnits();

  const [units, batchMetrics, inventoryMetrics] = await Promise.all([
    DyeingUnit.find().sort({ sortOrder: 1, name: 1 }),
    DyeingBatch.aggregate([
      {
        $group: {
          _id: '$millName',
          totalBatches: { $sum: 1 },
          activeBatches: {
            $sum: { $cond: [{ $in: ['$status', ['ISSUED', 'IN_PROCESS']] }, 1, 0] }
          },
          totalEcruWeightKg: { $sum: '$ecruWeightKg' }
        }
      }
    ]),
    FabricInventory.aggregate([
      {
        $group: {
          _id: '$location',
          totalWeightKg: { $sum: '$totalWeightKg' },
          totalRolls: { $sum: '$totalRolls' }
        }
      }
    ])
  ]);

  const batchMap = new Map(batchMetrics.map((b) => [String(b._id), b]));
  const invMap = new Map(inventoryMetrics.map((i) => [String(i._id), i]));

  return units.map((u) => {
    const b = batchMap.get(u.code);
    const inv = invMap.get(u.code);

    return {
      _id: u._id.toString(),
      code: u.code,
      name: u.name,
      shortName: u.shortName,
      type: u.type,
      partyId: u.partyId?.toString(),
      address: u.address || '',
      contactPhone: u.contactPhone || '',
      isActive: u.isActive,
      sortOrder: u.sortOrder || 0,
      isSystemDefault: u.isSystemDefault || false,
      activeBatchesCount: b?.activeBatches || 0,
      totalBatchesCount: b?.totalBatches || 0,
      totalEcruWeightKg: Math.round((b?.totalEcruWeightKg || 0) * 100) / 100,
      inventoryWeightKg: Math.round((inv?.totalWeightKg || 0) * 100) / 100,
      inventoryRollsCount: inv?.totalRolls || 0,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    };
  });
}

export async function createDyeingUnit(input: CreateDyeingUnitInput): Promise<IDyeingUnit> {
  const existingCode = await DyeingUnit.findOne({ code: input.code.trim().toUpperCase() });
  if (existingCode) {
    throw new BadRequestError(`Unit with code '${input.code}' already exists.`);
  }

  const existingName = await DyeingUnit.findOne({
    name: { $regex: new RegExp(`^${input.name.trim()}$`, 'i') }
  });
  if (existingName) {
    throw new BadRequestError(`Unit with name '${input.name}' already exists.`);
  }

  const unit = await DyeingUnit.create({
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    shortName: input.shortName.trim(),
    type: input.type || 'DYEING_MILL',
    partyId: input.partyId ? new Types.ObjectId(input.partyId) : undefined,
    address: input.address?.trim() || '',
    contactPhone: input.contactPhone?.trim() || '',
    isActive: input.isActive !== undefined ? input.isActive : true,
    sortOrder: input.sortOrder || 0,
    isSystemDefault: false
  });

  return unit;
}

export async function updateDyeingUnit(
  id: string,
  input: UpdateDyeingUnitInput
): Promise<IDyeingUnit> {
  const unit = await DyeingUnit.findById(id);
  if (!unit) {
    throw new NotFoundError('Dyeing unit not found');
  }

  if (input.name && input.name.trim().toLowerCase() !== unit.name.toLowerCase()) {
    const existingOther = await DyeingUnit.findOne({
      _id: { $ne: unit._id },
      name: { $regex: new RegExp(`^${input.name.trim()}$`, 'i') }
    });
    if (existingOther) {
      throw new BadRequestError(`Another unit already uses the name '${input.name}'.`);
    }
    unit.name = input.name.trim();
  }

  if (input.shortName !== undefined) unit.shortName = input.shortName.trim();
  if (input.type !== undefined) unit.type = input.type;
  if (input.partyId !== undefined) {
    unit.partyId = input.partyId ? new Types.ObjectId(input.partyId) : undefined;
  }
  if (input.address !== undefined) unit.address = input.address.trim();
  if (input.contactPhone !== undefined) unit.contactPhone = input.contactPhone.trim();
  if (input.isActive !== undefined) unit.isActive = input.isActive;
  if (input.sortOrder !== undefined) unit.sortOrder = input.sortOrder;

  await unit.save();
  return unit;
}

export async function deleteDyeingUnit(
  id: string
): Promise<{ archived: boolean; message: string }> {
  const unit = await DyeingUnit.findById(id);
  if (!unit) {
    throw new NotFoundError('Dyeing unit not found');
  }

  if (unit.isSystemDefault) {
    unit.isActive = false;
    await unit.save();
    return {
      archived: true,
      message: `System unit '${unit.name}' cannot be permanently deleted. It has been deactivated/archived from future selectors.`
    };
  }

  const [inUseBatches, inUseInventory] = await Promise.all([
    DyeingBatch.countDocuments({ millName: unit.code }),
    FabricInventory.countDocuments({ location: unit.code })
  ]);

  if (inUseBatches > 0 || inUseInventory > 0) {
    unit.isActive = false;
    await unit.save();
    return {
      archived: true,
      message: `Unit '${unit.name}' has historical batches or stock records. It has been archived from future selectors.`
    };
  }

  await DyeingUnit.findByIdAndDelete(id);
  return {
    archived: false,
    message: `Unit '${unit.name}' deleted successfully.`
  };
}

