import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import prisma from '../models/prisma.js';

export function auditMiddleware(entityType: string, action: string, getEntityId?: (req: AuthRequest) => string | undefined) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId = getEntityId ? getEntityId(req) : (req.params?.id as string | undefined);
        prisma.auditLog.create({
          data: {
            userId: req.userId || null,
            action,
            entityType,
            entityId: entityId || null,
            oldValue: action === 'update' ? req.body?.previousValue : null,
            newValue: ['create', 'update'].includes(action) ? req.body : null,
            ipAddress: req.ip || null,
            userAgent: req.headers['user-agent'] || null,
          },
        }).catch(console.error);
      }
      return originalJson(body);
    };
    next();
  };
}

export async function logAudit(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await prisma.auditLog.create({ data: params as any });
}
