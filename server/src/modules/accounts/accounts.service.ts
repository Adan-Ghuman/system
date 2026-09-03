import mongoose, { Types } from 'mongoose';
import { PaymentVoucher, IPaymentVoucher, VoucherType, PaymentMode } from '../../models/PaymentVoucher.js';
import { Party } from '../../models/Party.js';
import { PartyLedgerEntry } from '../../models/PartyLedgerEntry.js';
import { NotFoundError } from '../../utils/errors.js';
import { parsePagination, formatPaginatedResult } from '../../utils/pagination.js';
import { CreateVoucherInput, QueryVouchersInput, QueryLedgerInput } from './accounts.schema.js';

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
