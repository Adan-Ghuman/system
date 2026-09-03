import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/ghuman_textile_erp'),
  JWT_ACCESS_SECRET: z.string().default('ghuman_erp_access_secret_key_2026_super_secure'),
  JWT_REFRESH_SECRET: z.string().default('ghuman_erp_refresh_secret_key_2026_super_secure'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  process.stderr.write(`Environment validation failed: ${JSON.stringify(parsed.error.format())}\n`);
  process.exit(1);
}

export const env = parsed.data;
