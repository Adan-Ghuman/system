import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import {
  createPaymentVoucher,
  updatePaymentVoucher,
  deletePaymentVoucher,
  listPaymentVouchers,
  getPartyLedgerStatement,
  updateLedgerEntry,
  deleteLedgerEntry,
  getAccountingMetrics
} from './accounts.service.js';

export async function handleCreateVoucher(req: Request, res: Response): Promise<void> {
  const voucher = await createPaymentVoucher(req.body);
  sendCreated(res, voucher, 'Payment voucher recorded and party ledger updated');
}

export async function handleUpdateVoucher(req: Request, res: Response): Promise<void> {
  const updated = await updatePaymentVoucher(req.params.id as string, req.body);
  sendSuccess(res, updated, 'Payment voucher updated successfully');
}

export async function handleDeleteVoucher(req: Request, res: Response): Promise<void> {
  await deletePaymentVoucher(req.params.id as string);
  sendSuccess(res, null, 'Payment voucher deleted successfully');
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

export async function handleUpdateLedgerEntry(req: Request, res: Response): Promise<void> {
  const updated = await updateLedgerEntry(req.params.id as string, req.body);
  sendSuccess(res, updated, 'Ledger entry updated successfully');
}

export async function handleDeleteLedgerEntry(req: Request, res: Response): Promise<void> {
  await deleteLedgerEntry(req.params.id as string);
  sendSuccess(res, null, 'Ledger entry deleted successfully');
}

export async function handleGetMetrics(_req: Request, res: Response): Promise<void> {
  const metrics = await getAccountingMetrics();
  sendSuccess(res, metrics);
}
