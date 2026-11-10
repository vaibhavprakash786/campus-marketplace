import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';

export function createApp(frontendOrigin: string) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: frontendOrigin, credentials: true }));
  app.use(cookieParser());
  app.use((req,res,next) => {
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin !== frontendOrigin) { res.status(403).json({ error: 'Invalid request origin' }); return; }
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/health', healthRouter);
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }), authRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
