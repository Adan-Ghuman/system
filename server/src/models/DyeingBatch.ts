import { businessModel } from '../business/model.js';
import { partyModelName } from '../business/context.js';
import { Schema, model, Document, Types } from 'mongoose';

export type DyeingMillType = string;
export type DyeingBatchStatus = 'ISSUED' | 'IN_PROCESS' | 'COMPLETED' | 'REVERSED';

export interface IDyeingBatch extends Document {
  sourceInventoryId?: Types.ObjectId;
  batchNo: string;
  ownerKey: string;
  receivedRawKg: number;
  receivedRawRolls: number;
  millName: DyeingMillType;
  millPartyId?: Types.ObjectId;
  fabricType: string;
  yarnSpec: string;
  yarnSpecs?: string[];
  targetColor: string;
  customMillName?: string;
  igpNo?: string;
  ogpNo?: string;
  machineNo?: string;
  driverName?: string;
  vehicleNo?: string;
  width?: string;
  gsm?: string;
  dateIssued: Date;
  dateReceived?: Date;
  ecruRollsCount: number;
  ecruWeightKg: number;
  finishRollsCount?: number;
  finishWeightKg?: number;
  shortageWeightKg?: number;
  shortagePercent?: number;
  allocatedCustomerId?: Types.ObjectId;
  status: DyeingBatchStatus;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const dyeingBatchSchema = new Schema<IDyeingBatch>(
  {
    sourceInventoryId: Schema.Types.ObjectId,
    ownerKey: { type: String, default: 'OWN' },
    receivedRawKg: { type: Number, default: 0 },
    receivedRawRolls: { type: Number, default: 0 },
    batchNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    millName: {
      type: String,
      required: true,
      index: true
    },
    millPartyId: {
      type: Schema.Types.ObjectId,
      ref: partyModelName,
      index: true
    },
    fabricType: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    yarnSpec: {
      type: String,
      required: true,
      trim: true
    },
    yarnSpecs: {
      type: [String],
      default: []
    },
    targetColor: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true
    },
    customMillName: {
      type: String,
      trim: true,
      default: ''
    },
    igpNo: {
      type: String,
      trim: true,
      default: ''
    },
    ogpNo: {
      type: String,
      trim: true,
      default: ''
    },
    machineNo: {
      type: String,
      trim: true,
      default: ''
    },
    driverName: {
      type: String,
      trim: true,
      default: ''
    },
    vehicleNo: {
      type: String,
      trim: true,
      default: ''
    },
    width: {
      type: String,
      trim: true,
      default: ''
    },
    gsm: {
      type: String,
      trim: true,
      default: ''
    },
    dateIssued: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    dateReceived: {
      type: Date
    },
    ecruRollsCount: {
      type: Number,
      required: true,
      min: 1
    },
    ecruWeightKg: {
      type: Number,
      required: true,
      min: 0.01
    },
    finishRollsCount: {
      type: Number,
      default: 0
    },
    finishWeightKg: {
      type: Number,
      default: 0
    },
    shortageWeightKg: {
      type: Number,
      default: 0
    },
    shortagePercent: {
      type: Number,
      default: 0
    },
    allocatedCustomerId: {
      type: Schema.Types.ObjectId,
      ref: partyModelName,
      index: true
    },
    status: {
      type: String,
      enum: ['ISSUED', 'IN_PROCESS', 'COMPLETED', 'REVERSED'],
      default: 'ISSUED',
      index: true
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

dyeingBatchSchema.index({ millName: 1, status: 1 });
dyeingBatchSchema.index({ dateIssued: -1 });

export const DyeingBatch = businessModel<IDyeingBatch>('DyeingBatch', dyeingBatchSchema);
