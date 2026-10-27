export type InventoryLocation = string;
export type FabricState = 'RAW_ECRU' | 'FINISHED_DYED';
export type StockAdjustmentReason =
  | 'AUDIT_DISCREPANCY'
  | 'DAMAGE'
  | 'SAMPLE_CUTTING'
  | 'SCRAP'
  | 'MANUAL_CORRECTION';

export interface FabricInventoryItem { ownerKey?: string;
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

export interface CreateTransferPayload { ownerKey?: string;
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

export interface CreateAdjustmentPayload { ownerKey?: string;
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

export interface InventorySummaryGroup {
  _id: {
    location: InventoryLocation;
    state: FabricState;
  };
  totalRolls: number;
  totalWeightKg: number;
  uniqueVarieties: number;
}

export interface UpdateFabricInventoryPayload {
  requestId?: string;
  correctionReason?: string;
  fabricType?: string;
  yarnSpec?: string;
  state?: FabricState;
  color?: string;
  location?: InventoryLocation;
  totalRolls?: number;
  totalWeightKg?: number;
}

