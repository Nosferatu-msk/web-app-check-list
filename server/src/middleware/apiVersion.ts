import { Request, Response, NextFunction } from 'express';

const API_VERSION = '1';
const MIN_API_VERSION = '1';

export function apiVersionMiddleware(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-API-Version', API_VERSION);
  res.setHeader('X-Min-Api-Version', MIN_API_VERSION);
  next();
}

export function getApiVersion() {
  return { current: API_VERSION, min: MIN_API_VERSION };
}
