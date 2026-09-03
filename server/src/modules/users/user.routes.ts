import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createUserSchema, queryUsersSchema } from './user.schema.js';
import { handleCreateUser, handleListUsers, handleGetUser } from './user.controller.js';

import { seedRazaData } from '../../config/seedRaza.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

router.get('/', validateQuery(queryUsersSchema), asyncHandler(handleListUsers));
router.post('/', validateBody(createUserSchema), asyncHandler(handleCreateUser));
router.post(
  '/seed-raza',
  asyncHandler(async (_req, res) => {
    const result = await seedRazaData();
    res.json({ success: true, message: 'Raza operational data successfully seeded into ERP', data: result });
  })
);
router.get('/:id', asyncHandler(handleGetUser));

export default router;
