import ExcelJS from 'exceljs';
import { Party } from '../../models/Party.js';
import { PartyLedgerEntry } from '../../models/PartyLedgerEntry.js';
import { DyeingBatch } from '../../models/DyeingBatch.js';
import { YarnTransaction } from '../../models/YarnTransaction.js';
import { Dispatch } from '../../models/Dispatch.js';
import { buildPartyLedgerWorkbook } from './engine/builders/partyLedgerBuilder.js';
import { buildDyeingMillReportWorkbook, DyeingBatchReportItem } from './engine/builders/dyeingReportBuilder.js';
import { buildGatePassRegisterWorkbook, GatePassRow } from './engine/builders/gatePassRegisterBuilder.js';
import { buildKnittingYarnWorkbook, KnittingReportItem } from './engine/builders/knittingYarnBuilder.js';
import { buildMasterBalanceWorkbook, MasterBalanceItem } from './engine/builders/masterBalanceBuilder.js';
import { NotFoundError } from '../../utils/errors.js';

export class ReportsService {
  /**
   * 1. Customer / Buyer Financial Ledger Excel
   */
  async generatePartyLedgerExcel(partyId: string, dateFrom?: string, dateTo?: string): Promise<{ workbook: ExcelJS.Workbook; filename: string }> {
    const party = await Party.findById(partyId);
    if (!party) {
      throw new NotFoundError('Party not found');
    }

    const query: any = { partyId: party._id };
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        query.date.$lte = to;
      }
    }

    const rawEntries = await PartyLedgerEntry.find(query).sort({ date: 1, createdAt: 1 }).lean();

    const entries = rawEntries.map((e) => ({
      date: e.date,
      referenceNo: e.referenceNo || '—',
      description: e.description || 'Transaction',
      entryType: e.entryType as 'DEBIT' | 'CREDIT',
      amount: e.amount,
      runningBalance: e.runningBalance
    }));

    const workbook = buildPartyLedgerWorkbook({
      party: {
        name: party.name,
        code: party.code,
        phone: party.phone,
        contactPerson: party.contactPerson,
        address: party.address,
        mlNo: party.mlNo,
        openingBalance: party.openingBalance,
        currentBalance: party.currentBalance
      },
      dateFrom,
      dateTo,
      entries
    });

    const safeName = party.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`;

    return { workbook, filename };
  }

  /**
   * 2. Dyeing Mill Processing & Shortage Report (Multi-sheet)
   */
  async generateDyeingReportExcel(millName?: string, fabricType?: string, dateFrom?: string, dateTo?: string): Promise<{ workbook: ExcelJS.Workbook; filename: string }> {
    const query: any = {};
    if (millName && millName !== 'ALL') {
      query.millName = millName;
    }
    if (fabricType && fabricType !== 'ALL') {
      query.fabricType = fabricType;
    }
    if (dateFrom || dateTo) {
      query.dateIssued = {};
      if (dateFrom) query.dateIssued.$gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        query.dateIssued.$lte = to;
      }
    }

    const batches = await DyeingBatch.find(query)
      .populate('allocatedCustomerId', 'name')
      .sort({ dateIssued: -1 })
      .lean();

    const reportItems: DyeingBatchReportItem[] = batches.map((b: any) => ({
      batchNo: b.batchNo,
      millName: b.millName,
      customMillName: b.customMillName,
      fabricType: b.fabricType,
      yarnSpec: b.yarnSpec,
      targetColor: b.targetColor,
      igpNo: b.igpNo,
      ogpNo: b.ogpNo,
      dateIssued: b.dateIssued,
      dateReceived: b.dateReceived,
      ecruRollsCount: b.ecruRollsCount,
      ecruWeightKg: b.ecruWeightKg,
      finishRollsCount: b.finishRollsCount,
      finishWeightKg: b.finishWeightKg,
      shortageWeightKg: b.shortageWeightKg,
      shortagePercent: b.shortagePercent,
      customerName: b.allocatedCustomerId?.name || (b.remarks?.includes('Customer:') ? b.remarks.replace('Customer:', '').trim() : undefined),
      status: b.status,
      remarks: b.remarks
    }));

    const targetMill = millName && millName !== 'ALL' ? millName : 'GHUMMAN DYEING';
    const workbook = buildDyeingMillReportWorkbook({
      millName: targetMill,
      dateFrom,
      dateTo,
      batches: reportItems
    });

    const safeMill = targetMill.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeMill}_Dyeing_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

    return { workbook, filename };
  }

  /**
   * 3. Gate Pass Registers (Inward IGP & Outward OGP)
   */
  async generateGatePassRegisterExcel(
    type: 'IGP' | 'OGP',
    partyId?: string,
    millName?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<{ workbook: ExcelJS.Workbook; filename: string }> {
    let partyName = 'All Parties';
    if (partyId && partyId !== 'ALL') {
      const p = await Party.findById(partyId);
      if (p) partyName = p.name;
    }

    const rows: GatePassRow[] = [];

    if (type === 'IGP') {
      // Inward Gate Passes: Fabric received for processing
      const query: any = {};
      if (partyId && partyId !== 'ALL') query.allocatedCustomerId = partyId;
      if (millName && millName !== 'ALL') query.millName = millName;
      if (dateFrom || dateTo) {
        query.dateIssued = {};
        if (dateFrom) query.dateIssued.$gte = new Date(dateFrom);
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          query.dateIssued.$lte = to;
        }
      }

      const batches = await DyeingBatch.find(query).sort({ dateIssued: 1 }).lean();
      batches.forEach((b) => {
        rows.push({
          date: b.dateIssued,
          passNo: b.igpNo || b.batchNo,
          itemCode: '200010',
          itemDescription: `${b.fabricType} ${b.yarnSpec}`,
          color: b.targetColor || 'ECRU',
          rolls: b.ecruRollsCount || 1,
          finishWeightKg: b.ecruWeightKg,
          remarks: b.remarks
        });
      });
    } else {
      // Outward Gate Passes: Fabric dispatched out
      const query: any = {};
      if (partyId && partyId !== 'ALL') query.allocatedCustomerId = partyId;
      if (millName && millName !== 'ALL') query.millName = millName;
      if (dateFrom || dateTo) {
        query.dateIssued = {};
        if (dateFrom) query.dateIssued.$gte = new Date(dateFrom);
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          query.dateIssued.$lte = to;
        }
      }

      const batches = await DyeingBatch.find(query).sort({ dateIssued: 1 }).lean();
      batches.forEach((b) => {
        rows.push({
          date: b.dateReceived || b.dateIssued,
          passNo: b.ogpNo || b.batchNo,
          lotNo: b.batchNo,
          itemCode: '200043',
          itemDescription: `${b.fabricType} ${b.yarnSpec}`,
          color: b.targetColor || 'WHITE',
          rolls: b.finishRollsCount || b.ecruRollsCount || 1,
          ecruWeightKg: b.ecruWeightKg,
          finishWeightKg: b.finishWeightKg || b.ecruWeightKg,
          remarks: b.remarks
        });
      });
    }

    const workbook = buildGatePassRegisterWorkbook({
      type,
      partyName,
      millName: millName || 'GHUMMAN DYEING',
      dateFrom,
      dateTo,
      rows
    });

    const filename = `${type}_Register_${partyName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

    return { workbook, filename };
  }

  /**
   * 4. Knitting & Yarn Stock Report
   */
  async generateKnittingYarnExcel(partyId?: string, dateFrom?: string, dateTo?: string): Promise<{ workbook: ExcelJS.Workbook; filename: string }> {
    const query: any = {};
    if (partyId && partyId !== 'ALL') query.partyId = partyId;
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        query.date.$lte = to;
      }
    }

    const txs = await YarnTransaction.find(query).populate('partyId', 'name').sort({ date: 1 }).lean();

    const items: KnittingReportItem[] = txs.map((t: any) => ({
      date: t.date,
      knitterName: t.partyId?.name || 'CONTRACT KNITTER',
      yarnSpec: t.yarnSpec,
      gatePassNo: t.gatePassNo,
      boxCount: t.boxCount,
      netWeightPerBox: t.netWeightPerBox,
      grossWeightKg: t.grossWeightKg,
      wastagePercent: t.wastagePercent,
      wastageWeightKg: t.wastageWeightKg,
      netExpectedFabricKg: t.netExpectedFabricKg,
      receivedFabricKg: t.receivedFabricKg,
      remainingYarnBalanceKg: t.remainingYarnBalanceKg,
      remarks: t.remarks
    }));

    const workbook = buildKnittingYarnWorkbook({
      dateFrom,
      dateTo,
      items
    });

    const filename = `Knitting_Yarn_Stock_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    return { workbook, filename };
  }

  /**
   * 5. Master Balance Directory
   */
  async generateMasterBalanceExcel(): Promise<{ workbook: ExcelJS.Workbook; filename: string }> {
    const parties = await Party.find().sort({ name: 1 }).lean();

    const items: MasterBalanceItem[] = parties.map((p, idx) => {
      let category = 'Fabric Buyer';
      if (p.tags?.isDyeingMill) category = 'Dyeing Unit';
      else if (p.tags?.isKnitter) category = 'Contract Knitter';
      else if (p.tags?.isYarnClient) category = 'Yarn Supplier';

      const balance = p.currentBalance || 0;
      const debit = balance > 0 ? balance : 0;
      const credit = balance < 0 ? Math.abs(balance) : 0;

      return {
        sr: idx + 1,
        code: p.code,
        name: p.name,
        phone: p.phone,
        category,
        debit,
        credit,
        netBalance: balance
      };
    });

    const workbook = buildMasterBalanceWorkbook(items);
    const filename = `Master_Party_Balance_Directory_${new Date().toISOString().split('T')[0]}.xlsx`;

    return { workbook, filename };
  }
}

export const reportsService = new ReportsService();
