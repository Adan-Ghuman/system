import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { request as proxyRequest } from 'node:http';
import { resolve } from 'node:path';
import mongoose from '../server/node_modules/mongoose/index.js';
import { MongoMemoryReplSet } from '../server/node_modules/mongodb-memory-server/index.js';
import express from '../server/node_modules/express/index.js';
import bcrypt from '../server/node_modules/bcrypt/bcrypt.js';
import ExcelJS from '../server/node_modules/exceljs/excel.js';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'yarn-production-test-access';
process.env.JWT_REFRESH_SECRET = 'yarn-production-test-refresh';
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
  const other = await Business.create({ name: 'Isolated Production', code: 'OTHER' });
  const password = 'Isolated-production-test-1234';
  const user = await User.create({ fullName: 'Production QA', email: 'production-qa@example.invalid',
    passwordHash: await bcrypt.hash(password, 4), role: 'admin', businessIds: [company._id, other._id] });
  const tokenFor = user => signAccessToken({ userId: String(user._id), email: user.email, role: user.role, permissions: user.permissions });
  const token = tokenFor(user);
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));

  const base = 'http://127.0.0.1:' + server.address().port;
  const request = (method, path, body, authorization = token) => fetch(base + '/api' + path, {
    method, headers: { authorization: 'Bearer ' + authorization, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const api = async (method, path, input, expected = 200, authorization = token) => {
    const response = await request(method, path, input, authorization);
    const body = await response.json();
    assert.equal(response.status, expected, JSON.stringify({ path, body }));
    return body.data;
  };
  const post = (path, input, expected = 201) => api('POST', path, { requestId: randomUUID(), ...input }, expected);
  const get = path => api('GET', path);
  const production = '/yarn-production';
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const iso = date + 'T00:00:00+05:00';
  const dayIso = new Date(iso).toISOString();
  const stats = (filters = '') => get(production + '/runs?' + filters);
  const machineData = { code: 'SP-01', name: 'Spinning 1', process: 'SPINNING', location: 'Spinning floor' };
  const spin = await post(production + '/machines', machineData);
  await post(production + '/machines', { ...machineData, code: 'sp-01' }, 409);
  const rewind = await post(production + '/machines', { code: 'RW-02', name: 'Rewinder 2', process: 'REWINDING', location: 'Winding floor' });
  const spinOutput = { yarnSpec: '30/1 SP TEST', packageUnit: 'cones', quantity: 10, weightKg: 18 };
  const spinData = { machineId: spin._id, productionDate: date, shift: 'DAY', reference: 'RUN-A', output: spinOutput, wasteKg: 2 };
  const runRequest = { ...spinData, requestId: randomUUID() };
  const run = await post(production + '/runs', runRequest);
  assert.equal((await post(production + '/runs', runRequest))._id, run._id);
  await post(production + '/runs', { ...spinData, reference: 'run-a' }, 409);
  const race = { ...spinData, reference: 'RUN-RACE' };
  const responses = await Promise.all([request('POST', production + '/runs', { ...race, requestId: randomUUID() }),
    request('POST', production + '/runs', { ...race, requestId: randomUUID() })]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  const raced = (await responses.find(response => response.status === 201).json()).data;
  await post(production + '/runs/' + raced._id + '/void', { reason: 'Remove QA duplicate race' }, 200);
  const inventory = async (spec, unit = 'cones') => {
    const rows = (await get('/workspace/yarn?limit=100')).items;
    const row = rows.find(item => item.yarnSpec === spec && item.packageUnit === unit && item.ownerKey === 'OWN');
    return [row?.quantity || 0, row?.totalWeightKg || 0];
  };
  assert.deepEqual(await inventory(spinOutput.yarnSpec), [0, 0]);
  const corrected = await post(production + '/runs/' + run._id + '/correct', {
    ...spinData, output: { ...spinOutput, weightKg: 19 }, reason: 'Verified weigh sheet'
  });
  assert.equal(corrected.replacesId, run._id);
  assert.equal((await get(production + '/runs/' + run._id)).replacedById, corrected._id);
  const history = await stats('history=true&machineId=' + spin._id + '&shift=DAY&from=' + date + '&to=' + date);
  assert.equal(history.items.length, 3);
  assert.deepEqual(history.summary.map(row => [row.runs, row.usableKg, row.wasteKg, row.awaiting]), [[1, 19, 2, 1]]);
  const exportResponse = await request('GET', production + '/runs?format=xlsx&shift=DAY&yarnSpec=30%2F1');
  assert.equal(exportResponse.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await exportResponse.arrayBuffer()));
  const row = workbook.worksheets[0].getRow(3).values;
  assert.equal(row[3], 'SP-01');
  assert.equal(row[11], 19);
  assert.equal(workbook.worksheets[0].rowCount, 3);
  console.log('PASS machine setup, duplicate and retry protection, correction history, filtered totals and Excel.');

  const receiptBody = { mode: 'POST', date, requestId: randomUUID() };
  const received = await post(production + '/runs/' + corrected._id + '/stock', receiptBody, 200);
  assert.equal(received.stockStatus, 'POSTED');
  await post(production + '/runs/' + corrected._id + '/stock', receiptBody, 200);
  assert.deepEqual(await inventory(spinOutput.yarnSpec), [10, 19]);
  await post(production + '/runs/' + corrected._id + '/stock', { mode: 'POST', date }, 409);
  await post(production + '/runs/' + corrected._id + '/correct', { ...spinData, reason: 'Must undo stock first' }, 409);
  await post(production + '/runs/' + corrected._id + '/stock/undo', { reason: 'Warehouse recount' }, 200);
  assert.deepEqual(await inventory(spinOutput.yarnSpec), [0, 0]);

  const supplier = await post('/parties', { name: 'Production supplier fixture', tags: { isYarnSupplier: true } });
  const external = await post('/workspace/documents', {
    kind: 'YARN_RECEIPT', date: dayIso, partyId: supplier._id, reference: 'WEIGH-1',
    items: [{ yarnSpec: spinOutput.yarnSpec, ownerKey: 'OWN', rolls: 10, weightKg: 19, packageUnit: 'cones' }]
  });
  const candidates = await get(production + '/runs/' + corrected._id + '/receipts');
  assert.equal(candidates[0].id, external._id);
  await post(production + '/runs/' + corrected._id + '/stock', { mode: 'POST', date }, 409);
  const linked = await post(production + '/runs/' + corrected._id + '/stock', { mode: 'LINK', receiptId: external._id }, 200);
  assert.equal(linked.stockEvents.at(-1).receiptNumber, external.number);
  assert.deepEqual(await inventory(spinOutput.yarnSpec), [10, 19]);
  const another = await post(production + '/runs', { ...spinData, reference: 'RUN-B', output: { ...spinOutput, weightKg: 19 } });
  await post(production + '/runs/' + another._id + '/stock', { mode: 'LINK', receiptId: external._id }, 409);
  await post('/workspace/documents/' + external._id + '/reverse', { reason: 'Linked receipt remains protected' }, 400);
  await post(production + '/runs/' + corrected._id + '/stock/undo', { reason: 'Unlink warehouse receipt' }, 200);
  assert.deepEqual(await inventory(spinOutput.yarnSpec), [10, 19]);
  await post('/workspace/documents/' + external._id + '/reverse', { reason: 'Reverse unlinked receipt' }, 200);
  assert.deepEqual(await inventory(spinOutput.yarnSpec), [0, 0]);
  console.log('PASS stock handoff once, receipt matching, linked receipt protection, unlink and reversal.');

  const rewindInput = { yarnSpec: 'RW input fixture', packageUnit: 'cartons', quantity: 3, weightKg: 15 };
  const rewindOutput = { yarnSpec: 'RW output fixture', packageUnit: 'cones', quantity: 6, weightKg: 14 };
  const rewindData = { machineId: rewind._id, productionDate: date, shift: 'NIGHT', reference: 'RW-1', output: rewindOutput, input: rewindInput, wasteKg: 1 };
  await post(production + '/runs', { ...rewindData, wasteKg: 2 }, 400);
  const rewound = await post(production + '/runs', rewindData);
  await post(production + '/runs/' + rewound._id + '/stock', { mode: 'POST', date }, 400);
  assert.equal((await get(production + '/runs/' + rewound._id)).stockStatus, 'AWAITING');
  assert.deepEqual(await inventory(rewindOutput.yarnSpec), [0, 0]);
  await post('/workspace/documents', { kind: 'YARN_ADJUSTMENT', date: dayIso, remarks: 'Input counted',
    items: [{ yarnSpec: rewindInput.yarnSpec, rolls: 5, weightKg: 25, packageUnit: 'cartons' }] });
  await post(production + '/runs/' + rewound._id + '/stock', { mode: 'POST', date }, 200);
  assert.deepEqual(await inventory(rewindInput.yarnSpec, 'cartons'), [2, 10]);
  assert.deepEqual(await inventory(rewindOutput.yarnSpec), [6, 14]);
  const movements = (await get('/production/movements?material=YARN&search=RW-1')).items;
  assert.equal(movements.length, 2);
  assert.ok(movements.every(row => row.sourceKind === 'YARN_PRODUCTION' && row.sourceId === rewound._id));
  await post(production + '/runs/' + rewound._id + '/stock/undo', { reason: 'Undo rewinding posting' }, 200);
  assert.deepEqual(await inventory(rewindInput.yarnSpec, 'cartons'), [5, 25]);
  assert.deepEqual(await inventory(rewindOutput.yarnSpec), [0, 0]);
  await post(production + '/runs/' + rewound._id + '/stock', { mode: 'POST', date }, 200);
  const knitter = await post('/parties', { name: 'Machine production knitter', tags: { isKnitter: true } });
  const issue = await post('/knitting/transactions/bulk', {
    transactionType: 'OUTWARD_TO_KNITTER', partyId: knitter._id, gatePassNo: 'RW-OUT', date: dayIso,
    items: [{ yarnSpec: rewindOutput.yarnSpec, boxCount: 2, totalWeightKg: 4, packageUnit: 'cones' }]
  });
  await post(production + '/runs/' + rewound._id + '/stock/undo', { reason: 'Output has left the store' }, 409);
  assert.deepEqual(await inventory(rewindInput.yarnSpec, 'cartons'), [2, 10]);
  assert.deepEqual(await inventory(rewindOutput.yarnSpec), [4, 10]);
  await post('/workspace/yarn-deliveries/' + issue.transactions[0]._id + '/reverse', { reason: 'Return yarn to store' }, 200);
  await post(production + '/runs/' + rewound._id + '/stock/undo', { reason: 'Undo after yarn returned' }, 200);
  assert.equal((await stats('shift=NIGHT&location=Winding%20floor')).summary[0].usableKg, 14);
  await api('PUT', production + '/machines/' + rewind._id, { requestId: randomUUID(), name: 'Renamed', process: 'SPINNING',
    location: 'Different floor', active: false });
  assert.equal((await get(production + '/runs/' + rewound._id)).location, 'Winding floor');
  await post(production + '/runs', { ...rewindData, reference: 'RW-2' }, 400);
  const readUser = await User.create({ fullName: 'Read only', email: 'production-reader@example.invalid', passwordHash: 'fixture',
    role: 'viewer', permissions: ['knitting:read'], businessIds: [company._id] });
  await api('GET', production + '/runs', undefined, 200, tokenFor(readUser));
  await api('POST', production + '/runs', { requestId: randomUUID(), ...spinData }, 403, tokenFor(readUser));
  const otherPrefix = '/businesses/' + other._id + production;
  assert.equal((await get(otherPrefix + '/runs')).total, 0);
  await api('GET', otherPrefix + '/runs/' + rewound._id, undefined, 404);
  console.log('PASS measured rewinding, atomic stock failure and reversal, machine retirement and business permissions.');

  if (process.env.QA_YARN_PRODUCTION_BROWSER === '1') {
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
    await page.getByLabel('Email address').fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
    await page.goto(host + '/yarn');
    await page.getByRole('button', { name: 'Machine Production', exact: true }).click();
    await page.getByRole('button', { name: 'Machine Setup' }).click();
    await page.getByRole('button', { name: 'Add Machine' }).click();
    await page.getByLabel('Machine code').fill('UI-SP-1');
    await page.getByLabel('Machine name').fill('Browser Spinning');
    await page.getByLabel('Production location').fill('Pilot floor');
    await page.getByRole('button', { name: 'Save Machine' }).click();
    const setup = page.getByRole('dialog', { name: 'Machine Setup' });
    await setup.getByText(/UI-SP-1/).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Record Production', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Record Production' });
    const machineOptions = form.getByLabel('Machine', { exact: true });
    await machineOptions.selectOption({ label: 'UI-SP-1 · Browser Spinning' });
    await form.getByLabel('Shift').selectOption('NIGHT');
    const fillRun = async (reference, outputKg) => {
      await form.getByLabel('Batch or run reference').fill(reference);
      await form.getByLabel('Output yarn count').fill('UI PRODUCTION YARN');
      await form.getByLabel('Output packages').fill('5');
      await form.getByLabel('Usable kg').fill(outputKg);
      await form.getByLabel('Waste kg').fill('1');
    };
    await fillRun('BROWSER-RUN-1', '25');
    await form.getByRole('button', { name: 'Save & Add Another' }).click();
    await form.getByText('Production entry saved.', { exact: true }).waitFor();
    assert.equal(await form.getByLabel('Shift').inputValue(), 'NIGHT');
    assert.equal(await form.getByLabel('Production date').inputValue(), date);
    await machineOptions.selectOption({ label: 'UI-SP-1 · Browser Spinning' });
    await form.getByLabel('Batch or run reference').fill('BROWSER-RUN-1');
    await form.getByText(/already recorded/).waitFor();
    await fillRun('BROWSER-RUN-2', '30');
    await form.getByRole('button', { name: 'Save Production', exact: true }).click();
    await form.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'UI-SP-1 · Browser Spinning', exact: true }).click();
    await page.getByText('55.000 usable kg · 2.000 waste kg', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'BROWSER-RUN-1', exact: true }).click();
    await page.getByRole('button', { name: 'Receive into Stock' }).click();
    await page.getByRole('button', { name: 'Post Stock Receipt' }).click();
    await page.getByRole('dialog', { name: 'Production Details' }).getByText('Stock received', { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Movement history' }).click();
    await page.getByLabel('Find yarn').fill('BROWSER-RUN-1');
    await page.getByRole('row').filter({ hasText: 'BROWSER-RUN-1' }).getByRole('link', { name: 'View production run' }).click();
    await page.getByRole('dialog', { name: 'Production Details' }).getByText(/BROWSER-RUN-1/).waitFor();
    console.log('PASS browser machine setup, quick repeat entry, duplicate warning, drill-down and warehouse handoff.');
  }
} finally {
  if (browser) await browser.close();
  if (web) await new Promise(resolve => web.close(resolve));
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await replica.stop();
}
