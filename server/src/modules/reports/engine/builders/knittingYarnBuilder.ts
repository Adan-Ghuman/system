import ExcelJS from 'exceljs';
import { COLORS, FONTS, BORDERS, NUMBER_FORMATS, autoFitColumns } from '../excelStyles.js';

export interface KnittingReportItem {
  date: Date;
  knitterName: string;
  yarnSpec: string;
  gatePassNo: string;
  boxCount: number;
  netWeightPerBox: number;
  grossWeightKg: number;
  wastagePercent: number;
  wastageWeightKg: number;
  netExpectedFabricKg: number;
  receivedFabricKg: number;
  remainingYarnBalanceKg: number;
  remarks?: string;
}

export interface KnittingReportData {
  dateFrom?: string;
  dateTo?: string;
  items: KnittingReportItem[];
}

export function buildKnittingYarnWorkbook(data: KnittingReportData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rozain Textile ERP';
  wb.created = new Date();

  // Group by Knitter Name
  const grouped = new Map<string, KnittingReportItem[]>();
  data.items.forEach((item) => {
    const k = item.knitterName || 'GENERAL KNITTING';
    if (!grouped.has(k)) {
      grouped.set(k, []);
    }
    grouped.get(k)!.push(item);
  });

  // 1. MAIN SUMMARY SHEET
  const mainWs = wb.addWorksheet('MAIN SHEET', {
    views: [{ showGridLines: true }]
  });

  mainWs.mergeCells('A1:D1');
  const tCell = mainWs.getCell('A1');
  tCell.value = 'ROZAIN KNITTING — YARN IN STOCK REPORT';
  tCell.font = FONTS.brandTitle;

  mainWs.mergeCells('A2:D2');
  mainWs.getCell('A2').value = `Report Period: ${data.dateFrom || 'All Time'} to ${data.dateTo || 'Present'}`;
  mainWs.getCell('A2').font = FONTS.metaLabel;

  const mHeaders = ['SR.', 'KNITTER / ITEM NAME', 'TOTAL ISSUED (KG)', 'REMAINING YARN (KG)'];
  const mHRow = mainWs.addRow(mHeaders);
  mHRow.height = 24;
  mHRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.font = FONTS.tableHeader;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDERS.thinAll;
  });

  let mainSr = 1;
  let mainCurrentRow = 3;
  const mainStartRow = 4;

  const usedSheetNames = new Set<string>();
  usedSheetNames.add('main sheet');

  function getUniqueSheetName(baseName: string): string {
    let clean = baseName.trim().replace(/[:\\\/\?\*\[\]]/g, '-').replace(/\s+/g, ' ');
    if (clean.length > 25) {
      clean = clean.substring(0, 25).trim();
    }
    if (!clean) clean = 'Knitter';

    let candidate = clean;
    let counter = 1;
    while (usedSheetNames.has(candidate.toLowerCase())) {
      candidate = `${clean.substring(0, 25 - String(counter).length - 1)}-${counter}`;
      counter++;
    }
    usedSheetNames.add(candidate.toLowerCase());
    return candidate;
  }

  // 2. KNITTER SHEETS
  for (const [knitterName, rows] of grouped.entries()) {
    const sheetName = getUniqueSheetName(knitterName);

    const ws = wb.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
    });

    ws.mergeCells('A1:E1');
    ws.getCell('A1').value = `ROZAIN KNITTING — ${knitterName}`;
    ws.getCell('A1').font = FONTS.reportTitle;

    const headers = [
      'Date',
      'Yarn Spec / Detail',
      'OGP / Gate Pass',
      'Boxes / Bags',
      'Net Wt/Box',
      'Gross Wt (Kg)',
      'Wastage (Kg)',
      'Expected Fabric (Kg)',
      'Received Fabric (Kg)',
      'Remaining Balance (Kg)',
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

    const dStart = 3;
    let rIdx = 2;
    let knitterTotalIssued = 0;
    let knitterTotalBal = 0;

    rows.forEach((r) => {
      rIdx++;
      knitterTotalIssued += r.grossWeightKg || 0;
      knitterTotalBal += r.remainingYarnBalanceKg || 0;

      const row = ws.addRow([
        r.date ? new Date(r.date) : null,
        r.yarnSpec,
        r.gatePassNo || '—',
        r.boxCount || 0,
        r.netWeightPerBox || 0,
        r.grossWeightKg || 0,
        r.wastageWeightKg || 0,
        r.netExpectedFabricKg || 0,
        r.receivedFabricKg || 0,
        r.remainingYarnBalanceKg || 0,
        r.remarks || ''
      ]);

      row.height = 19;
      row.getCell(1).numFmt = NUMBER_FORMATS.date;
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).font = FONTS.dataBold;
      row.getCell(3).font = FONTS.dataMono;
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).numFmt = NUMBER_FORMATS.integer;
      row.getCell(4).alignment = { horizontal: 'right' };
      row.getCell(5).numFmt = NUMBER_FORMATS.weight;
      row.getCell(5).alignment = { horizontal: 'right' };
      row.getCell(6).numFmt = NUMBER_FORMATS.weight;
      row.getCell(6).alignment = { horizontal: 'right' };
      row.getCell(7).numFmt = NUMBER_FORMATS.weight;
      row.getCell(7).alignment = { horizontal: 'right' };
      row.getCell(8).numFmt = NUMBER_FORMATS.weight;
      row.getCell(8).alignment = { horizontal: 'right' };
      row.getCell(9).numFmt = NUMBER_FORMATS.weight;
      row.getCell(9).alignment = { horizontal: 'right' };
      row.getCell(10).numFmt = NUMBER_FORMATS.weight;
      row.getCell(10).alignment = { horizontal: 'right' };
      row.getCell(10).font = FONTS.dataBold;

      row.eachCell((cell) => {
        cell.border = BORDERS.thinAll;
      });
    });

    // Sheet Totals
    const totRow = ws.addRow([
      null,
      'TOTALS',
      null,
      { formula: `SUM(D${dStart}:D${rIdx})` },
      null,
      { formula: `SUM(F${dStart}:F${rIdx})`, result: knitterTotalIssued },
      { formula: `SUM(G${dStart}:G${rIdx})` },
      { formula: `SUM(H${dStart}:H${rIdx})` },
      { formula: `SUM(I${dStart}:I${rIdx})` },
      { formula: `SUM(J${dStart}:J${rIdx})`, result: knitterTotalBal },
      null
    ]);

    totRow.height = 24;
    totRow.getCell(2).font = FONTS.totalRow;
    totRow.getCell(4).numFmt = NUMBER_FORMATS.integer;
    totRow.getCell(4).font = FONTS.totalRow;
    totRow.getCell(6).numFmt = NUMBER_FORMATS.weight;
    totRow.getCell(6).font = FONTS.totalRow;
    totRow.getCell(7).numFmt = NUMBER_FORMATS.weight;
    totRow.getCell(7).font = FONTS.totalRow;
    totRow.getCell(8).numFmt = NUMBER_FORMATS.weight;
    totRow.getCell(8).font = FONTS.totalRow;
    totRow.getCell(9).numFmt = NUMBER_FORMATS.weight;
    totRow.getCell(9).font = FONTS.totalRow;
    totRow.getCell(10).numFmt = NUMBER_FORMATS.weight;
    totRow.getCell(10).font = FONTS.totalRow;

    totRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
      cell.border = BORDERS.totalDouble;
    });

    autoFitColumns(ws);

    // Add entry to MAIN SHEET
    mainCurrentRow++;
    const mRow = mainWs.addRow([
      mainSr,
      knitterName,
      knitterTotalIssued,
      knitterTotalBal
    ]);
    mRow.height = 20;
    mRow.getCell(1).alignment = { horizontal: 'center' };
    mRow.getCell(2).font = FONTS.dataBold;
    mRow.getCell(3).numFmt = NUMBER_FORMATS.weight;
    mRow.getCell(3).alignment = { horizontal: 'right' };
    mRow.getCell(4).numFmt = NUMBER_FORMATS.weight;
    mRow.getCell(4).alignment = { horizontal: 'right' };
    mRow.eachCell((cell) => {
      cell.border = BORDERS.thinAll;
    });

    mainSr++;
  }

  // MAIN SHEET Grand Total
  if (grouped.size > 0) {
    const mTotRow = mainWs.addRow([
      null,
      'GRAND TOTAL',
      { formula: `SUM(C${mainStartRow}:C${mainCurrentRow})` },
      { formula: `SUM(D${mainStartRow}:D${mainCurrentRow})` }
    ]);
    mTotRow.height = 24;
    mTotRow.getCell(2).font = FONTS.totalRow;
    mTotRow.getCell(3).numFmt = NUMBER_FORMATS.weight;
    mTotRow.getCell(3).font = FONTS.totalRow;
    mTotRow.getCell(4).numFmt = NUMBER_FORMATS.weight;
    mTotRow.getCell(4).font = FONTS.totalRow;
    mTotRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
      cell.border = BORDERS.totalDouble;
    });
  }

  autoFitColumns(mainWs);

  return wb;
}
