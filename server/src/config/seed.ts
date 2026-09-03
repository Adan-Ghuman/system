import bcrypt from 'bcrypt';
import { User } from '../models/User.js';

const DEFAULT_ADMIN_EMAIL = 'admin@gmail.com';
const DEFAULT_ADMIN_PASSWORD = '12345678';
const DEFAULT_ADMIN_NAME = 'System Administrator';

const ALL_PERMISSIONS = [
  'parties:read',
  'parties:write',
  'knitting:read',
  'knitting:write',
  'dyeing:read',
  'dyeing:write',
  'inventory:read',
  'inventory:write',
  'dispatch:read',
  'dispatch:write',
  'accounts:read',
  'accounts:write',
  'export:generate'
];

import { Party } from '../models/Party.js';

export async function seedInitialAdmin(): Promise<void> {
  const existingAdmin = await User.findOne({ email: DEFAULT_ADMIN_EMAIL });
  if (!existingAdmin) {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, saltRounds);

    await User.create({
      fullName: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
      permissions: ALL_PERMISSIONS,
      isActive: true
    });
  }

  const existingGhumman = await Party.findOne({ code: 'PRT-001' });
  if (!existingGhumman) {
    await Party.create({
      code: 'PRT-001',
      name: 'Ghumman Dyeing Mill',
      contactPerson: 'Haji Ghumman',
      phone: '0300-1234567',
      address: 'Daska Road, Sialkot',
      tags: {
        isYarnClient: false,
        isKnitter: false,
        isFabricBuyer: false,
        isDyeingMill: true
      },
      openingBalance: 0,
      currentBalance: 0,
      isActive: true
    });
  }

  const existingRajput = await Party.findOne({ code: 'PRT-002' });
  if (!existingRajput) {
    await Party.create({
      code: 'PRT-002',
      name: 'Rajput Dyeing Mill',
      contactPerson: 'Chaudhry Rajput',
      phone: '0301-7654321',
      address: 'Kashmir Road, Sialkot',
      tags: {
        isYarnClient: false,
        isKnitter: false,
        isFabricBuyer: false,
        isDyeingMill: true
      },
      openingBalance: 0,
      currentBalance: 0,
      isActive: true
    });
  }
}
