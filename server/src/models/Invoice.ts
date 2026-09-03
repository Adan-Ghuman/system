import { Schema, model, Document, Types } from 'mongoose';

export type InvoiceType = 'TAX_18_PERCENT' | 'NON_GST';

export interface IInvoice extends Document {
  invoiceNo: string;
  invoiceType: InvoiceType;
  dispatchId: Types.ObjectId;
  customerId: Types.ObjectId;
  ratePerKg: number;
  totalWeightKg: number;
  baseAmount: number;
  taxPercent: number;
  taxAmount: number;
  grandTotal: number;
  date: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    invoiceType: {
      type: String,
      enum: ['TAX_18_PERCENT', 'NON_GST'],
      required: true,
      index: true
    },
    dispatchId: {
      type: Schema.Types.ObjectId,
      ref: 'Dispatch',
      required: true,
      index: true
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      required: true,
      index: true
    },
    ratePerKg: {
      type: Number,
      required: true,
      min: 0.01
    },
    totalWeightKg: {
      type: Number,
      required: true,
      min: 0.01
    },
    baseAmount: {
      type: Number,
      required: true
    },
    taxPercent: {
      type: Number,
      required: true,
      default: 0
    },
    taxAmount: {
      type: Number,
      required: true,
      default: 0
    },
    grandTotal: {
      type: Number,
      required: true
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

invoiceSchema.index({ date: -1 });

export const Invoice = model<IInvoice>('Invoice', invoiceSchema);
