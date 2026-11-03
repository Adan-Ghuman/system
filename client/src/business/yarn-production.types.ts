export type YarnProcess = 'SPINNING' | 'REWINDING';
export const processNames: Record<YarnProcess, string> = { SPINNING: 'Spinning', REWINDING: 'Rewinding' };
export const productionUrl = '/yarn-production';

export interface YarnMachine {
  _id: string;
  code: string;
  name: string;
  process: YarnProcess;
  location: string;
  active: boolean;
}

export interface YarnMeasurement {
  yarnSpec: string;
  packageUnit: string;
  quantity: number;
  weightKg: number;
}

export interface YarnRun {
  _id: string;
  machineId: string;
  machineCode: string;
  machineName: string;
  location: string;
  process: YarnProcess;
  productionDate: string;
  shift: 'DAY' | 'NIGHT';
  reference: string;
  output: YarnMeasurement;
  input?: YarnMeasurement;
  wasteKg: number;
  status: 'POSTED' | 'REVERSED';
  stockStatus: 'AWAITING' | 'POSTED' | 'LINKED';
  replacesId?: string;
  replacedById?: string;
  correctionReason?: string;
  stockEvents: Array<{ _id: string; action: 'POSTED' | 'LINKED' | 'UNDONE'; date: string; reason?: string; receiptNumber?: string }>;
}

export const stockStatusNames: Record<YarnRun['stockStatus'], string> = {
  AWAITING: 'Awaiting stock receipt', POSTED: 'Stock received', LINKED: 'Receipt linked'
};

export const productionToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

export const productionError = (error: unknown) =>
  (error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Could not save. Please try again.';
