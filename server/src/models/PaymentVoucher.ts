import { Schema, model, Document, Types } from 'mongoose';

export type VoucherType = 'RECEIPT' | 'PAYMENT' | 'JOURNAL';
export type PaymentMode = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE';

export interface IPaymentVoucher extends Document {
  voucherNo: string;
  voucherType: VoucherType;
  paymentMode: PaymentMode;
  partyId: Types.ObjectId;
  amount: number;
  date: Date;
  bankName?: string;
  chequeNo?: string;
  chequeDate?: Date;
  transactionRef?: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentVoucherSchema = new Schema<IPaymentVoucher>(
  {
    voucherNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    voucherType: {
      type: String,
      enum: ['RECEIPT', 'PAYMENT', 'JOURNAL'],
      required: true,
      index: true
    },
    paymentMode: {
      type: String,
      enum: ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE'],
      required: true,
      index: true
    },
    partyId: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    bankName: {
      type: String,
      trim: true,
      default: ''
    },
    chequeNo: {
      type: String,
      trim: true,
      default: ''
    },
    chequeDate: {
      type: Date
    },
    transactionRef: {
      type: String,
      trim: true,
      default: ''
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

paymentVoucherSchema.index({ date: -1 });

export const PaymentVoucher = model<IPaymentVoucher>('PaymentVoucher', paymentVoucherSchema);
