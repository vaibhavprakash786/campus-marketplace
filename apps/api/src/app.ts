import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.routes.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';

export function createApp(frontendOrigin: string) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: frontendOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/health', healthRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
