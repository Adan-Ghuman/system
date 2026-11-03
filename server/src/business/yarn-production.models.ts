import { InferSchemaType, Schema } from 'mongoose';
import { businessModel } from './model.js';

const machineSchema = new Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  process: { type: String, enum: ['SPINNING', 'REWINDING'], required: true },
  location: { type: String, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });
machineSchema.index({ code: 1 }, { unique: true });
export const YarnMachine = businessModel<InferSchemaType<typeof machineSchema>>('YarnMachine', machineSchema);

const yarnMeasurement = new Schema({
  yarnSpec: { type: String, required: true },
  packageUnit: { type: String, required: true },
  quantity: { type: Number, required: true },
  weightKg: { type: Number, required: true }
}, { _id: false });

const runSchema = new Schema({
  machineId: { type: Schema.Types.ObjectId, required: true },
  machineCode: { type: String, required: true },
  machineName: { type: String, required: true },
  process: { type: String, enum: ['SPINNING', 'REWINDING'], required: true },
  location: { type: String, required: true },
  productionDate: { type: String, required: true },
  shift: { type: String, enum: ['DAY', 'NIGHT'], required: true },
  reference: { type: String, required: true },
  output: { type: yarnMeasurement, required: true },
  input: yarnMeasurement,
  wasteKg: { type: Number, required: true },
  status: { type: String, enum: ['POSTED', 'REVERSED'], default: 'POSTED' },
  actorId: { type: String, required: true },
  replacesId: Schema.Types.ObjectId,
  replacedById: Schema.Types.ObjectId,
  correctionReason: String,
  stockStatus: { type: String, enum: ['AWAITING', 'POSTED', 'LINKED'], default: 'AWAITING' },
  linkedReceiptId: Schema.Types.ObjectId,
  stockEvents: [{
    action: { type: String, enum: ['POSTED', 'LINKED', 'UNDONE'], required: true },
    date: { type: String, required: true },
    actorId: { type: String, required: true },
    reason: String,
    receiptId: Schema.Types.ObjectId,
    receiptNumber: String
  }]
}, { timestamps: true });
runSchema.index({ machineId: 1, productionDate: 1, shift: 1, reference: 1 }, {
  unique: true, partialFilterExpression: { status: 'POSTED' }
});
runSchema.index({ linkedReceiptId: 1 }, {
  unique: true, partialFilterExpression: { linkedReceiptId: { $type: 'objectId' } }
});
runSchema.index({ status: 1, productionDate: -1 });
export const YarnProductionRun = businessModel<InferSchemaType<typeof runSchema>>('YarnProductionRun', runSchema);
