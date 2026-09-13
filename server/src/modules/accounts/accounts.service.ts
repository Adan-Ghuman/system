import mongoose, { Types } from 'mongoose';
import { PaymentVoucher, IPaymentVoucher, VoucherType, PaymentMode } from '../../models/PaymentVoucher.js';
import { Party } from '../../models/Party.js';
import { PartyLedgerEntry } from '../../models/PartyLedgerEntry.js';
import { NotFoundError } from '../../utils/errors.js';
import { parsePagination, formatPaginatedResult } from '../../utils/pagination.js';
import {
  CreateVoucherInput,
  UpdateVoucherInput,
  QueryVouchersInput,
  QueryLedgerInput,
  UpdateLedgerEntryInput
} from './accounts.schema.js';

export async function generateNextVoucherNo(type: VoucherType, mode: PaymentMode): Promise<string> {
  let prefix = 'JV';

  if (type === 'RECEIPT') {
    prefix = mode === 'CASH' ? 'CRV' : 'BRV';
  } else if (type === 'PAYMENT') {
    prefix = mode === 'CASH' ? 'CPV' : 'BPV';
  }

  const regex = new RegExp(`^${prefix}-\\d+$`);
  const last = await PaymentVoucher.findOne({ voucherNo: regex }).sort({ voucherNo: -1 });
  if (!last) return `${prefix}-001`;

  const match = last.voucherNo.match(new RegExp(`^${prefix}-(\\d+)$`));
  if (!match) return `${prefix}-001`;

  return `${prefix}-${(parseInt(match[1], 10) + 1).toString().padStart(3, '0')}`;
}

export async function createPaymentVoucher(input: CreateVoucherInput): Promise<IPaymentVoucher> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const party = await Party.findById(input.partyId).session(session);
    if (!party) {
      throw new NotFoundError('Party was not found');
    }

    const voucherNo = await generateNextVoucherNo(input.voucherType, input.paymentMode);

    const [voucher] = await PaymentVoucher.create(
      [
        {
          voucherNo,
          voucherType: input.voucherType,
          paymentMode: input.paymentMode,
          partyId: new Types.ObjectId(input.partyId),
          amount: input.amount,
          date: new Date(input.date),
          bankName: input.bankName || '',
          chequeNo: input.chequeNo || '',
          chequeDate: input.chequeDate ? new Date(input.chequeDate) : undefined,
          transactionRef: input.transactionRef || '',
          remarks: input.remarks || ''
        }
      ],
      { session }
    );

    const isCredit = input.voucherType === 'RECEIPT';
    const delta = isCredit ? -input.amount : input.amount;
    const newBalance = Math.round((party.currentBalance + delta) * 100) / 100;

    party.currentBalance = newBalance;
    await party.save({ session });

    let description = `${input.voucherType} via ${input.paymentMode}`;
    if (input.chequeNo) description += ` (Chq #${input.chequeNo})`;
    if (input.bankName) description += ` - ${input.bankName}`;
    if (input.remarks) description += ` [${input.remarks}]`;

    await PartyLedgerEntry.create(
      [
        {
          partyId: party._id,
          entryType: isCredit ? 'CREDIT' : 'DEBIT',
          amount: input.amount,
          runningBalance: newBalance,
          referenceType: 'PAYMENT',
          referenceId: voucher._id,
          referenceNo: voucherNo,
          date: new Date(input.date),
          description
        }
      ],
      { session }
    );

    await session.commitTransaction();
    return voucher;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function getPartyLedgerStatement(partyId: string, query: QueryLedgerInput) {
  const party = await Party.findById(partyId);
  if (!party) {
    throw new NotFoundError('Party not found');
  }

  const filter: Record<string, unknown> = {
    partyId: new Types.ObjectId(partyId)
  };

  if (query.startDate || query.endDate) {
    const dateRange: Record<string, unknown> = {};
    if (query.startDate) dateRange.$gte = new Date(query.startDate);
    if (query.endDate) dateRange.$lte = new Date(query.endDate);
    filter.date = dateRange;
  }

  const entries = await PartyLedgerEntry.find(filter).sort({ date: 1, createdAt: 1 });

  let totalDebits = 0;
  let totalCredits = 0;

  entries.forEach((e) => {
    if (e.entryType === 'DEBIT') {
      totalDebits = Math.round((totalDebits + e.amount) * 100) / 100;
    } else {
      totalCredits = Math.round((totalCredits + e.amount) * 100) / 100;
    }
  });

  return {
    party,
    entries,
    totalDebits,
    totalCredits,
    closingBalance: party.currentBalance
  };
}

export async function listPaymentVouchers(query: QueryVouchersInput) {
  const { page, limit, skip } = parsePagination(query, 20);
  const filter: Record<string, unknown> = {};

  if (query.partyId) {
    filter.partyId = new Types.ObjectId(query.partyId);
  }
  if (query.voucherType) {
    filter.voucherType = query.voucherType;
  }
  if (query.paymentMode) {
    filter.paymentMode = query.paymentMode;
  }
  if (query.startDate || query.endDate) {
    const dateRange: Record<string, unknown> = {};
    if (query.startDate) dateRange.$gte = new Date(query.startDate);
    if (query.endDate) dateRange.$lte = new Date(query.endDate);
    filter.date = dateRange;
  }
  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { voucherNo: searchRegex },
      { bankName: searchRegex },
      { chequeNo: searchRegex },
      { transactionRef: searchRegex },
      { remarks: searchRegex }
    ];
  }

  const [items, total] = await Promise.all([
    PaymentVoucher.find(filter)
      .populate('partyId', 'code name phone currentBalance')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit),
    PaymentVoucher.countDocuments(filter)
  ]);

  return formatPaginatedResult(items, total, page, limit);
}

export async function getAccountingMetrics() {
  const parties = await Party.find();

  let totalReceivables = 0;
  let totalPayables = 0;

  parties.forEach((p) => {
    if (p.currentBalance > 0) {
      totalReceivables = Math.round((totalReceivables + p.currentBalance) * 100) / 100;
    } else if (p.currentBalance < 0) {
      totalPayables = Math.round((totalPayables + Math.abs(p.currentBalance)) * 100) / 100;
    }
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentVouchers = await PaymentVoucher.find({ date: { $gte: thirtyDaysAgo } });

  let monthlyReceipts = 0;
  let monthlyPayments = 0;

  recentVouchers.forEach((v) => {
    if (v.voucherType === 'RECEIPT') {
      monthlyReceipts = Math.round((monthlyReceipts + v.amount) * 100) / 100;
    } else if (v.voucherType === 'PAYMENT') {
      monthlyPayments = Math.round((monthlyPayments + v.amount) * 100) / 100;
    }
  });

  return {
    totalReceivables,
    totalPayables,
    netReceivablePosition: Math.round((totalReceivables - totalPayables) * 100) / 100,
    monthlyReceipts,
    monthlyPayments,
    totalParties: parties.length
  };
}

export async function recomputePartyLedger(partyId: string | Types.ObjectId, session?: mongoose.ClientSession): Promise<void> {
  const party = await Party.findById(partyId).session(session || null);
  if (!party) return;

  const entries = await PartyLedgerEntry.find({ partyId }).sort({ date: 1, createdAt: 1 }).session(session || null);
  let running = party.openingBalance || 0;

  for (const entry of entries) {
    if (entry.entryType === 'DEBIT') {
      running = Math.round((running + entry.amount) * 100) / 100;
    } else {
      running = Math.round((running - entry.amount) * 100) / 100;
    }
    entry.runningBalance = running;
    await entry.save({ session });
  }

  party.currentBalance = running;
  await party.save({ session });
}

export async function updatePaymentVoucher(voucherId: string, input: UpdateVoucherInput): Promise<IPaymentVoucher> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const voucher = await PaymentVoucher.findById(voucherId).session(session);
    if (!voucher) {
      throw new NotFoundError('Payment voucher not found');
    }

    const oldPartyId = voucher.partyId;
    const targetPartyId = input.partyId ? new Types.ObjectId(input.partyId) : voucher.partyId;

    if (input.voucherType) voucher.voucherType = input.voucherType;
    if (input.paymentMode) voucher.paymentMode = input.paymentMode;
    if (input.amount !== undefined) voucher.amount = input.amount;
    if (input.date) voucher.date = new Date(input.date);
    if (input.bankName !== undefined) voucher.bankName = input.bankName;
    if (input.chequeNo !== undefined) voucher.chequeNo = input.chequeNo;
    if (input.chequeDate !== undefined) voucher.chequeDate = input.chequeDate ? new Date(input.chequeDate) : undefined;
    if (input.transactionRef !== undefined) voucher.transactionRef = input.transactionRef;
    if (input.remarks !== undefined) voucher.remarks = input.remarks;
    if (input.partyId) voucher.partyId = targetPartyId;

    await voucher.save({ session });

    let ledgerEntry = await PartyLedgerEntry.findOne({
      $or: [
        { referenceId: voucher._id },
        { referenceNo: voucher.voucherNo }
      ]
    }).session(session);

    let description = `${voucher.voucherType} via ${voucher.paymentMode}`;
    if (voucher.chequeNo) description += ` (Chq #${voucher.chequeNo})`;
    if (voucher.bankName) description += ` - ${voucher.bankName}`;
    if (voucher.remarks) description += ` [${voucher.remarks}]`;

    const isCredit = voucher.voucherType === 'RECEIPT';

    if (ledgerEntry) {
      ledgerEntry.partyId = targetPartyId;
      ledgerEntry.entryType = isCredit ? 'CREDIT' : 'DEBIT';
      ledgerEntry.amount = voucher.amount;
      ledgerEntry.date = voucher.date;
      ledgerEntry.description = description;
      await ledgerEntry.save({ session });
    } else {
      await PartyLedgerEntry.create(
        [
          {
            partyId: targetPartyId,
            entryType: isCredit ? 'CREDIT' : 'DEBIT',
            amount: voucher.amount,
            runningBalance: 0,
            referenceType: 'PAYMENT',
            referenceId: voucher._id,
            referenceNo: voucher.voucherNo,
            date: voucher.date,
            description
          }
        ],
        { session }
      );
    }

    await recomputePartyLedger(targetPartyId, session);

    if (oldPartyId.toString() !== targetPartyId.toString()) {
      await recomputePartyLedger(oldPartyId, session);
    }

    await session.commitTransaction();
    return voucher;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function deletePaymentVoucher(voucherId: string): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const voucher = await PaymentVoucher.findById(voucherId).session(session);
    if (!voucher) {
      throw new NotFoundError('Payment voucher not found');
    }

    const partyId = voucher.partyId;

    await PartyLedgerEntry.deleteMany(
      {
        $or: [
          { referenceId: voucher._id },
          { referenceNo: voucher.voucherNo }
        ]
      },
      { session }
    );

    await PaymentVoucher.findByIdAndDelete(voucher._id).session(session);

    await recomputePartyLedger(partyId, session);

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function updateLedgerEntry(entryId: string, input: UpdateLedgerEntryInput) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const entry = await PartyLedgerEntry.findById(entryId).session(session);
    if (!entry) {
      throw new NotFoundError('Ledger entry not found');
    }

    if (input.amount !== undefined) entry.amount = input.amount;
    if (input.date) entry.date = new Date(input.date);
    if (input.description !== undefined) entry.description = input.description;

    await entry.save({ session });

    if (entry.referenceType === 'PAYMENT' && entry.referenceId) {
      const voucher = await PaymentVoucher.findById(entry.referenceId).session(session);
      if (voucher) {
        if (input.amount !== undefined) voucher.amount = input.amount;
        if (input.date) voucher.date = new Date(input.date);
        await voucher.save({ session });
      }
    }

    await recomputePartyLedger(entry.partyId, session);

    await session.commitTransaction();
    return entry;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function deleteLedgerEntry(entryId: string): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const entry = await PartyLedgerEntry.findById(entryId).session(session);
    if (!entry) {
      throw new NotFoundError('Ledger entry not found');
    }

    const partyId = entry.partyId;

    if (entry.referenceType === 'PAYMENT' && entry.referenceId) {
      await PaymentVoucher.findByIdAndDelete(entry.referenceId).session(session);
    }

    await PartyLedgerEntry.findByIdAndDelete(entry._id).session(session);

    await recomputePartyLedger(partyId, session);

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
