import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import {
  createParty,
  updateParty,
  getPartyById,
  listParties,
  generateNextPartyCode,
  getPartySummary
} from './party.service.js';

export async function handleCreateParty(req: Request, res: Response): Promise<void> {
  const party = await createParty(req.body);
  sendCreated(res, party, 'Party registered successfully');
}

export async function handleUpdateParty(req: Request, res: Response): Promise<void> {
  const party = await updateParty(req.params.id as string, req.body);
  sendSuccess(res, party, 'Party updated successfully');
}

export async function handleGetParty(req: Request, res: Response): Promise<void> {
  const party = await getPartyById(req.params.id as string);
  sendSuccess(res, party);
}

export async function handleListParties(req: Request, res: Response): Promise<void> {
  const result = await listParties(req.query as unknown as Parameters<typeof listParties>[0]);
  sendSuccess(res, result);
}

export async function handleGetNextCode(_req: Request, res: Response): Promise<void> {
  const nextCode = await generateNextPartyCode();
  sendSuccess(res, { nextCode });
}

export async function handlePartySummary(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await getPartySummary(req.query as unknown as Parameters<typeof getPartySummary>[0]));
}
