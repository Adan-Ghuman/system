import bcrypt from 'bcrypt';
import { User, IUser } from '../../models/User.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { parsePagination, formatPaginatedResult, PaginatedResult } from '../../utils/pagination.js';
import { CreateUserInput, QueryUsersInput } from './user.schema.js';

export interface SanitizedUser {
  _id: unknown;
  fullName: string;
  email: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function createNewUser(input: CreateUserInput): Promise<SanitizedUser> {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw new ConflictError('A user with this email already exists');
  }

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(input.password, saltRounds);

  const newUser = await User.create({
    fullName: input.fullName,
    email: input.email,
    passwordHash,
    role: input.role,
    permissions: input.permissions,
    isActive: true
  });

  const obj = newUser.toObject();
  const { passwordHash: _, ...sanitized } = obj;
  return sanitized as SanitizedUser;
}

export async function listAllUsers(query: QueryUsersInput = {}): Promise<PaginatedResult<SanitizedUser>> {
  const { page, limit, skip } = parsePagination(query, 20);
  const filter: Record<string, unknown> = {};

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { fullName: searchRegex },
      { email: searchRegex },
      { role: searchRegex }
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter, '-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter)
  ]);

  return formatPaginatedResult(items as unknown as SanitizedUser[], total, page, limit);
}

export async function findUserById(id: string): Promise<SanitizedUser> {
  const user = await User.findById(id, '-passwordHash');
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user as unknown as SanitizedUser;
}
