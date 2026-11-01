import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from '../server/node_modules/mongoose/index.js';
import { MongoMemoryReplSet } from '../server/node_modules/mongodb-memory-server/index.js';

process.env.NODE_ENV = 'test';process.env.JWT_ACCESS_SECRET = 'settlement-isolated-test';process.env.JWT_REFRESH_SECRET = 'settlement-isolated-refresh';
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGODB_URI = replica.getUri();
let server;
try {
  await mongoose.connect(process.env.MONGODB_URI);
  const { businessContext } = await import('../server/dist/business/context.js');
  const { Business } = await import('../server/dist/business/Business.js');
  const { BusinessDocument, BillPayment } = await import('../server/dist/business/commerce.models.js');
  const { Party } = await import('../server/dist/models/Party.js');
  const { User } = await import('../server/dist/models/User.js');
  const { PaymentVoucher } = await import('../server/dist/models/PaymentVoucher.js');
  const { PartyLedgerEntry } = await import('../server/dist/models/PartyLedgerEntry.js');
  const { submitOperation, payBill } = await import('../server/dist/business/commerce.js');
  const { operationInput } = await import('../server/dist/business/commerce.schema.js');
  const { postReturn } = await import('../server/dist/business/returns.js');
  const { createApp } = await import('../server/dist/app.js');
  const { signAccessToken } = await import('../server/dist/utils/jwt.js');
  const business = await Business.create({ name: 'Settlement verification', code: 'SETTLEMENT', isActive: true });
  const user = await User.create({ fullName: 'Fixture admin', email: 'settlement@example.invalid', passwordHash: 'fixture', role: 'admin', isActive: true });
  const context = { businessId: String(business._id), name: business.name, actorId: String(user._id), usesExistingRecords: false };
  let unknown, normal;
  await businessContext.run(context, async () => {
    const party = await Party.create({ name: 'Fixture supplier', code: 'SUPPLIER', openingBalance: 0, currentBalance: 0 });
    normal = await submitOperation(operationInput.parse({ kind: 'FABRIC_PURCHASE', partyId: String(party._id), date: '2026-10-01', reference: 'TRACKED-FIXTURE', requestId: randomUUID(), items: [{ fabricType: 'Fixture raw fabric', yarnSpec: '150/48', state: 'RAW_ECRU', color: 'ECRU', rolls: 1, weightKg: 100, rate: 10 }] }));
    assert.equal(normal.settlementStatus, 'TRACKED');
    unknown = await BusinessDocument.create({ number: 'UNKNOWN-FIXTURE', kind: 'SUPPLIER_BILL', direction: 'PAYABLE', partyId: party._id, date: new Date('2026-10-01T00:00:00Z'), baseAmount: 1000, total: 1000, paid: 0, credited: 0, status: 'POSTED', settlementStatus: 'NOT_RECORDED', actorId: String(user._id), items: [{ fabricType: 'Imported bill', weightKg: 100, rate: 10, basis: 'KG' }] });
    const counts = { ledger: await PartyLedgerEntry.countDocuments(), vouchers: await PaymentVoucher.countDocuments(), payments: await BillPayment.countDocuments(), documents: await BusinessDocument.countDocuments() };
    const balance = (await Party.findById(party._id)).currentBalance;
    for (const refund of [false, true]) await assert.rejects(payBill(String(unknown._id), { amount: 100, date: '2026-10-02T00:00:00.000Z', requestId: randomUUID(), refund }), /not linked to this bill/);
    await assert.rejects(postReturn(String(unknown._id), { date: '2026-10-02T00:00:00.000Z', reason: 'Unknown past credits must not be repeated', requestId: randomUUID(), items: [{ lineId: String(unknown.items[0]._id), rolls: 1, weightKg: 10 }] }), /not linked to this bill/);
    assert.equal((await Party.findById(party._id)).currentBalance, balance);
    assert.deepEqual({ ledger: await PartyLedgerEntry.countDocuments(), vouchers: await PaymentVoucher.countDocuments(), payments: await BillPayment.countDocuments(), documents: await BusinessDocument.countDocuments() }, counts);
    const payment = await payBill(String(normal._id), { amount: 100, date: '2026-10-02T00:00:00.000Z', requestId: randomUUID() });
    assert.equal(payment.amount, 100);assert.equal((await BusinessDocument.findById(normal._id)).paid, 100);assert.equal((await Party.findById(party._id)).currentBalance, -900);
  });
  server = createApp().listen(0, '127.0.0.1');await new Promise(resolve => server.once('listening', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port + '/api/businesses/' + business._id;
  const token = signAccessToken({ userId: String(user._id), email: user.email, role: 'admin', permissions: [] });
  const headers = { Authorization: 'Bearer ' + token };
  for (const route of ['/workspace/documents?search=UNKNOWN-FIXTURE&format=csv', '/workspace/documents/' + unknown._id + '/export?format=csv']) {
    const response = await fetch(origin + route, { headers });assert.equal(response.status, 200);const csv = await response.text();assert.equal((csv.match(/NOT RECORDED/g) || []).length, 2);assert(csv.includes('1000'));
  }
  const response = await fetch(origin + '/workspace/documents/' + normal._id + '/export?format=csv', { headers });assert.equal(response.status, 200);const csv = await response.text();assert(!csv.includes('NOT RECORDED'));assert(csv.includes('900'));assert(csv.includes('100'));
  const original = await fetch(origin + '/workspace/documents/' + unknown._id, { headers });assert.equal((await original.json()).data.settlementStatus, 'NOT_RECORDED');
  console.log('PASS unknown imported settlements: schema status preserved, no fabricated paid/outstanding exports, payments/refunds/credits rejected atomically, and normal tracked bills still post settlements.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));await mongoose.disconnect();await replica.stop();
}
