import type { ErrorRequestHandler, RequestHandler } from 'express';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Route not found' });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  console.error('Unhandled request error', error);
  res.status(500).json({ status: 'error', code: 'INTERNAL_ERROR', message: 'Internal server error' });
};
