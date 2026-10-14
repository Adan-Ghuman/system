import { Router } from 'express';
import { env } from '../../config/env.js';
import { z } from 'zod';
import { User } from '../../models/User.js';
import { Business } from '../../business/Business.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
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
    if (env.ENABLE_DEMO_SEED !== 'true') throw new BadRequestError('Demo data loading is disabled. Enable it explicitly for a disposable testing database.');
    const result = await seedRazaData();
    res.json({ success: true, message: 'Raza operational data successfully seeded into ERP', data: result });
  })
);
router.get('/:id', asyncHandler(handleGetUser));
router.patch('/:id/access', asyncHandler(async (req, res) => {
  const input = z.object({ businessIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)), permissions: z.array(z.string()).optional(), isActive: z.boolean().optional() }).parse(req.body);
  if (String(req.user!._id) === req.params.id && input.isActive === false) throw new BadRequestError('You cannot disable your own account.');
  if (await Business.countDocuments({ _id: { $in: input.businessIds }, isActive: true }) !== new Set(input.businessIds).size) throw new BadRequestError('Choose active businesses only.');
  const user = await User.findByIdAndUpdate(req.params.id, { $set: input }, { new: true }).select('-passwordHash');if (!user) throw new NotFoundError('User not found.');res.json({ success: true, data: user });
}));

export default router;
