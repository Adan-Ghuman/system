import mongoose, { ClientSession } from 'mongoose';

let ready: Promise<void> | undefined;
let databaseName = '';

export function prepareExistingIndexes() {
  if (databaseName !== mongoose.connection.name) { ready = undefined;databaseName = mongoose.connection.name; }
  if (!ready) ready = (async () => {
    const collection = mongoose.connection.collection('fabricinventories');
    const indexes = await collection.listIndexes().toArray().catch((error: { code?: number }) => { if (error.code === 26) return [];throw error; });
    const oldFields = ['fabricType', 'yarnSpec', 'state', 'color', 'location'];
    const old = indexes.find(index => index.unique && Object.keys(index.key).length === oldFields.length && oldFields.every(key => index.key[key] === 1));
    if (old?.name) {
      await collection.createIndex({ fabricType: 1, yarnSpec: 1, state: 1, color: 1, location: 1, ownerKey: 1 }, { unique: true });
      await collection.dropIndex(old.name);
    }
  })().catch(error => { ready = undefined;throw error; });
  return ready;
}

export async function existingNumberFloor(kind: string, session?: ClientSession) {
  const sources: Record<string, [string, string]> = { PRT: ['parties', 'code'], PARTY: ['parties', 'code'], DSP: ['dispatches', 'dispatchNo'], 'OGP-DISP': ['dispatches', 'ogpNo'], 'INV-NT': ['invoices', 'invoiceNo'], 'INV-GST': ['invoices', 'invoiceNo'], LOT: ['dyeingbatches', 'batchNo'], PAY: ['paymentvouchers', 'voucherNo'], RCPT: ['paymentvouchers', 'voucherNo'], TRF: ['stocktransfers', 'transferNo'], ADJ: ['stockadjustments', 'adjustmentNo'] };
  const source = sources[kind];if (!source) return 0;
  const [row] = await mongoose.connection.collection(source[0]).aggregate<{ value: number }>([
    { $match: { [source[1]]: new RegExp('^' + kind + '-[0-9]+$') } },
    { $project: { value: { $toLong: { $arrayElemAt: [{ $split: ['$' + source[1], '-'] }, -1] } } } },
    { $group: { _id: null, value: { $max: '$value' } } }
  ], { session }).toArray();
  return Number(row?.value || 0);
}
