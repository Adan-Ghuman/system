import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import mongoose from '../server/node_modules/mongoose/index.js';
import { MongoMemoryReplSet } from '../server/node_modules/mongodb-memory-server/index.js';

process.env.NODE_ENV = 'test';process.env.JWT_ACCESS_SECRET = 'sales-isolated-access';process.env.JWT_REFRESH_SECRET = 'sales-isolated-refresh';
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGODB_URI = replica.getUri();await mongoose.connect(process.env.MONGODB_URI);
const { createApp } = await import('../server/dist/app.js');
const { User } = await import('../server/dist/models/User.js');
const { Business } = await import('../server/dist/business/Business.js');
const { signAccessToken } = await import('../server/dist/utils/jwt.js');
const { businessContext } = await import('../server/dist/business/context.js');
const bcrypt = (await import('../server/node_modules/bcrypt/bcrypt.js')).default;
const admin = await User.create({ fullName: 'Sales QA', email: 'sales-qa@example.invalid', passwordHash: await bcrypt.hash('SalesBrowser-1234', 10), role: 'admin' });
const token = signAccessToken({ userId: String(admin._id), email: admin.email, role: 'admin', permissions: [] });
const server = createApp().listen(5186, '127.0.0.1');await new Promise(resolve => server.once('listening', resolve));
const r = async (method, url, body, expected = method === 'POST' ? 201 : 200, auth = token) => {
  const response = await fetch('http://127.0.0.1:5186/api' + url, { method, headers: { authorization: 'Bearer ' + auth, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();assert.equal(response.status, expected, JSON.stringify({ url, status: response.status, result }));return result.data;
};
const counts = async () => Object.fromEntries(await Promise.all(['dispatches', 'invoices', 'partyledgerentries', 'paymentvouchers', 'business_billpayments', 'business_businessdocuments', 'business_stockmovements', 'business_billallocations'].map(async name => [name, await mongoose.connection.collection(name).countDocuments()])));
try {
  await Business.create({ code: 'ROZAIN', name: 'Rozain Textile' });
  const businesses = await r('GET', '/businesses');const business = businesses.find(b => b.code === 'ROZAIN');
  const customer = await r('POST', '/parties', { name: 'QA Sales customer', tags: { isFabricBuyer: true, isYarnClient: true } });
  const other = await r('POST', '/parties', { name: 'QA Other customer', tags: { isFabricBuyer: true, isYarnClient: true } });
  const knitter = await r('POST', '/parties', { name: 'QA Sales knitter', tags: { isKnitter: true } });
  async function stock(name, rolls = 10, kg = 200) {
    await r('POST', '/workspace/documents', { kind: 'FABRIC_RECEIPT', partyId: customer._id, date: '2026-10-01', requestId: randomUUID(), items: [{ fabricType: name, yarnSpec: '150/48', state: 'FINISHED_DYED', color: 'NAVY', rolls, weightKg: kg }] });
    return (await r('GET', '/inventory/items')).items.find(i => i.fabricType === name);
  }
  const first = await stock('Sales QA fabric');
  const fabricBody = { requestId: randomUUID(), customerId: customer._id, mode: 'FABRIC', date: '2026-10-17T00:00:00.000Z', reference: 'SALE-001', inventoryId: first._id, location: 'ZR_GODOWN', items: [{ rate: 100 }], rolls: Array.from({ length: 10 }, (_, i) => ({ rollNumber: i + 1, grossWeightKg: 20, tareKg: 0, netWeightKg: 99999 })), payment: { kind: 'PART', amount: 5000, method: 'CASH' } };
  const quote = await r('POST', '/workspace/sales/quote', fabricBody, 200);assert.equal(quote.total, 20000);assert.equal(quote.outstanding, 15000);
  const sold = await r('POST', '/workspace/sales', fabricBody);assert.equal(sold.bill.total, 20000);assert.equal(sold.bill.paid, 5000);assert.equal(sold.outstanding, 15000);
  assert.equal((await r('GET', '/parties/' + customer._id)).currentBalance, 15000);
  assert.equal(String((await mongoose.connection.collection('dispatches').findOne({ _id: new mongoose.Types.ObjectId(sold.deliveryId) })).sourceInventoryId), first._id);
  assert.equal((await mongoose.connection.collection('fabricinventories').findOne({ _id: new mongoose.Types.ObjectId(first._id) })).totalRolls, 0);
  const initialCounts = await counts();const replay = await r('POST', '/workspace/sales', fabricBody);assert.equal(replay.bill._id, sold.bill._id);assert.deepEqual(await counts(), initialCounts);
  await r('POST', '/workspace/sales', { ...fabricBody, reference: 'CHANGED' }, 409);
  const register = await r('GET', '/workspace/sales');assert.equal(register.total, 1);assert.equal(register.items[0].canBill, false);assert.equal(register.items[0].total, 20000);assert.equal(register.items[0].documents.length, 1);
  assert.equal((await mongoose.connection.collection('partyledgerentries').findOne({ referenceType: 'PAYMENT' })).amount, 5000);
  console.log('PASS unified fabric sale: server weights, linked partial receipt, one register row, exact balances, durable replay and changed-request rejection.');

  const rollbackStock = await stock('Rollback QA fabric');
  const rollbackBody = { ...fabricBody, requestId: randomUUID(), reference: 'ROLLBACK-001', inventoryId: rollbackStock._id };
  const beforeFailure = await counts();
  await mongoose.connection.db.command({ collMod: 'business_billpayments', validator: { $jsonSchema: { properties: { amount: { maximum: 1 } } } }, validationLevel: 'strict', validationAction: 'error' });
  await r('POST', '/workspace/sales', rollbackBody, 500);assert.deepEqual(await counts(), beforeFailure);
  assert.equal((await mongoose.connection.collection('fabricinventories').findOne({ _id: new mongoose.Types.ObjectId(rollbackStock._id) })).totalWeightKg, 200);
  await mongoose.connection.db.command({ collMod: 'business_billpayments', validator: {} });
  const retried = await r('POST', '/workspace/sales', rollbackBody);assert.equal(retried.total, 20000);
  console.log('PASS payment-write failure rolls back delivery, invoice, stock, allocations, voucher and ledger; exact retry succeeds.');

  const delayedStock = await stock('Bill later QA fabric', 4, 80);
  const delayedBody = { ...fabricBody, requestId: randomUUID(), reference: '', inventoryId: delayedStock._id, billNow: false, rolls: [{ rollNumber: 1, grossWeightKg: 20, tareKg: 0 }, { rollNumber: 2, grossWeightKg: 20, tareKg: 0 }], items: [{}], payment: { kind: 'LATER' } };
  const delayed = await r('POST', '/workspace/sales', delayedBody);assert.equal(delayed.bill, null);
  const sources = await r('GET', '/workspace/sales/sources?kind=EXISTING_DELIVERY&customerId=' + customer._id);const source = sources.items.find(s => s._id === delayed.deliveryId);assert.ok(source);
  const partBody = { requestId: randomUUID(), customerId: customer._id, mode: 'EXISTING_DELIVERY', sourceId: source._id, date: '2026-10-18T00:00:00.000Z', reference: 'LATER-001', items: source.items.map(i => ({ ...i, weightKg: 20, rolls: 1, rate: 100 })), payment: { kind: 'LATER' } };
  await r('POST', '/workspace/sales', partBody);
  const remainder = (await r('GET', '/workspace/sales/sources?kind=EXISTING_DELIVERY&customerId=' + customer._id)).items.find(s => s._id === source._id);
  await r('POST', '/workspace/sales', { ...partBody, requestId: randomUUID(), reference: 'LATER-002', items: remainder.items.map(i => ({ ...i, rate: 100 })) });
  await r('POST', '/workspace/sales', { ...partBody, requestId: randomUUID(), reference: 'LATER-DUPLICATE' }, 400);
  const grouped = (await r('GET', '/workspace/sales')).items.find(row => row.deliveryId === delayed.deliveryId);assert.equal(grouped.documents.length, 2);assert.equal(grouped.total, 4000);assert.equal(grouped.canBill, false);
  assert.equal((await mongoose.connection.collection('fabricinventories').findOne({ _id: new mongoose.Types.ObjectId(delayedStock._id) })).totalRolls, 2);
  console.log('PASS delivery-only, partial later billing, grouped history and no second stock movement.');

  const paperItems = [['Service A', 900, 100], ['Service B', 800, 150], ['Service C', 500, 200], ['Service D', 500, 250]].map(([fabricType, weightKg, rate]) => ({ fabricType, weightKg, rate, basis: 'KG' }));
  const draft = await r('POST', '/workspace/documents', { kind: 'CUSTOMER_BILL', saveAsDraft: true, partyId: customer._id, reference: 'QA-PAPER', date: '2026-10-03', requestId: randomUUID(), items: paperItems });
  const paperBody = { requestId: randomUUID(), customerId: customer._id, mode: 'DYEING_CHARGE', draftId: draft._id, sourceMode: 'PAPER', reference: 'QA-PAPER', date: '2026-10-17T00:00:00.000Z', paper: { confirmed: true, reason: 'Original paper bill QA-PAPER confirms only dyeing for this customer.', periodFrom: '2026-10-03', periodTo: '2026-10-17' }, items: paperItems, payment: { kind: 'UNKNOWN' } };
  const stockMovements = await mongoose.connection.collection('business_stockmovements').countDocuments();
  const paper = await r('POST', '/workspace/sales', paperBody);assert.equal(paper.bill._id, draft._id);assert.equal(paper.total, 435000);assert.equal(paper.outstanding, null);assert.equal(paper.bill.kind, 'DYEING_CHARGE');assert.equal(paper.bill.settlementStatus, 'NOT_RECORDED');assert.equal(paper.bill.serviceEvidence.reference, 'QA-PAPER');
  assert.equal(await mongoose.connection.collection('business_stockmovements').countDocuments(), stockMovements);
  const paperCounts = await counts();await r('POST', '/workspace/sales', { ...paperBody, draftId: undefined, requestId: randomUUID() }, 400);assert.deepEqual(await counts(), paperCounts);
  await r('POST', '/workspace/documents/' + paper.bill._id + '/payments', { amount: 1, date: '2026-10-18T00:00:00.000Z', requestId: randomUUID() }, 400);
  await r('POST', '/workspace/documents/' + paper.bill._id + '/reverse', { reason: 'Unknown settlement must remain protected', requestId: randomUUID() }, 400);
  assert.equal((await r('GET', '/workspace/sales?status=UNKNOWN')).items.find(i => i._id === paper.bill._id).outstanding, null);
  console.log('PASS exact paper bill QA-PAPER total 435,000, legacy-draft conversion, no fabricated stock/receipts, duplicate-reference rejection and unknown-settlement protection.');

  await r('POST', '/knitting/transactions/bulk', { transactionType: 'INWARD_FROM_CLIENT', ownership: 'CLIENT', partyId: customer._id, gatePassNo: 'CLIENT-IN', date: '2026-10-01', requestId: randomUUID(), items: [{ yarnSpec: '100/36', boxCount: 2, totalWeightKg: 100, packageUnit: 'cartons' }] });
  await r('POST', '/knitting/transactions/bulk', { transactionType: 'OUTWARD_TO_KNITTER', ownership: 'CLIENT', ownerPartyId: customer._id, partyId: knitter._id, gatePassNo: 'CLIENT-OUT', date: '2026-10-02', requestId: randomUUID(), items: [{ yarnSpec: '100/36', boxCount: 2, totalWeightKg: 100, packageUnit: 'cartons' }] });
  const knitting = await r('POST', '/knitting/receive', { partyId: knitter._id, ownerKey: customer._id, gatePassNo: 'SERVICE-IN', date: '2026-10-03T00:00:00.000Z', requestId: randomUUID(), items: [{ fabricType: 'Client fabric', yarnSpec: '100/36', rollsCount: 5, weightKg: 100, wastageKg: 0 }] }, 200);
  const serviceSource = (await r('GET', '/workspace/sales/sources?kind=KNITTING_CHARGE&customerId=' + customer._id)).items.find(s => s._id === knitting.receipt._id);assert.ok(serviceSource);
  assert.ok(!(await r('GET', '/workspace/sales/sources?kind=KNITTING_CHARGE&customerId=' + other._id)).items.some(s => s._id === knitting.receipt._id));
  const serviceBody = { requestId: randomUUID(), customerId: customer._id, mode: 'KNITTING_CHARGE', sourceId: serviceSource._id, date: '2026-10-17T00:00:00.000Z', reference: 'KNIT-001', items: serviceSource.items.map(i => ({ ...i, rate: 25 })), payment: { kind: 'LATER' } };
  const serviceMovements = await mongoose.connection.collection('business_stockmovements').countDocuments();await r('POST', '/workspace/sales', { ...serviceBody, customerId: other._id }, 400);
  const serviceBill = await r('POST', '/workspace/sales', serviceBody);assert.equal(serviceBill.total, 2500);assert.equal(await mongoose.connection.collection('business_stockmovements').countDocuments(), serviceMovements);
  console.log('PASS client-owned completed work eligibility, wrong-customer rejection and service billing without stock movement.');

  const existing = await r('POST', '/accounts/vouchers', { partyId: customer._id, voucherType: 'RECEIPT', paymentMode: 'CASH', date: '2026-10-01T00:00:00.000Z', amount: 100, requestId: randomUUID() });
  const ledgerBeforeLink = await mongoose.connection.collection('partyledgerentries').countDocuments();const vouchersBeforeLink = await mongoose.connection.collection('paymentvouchers').countDocuments();
  const linked = await r('POST', '/workspace/sales', { ...paperBody, draftId: undefined, requestId: randomUUID(), reference: 'PAPER-LINK', items: [{ fabricType: 'Dyeing job', basis: 'JOB', rate: 200 }], payment: { kind: 'EXISTING', voucherId: existing._id } });assert.equal(linked.received, 100);assert.equal(linked.outstanding, 100);
  assert.equal(await mongoose.connection.collection('partyledgerentries').countDocuments(), ledgerBeforeLink + 1);assert.equal(await mongoose.connection.collection('paymentvouchers').countDocuments(), vouchersBeforeLink);
  await r('POST', '/workspace/sales', { ...paperBody, draftId: undefined, requestId: randomUUID(), reference: 'PAPER-LINK-AGAIN', payment: { kind: 'EXISTING', voucherId: existing._id } }, 400);
  console.log('PASS existing receipt allocation creates no second cash or credit entry.');

  const concurrentStock = await stock('Concurrent QA fabric', 2, 40);
  const concurrentBody = { ...fabricBody, requestId: randomUUID(), inventoryId: concurrentStock._id, reference: 'CONCURRENT-001', rolls: [{ rollNumber: 1, grossWeightKg: 20, tareKg: 0 }], payment: { kind: 'LATER' } };
  const concurrent = await Promise.all([r('POST', '/workspace/sales', concurrentBody), r('POST', '/workspace/sales', concurrentBody)]);assert.equal(concurrent[0].bill._id, concurrent[1].bill._id);
  assert.equal((await mongoose.connection.collection('fabricinventories').findOne({ _id: new mongoose.Types.ObjectId(concurrentStock._id) })).totalRolls, 1);
  await r('POST', '/workspace/documents', { kind: 'YARN_ADJUSTMENT', date: '2026-10-01', remarks: 'Isolated own-yarn opening', requestId: randomUUID(), items: [{ yarnSpec: '75/72', rolls: 2, weightKg: 40 }] });
  await r('POST', '/knitting/transactions/bulk', { transactionType: 'OUTWARD_TO_KNITTER', partyId: knitter._id, gatePassNo: 'ASSIGN-OUT', date: '2026-10-02', requestId: randomUUID(), items: [{ yarnSpec: '75/72', boxCount: 2, totalWeightKg: 40, packageUnit: 'cartons' }] });
  const unassignedReceipt = await r('POST', '/knitting/receive', { partyId: knitter._id, ownerKey: 'OWN', gatePassNo: 'ASSIGN-IN', date: '2026-10-03T00:00:00.000Z', requestId: randomUUID(), items: [{ fabricType: 'Assigned work', yarnSpec: '75/72', rollsCount: 2, weightKg: 40, wastageKg: 0 }] }, 200);
  const unassigned = (await r('GET', '/workspace/sales/sources?kind=KNITTING_CHARGE&customerId=' + customer._id)).unassigned.find(s => s._id === unassignedReceipt.receipt._id);assert.ok(unassigned);
  await r('POST', '/workspace/sales/assign-source', { customerId: customer._id, kind: 'KNITTING_CHARGE', sourceId: unassigned._id, sourceLineId: unassigned.items[0].sourceLineId, reason: 'Customer confirmed this processing job contract.', requestId: randomUUID() }, 200);
  await r('POST', '/workspace/sales/assign-source', { customerId: other._id, kind: 'KNITTING_CHARGE', sourceId: unassigned._id, sourceLineId: unassigned.items[0].sourceLineId, reason: 'Attempt to assign the same work twice.', requestId: randomUUID() }, 400);
  console.log('PASS concurrent identical submissions and audited source-customer assignment without changing ownership.');

  const draftStock = await stock('Draft completion fabric', 1, 1.005);
  const savedDraft = await r('POST', '/workspace/sales/drafts', { requestId: randomUUID(), customerId: customer._id, mode: 'FABRIC', reference: 'DRAFT-POST' });
  const completedDraft = await r('POST', '/workspace/sales', { ...fabricBody, draftId: savedDraft._id, inventoryId: draftStock._id, requestId: randomUUID(), reference: 'DRAFT-POST', rolls: [{ rollNumber: 1, grossWeightKg: 1.005, tareKg: 0 }], items: [{ rate: 1 }], payment: { kind: 'FULL' } });
  assert.equal(completedDraft.total, 1.01);assert.equal(completedDraft.bill.paid, 1.01);assert.equal((await r('GET', '/workspace/sales?search=DRAFT-POST')).total, 1);
  await r('POST', '/workspace/sales', { ...paperBody, requestId: randomUUID(), draftId: undefined, reference: 'BAD-RANGE', items: [{ fabricType: 'Overflow', basis: 'KG', weightKg: 1e200, rate: 1e200 }] }, 400);
  console.log('PASS completed drafts appear once, three-decimal kg/currency rounding agree, and monetary overflow is rejected.');

  const linkedVoucherBefore = await mongoose.connection.collection('paymentvouchers').findOne({ _id: new mongoose.Types.ObjectId(existing._id) });
  const allocation = await mongoose.connection.collection('business_billpayments').findOne({ billId: new mongoose.Types.ObjectId(linked.bill._id), status: 'POSTED' });
  const entriesBeforeUnlink = await mongoose.connection.collection('partyledgerentries').countDocuments();
  await r('POST', '/workspace/payments/' + allocation._id + '/reverse', { reason: 'Correct the bill without duplicating the existing receipt.', requestId: randomUUID() }, 200);
  assert.equal(await mongoose.connection.collection('partyledgerentries').countDocuments(), entriesBeforeUnlink);
  assert.deepEqual(await mongoose.connection.collection('paymentvouchers').findOne({ _id: linkedVoucherBefore._id }), linkedVoucherBefore);
  await r('POST', '/workspace/documents/' + linked.bill._id + '/reverse', { reason: 'Reverse this reconciled service charge.', requestId: randomUUID() }, 200);
  await r('POST', '/dispatch/' + sold.deliveryId + '/reverse', { reason: 'Payments must be reversed first.', requestId: randomUUID() }, 400);
  const salePayment = await mongoose.connection.collection('business_billpayments').findOne({ billId: new mongoose.Types.ObjectId(sold.bill._id), status: 'POSTED' });
  await r('POST', '/workspace/payments/' + salePayment._id + '/reverse', { reason: 'Reverse the receipt before correcting the delivery.', requestId: randomUUID() }, 200);
  await r('POST', '/dispatch/' + sold.deliveryId + '/reverse', { reason: 'Correct the delivery after its receipt reversal.', requestId: randomUUID() }, 200);
  assert.equal((await mongoose.connection.collection('fabricinventories').findOne({ _id: new mongoose.Types.ObjectId(first._id) })).totalRolls, 10);
  console.log('PASS allocation-only unlink preserves cash, receipt-before-delivery correction order and one stock restoration.');

  const staff = await User.create({ fullName: 'Delivery-only QA', email: 'delivery-qa@example.invalid', passwordHash: 'fixture', role: 'operator', permissions: ['accounts:read', 'dispatch:read', 'dispatch:write'], businessIds: [business._id] });
  const staffToken = signAccessToken({ userId: String(staff._id), email: staff.email, role: staff.role, permissions: staff.permissions });
  await r('POST', '/workspace/sales', { ...fabricBody, requestId: randomUUID() }, 403, staffToken);
  await r('POST', '/workspace/sales', { ...paperBody, draftId: undefined, requestId: randomUUID() }, 403, staffToken);
  const partyRows = await mongoose.connection.collection('parties').find({}).toArray();
  await businessContext.run({ businessId: business._id, actorId: String(admin._id), name: 'Rozain Textile', usesExistingRecords: true }, async () => {
    const entries = await mongoose.connection.collection('partyledgerentries').find({}).sort({ date: 1, createdAt: 1, _id: 1 }).toArray();
    for (const party of partyRows) { let balance = Math.round((party.openingBalance || 0) * 100);for (const entry of entries.filter(e => String(e.partyId) === String(party._id))) { balance += (entry.entryType === 'DEBIT' ? 1 : -1) * Math.round(entry.amount * 100);assert.equal(Math.round(entry.runningBalance * 100), balance); }assert.equal(Math.round(party.currentBalance * 100), balance); }
  });
  const ledgerRows = await mongoose.connection.collection('partyledgerentries').find({}).toArray();
  for (const entry of ledgerRows) {
    if (entry.referenceType === 'PAYMENT') {
      const voucher = await mongoose.connection.collection('paymentvouchers').findOne({ _id: entry.referenceId });
      assert.ok(voucher);assert.equal(voucher.amount, entry.amount);assert.equal(String(voucher.partyId), String(entry.partyId));assert.equal(voucher.voucherType, entry.entryType === 'CREDIT' ? 'RECEIPT' : 'PAYMENT');
    } else if (entry.referenceType === 'BILL') {
      const bill = await mongoose.connection.collection('business_businessdocuments').findOne({ _id: entry.referenceId });
      assert.ok(bill);assert.equal(bill.total, entry.amount);assert.equal(String(bill.partyId), String(entry.partyId));assert.equal(bill.direction, entry.entryType === 'DEBIT' ? 'RECEIVABLE' : 'PAYABLE');assert.equal(Math.round((bill.baseAmount + bill.taxAmount) * 100), Math.round(bill.total * 100));
    }
  }
  const output = 'scratch/sales-qa';await fs.mkdir(output, { recursive: true });
  await fs.writeFile(output + '/api-fixtures.json', JSON.stringify({ customer, other, knitter, business, sold, paper, serviceBill }), { mode: 0o600 });
  if (process.env.QA_SALES_BROWSER === '1') { const { runSalesBrowserQA } = await import('./unified-sales.browser.mjs');await runSalesBrowserQA({ token, customer, business }); }
  console.log('PASS all unified API scenarios and chronological customer balance reconciliation.');
} finally { await new Promise(resolve => server.close(resolve));await mongoose.disconnect();await replica.stop(); }
