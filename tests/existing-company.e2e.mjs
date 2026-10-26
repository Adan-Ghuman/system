import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyExistingCompany({ mongoose, request, businesses, signAccessToken }) {
  const rozain = businesses.find(company => company.code === 'ROZAIN');const trading = businesses.find(company => company.code === 'ZR');
  const base = company => '/businesses/' + company._id;
  const partyId = new mongoose.Types.ObjectId();const stockId = new mongoose.Types.ObjectId();const ledgerId = new mongoose.Types.ObjectId();
  const date = new Date('2026-09-28T08:00:00Z');
  const party = { _id: partyId, name: 'Existing Rozain party', code: 'PRT-99999', openingBalance: 0, currentBalance: 125, isActive: true, tags: { isFabricBuyer: true }, createdAt: date, updatedAt: date };
  const stock = { _id: stockId, fabricType: 'Existing Rozain fabric', yarnSpec: '75/36', color: 'ECRU', state: 'RAW_ECRU', location: 'ZR_GODOWN', totalRolls: 5, totalWeightKg: 100, createdAt: date, updatedAt: date };
  await mongoose.connection.collection('parties').insertOne(party);
  await mongoose.connection.collection('fabricinventories').insertOne(stock);
  await mongoose.connection.collection('partyledgerentries').insertOne({ _id: ledgerId, partyId, entryType: 'DEBIT', amount: 125, runningBalance: 125, referenceType: 'INVOICE', referenceNo: 'EXISTING-001', date, description: 'Existing balance', createdAt: date, updatedAt: date });
  assert.equal((await request('GET', base(rozain) + '/parties/' + partyId)).currentBalance, 125);
  assert.deepEqual(await mongoose.connection.collection('parties').findOne({ _id: partyId }), party);
  assert.deepEqual(await mongoose.connection.collection('fabricinventories').findOne({ _id: stockId }), stock);
  await request('GET', base(trading) + '/parties/' + partyId, undefined, 404);
  assert.equal((await request('GET', base(trading) + '/inventory/items?search=Existing%20Rozain')).total, 0);
  const ledger = await request('GET', base(rozain) + '/accounts/ledger/' + partyId);
  assert.equal(ledger.closingBalance, 125);assert(ledger.entries.some(item => item.referenceNo === 'EXISTING-001'));
  await request('PUT', base(rozain) + '/parties/' + partyId, { phone: '03001234567' });
  assert.equal((await request('GET', '/parties/' + partyId)).currentBalance, 125);
  await request('POST', base(rozain) + '/inventory/adjustments', { ...stock, _id: undefined, adjustmentRolls: 1, adjustmentWeightKg: 20, reason: 'MANUAL_CORRECTION', date: date.toISOString(), requestId: randomUUID() }, 201);
  const changed = await mongoose.connection.collection('fabricinventories').findOne({ _id: stockId });assert.equal(changed.totalRolls, 6);assert.equal(changed.totalWeightKg, 120);
  assert.equal(await mongoose.connection.collection('fabricinventories').countDocuments({ fabricType: stock.fabricType }), 1);
  assert.equal((await request('GET', base(rozain) + '/parties/next-code')).nextCode, 'PRT-100000');
  for (const company of [rozain, trading]) {
    const locations = await request('GET', base(company) + '/workspace/locations');assert(locations.some(location => location.value === 'ZR_GODOWN' && location.label === (company.code === 'ROZAIN' ? 'Rozain Textile' : company.name + ' Godown')));
  }
  const store = await mongoose.connection.collection('dyeingunits').findOne({ code: 'ZR_GODOWN' });
  const siblingStore = await mongoose.connection.collection('business_dyeingunits').findOne({ businessId: new mongoose.Types.ObjectId(trading._id), code: 'ZR_GODOWN' });
  assert(store && siblingStore);assert.notEqual(String(store._id), String(siblingStore._id));
  const indexes = await mongoose.connection.collection('fabricinventories').listIndexes().toArray();assert(!indexes.some(index => index.unique && Object.keys(index.key).length === 5));assert(indexes.some(index => index.unique && index.key.ownerKey === 1));
  const staffId = new mongoose.Types.ObjectId();await mongoose.connection.collection('users').insertOne({ _id: staffId, fullName: 'Existing operator', email: 'existing-operator@example.invalid', passwordHash: 'fixture', role: 'operator', permissions: ['parties:read'], isActive: true });
  const token = signAccessToken({ userId: String(staffId), email: 'existing-operator@example.invalid', role: 'operator', permissions: ['parties:read'] });
  const response = await fetch('http://127.0.0.1:5182/api/businesses', { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(response.status, 200);const allowed = (await response.json()).data;assert.deepEqual(allowed.map(company => company.code), ['ROZAIN']);
  console.log('PASS existing Rozain IDs/balances/stock unchanged on read, editable records, original ledger, continued numbering, separate sibling godowns and existing staff access.');
}
