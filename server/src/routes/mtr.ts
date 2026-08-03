import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../models/prisma.js';
import { authMiddleware, AuthRequest, engineerMtrOnly, tmMtrOrAdmin, adminOnly } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authMiddleware);

// ─── Zod-схемы ──────────────────────────────────────────────

const requestNumberRegex = /^SD\d{10}$/i;

const createVisitSchema = z.object({
  addressId: z.string().uuid(),
  requestNumber: z.string().min(1),
  dateStart: z.string(),
  timeStart: z.string(),
});

const updateVisitSchema = z.object({
  addressId: z.string().uuid().optional(),
  requestNumber: z.string().min(1).optional(),
  dateStart: z.string().optional(),
  timeStart: z.string().optional(),
});

const addWorkSchema = z.object({
  mtrWorkTypeId: z.string().uuid(),
  quantity: z.number().int().min(1).optional(),
  comment: z.string().optional(),
});

const rejectVisitSchema = z.object({
  reason: z.string().min(1, 'Укажите причину отклонения'),
});

const createWorkTypeSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

const updateWorkTypeSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

const createTmObjectSchema = z.object({
  tmId: z.string().uuid(),
  addressId: z.string().uuid(),
});

const createTmEngineerSchema = z.object({
  tmId: z.string().uuid(),
  engineerId: z.string().uuid(),
});

// ─── Helpers ─────────────────────────────────────────────────

function normalizeRequestNumber(rn: string): string {
  return rn.toUpperCase();
}

async function getTmMtrEngineerIds(tmId: string): Promise<string[]> {
  const assignments = await prisma.mtrTmEngineer.findMany({
    where: { tmId },
    select: { engineerId: true },
  });
  return assignments.map((a) => a.engineerId);
}

// ─── Инженер МТР: список своих визитов ──────────────────────

router.get('/visits', engineerMtrOnly, async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const status = req.query.status as string;
  const search = req.query.search as string;

  const where: any = {
    engineerId: req.userId,
    isDeleted: false,
  };

  if (status) where.status = status;
  if (search) {
    where.OR = [
      { address: { fullAddress: { contains: search, mode: 'insensitive' } } },
      { address: { objectCode: { contains: search, mode: 'insensitive' } } },
      { requestNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.mtrVisit.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        address: true,
        works: {
          orderBy: { sortOrder: 'asc' },
          include: { mtrWorkType: true },
        },
        photos: true,
      },
    }),
    prisma.mtrVisit.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

// ─── Инженер МТР: создать визит ─────────────────────────────

router.post('/visits', engineerMtrOnly, validate(createVisitSchema), async (req: AuthRequest, res: Response) => {
  const { addressId, requestNumber, dateStart, timeStart } = req.body;

  const normalizedRN = normalizeRequestNumber(requestNumber);
  if (!requestNumberRegex.test(normalizedRN)) {
    res.status(400).json({ error: 'Номер заявки должен быть в формате SD + 10 цифр (например, SD1234567890)' });
    return;
  }

  // Проверка уникальности номера заявки
  const existing = await prisma.mtrVisit.findUnique({ where: { requestNumber: normalizedRN } });
  if (existing) {
    res.status(409).json({ error: 'Визит с таким номером заявки уже существует' });
    return;
  }

  const visit = await prisma.mtrVisit.create({
    data: {
      engineerId: req.userId!,
      addressId,
      requestNumber: normalizedRN,
      dateStart: new Date(dateStart),
      timeStart,
      status: 'draft',
      isDraft: true,
    },
    include: {
      address: true,
      works: {
        orderBy: { sortOrder: 'asc' },
        include: { mtrWorkType: true },
      },
      photos: true,
    },
  });

  await logAudit({
    userId: req.userId,
    action: 'create',
    entityType: 'mtr_visit',
    entityId: visit.id,
    newValue: req.body,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json(visit);
});

// ─── Инженер МТР: получить один визит ───────────────────────

router.get('/visits/:id', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.mtrVisit.findUnique({
    where: { id: req.params.id as string },
    include: {
      address: true,
      works: {
        orderBy: { sortOrder: 'asc' },
        include: { mtrWorkType: true },
      },
      photos: true,
    },
  });

  if (!visit) {
    res.status(404).json({ error: 'Визит не найден' });
    return;
  }

  // Проверка доступа: только свой визит или админ
  if (req.userRole !== 'admin' && visit.engineerId !== req.userId) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }

  res.json(visit);
});

// ─── Инженер МТР: обновить визит (только draft/in_progress) ─

router.put('/visits/:id', engineerMtrOnly, validate(updateVisitSchema), async (req: AuthRequest, res: Response) => {
  const visit = await prisma.mtrVisit.findUnique({ where: { id: req.params.id as string } });
  if (!visit) {
    res.status(404).json({ error: 'Визит не найден' });
    return;
  }
  if (visit.engineerId !== req.userId) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }
  if (visit.status !== 'draft' && visit.status !== 'in_progress') {
    res.status(400).json({ error: 'Можно редактировать только визиты в статусе «Черновик» или «В работе»' });
    return;
  }

  const data: any = {};
  if (req.body.addressId !== undefined) data.addressId = req.body.addressId;
  if (req.body.dateStart !== undefined) data.dateStart = new Date(req.body.dateStart);
  if (req.body.timeStart !== undefined) data.timeStart = req.body.timeStart;

  if (req.body.requestNumber !== undefined) {
    const normalizedRN = normalizeRequestNumber(req.body.requestNumber);
    if (!requestNumberRegex.test(normalizedRN)) {
      res.status(400).json({ error: 'Номер заявки должен быть в формате SD + 10 цифр (например, SD1234567890)' });
      return;
    }
    // Проверка уникальности (исключая текущий визит)
    const duplicate = await prisma.mtrVisit.findFirst({
      where: { requestNumber: normalizedRN, id: { not: visit.id } },
    });
    if (duplicate) {
      res.status(409).json({ error: 'Визит с таким номером заявки уже существует' });
      return;
    }
    data.requestNumber = normalizedRN;
  }

  const updated = await prisma.mtrVisit.update({
    where: { id: visit.id },
    data,
    include: {
      address: true,
      works: {
        orderBy: { sortOrder: 'asc' },
        include: { mtrWorkType: true },
      },
      photos: true,
    },
  });

  await logAudit({
    userId: req.userId,
    action: 'update',
    entityType: 'mtr_visit',
    entityId: visit.id,
    newValue: req.body,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(updated);
});

// ─── Инженер МТР: мягкое удаление визита ────────────────────

router.delete('/visits/:id', engineerMtrOnly, async (req: AuthRequest, res: Response) => {
  const visit = await prisma.mtrVisit.findUnique({ where: { id: req.params.id as string } });
  if (!visit) {
    res.status(404).json({ error: 'Визит не найден' });
    return;
  }
  if (visit.engineerId !== req.userId) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }
  if (visit.status === 'accepted') {
    res.status(400).json({ error: 'Нельзя удалить принятый визит' });
    return;
  }

  await prisma.mtrVisit.update({
    where: { id: visit.id },
    data: {
      isDeleted: true,
      deletedById: req.userId,
      deletedAt: new Date(),
    },
  });

  await logAudit({
    userId: req.userId,
    action: 'delete',
    entityType: 'mtr_visit',
    entityId: visit.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ message: 'Визит удалён' });
});

// ─── Инженер МТР: добавить работу к визиту ──────────────────

router.post('/visits/:id/works', engineerMtrOnly, validate(addWorkSchema), async (req: AuthRequest, res: Response) => {
  const visit = await prisma.mtrVisit.findUnique({ where: { id: req.params.id as string } });
  if (!visit) {
    res.status(404).json({ error: 'Визит не найден' });
    return;
  }
  if (visit.engineerId !== req.userId) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }
  if (visit.status !== 'draft' && visit.status !== 'in_progress') {
    res.status(400).json({ error: 'Можно добавлять работы только в визиты в статусе «Черновик» или «В работе»' });
    return;
  }

  // Проверка существования типа работы
  const workType = await prisma.mtrWorkType.findUnique({ where: { id: req.body.mtrWorkTypeId } });
  if (!workType || !workType.isActive) {
    res.status(404).json({ error: 'Тип работы не найден или неактивен' });
    return;
  }

  // Авто-расчёт sortOrder
  const maxOrder = await prisma.mtrVisitWork.aggregate({
    where: { mtrVisitId: visit.id },
    _max: { sortOrder: true },
  });

  const work = await prisma.mtrVisitWork.create({
    data: {
      mtrVisitId: visit.id,
      mtrWorkTypeId: req.body.mtrWorkTypeId,
      quantity: req.body.quantity ?? 1,
      comment: req.body.comment ?? null,
      sortOrder: (maxOrder._max?.sortOrder ?? 0) + 1,
    },
    include: { mtrWorkType: true },
  });

  // Если визит был в статусе draft — перевести в in_progress
  if (visit.status === 'draft') {
    await prisma.mtrVisit.update({
      where: { id: visit.id },
      data: { status: 'in_progress' },
    });
  }

  await logAudit({
    userId: req.userId,
    action: 'create',
    entityType: 'mtr_visit_work',
    entityId: work.id,
    newValue: req.body,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json(work);
});

// ─── Инженер МТР: удалить работу из визита ──────────────────

router.delete('/visits/:id/works/:workId', engineerMtrOnly, async (req: AuthRequest, res: Response) => {
  const visit = await prisma.mtrVisit.findUnique({ where: { id: req.params.id as string } });
  if (!visit) {
    res.status(404).json({ error: 'Визит не найден' });
    return;
  }
  if (visit.engineerId !== req.userId) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }
  if (visit.status !== 'draft' && visit.status !== 'in_progress') {
    res.status(400).json({ error: 'Можно удалять работы только в визиты в статусе «Черновик» или «В работе»' });
    return;
  }

  const work = await prisma.mtrVisitWork.findFirst({
    where: { id: req.params.workId as string, mtrVisitId: visit.id },
  });
  if (!work) {
    res.status(404).json({ error: 'Работа не найдена' });
    return;
  }

  await prisma.mtrVisitWork.delete({ where: { id: work.id } });

  // Пересчёт sortOrder
  const remaining = await prisma.mtrVisitWork.findMany({
    where: { mtrVisitId: visit.id },
    orderBy: { sortOrder: 'asc' },
  });
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].sortOrder !== i + 1) {
      await prisma.mtrVisitWork.update({
        where: { id: remaining[i].id },
        data: { sortOrder: i + 1 },
      });
    }
  }

  await logAudit({
    userId: req.userId,
    action: 'delete',
    entityType: 'mtr_visit_work',
    entityId: work.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ message: 'Работа удалена' });
});

// ─── Инженер МТР: завершить визит ───────────────────────────

router.put('/visits/:id/complete', engineerMtrOnly, async (req: AuthRequest, res: Response) => {
  const visit = await prisma.mtrVisit.findUnique({
    where: { id: req.params.id as string },
    include: { works: true, photos: true },
  });
  if (!visit) {
    res.status(404).json({ error: 'Визит не найден' });
    return;
  }
  if (visit.engineerId !== req.userId) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }
  if (visit.status !== 'draft' && visit.status !== 'in_progress') {
    res.status(400).json({ error: 'Визит уже завершён или отправлен' });
    return;
  }

  // Проверки: минимум 1 фото «до», 1 работа, 1 фото «после»
  const photosBefore = visit.photos.filter((p) => p.moment === 'before');
  const photosAfter = visit.photos.filter((p) => p.moment === 'after');

  if (photosBefore.length === 0) {
    res.status(400).json({ error: 'Необходимо загрузить хотя бы одно фото «до»' });
    return;
  }
  if (visit.works.length === 0) {
    res.status(400).json({ error: 'Необходимо добавить хотя бы одну работу' });
    return;
  }
  if (photosAfter.length === 0) {
    res.status(400).json({ error: 'Необходимо загрузить хотя бы одно фото «после»' });
    return;
  }

  const now = new Date();

  const updated = await prisma.mtrVisit.update({
    where: { id: visit.id },
    data: {
      status: 'sent',
      isDraft: false,
      sentAt: now,
    },
    include: {
      address: true,
      works: {
        orderBy: { sortOrder: 'asc' },
        include: { mtrWorkType: true },
      },
      photos: true,
    },
  });

  await logAudit({
    userId: req.userId,
    action: 'complete',
    entityType: 'mtr_visit',
    entityId: visit.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(updated);
});

// ─── Инженер МТР: сохранить как черновик ────────────────────

router.put('/visits/:id/save-draft', engineerMtrOnly, async (req: AuthRequest, res: Response) => {
  const visit = await prisma.mtrVisit.findUnique({ where: { id: req.params.id as string } });
  if (!visit) {
    res.status(404).json({ error: 'Визит не найден' });
    return;
  }
  if (visit.engineerId !== req.userId) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }

  const updated = await prisma.mtrVisit.update({
    where: { id: visit.id },
    data: { isDraft: true },
    include: {
      address: true,
      works: {
        orderBy: { sortOrder: 'asc' },
        include: { mtrWorkType: true },
      },
      photos: true,
    },
  });

  res.json(updated);
});

// ─── ТМ МТР: список визитов подчинённых инженеров ───────────

router.get('/tm/visits', tmMtrOrAdmin, async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const status = req.query.status as string;
  const engineerId = req.query.engineer_id as string;
  const search = req.query.search as string;

  const engineerIds = await getTmMtrEngineerIds(req.userId!);

  const where: any = {
    isDeleted: false,
  };

  if (req.userRole === 'admin') {
    // Админ видит все визиты
    if (engineerId) where.engineerId = engineerId;
  } else {
    // ТМ видит только визиты своих инженеров
    if (engineerId && engineerIds.includes(engineerId)) {
      where.engineerId = engineerId;
    } else {
      where.engineerId = { in: engineerIds };
    }
  }

  if (status) where.status = status;
  if (search) {
    where.OR = [
      { address: { fullAddress: { contains: search, mode: 'insensitive' } } },
      { address: { objectCode: { contains: search, mode: 'insensitive' } } },
      { requestNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.mtrVisit.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        address: true,
        engineer: { select: { id: true, fullName: true, email: true } },
        works: {
          orderBy: { sortOrder: 'asc' },
          include: { mtrWorkType: true },
        },
        photos: true,
      },
    }),
    prisma.mtrVisit.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

// ─── ТМ МТР: принять визит ──────────────────────────────────

router.put('/tm/visits/:id/accept', tmMtrOrAdmin, async (req: AuthRequest, res: Response) => {
  const visit = await prisma.mtrVisit.findUnique({ where: { id: req.params.id as string } });
  if (!visit) {
    res.status(404).json({ error: 'Визит не найден' });
    return;
  }
  if (visit.status !== 'sent') {
    res.status(400).json({ error: 'Можно принять только визиты в статусе «Отправлен»' });
    return;
  }

  // ТМ может принимать только визиты своих инженеров
  if (req.userRole === 'tm_mtr') {
    const engineerIds = await getTmMtrEngineerIds(req.userId!);
    if (!engineerIds.includes(visit.engineerId)) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }
  }

  const updated = await prisma.mtrVisit.update({
    where: { id: visit.id },
    data: { status: 'accepted' },
    include: {
      address: true,
      engineer: { select: { id: true, fullName: true, email: true } },
      works: {
        orderBy: { sortOrder: 'asc' },
        include: { mtrWorkType: true },
      },
      photos: true,
    },
  });

  await logAudit({
    userId: req.userId,
    action: 'accept',
    entityType: 'mtr_visit',
    entityId: visit.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(updated);
});

// ─── ТМ МТР: отклонить визит ────────────────────────────────

router.put('/tm/visits/:id/reject', tmMtrOrAdmin, validate(rejectVisitSchema), async (req: AuthRequest, res: Response) => {
  const visit = await prisma.mtrVisit.findUnique({ where: { id: req.params.id as string } });
  if (!visit) {
    res.status(404).json({ error: 'Визит не найден' });
    return;
  }
  if (visit.status !== 'sent') {
    res.status(400).json({ error: 'Можно отклонить только визиты в статусе «Отправлен»' });
    return;
  }

  // ТМ может отклонять только визиты своих инженеров
  if (req.userRole === 'tm_mtr') {
    const engineerIds = await getTmMtrEngineerIds(req.userId!);
    if (!engineerIds.includes(visit.engineerId)) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }
  }

  const updated = await prisma.mtrVisit.update({
    where: { id: visit.id },
    data: {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectionReason: req.body.reason,
    },
    include: {
      address: true,
      engineer: { select: { id: true, fullName: true, email: true } },
      works: {
        orderBy: { sortOrder: 'asc' },
        include: { mtrWorkType: true },
      },
      photos: true,
    },
  });

  await logAudit({
    userId: req.userId,
    action: 'reject',
    entityType: 'mtr_visit',
    entityId: visit.id,
    newValue: { reason: req.body.reason },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(updated);
});

// ─── ТМ МТР: список подчинённых инженеров ───────────────────

router.get('/tm/engineers', tmMtrOrAdmin, async (req: AuthRequest, res: Response) => {
  const assignments = await prisma.mtrTmEngineer.findMany({
    where: { tmId: req.userId },
    include: {
      engineer: { select: { id: true, fullName: true, email: true } },
    },
  });

  res.json(assignments);
});

// ─── Админ: типы работ — список ─────────────────────────────

router.get('/admin/work-types', adminOnly, async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;
  const search = req.query.search as string;
  const isActive = req.query.is_active as string;

  const where: any = {};
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }
  if (isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true';
  }

  const [data, total] = await Promise.all([
    prisma.mtrWorkType.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: 'asc' },
    }),
    prisma.mtrWorkType.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

// ─── Админ: типы работ — создать ────────────────────────────

router.post('/admin/work-types', adminOnly, validate(createWorkTypeSchema), async (req: AuthRequest, res: Response) => {
  const workType = await prisma.mtrWorkType.create({
    data: {
      name: req.body.name,
      category: req.body.category ?? null,
      isActive: req.body.isActive ?? true,
    },
  });

  await logAudit({
    userId: req.userId,
    action: 'create',
    entityType: 'mtr_work_type',
    entityId: workType.id,
    newValue: req.body,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json(workType);
});

// ─── Админ: типы работ — обновить ───────────────────────────

router.put('/admin/work-types/:id', adminOnly, validate(updateWorkTypeSchema), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.mtrWorkType.findUnique({ where: { id: req.params.id as string } });
  if (!existing) {
    res.status(404).json({ error: 'Тип работы не найден' });
    return;
  }

  const data: any = {};
  if (req.body.name !== undefined) data.name = req.body.name;
  if (req.body.category !== undefined) data.category = req.body.category || null;
  if (req.body.isActive !== undefined) data.isActive = req.body.isActive;

  const updated = await prisma.mtrWorkType.update({
    where: { id: existing.id },
    data,
  });

  await logAudit({
    userId: req.userId,
    action: 'update',
    entityType: 'mtr_work_type',
    entityId: updated.id,
    newValue: req.body,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(updated);
});

// ─── Админ: типы работ — удалить ────────────────────────────

router.delete('/admin/work-types/:id', adminOnly, async (req: AuthRequest, res: Response) => {
  const existing = await prisma.mtrWorkType.findUnique({ where: { id: req.params.id as string } });
  if (!existing) {
    res.status(404).json({ error: 'Тип работы не найден' });
    return;
  }

  // Проверка: нет ли визитов, ссылающихся на этот тип работы
  const usageCount = await prisma.mtrVisitWork.count({ where: { mtrWorkTypeId: existing.id } });
  if (usageCount > 0) {
    res.status(400).json({ error: 'Нельзя удалить тип работы: он используется в визитах' });
    return;
  }

  await prisma.mtrWorkType.delete({ where: { id: existing.id } });

  await logAudit({
    userId: req.userId,
    action: 'delete',
    entityType: 'mtr_work_type',
    entityId: existing.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ message: 'Тип работы удалён' });
});

// ─── Админ: объекты ТМ МТР — список ─────────────────────────

router.get('/admin/tm-objects', adminOnly, async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;
  const tmId = req.query.tm_id as string;

  const where: any = {};
  if (tmId) where.tmId = tmId;

  const [data, total] = await Promise.all([
    prisma.mtrTmObject.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        tm: { select: { id: true, fullName: true, email: true } },
        address: true,
      },
    }),
    prisma.mtrTmObject.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

// ─── Админ: объекты ТМ МТР — создать ────────────────────────

router.post('/admin/tm-objects', adminOnly, validate(createTmObjectSchema), async (req: AuthRequest, res: Response) => {
  const { tmId, addressId } = req.body;

  // Проверка существования ТМ
  const tm = await prisma.user.findUnique({ where: { id: tmId } });
  if (!tm || tm.role !== 'tm_mtr') {
    res.status(400).json({ error: 'ТМ МТР не найден' });
    return;
  }

  // Проверка уникальности
  const existing = await prisma.mtrTmObject.findFirst({ where: { tmId, addressId } });
  if (existing) {
    res.status(409).json({ error: 'Такая привязка уже существует' });
    return;
  }

  const obj = await prisma.mtrTmObject.create({
    data: { tmId, addressId },
    include: {
      tm: { select: { id: true, fullName: true, email: true } },
      address: true,
    },
  });

  await logAudit({
    userId: req.userId,
    action: 'create',
    entityType: 'mtr_tm_object',
    entityId: obj.id,
    newValue: req.body,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json(obj);
});

// ─── Админ: объекты ТМ МТР — удалить ────────────────────────

router.delete('/admin/tm-objects/:id', adminOnly, async (req: AuthRequest, res: Response) => {
  const existing = await prisma.mtrTmObject.findUnique({ where: { id: req.params.id as string } });
  if (!existing) {
    res.status(404).json({ error: 'Привязка не найдена' });
    return;
  }

  await prisma.mtrTmObject.delete({ where: { id: existing.id } });

  await logAudit({
    userId: req.userId,
    action: 'delete',
    entityType: 'mtr_tm_object',
    entityId: existing.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ message: 'Привязка удалена' });
});

// ─── Админ: инженеры ТМ МТР — список ────────────────────────

router.get('/admin/tm-engineers', adminOnly, async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;
  const tmId = req.query.tm_id as string;

  const where: any = {};
  if (tmId) where.tmId = tmId;

  const [data, total] = await Promise.all([
    prisma.mtrTmEngineer.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        tm: { select: { id: true, fullName: true, email: true } },
        engineer: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.mtrTmEngineer.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

// ─── Админ: инженеры ТМ МТР — создать ───────────────────────

router.post('/admin/tm-engineers', adminOnly, validate(createTmEngineerSchema), async (req: AuthRequest, res: Response) => {
  const { tmId, engineerId } = req.body;

  // Проверка существования ТМ
  const tm = await prisma.user.findUnique({ where: { id: tmId } });
  if (!tm || tm.role !== 'tm_mtr') {
    res.status(400).json({ error: 'ТМ МТР не найден' });
    return;
  }

  // Проверка существования инженера
  const engineer = await prisma.user.findUnique({ where: { id: engineerId } });
  if (!engineer || engineer.role !== 'engineer_mtr') {
    res.status(400).json({ error: 'Инженер МТР не найден' });
    return;
  }

  // Проверка уникальности (один инженер — один ТМ)
  const existing = await prisma.mtrTmEngineer.findUnique({ where: { engineerId } });
  if (existing) {
    res.status(409).json({ error: 'Этот инженер уже привязан к ТМ' });
    return;
  }

  const assignment = await prisma.mtrTmEngineer.create({
    data: { tmId, engineerId },
    include: {
      tm: { select: { id: true, fullName: true, email: true } },
      engineer: { select: { id: true, fullName: true, email: true } },
    },
  });

  await logAudit({
    userId: req.userId,
    action: 'create',
    entityType: 'mtr_tm_engineer',
    entityId: assignment.id,
    newValue: req.body,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json(assignment);
});

// ─── Админ: инженеры ТМ МТР — удалить ───────────────────────

router.delete('/admin/tm-engineers/:id', adminOnly, async (req: AuthRequest, res: Response) => {
  const existing = await prisma.mtrTmEngineer.findUnique({ where: { id: req.params.id as string } });
  if (!existing) {
    res.status(404).json({ error: 'Привязка не найдена' });
    return;
  }

  await prisma.mtrTmEngineer.delete({ where: { id: existing.id } });

  await logAudit({
    userId: req.userId,
    action: 'delete',
    entityType: 'mtr_tm_engineer',
    entityId: existing.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ message: 'Привязка удалена' });
});

// ─── Общий: поиск типов работ ────────────────────────────────

router.get('/work-types/search', async (req: AuthRequest, res: Response) => {
  const q = req.query.q as string;
  if (!q || q.length < 2) {
    res.json([]);
    return;
  }

  const workTypes = await prisma.mtrWorkType.findMany({
    where: {
      isActive: true,
      name: { contains: q, mode: 'insensitive' },
    },
    select: { id: true, name: true, category: true },
    take: 50,
    orderBy: { name: 'asc' },
  });

  res.json(workTypes);
});

export default router;
