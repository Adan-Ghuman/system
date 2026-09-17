import ExcelJS from 'exceljs';

export const COLORS = {
  headerBg: '0F172A',      // Slate 900
  headerText: 'FFFFFF',    // White
  subHeaderBg: 'F1F5F9',   // Slate 100
  subHeaderText: '1E293B', // Slate 800
  totalRowBg: 'F8FAFC',    // Slate 50
  borderLight: 'CBD5E1',   // Slate 300
  borderDark: '64748B',    // Slate 500
  accentGreen: '059669',   // Emerald 600
  textMuted: '64748B',     // Slate 500
};

export const FONTS = {
  brandTitle: { name: 'Calibri', size: 16, bold: true, color: { argb: '0F172A' } },
  reportTitle: { name: 'Calibri', size: 13, bold: true, color: { argb: '1E293B' } },
  metaLabel: { name: 'Calibri', size: 9, bold: true, color: { argb: '64748B' } },
  metaValue: { name: 'Calibri', size: 9, bold: false, color: { argb: '0F172A' } },
  tableHeader: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } },
  subHeader: { name: 'Calibri', size: 10, bold: true, color: { argb: '1E293B' } },
  dataRegular: { name: 'Calibri', size: 9.5, bold: false, color: { argb: '1E293B' } },
  dataMono: { name: 'Consolas', size: 9, bold: false, color: { argb: '0F172A' } },
  dataBold: { name: 'Calibri', size: 9.5, bold: true, color: { argb: '0F172A' } },
  totalRow: { name: 'Calibri', size: 10.5, bold: true, color: { argb: '0F172A' } },
};

export const BORDERS = {
  thinAll: {
    top: { style: 'thin' as const, color: { argb: COLORS.borderLight } },
    bottom: { style: 'thin' as const, color: { argb: COLORS.borderLight } },
    left: { style: 'thin' as const, color: { argb: COLORS.borderLight } },
    right: { style: 'thin' as const, color: { argb: COLORS.borderLight } },
  },
  totalDouble: {
    top: { style: 'thin' as const, color: { argb: COLORS.borderDark } },
    bottom: { style: 'double' as const, color: { argb: '0F172A' } },
    left: { style: 'thin' as const, color: { argb: COLORS.borderLight } },
    right: { style: 'thin' as const, color: { argb: COLORS.borderLight } },
  },
};

export const NUMBER_FORMATS = {
  currency: '#,##0.00',
  weight: '#,##0.00',
  integer: '#,##0',
  percent: '0.00"%"',
  date: 'dd/mm/yyyy',
};

/**
 * Automatically calculates and applies optimal column widths
 */
export function autoFitColumns(sheet: ExcelJS.Worksheet, minWidth = 10, maxWidth = 45): void {
  sheet.columns.forEach((column) => {
    let maxLen = minWidth;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const val = cell.value;
      if (val === null || val === undefined) return;
      let textLen = 0;
      if (typeof val === 'string') {
        textLen = val.split('\n').reduce((m, l) => Math.max(m, l.length), 0);
      } else if (typeof val === 'number') {
        textLen = val.toLocaleString().length + 3;
      } else if (val instanceof Date) {
        textLen = 12;
      } else if (typeof val === 'object') {
        if ('result' in val) {
          textLen = String(val.result ?? '').length + 3;
        } else if ('text' in val) {
          textLen = String(val.text ?? '').length;
        }
      }
      if (textLen > maxLen) {
        maxLen = Math.min(maxWidth, textLen);
      }
    });
    column.width = maxLen + 2;
  });
}
