export type InventoryLocation = 'ZR_GODOWN' | 'GHUMMAN_DYEING' | 'RAJPUT_DYEING';
export type FabricState = 'RAW_ECRU' | 'FINISHED_DYED';
export type StockAdjustmentReason =
  | 'AUDIT_DISCREPANCY'
  | 'DAMAGE'
  | 'SAMPLE_CUTTING'
  | 'SCRAP'
  | 'MANUAL_CORRECTION';

export interface FabricInventoryItem {
  _id: string;
  fabricType: string;
  yarnSpec: string;
  state: FabricState;
  color: string;
  location: InventoryLocation;
  totalRolls: number;
  totalWeightKg: number;
  updatedAt: string;
}

export interface StockTransferItem {
  _id: string;
  transferNo: string;
  fromLocation: InventoryLocation;
  toLocation: InventoryLocation;
  fabricType: string;
  yarnSpec: string;
  state: FabricState;
  color: string;
  rollsCount: number;
  weightKg: number;
  gatePassNo?: string;
  driverName?: string;
  vehicleNo?: string;
  date: string;
  remarks?: string;
  createdAt: string;
}

export interface StockAdjustmentItem {
  _id: string;
  fabricType: string;
  yarnSpec: string;
  state: FabricState;
  color: string;
  location: InventoryLocation;
  adjustmentRolls: number;
  adjustmentWeightKg: number;
  reason: StockAdjustmentReason;
  date: string;
  remarks?: string;
  createdAt: string;
}

export interface CreateTransferPayload {
  fromLocation: InventoryLocation;
  toLocation: InventoryLocation;
  fabricType: string;
  yarnSpec: string;
  state: FabricState;
  color: string;
  rollsCount: number;
  weightKg: number;
  gatePassNo?: string;
  driverName?: string;
  vehicleNo?: string;
  date?: string;
  remarks?: string;
}

export interface CreateAdjustmentPayload {
  fabricType: string;
  yarnSpec: string;
  state: FabricState;
  color: string;
  location: InventoryLocation;
  adjustmentRolls: number;
  adjustmentWeightKg: number;
  reason: StockAdjustmentReason;
  date?: string;
  remarks?: string;
}
