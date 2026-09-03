import { Types } from 'mongoose';
import { YarnTransaction, IYarnTransaction } from '../../models/YarnTransaction.js';
import { Party } from '../../models/Party.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';
import { parsePagination, formatPaginatedResult } from '../../utils/pagination.js';
import {
  CreateYarnTransactionInput,
  ReceiveFabricInput,
  QueryTransactionsInput
} from './knitting.schema.js';

export function calculateYarnMetrics(boxCount: number, netWeightPerBox: number, wastagePercent = 1.0) {
  const grossWeightKg = Math.round(boxCount * netWeightPerBox * 100) / 100;
  const wastageWeightKg = Math.round(grossWeightKg * (wastagePercent / 100) * 100) / 100;
  const netExpectedFabricKg = Math.round((grossWeightKg - wastageWeightKg) * 100) / 100;

  return {
    grossWeightKg,
    wastageWeightKg,
    netExpectedFabricKg
  };
}

export async function recordYarnTransaction(input: CreateYarnTransactionInput): Promise<IYarnTransaction> {
  const party = await Party.findById(input.partyId);
  if (!party) {
    throw new NotFoundError('Selected party was not found');
  }

  const { grossWeightKg, wastageWeightKg, netExpectedFabricKg } = calculateYarnMetrics(
    input.boxCount,
    input.netWeightPerBox,
    input.wastagePercent
  );

  const transaction = await YarnTransaction.create({
    transactionType: input.transactionType,
    partyId: new Types.ObjectId(input.partyId),
    yarnSpec: input.yarnSpec,
    gatePassNo: input.gatePassNo,
    date: new Date(input.date),
    boxCount: input.boxCount,
    netWeightPerBox: input.netWeightPerBox,
    grossWeightKg,
    wastagePercent: input.wastagePercent,
    wastageWeightKg,
    netExpectedFabricKg,
    receivedFabricKg: 0,
    remainingYarnBalanceKg: grossWeightKg,
    remarks: input.remarks || ''
  });

  return transaction;
}

export async function recordKnittedFabricReceipt(input: ReceiveFabricInput): Promise<{
  reconciledKg: number;
  remainingYarnInFieldKg: number;
}> {
  const party = await Party.findById(input.partyId);
  if (!party) {
    throw new NotFoundError('Selected knitter was not found');
  }

  const activeTransactions = await YarnTransaction.find({
    partyId: new Types.ObjectId(input.partyId),
    yarnSpec: input.yarnSpec,
    transactionType: 'OUTWARD_TO_KNITTER',
    remainingYarnBalanceKg: { $gt: 0 }
  }).sort({ date: 1 });

  if (activeTransactions.length === 0) {
    throw new BadRequestError(`No active unknitted yarn found for knitter ${party.name} under specification ${input.yarnSpec}`);
  }

  let unallocatedWeight = input.weightKg;

  for (const tx of activeTransactions) {
    if (unallocatedWeight <= 0) break;

    const availableToReceive = tx.netExpectedFabricKg - tx.receivedFabricKg;
    const canDeduct = Math.min(availableToReceive > 0 ? availableToReceive : tx.remainingYarnBalanceKg, unallocatedWeight);

    tx.receivedFabricKg = Math.round((tx.receivedFabricKg + canDeduct) * 100) / 100;
    const grossDeduction = Math.round((canDeduct / (1 - tx.wastagePercent / 100)) * 100) / 100;
    tx.remainingYarnBalanceKg = Math.max(0, Math.round((tx.remainingYarnBalanceKg - grossDeduction) * 100) / 100);

    await tx.save();
    unallocatedWeight = Math.round((unallocatedWeight - canDeduct) * 100) / 100;
  }

  const remainingSummary = await YarnTransaction.aggregate([
    {
      $match: {
        partyId: new Types.ObjectId(input.partyId),
        yarnSpec: input.yarnSpec,
        transactionType: 'OUTWARD_TO_KNITTER'
      }
    },
    {
      $group: {
        _id: null,
        totalRemaining: { $sum: '$remainingYarnBalanceKg' }
      }
    }
  ]);

  return {
    reconciledKg: input.weightKg - unallocatedWeight,
    remainingYarnInFieldKg: remainingSummary[0]?.totalRemaining || 0
  };
}

export interface KnitterBalanceSummary {
  partyId: string;
  partyCode: string;
  partyName: string;
  phone: string;
  yarnSpec: string;
  totalGrossKg: number;
  totalExpectedKg: number;
  totalReceivedKg: number;
  remainingYarnKg: number;
}

export async function getKnitterBalances(): Promise<KnitterBalanceSummary[]> {
  const result = await YarnTransaction.aggregate([
    {
      $match: {
        transactionType: 'OUTWARD_TO_KNITTER'
      }
    },
    {
      $group: {
        _id: {
          partyId: '$partyId',
          yarnSpec: '$yarnSpec'
        },
        totalGrossKg: { $sum: '$grossWeightKg' },
        totalExpectedKg: { $sum: '$netExpectedFabricKg' },
        totalReceivedKg: { $sum: '$receivedFabricKg' },
        remainingYarnKg: { $sum: '$remainingYarnBalanceKg' }
      }
    },
    {
      $lookup: {
        from: 'parties',
        localField: '_id.partyId',
        foreignField: '_id',
        as: 'party'
      }
    },
    {
      $unwind: '$party'
    },
    {
      $project: {
        _id: 0,
        partyId: { $toString: '$_id.partyId' },
        yarnSpec: '$_id.yarnSpec',
        partyCode: '$party.code',
        partyName: '$party.name',
        phone: '$party.phone',
        totalGrossKg: { $round: ['$totalGrossKg', 2] },
        totalExpectedKg: { $round: ['$totalExpectedKg', 2] },
        totalReceivedKg: { $round: ['$totalReceivedKg', 2] },
        remainingYarnKg: { $round: ['$remainingYarnKg', 2] }
      }
    },
    {
      $sort: { partyName: 1, yarnSpec: 1 }
    }
  ]);

  return result;
}

export async function listYarnTransactions(query: QueryTransactionsInput) {
  const { page, limit, skip } = parsePagination(query, 20);
  const filter: Record<string, unknown> = {};

  if (query.partyId) {
    filter.partyId = new Types.ObjectId(query.partyId);
  }
  if (query.transactionType) {
    filter.transactionType = query.transactionType;
  }
  if (query.yarnSpec) {
    filter.yarnSpec = query.yarnSpec;
  }
  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { gatePassNo: searchRegex },
      { yarnSpec: searchRegex },
      { remarks: searchRegex }
    ];
  }

  const [items, total] = await Promise.all([
    YarnTransaction.find(filter)
      .populate('partyId', 'code name phone')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit),
    YarnTransaction.countDocuments(filter)
  ]);

  return formatPaginatedResult(items, total, page, limit);
}
