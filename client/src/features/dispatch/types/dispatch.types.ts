import { InventoryLocation } from '../../inventory/types/inventory.types.js';

export type InvoiceType = 'TAX_18_PERCENT' | 'NON_GST';

export interface DispatchRollItem {
  rollNumber: number;
  grossWeightKg: number;
  tareKg: number;
  netWeightKg: number;
}

export interface DispatchInvoiceSummary {
  _id: string;
  invoiceNo: string;
  invoiceType: InvoiceType;
  ratePerKg: number;
  totalWeightKg: number;
  baseAmount: number;
  taxPercent: number;
  taxAmount: number;
  grandTotal: number;
  date: string;
}

export interface DispatchItem {
  _id: string;
  dispatchNo: string;
  ogpNo: string;
  customerId: {
    _id: string;
    code: string;
    name: string;
    phone?: string;
    currentBalance: number;
  };
  fromLocation: InventoryLocation;
  fabricType: string;
  yarnSpec: string;
  color: string;
  rolls: DispatchRollItem[];
  totalRolls: number;
  totalNetWeightKg: number;
  driverName?: string;
  vehicleNo?: string;
  date: string;
  remarks?: string;
  invoice?: DispatchInvoiceSummary | null;
  createdAt: string;
}

export interface CreateDispatchPayload {
  customerId: string;
  fromLocation: InventoryLocation;
  fabricType: string;
  yarnSpec: string;
  color: string;
  rolls: DispatchRollItem[];
  ratePerKg: number;
  invoiceType: InvoiceType;
  driverName?: string;
  vehicleNo?: string;
  date?: string;
  remarks?: string;
}
