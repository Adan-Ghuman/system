import { IUser } from '../models/User.js';

export function canAccessBusiness(user: IUser, business: { _id: unknown; code: string }) {
  return user.role === 'admin' || user.businessIds?.some(value => String(value) === String(business._id)) || (business.code === 'ROZAIN' && user.$isDefault('businessIds'));
}
