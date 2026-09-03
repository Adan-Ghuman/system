import bcrypt from 'bcrypt';
import { User, IUser } from '../../models/User.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { LoginInput } from './auth.schema.js';

export interface AuthResult {
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    permissions: string[];
  };
  accessToken: string;
  refreshToken: string;
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await User.findOne({ email: input.email });
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const tokenPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    permissions: user.permissions
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ userId: user._id.toString() });

  return {
    user: {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    },
    accessToken,
    refreshToken
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; user: AuthResult['user'] }> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };

    const accessToken = signAccessToken(tokenPayload);

    return {
      accessToken,
      user: {
        id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    };
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
}
