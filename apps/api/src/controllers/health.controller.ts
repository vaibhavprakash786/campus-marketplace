import type { Request, Response } from 'express';

export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'success',
    message: 'College Marketplace API is running',
  });
}
