import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyOwnerAliases({ mongoose, request, businesses }) {
  const business = businesses.find(item => item.code === 'ROZAIN');
  const aliases = [];
  for (const name of ['Rozain Textile Godown', 'Rozain Knitting', 'Rozain Textile']) {
    aliases.push(await request('POST', '/parties', { name, openingBalance: 15 }, 201));
  }
  const foreign = await request('POST', '/parties', { name: 'Independent owner', openingBalance: 25 }, 201);
  const mill = (await request('GET', '/dyeing/units')).find(unit => unit.type === 'DYEING_MILL' && unit.isActive);
  for (const [index, alias] of aliases.entries()) {
    const id = new mongoose.Types.ObjectId();
    const fabricType = 'Legacy owner fabric ' + index;
    const original = { _id: id, businessId: new mongoose.Types.ObjectId(business._id), fabricType, yarnSpec: '150/48', color: 'ECRU', state: 'RAW_ECRU', location: 'ZR_GODOWN', ownerKey: alias._id, totalRolls: 12, totalWeightKg: 257.65 };
    await mongoose.connection.collection('fabricinventories').insertOne(original);
    const listed = (await request('GET', '/inventory/items?search=' + encodeURIComponent(fabricType))).items.find(item => item._id === String(id));
    assert.equal(listed.ownerKey, 'OWN');
    const input = { millName: mill.code, ownerKey: index === 1 ? alias._id : 'OWN', ogpNo: 'ALIAS-' + index, dateIssued: '2026-10-20T08:00:00.000Z', requestId: randomUUID(), entries: [{ fabricType, yarnSpec: '150/48', targetColor: 'NAVY', ecruRollsCount: 12, ecruWeightKg: 257.65 }] };
    const result = await request('POST', '/dyeing/gate-passes', input, 201);
    const batch = Array.isArray(result) ? result[0] : result.batches[0];
    assert.equal(batch.ownerKey, 'OWN');
    const used = await mongoose.connection.collection('fabricinventories').findOne({ _id: id });
    assert.equal(used.totalRolls, 0);assert.equal(used.totalWeightKg, 0);assert.equal(used.ownerKey, alias._id);
    await request('POST', '/workspace/dyeing-issues/' + batch._id + '/reverse', { reason: 'Verify legacy owner reversal', requestId: randomUUID() });
    const restored = await mongoose.connection.collection('fabricinventories').findOne({ _id: id });
    assert.equal(restored.totalRolls, 12);assert.equal(restored.totalWeightKg, 257.65);assert.equal(restored.ownerKey, alias._id);
    assert.equal((await request('GET', '/parties/' + alias._id)).currentBalance, 15);
  }
  const otherStockId = new mongoose.Types.ObjectId();
  await mongoose.connection.collection('fabricinventories').insertOne({ _id: otherStockId, businessId: new mongoose.Types.ObjectId(business._id), fabricType: 'Independent owner fabric', yarnSpec: '150/48', color: 'ECRU', state: 'RAW_ECRU', location: 'ZR_GODOWN', ownerKey: foreign._id, totalRolls: 12, totalWeightKg: 257.65 });
  await request('POST', '/dyeing/gate-passes', { millName: mill.code, ownerKey: 'OWN', ogpNo: 'OTHER-OWNER-BLOCK', dateIssued: '2026-10-20T08:00:00.000Z', requestId: randomUUID(), entries: [{ fabricType: 'Independent owner fabric', yarnSpec: '150/48', targetColor: 'NAVY', ecruRollsCount: 12, ecruWeightKg: 257.65 }] }, 400);
  assert.equal((await mongoose.connection.collection('fabricinventories').findOne({ _id: otherStockId })).totalWeightKg, 257.65);
  assert.equal((await request('GET', '/parties/' + foreign._id)).currentBalance, 25);
  const added = await request('POST', '/inventory/adjustments', { fabricType: 'New canonical owner fabric', yarnSpec: '150/48', color: 'ECRU', state: 'RAW_ECRU', location: 'ZR_GODOWN', ownerKey: aliases[0]._id, adjustmentRolls: 1, adjustmentWeightKg: 20, reason: 'MANUAL_CORRECTION', remarks: 'Verified owner alias normalization', date: '2026-10-20T08:00:00.000Z', requestId: randomUUID() }, 201);
  assert.equal(added.ownerKey, 'OWN');
  const canonical = await mongoose.connection.collection('fabricinventories').findOne({ fabricType: 'New canonical owner fabric' });assert.equal(canonical.ownerKey, 'OWN');
  const yarnSpec = 'Owner alias yarn';
  const date = new Date('2026-10-01T08:00:00.000Z');
  const businessId = new mongoose.Types.ObjectId(business._id);
  await mongoose.connection.collection('business_yarninventories').insertOne({ businessId, yarnSpec, ownerKey: aliases[1]._id, packageUnit: 'cartons', quantity: 1, totalWeightKg: 10 });
  await mongoose.connection.collection('yarntransactions').insertOne({ businessId, transactionType: 'OUTWARD_TO_KNITTER', partyId: new mongoose.Types.ObjectId(foreign._id), yarnSpec, ownerKey: aliases[0]._id, gatePassNo: 'LEGACY-ALIAS-YARN', date, boxCount: 1, netWeightPerBox: 5, grossWeightKg: 5, totalWeightKg: 5, packageUnit: 'cartons', wastagePercent: 0, wastageWeightKg: 0, netExpectedFabricKg: 5, receivedFabricKg: 0, actualWastageKg: 0, remainingYarnBalanceKg: 5, status: 'POSTED' });
  const issue = await request('POST', '/knitting/transactions', { transactionType: 'OUTWARD_TO_KNITTER', partyId: foreign._id, yarnSpec, gatePassNo: 'CANONICAL-ALIAS-YARN', date: '2026-10-02T08:00:00.000Z', boxCount: 1, totalWeightKg: 10, ownership: 'OWN', requestId: randomUUID() }, 201);
  assert.equal(issue.ownerKey, 'OWN');
  const balances = (await request('GET', '/knitting/balances?page=1&search=Owner%20alias%20yarn')).items;
  assert.equal(balances.length, 1);assert.equal(balances[0].ownerKey, 'OWN');assert.equal(balances[0].remainingYarnKg, 15);
  const receipt = await request('POST', '/knitting/receive', { partyId: foreign._id, ownerKey: 'OWN', gatePassNo: 'ALIAS-KNITTING-RECEIPT', date: '2026-10-03T08:00:00.000Z', requestId: randomUUID(), items: [{ fabricType: 'Alias knitted fabric', yarnSpec, rollsCount: 1, weightKg: 14, wastageKg: 1 }] });
  assert.equal(receipt.remainingYarnInFieldKg, 0);
  await request('POST', '/workspace/receipts/' + receipt.receipt._id + '/reverse', { reason: 'Verify alias knitting reversal', requestId: randomUUID() });
  await request('POST', '/workspace/yarn-deliveries/' + issue._id + '/reverse', { reason: 'Verify alias yarn reversal', requestId: randomUUID() });
  assert.equal((await request('GET', '/workspace/yarn?search=Owner%20alias%20yarn')).items[0].totalWeightKg, 10);
  console.log('PASS one Rozain owner for legacy party aliases, canonical new stock, dyeing and yarn/knitting reversals, grouped yarn balances, original stock IDs, preserved ledgers and independent-owner protection.');
}
