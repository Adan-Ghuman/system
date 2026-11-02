import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from '../server/node_modules/mongoose/index.js';
import { MongoMemoryReplSet } from '../server/node_modules/mongodb-memory-server/index.js';

process.env.NODE_ENV = 'test';process.env.JWT_ACCESS_SECRET = 'flow-corrections-access';process.env.JWT_REFRESH_SECRET = 'flow-corrections-refresh';
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGODB_URI = replica.getUri();
let server;
try {
  await mongoose.connect(process.env.MONGODB_URI);
  const { createApp } = await import('../server/dist/app.js');
  const { User } = await import('../server/dist/models/User.js');
  const { Business } = await import('../server/dist/business/Business.js');
  const { signAccessToken } = await import('../server/dist/utils/jwt.js');
  const business = await Business.create({ name: 'Correction verification', code: 'CORRECTIONS' });
  const user = await User.create({ fullName: 'Correction fixture', email: 'corrections@example.invalid', passwordHash: 'fixture', role: 'admin', businessIds: [business._id] });
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  const token = signAccessToken({ userId: String(user._id), email: user.email, role: 'admin', permissions: [] });
  server = createApp().listen(0, '127.0.0.1');await new Promise(resolve => server.once('listening', resolve));
  const r = async (method, path, body, expected = method === 'POST' ? 201 : 200) => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/businesses/' + business._id + path, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const json = await response.json();assert.equal(response.status, expected, JSON.stringify({ path, json }));return json.data;
  };
  const party = await r('POST', '/parties', { name: 'Correction customer', tags: { isFabricBuyer: true } });
  const roll = { rollNumber: 1, grossWeightKg: 20, tareKg: 0 };
  const receipt = async name => r('POST', '/workspace/documents', { kind: 'FABRIC_RECEIPT', partyId: party._id, date: '2026-10-01', requestId: randomUUID(), items: [{ fabricType: name, yarnSpec: '150/48', color: 'NAVY', state: 'FINISHED_DYED', rolls: 5, weightKg: 100 }] });
  const delivery = async (name, billNow = false) => r('POST', '/dispatch', { customerId: party._id, fromLocation: 'ZR_GODOWN', fabricType: name, yarnSpec: '150/48', color: 'NAVY', state: 'FINISHED_DYED', rolls: [roll], date: '2026-10-02T00:00:00.000Z', billNow, ratePerKg: 100, invoiceType: 'NON_GST', requestId: randomUUID() });
  const reverse = (path, expected = 200) => r('POST', path + '/reverse', { reason: 'Verify correction dependency and exact reversal.', requestId: randomUUID() }, expected);
  const db = mongoose.connection.db;
  await receipt('Multi delivery fixture');
  const first = await delivery('Multi delivery fixture'), second = await delivery('Multi delivery fixture');
  const bill = await r('POST', '/workspace/documents', { kind: 'CUSTOMER_BILL', partyId: party._id, date: '2026-10-03', requestId: randomUUID(), items: [first, second].map(value => ({ sourceId: value.dispatch._id, sourceLineId: value.dispatch._id, rolls: 1, weightKg: 20, rate: 100 })) });
  const stockBefore = await db.collection('business_fabricinventories').findOne({ fabricType: 'Multi delivery fixture' });
  assert.equal((await r('GET', '/dispatch?search=' + first.dispatch.dispatchNo)).items[0].canBill, false);
  await reverse('/dispatch/' + first.dispatch._id, 400);
  assert.deepEqual(await db.collection('business_fabricinventories').findOne({ _id: stockBefore._id }), stockBefore);
  assert.equal((await r('GET', '/workspace/documents/' + bill._id)).status, 'POSTED');
  assert.equal(await db.collection('business_billallocations').countDocuments({ billId: new mongoose.Types.ObjectId(bill._id) }), 2);
  await reverse('/workspace/documents/' + bill._id);
  assert.equal((await r('GET', '/dispatch/' + first.dispatch._id)).canBill, true);
  await reverse('/dispatch/' + first.dispatch._id);await reverse('/dispatch/' + second.dispatch._id);
  assert.equal((await db.collection('business_fabricinventories').findOne({ _id: stockBefore._id })).totalWeightKg, 100);
  console.log('PASS multi-delivery bill dependency: blocked reversal is atomic; bill-first correction restores stock once.');

  await receipt('Invoice reversal fixture');
  const invoiced = await delivery('Invoice reversal fixture', true);
  await reverse('/workspace/documents/' + invoiced.invoice._id);
  assert.equal((await r('GET', '/dispatch/' + invoiced.dispatch._id)).invoice, null);
  assert.equal((await r('GET', '/dispatch?search=' + invoiced.dispatch.dispatchNo)).items[0].invoice, null);
  const filtered = await r('GET', '/dispatch?invoiceType=NON_GST&search=' + invoiced.dispatch.dispatchNo);assert.equal(filtered.total, 0);
  const replacement = await r('POST', '/workspace/documents', { kind: 'CUSTOMER_BILL', partyId: party._id, sourceId: invoiced.dispatch._id, date: '2026-10-04', requestId: randomUUID(), items: [{ sourceLineId: invoiced.dispatch._id, rolls: 1, weightKg: 20, rate: 100 }] });
  await reverse('/dispatch/' + invoiced.dispatch._id);
  assert.equal((await r('GET', '/workspace/documents/' + replacement._id)).status, 'REVERSED');
  console.log('PASS reversed invoice is absent from active delivery billing/detail/filter; replacement bill reverses with delivery.');

  const entries = await db.collection('business_partyledgerentries').find({ referenceType: 'ADJUSTMENT', referenceId: { $exists: true } }).toArray();assert.ok(entries.length);
  for (const entry of entries) {
    await r('PUT', '/accounts/ledger/entry/' + entry._id, { amount: 1 }, 400);
    await r('DELETE', '/accounts/ledger/entry/' + entry._id, undefined, 400);
    assert.deepEqual(await db.collection('business_partyledgerentries').findOne({ _id: entry._id }), entry);
  }
  console.log('PASS source-backed reversal ledger entries cannot be independently edited or deleted.');

  await receipt('Physical return fixture');
  const returned = await delivery('Physical return fixture', true);
  const returnBody = { date: '2026-10-03T00:00:00.000Z', reason: 'Verify measured quantity reconciliation.', requestId: randomUUID(), items: [{ lineId: returned.invoice._id, rolls: 1, weightKg: 10 }] };
  const original = await r('GET', '/workspace/documents/' + returned.invoice._id);returnBody.items[0].lineId = original.items[0]._id;
  await r('POST', '/workspace/documents/' + original._id + '/returns', returnBody, 400);
  const credit = await r('POST', '/workspace/documents/' + original._id + '/returns', { ...returnBody, requestId: randomUUID(), items: [{ ...returnBody.items[0], weightKg: 20 }] });
  assert.equal(credit.total, 2000);await reverse('/workspace/documents/' + credit._id);
  const parties = await db.collection('partyaccounts').find({}).toArray();
  const ledger = await db.collection('business_partyledgerentries').find({}).sort({ date: 1, createdAt: 1, _id: 1 }).toArray();
  for (const row of parties) { let cents = Math.round((row.openingBalance || 0) * 100);for (const entry of ledger.filter(e => String(e.partyId) === String(row._id))) { cents += (entry.entryType === 'DEBIT' ? 1 : -1) * Math.round(entry.amount * 100);assert.equal(Math.round(entry.runningBalance * 100), cents); }assert.equal(Math.round(row.currentBalance * 100), cents); }
  console.log('PASS physical returns reconcile final rolls with measured kg; complete correction ledger balances reconcile.');
  await r('POST', '/workspace/documents', { kind: 'YARN_ADJUSTMENT', date: '2026-10-01', remarks: 'Historical balance fixture opening yarn.', requestId: randomUUID(), items: [{ yarnSpec: 'Historical fixture yarn', rolls: 2, weightKg: 40 }] });
  const issued = await r('POST', '/knitting/transactions/bulk', { transactionType: 'OUTWARD_TO_KNITTER', partyId: party._id, gatePassNo: 'HISTORICAL-YARN-OUT', date: '2026-10-02', requestId: randomUUID(), items: [{ yarnSpec: 'Historical fixture yarn', boxCount: 2, totalWeightKg: 40, packageUnit: 'cartons' }] });
  assert.equal((await r('GET', '/production/balances?to=2026-10-03')).yarnWithKnittersKg, 40);
  await reverse('/workspace/yarn-deliveries/' + issued.transactions[0]._id);
  assert.equal((await r('GET', '/production/balances?to=2026-10-03')).yarnWithKnittersKg, 40);
  assert.equal((await r('GET', '/production/balances')).yarnWithKnittersKg, 0);
  console.log('PASS historical yarn balances retain an issue reversed after the cutoff while current balances exclude it.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));await mongoose.disconnect();await replica.stop();
}
