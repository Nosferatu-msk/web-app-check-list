import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch {
    res.status(401).json({ error: 'Недействительный токен' });
  }
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }
  next();
}

export function tmOrAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin' && req.userRole !== 'tm') {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }
  next();
}

export function generateAccessToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' } as jwt.SignOptions);
}

export function generateRefreshToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' } as jwt.SignOptions);
}
