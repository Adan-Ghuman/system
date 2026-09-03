import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { Party } from '../models/Party.js';
import { FabricInventory } from '../models/FabricInventory.js';
import { DyeingBatch } from '../models/DyeingBatch.js';
import { YarnTransaction } from '../models/YarnTransaction.js';
import { Dispatch } from '../models/Dispatch.js';
import { Invoice } from '../models/Invoice.js';
import { PartyLedgerEntry } from '../models/PartyLedgerEntry.js';
import { PaymentVoucher } from '../models/PaymentVoucher.js';

const RAZA_DIR = path.resolve(process.cwd(), '../Raza');

export async function seedRazaData(): Promise<{ partiesCount: number; batchesCount: number; inventoryCount: number }> {
  const targetDir = fs.existsSync(RAZA_DIR)
    ? RAZA_DIR
    : path.resolve('C:/Users/adang/OneDrive/Documents/Personal Project/Ghuman_system/Raza');

  if (!fs.existsSync(targetDir)) {
    return { partiesCount: 0, batchesCount: 0, inventoryCount: 0 };
  }

  const existingCount = await Party.countDocuments({ code: { $nin: ['PRT-001', 'PRT-002'] } });
  if (existingCount > 5) {
    return {
      partiesCount: existingCount,
      batchesCount: await DyeingBatch.countDocuments(),
      inventoryCount: await FabricInventory.countDocuments()
    };
  }

  let nextCodeNum = 3;
  function getNextCode(): string {
    const code = `PRT-${nextCodeNum.toString().padStart(3, '0')}`;
    nextCodeNum++;
    return code;
  }

  const partiesMap = new Map<string, any>();

  const masterPartiesFile = path.join(targetDir, '112233.xlsx');
  if (fs.existsSync(masterPartiesFile)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(masterPartiesFile);
    const sheet = wb.worksheets[0];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 2) {
        const vals = Array.isArray(row.values) ? row.values : [];
        const rawName = vals[2] as unknown;
        let name = '';
        if (typeof rawName === 'string') {
          name = rawName.trim();
        } else if (rawName && typeof rawName === 'object' && 'text' in rawName) {
          name = String((rawName as { text: unknown }).text || '').trim();
        }

        if (name && name !== 'TOTALL AMOUNT') {
          const phone = vals[3] ? String(vals[3]).trim() : '';
          let debit = 0;
          let credit = 0;

          const rawDebit = vals[4] as unknown;
          const rawCredit = vals[5] as unknown;

          if (typeof rawDebit === 'number') {
            debit = rawDebit;
          } else if (rawDebit && typeof rawDebit === 'object' && 'result' in rawDebit && typeof (rawDebit as { result: unknown }).result === 'number') {
            debit = (rawDebit as { result: number }).result;
          }

          if (typeof rawCredit === 'number') {
            credit = rawCredit;
          } else if (rawCredit && typeof rawCredit === 'object' && 'result' in rawCredit && typeof (rawCredit as { result: unknown }).result === 'number') {
            credit = (rawCredit as { result: number }).result;
          }

          const upper = name.toUpperCase();
          const isDyeingMill = upper.includes('DYEING');
          const isKnitter = upper.includes('KNITTING') || upper.includes('KNT');
          const isFabricBuyer = !isDyeingMill && (debit > 0 || !isKnitter);
          const isYarnClient = upper.includes('TRADER') || upper.includes('YARN');

          const netBalance = Math.round((debit + credit) * 100) / 100;

          partiesMap.set(upper, {
            name,
            phone,
            tags: { isFabricBuyer, isKnitter, isDyeingMill, isYarnClient },
            openingBalance: netBalance,
            currentBalance: netBalance
          });
        }
      }
    });
  }

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
    'Ginza Industry'
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

  const buyerNames = [
    'Sheikh of Sialkot',
    'City Sports KNT',
    'Al-Madina Fabrics',
    'Subhan Garments Sialkot',
    'Forward Sports Sub-Contractor'
  ];

  for (const bName of buyerNames) {
    const upper = bName.toUpperCase();
    if (!partiesMap.has(upper)) {
      partiesMap.set(upper, {
        name: bName,
        phone: '0321-4455667',
        tags: { isFabricBuyer: true, isKnitter: false, isDyeingMill: false, isYarnClient: false },
        openingBalance: 250000,
        currentBalance: 250000
      });
    }
  }

  const savedParties: any[] = [];

  for (const [_, pData] of partiesMap) {
    const existing = await Party.findOne({ name: pData.name });
    if (!existing) {
      const code = getNextCode();
      const party = await Party.create({
        code,
        name: pData.name,
        contactPerson: pData.name.split(' ')[0] + ' Sb',
        phone: pData.phone || '0300-1234567',
        address: 'Sialkot Industrial Zone, Pakistan',
        tags: pData.tags,
        openingBalance: pData.openingBalance,
        currentBalance: pData.currentBalance,
        isActive: true
      });
      savedParties.push(party);
    } else {
      savedParties.push(existing);
    }
  }

  const activeKnitters = savedParties.filter((p) => p.tags.isKnitter);
  const activeBuyers = savedParties.filter((p) => p.tags.isFabricBuyer);

  if (activeKnitters.length > 0) {
    for (let i = 0; i < Math.min(activeKnitters.length, 6); i++) {
      const k = activeKnitters[i];
      const grossKg = 2268;
      const wastageKg = 22.68;
      const expectedKg = 2245.32;

      await YarnTransaction.create({
        transactionType: 'OUTWARD_TO_KNITTER',
        partyId: k._id,
        yarnSpec: i % 2 === 0 ? '75/72 Sim' : '150/48',
        brand: 'Rupali Polyester',
        lotNo: `LOT-RZ-${100 + i}`,
        gatePassNo: `OGP-YARN-${100 + i}`,
        date: new Date(Date.now() - (30 - i * 4) * 24 * 60 * 60 * 1000),
        boxCount: 50,
        netWeightPerBox: 45.36,
        grossWeightKg: grossKg,
        wastagePercent: 1.0,
        wastageWeightKg: wastageKg,
        netExpectedFabricKg: expectedKg,
        remainingYarnBalanceKg: i === 0 ? 0 : 450.0,
        remarks: `Standard yarn issue to ${k.name}`
      });
    }
  }

  const inventoryHoldings = [
    {
      fabricType: '11 Bhary Dull 150/48',
      yarnSpec: '150/48',
      state: 'RAW_ECRU',
      color: 'ECRU',
      location: 'ZR_GODOWN',
      totalRolls: 85,
      totalWeightKg: 1980.5
    },
    {
      fabricType: 'CDP Fleece',
      yarnSpec: '75/72 Sim',
      state: 'RAW_ECRU',
      color: 'ECRU',
      location: 'ZR_GODOWN',
      totalRolls: 60,
      totalWeightKg: 1420.0
    },
    {
      fabricType: 'Interlock Chamki 75/72',
      yarnSpec: '75/72 Sim',
      state: 'RAW_ECRU',
      color: 'ECRU',
      location: 'ZR_GODOWN',
      totalRolls: 70,
      totalWeightKg: 1650.0
    },
    {
      fabricType: 'Terry Fleece 100/144',
      yarnSpec: '100/144',
      state: 'RAW_ECRU',
      color: 'ECRU',
      location: 'ZR_GODOWN',
      totalRolls: 45,
      totalWeightKg: 1100.0
    },
    {
      fabricType: 'Single Jersey 150/48',
      yarnSpec: '150/48',
      state: 'RAW_ECRU',
      color: 'ECRU',
      location: 'ZR_GODOWN',
      totalRolls: 50,
      totalWeightKg: 1150.0
    },
    {
      fabricType: 'Micro Fleece 150/144',
      yarnSpec: '150/144',
      state: 'RAW_ECRU',
      color: 'ECRU',
      location: 'ZR_GODOWN',
      totalRolls: 40,
      totalWeightKg: 920.0
    },
    {
      fabricType: '11 Bhary Dull 150/48',
      yarnSpec: '150/48',
      state: 'FINISHED_DYED',
      color: 'OLIVE GREEN',
      location: 'GHUMMAN_DYEING',
      totalRolls: 35,
      totalWeightKg: 785.4
    },
    {
      fabricType: '11 Bhary Dull 150/48',
      yarnSpec: '150/48',
      state: 'FINISHED_DYED',
      color: 'BROWN',
      location: 'GHUMMAN_DYEING',
      totalRolls: 28,
      totalWeightKg: 640.2
    },
    {
      fabricType: 'CDP Fleece',
      yarnSpec: '75/72 Sim',
      state: 'FINISHED_DYED',
      color: 'NAVY BLUE',
      location: 'GHUMMAN_DYEING',
      totalRolls: 42,
      totalWeightKg: 950.0
    },
    {
      fabricType: 'Interlock Chamki 75/72',
      yarnSpec: '75/72 Sim',
      state: 'FINISHED_DYED',
      color: 'BLACK',
      location: 'GHUMMAN_DYEING',
      totalRolls: 50,
      totalWeightKg: 1120.0
    },
    {
      fabricType: 'Terry Fleece 100/144',
      yarnSpec: '100/144',
      state: 'FINISHED_DYED',
      color: 'JET BLACK',
      location: 'RAJPUT_DYEING',
      totalRolls: 38,
      totalWeightKg: 890.0
    },
    {
      fabricType: 'Micro Fleece 150/144',
      yarnSpec: '150/144',
      state: 'FINISHED_DYED',
      color: 'CHARCOAL GREY',
      location: 'RAJPUT_DYEING',
      totalRolls: 30,
      totalWeightKg: 680.0
    },
    {
      fabricType: '11 Bhary Dull 150/48',
      yarnSpec: '150/48',
      state: 'FINISHED_DYED',
      color: 'OLIVE GREEN',
      location: 'ZR_GODOWN',
      totalRolls: 25,
      totalWeightKg: 560.0
    },
    {
      fabricType: 'CDP Fleece',
      yarnSpec: '75/72 Sim',
      state: 'FINISHED_DYED',
      color: 'NAVY BLUE',
      location: 'ZR_GODOWN',
      totalRolls: 30,
      totalWeightKg: 675.0
    },
    {
      fabricType: 'Interlock Chamki 75/72',
      yarnSpec: '75/72 Sim',
      state: 'FINISHED_DYED',
      color: 'BLACK',
      location: 'ZR_GODOWN',
      totalRolls: 20,
      totalWeightKg: 450.0
    }
  ];

  for (const inv of inventoryHoldings) {
    await FabricInventory.findOneAndUpdate(
      {
        fabricType: inv.fabricType,
        yarnSpec: inv.yarnSpec,
        state: inv.state,
        color: inv.color,
        location: inv.location
      },
      {
        $set: {
          totalRolls: inv.totalRolls,
          totalWeightKg: inv.totalWeightKg
        }
      },
      { upsert: true, new: true }
    );
  }

  const existingBatches = await DyeingBatch.countDocuments();
  if (existingBatches === 0) {
    const historicalBatches = [
      {
        batchNo: 'BATCH-001',
        millName: 'GHUMMAN_DYEING',
        fabricType: '11 Bhary Dull 150/48',
        yarnSpec: '150/48',
        targetColor: 'OLIVE GREEN',
        ogpNo: 'OGP-DYE-087',
        ecruRollsCount: 38,
        ecruWeightKg: 823.5,
        finishRollsCount: 38,
        finishWeightKg: 806.0,
        shortageWeightKg: 17.5,
        shortagePercent: 2.12,
        igpNo: 'IGP-GHUM-087',
        status: 'COMPLETED',
        remarks: 'Normal dyeing loss'
      },
      {
        batchNo: 'BATCH-002',
        millName: 'GHUMMAN_DYEING',
        fabricType: 'CDP Fleece',
        yarnSpec: '75/72 Sim',
        targetColor: 'NAVY BLUE',
        ogpNo: 'OGP-DYE-972',
        ecruRollsCount: 45,
        ecruWeightKg: 980.0,
        finishRollsCount: 44,
        finishWeightKg: 948.5,
        shortageWeightKg: 31.5,
        shortagePercent: 3.21,
        igpNo: 'IGP-GHUM-972',
        status: 'COMPLETED',
        remarks: 'Standard processing loss'
      },
      {
        batchNo: 'BATCH-003',
        millName: 'RAJPUT_DYEING',
        fabricType: 'Terry Fleece 100/144',
        yarnSpec: '100/144',
        targetColor: 'JET BLACK',
        ogpNo: 'OGP-RAJ-1096',
        ecruRollsCount: 40,
        ecruWeightKg: 920.0,
        finishRollsCount: 39,
        finishWeightKg: 888.5,
        shortageWeightKg: 31.5,
        shortagePercent: 3.42,
        igpNo: 'IGP-RAJ-1096',
        status: 'COMPLETED',
        remarks: 'Good finish quality'
      },
      {
        batchNo: 'BATCH-004',
        millName: 'GHUMMAN_DYEING',
        fabricType: 'Interlock Chamki 75/72',
        yarnSpec: '75/72 Sim',
        targetColor: 'ROYAL BLUE',
        ogpNo: 'OGP-DYE-1122',
        ecruRollsCount: 30,
        ecruWeightKg: 690.0,
        status: 'IN_PROCESS',
        remarks: 'Currently in dyeing kettle'
      }
    ];

    for (const b of historicalBatches) {
      await DyeingBatch.create({
        batchNo: b.batchNo,
        millName: b.millName as any,
        fabricType: b.fabricType,
        yarnSpec: b.yarnSpec,
        targetColor: b.targetColor,
        ogpNo: b.ogpNo,
        ecruRollsCount: b.ecruRollsCount,
        ecruWeightKg: b.ecruWeightKg,
        finishRollsCount: b.finishRollsCount,
        finishWeightKg: b.finishWeightKg,
        shortageWeightKg: b.shortageWeightKg,
        shortagePercent: b.shortagePercent,
        igpNo: b.igpNo,
        status: b.status as any,
        dateIssued: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        dateReceived: b.status === 'COMPLETED' ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) : undefined,
        remarks: b.remarks
      });
    }
  }

  const topBuyer = activeBuyers[0] || savedParties[0];
  const secondBuyer = activeBuyers[1] || savedParties[1];

  const existingDispatches = await Dispatch.countDocuments();
  if (existingDispatches === 0 && topBuyer && secondBuyer) {
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

  return {
    partiesCount: savedParties.length,
    batchesCount: await DyeingBatch.countDocuments(),
    inventoryCount: await FabricInventory.countDocuments()
  };
}
