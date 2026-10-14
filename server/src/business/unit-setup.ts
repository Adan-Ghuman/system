import mongoose from 'mongoose';
import { Party } from '../models/Party.js';
import { DyeingUnit } from '../models/DyeingUnit.js';
import { ensureDefaultDyeingUnits } from '../modules/dyeing/dyeing.service.js';

let ready: Promise<void> | undefined;
let databaseName = '';

export function ensureSiblingUnit() {
  if (databaseName !== mongoose.connection.name) { ready = undefined;databaseName = mongoose.connection.name; }
  if (!ready) ready = (async () => {
    await ensureDefaultDyeingUnits();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        let party = await Party.findOne({ $or: [{ code: 'ZR_TRADING' }, { name: /^ZR\s*(Trading|Traders)$/i }] }).session(session);
        if (!party) [party] = await Party.create([{ code: 'ZR_TRADING', name: 'ZR Trading', tags: { isFabricBuyer: true }, openingBalance: 0, currentBalance: 0, isActive: true }], { session });
        await DyeingUnit.updateOne({ code: 'ZR_TRADING_GODOWN' }, { $setOnInsert: { code: 'ZR_TRADING_GODOWN', name: 'ZR Trading Godown', shortName: 'ZR Trading', type: 'GODOWN', partyId: party._id, isActive: true, isSystemDefault: true, sortOrder: 6 } }, { upsert: true, session });
      });
    } finally { await session.endSession(); }
  })().catch(error => { ready = undefined;throw error; });
  return ready;
}
