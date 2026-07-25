import { Router, Response } from 'express';
import prisma from '../models/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// ─── LIST NOTIFICATIONS ──────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const unreadOnly = req.query.unread_only === 'true';
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;

  const where: any = { userId: req.userId };
  if (unreadOnly) where.isRead = false;

  const [data, totalCount, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.userId, isRead: false } }),
  ]);

  res.json({ data, totalCount, unreadCount });
});

// ─── MARK AS READ ────────────────────────────────────────────
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id as string },
  });

  if (!notification) {
    res.status(404).json({ error: 'Уведомление не найдено' });
    return;
  }
  if (notification.userId !== req.userId) {
    res.status(403).json({ error: 'Нет доступа к этому уведомлению' });
    return;
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });

  res.json(updated);
});

// ─── MARK ALL AS READ ────────────────────────────────────────
router.patch('/read-all', async (req: AuthRequest, res: Response) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.userId, isRead: false },
    data: { isRead: true },
  });

  res.json({ updated: result.count });
});

export default router;
