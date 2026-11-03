import { Schema, InferSchemaType } from 'mongoose';
import { businessModel } from './model.js';
import { partyModelName } from './context.js';

const catalogSchema = new Schema({ kind: { type: String, enum: ['FABRIC', 'COLOR'], required: true }, name: { type: String, required: true, trim: true }, normalized: { type: String, required: true }, code: { type: String, default: '' }, notes: { type: String, default: '' }, isActive: { type: Boolean, default: true } }, { timestamps: true });
catalogSchema.index({ kind: 1, normalized: 1 }, { unique: true });
export const CatalogChoice = businessModel<InferSchemaType<typeof catalogSchema>>('CatalogChoice', catalogSchema);

const counterSchema = new Schema({ kind: { type: String, required: true, unique: true }, value: { type: Number, default: 0 } });
export const DocumentCounter = businessModel<InferSchemaType<typeof counterSchema>>('DocumentCounter', counterSchema);

const commandSchema = new Schema<{ requestId: string; kind: string; hash: string; result: unknown }>({ requestId: { type: String, required: true, unique: true }, kind: { type: String, required: true }, hash: { type: String, required: true }, result: Schema.Types.Mixed }, { timestamps: true });
export const PostingRequest = businessModel('PostingRequest', commandSchema);

const stockSchema = new Schema({ yarnSpec: { type: String, required: true }, ownerKey: { type: String, default: 'OWN' }, totalWeightKg: { type: Number, default: 0 }, packageUnit: { type: String, default: 'cartons' }, quantity: { type: Number, default: 0 } }, { timestamps: true });
stockSchema.index({ yarnSpec: 1, ownerKey: 1, packageUnit: 1 }, { unique: true });
export const YarnInventory = businessModel<InferSchemaType<typeof stockSchema>>('YarnInventory', stockSchema);

const movementSchema = new Schema({ sourceKind: String, sourceId: { type: Schema.Types.ObjectId, required: true }, ownerKey: String, packageUnit: String, partyId: { type: Schema.Types.ObjectId, ref: partyModelName }, material: { type: String, enum: ['YARN', 'FABRIC'], required: true }, item: { type: String, required: true }, weightKg: { type: Number, required: true }, quantity: { type: Number, default: 0 }, location: { type: String, required: true }, date: { type: Date, required: true }, reason: { type: String, required: true }, actorId: { type: String, required: true }, reversed: { type: Boolean, default: false } }, { timestamps: true });
export const StockMovement = businessModel<InferSchemaType<typeof movementSchema>>('StockMovement', movementSchema);

const receiptItem = new Schema({ ownerKey: String, fabricType: { type: String, required: true }, yarnSpec: { type: String, required: true }, rollsCount: { type: Number, required: true }, weightKg: { type: Number, required: true }, wastageKg: { type: Number, required: true }, remarks: { type: String, default: '' }, allocations: [{ transactionId: Schema.Types.ObjectId, weightKg: Number, fabricKg: Number, wastageKg: Number }] });
const receiptSchema = new Schema({ receiptReferenceKey: String, receiptNo: { type: String, required: true, unique: true }, productionType: { type: String, enum: ['IN_HOUSE', 'OUTSOURCED'] }, partyId: { type: Schema.Types.ObjectId, ref: partyModelName, required: true }, gatePassNo: { type: String, required: true }, date: { type: Date, required: true }, remarks: { type: String, default: '' }, actorId: { type: String, required: true }, status: { type: String, enum: ['POSTED', 'REVERSED'], default: 'POSTED' }, items: { type: [receiptItem], required: true } }, { timestamps: true });
receiptSchema.index({ receiptReferenceKey: 1 }, { unique: true, partialFilterExpression: { receiptReferenceKey: { $type: 'string' }, status: 'POSTED' } });
export const KnittingReceipt = businessModel<InferSchemaType<typeof receiptSchema>>('KnittingReceipt', receiptSchema);

const dyeingReceiptSchema = new Schema({ receiptReferenceKey: String, receiptOrigin: String, evidence: String, location: { type: String, default: 'ZR_GODOWN' }, number: { type: String, required: true, unique: true }, gatePassNo: { type: String, required: true }, partyId: { type: Schema.Types.ObjectId, ref: partyModelName }, status: { type: String, enum: ['POSTED', 'REVERSED'], default: 'POSTED' }, date: { type: Date, required: true }, actorId: { type: String, required: true }, items: [{ ownerKey: String, batchId: Schema.Types.ObjectId, finishedLocation: String,
  allocations: [{ batchId: Schema.Types.ObjectId, rawKg: Number, rawRolls: Number, weightKg: Number, rolls: Number, wastageKg: Number }],
  fabricType: String, yarnSpec: String, color: String, rawKg: Number, rawRolls: Number, weightKg: Number, rolls: Number, wastageKg: Number }] }, { timestamps: true });
dyeingReceiptSchema.index({ receiptReferenceKey: 1 }, { unique: true, partialFilterExpression: { receiptReferenceKey: { $type: 'string' }, status: 'POSTED' } });
export const DyeingReceipt = businessModel<InferSchemaType<typeof dyeingReceiptSchema>>('DyeingReceipt', dyeingReceiptSchema);
