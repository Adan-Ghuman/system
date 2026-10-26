import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);const ExcelJS = require('../server/node_modules/exceljs');
const { uppercaseDisplay } = await import('../server/dist/utils/uppercaseDisplay.js');
const folder = path.resolve('scratch/qa-completion/downloads');const results = [];
function csvRows(text) {
  const rows = [];let row = [], value = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') { if (quoted && text[index + 1] === '"') { value += '"';index++; } else quoted = !quoted; }
    else if (character === ',' && !quoted) { row.push(value);value = ''; }
    else if (character === '\n' && !quoted) { row.push(value.replace(/\r$/, ''));rows.push(row);row = [];value = ''; }
    else value += character;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, ''));rows.push(row); }
  assert.equal(quoted, false, 'Unclosed CSV field');return rows;
}
for (const file of (await fs.readdir(folder)).filter(file => /\.(xlsx|csv)$/.test(file))) {
  const bytes = await fs.readFile(path.join(folder, file));assert(bytes.length > 20);
  if (file.endsWith('.xlsx')) {
    const workbook = new ExcelJS.Workbook();await workbook.xlsx.load(bytes);assert(workbook.worksheets.length);
    if (String(workbook.worksheets[0].getCell('A1').value).includes('YARN IN STOCK REPORT')) for (const sheet of workbook.worksheets) assert(String(sheet.getCell('A1').value).startsWith('ROZAIN TEXTILE — '), 'Consistent business name in knitting report: ' + file);
    for (const sheet of workbook.worksheets) sheet.eachRow(row => row.eachCell(cell => { if (cell.formula) assert.notEqual(cell.result, undefined, `Missing cached formula: ${file}!${cell.address}`);if (typeof cell.value === 'string') assert.equal(cell.value, uppercaseDisplay(cell.value), 'Uppercase workbook text: ' + file + '!' + cell.address); }));
    results.push({ file, sheets: workbook.worksheets.map(sheet => ({ name: sheet.name, rows: sheet.rowCount })) });
  } else {
    const rows = csvRows(bytes.toString('utf8').replace(/^\uFEFF/, ''));assert(rows.length > 1);assert(rows.every(row => row.length === rows[0].length), 'Uneven CSV columns: ' + file);for (const row of rows) for (const value of row) assert.equal(value, uppercaseDisplay(value), 'Uppercase CSV text: ' + file);results.push({ file, rows: rows.length - 1, columns: rows[0].length });
  }
}
assert(results.length >= 13);await fs.writeFile('scratch/qa-completion/download-inspection.json', JSON.stringify(results, null, 2));console.log(`PASS ${results.length} actual CSV/XLSX downloads: reopened, rows/columns validated and formula caches checked.`);
