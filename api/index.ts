import type { Request, Response } from 'express';
import { createApp } from '../server/dist/app.js';
import { connectDatabase } from '../server/dist/config/db.js';

let appInstance: any = null;

export default async function handler(req: Request, res: Response) {
  try {
    await connectDatabase();
    if (!appInstance) {
      appInstance = createApp();
    }
    return appInstance(req, res);
  } catch (error) {
    console.error('API serverless execution error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Database or server initialization error',
        message: String(error)
      });
    }
  }
}
