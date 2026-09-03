import { Router } from 'express';
import { validateBody } from '../../middleware/validate.middleware.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { loginSchema } from './auth.schema.js';
import { handleLogin, handleRefresh, handleLogout, handleGetMe } from './auth.controller.js';

const router = Router();

router.post('/login', validateBody(loginSchema), asyncHandler(handleLogin));
router.post('/refresh', asyncHandler(handleRefresh));
router.post('/logout', authenticate, asyncHandler(handleLogout));
router.get('/me', authenticate, asyncHandler(handleGetMe));

export default router;
