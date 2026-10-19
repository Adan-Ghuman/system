import ExcelJS from 'exceljs';
import { Response } from 'express';
import { businessContext } from './context.js';
import { uppercaseDisplay, uppercaseWorkbook } from '../utils/uppercaseDisplay.js';

export async function sendTable(res: Response, format: string, title: string, headers: string[], rows: Array<Array<string | number | Date | null | undefined>>) {
  const company = businessContext.getStore()?.name || 'Rozain Textile';
  if (format === 'csv') {
    const quote = (value: unknown) => '"' + uppercaseDisplay(String(typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : value instanceof Date ? value.toISOString() : value ?? '')).replace(/"/g, '""') + '"';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');res.setHeader('Content-Disposition', `attachment; filename="${title}.csv"`);
    res.send('\uFEFF' + [['Business', ...headers], ...rows.map(row => [company, ...row])].map(row => row.map(quote).join(',')).join('\r\n'));return;
  }
  const workbook = new ExcelJS.Workbook();workbook.creator = company;
  const sheet = workbook.addWorksheet(title.slice(0, 31));sheet.addRow([company + ' · ' + title]);sheet.addRow(headers);rows.forEach(row => sheet.addRow(row));
  sheet.views = [{ state: 'frozen', ySplit: 2 }];sheet.columns.forEach(column => { column.width = 22; });sheet.getRow(2).font = { bold: true };
  sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '2:2' };
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition', `attachment; filename="${title}.xlsx"`);
  uppercaseWorkbook(workbook);
  await workbook.xlsx.write(res);res.end();
}
