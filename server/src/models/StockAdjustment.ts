import { businessModel } from '../business/model.js';
import { partyModelName } from '../business/context.js';
import { Schema, model, Document, Types } from 'mongoose';
import { InventoryLocation, FabricState } from './FabricInventory.js';

export type StockAdjustmentReason =
  | 'AUDIT_DISCREPANCY'
  | 'DAMAGE'
  | 'SAMPLE_CUTTING'
  | 'SCRAP'
  | 'MANUAL_CORRECTION';

export interface IStockAdjustment extends Document {
  correctionId?: Types.ObjectId;
  sourceInventoryId?: Types.ObjectId;
  targetInventoryId?: Types.ObjectId;
  ownerKey: string;
  fabricType: string;
  yarnSpec: string;
  state: FabricState;
  color: string;
  location: InventoryLocation;
  adjustmentRolls: number;
  adjustmentWeightKg: number;
  reason: StockAdjustmentReason;
  date: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const stockAdjustmentSchema = new Schema<IStockAdjustment>(
  {
    correctionId: Schema.Types.ObjectId,
    sourceInventoryId: Schema.Types.ObjectId,
    targetInventoryId: Schema.Types.ObjectId,
    ownerKey: { type: String, default: 'OWN' },
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
    location: {
      type: String,
      required: true,
      index: true
    },
    adjustmentRolls: {
      type: Number,
      required: true
    },
    adjustmentWeightKg: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      enum: ['AUDIT_DISCREPANCY', 'DAMAGE', 'SAMPLE_CUTTING', 'SCRAP', 'MANUAL_CORRECTION'],
      required: true,
      index: true
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

stockAdjustmentSchema.index({ date: -1 });

export const StockAdjustment = businessModel<IStockAdjustment>('StockAdjustment', stockAdjustmentSchema);
