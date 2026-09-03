import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import { createNewUser, listAllUsers, findUserById } from './user.service.js';

export async function handleCreateUser(req: Request, res: Response): Promise<void> {
  const user = await createNewUser(req.body);
  sendCreated(res, user, 'User created successfully');
}

export async function handleListUsers(req: Request, res: Response): Promise<void> {
  const users = await listAllUsers(req.query as unknown as Parameters<typeof listAllUsers>[0]);
  sendSuccess(res, users);
}

export async function handleGetUser(req: Request, res: Response): Promise<void> {
  const user = await findUserById(req.params.id as string);
  sendSuccess(res, user);
}
