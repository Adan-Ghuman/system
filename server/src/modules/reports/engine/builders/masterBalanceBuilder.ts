import ExcelJS from 'exceljs';
import { COLORS, FONTS, BORDERS, NUMBER_FORMATS, autoFitColumns } from '../excelStyles.js';

export interface MasterBalanceItem {
  sr: number;
  code: string;
  name: string;
  phone?: string;
  category: string;
  debit: number;
  credit: number;
  netBalance: number;
}

export function buildMasterBalanceWorkbook(items: MasterBalanceItem[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rozain Textile ERP';
  wb.created = new Date();

  const ws = wb.addWorksheet('MASTER BALANCE DIRECTORY', {
    views: [{ showGridLines: true }]
  });

  // Header
  ws.mergeCells('A1:G1');
  const tCell = ws.getCell('A1');
  tCell.value = 'ROZAIN TEXTILE — MASTER PARTIES & BALANCE AUDIT';
  tCell.font = FONTS.brandTitle;

  ws.mergeCells('A2:G2');
  ws.getCell('A2').value = `Generated on: ${new Date().toLocaleString()} | Active Parties: ${items.length}`;
  ws.getCell('A2').font = FONTS.metaLabel;

  const headers = [
    'SR.',
    'CODE',
    'PARTY NAME',
    'CONTACT NO.',
    'CATEGORY',
    'DEBIT (RECEIVABLE)',
    'CREDIT (PAYABLE)',
    'NET BALANCE (PKR)'
  ];

  const hRow = ws.addRow(headers);
  hRow.height = 24;
  hRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.font = FONTS.tableHeader;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDERS.thinAll;
  });

  const startRow = 4;
  let currentRow = 3;

  items.forEach((item, idx) => {
    currentRow++;
    const row = ws.addRow([
      idx + 1,
      item.code,
      item.name,
      item.phone || '—',
      item.category,
      item.debit > 0 ? item.debit : null,
      item.credit > 0 ? item.credit : null,
      item.netBalance
    ]);

    row.height = 19;
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).font = FONTS.dataMono;
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).font = FONTS.dataBold;
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(5).font = FONTS.metaValue;
    row.getCell(6).numFmt = NUMBER_FORMATS.currency;
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(7).numFmt = NUMBER_FORMATS.currency;
    row.getCell(7).alignment = { horizontal: 'right' };
    row.getCell(8).numFmt = NUMBER_FORMATS.currency;
    row.getCell(8).alignment = { horizontal: 'right' };
    row.getCell(8).font = FONTS.dataBold;

    row.eachCell((cell) => {
      cell.border = BORDERS.thinAll;
    });
  });

  // Grand Total Row
  if (items.length > 0) {
    const totRow = ws.addRow([
      null,
      null,
      'TOTAL AMOUNT',
      null,
      null,
      { formula: `SUM(F${startRow}:F${currentRow})` },
      { formula: `SUM(G${startRow}:G${currentRow})` },
      { formula: `SUM(H${startRow}:H${currentRow})` }
    ]);

    totRow.height = 24;
    totRow.getCell(3).font = FONTS.totalRow;
    totRow.getCell(3).alignment = { horizontal: 'right' };
    totRow.getCell(6).numFmt = NUMBER_FORMATS.currency;
    totRow.getCell(6).font = FONTS.totalRow;
    totRow.getCell(7).numFmt = NUMBER_FORMATS.currency;
    totRow.getCell(7).font = FONTS.totalRow;
    totRow.getCell(8).numFmt = NUMBER_FORMATS.currency;
    totRow.getCell(8).font = { ...FONTS.totalRow, size: 11, color: { argb: '1E3A8A' } };

    totRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalRowBg } };
      cell.border = BORDERS.totalDouble;
    });
  }

  autoFitColumns(ws);
  ws.getColumn(3).width = 30;

  return wb;
}
