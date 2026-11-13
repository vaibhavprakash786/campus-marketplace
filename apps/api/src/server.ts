import { Offer } from './modules/conversations/model.js';
import { attachRealtime } from './modules/conversations/realtime.js';
import { Conversation, Message } from './modules/conversations/model.js';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { loadConfig } from './config/env.js';

async function main(): Promise<void> {
  const config = loadConfig();
  await connectDatabase(config.mongoUri);
  await Promise.all([Conversation.createIndexes(), Message.createIndexes(), Offer.createIndexes()]);
  const app = createApp(config.frontendOrigin);
  const server = app.listen(config.port, () => {
    console.info(`API listening on port ${config.port}`);
  });

  const io = attachRealtime(server, config.frontendOrigin);
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`Received ${signal}; shutting down`);
    void io.close();
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
