import ExcelJS from 'exceljs';
import { COLORS, FONTS, BORDERS, NUMBER_FORMATS, autoFitColumns } from '../excelStyles.js';

export interface GatePassRow {
  date: Date;
  passNo: string;        // IGP # or OGP #
  lotNo?: string;        // Dyeing Lot / Batch No.
  itemCode?: string;
  itemDescription: string;
  color: string;
  rolls: number;
  ecruWeightKg?: number; // Acru Weight
  finishWeightKg: number;// Finish Weight or Item Weight
  remarks?: string;
}

export interface GatePassRegisterData {
  type: 'IGP' | 'OGP';
  partyName: string;
  millName?: string;
  dateFrom?: string;
  dateTo?: string;
  rows: GatePassRow[];
}

export function buildGatePassRegisterWorkbook(data: GatePassRegisterData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rozain Textile ERP';
  wb.created = new Date();

  const isIgp = data.type === 'IGP';
  const registerTitle = isIgp ? 'Inward Gate Pass Register' : 'Outward Gate Pass Register';
  const sheetName = isIgp ? 'IGP Register' : 'OGP Register';

  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
  });

  // Header Banner
  const millName = (data.millName || 'GHUMMAN DYEING').replace(/_/g, ' ');
  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = millName;
  titleCell.font = FONTS.brandTitle;

  ws.mergeCells('A2:H2');
  ws.getCell('A2').value = 'Opp Hbl Bank Daska Road, Ghuinke Sialkot';
  ws.getCell('A2').font = FONTS.metaLabel;

  ws.mergeCells('A3:H3');
  const regTitleCell = ws.getCell('A3');
  regTitleCell.value = registerTitle;
  regTitleCell.font = FONTS.reportTitle;

  // Filter Context
  ws.getCell('A4').value = `Party Name: ${data.partyName || 'All Parties'}`;
  ws.getCell('A4').font = FONTS.dataBold;

  ws.getCell('E4').value = `From: ${data.dateFrom || 'Start'}  To: ${data.dateTo || 'End'}`;
  ws.getCell('E4').font = FONTS.metaValue;

  ws.getCell('H4').value = `Printed: ${new Date().toLocaleDateString()}`;
  ws.getCell('H4').font = FONTS.metaValue;

  // Table Headers
  const headers = isIgp
    ? [
        'Srl. #',
        'Date',
        'IGP #',
        'Item Code',
        'Item Description',
        'Color',
        'Item Quantity',
        'Item Weight',
        'UOM',
        'Line Remarks'
      ]
    : [
        'Srl. #',
        'OGP Date',
        'OGP #',
        'Lot No.',
        'Item Code',
        'Item Description',
        'Color',
        'Roll',
        'Acru Weight',
        'Weight (Kg)',
        'UOM',
        'Line Remarks'
      ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.font = FONTS.tableHeader;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDERS.thinAll;
  });

  const startRow = 6;
  let currentRow = 5;

  let totalRolls = 0;
  let totalEcru = 0;
  let totalFinish = 0;

  data.rows.forEach((r, idx) => {
    currentRow++;
    totalRolls += r.rolls || 0;
    totalEcru += r.ecruWeightKg || 0;
    totalFinish += r.finishWeightKg || 0;

    let rowValues: any[];
    if (isIgp) {
      rowValues = [
        idx + 1,
        r.date ? new Date(r.date) : null,
        r.passNo || '—',
        r.itemCode || '200010',
        r.itemDescription || 'PK 150/48',
        r.color || 'ECRU',
        r.rolls || 0,
        r.finishWeightKg || 0,
        'Kgs',
        r.remarks || ''
      ];
    } else {
      rowValues = [
        idx + 1,
        r.date ? new Date(r.date) : null,
        r.passNo || '—',
        r.lotNo || '—',
        r.itemCode || '200043',
        r.itemDescription || 'JERSEY PP',
        r.color || 'WHITE',
        r.rolls || 0,
        r.ecruWeightKg || 0,
        r.finishWeightKg || 0,
        'Kgs',
        r.remarks || ''
      ];
    }

    const row = ws.addRow(rowValues);
    row.height = 19;
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).numFmt = NUMBER_FORMATS.date;
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).font = FONTS.dataMono;
    row.getCell(3).alignment = { horizontal: 'center' };

    if (isIgp) {
      row.getCell(4).font = FONTS.dataMono;
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).font = FONTS.dataBold;
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(7).numFmt = NUMBER_FORMATS.integer;
      row.getCell(7).alignment = { horizontal: 'right' };
      row.getCell(8).numFmt = NUMBER_FORMATS.weight;
      row.getCell(8).alignment = { horizontal: 'right' };
      row.getCell(9).alignment = { horizontal: 'center' };
    } else {
      row.getCell(4).font = FONTS.dataMono;
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).font = FONTS.dataMono;
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).font = FONTS.dataBold;
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(8).numFmt = NUMBER_FORMATS.integer;
      row.getCell(8).alignment = { horizontal: 'right' };
      row.getCell(9).numFmt = NUMBER_FORMATS.weight;
      row.getCell(9).alignment = { horizontal: 'right' };
      row.getCell(10).numFmt = NUMBER_FORMATS.weight;
      row.getCell(10).alignment = { horizontal: 'right' };
      row.getCell(11).alignment = { horizontal: 'center' };
    }

    row.eachCell((cell) => {
      cell.border = BORDERS.thinAll;
    });
  });

  // Grand Total Row
  let totalRowVals: any[];
  if (isIgp) {
    totalRowVals = [
      null,
      null,
      null,
      null,
      null,
      'TOTAL',
      { formula: `SUM(G${startRow}:G${currentRow})`, result: totalRolls },
      { formula: `SUM(H${startRow}:H${currentRow})`, result: totalFinish },
      'Kgs',
      null
    ];
  } else {
    totalRowVals = [
      null,
      null,
      null,
      null,
      null,
      null,
      'TOTAL',
      { formula: `SUM(H${startRow}:H${currentRow})`, result: totalRolls },
      { formula: `SUM(I${startRow}:I${currentRow})`, result: totalEcru },
      { formula: `SUM(J${startRow}:J${currentRow})`, result: totalFinish },
      'Kgs',
      null
    ];
  }

  const totRow = ws.addRow(totalRowVals);
  totRow.height = 24;
  totRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
    cell.border = BORDERS.totalDouble;
    cell.font = FONTS.totalRow;
  });

  if (isIgp) {
    totRow.getCell(6).alignment = { horizontal: 'right' };
    totRow.getCell(7).numFmt = NUMBER_FORMATS.integer;
    totRow.getCell(8).numFmt = NUMBER_FORMATS.weight;
    totRow.getCell(9).alignment = { horizontal: 'center' };
  } else {
    totRow.getCell(7).alignment = { horizontal: 'right' };
    totRow.getCell(8).numFmt = NUMBER_FORMATS.integer;
    totRow.getCell(9).numFmt = NUMBER_FORMATS.weight;
    totRow.getCell(10).numFmt = NUMBER_FORMATS.weight;
    totRow.getCell(11).alignment = { horizontal: 'center' };
  }

  autoFitColumns(ws);

  return wb;
}
