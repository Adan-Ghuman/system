export type YarnTransactionType = 'OUTWARD_TO_KNITTER' | 'INWARD_FROM_CLIENT';

export interface YarnTransactionItem {
  _id: string;
  transactionType: YarnTransactionType;
  partyId: {
    _id: string;
    code: string;
    name: string;
    phone?: string;
  };
  yarnSpec: string;
  gatePassNo: string;
  date: string;
  boxCount: number;
  netWeightPerBox: number;
  grossWeightKg: number;
  wastagePercent: number;
  wastageWeightKg: number;
  netExpectedFabricKg: number;
  receivedFabricKg: number;
  remainingYarnBalanceKg: number;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnitterBalanceSummary {
  partyId: string;
  partyCode: string;
  partyName: string;
  phone: string;
  yarnSpec: string;
  lastDate?: string;
  totalGrossKg: number;
  totalExpectedKg: number;
  totalReceivedKg: number;
  remainingYarnKg: number;
}

export interface CreateYarnTransactionPayload {
  transactionType: YarnTransactionType;
  partyId: string;
  yarnSpec: string;
  gatePassNo: string;
  date?: string;
  boxCount: number;
  netWeightPerBox: number;
  wastagePercent?: number;
  remarks?: string;
}

export interface ReceiveFabricPayload {
  partyId: string;
  yarnSpec: string;
  rollsCount: number;
  weightKg: number;
  date?: string;
  gatePassNo?: string;
  remarks?: string;
}

export interface UpdateYarnTransactionPayload {
  partyId?: string;
  yarnSpec?: string;
  gatePassNo?: string;
  date?: string;
  boxCount?: number;
  netWeightPerBox?: number;
  wastagePercent?: number;
  remarks?: string;
}

export type YarnCategory = 'Polyester' | 'Cotton' | 'Spandex' | 'Blended' | 'Viscose' | 'Other';

export interface YarnSpecificationItem {
  _id: string;
  name: string;
  category: YarnCategory;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  transactionCount: number;
  totalGrossKg: number;
  remainingYarnKg: number;
  partiesCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InUseUncatalogedSpec {
  yarnSpec: string;
  transactionCount: number;
  totalGrossKg: number;
  remainingYarnKg: number;
  partiesCount: number;
}

export interface YarnSpecsResponseData {
  catalog: YarnSpecificationItem[];
  uncataloged: InUseUncatalogedSpec[];
}

export interface CreateYarnSpecPayload {
  name: string;
  category?: YarnCategory;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateYarnSpecPayload {
  name?: string;
  category?: YarnCategory;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
  propagateToTransactions?: boolean;
}

export interface BulkRenameYarnSpecPayload {
  oldSpec: string;
  newSpec: string;
  addToCatalogIfMissing?: boolean;
  category?: YarnCategory;
}

