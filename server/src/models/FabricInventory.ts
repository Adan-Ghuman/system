import { Schema, model, Document } from 'mongoose';

export type FabricState = 'RAW_ECRU' | 'FINISHED_DYED';
export type InventoryLocation =
  | 'ZR_GODOWN'
  | 'GHUMMAN_DYEING'
  | 'RAJPUT_DYEING'
  | 'HAFIZ_SAAD_DYEING'
  | 'HB_DYEING';

export interface IFabricInventory extends Document {
  fabricType: string;
  yarnSpec: string;
  state: 'RAW_ECRU' | 'FINISHED_DYED';
  color: string;
  location: InventoryLocation;
  totalRolls: number;
  totalWeightKg: number;
  createdAt: Date;
  updatedAt: Date;
}

const fabricInventorySchema = new Schema<IFabricInventory>(
  {
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
      trim: true,
      uppercase: true,
      default: 'ECRU'
    },
    location: {
      type: String,
      enum: ['ZR_GODOWN', 'GHUMMAN_DYEING', 'RAJPUT_DYEING', 'HAFIZ_SAAD_DYEING', 'HB_DYEING'],
      required: true,
      index: true
    },
    totalRolls: {
      type: Number,
      default: 0,
      min: 0
    },
    totalWeightKg: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

fabricInventorySchema.index(
  { fabricType: 1, yarnSpec: 1, state: 1, color: 1, location: 1 },
  { unique: true }
);

export const FabricInventory = model<IFabricInventory>('FabricInventory', fabricInventorySchema);
