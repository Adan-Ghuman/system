import { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { sendSuccess } from '../../utils/response.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { loginUser, refreshAccessToken } from './auth.service.js';

const COOKIE_NAME = 'refreshToken';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000
};

export async function handleLogin(req: Request, res: Response): Promise<void> {
  const result = await loginUser(req.body);
  res.cookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);
  sendSuccess(res, {
    user: result.user,
    accessToken: result.accessToken
  }, 'Login successful');
}

export async function handleRefresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    throw new UnauthorizedError('Refresh token not provided');
  }

  const result = await refreshAccessToken(token);
  sendSuccess(res, result, 'Session refreshed');
}

export async function handleLogout(_req: Request, res: Response): Promise<void> {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  sendSuccess(res, null, 'Logged out successfully');
}

export async function handleGetMe(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  sendSuccess(res, {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    permissions: user.permissions
  });
}
