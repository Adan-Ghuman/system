import { ClientSession, Types } from 'mongoose';
import { BillAllocation, SourceBillingAssignment } from './commerce.models.js';
import { KnittingReceipt, DyeingReceipt } from './records.js';
import { Dispatch } from '../models/Dispatch.js';
import { DyeingBatch } from '../models/DyeingBatch.js';
import { YarnTransaction } from '../models/YarnTransaction.js';
import { canonicalOwnerKey } from './ownership.js';
import { weight } from './posting.js';
import { BadRequestError } from '../utils/errors.js';

export interface SaleSourceLine { sourceLineId: string; fabricType: string; yarnSpec: string; color: string; state: 'RAW_ECRU' | 'FINISHED_DYED'; rolls: number; weightKg: number; eligible: boolean; assignable: boolean; }
export interface SaleSource { _id: string; label: string; date: string; items: SaleSourceLine[]; }
export async function customerSources(kind: string, customerId: string, session?: ClientSession) {
  if (!Types.ObjectId.isValid(customerId)) throw new BadRequestError('Choose a customer first.');
  if (!['EXISTING_DELIVERY', 'KNITTING_CHARGE', 'DYEING_CHARGE'].includes(kind)) throw new BadRequestError('Choose a delivery or service type.');
  const receipts = kind === 'KNITTING_CHARGE' ? await KnittingReceipt.find({ status: 'POSTED' }).sort({ date: -1 }).session(session || null) : kind === 'DYEING_CHARGE' ? await DyeingReceipt.find({ status: 'POSTED' }).sort({ date: -1 }).session(session || null) : [];
  const deliveries = kind === 'EXISTING_DELIVERY' ? await Dispatch.find({ customerId, status: 'POSTED', purpose: { $ne: 'CLIENT_RETURN' } }).sort({ date: -1 }).session(session || null) : [];
  const ids = [...receipts, ...deliveries].map(r => r._id);
  const allocations = await BillAllocation.find({ sourceId: { $in: ids }, direction: 'RECEIVABLE' }).session(session || null);
  const assignments = await SourceBillingAssignment.find({ sourceId: { $in: ids } }).session(session || null);
  const knitting = kind === 'KNITTING_CHARGE' ? await KnittingReceipt.find({ _id: { $in: ids } }).session(session || null) : [];
  const issues = await YarnTransaction.find({ _id: { $in: knitting.flatMap(r => r.items.flatMap(i => i.allocations.map(a => a.transactionId))) } }).session(session || null);
  const dyeing = kind === 'DYEING_CHARGE' ? await DyeingReceipt.find({ _id: { $in: ids } }).session(session || null) : [];
  const batches = await DyeingBatch.find({ _id: { $in: dyeing.flatMap(r => r.items.map(i => i.batchId).filter(Boolean)) } }).session(session || null);
  const sources: SaleSource[] = [];
  for (const delivery of deliveries) sources.push({ _id: String(delivery._id), date: delivery.date.toISOString(), label: `${delivery.ogpNo} · ${delivery.fabricType} · ${delivery.date.toISOString().slice(0, 10)}`, items: [{ sourceLineId: String(delivery._id), fabricType: delivery.fabricType, yarnSpec: delivery.yarnSpec, color: delivery.color, state: delivery.state || 'FINISHED_DYED', rolls: delivery.totalRolls, weightKg: delivery.totalNetWeightKg, eligible: true, assignable: false }] });
  for (const receipt of knitting) sources.push({ _id: String(receipt._id), date: receipt.date.toISOString(), label: `${receipt.gatePassNo} · ${receipt.receiptNo} · ${receipt.date.toISOString().slice(0, 10)}`, items: receipt.items.map(item => {
    const owners = [...new Set(item.allocations.map(a => issues.find(i => String(i._id) === String(a.transactionId))?.ownerKey).filter((value): value is string => Boolean(value)).map(canonicalOwnerKey))];
    const complete = item.allocations.every(a => issues.some(i => String(i._id) === String(a.transactionId) && Boolean(i.ownerKey)));
    const related = complete && owners.length === 1 && owners[0] !== 'OWN' ? owners[0] : undefined;
    const assignment = assignments.find(a => String(a.sourceId) === String(receipt._id) && a.sourceLineId === String(item._id));
    return { sourceLineId: String(item._id), fabricType: item.fabricType, yarnSpec: item.yarnSpec, color: 'ECRU', state: 'RAW_ECRU', rolls: item.rollsCount, weightKg: item.weightKg, eligible: related ? related === customerId : String(assignment?.customerId) === customerId, assignable: complete && !related && !assignment && owners.length <= 1 };
  }) });
  for (const receipt of dyeing) sources.push({ _id: String(receipt._id), date: receipt.date.toISOString(), label: `${receipt.gatePassNo} · ${receipt.number} · ${receipt.date.toISOString().slice(0, 10)}`, items: receipt.items.map(item => {
    const batch = batches.find(b => String(b._id) === String(item.batchId));
    const owner = batch?.ownerKey ? canonicalOwnerKey(batch.ownerKey) : undefined;
    const related = owner && owner !== 'OWN' ? owner : batch?.allocatedCustomerId ? String(batch.allocatedCustomerId) : undefined;
    const assignment = assignments.find(a => String(a.sourceId) === String(receipt._id) && a.sourceLineId === String(item._id));
    return { sourceLineId: String(item._id), fabricType: item.fabricType || '', yarnSpec: item.yarnSpec || '', color: item.color || '', state: 'FINISHED_DYED', rolls: item.rolls || 0, weightKg: item.weightKg || 0, eligible: related ? related === customerId : String(assignment?.customerId) === customerId, assignable: !related && !assignment };
  }) });
  for (const source of sources) source.items = source.items.flatMap(item => {
    const used = allocations.filter(a => String(a.sourceId) === source._id && a.sourceLineId === item.sourceLineId).reduce((sum, a) => sum + a.fraction, 0);
    const left = Math.max(0, 1 - used);
    return left < 0.0000001 ? [] : [{ ...item, rolls: Math.floor(item.rolls * left + 0.0000001), weightKg: weight(item.weightKg * left) }];
  });
  return { items: sources.map(s => ({ ...s, items: s.items.filter(i => i.eligible) })).filter(s => s.items.length), unassigned: sources.map(s => ({ ...s, items: s.items.filter(i => i.assignable) })).filter(s => s.items.length) };
}
