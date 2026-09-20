import { Schema, model, Document, Types } from 'mongoose';

export type DyeingUnitLocationType = 'DYEING_MILL' | 'GODOWN' | 'OTHER';

export interface IDyeingUnit extends Document {
  code: string;
  name: string;
  shortName: string;
  type: DyeingUnitLocationType;
  partyId?: Types.ObjectId;
  address?: string;
  contactPhone?: string;
  isActive: boolean;
  sortOrder: number;
  isSystemDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const dyeingUnitSchema = new Schema<IDyeingUnit>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    shortName: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['DYEING_MILL', 'GODOWN', 'OTHER'],
      default: 'DYEING_MILL',
      required: true,
      index: true
    },
    partyId: {
      type: Schema.Types.ObjectId,
      ref: 'Party'
    },
    address: {
      type: String,
      trim: true,
      default: ''
    },
    contactPhone: {
      type: String,
      trim: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    isSystemDefault: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export const DEFAULT_DYEING_UNITS = [
  {
    code: 'GHUMMAN_DYEING',
    name: 'Ghumman Dyeing Unit',
    shortName: 'Ghumman Dyeing',
    type: 'DYEING_MILL' as DyeingUnitLocationType,
    address: 'Main Dyeing Mill, Faisalabad',
    isSystemDefault: true,
    sortOrder: 1
  },
  {
    code: 'RAJPUT_DYEING',
    name: 'Rajput Dyeing Unit',
    shortName: 'Rajput Unit',
    type: 'DYEING_MILL' as DyeingUnitLocationType,
    address: 'Contract Dyeing Facility',
    isSystemDefault: true,
    sortOrder: 2
  },
  {
    code: 'HAFIZ_SAAD_DYEING',
    name: 'Hafiz Saad Dyeing Unit',
    shortName: 'Hafiz Saad Unit',
    type: 'DYEING_MILL' as DyeingUnitLocationType,
    address: 'Contract Dyeing Facility',
    isSystemDefault: true,
    sortOrder: 3
  },
  {
    code: 'HB_DYEING',
    name: 'HB Dyeing Unit',
    shortName: 'HB Dyeing Unit',
    type: 'DYEING_MILL' as DyeingUnitLocationType,
    address: 'Contract Dyeing Facility',
    isSystemDefault: true,
    sortOrder: 4
  },
  {
    code: 'ZR_GODOWN',
    name: 'ZR Central Godown',
    shortName: 'ZR Godown',
    type: 'GODOWN' as DyeingUnitLocationType,
    address: 'Central Storage Warehouse',
    isSystemDefault: true,
    sortOrder: 5
  }
];

export const DyeingUnit = model<IDyeingUnit>('DyeingUnit', dyeingUnitSchema);
