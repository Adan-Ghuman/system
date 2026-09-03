import mongoose, { Types } from 'mongoose';
import { Dispatch, IDispatch } from '../../models/Dispatch.js';
import { Invoice, IInvoice, InvoiceType } from '../../models/Invoice.js';
import { FabricInventory } from '../../models/FabricInventory.js';
import { Party } from '../../models/Party.js';
import { PartyLedgerEntry } from '../../models/PartyLedgerEntry.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { parsePagination, formatPaginatedResult } from '../../utils/pagination.js';
import { CreateDispatchInput, QueryDispatchesInput } from './dispatch.schema.js';

export function calculateInvoiceFinancials(
  totalWeightKg: number,
  ratePerKg: number,
  invoiceType: InvoiceType
) {
  const baseAmount = Math.round(totalWeightKg * ratePerKg * 100) / 100;
  const taxPercent = invoiceType === 'TAX_18_PERCENT' ? 18.0 : 0;
  const taxAmount = Math.round(baseAmount * (taxPercent / 100) * 100) / 100;
  const grandTotal = Math.round((baseAmount + taxAmount) * 100) / 100;

  return {
    baseAmount,
    taxPercent,
    taxAmount,
    grandTotal
  };
}

export async function generateNextDispatchNo(): Promise<string> {
  const last = await Dispatch.findOne({ dispatchNo: /^DSP-\d+$/ }).sort({ dispatchNo: -1 });
  if (!last) return 'DSP-001';
  const match = last.dispatchNo.match(/^DSP-(\d+)$/);
  if (!match) return 'DSP-001';
  return `DSP-${(parseInt(match[1], 10) + 1).toString().padStart(3, '0')}`;
}

export async function generateNextOgpNo(): Promise<string> {
  const last = await Dispatch.findOne({ ogpNo: /^OGP-DISP-\d+$/ }).sort({ ogpNo: -1 });
  if (!last) return 'OGP-DISP-001';
  const match = last.ogpNo.match(/^OGP-DISP-(\d+)$/);
  if (!match) return 'OGP-DISP-001';
  return `OGP-DISP-${(parseInt(match[1], 10) + 1).toString().padStart(3, '0')}`;
}

export async function generateNextInvoiceNo(type: InvoiceType): Promise<string> {
  const prefix = type === 'TAX_18_PERCENT' ? 'INV-GST' : 'INV-NT';
  const regex = new RegExp(`^${prefix}-\\d+$`);
  const last = await Invoice.findOne({ invoiceNo: regex }).sort({ invoiceNo: -1 });
  if (!last) return `${prefix}-001`;
  const match = last.invoiceNo.match(new RegExp(`^${prefix}-(\\d+)$`));
  if (!match) return `${prefix}-001`;
  return `${prefix}-${(parseInt(match[1], 10) + 1).toString().padStart(3, '0')}`;
}

export async function executeDispatch(input: CreateDispatchInput): Promise<{
  dispatch: IDispatch;
  invoice: IInvoice;
}> {
  const party = await Party.findById(input.customerId);
  if (!party) {
    throw new NotFoundError('Customer party not found');
  }

  const totalRolls = input.rolls.length;
  const totalNetWeightKg = Math.round(
    input.rolls.reduce((sum, r) => sum + r.netWeightKg, 0) * 100
  ) / 100;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const inventory = await FabricInventory.findOne({
      fabricType: input.fabricType,
      yarnSpec: input.yarnSpec,
      state: 'FINISHED_DYED',
      color: input.color.toUpperCase(),
      location: input.fromLocation
    }).session(session);

    if (
      !inventory ||
      inventory.totalRolls < totalRolls ||
      inventory.totalWeightKg < totalNetWeightKg
    ) {
      const availableRolls = inventory ? inventory.totalRolls : 0;
      const availableKg = inventory ? inventory.totalWeightKg : 0;
      throw new BadRequestError(
        `Insufficient stock at ${input.fromLocation}. Available: ${availableRolls} rolls (${availableKg} Kg)`
      );
    }

    inventory.totalRolls = Math.max(0, inventory.totalRolls - totalRolls);
    inventory.totalWeightKg = Math.max(
      0,
      Math.round((inventory.totalWeightKg - totalNetWeightKg) * 100) / 100
    );
    inventory.updatedAt = new Date();
    await inventory.save({ session });

    const dispatchNo = await generateNextDispatchNo();
    const ogpNo = await generateNextOgpNo();

    const [dispatch] = await Dispatch.create(
      [
        {
          dispatchNo,
          ogpNo,
          customerId: new Types.ObjectId(input.customerId),
          fromLocation: input.fromLocation,
          fabricType: input.fabricType,
          yarnSpec: input.yarnSpec,
          color: input.color.toUpperCase(),
          rolls: input.rolls,
          totalRolls,
          totalNetWeightKg,
          driverName: input.driverName || '',
          vehicleNo: input.vehicleNo || '',
          date: new Date(input.date),
          remarks: input.remarks || ''
        }
      ],
      { session }
    );

    const { baseAmount, taxPercent, taxAmount, grandTotal } = calculateInvoiceFinancials(
      totalNetWeightKg,
      input.ratePerKg,
      input.invoiceType
    );

    const invoiceNo = await generateNextInvoiceNo(input.invoiceType);

    const [invoice] = await Invoice.create(
      [
        {
          invoiceNo,
          invoiceType: input.invoiceType,
          dispatchId: dispatch._id,
          customerId: new Types.ObjectId(input.customerId),
          ratePerKg: input.ratePerKg,
          totalWeightKg: totalNetWeightKg,
          baseAmount,
          taxPercent,
          taxAmount,
          grandTotal,
          date: new Date(input.date),
          remarks: input.remarks || ''
        }
      ],
      { session }
    );

    const updatedBalance = Math.round((party.currentBalance + grandTotal) * 100) / 100;
    party.currentBalance = updatedBalance;
    await party.save({ session });

    await PartyLedgerEntry.create(
      [
        {
          partyId: party._id,
          entryType: 'DEBIT',
          amount: grandTotal,
          runningBalance: updatedBalance,
          referenceType: 'INVOICE',
          referenceId: invoice._id,
          referenceNo: invoiceNo,
          date: new Date(input.date),
          description: `Fabric Dispatch ${dispatchNo} [${input.rolls.length} Rolls / ${totalNetWeightKg} Kg of ${input.fabricType} ${input.color}] (${input.invoiceType})`
        }
      ],
      { session }
    );

    await session.commitTransaction();
    return { dispatch, invoice };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function listDispatches(query: QueryDispatchesInput) {
  const { page, limit, skip } = parsePagination(query, 20);
  const filter: Record<string, unknown> = {};

  if (query.customerId) {
    filter.customerId = new Types.ObjectId(query.customerId);
  }
  if (query.fromLocation) {
    filter.fromLocation = query.fromLocation;
  }
  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { dispatchNo: searchRegex },
      { ogpNo: searchRegex },
      { color: searchRegex },
      { fabricType: searchRegex },
      { driverName: searchRegex },
      { vehicleNo: searchRegex }
    ];
  }

  const [items, total] = await Promise.all([
    Dispatch.find(filter)
      .populate('customerId', 'code name phone currentBalance')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit),
    Dispatch.countDocuments(filter)
  ]);

  const dispatchIds = items.map((d) => d._id);
  const invoices = await Invoice.find({ dispatchId: { $in: dispatchIds } });
  const invoiceMap = new Map(invoices.map((inv) => [inv.dispatchId.toString(), inv]));

  const enrichedItems = items.map((d) => ({
    ...d.toObject(),
    invoice: invoiceMap.get(d._id.toString()) || null
  }));

  return formatPaginatedResult(enrichedItems, total, page, limit);
}

export async function getDispatchDetails(id: string) {
  const dispatch = await Dispatch.findById(id).populate('customerId', 'code name phone address');
  if (!dispatch) {
    throw new NotFoundError('Dispatch not found');
  }

  const invoice = await Invoice.findOne({ dispatchId: dispatch._id });
  return { dispatch, invoice };
}
