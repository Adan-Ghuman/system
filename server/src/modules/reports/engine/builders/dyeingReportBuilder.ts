import ExcelJS from 'exceljs';
import { COLORS, FONTS, BORDERS, NUMBER_FORMATS, autoFitColumns } from '../excelStyles.js';

export interface DyeingBatchReportItem {
  batchNo: string;
  millName: string;
  customMillName?: string;
  fabricType: string;
  yarnSpec: string;
  targetColor: string;
  igpNo?: string;
  ogpNo?: string;
  dateIssued: Date;
  dateReceived?: Date;
  ecruRollsCount: number;
  ecruWeightKg: number;
  finishRollsCount?: number;
  finishWeightKg?: number;
  shortageWeightKg?: number;
  shortagePercent?: number;
  customerName?: string;
  status: string;
  remarks?: string;
}

export interface DyeingReportData {
  millName: string;
  dateFrom?: string;
  dateTo?: string;
  batches: DyeingBatchReportItem[];
}

export function buildDyeingMillReportWorkbook(data: DyeingReportData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rozain Textile ERP';
  wb.created = new Date();

  // Group batches by Fabric Variety (FabricType + YarnSpec)
  const groupedByFabric = new Map<string, DyeingBatchReportItem[]>();
  data.batches.forEach((b) => {
    const key = `${b.fabricType} ${b.yarnSpec}`.trim();
    if (!groupedByFabric.has(key)) {
      groupedByFabric.set(key, []);
    }
    groupedByFabric.get(key)!.push(b);
  });

  // 1. MAIN SUMMARY SHEET
  const summaryWs = wb.addWorksheet('MAIN SHEET', {
    views: [{ showGridLines: true }]
  });

  summaryWs.mergeCells('A1:F1');
  const mainTitle = summaryWs.getCell('A1');
  mainTitle.value = data.millName.replace(/_/g, ' ') + ' - PRODUCTION & SHORTAGE AUDIT';
  mainTitle.font = FONTS.brandTitle;

  summaryWs.mergeCells('A2:F2');
  summaryWs.getCell('A2').value = `Period: ${data.dateFrom || 'All Records'} to ${data.dateTo || 'Present'} | Generated: ${new Date().toLocaleDateString()}`;
  summaryWs.getCell('A2').font = FONTS.metaLabel;

  const sumHeaders = ['SR.', 'FABRIC VARIETY & SPEC', 'TOTAL LOTS', 'ECRU WEIGHT (KG)', 'FINISH WEIGHT (KG)', 'NET SHORTAGE (KG)', 'AVG SHORTAGE %'];
  const sumHeaderRow = summaryWs.addRow(sumHeaders);
  sumHeaderRow.height = 24;
  sumHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.font = FONTS.tableHeader;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDERS.thinAll;
  });

  let sumSr = 1;
  let summaryStartRow = 4;
  let currentSummaryRow = 3;

  // We will populate summary rows as we build fabric sheets
  const summaryEntries: Array<{
    variety: string;
    sheetName: string;
    lots: number;
    ecru: number;
    finish: number;
    shortage: number;
  }> = [];

  const usedSheetNames = new Set<string>();
  usedSheetNames.add('main sheet');

  function getUniqueSheetName(baseName: string): string {
    let clean = baseName.trim().replace(/[:\\\/\?\*\[\]]/g, '-').replace(/\s+/g, ' ');
    if (clean.length > 25) {
      clean = clean.substring(0, 25).trim();
    }
    if (!clean) clean = 'Fabric';

    let candidate = clean;
    let counter = 1;
    while (usedSheetNames.has(candidate.toLowerCase())) {
      candidate = `${clean.substring(0, 25 - String(counter).length - 1)}-${counter}`;
      counter++;
    }
    usedSheetNames.add(candidate.toLowerCase());
    return candidate;
  }

  // 2. FABRIC SHEETS
  for (const [fabricKey, batches] of groupedByFabric.entries()) {
    const sheetName = getUniqueSheetName(fabricKey);

    const ws = wb.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
    });

    // Sheet Header
    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = `${data.millName.replace(/_/g, ' ')} — ${fabricKey}`;
    ws.getCell('A1').font = FONTS.reportTitle;

    ws.mergeCells('A2:F2');
    ws.getCell('A2').value = `Opp Hbl Bank Daska Road, Ghuinke Sialkot • Fabric Processing Log`;
    ws.getCell('A2').font = FONTS.metaLabel;

    const headers = [
      'Date',
      'IGP #',
      'OGP #',
      'Lot / Batch #',
      'Target Color',
      'Ecru Rolls',
      'Ecru Weight',
      'Finish Rolls',
      'Finish Weight',
      'Shortage (Kg)',
      'Loss %',
      'Party / Customer',
      'Remarks'
    ];

    const hRow = ws.addRow(headers);
    hRow.height = 24;
    hRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
      cell.font = FONTS.tableHeader;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = BORDERS.thinAll;
    });

    const dataStartRow = 4;
    let rIdx = 3;
    let totalEcru = 0;
    let totalFinish = 0;
    let totalShortage = 0;

    batches.forEach((b) => {
      rIdx++;
      const ecruWt = b.ecruWeightKg || 0;
      const finWt = b.finishWeightKg || 0;
      const shortWt = b.shortageWeightKg !== undefined ? b.shortageWeightKg : Math.max(0, ecruWt - finWt);

      totalEcru += ecruWt;
      totalFinish += finWt;
      totalShortage += shortWt;

      const formulaShortage = `G${rIdx}-I${rIdx}`;
      const formulaPercent = `IF(G${rIdx}>0, (J${rIdx}/G${rIdx})*100, 0)`;

      const row = ws.addRow([
        b.dateIssued ? new Date(b.dateIssued) : null,
        b.igpNo || '—',
        b.ogpNo || '—',
        b.batchNo,
        b.targetColor || 'ECRU',
        b.ecruRollsCount || null,
        ecruWt || null,
        b.finishRollsCount || null,
        finWt || null,
        { formula: formulaShortage, result: shortWt },
        { formula: formulaPercent, result: b.shortagePercent || 0 },
        b.customerName || 'Rozain Textile',
        b.remarks || ''
      ]);

      row.height = 19;
      row.getCell(1).numFmt = NUMBER_FORMATS.date;
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).font = FONTS.dataMono;
      row.getCell(3).font = FONTS.dataMono;
      row.getCell(4).font = FONTS.dataMono;
      row.getCell(5).font = FONTS.dataRegular;
      row.getCell(6).numFmt = NUMBER_FORMATS.integer;
      row.getCell(6).alignment = { horizontal: 'right' };
      row.getCell(7).numFmt = NUMBER_FORMATS.weight;
      row.getCell(7).alignment = { horizontal: 'right' };
      row.getCell(8).numFmt = NUMBER_FORMATS.integer;
      row.getCell(8).alignment = { horizontal: 'right' };
      row.getCell(9).numFmt = NUMBER_FORMATS.weight;
      row.getCell(9).alignment = { horizontal: 'right' };
      row.getCell(10).numFmt = NUMBER_FORMATS.weight;
      row.getCell(10).alignment = { horizontal: 'right' };
      row.getCell(11).numFmt = NUMBER_FORMATS.percent;
      row.getCell(11).alignment = { horizontal: 'right' };

      row.eachCell((cell) => {
        cell.border = BORDERS.thinAll;
      });
    });

    // Fabric Sheet Total Row
    const totRow = ws.addRow([
      null,
      null,
      null,
      'TOTALS',
      null,
      { formula: `SUM(F${dataStartRow}:F${rIdx})` },
      { formula: `SUM(G${dataStartRow}:G${rIdx})`, result: totalEcru },
      { formula: `SUM(H${dataStartRow}:H${rIdx})` },
      { formula: `SUM(I${dataStartRow}:I${rIdx})`, result: totalFinish },
      { formula: `SUM(J${dataStartRow}:J${rIdx})`, result: totalShortage },
      { formula: `IF(G${rIdx + 1}>0, (J${rIdx + 1}/G${rIdx + 1})*100, 0)` },
      null,
      null
    ]);

    totRow.height = 24;
    totRow.getCell(4).font = FONTS.totalRow;
    totRow.getCell(6).numFmt = NUMBER_FORMATS.integer;
    totRow.getCell(6).font = FONTS.totalRow;
    totRow.getCell(7).numFmt = NUMBER_FORMATS.weight;
    totRow.getCell(7).font = FONTS.totalRow;
    totRow.getCell(8).numFmt = NUMBER_FORMATS.integer;
    totRow.getCell(8).font = FONTS.totalRow;
    totRow.getCell(9).numFmt = NUMBER_FORMATS.weight;
    totRow.getCell(9).font = FONTS.totalRow;
    totRow.getCell(10).numFmt = NUMBER_FORMATS.weight;
    totRow.getCell(10).font = FONTS.totalRow;
    totRow.getCell(11).numFmt = NUMBER_FORMATS.percent;
    totRow.getCell(11).font = FONTS.totalRow;

    totRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
      cell.border = BORDERS.totalDouble;
    });

    autoFitColumns(ws);

    summaryEntries.push({
      variety: fabricKey,
      sheetName,
      lots: batches.length,
      ecru: totalEcru,
      finish: totalFinish,
      shortage: totalShortage
    });

    sumSr++;
  }

  // Populate MAIN SUMMARY SHEET rows
  summaryEntries.forEach((s, idx) => {
    currentSummaryRow++;
    const sRow = summaryWs.addRow([
      idx + 1,
      s.variety,
      s.lots,
      s.ecru,
      s.finish,
      s.shortage,
      s.ecru > 0 ? (s.shortage / s.ecru) * 100 : 0
    ]);

    sRow.height = 20;
    sRow.getCell(1).alignment = { horizontal: 'center' };
    sRow.getCell(2).font = FONTS.dataBold;
    sRow.getCell(3).numFmt = NUMBER_FORMATS.integer;
    sRow.getCell(3).alignment = { horizontal: 'right' };
    sRow.getCell(4).numFmt = NUMBER_FORMATS.weight;
    sRow.getCell(4).alignment = { horizontal: 'right' };
    sRow.getCell(5).numFmt = NUMBER_FORMATS.weight;
    sRow.getCell(5).alignment = { horizontal: 'right' };
    sRow.getCell(6).numFmt = NUMBER_FORMATS.weight;
    sRow.getCell(6).alignment = { horizontal: 'right' };
    sRow.getCell(7).numFmt = NUMBER_FORMATS.percent;
    sRow.getCell(7).alignment = { horizontal: 'right' };

    sRow.eachCell((cell) => {
      cell.border = BORDERS.thinAll;
    });
  });

  // Main Sheet Total Row
  if (summaryEntries.length > 0) {
    const sTotRow = summaryWs.addRow([
      null,
      'GRAND TOTALS',
      { formula: `SUM(C${summaryStartRow}:C${currentSummaryRow})` },
      { formula: `SUM(D${summaryStartRow}:D${currentSummaryRow})` },
      { formula: `SUM(E${summaryStartRow}:E${currentSummaryRow})` },
      { formula: `SUM(F${summaryStartRow}:F${currentSummaryRow})` },
      { formula: `IF(D${currentSummaryRow + 1}>0, (F${currentSummaryRow + 1}/D${currentSummaryRow + 1})*100, 0)` }
    ]);

    sTotRow.height = 24;
    sTotRow.getCell(2).font = FONTS.totalRow;
    sTotRow.getCell(3).font = FONTS.totalRow;
    sTotRow.getCell(4).font = FONTS.totalRow;
    sTotRow.getCell(4).numFmt = NUMBER_FORMATS.weight;
    sTotRow.getCell(5).font = FONTS.totalRow;
    sTotRow.getCell(5).numFmt = NUMBER_FORMATS.weight;
    sTotRow.getCell(6).font = FONTS.totalRow;
    sTotRow.getCell(6).numFmt = NUMBER_FORMATS.weight;
    sTotRow.getCell(7).font = FONTS.totalRow;
    sTotRow.getCell(7).numFmt = NUMBER_FORMATS.percent;

    sTotRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
      cell.border = BORDERS.totalDouble;
    });
  }

  autoFitColumns(summaryWs);

  return wb;
}
