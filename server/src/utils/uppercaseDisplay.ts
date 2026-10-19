import ExcelJS from 'exceljs';

export function uppercaseDisplay(value: string): string {
  return value.replace(/\S+/g, word =>
    /^(?:https?:\/\/|mailto:|www\.)|@|^(?:[0-9a-f]{24}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.test(word) ? word : word.toUpperCase());
}

export function uppercaseWorkbook(workbook: ExcelJS.Workbook): void {
  workbook.creator = uppercaseDisplay(workbook.creator || '');
  workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => {
    const value = cell.value;
    if (typeof value === 'string') cell.value = uppercaseDisplay(value);
    else if (value && typeof value === 'object') {
      if ('richText' in value) cell.value = { ...value, richText: value.richText.map(run => ({ ...run, text: uppercaseDisplay(run.text) })) };
      else if ('hyperlink' in value) cell.value = { ...value, text: uppercaseDisplay(value.text) };
    }
  })));
}
