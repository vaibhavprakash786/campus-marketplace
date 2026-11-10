import 'dotenv/config';

export type AppConfig = {
  port: number;
  mongoUri: string;
  nodeEnv: string;
  frontendOrigin: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rawPort = env.PORT ?? '4000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const mongoUri = env.MONGODB_URI;
  if (!mongoUri || !/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    throw new Error('MONGODB_URI must be set to a MongoDB connection URI');
  }
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }
  const frontendOrigin = env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
  if (!/^https?:\/\//.test(frontendOrigin)) {
    throw new Error('FRONTEND_ORIGIN must be an HTTP(S) origin');
  }
  return { port, mongoUri, nodeEnv, frontendOrigin };
}
