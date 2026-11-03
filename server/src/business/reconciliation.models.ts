import { InferSchemaType, Schema } from 'mongoose';
import { businessModel } from './model.js';

const reconciliationSchema = new Schema({
  kind: { type: String, enum: ['FABRIC', 'YARN', 'KNITTING', 'DYEING', 'YARN_RETURN'], required: true },
  key: String,
  open: { type: Boolean, default: true },
  sourceId: { type: Schema.Types.ObjectId, required: true },
  lineId: Schema.Types.ObjectId,
  reference: String,
  sourceKind: String,
  partyId: Schema.Types.ObjectId,
  item: { type: String, required: true },
  fabricType: String,
  yarnSpec: { type: String, required: true },
  ownerKey: { type: String, required: true },
  location: { type: String, required: true },
  packageUnit: String,
  state: String,
  color: String,
  quantity: { type: Number, default: 0 },
  weightKg: { type: Number, default: 0 },
  fabricKg: Number,
  finishedQuantity: Number,
  finishedKg: Number,
  date: { type: Date, required: true },
  reason: { type: String, required: true },
  actorId: { type: String, required: true },
  events: [{
    sourceId: Schema.Types.ObjectId,
    date: Date,
    recordedAt: Date,
    reason: String,
    reference: String,
    sourceKind: String,
    actorId: String,
    quantity: Number,
    weightKg: Number,
    appliedQuantity: Number,
    appliedKg: Number
  }]
}, { timestamps: true });
reconciliationSchema.index({ key: 1 }, { unique: true, partialFilterExpression: { open: true, key: { $type: 'string' } } });
reconciliationSchema.index({ open: 1, date: -1 });
export const Reconciliation = businessModel<InferSchemaType<typeof reconciliationSchema>>('Reconciliation', reconciliationSchema);

const closingSchema = new Schema({
  date: { type: String, required: true },
  reason: { type: String, required: true },
  actorId: { type: String, required: true },
  items: [{ entryId: Schema.Types.ObjectId, quantity: Number, weightKg: Number, finishedQuantity: Number, finishedKg: Number }]
}, { timestamps: true });
export const ReconciliationClosing = businessModel<InferSchemaType<typeof closingSchema>>('ReconciliationClosing', closingSchema);
