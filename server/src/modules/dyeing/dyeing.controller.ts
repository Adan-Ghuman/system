import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import {
  createDyeingBatch,
  settleDyeingBatch,
  listDyeingBatches,
  getDyeingMetrics,
  generateNextBatchNo
} from './dyeing.service.js';

export async function handleCreateBatch(req: Request, res: Response): Promise<void> {
  const batch = await createDyeingBatch(req.body);
  sendCreated(res, batch, 'Dyeing batch issued successfully');
}

export async function handleSettleBatch(req: Request, res: Response): Promise<void> {
  const batch = await settleDyeingBatch(req.params.id as string, req.body);
  sendSuccess(res, batch, 'Dyeing batch settled and finished inventory credited');
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
