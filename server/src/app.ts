import { intercompanyRoutes } from './business/intercompany.routes.js';
import { sourceRoutes } from './business/source.routes.js';
import { productionRoutes } from './business/production.routes.js';
import { workspaceRoutes } from './business/commerce.routes.js';
import { catalogRoutes } from './business/catalog.routes.js';
import { businessRoutes, businessScope, defaultBusinessScope } from './business/routes.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.middleware.js';
import { preventDuplicateSubmissions } from './middleware/idempotency.middleware.js';
import { NotFoundError } from './utils/errors.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import partyRoutes from './modules/parties/party.routes.js';
import knittingRoutes from './modules/knitting/knitting.routes.js';
import dyeingRoutes from './modules/dyeing/dyeing.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import dispatchRoutes from './modules/dispatch/dispatch.routes.js';
import accountsRoutes from './modules/accounts/accounts.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';

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
  app.use(preventDuplicateSubmissions);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'ghuman-erp-api',
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/businesses', businessRoutes);
  const operations = express.Router();
  operations.use('/parties', partyRoutes);
  operations.use('/knitting', knittingRoutes);
  operations.use('/dyeing', dyeingRoutes);
  operations.use('/inventory', inventoryRoutes);
  operations.use('/dispatch', dispatchRoutes);
  operations.use('/accounts', accountsRoutes);
  operations.use('/reports', reportsRoutes);
  businessScope.use('/catalog', catalogRoutes);
  businessScope.use('/workspace', workspaceRoutes);
  businessScope.use('/production', productionRoutes);
  businessScope.use('/intercompany', intercompanyRoutes);
  businessScope.use('/sources', sourceRoutes);
  businessScope.use(operations);
  app.use('/api/businesses/:businessId', businessScope);
  const workspace = express.Router();
  workspace.use('/catalog', catalogRoutes);
  workspace.use('/workspace', workspaceRoutes);
  workspace.use('/production', productionRoutes);
  workspace.use('/sources', sourceRoutes);
  workspace.use(operations);
  app.use('/api', defaultBusinessScope, workspace);

  app.use((_req, _res, next) => {
    next(new NotFoundError('Route not found'));
  });

  app.use(errorHandler);

  return app;
}
