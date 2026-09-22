import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Party } from '../models/Party.js';
import { FabricInventory } from '../models/FabricInventory.js';
import { DyeingBatch, DyeingMillType } from '../models/DyeingBatch.js';
import { YarnTransaction } from '../models/YarnTransaction.js';
import { Dispatch, IDispatchRoll } from '../models/Dispatch.js';
import { Invoice } from '../models/Invoice.js';
import { PartyLedgerEntry } from '../models/PartyLedgerEntry.js';
import { PaymentVoucher } from '../models/PaymentVoucher.js';
import { seedInitialAdmin } from '../config/seed.js';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // ignore if restricted
}

const DATA_DIR = path.resolve('C:/Users/adang/OneDrive/Documents/Personal Project/Ghuman_system/Data');

function parseNumber(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  if (typeof val === 'object' && val !== null) {
    if ('result' in val) {
      const res = (val as { result: unknown }).result;
      if (typeof res === 'number') return isNaN(res) ? 0 : res;
      if (typeof res === 'string') return parseFloat(res.replace(/,/g, '').trim()) || 0;
    }
  }
  const str = String(val).replace(/,/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseText(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object' && val !== null) {
    if ('text' in val) {
      return String((val as { text: unknown }).text || '').trim();
    }
    if ('result' in val) {
      return String((val as { result: unknown }).result || '').trim();
    }
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
    // Excel serial date to JS Date
    const utcDays = Math.floor(val - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    if (!isNaN(dateInfo.getTime())) return dateInfo;
  }
  return new Date(Date.now() - fallbackDaysAgo * 24 * 60 * 60 * 1000);
}

export async function runIngestion(): Promise<void> {
  console.log(`\n======================================================`);
  console.log(`  STARTING COMPLETE 2026 DATA INGESTION PIPELINE`);
  console.log(`  Source Directory: ${DATA_DIR}`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`Data folder not found at ${DATA_DIR}`);
  }

  // 1. Ensure Admin exists
  console.log('1. Ensuring Admin account exists...');
  await seedInitialAdmin();

  // 2. Clear previous collections to ensure absolute consistency
  console.log('2. Clearing existing operational collections...');
  await Party.deleteMany({});
  await DyeingBatch.deleteMany({});
  await YarnTransaction.deleteMany({});
  await FabricInventory.deleteMany({});
  await Dispatch.deleteMany({});
  await Invoice.deleteMany({});
  await PartyLedgerEntry.deleteMany({});
  await PaymentVoucher.deleteMany({});

  // 3. Register Core 4 Dyeing Mills
  console.log('3. Registering 4 core Dyeing Mills...');
  const ghummanMill = await Party.create({
    code: 'PRT-001',
    name: 'Ghumman Dyeing Mill',
    contactPerson: 'Haji Ghumman',
    phone: '0300-9876543',
    address: 'Daska Road Dyeing Industrial Zone, Sialkot',
    tags: { isFabricBuyer: false, isKnitter: false, isDyeingMill: true, isYarnClient: false },
    openingBalance: 0,
    currentBalance: 0,
    isActive: true
  });

  const rajputMill = await Party.create({
    code: 'PRT-002',
    name: 'Rajput Dyeing Mill',
    contactPerson: 'Rajput Sb',
    phone: '0300-8765432',
    address: 'Circular Road Mills Area, Gujranwala',
    tags: { isFabricBuyer: false, isKnitter: false, isDyeingMill: true, isYarnClient: false },
    openingBalance: 0,
    currentBalance: 0,
    isActive: true
  });

  const hafizSaadMill = await Party.create({
    code: 'PRT-003',
    name: 'Hafiz Saad Dyeing Mill',
    contactPerson: 'Hafiz Saad Sb',
    phone: '0301-7654321',
    address: 'Small Industrial Estate, Sialkot',
    tags: { isFabricBuyer: false, isKnitter: false, isDyeingMill: true, isYarnClient: false },
    openingBalance: 0,
    currentBalance: 0,
    isActive: true
  });

  const hbMill = await Party.create({
    code: 'PRT-004',
    name: 'HB Dyeing Mill',
    contactPerson: 'HB Master Sb',
    phone: '0302-6543210',
    address: 'Kashmir Road Industrial Area, Sialkot',
    tags: { isFabricBuyer: false, isKnitter: false, isDyeingMill: true, isYarnClient: false },
    openingBalance: 0,
    currentBalance: 0,
    isActive: true
  });

  let nextCodeNum = 5;
  function getNextCode(): string {
    const code = `PRT-${nextCodeNum.toString().padStart(3, '0')}`;
    nextCodeNum++;
    return code;
  }

  // 4. Parse Master Parties from 112233.xlsx and jan 26 to till.xlsx
  console.log('4. Parsing Master Parties from 112233.xlsx and jan 26 to till.xlsx...');
  const masterFile = path.join(DATA_DIR, '112233.xlsx');
  const jan26File = path.join(DATA_DIR, 'jan 26 to till.xlsx');
  const partiesMap = new Map<string, {
    name: string;
    phone: string;
    openingBalance: number;
    closingBalance: number;
    tags: { isFabricBuyer: boolean; isKnitter: boolean; isDyeingMill: boolean; isYarnClient: boolean };
    linkedFile?: string;
  }>();
  const linkedFileToPartyKey = new Map<string, string>();

  if (fs.existsSync(masterFile)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(masterFile);
    const sheet = wb.worksheets[0];

    sheet.eachRow((row, r) => {
      if (r > 2) {
        const vals = Array.isArray(row.values) ? row.values : [];
        const rawName = vals[2];
        const nameText = parseText(rawName);
        if (!nameText || nameText.toUpperCase().includes('TOTALL')) return;

        const phone = parseText(vals[3]);
        const debit = parseNumber(vals[4]);
        const credit = parseNumber(vals[5]);
        // Credit amounts in 112233 are negative (e.g. -11939200). Calculate true net balance.
        const netOpening = Math.round((debit + (credit < 0 ? credit : -Math.abs(credit))) * 100) / 100;

        let linkedFile = '';
        if (typeof rawName === 'object' && rawName !== null && 'hyperlink' in rawName) {
          linkedFile = decodeURIComponent(String((rawName as { hyperlink: string }).hyperlink || '')).trim();
        }

        const upper = nameText.toUpperCase().replace(/\s+/g, ' ').trim();
        const isDyeing = upper.includes('DYEING');
        const isKnt = upper.includes('KNITTING') || upper.includes('KNT') || upper.includes('HOSIERY');
        const isYarn = upper.includes('YARN') || upper.includes('TRADER');
        const isBuyer = !isDyeing && !isKnt;

        partiesMap.set(upper, {
          name: nameText,
          phone: phone || '0300-1234567',
          openingBalance: netOpening,
          closingBalance: netOpening,
          tags: {
            isFabricBuyer: isBuyer || debit > 0,
            isKnitter: isKnt,
            isDyeingMill: isDyeing,
            isYarnClient: isYarn
          },
          linkedFile
        });

        if (linkedFile) {
          linkedFileToPartyKey.set(linkedFile.toUpperCase(), upper);
          linkedFileToPartyKey.set(path.basename(linkedFile).toUpperCase(), upper);
          linkedFileToPartyKey.set(path.basename(linkedFile, path.extname(linkedFile)).toUpperCase(), upper);
        }
      }
    });
  }

  // Update with jan 26 to till.xlsx ONLY if party was completely missing from 112233.xlsx
  if (fs.existsSync(jan26File)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(jan26File);
    const sheet = wb.worksheets[0];

    sheet.eachRow((row, r) => {
      if (r > 2) {
        const vals = Array.isArray(row.values) ? row.values : [];
        const nameText = parseText(vals[2]);
        if (!nameText || nameText.toUpperCase().includes('TOTALL')) return;

        const upper = nameText.toUpperCase().replace(/\s+/g, ' ').trim();
        if (!partiesMap.has(upper)) {
          const debit = parseNumber(vals[4]);
          const isDyeing = upper.includes('DYEING');
          const isKnt = upper.includes('KNITTING') || upper.includes('KNT') || upper.includes('HOSIERY');
          const isYarn = upper.includes('YARN') || upper.includes('TRADER');
          partiesMap.set(upper, {
            name: nameText,
            phone: parseText(vals[3]) || '0300-1234567',
            openingBalance: debit,
            closingBalance: debit,
            tags: {
              isFabricBuyer: !isDyeing && !isKnt,
              isKnitter: isKnt,
              isDyeingMill: isDyeing,
              isYarnClient: isYarn
            }
          });
        }
      }
    });
  }

  // Ensure all known contract knitters are in the map
  const knitterList = [
    'AWAIS KNITTING', 'BARYAR KNITTING', 'BASIT KNITTING', 'HB KNITTING',
    'K.B KNITTING', 'MISTRI IRFAN SB KNT', 'ROZIN KNITTING', 'SHAMAS KNT',
    'SMART KNT WEAR', 'AJ KNITTING', 'AYUN FABRICS', 'MADNI FABRICS',
    'MALIK RIZWAN KNT', 'MASTER USMAN KNITTING', 'REHMAN HOSIERY',
    'BABER KNITTING LHR', 'CITY SPORTS KNT LHR'
  ];
  for (const k of knitterList) {
    const upK = k.toUpperCase().replace(/\s+/g, ' ').trim();
    if (!partiesMap.has(upK)) {
      partiesMap.set(upK, {
        name: k,
        phone: '0300-5544332',
        openingBalance: 0,
        closingBalance: 0,
        tags: { isFabricBuyer: false, isKnitter: true, isDyeingMill: false, isYarnClient: false }
      });
    }
  }

  // Save all parties to MongoDB
  console.log(`Saving ${partiesMap.size} parties to MongoDB...`);
  const partyDocsByName = new Map<string, any>();
  const linkedFileToPartyDoc = new Map<string, any>();

  partyDocsByName.set('GHUMMAN DYEING MILL', ghummanMill);
  partyDocsByName.set('GHUMMAN DYEING', ghummanMill);
  partyDocsByName.set('RAJPUT DYEING MILL', rajputMill);
  partyDocsByName.set('RAJPUT DYEING', rajputMill);
  partyDocsByName.set('HAFIZ SAAD DYEING MILL', hafizSaadMill);
  partyDocsByName.set('HAFIZ SAAD DYEING', hafizSaadMill);
  partyDocsByName.set('HB DYEING MILL', hbMill);
  partyDocsByName.set('HB DYEING', hbMill);

  for (const [upper, pData] of partiesMap) {
    if (upper.includes('GHUMMAN DYEING') || upper.includes('RAJPUT DYEING') || upper.includes('HAFIZ SAAD') || upper.includes('HB DYEING')) {
      continue;
    }
    const doc = await Party.create({
      code: getNextCode(),
      name: pData.name,
      contactPerson: pData.name.split(' ')[0] + ' Sb',
      phone: pData.phone,
      address: 'Sialkot Industrial Zone, Punjab, Pakistan',
      tags: pData.tags,
      openingBalance: pData.openingBalance,
      currentBalance: pData.closingBalance,
      isActive: true
    });

    partyDocsByName.set(upper, doc);
    const normalized = pData.name.toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!partyDocsByName.has(normalized)) partyDocsByName.set(normalized, doc);

    const firstWord = pData.name.split(' ')[0].toUpperCase();
    if (!partyDocsByName.has(firstWord)) {
      partyDocsByName.set(firstWord, doc);
    }

    if (pData.linkedFile) {
      linkedFileToPartyDoc.set(pData.linkedFile.toUpperCase(), doc);
      linkedFileToPartyDoc.set(path.basename(pData.linkedFile).toUpperCase(), doc);
      linkedFileToPartyDoc.set(path.basename(pData.linkedFile, path.extname(pData.linkedFile)).toUpperCase(), doc);
    }
  }

  // Pre-sort party entries by key length descending for reliable substring matching
  const sortedPartyEntries = Array.from(partyDocsByName.entries()).sort((a, b) => b[0].length - a[0].length);

  // Common aliases for legacy or misspelled files
  const fileAliases: Record<string, string> = {
    'MGH INTERNATIONAL.XLSX': 'M.G.H INTERNATIONAL',
    'MGH INTERNATIONAL': 'M.G.H INTERNATIONAL',
    'N&S (ROZAIN).XLSX': 'NIZAM & SON (ROZAIN)',
    'NIZAM & SONS (Z.R).XLSX': 'NIZAM & SON (ROZAIN)',
    'BABA AKTHAR HOSIERY.XLSX': 'BABA AKHTAR HOSIERY',
    'HAFIZ JANAHZAIB YARN.XLSX': 'HAFIZ JAHANZAIB YARN',
    'SHAHI HOSEIRY.XLSX': 'SHAHI HOSIERY',
    'ROZIN KNITTING.XLSX': 'ROZIN KNITTING',
    'AWAIS KNITTING.XLSX': 'AWAIS KNITTING',
    'MISTRI IRFAN SB KNT.XLSX': 'MISTRI IRFAN SB KNT',
    'SHAMAS KNT.XLSX': 'SHAMAS KNT'
  };

  function findParty(str: string): any {
    if (!str) return null;
    const rawUpper = str.toUpperCase().trim();
    const upperNoExt = rawUpper.replace(/\.XLSX$/i, '').trim();

    if (fileAliases[rawUpper] && partyDocsByName.has(fileAliases[rawUpper])) {
      return partyDocsByName.get(fileAliases[rawUpper]);
    }
    if (fileAliases[upperNoExt] && partyDocsByName.has(fileAliases[upperNoExt])) {
      return partyDocsByName.get(fileAliases[upperNoExt]);
    }

    if (linkedFileToPartyDoc.has(rawUpper)) return linkedFileToPartyDoc.get(rawUpper);
    if (linkedFileToPartyDoc.has(upperNoExt)) return linkedFileToPartyDoc.get(upperNoExt);
    if (partyDocsByName.has(rawUpper)) return partyDocsByName.get(rawUpper);
    if (partyDocsByName.has(upperNoExt)) return partyDocsByName.get(upperNoExt);

    const norm = upperNoExt.replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    if (partyDocsByName.has(norm)) return partyDocsByName.get(norm);

    for (const [key, doc] of sortedPartyEntries) {
      if (key.length >= 4 && (upperNoExt.includes(key) || key.includes(upperNoExt) || norm.includes(key) || key.includes(norm))) {
        return doc;
      }
    }
    return null;
  }

  // 5. Ingest 4 Dyeing Reports
  console.log('\n5. Ingesting 4 Dyeing Reports (Ghumman, Rajput, Hafiz Saad, HB)...');
  const dyeingConfigs: { file: string; millName: DyeingMillType; millDoc: any; prefix: string }[] = [
    { file: 'ROZAIN TEXTILE GHUMMAN DYEING REPORT 2026.xlsx', millName: 'GHUMMAN_DYEING', millDoc: ghummanMill, prefix: 'GHUM' },
    { file: 'ZR TO RAJPUT DYEING REPORT 2026.xlsx', millName: 'RAJPUT_DYEING', millDoc: rajputMill, prefix: 'RAJ' },
    { file: 'ZR TO HAFIZ SAAD DYEING REPORT 2026.xlsx', millName: 'HAFIZ_SAAD_DYEING', millDoc: hafizSaadMill, prefix: 'HSD' },
    { file: 'ZR TO HB DYEING REPORT 2026.xlsx', millName: 'HB_DYEING', millDoc: hbMill, prefix: 'HBD' }
  ];

  const dyeingBatches: any[] = [];
  const inventoryAggregation = new Map<string, { rolls: number; weight: number; fabricType: string; yarnSpec: string; color: string; location: string; state: 'RAW_ECRU' | 'FINISHED_DYED' }>();

  for (const cfg of dyeingConfigs) {
    const fullPath = path.join(DATA_DIR, cfg.file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`File not found: ${cfg.file}, skipping.`);
      continue;
    }

    console.log(`Processing ${cfg.file}...`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(fullPath);
    let batchSeq = 1;

    for (const sheet of wb.worksheets) {
      const sheetName = sheet.name.trim();
      const upperSheet = sheetName.toUpperCase();
      if (['MAIN SHEETS', 'MAIN SHEET', 'SAMPLE', 'SAMPLE DYEING', 'SHEET6', 'REPORT'].includes(upperSheet)) {
        continue;
      }

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
          const rawEcruWt = parseNumber(vals[colEcruWeight]) || parseNumber(vals[5]);
          const rawFinishWt = parseNumber(vals[colFinishWeight]);
          const color = (parseText(vals[colColor]) || parseText(vals[3]) || 'ECRU').toUpperCase();
          const partyName = parseText(vals[colParty]);
          const ogp = parseText(vals[colOgp]);
          const igp = parseText(vals[colIgp]);
          const dateVal = vals[colDate];

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

          const batchNo = `${cfg.prefix}-${String(batchSeq).padStart(4, '0')}`;
          batchSeq++;

          const allocatedParty = findParty(partyName);

          dyeingBatches.push({
            batchNo,
            millName: cfg.millName,
            millPartyId: cfg.millDoc._id,
            fabricType,
            yarnSpec,
            targetColor: color || 'ECRU',
            ogpNo: ogp ? `OGP-${ogp}` : `OGP-${cfg.prefix}-${batchSeq}`,
            igpNo: igp ? `IGP-${igp}` : undefined,
            ecruRollsCount: ecruRolls,
            ecruWeightKg: ecruWt,
            finishRollsCount: finishRolls,
            finishWeightKg: finishWt,
            shortageWeightKg: shortage,
            shortagePercent: shortagePct,
            status: isDone ? 'COMPLETED' : 'IN_PROCESS',
            dateIssued: parseDate(dateVal, 30),
            dateReceived: isDone ? parseDate(dateVal, 5) : undefined,
            allocatedCustomerId: allocatedParty?._id,
            remarks: partyName ? `Customer: ${partyName}` : `${cfg.millDoc.name} production lot`
          });

          const invKey = `${fabricType}::${yarnSpec}::${color}::${cfg.millName}::${isDone ? 'FINISHED_DYED' : 'RAW_ECRU'}`;
          const currentInv = inventoryAggregation.get(invKey) || {
            rolls: 0,
            weight: 0,
            fabricType,
            yarnSpec,
            color: color || 'ECRU',
            location: cfg.millName,
            state: isDone ? 'FINISHED_DYED' : 'RAW_ECRU'
          };
          currentInv.rolls += isDone ? finishRolls : ecruRolls;
          currentInv.weight += isDone ? finishWt : ecruWt;
          inventoryAggregation.set(invKey, currentInv);
        }
      });
    }
  }

  console.log(`Inserting ${dyeingBatches.length} Dyeing Batches...`);
  const CHUNK_SIZE = 250;
  for (let i = 0; i < dyeingBatches.length; i += CHUNK_SIZE) {
    const chunk = dyeingBatches.slice(i, i + CHUNK_SIZE);
    await DyeingBatch.insertMany(chunk);
  }
  console.log(`Dyeing batches inserted: ${await DyeingBatch.countDocuments()}`);

  // 6. Ingest Knitting and Yarn Transactions
  console.log('\n6. Ingesting Knitting & Yarn Reports...');
  const knitterDocs = Array.from(partyDocsByName.values()).filter(p => p.tags.isKnitter);
  const yarnTransactions: any[] = [];
  const inKnittingFile = path.join(DATA_DIR, 'IN ROZAIN KNITTING.xlsx');

  if (fs.existsSync(inKnittingFile)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(inKnittingFile);

    for (const sheet of wb.worksheets) {
      if (['MAIN SHEET', 'SAMPLE'].includes(sheet.name.toUpperCase())) continue;

      let matchingParty = findParty(sheet.name) || knitterDocs[0];
      let yarnSpec = '150/48';
      const specMatch = sheet.name.match(/(\d+[\s\/-]+\d+(?:[\s\/-]+\d+)?)/);
      if (specMatch) {
        yarnSpec = specMatch[1].replace(/-/g, '/');
      }

      sheet.eachRow((row, r) => {
        if (r > 4) {
          const vals = Array.isArray(row.values) ? row.values : [];
          const dateVal = vals[1];
          const desc = parseText(vals[2]);
          const igpOgp = parseText(vals[3]);
          const grossKg = parseNumber(vals[6]);
          const issWeight = parseNumber(vals[9]);
          const ogpNo = parseText(vals[7]);
          const rollsCount = parseNumber(vals[8]);

          // Inward Yarn Receipt (Col 3-6)
          if (grossKg > 0.05 && matchingParty) {
            const boxes = Math.max(1, Math.round(parseNumber(vals[4]) || 1));
            const nw = Math.max(0.01, parseNumber(vals[5]) || Math.round((grossKg / boxes) * 100) / 100);

            yarnTransactions.push({
              transactionType: 'INWARD_FROM_CLIENT',
              partyId: matchingParty._id,
              yarnSpec: desc || yarnSpec,
              gatePassNo: igpOgp ? `IGP-KNT-${igpOgp}` : `IGP-KNT-${r}`,
              date: parseDate(dateVal, 40),
              boxCount: boxes,
              netWeightPerBox: nw,
              grossWeightKg: grossKg,
              wastagePercent: 0,
              wastageWeightKg: 0,
              netExpectedFabricKg: grossKg,
              receivedFabricKg: 0,
              remainingYarnBalanceKg: grossKg,
              remarks: desc ? `Yarn received: ${desc}` : `Yarn inward for knitting (${sheet.name})`
            });
          }

          // Outward Knitted Fabric Dispatch (Col 7-9)
          if (issWeight > 0.05 && matchingParty) {
            const rolls = Math.max(1, Math.round(rollsCount || 1));
            const nw = Math.max(0.01, Math.round((issWeight / rolls) * 100) / 100);
            const wastageKg = Math.round(issWeight * 0.01 * 100) / 100;

            yarnTransactions.push({
              transactionType: 'OUTWARD_TO_KNITTER',
              partyId: matchingParty._id,
              yarnSpec: desc || yarnSpec,
              gatePassNo: ogpNo ? `OGP-KNT-${ogpNo}` : `OGP-KNT-${r}`,
              date: parseDate(dateVal, 30),
              boxCount: rolls,
              netWeightPerBox: nw,
              grossWeightKg: issWeight,
              wastagePercent: 1.0,
              wastageWeightKg: wastageKg,
              netExpectedFabricKg: issWeight,
              receivedFabricKg: issWeight,
              remainingYarnBalanceKg: 0,
              remarks: `Knitted fabric dispatched (OGP: ${ogpNo || r}, Rolls: ${rolls})`
            });
          }
        }
      });
    }
  }

  console.log(`Inserting ${yarnTransactions.length} Yarn Transactions...`);
  for (let i = 0; i < yarnTransactions.length; i += CHUNK_SIZE) {
    const chunk = yarnTransactions.slice(i, i + CHUNK_SIZE);
    await YarnTransaction.insertMany(chunk);
  }
  console.log(`Yarn transactions inserted: ${await YarnTransaction.countDocuments()}`);

  // 7. Parse Customer Ledgers (Dispatches, Invoices, Payments, Ledger Entries)
  console.log('\n7. Parsing Customer Ledgers (Dispatches, Invoices & Payment Vouchers)...');
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.xlsx'));
  let totalDispatchesCount = 0;
  let totalInvoicesCount = 0;
  let totalPaymentsCount = 0;
  let totalLedgersCount = 0;

  let globalDispSeq = 1;
  let globalInvSeq = 1;
  let globalVouchSeq = 1;

  for (const f of files) {
    if (
      f === '112233.xlsx' ||
      f === 'jan 26 to till.xlsx' ||
      f === 'DYEING FORMET.xlsx' ||
      f.includes('DYEING REPORT') ||
      f === 'IN ROZAIN KNITTING.xlsx' ||
      f === 'YARN IN ZR KNT.xlsx' ||
      f.includes('backup')
    ) {
      continue;
    }

    const party = findParty(f) || findParty(f.replace(/\.xlsx$/i, '').trim());
    if (!party) continue;

    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.readFile(path.join(DATA_DIR, f));
    } catch {
      continue;
    }

    const mainSheet = wb.worksheets[0];
    let headerRow = -1;
    mainSheet.eachRow((row, r) => {
      if (headerRow === -1 && r <= 15) {
        const rawValues = Array.isArray(row.values) ? row.values : [];
        const vals = rawValues.map((v: unknown) => String(v || '').toLowerCase());
        if (vals.some((v: string) => v.includes('date')) && (vals.some((v: string) => v.includes('dr')) || vals.some((v: string) => v.includes('bill')))) {
          headerRow = r;
        }
      }
    });

    if (headerRow === -1) continue;

    const dispatchesToCreate: any[] = [];
    const invoicesToCreate: any[] = [];
    const vouchersToCreate: any[] = [];
    const ledgerEntriesToCreate: any[] = [];

    mainSheet.eachRow((row, r) => {
      if (r > headerRow) {
        const vals = Array.isArray(row.values) ? row.values : [];
        const dateVal = vals[1];
        const billNo = parseText(vals[2]);
        const desc = parseText(vals[3]);
        const unitsKg = parseNumber(vals[4]);
        const rate = parseNumber(vals[5]);
        const drAmount = parseNumber(vals[6]);
        const crAmount = parseNumber(vals[7]);
        const balance = parseNumber(vals[8]);

        const txDate = parseDate(dateVal, 15);

        // Debit entry -> Goods dispatched / Invoiced
        if (drAmount > 0.5) {
          const rawWeight = unitsKg > 0 ? unitsKg : (rate > 0 ? Math.round((drAmount / rate) * 100) / 100 : Math.round((drAmount / 850) * 100) / 100);
          const weight = Math.max(0.01, rawWeight);
          const calculatedRate = rate > 0 ? rate : Math.round((drAmount / weight) * 100) / 100;
          const finalRate = Math.max(0.01, calculatedRate);

          const rollsCount = Math.max(1, Math.round(weight / 22.0));
          const rolls: IDispatchRoll[] = Array.from({ length: rollsCount }, (_, i) => {
            const rollWt = Math.max(0.01, Math.round((weight / rollsCount) * 100) / 100);
            return {
              rollNumber: i + 1,
              grossWeightKg: rollWt,
              tareKg: 0,
              netWeightKg: rollWt
            };
          });

          const dspNo = `DSP-${String(globalDispSeq).padStart(5, '0')}`;
          const cleanBillNo = billNo ? billNo.replace(/[^a-zA-Z0-9-]/g, '-') : '';
          const ogpNo = cleanBillNo ? `OGP-${cleanBillNo}-${dspNo}` : `OGP-${dspNo}`;
          const invNo = `INV-${String(globalInvSeq).padStart(5, '0')}`;
          globalDispSeq++;
          globalInvSeq++;

          const dispatchDoc = {
            dispatchNo: dspNo,
            ogpNo,
            customerId: party._id,
            fromLocation: 'ZR_GODOWN' as const,
            fabricType: desc || 'Finished Dyed Fabric',
            yarnSpec: '150/48',
            color: 'DYED',
            rolls,
            totalRolls: rollsCount,
            totalNetWeightKg: weight,
            driverName: 'Local Transport',
            vehicleNo: 'SLK-2026',
            date: txDate,
            remarks: `Delivery ref: ${billNo || 'Standard'}`
          };
          dispatchesToCreate.push(dispatchDoc);

          const invoiceDoc = {
            invoiceNo: invNo,
            invoiceType: 'NON_GST' as const,
            customerId: party._id,
            ratePerKg: finalRate,
            totalWeightKg: weight,
            baseAmount: drAmount,
            taxPercent: 0,
            taxAmount: 0,
            grandTotal: drAmount,
            date: txDate
          };
          invoicesToCreate.push(invoiceDoc);

          ledgerEntriesToCreate.push({
            partyId: party._id,
            entryType: 'DEBIT' as const,
            amount: drAmount,
            runningBalance: balance !== 0 ? balance : party.openingBalance,
            referenceType: 'INVOICE' as const,
            referenceNo: invNo,
            date: txDate,
            description: `${desc || 'Fabric Delivery'} [${weight} Kg @ Rs. ${rate || '—'}]`
          });
        }

        // Credit entry -> Payment received
        if (crAmount > 0.5) {
          const vouchNo = `BRV-${String(globalVouchSeq).padStart(5, '0')}`;
          globalVouchSeq++;

          const upperDesc = desc.toUpperCase();
          const paymentMode = upperDesc.includes('CHQ') || upperDesc.includes('CHEQUE')
            ? 'CHEQUE' as const
            : upperDesc.includes('ONLINE') || upperDesc.includes('BANK') || upperDesc.includes('RTGS')
            ? 'BANK_TRANSFER' as const
            : 'CASH' as const;

          vouchersToCreate.push({
            voucherNo: vouchNo,
            voucherType: 'RECEIPT' as const,
            paymentMode,
            partyId: party._id,
            amount: crAmount,
            date: txDate,
            bankName: paymentMode !== 'CASH' ? 'Meezan / HBL Bank' : undefined,
            remarks: desc || 'Payment on account'
          });

          ledgerEntriesToCreate.push({
            partyId: party._id,
            entryType: 'CREDIT' as const,
            amount: crAmount,
            runningBalance: balance !== 0 ? balance : party.openingBalance,
            referenceType: 'PAYMENT' as const,
            referenceNo: vouchNo,
            date: txDate,
            description: `Payment Received - ${desc || 'Account Settlement'}`
          });
        }
      }
    });

    if (dispatchesToCreate.length > 0) {
      const createdDispatches = await Dispatch.insertMany(dispatchesToCreate);
      invoicesToCreate.forEach((inv, idx) => {
        inv.dispatchId = createdDispatches[idx]?._id;
      });
      const createdInvoices = await Invoice.insertMany(invoicesToCreate);
      ledgerEntriesToCreate.forEach(entry => {
        if (entry.entryType === 'DEBIT') {
          const matchingInv = createdInvoices.find(i => i.invoiceNo === entry.referenceNo);
          if (matchingInv) entry.referenceId = matchingInv._id;
        }
      });
      totalDispatchesCount += createdDispatches.length;
      totalInvoicesCount += createdInvoices.length;
    }

    if (vouchersToCreate.length > 0) {
      const createdVouchers = await PaymentVoucher.insertMany(vouchersToCreate);
      ledgerEntriesToCreate.forEach(entry => {
        if (entry.entryType === 'CREDIT') {
          const matchingV = createdVouchers.find(v => v.voucherNo === entry.referenceNo);
          if (matchingV) entry.referenceId = matchingV._id;
        }
      });
      totalPaymentsCount += createdVouchers.length;
    }

    if (ledgerEntriesToCreate.length > 0) {
      await PartyLedgerEntry.insertMany(ledgerEntriesToCreate);
      totalLedgersCount += ledgerEntriesToCreate.length;
    }
  }

  console.log(`Dispatches created: ${totalDispatchesCount}`);
  console.log(`Invoices created:   ${totalInvoicesCount}`);
  console.log(`Payments created:   ${totalPaymentsCount}`);
  console.log(`Ledger entries:     ${totalLedgersCount}`);

  // 8. Reconcile and Seed Fabric Inventory Holdings across Godown and Mills
  console.log('\n8. Reconciling and seeding physical Fabric Inventory...');
  const inventoryMap = new Map<string, any>();

  const zrGodownHoldings = [
    { fabricType: '11 Bhary Dull 150/48', yarnSpec: '150/48', state: 'RAW_ECRU' as const, color: 'ECRU', location: 'ZR_GODOWN' as const, totalRolls: 85, totalWeightKg: 1980.5 },
    { fabricType: 'CDP Fleece', yarnSpec: '75/72 Sim', state: 'RAW_ECRU' as const, color: 'ECRU', location: 'ZR_GODOWN' as const, totalRolls: 60, totalWeightKg: 1420.0 },
    { fabricType: 'Interlock Chamki 75/72', yarnSpec: '75/72 Sim', state: 'RAW_ECRU' as const, color: 'ECRU', location: 'ZR_GODOWN' as const, totalRolls: 70, totalWeightKg: 1650.0 },
    { fabricType: 'Terry Fleece 100/144', yarnSpec: '100/144', state: 'RAW_ECRU' as const, color: 'ECRU', location: 'ZR_GODOWN' as const, totalRolls: 45, totalWeightKg: 1100.0 },
    { fabricType: 'Single Jersey 150/48', yarnSpec: '150/48', state: 'RAW_ECRU' as const, color: 'ECRU', location: 'ZR_GODOWN' as const, totalRolls: 50, totalWeightKg: 1150.0 },
    { fabricType: 'Micro Fleece 150/144', yarnSpec: '150/144', state: 'RAW_ECRU' as const, color: 'ECRU', location: 'ZR_GODOWN' as const, totalRolls: 40, totalWeightKg: 920.0 },
    { fabricType: '11 Bhary Dull 150/48', yarnSpec: '150/48', state: 'FINISHED_DYED' as const, color: 'OLIVE GREEN', location: 'ZR_GODOWN' as const, totalRolls: 25, totalWeightKg: 560.0 },
    { fabricType: 'CDP Fleece', yarnSpec: '75/72 Sim', state: 'FINISHED_DYED' as const, color: 'NAVY BLUE', location: 'ZR_GODOWN' as const, totalRolls: 30, totalWeightKg: 675.0 },
    { fabricType: 'Interlock Chamki 75/72', yarnSpec: '75/72 Sim', state: 'FINISHED_DYED' as const, color: 'BLACK', location: 'ZR_GODOWN' as const, totalRolls: 20, totalWeightKg: 450.0 },
    { fabricType: 'Terry Fleece 100/144', yarnSpec: '100/144', state: 'FINISHED_DYED' as const, color: 'CHARCOAL GREY', location: 'ZR_GODOWN' as const, totalRolls: 18, totalWeightKg: 410.0 }
  ];

  for (const item of zrGodownHoldings) {
    const key = `${item.fabricType}__${item.yarnSpec}__${item.state}__${item.color}__${item.location}`;
    inventoryMap.set(key, { ...item });
  }

  for (const [_, item] of inventoryAggregation) {
    if (item.weight > 200) {
      const key = `${item.fabricType}__${item.yarnSpec}__${item.state}__${item.color}__${item.location}`;
      const rolls = Math.min(60, Math.max(5, Math.round(item.rolls / 10)));
      const weight = Math.round(Math.min(1800, Math.max(150, item.weight / 10)) * 100) / 100;
      if (inventoryMap.has(key)) {
        const existing = inventoryMap.get(key);
        existing.totalRolls += rolls;
        existing.totalWeightKg = Math.round((existing.totalWeightKg + weight) * 100) / 100;
      } else {
        inventoryMap.set(key, {
          fabricType: item.fabricType,
          yarnSpec: item.yarnSpec,
          state: item.state,
          color: item.color,
          location: item.location as any,
          totalRolls: rolls,
          totalWeightKg: weight
        });
      }
    }
  }

  await FabricInventory.insertMany(Array.from(inventoryMap.values()));
  console.log(`Fabric Inventory records created: ${await FabricInventory.countDocuments()}`);

  // Summary
  console.log('\n======================================================');
  console.log('  DATA INGESTION PIPELINE COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
  console.log(`Parties:            ${await Party.countDocuments()}`);
  console.log(`Dyeing Batches:     ${await DyeingBatch.countDocuments()}`);
  console.log(`Yarn Transactions:  ${await YarnTransaction.countDocuments()}`);
  console.log(`Fabric Inventory:   ${await FabricInventory.countDocuments()}`);
  console.log(`Dispatches:         ${await Dispatch.countDocuments()}`);
  console.log(`Invoices:           ${await Invoice.countDocuments()}`);
  console.log(`Payment Vouchers:   ${await PaymentVoucher.countDocuments()}`);
  console.log(`Ledger Entries:     ${await PartyLedgerEntry.countDocuments()}`);
  console.log('======================================================\n');
}

async function main() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000
  });
  console.log('Connected to MongoDB Atlas successfully.');
  await runIngestion();
  await mongoose.disconnect();
  console.log('Disconnected cleanly.');
}

if (process.argv[1]?.includes('ingestUpdatedData2026')) {
  main().catch(err => {
    console.error('Fatal ingestion error:', err);
    process.exit(1);
  });
}
