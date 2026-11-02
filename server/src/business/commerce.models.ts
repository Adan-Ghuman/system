import { Schema, InferSchemaType } from 'mongoose';
import { businessModel } from './model.js';
import { partyModelName, voucherModelName } from './context.js';

export const commerceItemSchema = new Schema({ fabricType: { type: String, default: '' }, yarnSpec: { type: String, default: '' }, color: { type: String, default: 'ECRU' }, state: { type: String, enum: ['RAW_ECRU', 'FINISHED_DYED'], default: 'RAW_ECRU' }, rolls: { type: Number, default: 0 }, weightKg: { type: Number, default: 0 }, rate: { type: Number, default: 0 }, basis: { type: String, enum: ['KG', 'ROLL', 'JOB'], default: 'KG' }, description: { type: String, default: '' }, sourceLineId: { type: String, default: '' }, sourceId: Schema.Types.ObjectId, packageUnit: { type: String, default: 'cartons' }, ownerKey: { type: String, default: 'OWN' }, returnedRolls: { type: Number, default: 0 }, returnedWeightKg: { type: Number, default: 0 }, returnedReceivedRolls: { type: Number, default: 0 }, returnedReceivedKg: { type: Number, default: 0 }, sourceLocation: { type: String, default: 'ZR_GODOWN' }, receivedWeightKg: { type: Number, default: 0 }, receivedRolls: { type: Number, default: 0 } });
const documentSchema = new Schema({
  receiptOrigin: { type: String },
  financialOnly: { type: Boolean, default: false },
  returnLocationsRecorded: { type: Boolean, default: false },
  salesReferenceKey: String,
  financialReferenceKey: String,
  serviceEvidence: new Schema({ reference: { type: String, required: true }, reason: { type: String, required: true }, confirmedBy: { type: String, required: true }, confirmedAt: { type: Date, required: true }, periodFrom: Date, periodTo: Date }, { _id: false }),
  number: { type: String, required: true, unique: true }, kind: { type: String, required: true }, direction: { type: String, enum: ['PAYABLE', 'RECEIVABLE'], default: 'PAYABLE' },
  partyId: { type: Schema.Types.ObjectId, ref: partyModelName }, date: { type: Date, required: true }, reference: { type: String, default: '' },
  location: { type: String, default: 'ZR_GODOWN' }, items: { type: [commerceItemSchema], default: [] }, remarks: { type: String, default: '' },
  additionalCharges: { type: [new Schema({ description: { type: String, required: true }, amount: { type: Number, required: true }, taxable: { type: Boolean, default: false } })], default: [] },
  baseAmount: { type: Number, default: 0 }, taxPercent: { type: Number, default: 0 }, taxAmount: { type: Number, default: 0 }, total: { type: Number, default: 0 }, paid: { type: Number, default: 0 },
  status: { type: String, enum: ['DRAFT', 'POSTED', 'REVERSED'], default: 'POSTED' }, settlementStatus: { type: String, enum: ['TRACKED', 'NOT_RECORDED'], default: 'TRACKED' }, actorId: { type: String, required: true }, sourceId: Schema.Types.ObjectId,
  isBilled: { type: Boolean, default: false }, version: { type: Number, default: 0 }, draft: Schema.Types.Mixed, intercompanyId: Schema.Types.ObjectId,
  credited: { type: Number, default: 0 },
  counterpartId: Schema.Types.ObjectId, counterpartBusinessId: Schema.Types.ObjectId, receivedWeightKg: { type: Number, default: 0 }, receivedRolls: { type: Number, default: 0 }
}, { timestamps: true });
documentSchema.index({ date: -1, _id: -1 });
documentSchema.index({ salesReferenceKey: 1 }, { unique: true, partialFilterExpression: { salesReferenceKey: { $type: 'string' }, status: 'POSTED' } });
documentSchema.index({ financialReferenceKey: 1 }, { unique: true, partialFilterExpression: { financialReferenceKey: { $type: 'string' }, status: 'POSTED' } });
export const BusinessDocument = businessModel<InferSchemaType<typeof documentSchema>>('BusinessDocument', documentSchema);

const allocationSchema = new Schema({ sourceId: { type: Schema.Types.ObjectId, required: true }, sourceLineId: { type: String, required: true }, direction: { type: String, required: true }, billId: { type: Schema.Types.ObjectId, required: true }, fraction: { type: Number, required: true } }, { timestamps: true });
export const BillAllocation = businessModel<InferSchemaType<typeof allocationSchema>>('BillAllocation', allocationSchema);

const paymentSchema = new Schema({ allocationOnly: { type: Boolean, default: false }, billId: { type: Schema.Types.ObjectId, required: true }, voucherId: { type: Schema.Types.ObjectId, ref: voucherModelName, required: true }, amount: { type: Number, required: true }, date: { type: Date, required: true }, reference: { type: String, default: '' }, settlementGroupId: Schema.Types.ObjectId, status: { type: String, enum: ['POSTED', 'REVERSED'], default: 'POSTED' } }, { timestamps: true });
export const BillPayment = businessModel<InferSchemaType<typeof paymentSchema>>('BillPayment', paymentSchema);

const assignmentSchema = new Schema({ sourceId: { type: Schema.Types.ObjectId, required: true }, sourceLineId: { type: String, required: true }, customerId: { type: Schema.Types.ObjectId, ref: partyModelName, required: true }, reason: { type: String, required: true }, actorId: { type: String, required: true } }, { timestamps: true });
assignmentSchema.index({ sourceId: 1, sourceLineId: 1 }, { unique: true });
export const SourceBillingAssignment = businessModel<InferSchemaType<typeof assignmentSchema>>('SourceBillingAssignment', assignmentSchema);
