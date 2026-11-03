import { createHash, randomUUID } from 'node:crypto';
import mongoose, { ClientSession } from 'mongoose';
import { PostingRequest, DocumentCounter } from './records.js';
import { currentBusinessId, businessContext, usesExistingRecords, postingContext } from './context.js';
import { existingNumberFloor } from './existing-records.js';
import { BadRequestError, ConflictError, ForbiddenError } from '../utils/errors.js';

export const weight = (value: number) => Math.round(value * 1000) / 1000;
export const money = (value: number) => {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 100) throw new BadRequestError('The amount exceeds the supported currency range.');
  const magnitude = Math.abs(value);
  return Math.sign(value) * Math.round((magnitude + Number.EPSILON * Math.max(1, magnitude)) * 100) / 100;
};
export async function nextDocumentNo(kind: string, session?: ClientSession) {
  if (usesExistingRecords()) await DocumentCounter.updateOne({ kind }, { $max: { value: await existingNumberFloor(kind, session) }, $setOnInsert: { kind } }, { upsert: true, session });
  const counter = await DocumentCounter.findOneAndUpdate({ kind }, { $inc: { value: 1 } }, { upsert: true, new: true, session });
  return `${kind}-${String(counter!.value).padStart(5, '0')}`;
}
export async function postCommand<T, I extends { requestId?: string; shortageReason?: string }>(kind: string, input: I, action: (session: ClientSession) => Promise<T>): Promise<T> {
  if (!currentBusinessId()) throw new ForbiddenError('Choose a business before posting.');
  const requestId = input.requestId || randomUUID();
  const hash = createHash('sha256').update(JSON.stringify({ actorId: businessContext.getStore()!.actorId, input })).digest('hex');
  const session = await mongoose.startSession();
  let result: T;
  try {
    await session.withTransaction(async () => {
      const existing = await PostingRequest.findOne({ requestId }).session(session);
      if (existing) {
        if (existing.hash !== hash || existing.kind !== kind) throw new ConflictError('This submission key was already used for different values. Reopen the form to start a new transaction.');
        result = existing.result as T;
        return;
      }
      const fields = input as I & { reference?: string; gatePassNo?: string; ogpNo?: string; igpNo?: string; receiptReference?: string; externalReference?: string };
      const reference = fields.reference || fields.gatePassNo || fields.ogpNo || fields.igpNo || fields.receiptReference || fields.externalReference;
      result = await postingContext.run({ kind, reference, shortageReason: input.shortageReason }, () => action(session));
      await PostingRequest.create([{ requestId, kind, hash, result: JSON.parse(JSON.stringify(result)) }], { session });
    });
    return result!;
  } finally { await session.endSession(); }
}
