import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import { ForbiddenError } from '../../utils/errors.js';
import {
  executeDispatch,
  listDispatches,
  getDispatchDetails
} from './dispatch.service.js';

export async function handleCreateDispatch(req: Request, res: Response): Promise<void> {
  if (req.body.billNow !== false && req.user?.role !== 'admin' && !req.user?.permissions.includes('accounts:write')) throw new ForbiddenError('Billing a delivery requires accounts permission. You can record a delivery only.');
  const result = await executeDispatch(req.body);
  sendCreated(res, result, 'Dispatch executed, invoice generated, and ledger updated');
}

export async function handleListDispatches(req: Request, res: Response): Promise<void> {
  const result = await listDispatches(req.query as unknown as Parameters<typeof listDispatches>[0]);
  sendSuccess(res, result);
}

export async function handleGetDispatch(req: Request, res: Response): Promise<void> {
  const result = await getDispatchDetails(req.params.id as string);
  sendSuccess(res, result);
}
