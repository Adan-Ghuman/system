import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.middleware.js';
import { NotFoundError } from './utils/errors.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import partyRoutes from './modules/parties/party.routes.js';
import knittingRoutes from './modules/knitting/knitting.routes.js';
import dyeingRoutes from './modules/dyeing/dyeing.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import dispatchRoutes from './modules/dispatch/dispatch.routes.js';
import accountsRoutes from './modules/accounts/accounts.routes.js';

export function createApp(): express.Application {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          origin.includes('localhost') ||
          origin.includes('127.0.0.1') ||
          origin.includes('.vercel.app') ||
          origin === env.CLIENT_ORIGIN
        ) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true
    })
  );

  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'ghuman-erp-api',
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/parties', partyRoutes);
  app.use('/api/knitting', knittingRoutes);
  app.use('/api/dyeing', dyeingRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/dispatch', dispatchRoutes);
  app.use('/api/accounts', accountsRoutes);

  app.use((_req, _res, next) => {
    next(new NotFoundError('Route not found'));
  });

  app.use(errorHandler);

  return app;
}
