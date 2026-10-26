import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyGatePassRegressions({ request }) {
  const locations = await request('GET', '/workspace/locations');assert.equal(new Set(locations.map(item => item.value)).size, locations.length);assert.equal(locations.find(item => item.value === 'ZR_GODOWN').label, 'Rozain Textile');assert.equal(locations.find(item => item.value === 'ZR_TRADING_GODOWN').label, 'ZR Trading Godown');
  const batches = await request('GET', '/dyeing/batches');
  const body = { millName: 'OTHER', customMillName: 'QA External Receipt Mill', reference: '0007/26', date: '2026-10-15T08:00:00.000Z', location: 'ZR_GODOWN', requestId: randomUUID(), items: [{ fabricType: 'External reusable fabric', yarnSpec: 'External yarn', color: 'NAVY', rolls: 4, weightKg: 100.25 }] };
  const receipt = await request('POST', '/workspace/external-mill-receipts', body, 201);assert.equal(receipt.receiptOrigin, 'EXTERNAL_MILL');assert.equal(receipt.reference, '0007/26');assert.equal(receipt.total, 0);
  assert.equal((await request('POST', '/workspace/external-mill-receipts', body, 201))._id, receipt._id);
  assert.equal((await request('GET', '/dyeing/batches')).total, batches.total);
  const stock = await request('GET', '/inventory/items?search=External%20reusable');assert.equal(stock.total, 1);assert.equal(stock.items[0].totalWeightKg, 100.25);assert.equal(stock.items[0].state, 'FINISHED_DYED');
  assert.equal((await request('GET', '/catalog/FABRIC?search=External%20reusable')).total, 1);assert.equal((await request('GET', '/workspace/external-mill-receipts?search=0007%2F26')).items[0]._id, receipt._id);
  await request('POST', '/workspace/external-mill-receipts', { ...body, requestId: randomUUID(), items: [{ ...body.items[0], weightKg: -1 }] }, 400);
  await request('POST', '/inventory/adjustments', { fabricType: 'Other stock reusable fabric', yarnSpec: 'Other yarn', color: 'BLACK', state: 'FINISHED_DYED', location: 'ZR_GODOWN', adjustmentRolls: 2, adjustmentWeightKg: 40.5, reason: 'MANUAL_CORRECTION', remarks: 'Verified physical stock', date: body.date, requestId: randomUUID() }, 201);
  assert.equal((await request('GET', '/catalog/FABRIC?search=Other%20stock%20reusable')).total, 1);
  await request('POST', '/inventory/adjustments', { onlyIfMissing: true, fabricType: 'Other stock reusable fabric', yarnSpec: 'Other yarn', color: 'BLACK', state: 'FINISHED_DYED', location: 'ZR_GODOWN', adjustmentRolls: 2, adjustmentWeightKg: 40.5, reason: 'MANUAL_CORRECTION', remarks: 'Do not count existing stock twice', date: body.date, requestId: randomUUID() }, 409);
  assert.equal((await request('GET', '/inventory/items?search=Other%20stock%20reusable')).items[0].totalWeightKg, 40.5);
  await request('POST', '/workspace/documents/' + receipt._id + '/reverse', { reason: 'Test correction of incoming mill pass', requestId: randomUUID() }, 200);
  assert.equal((await request('GET', '/inventory/items?search=External%20reusable')).items[0].totalWeightKg, 0);
  console.log('PASS unique Rozain/ZR location labels, external mill paper gate pass without invented issue/wastage, durable retry, real stock and automatic reusable fabric names.');
}
