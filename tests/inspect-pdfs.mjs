import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const home = process.env.USERPROFILE || process.env.HOME;
const pdfjs = await import(pathToFileURL(path.join(home, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs')));
await fs.mkdir('scratch/qa-completion/rendered', { recursive: true });
const folder = path.resolve('scratch/qa-completion/downloads');const results = [];
for (const file of (await fs.readdir(folder)).filter(file => file.endsWith('.pdf'))) {
  const document = await pdfjs.getDocument({ data: new Uint8Array(await fs.readFile(path.join(folder, file))), useSystemFonts: true }).promise;
  const pages = [];let content = '';
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);const text = await page.getTextContent();const strings = text.items.filter(item => 'str' in item);
    assert(strings.length, 'Empty PDF page: ' + file + ':' + number);
    const bounds = page.getViewport({ scale: 1 });const outside = strings.filter(item => item.transform[4] < -1 || item.transform[4] + item.width > bounds.width + 1);
    assert.equal(outside.length, 0, 'Horizontally clipped PDF text: ' + file + ':' + number);
    const words = strings.map(item => item.str).join(' ');content += words;pages.push({ page: number, characters: words.length });
  }
  assert(/rozain textile|zr trading/i.test(content), 'Missing business identity: ' + file);
  if (file === 'browser-production.pdf') { assert(content.includes('LONG-IN-23'));assert(document.numPages > 1); }
  if (file === 'browser-party-ledger.pdf') assert(content.includes('LONG-LEDGER-24'));
  if (file === 'browser-purchase.pdf') { assert(content.includes('0007/26'));assert(content.includes('80.250'));assert(content.includes('802.50')); }
  if (file === 'browser-knitting-receipt.pdf') { assert(content.includes('76.000'));assert(content.includes('2.000')); }
  if (file === 'browser-dyeing-receipt.pdf') { assert(content.includes('18.000'));assert(content.includes('1.000')); }
  if (file === 'browser-delivery-invoice.pdf') assert(content.includes('1,800.00'));
  if (file === 'browser-external-mill-receipt.pdf') { assert(content.includes('EXT-BROWSER-0008/26'));assert(content.includes('44.125'));assert(content.includes('Browser External Mill')); }
  await fs.writeFile(path.resolve('scratch/qa-completion/rendered', file + '.txt'), content);
  results.push({ file, pages });await document.destroy();
}
await fs.writeFile('scratch/qa-completion/pdf-inspection.json', JSON.stringify(results, null, 2));console.log(`PASS ${results.length} actual PDFs: nonempty pages, company identity, text bounds and source quantity/amount assertions.`);
