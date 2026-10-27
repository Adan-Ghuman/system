import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyRawShadeCorrections({ mongoose, request, businesses }) {
  const businessId = new mongoose.Types.ObjectId(businesses.find(item => item.code === 'ROZAIN')._id);
  const date = new Date('2026-10-21T08:04:00.000Z');
  const stocks = mongoose.connection.collection('fabricinventories');
  const original = { _id: new mongoose.Types.ObjectId(), businessId, fabricType: 'FLEECE DULL', yarnSpec: '150/48', state: 'RAW_ECRU', color: 'NAVY BLUE', location: 'ZR_GODOWN', ownerKey: 'OWN', totalRolls: 13, totalWeightKg: 277.6, createdAt: date, updatedAt: date };
  await stocks.insertOne(original);
  const mill = (await request('GET', '/dyeing/units')).find(unit => unit.type === 'DYEING_MILL' && unit.isActive);
  const issue = { millName: mill.code, ogpNo: 'RAW-SHADE-ISSUE', dateIssued: '2026-10-22T08:00:00.000Z', requestId: randomUUID(), entries: [{ fabricType: original.fabricType, yarnSpec: original.yarnSpec, targetColor: 'NAVY BLUE', ecruRollsCount: 12, ecruWeightKg: 257.65 }] };
  await request('POST', '/dyeing/gate-passes', issue, 400);
  assert.equal((await stocks.findOne({ _id: original._id })).totalWeightKg, 277.6);
  await request('POST', '/dyeing/gate-passes', { ...issue, entries: [{ ...issue.entries[0], inventoryId: String(original._id) }], requestId: randomUUID() }, 400);
  await request('POST', '/inventory/adjustments', { onlyIfMissing: true, fabricType: original.fabricType.toLowerCase(), yarnSpec: original.yarnSpec, state: 'RAW_ECRU', color: 'ECRU', location: 'ZR_GODOWN', adjustmentRolls: 13, adjustmentWeightKg: 277.6, reason: 'MANUAL_CORRECTION', remarks: 'Do not duplicate misclassified grey stock', requestId: randomUUID() }, 409);
  const url = '/inventory/items/' + original._id;
  await request('PUT', url, { color: 'ECRU' }, 400);
  const correction = { color: 'ECRU', totalRolls: 13, totalWeightKg: 277.6, correctionReason: 'Confirmed undyed grey; NAVY BLUE is the target dyeing shade', requestId: randomUUID() };
  await request('PUT', url, { ...correction, totalRolls: 14 }, 400);
  const productionBefore = (await request('GET', '/production')).total;
  const fixed = await request('PUT', url, correction);
  assert.equal(fixed._id, String(original._id));assert.equal(fixed.color, 'ECRU');assert.equal(fixed.totalRolls, 13);assert.equal(fixed.totalWeightKg, 277.6);
  assert.equal((await request('PUT', url, correction))._id, fixed._id);
  await request('PUT', url, { ...correction, correctionReason: 'Different submission with the same key' }, 409);
  assert.equal((await request('GET', '/production')).total, productionBefore);
  const audit = await mongoose.connection.collection('stockadjustments').find({ sourceInventoryId: original._id }).toArray();
  assert.equal(audit.length, 2);assert.equal(audit.reduce((sum, row) => sum + row.adjustmentRolls, 0), 0);assert.equal(audit.reduce((sum, row) => sum + row.adjustmentWeightKg, 0), 0);assert.equal(String(audit[0].correctionId), String(audit[1].correctionId));
  const selectedEntry = { ...issue.entries[0], inventoryId: String(original._id), fabricType: 'Submitted name is ignored', yarnSpec: 'Wrong submitted yarn' };
  const selectedIssue = { ...issue, entries: [selectedEntry], requestId: randomUUID() };
  const independent = (await request('GET', '/parties?search=Independent%20owner')).items.find(item => item.name === 'Independent owner');
  await request('POST', '/dyeing/gate-passes', { ...selectedIssue, ownerKey: independent._id, requestId: randomUUID() }, 400);
  await request('POST', '/dyeing/gate-passes', { ...selectedIssue, entries: [{ ...selectedEntry, inventoryId: String(new mongoose.Types.ObjectId()) }], requestId: randomUUID() }, 400);
  const badSources = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  await stocks.insertMany([
    { ...original, _id: badSources[0], color: 'ECRU', location: mill.code },
    { ...original, _id: badSources[1], color: 'NAVY BLUE', state: 'FINISHED_DYED' },
    { ...original, _id: badSources[2], color: 'ECRU', ownerKey: 'OWN', businessId: new mongoose.Types.ObjectId(businesses.find(item => item.code !== 'ROZAIN')._id), fabricType: 'Other business raw stock' }
  ]);
  for (const id of badSources) await request('POST', '/dyeing/gate-passes', { ...selectedIssue, entries: [{ ...selectedEntry, inventoryId: String(id) }], requestId: randomUUID() }, 400);
  const batchesBefore = await mongoose.connection.collection('dyeingbatches').countDocuments();
  await request('POST', '/dyeing/gate-passes', { ...selectedIssue, entries: [selectedEntry, selectedEntry], requestId: randomUUID() }, 400);
  assert.equal(await mongoose.connection.collection('dyeingbatches').countDocuments(), batchesBefore);assert.equal((await stocks.findOne({ _id: original._id })).totalRolls, 13);
  await request('POST', '/dyeing/gate-passes', { ...selectedIssue, entries: [{ ...selectedEntry, ecruRollsCount: 13, ecruWeightKg: 270 }], requestId: randomUUID() }, 400);
  const result = await request('POST', '/dyeing/gate-passes', selectedIssue, 201);
  const batch = Array.isArray(result) ? result[0] : result.batches[0];
  assert.equal(batch.targetColor, 'NAVY BLUE');assert.equal(batch.fabricType, original.fabricType);assert.equal(batch.yarnSpec, original.yarnSpec);assert.equal(batch.sourceInventoryId, String(original._id));
  assert.equal((await request('POST', '/dyeing/gate-passes', selectedIssue, 201))[0]._id, batch._id);
  const left = await stocks.findOne({ _id: original._id });assert.equal(left.totalRolls, 1);assert.equal(left.totalWeightKg, 19.95);
  await request('POST', '/workspace/dyeing-issues/' + batch._id + '/reverse', { reason: 'Verify corrected raw stock returns to ECRU', requestId: randomUUID() });
  const restored = await stocks.findOne({ _id: original._id });assert.equal(restored.totalRolls, 13);assert.ok(Math.abs(restored.totalWeightKg - 277.6) < 0.000001);assert.equal(restored.color, 'ECRU');
  const alias = (await request('GET', '/parties?search=Rozain%20Knitting')).items.find(item => item.name === 'Rozain Knitting');
  const aliasStockId = new mongoose.Types.ObjectId();
  await stocks.insertOne({ ...original, _id: aliasStockId, color: 'ECRU', ownerKey: alias._id, totalRolls: 2, totalWeightKg: 40 });
  const aliasIssue = (await request('POST', '/dyeing/gate-passes', { ...selectedIssue, requestId: randomUUID(), entries: [{ ...selectedEntry, inventoryId: String(aliasStockId), ecruRollsCount: 1, ecruWeightKg: 20 }] }, 201))[0];
  assert.equal((await stocks.findOne({ _id: aliasStockId })).totalRolls, 1);assert.equal((await stocks.findOne({ _id: original._id })).totalRolls, 13);
  await request('POST', '/workspace/dyeing-issues/' + aliasIssue._id + '/reverse', { reason: 'Restore the exact selected legacy-owner stock row', requestId: randomUUID() });
  assert.equal((await stocks.findOne({ _id: aliasStockId })).totalRolls, 2);assert.equal((await stocks.findOne({ _id: aliasStockId })).ownerKey, alias._id);assert.equal((await stocks.findOne({ _id: original._id })).totalRolls, 13);
  const concurrent = await Promise.allSettled([1, 2].map(index => request('POST', '/dyeing/gate-passes', { ...selectedIssue, ogpNo: 'CONCURRENT-RAW-' + index, requestId: randomUUID(), entries: [{ ...selectedEntry, ecruRollsCount: 8, ecruWeightKg: 160 }] }, 201)));
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);const failed = concurrent.find(result => result.status === 'rejected');assert.equal(failed.reason.actual, 400);
  assert.equal((await stocks.findOne({ _id: original._id })).totalRolls, 5);assert.equal((await stocks.findOne({ _id: original._id })).totalWeightKg, 117.6);
  const winner = concurrent.find(result => result.status === 'fulfilled').value[0];await request('POST', '/workspace/dyeing-issues/' + winner._id + '/reverse', { reason: 'Restore after concurrent overdraw test', requestId: randomUUID() });
  assert.equal((await stocks.findOne({ _id: original._id })).totalRolls, 13);
  const merge = { ...original, fabricType: 'Raw shade merge', totalRolls: 1, totalWeightKg: 20 };
  const oldId = new mongoose.Types.ObjectId(), targetId = new mongoose.Types.ObjectId();
  await stocks.insertMany([{ ...merge, _id: oldId }, { ...merge, _id: targetId, color: 'ECRU', totalRolls: 2, totalWeightKg: 40 }]);
  const merged = await request('PUT', '/inventory/items/' + oldId, { color: 'ECRU', correctionReason: 'Confirmed grey stock with incorrect target shade', requestId: randomUUID() });
  assert.equal(merged._id, String(targetId));assert.equal(merged.totalRolls, 3);assert.equal(merged.totalWeightKg, 60);assert.equal((await stocks.findOne({ _id: oldId })).totalWeightKg, 0);assert.equal(await stocks.countDocuments({ _id: { $in: [oldId, targetId] } }), 2);
  const invalid = { fabricType: 'Invalid new raw shade', yarnSpec: '150/48', state: 'RAW_ECRU', color: 'NAVY BLUE', location: 'ZR_GODOWN', adjustmentRolls: 1, adjustmentWeightKg: 20, reason: 'MANUAL_CORRECTION', date: date.toISOString(), requestId: randomUUID() };
  await request('POST', '/inventory/adjustments', invalid, 400);
  const supplier = (await request('GET', '/parties?limit=1')).items[0];
  await request('POST', '/workspace/documents', { kind: 'FABRIC_RECEIPT', partyId: supplier._id, date: date.toISOString(), reference: 'RAW-SHADE-BLOCK', requestId: randomUUID(), items: [{ fabricType: invalid.fabricType, yarnSpec: invalid.yarnSpec, state: invalid.state, color: invalid.color, rolls: 1, weightKg: 20 }] }, 400);
  assert.equal(await stocks.countDocuments({ fabricType: invalid.fabricType }), 0);
  await stocks.insertOne({ ...original, _id: new mongoose.Types.ObjectId(), fabricType: 'Browser raw shade fleece' });
  await stocks.insertOne({ ...original, _id: new mongoose.Types.ObjectId(), fabricType: 'Browser dyeing raw shade' });
  const draft = await request('POST', '/workspace/documents', { saveAsDraft: true, kind: 'FABRIC_RECEIPT', partyId: supplier._id, date: date.toISOString(), reference: 'BROWSER-OLD-RAW-DRAFT', requestId: randomUUID(), items: [{ fabricType: 'Browser old raw draft', yarnSpec: '150/48', state: 'RAW_ECRU', color: 'NAVY BLUE', rolls: 1, weightKg: 20 }] }, 201);
  assert.equal(draft.status, 'DRAFT');
  console.log('PASS raw NAVY BLUE mismatch, audited correction to ECRU without changing 13 rolls/277.60 kg, durable retries, target merging, dyeing and reversal, invalid new raw-shade rejection, exact stock selection/reversal, owner/location/business isolation and atomic multi-line overdraw rejection.');
}
