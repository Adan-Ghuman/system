import { Schema, model, Document } from 'mongoose';

export interface IPartyTags {
  isYarnClient: boolean;
  isKnitter: boolean;
  isFabricBuyer: boolean;
  isDyeingMill: boolean;
}

export interface IParty extends Document {
  code: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  mlNo?: string;
  tags: IPartyTags;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const partySchema = new Schema<IParty>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    contactPerson: {
      type: String,
      trim: true,
      default: ''
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    address: {
      type: String,
      trim: true,
      default: ''
    },
    mlNo: {
      type: String,
      trim: true,
      default: ''
    },
    tags: {
      isYarnClient: {
        type: Boolean,
        default: false
      },
      isKnitter: {
        type: Boolean,
        default: false
      },
      isFabricBuyer: {
        type: Boolean,
        default: false
      },
      isDyeingMill: {
        type: Boolean,
        default: false
      }
    },
    openingBalance: {
      type: Number,
      default: 0
    },
    currentBalance: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

partySchema.index({ 'tags.isYarnClient': 1 });
partySchema.index({ 'tags.isKnitter': 1 });
partySchema.index({ 'tags.isFabricBuyer': 1 });
partySchema.index({ 'tags.isDyeingMill': 1 });

export const Party = model<IParty>('Party', partySchema);
