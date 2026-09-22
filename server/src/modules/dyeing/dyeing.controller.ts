import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import {
  createDyeingBatch,
  createGatePassBatches,
  settleDyeingBatch,
  settleGatePassBatches,
  listDyeingBatches,
  getDyeingMetrics,
  generateNextBatchNo,
  updateDyeingBatch,
  deleteDyeingBatch,
  getDyeingUnitsWithMetrics,
  createDyeingUnit,
  updateDyeingUnit,
  deleteDyeingUnit
} from './dyeing.service.js';

export async function handleCreateBatch(req: Request, res: Response): Promise<void> {
  const batch = await createDyeingBatch(req.body);
  sendCreated(res, batch, 'Dyeing batch issued successfully');
}

export async function handleCreateGatePass(req: Request, res: Response): Promise<void> {
  const batches = await createGatePassBatches(req.body);
  sendCreated(res, batches, `Gate pass ${req.body.ogpNo} with ${batches.length} item(s) created successfully`);
}

export async function handleSettleBatch(req: Request, res: Response): Promise<void> {
  const batch = await settleDyeingBatch(req.params.id as string, req.body);
  sendSuccess(res, batch, 'Dyeing batch settled and finished inventory credited');
}

export async function handleSettleGatePass(req: Request, res: Response): Promise<void> {
  const batches = await settleGatePassBatches(req.body);
  sendSuccess(res, batches, `Inward gate pass ${req.body.igpNo} with ${batches.length} item(s) settled successfully`);
}

export async function handleListBatches(req: Request, res: Response): Promise<void> {
  const result = await listDyeingBatches(req.query as unknown as Parameters<typeof listDyeingBatches>[0]);
  sendSuccess(res, result);
}

export async function handleGetMetrics(_req: Request, res: Response): Promise<void> {
  const metrics = await getDyeingMetrics();
  sendSuccess(res, metrics);
}

export async function handleGetNextBatchNo(_req: Request, res: Response): Promise<void> {
  const nextBatchNo = await generateNextBatchNo();
  sendSuccess(res, { nextBatchNo });
}

export async function handleUpdateBatch(req: Request, res: Response): Promise<void> {
  const batch = await updateDyeingBatch(req.params.id as string, req.body);
  sendSuccess(res, batch, 'Dyeing batch updated successfully');
}

export async function handleDeleteBatch(req: Request, res: Response): Promise<void> {
  await deleteDyeingBatch(req.params.id as string);
  sendSuccess(res, null, 'Dyeing batch deleted successfully');
}

export async function handleGetDyeingUnits(_req: Request, res: Response): Promise<void> {
  const units = await getDyeingUnitsWithMetrics();
  sendSuccess(res, units);
}

export async function handleCreateDyeingUnit(req: Request, res: Response): Promise<void> {
  const unit = await createDyeingUnit(req.body);
  sendCreated(res, unit, 'Dyeing unit added successfully');
}

export async function handleUpdateDyeingUnit(req: Request, res: Response): Promise<void> {
  const unit = await updateDyeingUnit(req.params.id as string, req.body);
  sendSuccess(res, unit, 'Dyeing unit updated successfully');
}

export async function handleDeleteDyeingUnit(req: Request, res: Response): Promise<void> {
  const result = await deleteDyeingUnit(req.params.id as string);
  sendSuccess(res, result, result.message);
}

