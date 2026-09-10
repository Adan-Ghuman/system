import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Party } from '../models/Party.js';
import { DyeingBatch } from '../models/DyeingBatch.js';
import { FabricInventory } from '../models/FabricInventory.js';
import { Dispatch } from '../models/Dispatch.js';
import { Invoice } from '../models/Invoice.js';
import { PaymentVoucher } from '../models/PaymentVoucher.js';
import { PartyLedgerEntry } from '../models/PartyLedgerEntry.js';
import { YarnTransaction } from '../models/YarnTransaction.js';

async function verify() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('--- DATA VERIFICATION AUDIT ---');

  // 1. Parties
  const partyCount = await Party.countDocuments();
  const fabricBuyers = await Party.countDocuments({ 'tags.isFabricBuyer': true });
  const knitters = await Party.countDocuments({ 'tags.isKnitter': true });
  const dyeingMills = await Party.countDocuments({ 'tags.isDyeingMill': true });
  const yarnClients = await Party.countDocuments({ 'tags.isYarnClient': true });
  console.log(`\n1. Parties: Total ${partyCount}`);
  console.log(`   - Fabric Buyers: ${fabricBuyers}`);
  console.log(`   - Knitters:      ${knitters}`);
  console.log(`   - Dyeing Mills:  ${dyeingMills}`);
  console.log(`   - Yarn Clients:  ${yarnClients}`);

  // 2. Dyeing Batches by Mill
  const batchesByMill = await DyeingBatch.aggregate([
    {
      $group: {
        _id: '$millName',
        count: { $sum: 1 },
        totalEcruKg: { $sum: '$ecruWeightKg' },
        totalFinishKg: { $sum: '$finishWeightKg' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  console.log(`\n2. Dyeing Batches: Total ${await DyeingBatch.countDocuments()}`);
  batchesByMill.forEach(b =>
    console.log(
      `   - ${b._id}: ${b.count} batches | Ecru: ${Math.round(b.totalEcruKg).toLocaleString()} kg | Finish: ${Math.round(b.totalFinishKg).toLocaleString()} kg`
    )
  );

  // 3. Fabric Inventory by Location
  const invByLocation = await FabricInventory.aggregate([
    {
      $group: {
        _id: '$location',
        count: { $sum: 1 },
        totalRolls: { $sum: '$totalRolls' },
        totalWeightKg: { $sum: '$totalWeightKg' }
      }
    },
    { $sort: { totalWeightKg: -1 } }
  ]);
  console.log(`\n3. Fabric Inventory: Total Records ${await FabricInventory.countDocuments()}`);
  invByLocation.forEach(i =>
    console.log(
      `   - ${i._id}: ${i.count} items | ${i.totalRolls} rolls | ${Math.round(i.totalWeightKg).toLocaleString()} kg`
    )
  );

  // 4. Yarn Transactions
  const yarnCount = await YarnTransaction.countDocuments();
  console.log(`\n4. Yarn Transactions: Total ${yarnCount}`);

  // 5. Commercial Transactions
  const dispatchCount = await Dispatch.countDocuments();
  const invoiceCount = await Invoice.countDocuments();
  const invoiceTotal = await Invoice.aggregate([{ $group: { _id: null, sum: { $sum: '$grandTotal' } } }]);
  const voucherCount = await PaymentVoucher.countDocuments();
  const voucherTotal = await PaymentVoucher.aggregate([{ $group: { _id: null, sum: { $sum: '$amount' } } }]);
  const ledgerCount = await PartyLedgerEntry.countDocuments();

  console.log(`\n5. Commercial Logs:`);
  console.log(`   - Dispatches: ${dispatchCount}`);
  console.log(`   - Invoices:   ${invoiceCount} (Total Billed: Rs. ${Math.round(invoiceTotal[0]?.sum || 0).toLocaleString()})`);
  console.log(`   - Payments:   ${voucherCount} (Total Received: Rs. ${Math.round(voucherTotal[0]?.sum || 0).toLocaleString()})`);
  console.log(`   - Ledgers:    ${ledgerCount} entries recorded`);

  await mongoose.disconnect();
  console.log('\n--- VERIFICATION AUDIT COMPLETE ---');
}

verify().catch(console.error);
