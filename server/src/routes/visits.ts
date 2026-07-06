import { Router, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../models/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authMiddleware);

// ─── VISITS ──────────────────────────────────────────────────
const createVisitSchema = z.object({
  addressId: z.string().uuid(),
  engineerName: z.string().min(1),
  dateStart: z.string(),
  timeStart: z.string(),
  season: z.enum(['summer', 'winter']),
});

router.post('/', validate(createVisitSchema), async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.create({
    data: { ...req.body, userId: req.userId!, dateStart: new Date(req.body.dateStart) },
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
  const where: any = {};
  if (req.userRole !== 'admin') where.userId = req.userId;
  else if (req.query.user_id) where.userId = req.query.user_id;
  if (status) where.status = status;
  if (dateFrom) where.dateStart = { ...where.dateStart, gte: new Date(dateFrom) };
  if (dateTo) where.dateStart = { ...where.dateStart, lte: new Date(dateTo) };
  const [data, total] = await Promise.all([
    prisma.visit.findMany({
      where, skip: (page - 1) * pageSize, take: pageSize,
      orderBy: { dateStart: 'desc' },
      include: { address: true, _count: { select: { tasks: true } } },
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
      tasks: {
        orderBy: { sortOrder: 'asc' },
        include: { equipmentType: true, roomType: true, photos: true },
      },
    },
  });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (req.userRole !== 'admin' && visit.userId !== req.userId) { res.status(403).json({ error: 'Доступ запрещён' }); return; }
  res.json(visit);
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.update({
    where: { id: req.params.id as string },
    data: {
      addressId: req.body.addressId,
      engineerName: req.body.engineerName,
      dateStart: req.body.dateStart ? new Date(req.body.dateStart) : undefined,
      timeStart: req.body.timeStart,
      season: req.body.season,
    },
    include: { address: true, tasks: { include: { equipmentType: true, roomType: true, photos: true } } },
  });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'visit', entityId: visit.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(visit);
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  await prisma.visit.delete({ where: { id: req.params.id as string } });
  await logAudit({ userId: req.userId, action: 'delete', entityType: 'visit', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ message: 'Визит удалён' });
});

router.post('/:id/complete', async (req: AuthRequest, res: Response) => {
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

// ─── TASKS ───────────────────────────────────────────────────
const createTaskSchema = z.object({
  equipmentTypeId: z.string().uuid(),
  roomTypeId: z.string().uuid().optional().or(z.literal('')),
  location: z.string().optional(),
});

router.post('/:visitId/tasks', validate(createTaskSchema), async (req: AuthRequest, res: Response) => {
  const visitId = req.params.visitId as string;
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
  const tasks = await prisma.task.findMany({
    where: { visitId: req.params.visitId as string },
    orderBy: { sortOrder: 'asc' },
    include: { equipmentType: true, roomType: true, photos: true },
  });
  res.json(tasks);
});

router.get('/:visitId/tasks/:id', async (req: AuthRequest, res: Response) => {
  const task = await prisma.task.findFirst({
    where: { id: req.params.id as string, visitId: req.params.visitId as string },
    include: { equipmentType: true, roomType: true, photos: true },
  });
  if (!task) { res.status(404).json({ error: 'Задача не найдена' }); return; }
  res.json(task);
});

router.put('/:visitId/tasks/:id', async (req: AuthRequest, res: Response) => {
  // Build update data - only include fields that are explicitly provided
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
  await prisma.task.delete({ where: { id: req.params.id as string } });
  // Recalculate sort orders
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
  // Delete photos for this task
  await prisma.photo.deleteMany({ where: { taskId: req.params.id as string } });
  await logAudit({ userId: req.userId, action: 'reset', entityType: 'task', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(task);
});

export default router;
