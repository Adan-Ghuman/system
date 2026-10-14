import { businessModel } from '../business/model.js';
import { partyModelName } from '../business/context.js';
import { Schema, model, Document, Types } from 'mongoose';

export type YarnTransactionType = 'OUTWARD_TO_KNITTER' | 'INWARD_FROM_CLIENT';

export interface IYarnTransaction extends Document {
  status: 'POSTED' | 'REVERSED';
  transactionType: YarnTransactionType;
  partyId: Types.ObjectId;
  yarnSpec: string;
  gatePassNo: string;
  date: Date;
  boxCount: number;
  netWeightPerBox: number;
  grossWeightKg: number;
  actualWastageKg: number;
  totalWeightKg?: number;
  packageUnit: string;
  ownerKey: string;
  returnedPackages: number;
  wastagePercent: number;
  wastageWeightKg: number;
  netExpectedFabricKg: number;
  receivedFabricKg: number;
  remainingYarnBalanceKg: number;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const yarnTransactionSchema = new Schema<IYarnTransaction>(
  {
    status: { type: String, enum: ['POSTED', 'REVERSED'], default: 'POSTED' },
    transactionType: {
      type: String,
      enum: ['OUTWARD_TO_KNITTER', 'INWARD_FROM_CLIENT'],
      required: true
    },
    partyId: {
      type: Schema.Types.ObjectId,
      ref: partyModelName,
      required: true,
      index: true
    },
    yarnSpec: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    gatePassNo: {
      type: String,
      required: true,
      trim: true
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    boxCount: {
      type: Number,
      required: true,
      min: 1
    },
    netWeightPerBox: {
      type: Number,
      required: true,
      min: 0.000001
    },
    actualWastageKg: { type: Number, default: 0 },
    totalWeightKg: { type: Number },
    packageUnit: { type: String, default: 'cartons' },
    ownerKey: { type: String, default: 'OWN' },
    returnedPackages: { type: Number, default: 0 },
    grossWeightKg: {
      type: Number,
      required: true
    },
    wastagePercent: {
      type: Number,
      default: 1.0
    },
    wastageWeightKg: {
      type: Number,
      required: true
    },
    netExpectedFabricKg: {
      type: Number,
      required: true
    },
    receivedFabricKg: {
      type: Number,
      default: 0
    },
    remainingYarnBalanceKg: {
      type: Number,
      required: true
    },
    remarks: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

yarnTransactionSchema.index({ partyId: 1, yarnSpec: 1 });
yarnTransactionSchema.index({ transactionType: 1, date: -1 });

export const YarnTransaction = businessModel<IYarnTransaction>('YarnTransaction', yarnTransactionSchema);
