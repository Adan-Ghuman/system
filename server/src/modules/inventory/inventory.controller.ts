import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import {
  executeStockTransfer,
  recordStockAdjustment,
  listInventoryItems,
  getInventorySummary,
  listStockTransfers,
  generateNextTransferNo
} from './inventory.service.js';

export async function handleCreateTransfer(req: Request, res: Response): Promise<void> {
  const transfer = await executeStockTransfer(req.body);
  sendCreated(res, transfer, 'Stock transferred successfully between locations');
}

export async function handleCreateAdjustment(req: Request, res: Response): Promise<void> {
  const adjustment = await recordStockAdjustment(req.body);
  sendCreated(res, adjustment, 'Stock adjustment recorded successfully');
}

export async function handleListInventory(req: Request, res: Response): Promise<void> {
  const result = await listInventoryItems(req.query as unknown as Parameters<typeof listInventoryItems>[0]);
  sendSuccess(res, result);
}

export async function handleGetSummary(_req: Request, res: Response): Promise<void> {
  const summary = await getInventorySummary();
  sendSuccess(res, summary);
}

export async function handleListTransfers(req: Request, res: Response): Promise<void> {
  const result = await listStockTransfers(req.query as unknown as Parameters<typeof listStockTransfers>[0]);
  sendSuccess(res, result);
}

export async function handleGetNextTransferNo(_req: Request, res: Response): Promise<void> {
  const nextTransferNo = await generateNextTransferNo();
  sendSuccess(res, { nextTransferNo });
}
