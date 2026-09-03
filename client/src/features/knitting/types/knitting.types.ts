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
