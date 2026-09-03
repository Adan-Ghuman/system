import { Schema, model, Document } from 'mongoose';
import { InventoryLocation, FabricState } from './FabricInventory.js';

export interface IStockTransfer extends Document {
  transferNo: string;
  fromLocation: InventoryLocation;
  toLocation: InventoryLocation;
  fabricType: string;
  yarnSpec: string;
  state: FabricState;
  color: string;
  rollsCount: number;
  weightKg: number;
  gatePassNo?: string;
  driverName?: string;
  vehicleNo?: string;
  date: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const stockTransferSchema = new Schema<IStockTransfer>(
  {
    transferNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    fromLocation: {
      type: String,
      enum: ['ZR_GODOWN', 'GHUMMAN_DYEING', 'RAJPUT_DYEING'],
      required: true,
      index: true
    },
    toLocation: {
      type: String,
      enum: ['ZR_GODOWN', 'GHUMMAN_DYEING', 'RAJPUT_DYEING'],
      required: true,
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
    state: {
      type: String,
      enum: ['RAW_ECRU', 'FINISHED_DYED'],
      required: true,
      index: true
    },
    color: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    rollsCount: {
      type: Number,
      required: true,
      min: 1
    },
    weightKg: {
      type: Number,
      required: true,
      min: 0.01
    },
    gatePassNo: {
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

stockTransferSchema.index({ date: -1 });

export const StockTransfer = model<IStockTransfer>('StockTransfer', stockTransferSchema);
