import { Schema, model, Document, Types } from 'mongoose';
import { InventoryLocation } from './FabricInventory.js';

export interface IDispatchRoll {
  rollNumber: number;
  grossWeightKg: number;
  tareKg: number;
  netWeightKg: number;
}

export interface IDispatch extends Document {
  dispatchNo: string;
  ogpNo: string;
  customerId: Types.ObjectId;
  fromLocation: InventoryLocation;
  fabricType: string;
  yarnSpec: string;
  color: string;
  rolls: IDispatchRoll[];
  totalRolls: number;
  totalNetWeightKg: number;
  driverName?: string;
  vehicleNo?: string;
  date: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const dispatchRollSchema = new Schema<IDispatchRoll>(
  {
    rollNumber: { type: Number, required: true },
    grossWeightKg: { type: Number, required: true },
    tareKg: { type: Number, default: 0 },
    netWeightKg: { type: Number, required: true }
  },
  { _id: false }
);

const dispatchSchema = new Schema<IDispatch>(
  {
    dispatchNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    ogpNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      required: true,
      index: true
    },
    fromLocation: {
      type: String,
      enum: ['ZR_GODOWN', 'GHUMMAN_DYEING', 'RAJPUT_DYEING'],
      required: true,
      index: true
    },
    fabricType: {
      type: String,
      required: true,
      trim: true
    },
    yarnSpec: {
      type: String,
      required: true,
      trim: true
    },
    color: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    rolls: {
      type: [dispatchRollSchema],
      required: true
    },
    totalRolls: {
      type: Number,
      required: true,
      min: 1
    },
    totalNetWeightKg: {
      type: Number,
      required: true,
      min: 0.01
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
    date: {
      type: Date,
      required: true,
      default: Date.now,
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

dispatchSchema.index({ date: -1 });

export const Dispatch = model<IDispatch>('Dispatch', dispatchSchema);
