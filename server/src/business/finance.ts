import { ClientSession } from 'mongoose';
import { Party } from '../models/Party.js';
import { PartyLedgerEntry } from '../models/PartyLedgerEntry.js';
import { NotFoundError } from '../utils/errors.js';
import { money } from './posting.js';
import { recomputePartyLedger } from '../modules/accounts/accounts.service.js';

export async function postPartyAmount(partyId: unknown, delta: number, sourceId: unknown, number: string, date: Date, description: string, session: ClientSession) {
  const party = await Party.findOneAndUpdate({ _id: partyId }, { $inc: { currentBalance: money(delta) } }, { new: true, session });
  if (!party) throw new NotFoundError('Choose a party in this business.');
  await PartyLedgerEntry.create([{ partyId: party._id, entryType: delta > 0 ? 'DEBIT' : 'CREDIT', amount: Math.abs(money(delta)), runningBalance: money(party.currentBalance), referenceType: 'BILL', referenceId: sourceId, referenceNo: number, date, description }], { session });
  if (await PartyLedgerEntry.exists({ partyId: party._id, date: { $gt: date } }).session(session)) await recomputePartyLedger(party._id, session);
  return party;
}
