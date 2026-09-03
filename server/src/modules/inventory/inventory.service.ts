import mongoose from 'mongoose';
import { FabricInventory, IFabricInventory } from '../../models/FabricInventory.js';
import { StockTransfer, IStockTransfer } from '../../models/StockTransfer.js';
import { StockAdjustment, IStockAdjustment } from '../../models/StockAdjustment.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { parsePagination, formatPaginatedResult } from '../../utils/pagination.js';
import {
  CreateTransferInput,
  CreateAdjustmentInput,
  QueryInventoryInput,
  QueryTransfersInput
} from './inventory.schema.js';

export async function generateNextTransferNo(): Promise<string> {
  const lastTransfer = await StockTransfer.findOne({ transferNo: /^TRF-\d+$/ }).sort({ transferNo: -1 });
  if (!lastTransfer) {
    return 'TRF-001';
  }

  const match = lastTransfer.transferNo.match(/^TRF-(\d+)$/);
  if (!match) {
    return 'TRF-001';
  }

  const nextNumber = parseInt(match[1], 10) + 1;
  return `TRF-${nextNumber.toString().padStart(3, '0')}`;
}

export async function executeStockTransfer(input: CreateTransferInput): Promise<IStockTransfer> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const source = await FabricInventory.findOne({
      fabricType: input.fabricType,
      yarnSpec: input.yarnSpec,
      state: input.state,
      color: input.color.toUpperCase(),
      location: input.fromLocation
    }).session(session);

    if (!source || source.totalRolls < input.rollsCount || source.totalWeightKg < input.weightKg) {
      const availableRolls = source ? source.totalRolls : 0;
      const availableKg = source ? source.totalWeightKg : 0;
      throw new BadRequestError(
        `Insufficient stock at ${input.fromLocation}. Available: ${availableRolls} rolls (${availableKg} Kg)`
      );
    }

    source.totalRolls = Math.max(0, source.totalRolls - input.rollsCount);
    source.totalWeightKg = Math.max(0, Math.round((source.totalWeightKg - input.weightKg) * 100) / 100);
    source.updatedAt = new Date();
    await source.save({ session });

    await FabricInventory.findOneAndUpdate(
      {
        fabricType: input.fabricType,
        yarnSpec: input.yarnSpec,
        state: input.state,
        color: input.color.toUpperCase(),
        location: input.toLocation
      },
      {
        $inc: {
          totalRolls: input.rollsCount,
          totalWeightKg: input.weightKg
        },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, session }
    );

    const transferNo = await generateNextTransferNo();

    const [transfer] = await StockTransfer.create(
      [
        {
          transferNo,
          fromLocation: input.fromLocation,
          toLocation: input.toLocation,
          fabricType: input.fabricType,
          yarnSpec: input.yarnSpec,
          state: input.state,
          color: input.color.toUpperCase(),
          rollsCount: input.rollsCount,
          weightKg: input.weightKg,
          gatePassNo: input.gatePassNo || '',
          driverName: input.driverName || '',
          vehicleNo: input.vehicleNo || '',
          date: new Date(input.date),
          remarks: input.remarks || ''
        }
      ],
      { session }
    );

    await session.commitTransaction();
    return transfer;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function recordStockAdjustment(input: CreateAdjustmentInput): Promise<IStockAdjustment> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let item = await FabricInventory.findOne({
      fabricType: input.fabricType,
      yarnSpec: input.yarnSpec,
      state: input.state,
      color: input.color.toUpperCase(),
      location: input.location
    }).session(session);

    if (!item) {
      if (input.adjustmentRolls < 0 || input.adjustmentWeightKg < 0) {
        throw new NotFoundError(`No existing stock found at ${input.location} to decrement`);
      }
      item = new FabricInventory({
        fabricType: input.fabricType,
        yarnSpec: input.yarnSpec,
        state: input.state,
        color: input.color.toUpperCase(),
        location: input.location,
        totalRolls: 0,
        totalWeightKg: 0
      });
    }

    const nextRolls = item.totalRolls + input.adjustmentRolls;
    const nextWeight = Math.round((item.totalWeightKg + input.adjustmentWeightKg) * 100) / 100;

    if (nextRolls < 0 || nextWeight < 0) {
      throw new BadRequestError(
        `Adjustment would cause negative inventory. Current: ${item.totalRolls} rolls (${item.totalWeightKg} Kg)`
      );
    }

    item.totalRolls = nextRolls;
    item.totalWeightKg = nextWeight;
    item.updatedAt = new Date();
    await item.save({ session });

    const [adjustment] = await StockAdjustment.create(
      [
        {
          fabricType: input.fabricType,
          yarnSpec: input.yarnSpec,
          state: input.state,
          color: input.color.toUpperCase(),
          location: input.location,
          adjustmentRolls: input.adjustmentRolls,
          adjustmentWeightKg: input.adjustmentWeightKg,
          reason: input.reason,
          date: new Date(input.date),
          remarks: input.remarks || ''
        }
      ],
      { session }
    );

    await session.commitTransaction();
    return adjustment;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function listInventoryItems(query: QueryInventoryInput) {
  const { page, limit, skip } = parsePagination(query, 20);
  const filter: Record<string, unknown> = {
    $or: [{ totalRolls: { $gt: 0 } }, { totalWeightKg: { $gt: 0 } }]
  };

  if (query.location) {
    filter.location = query.location;
  }
  if (query.state) {
    filter.state = query.state;
  }
  if (query.fabricType) {
    filter.fabricType = query.fabricType;
  }
  if (query.color) {
    filter.color = query.color.toUpperCase();
  }
  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { fabricType: searchRegex },
      { yarnSpec: searchRegex },
      { color: searchRegex }
    ];
  }

  const [items, total] = await Promise.all([
    FabricInventory.find(filter)
      .sort({ fabricType: 1, color: 1, location: 1 })
      .skip(skip)
      .limit(limit),
    FabricInventory.countDocuments(filter)
  ]);

  return formatPaginatedResult(items, total, page, limit);
}

export async function getInventorySummary() {
  const result = await FabricInventory.aggregate([
    {
      $match: {
        $or: [{ totalRolls: { $gt: 0 } }, { totalWeightKg: { $gt: 0 } }]
      }
    },
    {
      $group: {
        _id: {
          location: '$location',
          state: '$state'
        },
        totalRolls: { $sum: '$totalRolls' },
        totalWeightKg: { $sum: '$totalWeightKg' },
        uniqueVarieties: { $sum: 1 }
      }
    }
  ]);

  return result;
}

export async function listStockTransfers(query: QueryTransfersInput = {}) {
  const { page, limit, skip } = parsePagination(query, 20);
  const filter: Record<string, unknown> = {};

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { transferNo: searchRegex },
      { fabricType: searchRegex },
      { yarnSpec: searchRegex },
      { color: searchRegex },
      { driverName: searchRegex },
      { vehicleNo: searchRegex },
      { gatePassNo: searchRegex }
    ];
  }

  const [items, total] = await Promise.all([
    StockTransfer.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    StockTransfer.countDocuments(filter)
  ]);

  return formatPaginatedResult(items, total, page, limit);
}
