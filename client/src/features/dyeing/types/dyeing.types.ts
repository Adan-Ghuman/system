export type DyeingMillType = 'GHUMMAN_DYEING' | 'RAJPUT_DYEING' | 'HAFIZ_SAAD_DYEING' | 'HB_DYEING' | 'OTHER';
export type DyeingBatchStatus = 'ISSUED' | 'IN_PROCESS' | 'COMPLETED';

export interface DyeingBatchItem {
  _id: string;
  batchNo: string;
  millName: DyeingMillType;
  customMillName?: string;
  millPartyId?: {
    _id: string;
    code: string;
    name: string;
    phone?: string;
  };
  fabricType: string;
  yarnSpec: string;
  yarnSpecs?: string[];
  targetColor: string;
  igpNo?: string;
  ogpNo?: string;
  machineNo?: string;
  driverName?: string;
  vehicleNo?: string;
  width?: string;
  gsm?: string;
  dateIssued: string;
  dateReceived?: string;
  ecruRollsCount: number;
  ecruWeightKg: number;
  finishRollsCount?: number;
  finishWeightKg?: number;
  shortageWeightKg?: number;
  shortagePercent?: number;
  allocatedCustomerId?: {
    _id: string;
    code: string;
    name: string;
  };
  status: DyeingBatchStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBatchPayload {
  batchNo?: string;
  millName: DyeingMillType;
  customMillName?: string;
  millPartyId?: string;
  fabricType: string;
  yarnSpec?: string;
  yarnSpecs?: string[];
  targetColor: string;
  ogpNo?: string;
  igpNo?: string;
  machineNo?: string;
  driverName?: string;
  vehicleNo?: string;
  width?: string;
  gsm?: string;
  dateIssued?: string;
  ecruRollsCount: number;
  ecruWeightKg: number;
  allocatedCustomerId?: string;
  remarks?: string;
}

export interface GatePassEntryItem {
  id: string;
  machineNo: string;
  fabricType: string;
  yarnSpec: string;
  targetColor: string;
  width?: string;
  gsm?: string;
  ecruRollsCount: string | number;
  ecruWeightKg: string | number;
  allocatedCustomerId?: string;
  remarks?: string;
}

export interface CreateGatePassPayload {
  ogpNo: string;
  dateIssued?: string;
  millName: DyeingMillType;
  customMillName?: string;
  millPartyId?: string;
  driverName?: string;
  vehicleNo?: string;
  remarks?: string;
  entries: {
    machineNo?: string;
    fabricType: string;
    yarnSpec: string;
    targetColor: string;
    width?: string;
    gsm?: string;
    ecruRollsCount: number;
    ecruWeightKg: number;
    allocatedCustomerId?: string;
    remarks?: string;
  }[];
}

export interface ReceiveGatePassPayload {
  igpNo: string;
  dateReceived?: string;
  driverName?: string;
  vehicleNo?: string;
  remarks?: string;
  items: {
    batchId: string;
    finishRollsCount: number;
    finishWeightKg: number;
    remarks?: string;
  }[];
}

export interface SettleBatchPayload {
  finishRollsCount: number;
  finishWeightKg: number;
  dateReceived?: string;
  igpNo?: string;
  remarks?: string;
}

export interface UpdateBatchPayload {
  batchNo?: string;
  millName?: DyeingMillType;
  customMillName?: string;
  millPartyId?: string;
  fabricType?: string;
  yarnSpec?: string;
  yarnSpecs?: string[];
  targetColor?: string;
  ogpNo?: string;
  igpNo?: string;
  dateIssued?: string;
  ecruRollsCount?: number;
  ecruWeightKg?: number;
  finishRollsCount?: number;
  finishWeightKg?: number;
  allocatedCustomerId?: string | null;
  remarks?: string;
}

export type DyeingUnitType = 'DYEING_MILL' | 'GODOWN' | 'OTHER';

export interface DyeingUnitItem {
  _id: string;
  code: string;
  name: string;
  shortName: string;
  type: DyeingUnitType;
  partyId?: string;
  address?: string;
  contactPhone?: string;
  isActive: boolean;
  sortOrder: number;
  isSystemDefault: boolean;
  activeBatchesCount: number;
  totalBatchesCount: number;
  totalEcruWeightKg: number;
  inventoryWeightKg: number;
  inventoryRollsCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDyeingUnitPayload {
  code: string;
  name: string;
  shortName: string;
  type?: DyeingUnitType;
  partyId?: string;
  address?: string;
  contactPhone?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateDyeingUnitPayload {
  name?: string;
  shortName?: string;
  type?: DyeingUnitType;
  partyId?: string | null;
  address?: string;
  contactPhone?: string;
  isActive?: boolean;
  sortOrder?: number;
}

