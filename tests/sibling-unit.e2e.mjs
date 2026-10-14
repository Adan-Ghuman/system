import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifySiblingUnit({ request }) {
  const units = await request('GET', '/dyeing/units');const unit = units.find(item => item.code === 'ZR_TRADING_GODOWN');
  assert.equal(unit.type, 'GODOWN');assert(unit.partyId);const party = await request('GET', '/parties/' + unit.partyId);assert.equal(party.name, 'ZR Trading');const opening = party.currentBalance;
  const locations = await request('GET', '/workspace/locations');assert(locations.some(item => item.value === unit.code));
  assert.equal((await request('GET', '/parties?search=ZR%20Trading')).total, 1);
  const item = { fabricType: 'Sibling workflow fabric', yarnSpec: 'Sibling yarn', state: 'RAW_ECRU', color: 'ECRU' };const date = '2026-10-14T08:00:00.000Z';
  await request('POST', '/workspace/documents', { kind: 'FABRIC_RECEIPT', partyId: unit.partyId, date, reference: 'SIBLING-IN', requestId: randomUUID(), items: [{ ...item, rolls: 2, weightKg: 40 }] }, 201);
  await request('POST', '/inventory/transfers', { ...item, fromLocation: 'ZR_GODOWN', toLocation: unit.code, rollsCount: 1, weightKg: 20, date, requestId: randomUUID() }, 201);
  assert.equal((await request('GET', '/parties/' + unit.partyId)).currentBalance, opening);
  const stock = (await request('GET', '/inventory/items?search=Sibling%20workflow')).items;assert.equal(stock.find(row => row.location === unit.code).totalWeightKg, 20);
  const result = await request('POST', '/dispatch', { ...item, customerId: unit.partyId, fromLocation: unit.code, rolls: [{ rollNumber: 1, grossWeightKg: 20, tareKg: 0 }], ratePerKg: 10, invoiceType: 'NON_GST', date, requestId: randomUUID() }, 201);
  assert.equal(result.invoice.grandTotal, 200);assert.equal((await request('GET', '/parties/' + unit.partyId)).currentBalance, opening + 200);
  await request('POST', '/workspace/documents/' + result.invoice._id + '/payments', { amount: 50, date, requestId: randomUUID() }, 201);
  const ledger = await request('GET', '/accounts/ledger/' + unit.partyId);assert.equal(ledger.closingBalance, opening + 150);assert(ledger.entries.some(entry => entry.referenceNo === result.invoice.invoiceNo));
  assert.equal((await request('GET', '/parties?search=ZR%20Trading')).total, 1);
  console.log('PASS one-workspace sibling godown, single linked party ledger, location transfer, ordinary delivery/bill and partial receipt without a company switch.');
}
