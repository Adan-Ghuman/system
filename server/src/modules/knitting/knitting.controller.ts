import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import {
  recordYarnTransaction,
  recordKnittedFabricReceipt,
  getKnitterBalances,
  listYarnTransactions
} from './knitting.service.js';

export async function handleCreateTransaction(req: Request, res: Response): Promise<void> {
  const transaction = await recordYarnTransaction(req.body);
  sendCreated(res, transaction, 'Yarn transaction logged successfully');
}

export async function handleReceiveFabric(req: Request, res: Response): Promise<void> {
  const result = await recordKnittedFabricReceipt(req.body);
  sendSuccess(res, result, 'Knitted fabric receipt logged and balance updated');
}

export async function handleGetBalances(_req: Request, res: Response): Promise<void> {
  const balances = await getKnitterBalances();
  sendSuccess(res, balances);
}

export async function handleListTransactions(req: Request, res: Response): Promise<void> {
  const result = await listYarnTransactions(req.query as unknown as Parameters<typeof listYarnTransactions>[0]);
  sendSuccess(res, result);
}
