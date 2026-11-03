import { OperationLine, AdditionalCharge, OperationDocument } from './types.js';
import { DispatchRollItem } from '../features/dispatch/types/dispatch.types.js';

export type SaleMode = 'FABRIC' | 'EXISTING_DELIVERY' | 'KNITTING_CHARGE' | 'DYEING_CHARGE';
export interface SaleSourceLine { sourceLineId: string; fabricType: string; yarnSpec: string; color: string; state: 'RAW_ECRU' | 'FINISHED_DYED'; rolls: number; weightKg: number; eligible: boolean; assignable: boolean; }
export interface SaleSource { _id: string; label: string; date: string; items: SaleSourceLine[]; }
export interface SalePayload {
  shortageReason?: string;
  requestId: string; customerId: string; mode: SaleMode; date: string; reference: string; remarks: string; location: string;
  state?: 'RAW_ECRU' | 'FINISHED_DYED'; inventoryId?: string; sourceId?: string; draftId?: string; billNow: boolean; sourceMode: 'WORK' | 'PAPER';
  paper?: { confirmed: boolean; reason: string; periodFrom?: string; periodTo?: string };
  items: OperationLine[]; rolls: DispatchRollItem[]; taxPercent: 0 | 18; additionalCharges: AdditionalCharge[];
  driverName: string; vehicleNo: string; poNo?: string; externalReference?: string;
  payment: { kind: 'LATER' | 'PART' | 'FULL' | 'EXISTING' | 'UNKNOWN'; amount: number; date?: string; method: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE'; bankName: string; chequeNo: string; chequeDate?: string; transactionRef: string; voucherId?: string };
}
export interface SaleQuote { stockBalance?: { before: { quantity: number; weightKg: number }; after: { quantity: number; weightKg: number } }; baseAmount: number; taxPercent: number; taxAmount: number; total: number; received: number; outstanding: number | null; items: OperationLine[]; }
export interface SaleResult extends SaleQuote { deliveryId?: string; bill: OperationDocument | null; payment?: unknown; }
export interface SaleRow { _id: string; customer?: { _id: string; name: string; code: string }; date: string; reference?: string; number: string; kind: string; status: string; total: number; paid: number | null; outstanding: number | null; unknown: number; deliveryId?: string; deliveryNo?: string; deliveryStatus?: string; canBill?: boolean; documents: Array<{ _id: string; number: string; kind: string; status: string }>; }
export interface SaleEntryCache { body: SalePayload; quote?: SaleQuote; pending?: boolean; }
