import { OperationLine, AdditionalCharge, OperationDocument } from './types.js';
import { SalePayload } from './sales.types.js';
export type PurchaseMode = 'YARN' | 'FABRIC' | 'KNITTING' | 'DYEING';
export interface PurchaseLine extends OperationLine { sourceId?: string; wastageKg?: number; batchId?: string; rawKg?: number; rawRolls?: number; components?: Array<{ yarnSpec: string; weightKg: number }>; }
export interface PurchasePayload {
  requestId: string; draftId?: string; partyId: string; mode: PurchaseMode; situation: 'NOW' | 'EXISTING' | 'PAPER'; date: string; receiptDate?: string; reference: string; receiptReference: string; location: string; remarks: string; billNow: boolean; ownerKey: string; productionType: 'IN_HOUSE' | 'OUTSOURCED'; receiptOrigin: 'BATCH' | 'EXTERNAL'; evidence?: { confirmed: boolean; reason: string }; items: PurchaseLine[]; additionalCharges: AdditionalCharge[]; taxPercent: 0 | 18; payment: SalePayload['payment']; poNo?: string; externalReference?: string;
}
export interface PurchaseQuote { items: PurchaseLine[]; total: number; baseAmount: number; taxPercent: number; taxAmount: number; paid: number; received: number; outstanding: number | null; }
export interface PurchaseResult extends PurchaseQuote { bill: OperationDocument | null; receiptId?: string; receiptKind?: string; }
export interface PurchaseCache { body: PurchasePayload; pending?: boolean; quote?: PurchaseQuote; }
export interface SupplierSource { _id: string; label: string; date: string; items: PurchaseLine[]; }
