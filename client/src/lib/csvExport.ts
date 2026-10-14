import { saveBlob } from './fileDownload.js';

export interface CsvColumn<T> {
  header: string;
  accessor: (item: T) => string | number | boolean | null | undefined;
}

export function exportToCsv<T>(filename: string, columns: CsvColumn<T>[], data: T[]): void {
  const headers = columns.map((col) => `"${col.header.replace(/"/g, '""')}"`).join(',');

  const rows = data.map((item) =>
    columns
      .map((col) => {
        const val = col.accessor(item);
        if (val === null || val === undefined) return '""';
        const safeValue = typeof val === 'string' && /^[\s]*[=+@-]/.test(val) ? "'" + val : String(val);
        const str = safeValue.replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',')
  );

  const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}
