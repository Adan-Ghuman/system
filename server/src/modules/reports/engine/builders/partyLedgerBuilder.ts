import ExcelJS from 'exceljs';
import { COLORS, FONTS, BORDERS, NUMBER_FORMATS, autoFitColumns } from '../excelStyles.js';

export interface PartyLedgerReportData {
  party: {
    name: string;
    code: string;
    phone?: string;
    contactPerson?: string;
    address?: string;
    mlNo?: string;
    openingBalance: number;
    currentBalance: number;
  };
  dateFrom?: string;
  dateTo?: string;
  entries: Array<{
    date: Date;
    referenceNo: string;
    description: string;
    unitsKg?: number;
    rate?: number;
    entryType: 'DEBIT' | 'CREDIT';
    amount: number;
    taxAmount?: number;
    runningBalance: number;
  }>;
}

export function buildPartyLedgerWorkbook(data: PartyLedgerReportData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rozain Textile ERP';
  wb.created = new Date();

  const sheetName = (data.party.name || 'Ledger').substring(0, 31).replace(/[:\\\/\?\*\[\]]/g, '');
  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
  });

  // Header Company & Title Block
  ws.mergeCells('A1:E1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'ROZAIN TEXTILE';
  titleCell.font = FONTS.brandTitle;

  ws.mergeCells('G1:I1');
  const reportCell = ws.getCell('G1');
  reportCell.value = 'Account Ledger';
  reportCell.font = FONTS.reportTitle;
  reportCell.alignment = { horizontal: 'right' };

  ws.mergeCells('A2:E2');
  ws.getCell('A2').value = 'Near Saga Sports Pakki Kotli Daska Road Sialkot.';
  ws.getCell('A2').font = FONTS.dataRegular;

  ws.mergeCells('G2:I2');
  const partyCell = ws.getCell('G2');
  partyCell.value = data.party.name;
  partyCell.font = { ...FONTS.reportTitle, size: 12 };
  partyCell.alignment = { horizontal: 'right' };

  ws.getCell('A3').value = 'Ghulam Yaseen: 0323-8710104';
  ws.getCell('A3').font = FONTS.metaLabel;
  ws.getCell('G3').value = 'M.L No.:';
  ws.getCell('G3').font = FONTS.metaLabel;
  ws.getCell('H3').value = data.party.mlNo || data.party.code || '—';
  ws.getCell('H3').font = FONTS.metaValue;

  ws.getCell('A4').value = 'Nadeem Iqbal: 0301-5067838';
  ws.getCell('A4').font = FONTS.metaLabel;
  ws.getCell('G4').value = 'Date From:';
  ws.getCell('G4').font = FONTS.metaLabel;
  ws.getCell('H4').value = data.dateFrom || 'Inception';
  ws.getCell('H4').font = FONTS.metaValue;

  ws.getCell('G5').value = 'Date To:';
  ws.getCell('G5').font = FONTS.metaLabel;
  ws.getCell('H5').value = data.dateTo || new Date().toISOString().split('T')[0];
  ws.getCell('H5').font = FONTS.metaValue;

  ws.getCell('G6').value = 'Contact:';
  ws.getCell('G6').font = FONTS.metaLabel;
  ws.getCell('H6').value = data.party.phone || '—';
  ws.getCell('H6').font = FONTS.metaValue;

  // Table Column Headers (Row 7)
  const headers = [
    'Date',
    'Bill No.',
    'Description',
    'Units (Kg)',
    'Rate',
    'Dr Amount',
    '18% GST',
    'Cr Amount',
    'Balance Amount'
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.headerBg }
    };
    cell.font = FONTS.tableHeader;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDERS.thinAll;
  });

  // Opening Balance Row (Row 8)
  const openingRowNumber = 8;
  const openingRow = ws.addRow([
    null,
    null,
    'OPENING BALANCE',
    null,
    null,
    null,
    null,
    null,
    data.party.openingBalance || 0
  ]);
  openingRow.height = 20;
  openingRow.getCell(3).font = { ...FONTS.dataBold, color: { argb: COLORS.accentGreen } };
  openingRow.getCell(9).numFmt = NUMBER_FORMATS.currency;
  openingRow.getCell(9).font = FONTS.dataBold;
  openingRow.eachCell((cell) => {
    cell.border = BORDERS.thinAll;
  });

  // Data Rows
  let currentRowNum = openingRowNumber;
  data.entries.forEach((entry) => {
    currentRowNum++;
    const prevRowNum = currentRowNum - 1;

    const isDr = entry.entryType === 'DEBIT';
    const drVal = isDr ? entry.amount : null;
    const crVal = !isDr ? entry.amount : null;
    const gstVal = entry.taxAmount && entry.taxAmount > 0 ? entry.taxAmount : null;

    // Excel formula: =PrevBalance + Dr + GST - Cr
    const formula = `I${prevRowNum}+IF(ISBLANK(F${currentRowNum}),0,F${currentRowNum})+IF(ISBLANK(G${currentRowNum}),0,G${currentRowNum})-IF(ISBLANK(H${currentRowNum}),0,H${currentRowNum})`;

    const row = ws.addRow([
      entry.date ? new Date(entry.date) : null,
      entry.referenceNo || '—',
      entry.description || 'Transaction',
      entry.unitsKg && entry.unitsKg > 0 ? entry.unitsKg : null,
      entry.rate && entry.rate > 0 ? entry.rate : null,
      drVal,
      gstVal,
      crVal,
      { formula, result: entry.runningBalance }
    ]);

    row.height = 19;
    row.getCell(1).numFmt = NUMBER_FORMATS.date;
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).font = FONTS.dataMono;
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).font = FONTS.dataRegular;
    row.getCell(4).numFmt = NUMBER_FORMATS.weight;
    row.getCell(4).alignment = { horizontal: 'right' };
    row.getCell(5).numFmt = NUMBER_FORMATS.currency;
    row.getCell(5).alignment = { horizontal: 'right' };
    row.getCell(6).numFmt = NUMBER_FORMATS.currency;
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(7).numFmt = NUMBER_FORMATS.currency;
    row.getCell(7).alignment = { horizontal: 'right' };
    row.getCell(8).numFmt = NUMBER_FORMATS.currency;
    row.getCell(8).alignment = { horizontal: 'right' };
    row.getCell(9).numFmt = NUMBER_FORMATS.currency;
    row.getCell(9).alignment = { horizontal: 'right' };
    row.getCell(9).font = FONTS.dataBold;

    row.eachCell((cell) => {
      cell.border = BORDERS.thinAll;
    });
  });

  // Grand Total Row
  const totalRowNum = currentRowNum + 1;
  const startRow = openingRowNumber + 1;
  const totalRow = ws.addRow([
    null,
    null,
    'TOTAL AMOUNT',
    startRow <= currentRowNum ? { formula: `SUM(D${startRow}:D${currentRowNum})` } : null,
    null,
    startRow <= currentRowNum ? { formula: `SUM(F${startRow}:F${currentRowNum})` } : null,
    startRow <= currentRowNum ? { formula: `SUM(G${startRow}:G${currentRowNum})` } : null,
    startRow <= currentRowNum ? { formula: `SUM(H${startRow}:H${currentRowNum})` } : null,
    { formula: `I${currentRowNum}`, result: data.party.currentBalance }
  ]);

  totalRow.height = 24;
  totalRow.getCell(3).font = FONTS.totalRow;
  totalRow.getCell(3).alignment = { horizontal: 'right' };
  totalRow.getCell(4).numFmt = NUMBER_FORMATS.weight;
  totalRow.getCell(4).font = FONTS.totalRow;
  totalRow.getCell(6).numFmt = NUMBER_FORMATS.currency;
  totalRow.getCell(6).font = FONTS.totalRow;
  totalRow.getCell(7).numFmt = NUMBER_FORMATS.currency;
  totalRow.getCell(7).font = FONTS.totalRow;
  totalRow.getCell(8).numFmt = NUMBER_FORMATS.currency;
  totalRow.getCell(8).font = FONTS.totalRow;
  totalRow.getCell(9).numFmt = NUMBER_FORMATS.currency;
  totalRow.getCell(9).font = { ...FONTS.totalRow, size: 11, color: { argb: '1E3A8A' } };

  totalRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.totalRowBg }
    };
    cell.border = BORDERS.totalDouble;
  });

  autoFitColumns(ws);
  ws.getColumn(1).width = 13;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 34;

  return wb;
}
