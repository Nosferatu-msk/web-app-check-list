import { Router, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../models/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authMiddleware);

async function getTmEngineerIds(tmId: string): Promise<string[]> {
  const assignments = await prisma.tmEngineer.findMany({ where: { tmId }, select: { engineerId: true } });
  return assignments.map(a => a.engineerId);
}

async function canAccessVisit(visitUserId: string, req: AuthRequest): Promise<boolean> {
  if (req.userRole === 'admin') return true;
  if (visitUserId === req.userId) return true;
  if (req.userRole === 'tm') {
    const engineerIds = await getTmEngineerIds(req.userId!);
    return engineerIds.includes(visitUserId);
  }
  return false;
}

// ─── VISITS ──────────────────────────────────────────────────
const createVisitSchema = z.object({
  addressId: z.string().uuid(),
  engineerName: z.string().min(1),
  dateStart: z.string(),
  timeStart: z.string(),
  season: z.enum(['summer', 'winter']),
  userId: z.string().uuid().optional(),
});

router.post('/', validate(createVisitSchema), async (req: AuthRequest, res: Response) => {
  const { userId: targetUserId, ...rest } = req.body;
  let visitUserId: string;

  if (req.userRole === 'engineer') {
    visitUserId = req.userId!;
  } else if (targetUserId) {
    visitUserId = targetUserId;
  } else {
    visitUserId = req.userId!;
  }

  const visit = await prisma.visit.create({
    data: {
      ...rest,
      userId: visitUserId,
      dateStart: new Date(rest.dateStart),
      status: req.userRole !== 'engineer' && targetUserId ? 'planned' : 'not_started',
      assignedById: req.userRole !== 'engineer' && targetUserId ? req.userId : null,
      assignedAt: req.userRole !== 'engineer' && targetUserId ? new Date() : null,
    },
    include: { address: true, tasks: { include: { equipmentType: true, roomType: true, photos: true } } },
  });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'visit', entityId: visit.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(visit);
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const status = req.query.status as string;
  const dateFrom = req.query.date_from as string;
  const dateTo = req.query.date_to as string;
  const includeDeleted = req.query.include_deleted === 'true';

  const where: any = {};
  if (!includeDeleted) where.isDeleted = false;

  if (req.userRole === 'engineer') {
    where.userId = req.userId;
  } else if (req.userRole === 'tm') {
    const engineerIds = await getTmEngineerIds(req.userId!);
    where.userId = { in: engineerIds };
  } else if (req.userRole === 'admin') {
    if (req.query.user_id) where.userId = req.query.user_id;
  }

  if (status) where.status = status;
  if (dateFrom) where.dateStart = { ...where.dateStart, gte: new Date(dateFrom) };
  if (dateTo) where.dateStart = { ...where.dateStart, lte: new Date(dateTo) };

  const [data, total] = await Promise.all([
    prisma.visit.findMany({
      where, skip: (page - 1) * pageSize, take: pageSize,
      orderBy: { dateStart: 'desc' },
      include: {
        address: true,
        user: { select: { id: true, fullName: true, email: true } },
        assignedBy: { select: { id: true, fullName: true, email: true } },
        _count: { select: { tasks: true } },
      },
    }),
    prisma.visit.count({ where }),
  ]);
  res.json({ data, total, page, pageSize });
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({
    where: { id: req.params.id as string },
    include: {
      address: true,
      user: { select: { id: true, fullName: true, email: true } },
      assignedBy: { select: { id: true, fullName: true, email: true } },
      tasks: {
        orderBy: { sortOrder: 'asc' },
        include: { equipmentType: true, roomType: true, photos: true },
      },
    },
  });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }
  res.json(visit);
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const existing = await prisma.visit.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(existing.userId, req))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const isTmCorrection = (req.userRole === 'tm' || req.userRole === 'admin') && existing.userId !== req.userId;

  const visit = await prisma.visit.update({
    where: { id: req.params.id as string },
    data: {
      addressId: req.body.addressId,
      engineerName: req.body.engineerName,
      dateStart: req.body.dateStart ? new Date(req.body.dateStart) : undefined,
      timeStart: req.body.timeStart,
      season: req.body.season,
      tmCorrected: isTmCorrection ? true : existing.tmCorrected,
      status: isTmCorrection && existing.status === 'completed' ? 'corrected_by_tm' : undefined,
    },
    include: { address: true, tasks: { include: { equipmentType: true, roomType: true, photos: true } } },
  });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'visit', entityId: visit.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(visit);
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const existing = await prisma.visit.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(existing.userId, req))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  await prisma.visit.update({
    where: { id: req.params.id as string },
    data: {
      isDeleted: true,
      deletedById: req.userId,
      deletedAt: new Date(),
    },
  });
  await logAudit({ userId: req.userId, action: 'delete', entityType: 'visit', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ message: 'Визит удалён' });
});

router.post('/:id/complete', async (req: AuthRequest, res: Response) => {
  const existing = await prisma.visit.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(existing.userId, req))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const now = new Date();
  const timeEnd = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const visit = await prisma.visit.update({
    where: { id: req.params.id as string },
    data: { status: 'completed', timeEnd },
    include: { address: true, tasks: { include: { equipmentType: true, roomType: true, photos: true } } },
  });
  await logAudit({ userId: req.userId, action: 'complete', entityType: 'visit', entityId: visit.id, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(visit);
});

// ─── REASSIGN ────────────────────────────────────────────────
const reassignSchema = z.object({
  newUserId: z.string().uuid(),
});

router.post('/:id/reassign', validate(reassignSchema), async (req: AuthRequest, res: Response) => {
  if (req.userRole !== 'admin' && req.userRole !== 'tm') {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }

  const existing = await prisma.visit.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(existing.userId, req))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const { newUserId } = req.body;
  const newEngineer = await prisma.user.findUnique({ where: { id: newUserId } });
  if (!newEngineer || newEngineer.role !== 'engineer') {
    res.status(400).json({ error: 'Инженер не найден' });
    return;
  }

  if (req.userRole === 'tm') {
    const engineerIds = await getTmEngineerIds(req.userId!);
    if (!engineerIds.includes(newUserId)) {
      res.status(403).json({ error: 'Инженер не в вашей группе' });
      return;
    }
  }

  const visit = await prisma.visit.update({
    where: { id: req.params.id as string },
    data: {
      userId: newUserId,
      engineerName: newEngineer.fullName,
      assignedById: req.userId,
      assignedAt: new Date(),
      status: 'planned',
    },
    include: { address: true, user: { select: { id: true, fullName: true, email: true } } },
  });
  await logAudit({ userId: req.userId, action: 'reassign', entityType: 'visit', entityId: visit.id, newValue: { from: existing.userId, to: newUserId }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(visit);
});

// ─── TASKS ───────────────────────────────────────────────────
const createTaskSchema = z.object({
  equipmentTypeId: z.string().uuid(),
  roomTypeId: z.string().uuid().optional().or(z.literal('')),
  location: z.string().optional(),
});

router.post('/:visitId/tasks', validate(createTaskSchema), async (req: AuthRequest, res: Response) => {
  const visitId = req.params.visitId as string;
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const data = req.body;
  if (data.roomTypeId === '') data.roomTypeId = undefined;
  const maxOrder = await prisma.task.aggregate({ where: { visitId }, _max: { sortOrder: true } });
  const task = await prisma.task.create({
    data: {
      visitId,
      equipmentTypeId: data.equipmentTypeId,
      roomTypeId: data.roomTypeId || null,
      location: data.location || null,
      sortOrder: (maxOrder._max?.sortOrder ?? 0) + 1,
    },
    include: { equipmentType: true, roomType: true, photos: true },
  });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'task', entityId: task.id, newValue: data, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(task);
});

router.get('/:visitId/tasks', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({ where: { id: req.params.visitId as string } });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const tasks = await prisma.task.findMany({
    where: { visitId: req.params.visitId as string },
    orderBy: { sortOrder: 'asc' },
    include: { equipmentType: true, roomType: true, photos: true },
  });
  res.json(tasks);
});

router.get('/:visitId/tasks/:id', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({ where: { id: req.params.visitId as string } });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const task = await prisma.task.findFirst({
    where: { id: req.params.id as string, visitId: req.params.visitId as string },
    include: { equipmentType: true, roomType: true, photos: true },
  });
  if (!task) { res.status(404).json({ error: 'Задача не найдена' }); return; }
  res.json(task);
});

router.put('/:visitId/tasks/:id', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({ where: { id: req.params.visitId as string } });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const data: Record<string, any> = {};
  if (req.body.equipmentTypeId !== undefined) data.equipmentTypeId = req.body.equipmentTypeId;
  if (req.body.roomTypeId !== undefined) data.roomTypeId = req.body.roomTypeId || null;
  if (req.body.location !== undefined) data.location = req.body.location;
  if (req.body.status !== undefined) data.status = req.body.status;
  if (req.body.parameters !== undefined) data.parameters = req.body.parameters;
  if (req.body.selectedRecommendationIds !== undefined) data.selectedRecommendationIds = req.body.selectedRecommendationIds;
  if (req.body.additionalRecommendations !== undefined) data.additionalRecommendations = req.body.additionalRecommendations;
  if (req.body.conclusion !== undefined) data.conclusion = req.body.conclusion;

  const task = await prisma.task.update({
    where: { id: req.params.id as string },
    data,
    include: { equipmentType: true, roomType: true, photos: true },
  });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'task', entityId: task.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(task);
});

router.delete('/:visitId/tasks/:id', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({ where: { id: req.params.visitId as string } });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  await prisma.task.delete({ where: { id: req.params.id as string } });
  const remaining = await prisma.task.findMany({ where: { visitId: req.params.visitId as string }, orderBy: { sortOrder: 'asc' } });
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].sortOrder !== i + 1) {
      await prisma.task.update({ where: { id: remaining[i].id }, data: { sortOrder: i + 1 } });
    }
  }
  await logAudit({ userId: req.userId, action: 'delete', entityType: 'task', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ message: 'Задача удалена' });
});

router.post('/:visitId/tasks/:id/reset', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({ where: { id: req.params.visitId as string } });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const task = await prisma.task.update({
    where: { id: req.params.id as string },
    data: {
      status: 'not_started',
      parameters: Prisma.JsonNull,
      selectedRecommendationIds: [],
      additionalRecommendations: null,
      conclusion: null,
    },
  });
  await prisma.photo.deleteMany({ where: { taskId: req.params.id as string } });
  await logAudit({ userId: req.userId, action: 'reset', entityType: 'task', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(task);
});

export default router;
