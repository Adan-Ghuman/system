import { createHash, randomUUID } from 'node:crypto';
import mongoose, { ClientSession } from 'mongoose';
import { PostingRequest, DocumentCounter } from './records.js';
import { currentBusinessId, businessContext, usesExistingRecords } from './context.js';
import { existingNumberFloor } from './existing-records.js';
import { ConflictError, ForbiddenError } from '../utils/errors.js';

export const weight = (value: number) => Math.round(value * 1000) / 1000;
export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export async function nextDocumentNo(kind: string, session?: ClientSession) {
  if (usesExistingRecords()) await DocumentCounter.updateOne({ kind }, { $max: { value: await existingNumberFloor(kind, session) }, $setOnInsert: { kind } }, { upsert: true, session });
  const counter = await DocumentCounter.findOneAndUpdate({ kind }, { $inc: { value: 1 } }, { upsert: true, new: true, session });
  return `${kind}-${String(counter!.value).padStart(5, '0')}`;
}
export async function postCommand<T, I extends { requestId?: string }>(kind: string, input: I, action: (session: ClientSession) => Promise<T>): Promise<T> {
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
      result = await action(session);
      await PostingRequest.create([{ requestId, kind, hash, result: JSON.parse(JSON.stringify(result)) }], { session });
    });
    return result!;
  } finally { await session.endSession(); }
}
