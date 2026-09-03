import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Party } from '../models/Party.js';
import { FabricInventory } from '../models/FabricInventory.js';
import { DyeingBatch } from '../models/DyeingBatch.js';
import { YarnTransaction } from '../models/YarnTransaction.js';
import { Dispatch } from '../models/Dispatch.js';
import { Invoice } from '../models/Invoice.js';
import { PartyLedgerEntry } from '../models/PartyLedgerEntry.js';
import { PaymentVoucher } from '../models/PaymentVoucher.js';
import { seedInitialAdmin } from '../config/seed.js';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // ignore if network interface restricts custom dns
}

const RAZA_DIR = path.resolve(process.cwd(), '../Raza');

function parseNumber(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  if (typeof val === 'object' && 'result' in val) {
    const res = (val as { result: unknown }).result;
    if (typeof res === 'number') return isNaN(res) ? 0 : res;
  }
  const str = String(val).replace(/,/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseText(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object' && 'text' in val) {
    return String((val as { text: unknown }).text || '').trim();
  }
  return String(val).trim();
}

function parseDate(val: unknown, fallbackDaysAgo = 10): Date {
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val;
  }
  if (typeof val === 'string') {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (typeof val === 'number') {
    const utcDays = Math.floor(val - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    if (!isNaN(dateInfo.getTime())) return dateInfo;
  }
  return new Date(Date.now() - fallbackDaysAgo * 24 * 60 * 60 * 1000);
}

export async function runFullRazaSeed(): Promise<void> {
  const targetDir = fs.existsSync(RAZA_DIR)
    ? RAZA_DIR
    : path.resolve('C:/Users/adang/OneDrive/Documents/Personal Project/Ghuman_system/Raza');

  console.log(`Using Raza directory: ${targetDir}`);
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Raza folder not found at ${targetDir}`);
  }

  // 1. Ensure Admin and Base Dyeing Mills exist
  console.log('Seeding initial admin and core dyeing mills...');
  await seedInitialAdmin();

  const ghummanMill = await Party.findOne({ code: 'PRT-001' });
  const rajputMill = await Party.findOne({ code: 'PRT-002' });

  // 2. Parse 112233.xlsx for Master Parties
  console.log('Parsing 112233.xlsx for Master Parties...');
  const masterFile = path.join(targetDir, '112233.xlsx');
  const partiesMap = new Map<string, any>();

  let nextCodeNum = 3;
  function getNextCode(): string {
    const code = `PRT-${nextCodeNum.toString().padStart(3, '0')}`;
    nextCodeNum++;
    return code;
  }

  if (fs.existsSync(masterFile)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(masterFile);
    const sheet = wb.worksheets[0];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 2) {
        const vals = Array.isArray(row.values) ? row.values : [];
        const name = parseText(vals[2]);

        if (name && name.toUpperCase() !== 'TOTALL AMOUNT') {
          const phone = parseText(vals[3]);
          const debit = parseNumber(vals[4]);
          const credit = parseNumber(vals[5]);

          const upper = name.toUpperCase();
          const isDyeingMill = upper.includes('DYEING');
          const isKnitter = upper.includes('KNITTING') || upper.includes('KNT') || upper.includes('FABRIC');
          const isFabricBuyer = !isDyeingMill && (debit > 0 || !isKnitter);
          const isYarnClient = upper.includes('TRADER') || upper.includes('YARN');

          const netBalance = Math.round((debit + credit) * 100) / 100;

          partiesMap.set(upper, {
            name,
            phone: phone || '0300-1234567',
            tags: { isFabricBuyer, isKnitter, isDyeingMill, isYarnClient },
            openingBalance: netBalance,
            currentBalance: netBalance
          });
        }
      }
    });
  }

  // Add Known Knitters from file names and sheet names
  const knitterNames = [
    'Ayun Fabric',
    'AJ Knitting',
    'Madni Fabric',
    'Master Usman Knitting',
    'Mistari Irfan Knitting',
    'Master Islam Knitting',
    'Shahi Hosiery',
    'Shamas Knitting',
    'Basait Knitting',
    'Malik Adnan Knitting',
    'Awais Knitting',
    'Anwar Khawja Knitting',
    'Baba Akhtar Knitting',
    'Faraz Sport',
    'Qasim Fabric',
    'Ginza Industry',
    'Hafiz Shahzad',
    'Baryer Knitting',
    'Malik Rizwan',
    'Rehman Hosiery',
    'Waseem Sb (R.K Fabrics)',
    'Shahid Knitting',
    'City Sports KNT'
  ];

  for (const kName of knitterNames) {
    const upper = kName.toUpperCase();
    if (!partiesMap.has(upper)) {
      partiesMap.set(upper, {
        name: kName,
        phone: '0300-5544332',
        tags: { isFabricBuyer: false, isKnitter: true, isDyeingMill: false, isYarnClient: false },
        openingBalance: 0,
        currentBalance: 0
      });
    }
  }

  // Save all parties
  console.log(`Saving ${partiesMap.size} parties to MongoDB Atlas...`);
  const savedParties: any[] = [];
  for (const [_, pData] of partiesMap) {
    let party = await Party.findOne({ name: pData.name });
    if (!party) {
      party = await Party.create({
        code: getNextCode(),
        name: pData.name,
        contactPerson: pData.name.split(' ')[0] + ' Sb',
        phone: pData.phone,
        address: 'Sialkot Industrial Zone, Pakistan',
        tags: pData.tags,
        openingBalance: pData.openingBalance,
        currentBalance: pData.currentBalance,
        isActive: true
      });
    }
    savedParties.push(party);
  }

  // 3. Parse Dyeing Reports (Ghumman & Rajput)
  console.log('Parsing Ghumman Dyeing Report (77 sheets)...');
  const ghummanFile = path.join(targetDir, 'ROZAIN TEXTILE GHUMMAN DYEING REPORT 2026.xlsx');
  const dyeingBatchesToInsert: any[] = [];
  let batchSeq = 1;

  if (fs.existsSync(ghummanFile)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(ghummanFile);

    for (const sheet of wb.worksheets) {
      const sheetName = sheet.name.trim();
      if (['MAIN SHEETS', 'SAMPLE'].includes(sheetName.toUpperCase())) continue;

      let fabricType = sheetName;
      let yarnSpec = '150/48';
      const specMatch = sheetName.match(/(\d+[\s\/-]+\d+(?:[\s\/-]+\d+)?)/);
      if (specMatch) {
        yarnSpec = specMatch[1].replace(/-/g, '/');
      }

      const row4 = sheet.getRow(4);
      let colDate = 1;
      let colIgp = 2;
      let colOgp = 6;
      let colColor = 7;
      let colFinishRoll = 8;
      let colEcruWeight = 9;
      let colFinishWeight = 10;
      let colShortage = 11;
      let colParty = 13;

      row4.eachCell((cell, colNumber) => {
        const text = parseText(cell.value).toUpperCase();
        if (text === 'DATE') colDate = colNumber;
        else if (text === 'OGP/IGP') colIgp = colNumber;
        else if (text === 'OGP' && colNumber > 5) colOgp = colNumber;
        else if (text === 'COLOR' && colNumber > 5) colColor = colNumber;
        else if (text === 'FINISH WEIGHT') colFinishWeight = colNumber;
        else if (text === 'ECRU WEIGHT') colEcruWeight = colNumber;
        else if (text === 'SHORTAGE') colShortage = colNumber;
        else if (text.includes('PARTY')) colParty = colNumber;
      });

      sheet.eachRow((row, r) => {
        if (r > 4) {
          const vals = Array.isArray(row.values) ? row.values : [];
          const dateVal = vals[colDate];
          const rawEcruWt = parseNumber(vals[colEcruWeight]) || parseNumber(vals[5]);
          const rawFinishWt = parseNumber(vals[colFinishWeight]);
          const color = parseText(vals[colColor]) || parseText(vals[3]) || 'ECRU';
          const partyName = parseText(vals[colParty]);
          const ogp = parseText(vals[colOgp]);
          const igp = parseText(vals[colIgp]);

          const effectiveEcru = rawEcruWt > 0 ? rawEcruWt : (rawFinishWt > 0 ? rawFinishWt : 0);
          if (effectiveEcru <= 0.01 && rawFinishWt <= 0.01) {
            return;
          }

          const ecruWt = Math.max(0.01, Math.round(effectiveEcru * 100) / 100);
          const finishWt = rawFinishWt > 0 ? Math.round(rawFinishWt * 100) / 100 : 0;
          const isDone = finishWt > 0;
          const shortage = isDone ? (parseNumber(vals[colShortage]) || Math.max(0, Math.round((ecruWt - finishWt) * 100) / 100)) : 0;
          const shortagePct = (isDone && ecruWt > 0) ? Math.round((shortage / ecruWt) * 10000) / 100 : 0;
          const finishRolls = isDone ? Math.max(1, Math.round(parseNumber(vals[colFinishRoll]) || 1)) : 0;
          const ecruRolls = Math.max(1, Math.round(parseNumber(vals[4]) || finishRolls || 1));

          const batchNo = `GHUM-${String(batchSeq).padStart(4, '0')}`;
          batchSeq++;

          dyeingBatchesToInsert.push({
            batchNo,
            millName: 'GHUMMAN_DYEING',
            millPartyId: ghummanMill?._id,
            fabricType,
            yarnSpec,
            targetColor: color.toUpperCase() || 'ECRU',
            ogpNo: ogp ? `OGP-${ogp}` : `OGP-GHUM-${batchSeq}`,
            igpNo: igp ? `IGP-${igp}` : undefined,
            ecruRollsCount: ecruRolls,
            ecruWeightKg: ecruWt,
            finishRollsCount: finishRolls,
            finishWeightKg: finishWt,
            shortageWeightKg: shortage,
            shortagePercent: shortagePct,
            status: isDone ? 'COMPLETED' : 'IN_PROCESS',
            dateIssued: parseDate(dateVal, 20),
            dateReceived: isDone ? parseDate(dateVal, 5) : undefined,
            remarks: partyName ? `Customer: ${partyName}` : 'Ghumman Dyeing production lot'
          });
        }
      });
    }
  }

  // Parse Rajput Dyeing Report
  console.log('Parsing Rajput Dyeing Report (54 sheets)...');
  const rajputFile = path.join(targetDir, 'ZR TO RAJPUT DYEING REPORT 2026.xlsx');
  let rajputBatchSeq = 1;

  if (fs.existsSync(rajputFile)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(rajputFile);

    for (const sheet of wb.worksheets) {
      const sheetName = sheet.name.trim();
      if (['MAIN SHEET', 'SHEET6', 'SAMPLE'].includes(sheetName.toUpperCase())) continue;

      let fabricType = sheetName;
      let yarnSpec = '150/48';
      const specMatch = sheetName.match(/(\d+[\s\/-]+\d+(?:[\s\/-]+\d+)?)/);
      if (specMatch) {
        yarnSpec = specMatch[1].replace(/-/g, '/');
      }

      const row4 = sheet.getRow(4);
      let colDate = 1;
      let colIgp = 2;
      let colOgp = 7;
      let colColor = 8;
      let colFinishRoll = 9;
      let colEcruWeight = 10;
      let colFinishWeight = 11;
      let colShortage = 12;
      let colParty = 14;

      row4.eachCell((cell, colNumber) => {
        const text = parseText(cell.value).toUpperCase();
        if (text === 'DATE') colDate = colNumber;
        else if (text === 'OGP/IGP') colIgp = colNumber;
        else if (text === 'OGP' && colNumber > 5) colOgp = colNumber;
        else if (text === 'COLOR' && colNumber > 5) colColor = colNumber;
        else if (text === 'FINISH WEIGHT') colFinishWeight = colNumber;
        else if (text === 'ECRU WEIGHT') colEcruWeight = colNumber;
        else if (text === 'SHORTAGE') colShortage = colNumber;
        else if (text.includes('PARTY')) colParty = colNumber;
      });

      sheet.eachRow((row, r) => {
        if (r > 4) {
          const vals = Array.isArray(row.values) ? row.values : [];
          const dateVal = vals[colDate];
          const rawEcruWt = parseNumber(vals[colEcruWeight]) || parseNumber(vals[5]);
          const rawFinishWt = parseNumber(vals[colFinishWeight]);
          const color = parseText(vals[colColor]) || parseText(vals[3]) || 'ECRU';
          const partyName = parseText(vals[colParty]);
          const ogp = parseText(vals[colOgp]);
          const igp = parseText(vals[colIgp]);

          const effectiveEcru = rawEcruWt > 0 ? rawEcruWt : (rawFinishWt > 0 ? rawFinishWt : 0);
          if (effectiveEcru <= 0.01 && rawFinishWt <= 0.01) {
            return;
          }

          const ecruWt = Math.max(0.01, Math.round(effectiveEcru * 100) / 100);
          const finishWt = rawFinishWt > 0 ? Math.round(rawFinishWt * 100) / 100 : 0;
          const isDone = finishWt > 0;
          const shortage = isDone ? (parseNumber(vals[colShortage]) || Math.max(0, Math.round((ecruWt - finishWt) * 100) / 100)) : 0;
          const shortagePct = (isDone && ecruWt > 0) ? Math.round((shortage / ecruWt) * 10000) / 100 : 0;
          const finishRolls = isDone ? Math.max(1, Math.round(parseNumber(vals[colFinishRoll]) || 1)) : 0;
          const ecruRolls = Math.max(1, Math.round(parseNumber(vals[4]) || finishRolls || 1));

          const batchNo = `RAJ-${String(rajputBatchSeq).padStart(4, '0')}`;
          rajputBatchSeq++;

          dyeingBatchesToInsert.push({
            batchNo,
            millName: 'RAJPUT_DYEING',
            millPartyId: rajputMill?._id,
            fabricType,
            yarnSpec,
            targetColor: color.toUpperCase() || 'ECRU',
            ogpNo: ogp ? `OGP-${ogp}` : `OGP-RAJ-${rajputBatchSeq}`,
            igpNo: igp ? `IGP-${igp}` : undefined,
            ecruRollsCount: ecruRolls,
            ecruWeightKg: ecruWt,
            finishRollsCount: finishRolls,
            finishWeightKg: finishWt,
            shortageWeightKg: shortage,
            shortagePercent: shortagePct,
            status: isDone ? 'COMPLETED' : 'IN_PROCESS',
            dateIssued: parseDate(dateVal, 20),
            dateReceived: isDone ? parseDate(dateVal, 5) : undefined,
            remarks: partyName ? `Customer: ${partyName}` : 'Rajput Dyeing process lot'
          });
        }
      });
    }
  }

  // Bulk insert dyeing batches in chunks
  console.log(`Inserting ${dyeingBatchesToInsert.length} Dyeing Batches into Atlas...`);
  await DyeingBatch.deleteMany({});
  const chunkSize = 200;
  for (let i = 0; i < dyeingBatchesToInsert.length; i += chunkSize) {
    const chunk = dyeingBatchesToInsert.slice(i, i + chunkSize);
    await DyeingBatch.insertMany(chunk);
  }

  // 4. Parse Knitting Yarn Transactions
  console.log('Parsing Knitting Yarn Outward & Inward...');
  const knitterParties = savedParties.filter((p) => p.tags.isKnitter);
  const yarnTransactions: any[] = [];
  const outKnittingFile = path.join(targetDir, 'OUT ROZAIN KNITTING.xlsx');

  if (fs.existsSync(outKnittingFile)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outKnittingFile);

    for (const sheet of wb.worksheets) {
      if (['MAIN SHEET', 'SAMPLE'].includes(sheet.name.toUpperCase())) continue;

      let matchingParty = knitterParties.find((kp) =>
        sheet.name.toUpperCase().includes(kp.name.toUpperCase()) ||
        sheet.name.toUpperCase().includes(kp.name.split(' ')[0].toUpperCase())
      );
      if (!matchingParty) {
        matchingParty = knitterParties[0];
      }

      sheet.eachRow((row, r) => {
        if (r > 6) {
          const vals = Array.isArray(row.values) ? row.values : [];
          const dateVal = vals[1];
          const desc = parseText(vals[2]);
          const igpOgp = parseText(vals[3]);
          const grossKg = parseNumber(vals[6]);

          if (grossKg > 0.01 && matchingParty) {
            const boxes = Math.max(1, Math.round(parseNumber(vals[4]) || 1));
            const nw = Math.max(0.01, parseNumber(vals[5]) || Math.round((grossKg / boxes) * 100) / 100);
            const wastageKg = Math.round(grossKg * 0.01 * 100) / 100;
            const netExpected = Math.max(0, Math.round((grossKg - wastageKg) * 100) / 100);

            yarnTransactions.push({
              transactionType: 'OUTWARD_TO_KNITTER',
              partyId: matchingParty._id,
              yarnSpec: desc || '150/48 Polyester',
              gatePassNo: igpOgp ? `OGP-KNT-${igpOgp}` : `OGP-KNT-${r}`,
              date: parseDate(dateVal, 30),
              boxCount: boxes,
              netWeightPerBox: nw,
              grossWeightKg: grossKg,
              wastagePercent: 1.0,
              wastageWeightKg: wastageKg,
              netExpectedFabricKg: netExpected,
              receivedFabricKg: 0,
              remainingYarnBalanceKg: netExpected,
              remarks: `Yarn issue from sheet ${sheet.name}`
            });
          }
        }
      });
    }
  }

  // Insert Yarn Transactions
  console.log(`Inserting ${yarnTransactions.length} Yarn Transactions into Atlas...`);
  await YarnTransaction.deleteMany({});
  for (let i = 0; i < yarnTransactions.length; i += chunkSize) {
    const chunk = yarnTransactions.slice(i, i + chunkSize);
    await YarnTransaction.insertMany(chunk);
  }

  // 5. Seed Real Fabric Inventory Holdings
  console.log('Seeding Fabric Inventory across Godown and Mills...');
  const inventoryHoldings = [
    { fabricType: '11 Bhary Dull 150/48', yarnSpec: '150/48', state: 'RAW_ECRU' as const, color: 'ECRU', location: 'ZR_GODOWN' as const, totalRolls: 85, totalWeightKg: 1980.5 },
    { fabricType: 'CDP Fleece', yarnSpec: '75/72 Sim', state: 'RAW_ECRU' as const, color: 'ECRU', location: 'ZR_GODOWN' as const, totalRolls: 60, totalWeightKg: 1420.0 },
    { fabricType: 'Interlock Chamki 75/72', yarnSpec: '75/72 Sim', state: 'RAW_ECRU' as const, color: 'ECRU', location: 'ZR_GODOWN' as const, totalRolls: 70, totalWeightKg: 1650.0 },
    { fabricType: 'Terry Fleece 100/144', yarnSpec: '100/144', state: 'RAW_ECRU' as const, color: 'ECRU', location: 'ZR_GODOWN' as const, totalRolls: 45, totalWeightKg: 1100.0 },
    { fabricType: 'Single Jersey 150/48', yarnSpec: '150/48', state: 'RAW_ECRU' as const, color: 'ECRU', location: 'ZR_GODOWN' as const, totalRolls: 50, totalWeightKg: 1150.0 },
    { fabricType: 'Micro Fleece 150/144', yarnSpec: '150/144', state: 'RAW_ECRU' as const, color: 'ECRU', location: 'ZR_GODOWN' as const, totalRolls: 40, totalWeightKg: 920.0 },
    { fabricType: '11 Bhary Dull 150/48', yarnSpec: '150/48', state: 'FINISHED_DYED' as const, color: 'OLIVE GREEN', location: 'GHUMMAN_DYEING' as const, totalRolls: 35, totalWeightKg: 785.4 },
    { fabricType: '11 Bhary Dull 150/48', yarnSpec: '150/48', state: 'FINISHED_DYED' as const, color: 'BROWN', location: 'GHUMMAN_DYEING' as const, totalRolls: 28, totalWeightKg: 640.2 },
    { fabricType: 'CDP Fleece', yarnSpec: '75/72 Sim', state: 'FINISHED_DYED' as const, color: 'NAVY BLUE', location: 'GHUMMAN_DYEING' as const, totalRolls: 42, totalWeightKg: 950.0 },
    { fabricType: 'Interlock Chamki 75/72', yarnSpec: '75/72 Sim', state: 'FINISHED_DYED' as const, color: 'BLACK', location: 'GHUMMAN_DYEING' as const, totalRolls: 50, totalWeightKg: 1120.0 },
    { fabricType: 'Terry Fleece 100/144', yarnSpec: '100/144', state: 'FINISHED_DYED' as const, color: 'JET BLACK', location: 'RAJPUT_DYEING' as const, totalRolls: 38, totalWeightKg: 890.0 },
    { fabricType: 'Micro Fleece 150/144', yarnSpec: '150/144', state: 'FINISHED_DYED' as const, color: 'CHARCOAL GREY', location: 'RAJPUT_DYEING' as const, totalRolls: 30, totalWeightKg: 680.0 },
    { fabricType: '11 Bhary Dull 150/48', yarnSpec: '150/48', state: 'FINISHED_DYED' as const, color: 'OLIVE GREEN', location: 'ZR_GODOWN' as const, totalRolls: 25, totalWeightKg: 560.0 },
    { fabricType: 'CDP Fleece', yarnSpec: '75/72 Sim', state: 'FINISHED_DYED' as const, color: 'NAVY BLUE', location: 'ZR_GODOWN' as const, totalRolls: 30, totalWeightKg: 675.0 },
    { fabricType: 'Interlock Chamki 75/72', yarnSpec: '75/72 Sim', state: 'FINISHED_DYED' as const, color: 'BLACK', location: 'ZR_GODOWN' as const, totalRolls: 20, totalWeightKg: 450.0 }
  ];

  await FabricInventory.deleteMany({});
  await FabricInventory.insertMany(inventoryHoldings);

  // 6. Seed Dispatches, Invoices, and Ledgers
  console.log('Seeding Dispatches and Invoices...');
  const activeBuyers = savedParties.filter((p) => p.tags.isFabricBuyer);
  const topBuyer = activeBuyers[0] || savedParties[0];
  const secondBuyer = activeBuyers[1] || savedParties[1];

  await Dispatch.deleteMany({});
  await Invoice.deleteMany({});
  await PartyLedgerEntry.deleteMany({});
  await PaymentVoucher.deleteMany({});

  if (topBuyer && secondBuyer) {
    const rollsGst = Array.from({ length: 15 }, (_, i) => ({
      rollNumber: i + 1,
      grossWeightKg: 22.5,
      tareKg: 0,
      netWeightKg: 22.5
    }));
    const netWeightGst = 15 * 22.5;
    const rateGst = 920;
    const baseGst = netWeightGst * rateGst;
    const taxGst = Math.round(baseGst * 0.18 * 100) / 100;
    const grandGst = baseGst + taxGst;

    const dsp1 = await Dispatch.create({
      dispatchNo: 'DSP-001',
      ogpNo: 'OGP-DISP-001',
      customerId: topBuyer._id,
      fromLocation: 'ZR_GODOWN',
      fabricType: 'CDP Fleece',
      yarnSpec: '75/72 Sim',
      color: 'NAVY BLUE',
      rolls: rollsGst,
      totalRolls: 15,
      totalNetWeightKg: netWeightGst,
      driverName: 'Muhammad Arshad',
      vehicleNo: 'SLK-21-409',
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      remarks: 'First 18% GST tax invoice dispatch'
    });

    const inv1 = await Invoice.create({
      invoiceNo: 'INV-GST-001',
      invoiceType: 'TAX_18_PERCENT',
      dispatchId: dsp1._id,
      customerId: topBuyer._id,
      ratePerKg: rateGst,
      totalWeightKg: netWeightGst,
      baseAmount: baseGst,
      taxPercent: 18.0,
      taxAmount: taxGst,
      grandTotal: grandGst,
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    });

    await PartyLedgerEntry.create({
      partyId: topBuyer._id,
      entryType: 'DEBIT',
      amount: grandGst,
      runningBalance: topBuyer.currentBalance,
      referenceType: 'INVOICE',
      referenceId: inv1._id,
      referenceNo: inv1.invoiceNo,
      date: inv1.date,
      description: `Sales Tax Invoice (18% GST) - ${dsp1.totalRolls} rolls CDP Fleece`
    });

    const rollsNt = Array.from({ length: 10 }, (_, i) => ({
      rollNumber: i + 1,
      grossWeightKg: 22.0,
      tareKg: 0,
      netWeightKg: 22.0
    }));
    const netWeightNt = 10 * 22.0;
    const rateNt = 880;
    const baseNt = netWeightNt * rateNt;

    const dsp2 = await Dispatch.create({
      dispatchNo: 'DSP-002',
      ogpNo: 'OGP-DISP-002',
      customerId: secondBuyer._id,
      fromLocation: 'ZR_GODOWN',
      fabricType: '11 Bhary Dull 150/48',
      yarnSpec: '150/48',
      color: 'OLIVE GREEN',
      rolls: rollsNt,
      totalRolls: 10,
      totalNetWeightKg: netWeightNt,
      driverName: 'Rashid Minhas',
      vehicleNo: 'FD-18-9901',
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      remarks: 'Commercial non-GST delivery'
    });

    const inv2 = await Invoice.create({
      invoiceNo: 'INV-NT-001',
      invoiceType: 'NON_GST',
      dispatchId: dsp2._id,
      customerId: secondBuyer._id,
      ratePerKg: rateNt,
      totalWeightKg: netWeightNt,
      baseAmount: baseNt,
      taxPercent: 0,
      taxAmount: 0,
      grandTotal: baseNt,
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    });

    await PartyLedgerEntry.create({
      partyId: secondBuyer._id,
      entryType: 'DEBIT',
      amount: baseNt,
      runningBalance: secondBuyer.currentBalance,
      referenceType: 'INVOICE',
      referenceId: inv2._id,
      referenceNo: inv2.invoiceNo,
      date: inv2.date,
      description: `Commercial Delivery Bill - ${dsp2.totalRolls} rolls 11 Bhary Dull`
    });

    const v1 = await PaymentVoucher.create({
      voucherNo: 'BRV-001',
      voucherType: 'RECEIPT',
      paymentMode: 'BANK_TRANSFER',
      partyId: topBuyer._id,
      amount: 200000,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      bankName: 'Meezan Bank Ltd',
      transactionRef: 'RTGS-891024',
      remarks: 'Payment on account received via online RTGS'
    });

    await PartyLedgerEntry.create({
      partyId: topBuyer._id,
      entryType: 'CREDIT',
      amount: 200000,
      runningBalance: topBuyer.currentBalance - 200000,
      referenceType: 'PAYMENT',
      referenceId: v1._id,
      referenceNo: v1.voucherNo,
      date: v1.date,
      description: 'Receipt via BANK_TRANSFER - Meezan Bank Ltd [Payment on account received via online RTGS]'
    });
  }

  // Summary
  console.log('\n=======================================');
  console.log('  MONGODB ATLAS SEED COMPLETED!');
  console.log('=======================================');
  console.log(`Parties:            ${await Party.countDocuments()}`);
  console.log(`Dyeing Batches:     ${await DyeingBatch.countDocuments()}`);
  console.log(`Yarn Transactions:  ${await YarnTransaction.countDocuments()}`);
  console.log(`Fabric Inventories: ${await FabricInventory.countDocuments()}`);
  console.log(`Dispatches:         ${await Dispatch.countDocuments()}`);
  console.log(`Invoices:           ${await Invoice.countDocuments()}`);
  console.log(`Ledger Entries:     ${await PartyLedgerEntry.countDocuments()}`);
  console.log(`Payment Vouchers:   ${await PaymentVoucher.countDocuments()}`);
  console.log('=======================================\n');
}

async function main() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 20000
  });
  console.log('Database connected successfully!');
  await runFullRazaSeed();
  await mongoose.disconnect();
  console.log('Disconnected cleanly.');
}

if (process.argv[1]?.includes('seedRazaAll')) {
  main().catch((err) => {
    console.error('Fatal seed error:', err);
    process.exit(1);
  });
}
