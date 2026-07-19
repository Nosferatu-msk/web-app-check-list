import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import prisma from '../models/prisma.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authMiddleware);

// GET /api/profile — get current user profile with specialization
router.get('/', async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId as string },
    select: {
      id: true, fullName: true, email: true, role: true,
      specializationVik: true, specializationIszh: true,
      mustChangePassword: true, isActive: true,
    },
  });
  if (!user) { res.status(404).json({ error: 'Пользователь не найден' }); return; }
  res.json(user);
});

// PATCH /api/profile/specialization — update specialization
router.patch('/specialization', async (req: AuthRequest, res: Response) => {
  const { specializationVik, specializationIszh } = req.body;

  // At least one must be true
  if (!specializationVik && !specializationIszh) {
    res.status(400).json({ error: 'Необходимо выбрать хотя бы одну специализацию' });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.userId as string },
    data: {
      specializationVik: !!specializationVik,
      specializationIszh: !!specializationIszh,
    },
    select: { id: true, fullName: true, specializationVik: true, specializationIszh: true },
  });

  await logAudit({ userId: req.userId, action: 'update', entityType: 'user', entityId: user.id, newValue: { specializationVik: user.specializationVik, specializationIszh: user.specializationIszh }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(user);
});

// GET /api/profile/favorites — get favorite objects
router.get('/favorites', async (req: AuthRequest, res: Response) => {
  const favorites = await prisma.userFavoriteObject.findMany({
    where: { userId: req.userId as string },
    include: { address: true },
    orderBy: { addedAt: 'desc' },
  });
  res.json(favorites);
});

// POST /api/profile/favorites — add to favorites
router.post('/favorites', async (req: AuthRequest, res: Response) => {
  const { objectCode, addressId } = req.body;
  let resolvedCode = objectCode;

  // If addressId is provided instead of objectCode, resolve it
  if (!resolvedCode && addressId) {
    const addr = await prisma.address.findUnique({ where: { id: addressId }, select: { objectCode: true } });
    if (!addr || !addr.objectCode) {
      res.status(400).json({ error: 'У адреса не задан аналитический код (object_code)' });
      return;
    }
    resolvedCode = addr.objectCode;
  }

  if (!resolvedCode) { res.status(400).json({ error: 'Укажите код объекта или ID адреса' }); return; }

  try {
    const fav = await prisma.userFavoriteObject.create({
      data: { userId: req.userId as string, objectCode: resolvedCode },
      include: { address: true },
    });
    res.status(201).json(fav);
  } catch (err: any) {
    if (err.code === 'P2002') {
      const existing = await prisma.userFavoriteObject.findUnique({
        where: { userId_objectCode: { userId: req.userId as string, objectCode: resolvedCode } },
        include: { address: true },
      });
      res.json(existing);
    } else if (err.code === 'P2003') {
      res.status(400).json({ error: `Объект с кодом "${resolvedCode}" не найден в справочнике адресов` });
    } else {
      throw err;
    }
  }
});

// DELETE /api/profile/favorites/:objectCode — remove from favorites
router.delete('/favorites/*', async (req: AuthRequest, res: Response) => {
  const objectCode = req.params[0] as string;
  if (!objectCode) { res.status(400).json({ error: 'Укажите код объекта' }); return; }
  await prisma.userFavoriteObject.delete({
    where: { userId_objectCode: { userId: req.userId as string, objectCode } },
  });
  res.json({ message: 'Удалено из избранного' });
});

// GET /api/profile/stats — quick stats for profile page
router.get('/stats', async (req: AuthRequest, res: Response) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [visitsThisMonth, issuesFound] = await Promise.all([
    prisma.visit.count({
      where: {
        userId: req.userId as string,
        createdAt: { gte: startOfMonth },
        isDeleted: false,
      },
    }),
    prisma.task.count({
      where: {
        visit: { userId: req.userId as string, isDeleted: false },
        conclusion: { in: ['ok_with_notes', 'faulty'] },
      },
    }),
  ]);

  res.json({ visitsThisMonth, issuesFound });
});

// GET /api/profile/objects — TM's assigned objects
router.get('/objects', async (req: AuthRequest, res: Response) => {
  const tmObjects = await prisma.tmObject.findMany({
    where: { tmId: req.userId as string },
    include: {
      address: {
        include: {
          visits: {
            where: { isDeleted: false },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              tasks: {
                where: { conclusion: 'faulty' },
                take: 1,
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const result = tmObjects.map(to => ({
    id: to.addressId,
    objectCode: to.address.objectCode,
    fullAddress: to.address.fullAddress,
    hasFaultyVisit: to.address.visits?.[0]?.tasks?.length > 0,
  }));

  res.json(result);
});

export default router;
