import { Schema, model, Document, Types } from 'mongoose';

export type LedgerEntryType = 'DEBIT' | 'CREDIT';
export type LedgerReferenceType = 'INVOICE' | 'PAYMENT' | 'OPENING_BALANCE' | 'ADJUSTMENT';

export interface IPartyLedgerEntry extends Document {
  partyId: Types.ObjectId;
  entryType: LedgerEntryType;
  amount: number;
  runningBalance: number;
  referenceType: LedgerReferenceType;
  referenceId?: Types.ObjectId;
  referenceNo?: string;
  date: Date;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const partyLedgerEntrySchema = new Schema<IPartyLedgerEntry>(
  {
    partyId: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      required: true,
      index: true
    },
    entryType: {
      type: String,
      enum: ['DEBIT', 'CREDIT'],
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    runningBalance: {
      type: Number,
      required: true
    },
    referenceType: {
      type: String,
      enum: ['INVOICE', 'PAYMENT', 'OPENING_BALANCE', 'ADJUSTMENT'],
      required: true,
      index: true
    },
    referenceId: {
      type: Schema.Types.ObjectId
    },
    referenceNo: {
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
    description: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

partyLedgerEntrySchema.index({ partyId: 1, date: -1 });

export const PartyLedgerEntry = model<IPartyLedgerEntry>('PartyLedgerEntry', partyLedgerEntrySchema);
