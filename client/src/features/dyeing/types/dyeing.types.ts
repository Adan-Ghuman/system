export type DyeingMillType = 'GHUMMAN_DYEING' | 'RAJPUT_DYEING' | 'OTHER';
export type DyeingBatchStatus = 'ISSUED' | 'IN_PROCESS' | 'COMPLETED';

export interface DyeingBatchItem {
  _id: string;
  batchNo: string;
  millName: DyeingMillType;
  millPartyId?: {
    _id: string;
    code: string;
    name: string;
    phone?: string;
  };
  fabricType: string;
  yarnSpec: string;
  targetColor: string;
  igpNo?: string;
  ogpNo?: string;
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
  millPartyId?: string;
  fabricType: string;
  yarnSpec: string;
  targetColor: string;
  ogpNo?: string;
  igpNo?: string;
  dateIssued?: string;
  ecruRollsCount: number;
  ecruWeightKg: number;
  allocatedCustomerId?: string;
  remarks?: string;
}

export interface SettleBatchPayload {
  finishRollsCount: number;
  finishWeightKg: number;
  dateReceived?: string;
  igpNo?: string;
  remarks?: string;
}
