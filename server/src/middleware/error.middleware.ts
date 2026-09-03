import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  }

  const anyErr = err as { name?: string; code?: number; message?: string; errors?: Record<string, { message: string }> };

  if (anyErr?.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'Duplicate field value entered'
    });
  }

  if (anyErr?.name === 'ValidationError' && anyErr.errors) {
    const message = Object.values(anyErr.errors)
      .map((e) => e.message)
      .join(', ');
    return res.status(400).json({
      success: false,
      error: message
    });
  }

  if (anyErr?.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid resource ID'
    });
  }

  const message = env.NODE_ENV === 'production' ? 'Internal server error' : anyErr?.message || 'Unknown error';
  return res.status(500).json({
    success: false,
    error: message
  });
}
