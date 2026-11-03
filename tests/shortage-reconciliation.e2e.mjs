import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { request as proxyRequest } from 'node:http';
import { resolve } from 'node:path';
import mongoose from '../server/node_modules/mongoose/index.js';
import { MongoMemoryReplSet } from '../server/node_modules/mongodb-memory-server/index.js';
import express from '../server/node_modules/express/index.js';
import bcrypt from '../server/node_modules/bcrypt/bcrypt.js';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'reconciliation-test-access';
process.env.JWT_REFRESH_SECRET = 'reconciliation-test-refresh';
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGODB_URI = replica.getUri();
let server, web, browser;
try {
  await mongoose.connect(process.env.MONGODB_URI);
  const { createApp } = await import('../server/dist/app.js');
  const { User } = await import('../server/dist/models/User.js');
  const { Business } = await import('../server/dist/business/Business.js');
  const { signAccessToken } = await import('../server/dist/utils/jwt.js');
  const company = await Business.create({ name: 'Rozain Textile', code: 'ROZAIN' });
  const user = await User.create({ fullName: 'Reconciliation QA', email: 'shortage-qa@example.invalid',
    passwordHash: await bcrypt.hash('Isolated-shortage-test-1234', 4), role: 'admin', businessIds: [company._id] });
  const token = signAccessToken({ userId: String(user._id), email: user.email, role: 'admin', permissions: [] });
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));

  const base = 'http://127.0.0.1:' + server.address().port;
  const api = async (method, path, input, expected = 200, authorization = token) => {
    const response = await fetch(base + '/api' + path, { method, headers: { authorization: 'Bearer ' + authorization, 'content-type': 'application/json' },
      body: input ? JSON.stringify(input) : undefined });
    const body = await response.json();
    assert.equal(response.status, expected, JSON.stringify({ path, body }));
    return body.data;
  };
  const post = (path, input, expected = 201) => api('POST', path, { requestId: randomUUID(), ...input }, expected);
  const list = async (filter = '') => (await api('GET', '/workspace/reconciliation?limit=100&' + filter)).items;
  const dated = day => '2026-10-' + String(day).padStart(2, '0') + 'T08:00:00.000Z';
  const owner = await post('/parties', { name: 'Owner fixture', tags: { isYarnClient: true, isFabricBuyer: true } });
  const knitter = await post('/parties', { name: 'Knitter fixture', tags: { isKnitter: true } });
  const mill = (await api('GET', '/dyeing/units')).find(unit => unit.code === 'GHUMMAN_DYEING');
  assert.ok(mill);
  const raw = { fabricType: 'Reconciliation raw', yarnSpec: '150/48', color: 'ECRU', state: 'RAW_ECRU', location: 'ZR_GODOWN' };
  const issueBody = { millName: mill.code, ogpNo: 'SHORT-DYE-OUT', dateIssued: dated(3), entries: [{ ...raw, targetColor: 'NAVY', ecruRollsCount: 12, ecruWeightKg: 257.65 }] };
  await post('/dyeing/gate-passes', issueBody, 400);
  assert.equal((await list()).length, 0);
  const confirmedIssue = { ...issueBody, requestId: randomUUID(), shortageReason: 'Original stock receipt pending' };
  const [batch] = await post('/dyeing/gate-passes', confirmedIssue);
  assert.equal((await post('/dyeing/gate-passes', confirmedIssue))[0]._id, batch._id);
  let gap = (await list())[0];
  assert.deepEqual([gap.quantity, gap.weightKg], [-12, -257.65]);
  const stockRows = (await api('GET', '/inventory/items?search=Reconciliation%20raw')).items;
  assert.equal(stockRows.find(row => row.location === 'ZR_GODOWN').totalRolls, -12);
  assert.equal(stockRows.find(row => row.location === mill.code).totalRolls, 12);
  await post('/inventory/adjustments', { ...raw, ownerKey: owner._id, reason: 'MANUAL_CORRECTION', adjustmentRolls: 12, adjustmentWeightKg: 257.65, date: dated(2) });
  assert.equal((await list())[0].weightKg, -257.65);
  await post('/workspace/reconciliation/' + gap._id + '/correct', { quantity: 5, weightKg: 100, expectedQuantity: -12, expectedKg: -257.65, reason: 'Partial physical count', date: dated(2) });
  await post('/workspace/reconciliation/' + gap._id + '/correct', { quantity: 5, weightKg: 100,
    expectedQuantity: -12, expectedKg: -257.65, reason: 'Stale measured count', date: dated(2) }, 409);
  gap = (await list())[0];
  assert.deepEqual([gap.quantity, gap.weightKg], [-7, -157.65]);
  await post('/workspace/reconciliation/closing', {}, 400);
  const closing = await post('/workspace/reconciliation/closing', { reason: 'Pending second receipt' });
  assert.equal(closing.items.length, 1);
  await post('/workspace/documents', { kind: 'FABRIC_RECEIPT', partyId: owner._id, date: dated(2),
    reference: 'LATE-FABRIC', items: [{ ...raw, rolls: 7, weightKg: 157.65 }] });
  assert.equal((await list('kind=FABRIC')).length, 0);
  const history = (await list('status=RESOLVED&kind=FABRIC'))[0];
  assert.equal(history.events.length, 3);
  assert.equal(history.events[1].weightKg, -157.65);
  console.log('PASS dyeing issue with zero stock, atomic retry, signed stock, partial correction, owner isolation and closing carry-forward.');

  const yarnName = 'Reconciliation yarn';
  const yarnLine = { yarnSpec: yarnName, boxCount: 5, totalWeightKg: 50, packageUnit: 'cartons' };
  const sendYarn = { transactionType: 'OUTWARD_TO_KNITTER', partyId: knitter._id, gatePassNo: 'SHORT-YARN-OUT', date: dated(3), items: [yarnLine] };
  const knitted = await post('/knitting/receive', { partyId: knitter._id, gatePassNo: 'LATE-KNIT', date: dated(4),
    shortageReason: 'Outgoing yarn challan to enter', items: [{ fabricType: 'Knitted fixture', yarnSpec: yarnName, rollsCount: 2, weightKg: 45, wastageKg: 5 }] }, 200);
  await post('/knitting/transactions/bulk', sendYarn, 400);
  const yarnIssue = (await post('/knitting/transactions/bulk', { ...sendYarn, shortageReason: 'Purchase receipt to enter' })).transactions[0];
  const yarnGap = (await list('kind=YARN'))[0];
  const knitGap = (await list('kind=KNITTING'))[0];
  assert.deepEqual([yarnGap.quantity, yarnGap.weightKg, knitGap.weightKg], [-5, -50, -50]);
  const linkKnit = { sourceId: yarnIssue._id, quantity: 0, reason: 'Matched the original paper challan' };
  await post('/workspace/reconciliation/' + knitGap._id + '/link', { ...linkKnit, weightKg: 20 }, 200);
  assert.equal((await list('kind=KNITTING'))[0].weightKg, -30);
  const rest = { ...linkKnit, requestId: randomUUID(), weightKg: 30 };
  await post('/workspace/reconciliation/' + knitGap._id + '/link', rest, 200);
  await post('/workspace/reconciliation/' + knitGap._id + '/link', rest, 200);
  assert.equal((await list('kind=KNITTING')).length, 0);
  assert.equal((await list('kind=YARN'))[0].weightKg, -50);
  const savedKnit = (await api('GET', '/workspace/receipts?search=LATE-KNIT')).items[0];
  assert.equal(savedKnit.items[0].allocations.reduce((sum, value) => sum + value.weightKg, 0), 50);
  await post('/workspace/yarn-deliveries/' + yarnIssue._id + '/reverse', { reason: 'Fixture dependency' }, 400);
  await post('/workspace/receipts/' + knitted.receipt._id + '/reverse', { reason: 'Fixture correction' }, 200);
  await post('/workspace/yarn-deliveries/' + yarnIssue._id + '/reverse', { reason: 'Fixture correction' }, 200);
  assert.equal((await list('kind=YARN')).length, 0);
  const returnYarn = 'Return yarn fixture';
  const returnLine = { yarnSpec: returnYarn, boxCount: 2, totalWeightKg: 20, packageUnit: 'cartons' };
  await post('/workspace/documents', { kind: 'YARN_ADJUSTMENT', date: dated(2), remarks: 'Measured yarn counted',
    items: [{ yarnSpec: returnYarn, rolls: 4, weightKg: 40 }] });
  const returnedIssues = (await post('/knitting/transactions/bulk', { ...sendYarn, gatePassNo: 'YARN-RETURN-SOURCES', items: [returnLine, returnLine] })).transactions;
  const returned = await post('/workspace/documents', { kind: 'YARN_RETURN', date: dated(5), sourceId: returnedIssues[0]._id,
    remarks: 'Original return covered two issues', shortageReason: 'Second issue to match',
    items: [{ yarnSpec: returnYarn, rolls: 3, weightKg: 30 }] });
  const returnGap = (await list('kind=YARN_RETURN'))[0];
  assert.deepEqual([returnGap.quantity, returnGap.weightKg], [-1, -10]);
  await post('/workspace/reconciliation/' + returnGap._id + '/link', { sourceId: returnedIssues[1]._id, quantity: 1, weightKg: 10,
    reason: 'Matched the second yarn issue' }, 200);
  assert.equal((await list('kind=YARN_RETURN')).length, 0);
  await post('/workspace/documents/' + returned._id + '/reverse', { reason: 'Check both issue balances restore' }, 200);
  const issueRows = (await api('GET', '/workspace/yarn-issues?includeClosed=true')).items.filter(row => row.label.includes('YARN-RETURN-SOURCES'));
  assert.deepEqual(issueRows.map(row => row.items[0].weightKg), [20, 20]);
  console.log('PASS yarn issue shortages, knitting output with missing consumption, partial source links, exact retry and ordered reversals.');

  const finished = { fabricType: 'Unlinked dye fixture', yarnSpec: '80/72', targetColor: 'BLACK', finishRollsCount: 4, finishWeightKg: 74 };
  const lateDye = { millName: mill.code, igpNo: 'SHORT-DYE-IN', dateReceived: dated(6), destination: 'ZR_GODOWN',
    shortageReason: 'Awaiting original dyeing send-out', items: [finished] };
  await post('/dyeing/gate-passes/receive', lateDye, 200);
  const dyeGap = (await list('kind=DYEING'))[0];
  assert.equal(dyeGap.open, true);
  const [lateBatch] = await post('/dyeing/gate-passes', { millName: mill.code, ogpNo: 'LATE-RAW', dateIssued: dated(5),
    shortageReason: 'Awaiting opening raw count', entries: [{ ...finished, ecruRollsCount: 4, ecruWeightKg: 80 }] });
  const sources = await api('GET', '/workspace/reconciliation/' + dyeGap._id + '/sources');
  assert.equal(sources[0].id, lateBatch._id);
  await post('/workspace/reconciliation/' + dyeGap._id + '/link', { sourceId: lateBatch._id, quantity: 4, weightKg: 80, reason: 'Matched original dyeing challans' }, 200);
  assert.equal((await list('kind=DYEING')).length, 0);
  const finishedRows = (await api('GET', '/inventory/items?state=FINISHED_DYED&search=Unlinked')).items;
  assert.deepEqual(finishedRows.map(row => [row.location, row.totalRolls, row.totalWeightKg]), [['ZR_GODOWN', 4, 74]]);
  const postedDye = (await api('GET', '/workspace/dyeing-receipts?search=SHORT-DYE-IN')).items[0];
  assert.equal(postedDye.items[0].rawKg, 80);
  assert.equal(postedDye.items[0].wastageKg, 6);
  const split = { ...finished, fabricType: 'Split dye fixture', finishRollsCount: 4, finishWeightKg: 72 };
  await post('/dyeing/gate-passes/receive', { ...lateDye, igpNo: 'SPLIT-DYE-IN', items: [{ ...split, ecruRollsCount: 4, ecruWeightKg: 80 }] }, 200);
  const splitGap = (await list('kind=DYEING&search=Split'))[0];
  const parts = await post('/dyeing/gate-passes', { millName: mill.code, ogpNo: 'SPLIT-RAW', dateIssued: dated(5),
    shortageReason: 'Two original raw issue lines', entries: [1, 2].map(() => ({ ...split, ecruRollsCount: 2, ecruWeightKg: 40 })) });
  for (const [index, part] of parts.entries()) {
    const allocated = await post('/workspace/reconciliation/' + splitGap._id + '/link', { sourceId: part._id, quantity: 2, weightKg: 40,
      finishedQuantity: 2, finishedKg: 36, reason: 'Matched one of two raw issues' }, 200);
    assert.equal(allocated.open, index === 0);
    assert.equal(allocated.weightKg, index === 0 ? -40 : 0);
  }
  const report = await api('GET', '/dyeing/status-report?search=Split');
  assert.equal(report.items.length, 2);
  assert.ok(report.items.every(row => row.receipts.length === 1 && row.receipts[0].weightKg === 36));
  const splitReceipt = (await api('GET', '/workspace/dyeing-receipts?search=SPLIT-DYE-IN')).items[0];
  await post('/workspace/dyeing-receipts/' + splitReceipt._id + '/reverse', { reason: 'Verify split reversal' }, 200);
  assert.ok((await api('GET', '/dyeing/status-report?search=Split')).items.every(row => row.pendingKg === 40 && row.receipts.length === 0));
  const reversedStock = (await api('GET', '/inventory/items?state=FINISHED_DYED&search=Split')).items;
  assert.deepEqual(reversedStock.map(row => [row.totalRolls, row.totalWeightKg]), [[0, 0]]);
  console.log('PASS dyeing receipt with no issue, actual raw measurement at matching, and finished output credited exactly once.');

  const bill = { customerId: owner._id, mode: 'FABRIC', date: dated(7), location: 'ZR_GODOWN', reference: 'SHORT-SALE',
    items: [{ fabricType: 'New sold fabric', yarnSpec: '30/1', color: 'RED', state: 'FINISHED_DYED', rate: 100 }],
    rolls: [{ rollNumber: 1, grossWeightKg: 20, tareKg: 0 }], payment: { kind: 'LATER' }, shortageReason: 'Awaiting purchase entry' };
  const quote = await post('/workspace/sales/quote', bill, 200);
  assert.equal(quote.total, 2000);
  const sale = await post('/workspace/sales', bill);
  assert.equal(sale.total, 2000);
  assert.equal((await api('GET', '/parties/' + owner._id)).currentBalance, 2000);
  await post('/dispatch/' + sale.deliveryId + '/reverse', { reason: 'Cancelled delivery' }, 200);
  assert.equal((await api('GET', '/parties/' + owner._id)).currentBalance, 0);
  assert.equal((await list('search=New%20sold')).length, 0);

  await post('/inventory/transfers', { ...raw, fabricType: 'Transfer fixture', rollsCount: 2, weightKg: 15,
    gatePassNo: 'SHORT-TRANSFER', fromLocation: 'ZR_GODOWN', toLocation: mill.code, date: dated(7), shortageReason: 'Transfer before receipt entry' });
  assert.equal((await list('search=Transfer'))[0].weightKg, -15);
  const restricted = await User.create({ fullName: 'Yarn reader', email: 'yarn-reader@example.invalid', passwordHash: 'fixture',
    role: 'operator', permissions: ['knitting:read'], businessIds: [company._id] });
  const limitedToken = signAccessToken({ userId: String(restricted._id), email: restricted.email, role: restricted.role, permissions: restricted.permissions });
  const limited = await api('GET', '/workspace/reconciliation?status=ALL', undefined, 200, limitedToken);
  assert.ok(limited.items.length > 0 && limited.items.every(row => ['YARN', 'KNITTING', 'YARN_RETURN'].includes(row.kind)));
  await api('POST', '/workspace/reconciliation/closing', { requestId: randomUUID() }, 403, limitedToken);
  console.log('PASS sale quote and bill with missing stock, ledger and stock reversal, transfers and permissions.');

  if (process.env.QA_SHORTAGE_BROWSER === '1') {
    const require = createRequire(import.meta.url);
    let playwright;
    try { playwright = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright'); }
    catch { playwright = require(resolve(process.env.HOME, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
    const frontend = express();
    frontend.use((req, res, next) => {
      if (!req.url.startsWith('/api/')) return next();
      const upstream = proxyRequest(base + req.url, { method: req.method, headers: req.headers }, response => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      });
      upstream.on('error', () => res.sendStatus(502));
      req.pipe(upstream);
    });
    frontend.use(express.static(resolve('client/dist')));
    frontend.get('*', (_req, res) => res.sendFile(resolve('client/dist/index.html')));
    web = frontend.listen(0, '127.0.0.1');
    await new Promise(resolve => web.once('listening', resolve));
    browser = await playwright.chromium.launch({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chrome', headless: true });
    const page = await browser.newPage({ timezoneId: 'Asia/Karachi' });
    const host = 'http://127.0.0.1:' + web.address().port;
    await page.goto(host + '/login');
    await page.getByLabel('Email address').fill('shortage-qa@example.invalid');
    await page.getByLabel('Password', { exact: true }).fill('Isolated-shortage-test-1234');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
    await page.goto(host + '/dyeing');
    await page.getByRole('button', { name: /^Send fabric for dyeing/ }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Post with shortage').check();
    await form.getByLabel('Shortage reason').fill('Browser missing receipt');
    await form.getByLabel(/gate pass.*challan number/i).fill('BROWSER-SHORTAGE');
    await form.getByLabel('Fabric name', { exact: true }).fill('Browser shortage fabric');
    await form.getByLabel('Yarn name / count', { exact: true }).fill('100/144');
    await form.getByLabel('Color / shade to dye', { exact: true }).fill('Green');
    await form.getByLabel('Rolls sent', { exact: true }).fill('3');
    await form.getByLabel('Raw weight sent (kg)', { exact: true }).fill('30');
    await form.getByRole('button', { name: 'Save fabric delivery' }).click();
    await form.waitFor({ state: 'hidden' });
    await page.getByRole('link', { name: 'Reconciliation', exact: true }).click();
    await page.getByRole('heading', { name: 'Reconciliation', exact: true }).waitFor();
    const row = page.locator('article').filter({ hasText: /Browser shortage fabric/i });
    await row.getByText('-3 rolls / -30.000 kg', { exact: true }).waitFor();
    await row.getByRole('button', { name: 'Post measured correction' }).click();
    const correction = page.getByRole('dialog');
    await correction.getByLabel('Reason', { exact: true }).fill('Confirmed physical count');
    await correction.getByRole('button', { name: 'Save', exact: true }).click();
    await correction.waitFor({ state: 'hidden' });
    await row.waitFor({ state: 'hidden' });
    await page.getByLabel('Status', { exact: true }).selectOption('RESOLVED');
    await row.getByRole('button', { name: 'Show history' }).click();
    await row.getByText(/Confirmed physical count/i).waitFor();
    console.log('PASS browser posts a dyeing shortage without a stock row and resolves it from Reconciliation.');
  }
} finally {
  if (browser) await browser.close();
  if (web) await new Promise(resolve => web.close(resolve));
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await replica.stop();
}
