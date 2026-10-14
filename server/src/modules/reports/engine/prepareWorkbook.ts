import ExcelJS from 'exceljs';
import { businessContext } from '../../../business/context.js';
import { BORDERS, COLORS } from './excelStyles.js';

export function prepareWorkbook(workbook: ExcelJS.Workbook): void {
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.eachSheet(sheet => {
    const company = businessContext.getStore()?.name;
    if (company) {
      workbook.creator = company;
      sheet.eachRow(row => row.eachCell(cell => {
        if (typeof cell.value !== 'string') return;
        if (/^ROZAIN TEXTILE$/i.test(cell.value)) cell.value = company;
        else if (/Opp Hbl Bank|Near Saga Sports|Ghulam Yaseen|0323-8710104/i.test(cell.value)) cell.value = '';
      }));
    }
    const numberAt = (address: string): number => {
      const cell = sheet.getCell(address);
      return typeof cell.value === 'number' ? cell.value : typeof cell.result === 'number' ? cell.result : 0;
    };
    let headerRow = 0;
    sheet.eachRow(row => row.eachCell(cell => {
      if (cell.fill?.type === 'pattern' && cell.fill.fgColor?.argb === COLORS.headerBg) {
        headerRow ||= row.number;
        cell.alignment = { ...cell.alignment, wrapText: true, vertical: 'middle' };
        row.height = 32;
      }
      const value = cell.value;
      if (!value || typeof value !== 'object' || !('formula' in value) || typeof value.formula !== 'string' || cell.result !== undefined) return;
      const sum = value.formula.match(/^SUM\(([A-Z]+)(\d+):\1(\d+)\)$/);
      const percentage = value.formula.match(/^IF\(([A-Z]+\d+)>0,\s*\(([A-Z]+\d+)\/([A-Z]+\d+)\)\*100,\s*0\)$/);
      let result: number;
      if (sum) {
        result = 0;
        for (let index = Number(sum[2]); index <= Number(sum[3]); index++) result += numberAt(sum[1] + index);
      } else if (percentage) {
        result = numberAt(percentage[1]) > 0 ? numberAt(percentage[2]) / numberAt(percentage[3]) * 100 : 0;
      } else {
        throw new Error(`Missing report formula result at ${sheet.name}!${cell.address}`);
      }
      cell.value = { formula: value.formula, result: Math.round(result * 1000000) / 1000000 };
    }));
    sheet.pageSetup = { ...sheet.pageSetup, orientation: sheet.columnCount > 5 ? 'landscape' : 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    sheet.pageSetup.printArea = `A1:${sheet.getColumn(sheet.columnCount).letter}${sheet.rowCount}`;
    if (headerRow) {
      sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
      sheet.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }];
      sheet.getRow(1).height = 24;
      for (let index = headerRow; index <= sheet.rowCount; index++) {
        const row = sheet.getRow(index);
        for (let column = 1; column <= sheet.columnCount; column++) {
          const cell = row.getCell(column);
          if (!cell.border?.top) cell.border = BORDERS.thinAll;
        }
      }
    }
  });
}
