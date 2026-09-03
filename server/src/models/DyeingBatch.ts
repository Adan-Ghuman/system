import { Schema, model, Document, Types } from 'mongoose';

export type DyeingMillType = 'GHUMMAN_DYEING' | 'RAJPUT_DYEING' | 'OTHER';
export type DyeingBatchStatus = 'ISSUED' | 'IN_PROCESS' | 'COMPLETED';

export interface IDyeingBatch extends Document {
  batchNo: string;
  millName: DyeingMillType;
  millPartyId?: Types.ObjectId;
  fabricType: string;
  yarnSpec: string;
  targetColor: string;
  igpNo?: string;
  ogpNo?: string;
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
    batchNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    millName: {
      type: String,
      enum: ['GHUMMAN_DYEING', 'RAJPUT_DYEING', 'OTHER'],
      required: true,
      index: true
    },
    millPartyId: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
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
    targetColor: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true
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
      ref: 'Party',
      index: true
    },
    status: {
      type: String,
      enum: ['ISSUED', 'IN_PROCESS', 'COMPLETED'],
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

export const DyeingBatch = model<IDyeingBatch>('DyeingBatch', dyeingBatchSchema);
