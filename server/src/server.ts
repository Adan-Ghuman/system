import { createApp } from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';

async function bootstrap(): Promise<void> {
  try {
    const mongoUri = await connectDatabase();
    process.stdout.write(`Database connected: ${mongoUri}\n`);

    const app = createApp();
    app.listen(env.PORT, () => {
      process.stdout.write(`Server running on http://localhost:${env.PORT}\n`);
    });
  } catch (error) {
    process.stderr.write(`Failed to start server: ${String(error)}\n`);
    process.exit(1);
  }
}

bootstrap();
