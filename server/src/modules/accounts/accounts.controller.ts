import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import {
  createPaymentVoucher,
  listPaymentVouchers,
  getPartyLedgerStatement,
  getAccountingMetrics
} from './accounts.service.js';

export async function handleCreateVoucher(req: Request, res: Response): Promise<void> {
  const voucher = await createPaymentVoucher(req.body);
  sendCreated(res, voucher, 'Payment voucher recorded and party ledger updated');
}

export async function handleListVouchers(req: Request, res: Response): Promise<void> {
  const result = await listPaymentVouchers(req.query as unknown as Parameters<typeof listPaymentVouchers>[0]);
  sendSuccess(res, result);
}

export async function handleGetLedgerStatement(req: Request, res: Response): Promise<void> {
  const statement = await getPartyLedgerStatement(
    req.params.partyId as string,
    req.query as unknown as Parameters<typeof getPartyLedgerStatement>[1]
  );
  sendSuccess(res, statement);
}

export async function handleGetMetrics(_req: Request, res: Response): Promise<void> {
  const metrics = await getAccountingMetrics();
  sendSuccess(res, metrics);
}
