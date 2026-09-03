export type VoucherType = 'RECEIPT' | 'PAYMENT' | 'JOURNAL';
export type PaymentMode = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE';
export type LedgerEntryType = 'DEBIT' | 'CREDIT';
export type LedgerReferenceType = 'INVOICE' | 'PAYMENT' | 'OPENING_BALANCE' | 'ADJUSTMENT';

export interface PaymentVoucherItem {
  _id: string;
  voucherNo: string;
  voucherType: VoucherType;
  paymentMode: PaymentMode;
  partyId: {
    _id: string;
    code: string;
    name: string;
    phone?: string;
    currentBalance: number;
  };
  amount: number;
  date: string;
  bankName?: string;
  chequeNo?: string;
  chequeDate?: string;
  transactionRef?: string;
  remarks?: string;
  createdAt: string;
}

export interface PartyLedgerEntryItem {
  _id: string;
  partyId: string;
  entryType: LedgerEntryType;
  amount: number;
  runningBalance: number;
  referenceType: LedgerReferenceType;
  referenceId?: string;
  referenceNo?: string;
  date: string;
  description?: string;
  createdAt: string;
}

export interface LedgerStatementResponse {
  party: {
    _id: string;
    code: string;
    name: string;
    phone?: string;
    address?: string;
    currentBalance: number;
  };
  entries: PartyLedgerEntryItem[];
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
}

export interface CreateVoucherPayload {
  voucherType: VoucherType;
  paymentMode: PaymentMode;
  partyId: string;
  amount: number;
  date?: string;
  bankName?: string;
  chequeNo?: string;
  chequeDate?: string;
  transactionRef?: string;
  remarks?: string;
}

export interface AccountingMetricsSummary {
  totalReceivables: number;
  totalPayables: number;
  netReceivablePosition: number;
  monthlyReceipts: number;
  monthlyPayments: number;
  totalParties: number;
}
