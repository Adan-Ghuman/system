import mongoose from 'mongoose';
import dns from 'dns';
import { env } from './env.js';
import { seedInitialAdmin } from './seed.js';
import { seedRazaData } from './seedRaza.js';

if (process.platform === 'win32') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch {
    // ignore if network interface restricts custom dns
  }
}

let memoryReplSet: { stop: () => Promise<boolean> } | null = null;

export async function connectDatabase(): Promise<string> {
  if (mongoose.connection.readyState >= 1) {
    return env.MONGODB_URI;
  }

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000
    });
    await seedInitialAdmin();
    await seedRazaData();
    return env.MONGODB_URI;
  } catch (error) {
    if (env.NODE_ENV === 'production' || env.MONGODB_URI.includes('mongodb+srv://')) {
      process.stderr.write(`Failed to connect to MongoDB Atlas: ${String(error)}\n`);
      throw error;
    }
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    const replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1 }
    });
    memoryReplSet = replSet;
    const uri = replSet.getUri();
    await mongoose.connect(uri);
    await seedInitialAdmin();
    await seedRazaData();
    return uri;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryReplSet) {
    await memoryReplSet.stop();
  }
}
