import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { loadConfig } from './config/env.js';

async function main(): Promise<void> {
  const config = loadConfig();
  await connectDatabase(config.mongoUri);
  const app = createApp(config.frontendOrigin);
  const server = app.listen(config.port, () => {
    console.info(`API listening on port ${config.port}`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`Received ${signal}; shutting down`);
    server.close(() => {
      void disconnectDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error('API startup failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
