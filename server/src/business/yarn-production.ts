import { ClientSession, Types } from 'mongoose';
import { z } from 'zod';
import { BusinessDocument } from './commerce.models.js';
import { businessContext } from './context.js';
import { postCommand, weight } from './posting.js';
import { moveYarn } from './stock-reconciliation.js';
import { YarnMachine, YarnProductionRun } from './yarn-production.models.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors.js';
import { YarnInventory } from './records.js';

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
export const requestId = z.string().uuid();
export const productionDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}, 'Enter a valid date.');
export const todayInPakistan = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
const kg = z.number().finite().nonnegative().max(1e9).multipleOf(0.001);
const measurement = z.object({
  yarnSpec: z.string().trim().min(1).max(100),
  packageUnit: z.enum(['cones', 'cartons', 'bags', 'packages']),
  quantity: z.number().int().nonnegative().max(1e8),
  weightKg: kg.refine(value => value > 0, 'Enter measured kg greater than zero.')
});
export const reason = z.string().trim().min(3).max(500);
export const runInput = z.object({
  requestId,
  machineId: objectId,
  productionDate: productionDay,
  shift: z.enum(['DAY', 'NIGHT']),
  reference: z.string().trim().min(1).max(100).transform(value => value.toUpperCase()),
  output: measurement.extend({ quantity: z.number().int().positive().max(1e8) }),
  wasteKg: kg,
  input: measurement.optional()
});
type RunInput = z.infer<typeof runInput>;
type Measurement = Pick<NonNullable<ProductionRun['input']>, 'yarnSpec' | 'packageUnit' | 'quantity' | 'weightKg'>;

async function activeRun(id: string, session: ClientSession) {
  const run = await YarnProductionRun.findOne({ _id: id, status: 'POSTED' }).session(session);
  if (!run) throw new NotFoundError('Active production entry not found.');
  return run;
}

async function createRun(input: RunInput, session: ClientSession, previous?: Awaited<ReturnType<typeof activeRun>>, correctionReason?: string) {
  if (input.productionDate > todayInPakistan()) throw new BadRequestError('Production date cannot be in the future.');
  const machineId = new Types.ObjectId(input.machineId);
  const keepMachine = previous && previous.machineId.equals(machineId);
  const machine = keepMachine ? null : await YarnMachine.findOneAndUpdate({ _id: machineId, active: true }, {
    $inc: { postingVersion: 1 }
  }, { new: true, session, timestamps: false });
  if (!keepMachine && !machine) throw new BadRequestError('Choose an active machine.');
  const process = previous && keepMachine ? previous.process : machine!.process;
  if (process === 'REWINDING') {
    if (!input.input || weight(input.output.weightKg + input.wasteKg) !== input.input.weightKg) {
      throw new BadRequestError('For rewinding, measured input kg must equal usable kg plus waste kg.');
    }
  } else if (input.input) {
    throw new BadRequestError('Yarn input is recorded for rewinding.');
  }
  const key = { machineId, productionDate: input.productionDate, shift: input.shift, reference: input.reference };
  if (await YarnProductionRun.exists({ ...key, status: 'POSTED' }).session(session)) {
    throw new ConflictError('That machine, date, shift and run reference already exist. Open the original entry or enter the distinct run reference.');
  }
  const [run] = await YarnProductionRun.create([{
    ...key, process, machineCode: keepMachine ? previous!.machineCode : machine!.code,
    machineName: keepMachine ? previous!.machineName : machine!.name, location: keepMachine ? previous!.location : machine!.location,
    output: input.output, input: input.input, wasteKg: input.wasteKg, actorId: businessContext.getStore()!.actorId,
    replacesId: previous?._id, correctionReason
  }], { session });
  return run;
}

export async function saveRun(input: RunInput) {
  return postCommand('YARN_PRODUCTION', input, session => createRun(input, session));
}

export async function correctRun(id: string, input: RunInput & { reason: string }) {
  return postCommand('CORRECT_YARN_PRODUCTION', { ...input, id }, async session => {
    const old = await activeRun(id, session);
    if (old.stockStatus !== 'AWAITING') throw new ConflictError('Undo the stock handoff before correcting this run.');
    old.status = 'REVERSED';
    old.correctionReason = input.reason;
    await old.save({ session });
    const replacement = await createRun(input, session, old, input.reason);
    old.replacedById = replacement._id;
    await old.save({ session });
    return replacement;
  });
}

export async function voidRun(id: string, input: { requestId: string; reason: string }) {
  return postCommand('VOID_YARN_PRODUCTION', { ...input, id }, async session => {
    const run = await activeRun(id, session);
    if (run.stockStatus !== 'AWAITING') throw new ConflictError('Undo the stock handoff before voiding this run.');
    run.status = 'REVERSED';
    run.correctionReason = input.reason;
    await run.save({ session });
    return run;
  });
}

type ProductionRun = Awaited<ReturnType<typeof activeRun>>;
export function matchingReceipt(receipt: { kind: string; date: Date; items: Array<{ ownerKey?: string; yarnSpec: string; packageUnit: string; rolls: number; weightKg: number }> }, run: Pick<ProductionRun, 'productionDate' | 'output'>) {
  const item = receipt.items[0];
  const earliest = new Date(run.productionDate + 'T00:00:00+05:00');
  return ['YARN_RECEIPT', 'YARN_PURCHASE'].includes(receipt.kind) && receipt.date >= earliest
    && receipt.items.length === 1 && item.ownerKey === 'OWN'
    && item.yarnSpec === run.output.yarnSpec && item.packageUnit === run.output.packageUnit
    && item.rolls === run.output.quantity && item.weightKg === run.output.weightKg;
}

export async function availableReceipts(run: Pick<ProductionRun, 'productionDate' | 'output'>, session?: ClientSession) {
  const candidates = await BusinessDocument.find({
    kind: { $in: ['YARN_RECEIPT', 'YARN_PURCHASE'] }, status: 'POSTED',
    date: { $gte: new Date(run.productionDate + 'T00:00:00+05:00'), $lte: new Date(todayInPakistan() + 'T23:59:59.999+05:00') },
    items: { $size: 1, $elemMatch: { yarnSpec: run.output.yarnSpec, packageUnit: run.output.packageUnit,
      rolls: run.output.quantity, weightKg: run.output.weightKg } }
  }).sort({ date: -1, _id: -1 }).session(session || null);
  const used = await YarnProductionRun.distinct('linkedReceiptId', { linkedReceiptId: { $in: candidates.map(candidate => candidate._id) } }).session(session || null);
  const usedIds = new Set(used.map(String));
  return candidates.filter(candidate => matchingReceipt(candidate, run) && !usedIds.has(String(candidate._id)));
}

type HandoffInput = { mode: 'POST'; requestId: string; date: string; distinctReceiptReason?: string }
  | { mode: 'LINK'; requestId: string; receiptId: string };

export async function handoffStock(id: string, input: HandoffInput) {
  return postCommand('RECEIVE_YARN_PRODUCTION', { ...input, id }, async session => {
    const run = await activeRun(id, session);
    if (run.stockStatus !== 'AWAITING') throw new ConflictError('This run already has a stock handoff.');
    if (input.mode === 'POST' && (input.date < run.productionDate || input.date > todayInPakistan())) {
      throw new BadRequestError('Choose a stock date from the production date through today.');
    }
    let stockDate: string;
    let receiptNumber: string | undefined;
    if (input.mode === 'LINK') {
      if (run.process !== 'SPINNING') throw new BadRequestError('Post rewinding input and output together from this production entry.');
      const receipt = await BusinessDocument.findOneAndUpdate({ _id: input.receiptId, status: 'POSTED' }, {
        $inc: { postingVersion: 1 }
      }, { session, new: true });
      if (!receipt || !matchingReceipt(receipt, run) || pakistanDay(receipt.date) > todayInPakistan()) throw new BadRequestError('Select an active receipt matching the yarn, packages and measured kg.');
      if (await YarnProductionRun.exists({ linkedReceiptId: receipt._id }).session(session)) throw new ConflictError('This receipt already belongs to another production entry.');
      run.linkedReceiptId = receipt._id;
      run.stockStatus = 'LINKED';
      stockDate = pakistanDay(receipt.date);
      receiptNumber = receipt.number;
    } else {
      if (run.process === 'SPINNING' && !input.distinctReceiptReason && (await availableReceipts(run, session)).length) {
        throw new ConflictError('A matching receipt already exists. Link it or explain why this is a distinct receipt.');
      }
      const date = new Date(input.date + 'T00:00:00+05:00');
      if (run.input) await moveRunYarn(run, run.input, -1, date, 'Rewinding input', session);
      await moveRunYarn(run, run.output, 1, date, 'Yarn production received', session);
      run.stockStatus = 'POSTED';
      stockDate = input.date;
    }
    run.stockEvents.push({
      action: run.stockStatus, date: stockDate,
      reason: input.mode === 'POST' ? input.distinctReceiptReason : undefined, receiptId: run.linkedReceiptId, receiptNumber, actorId: businessContext.getStore()!.actorId
    });
    await run.save({ session });
    return run;
  });
}

function pakistanDay(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

async function moveRunYarn(run: ProductionRun, item: Measurement, sign: -1 | 1, date: Date, reason: string, session: ClientSession) {
  await moveYarn({
    ownerKey: 'OWN', yarnSpec: item.yarnSpec, packageUnit: item.packageUnit, sourceId: run._id, sourceKind: 'YARN_PRODUCTION',
    date, reason: reason + ' · ' + run.machineCode + ' · ' + run.reference
  }, { quantity: sign * item.quantity, weightKg: sign * item.weightKg }, session,
  'There is insufficient yarn in store. Check the yarn count, package unit and measured quantity.');
}

export async function undoHandoff(id: string, input: { requestId: string; reason: string }) {
  return postCommand('UNDO_YARN_PRODUCTION_STOCK', { ...input, id }, async session => {
    const run = await activeRun(id, session);
    if (run.stockStatus === 'AWAITING') throw new ConflictError('This run is awaiting a stock handoff.');
    if (run.stockStatus === 'LINKED') {
      await BusinessDocument.updateOne({ _id: run.linkedReceiptId }, { $inc: { postingVersion: 1 } }, { session });
    } else {
      const stock = await YarnInventory.findOne({ ownerKey: 'OWN', yarnSpec: run.output.yarnSpec, packageUnit: run.output.packageUnit }).session(session);
      if (!stock || stock.quantity < run.output.quantity || stock.totalWeightKg < run.output.weightKg) {
        throw new ConflictError('Some output has already left stock. Return or reverse the later movement first.');
      }
      const date = new Date();
      await moveRunYarn(run, run.output, -1, date, 'Production receipt reversed · ' + input.reason, session);
      if (run.input) await moveRunYarn(run, run.input, 1, date, 'Rewinding input restored · ' + input.reason, session);
    }
    run.stockEvents.push({
      action: 'UNDONE', date: todayInPakistan(), reason: input.reason, receiptId: run.linkedReceiptId,
      actorId: businessContext.getStore()!.actorId
    });
    run.linkedReceiptId = undefined;
    run.stockStatus = 'AWAITING';
    await run.save({ session });
    return run;
  });
}
