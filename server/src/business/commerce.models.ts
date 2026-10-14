import { Schema, InferSchemaType } from 'mongoose';
import { businessModel } from './model.js';
import { partyModelName } from './context.js';

export const commerceItemSchema = new Schema({ fabricType: { type: String, default: '' }, yarnSpec: { type: String, default: '' }, color: { type: String, default: 'ECRU' }, state: { type: String, enum: ['RAW_ECRU', 'FINISHED_DYED'], default: 'RAW_ECRU' }, rolls: { type: Number, default: 0 }, weightKg: { type: Number, default: 0 }, rate: { type: Number, default: 0 }, basis: { type: String, enum: ['KG', 'ROLL', 'JOB'], default: 'KG' }, description: { type: String, default: '' }, sourceLineId: { type: String, default: '' }, packageUnit: { type: String, default: 'cartons' }, ownerKey: { type: String, default: 'OWN' }, returnedRolls: { type: Number, default: 0 }, returnedWeightKg: { type: Number, default: 0 }, returnedReceivedRolls: { type: Number, default: 0 }, returnedReceivedKg: { type: Number, default: 0 }, sourceLocation: { type: String, default: 'ZR_GODOWN' }, receivedWeightKg: { type: Number, default: 0 }, receivedRolls: { type: Number, default: 0 } });
const documentSchema = new Schema({
  number: { type: String, required: true, unique: true }, kind: { type: String, required: true }, direction: { type: String, enum: ['PAYABLE', 'RECEIVABLE'], default: 'PAYABLE' },
  partyId: { type: Schema.Types.ObjectId, ref: partyModelName }, date: { type: Date, required: true }, reference: { type: String, default: '' },
  location: { type: String, default: 'ZR_GODOWN' }, items: { type: [commerceItemSchema], default: [] }, remarks: { type: String, default: '' },
  baseAmount: { type: Number, default: 0 }, taxPercent: { type: Number, default: 0 }, taxAmount: { type: Number, default: 0 }, total: { type: Number, default: 0 }, paid: { type: Number, default: 0 },
  status: { type: String, enum: ['DRAFT', 'POSTED', 'REVERSED'], default: 'POSTED' }, actorId: { type: String, required: true }, sourceId: Schema.Types.ObjectId,
  isBilled: { type: Boolean, default: false }, version: { type: Number, default: 0 }, draft: Schema.Types.Mixed, intercompanyId: Schema.Types.ObjectId,
  credited: { type: Number, default: 0 },
  counterpartId: Schema.Types.ObjectId, counterpartBusinessId: Schema.Types.ObjectId, receivedWeightKg: { type: Number, default: 0 }, receivedRolls: { type: Number, default: 0 }
}, { timestamps: true });
documentSchema.index({ date: -1, _id: -1 });
export const BusinessDocument = businessModel<InferSchemaType<typeof documentSchema>>('BusinessDocument', documentSchema);

const allocationSchema = new Schema({ sourceId: { type: Schema.Types.ObjectId, required: true }, sourceLineId: { type: String, required: true }, direction: { type: String, required: true }, billId: { type: Schema.Types.ObjectId, required: true }, fraction: { type: Number, required: true } }, { timestamps: true });
export const BillAllocation = businessModel<InferSchemaType<typeof allocationSchema>>('BillAllocation', allocationSchema);

const paymentSchema = new Schema({ billId: { type: Schema.Types.ObjectId, required: true }, voucherId: { type: Schema.Types.ObjectId, required: true }, amount: { type: Number, required: true }, date: { type: Date, required: true }, reference: { type: String, default: '' }, settlementGroupId: Schema.Types.ObjectId, status: { type: String, enum: ['POSTED', 'REVERSED'], default: 'POSTED' } }, { timestamps: true });
export const BillPayment = businessModel<InferSchemaType<typeof paymentSchema>>('BillPayment', paymentSchema);
