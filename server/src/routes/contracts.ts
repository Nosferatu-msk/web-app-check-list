import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../models/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authMiddleware);

// ─── СХЕМЫ ВАЛИДАЦИИ ──────────────────────────────────────────
const contractNumberSchema = z.string()
  .length(12, 'Номер договора должен содержать ровно 12 символов')
  .regex(/^05000/, 'Номер договора должен начинаться с 05000');

const createContractSchema = z.object({
  number: contractNumberSchema,
  tmId: z.string().uuid(),
  module: z.enum(['to', 'mtr']),
});

const updateContractSchema = z.object({
  number: contractNumberSchema.optional(),
  isActive: z.boolean().optional(),
});

const deadlineSettingsSchema = z.object({
  planned: z.object({
    deadlineDays: z.number().nullable(),
    notificationDaysBefore: z.number().min(1).max(30),
  }),
  unplanned: z.object({
    deadlineDays: z.number().nullable(),
    notificationDaysBefore: z.number().min(1).max(30),
  }),
});

// ─── GET /api/contracts ───────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const where: any = {};

    // ТМ видит только свои договоры
    if (req.userRole === 'tm' || req.userRole === 'tm_mtr') {
      where.tmId = req.userId;
    }

    // Фильтр по модулю
    const module = req.query.module as string;
    if (module) where.module = module;

    // Фильтр по активности
    const isActive = req.query.isActive as string;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const data = await prisma.contract.findMany({
      where,
      include: {
        tm: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/contracts ──────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'admin') {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const parsed = createContractSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors });
      return;
    }

    const { number, tmId, module } = parsed.data;

    // Проверка существования ТМ
    const tm = await prisma.user.findUnique({ where: { id: tmId } });
    if (!tm) {
      res.status(400).json({ error: 'ТМ не найден' });
      return;
    }

    // Проверка уникальности номера
    const existing = await prisma.contract.findFirst({
      where: { number, tmId, module },
    });
    if (existing) {
      res.status(400).json({ error: 'Договор с таким номером уже существует у этого ТМ' });
      return;
    }

    const contract = await prisma.contract.create({
      data: { number, tmId, module },
      include: {
        tm: { select: { id: true, fullName: true, email: true } },
      },
    });

    await logAudit({
      userId: req.userId,
      action: 'create',
      entityType: 'contract',
      entityId: contract.id,
      newValue: { number, tmId, module },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json(contract);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/contracts/:id ───────────────────────────────────
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'admin') {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const parsed = updateContractSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors });
      return;
    }

    const contract = await prisma.contract.findUnique({ where: { id: req.params.id as string } });
    if (!contract) {
      res.status(404).json({ error: 'Договор не найден' });
      return;
    }

    // Проверка уникальности номера при изменении
    if (parsed.data.number && parsed.data.number !== contract.number) {
      const existing = await prisma.contract.findFirst({
        where: { number: parsed.data.number, tmId: contract.tmId, module: contract.module },
      });
      if (existing) {
        res.status(400).json({ error: 'Договор с таким номером уже существует у этого ТМ' });
        return;
      }
    }

    const updated = await prisma.contract.update({
      where: { id: req.params.id as string },
      data: parsed.data,
      include: {
        tm: { select: { id: true, fullName: true, email: true } },
      },
    });

    await logAudit({
      userId: req.userId,
      action: 'update',
      entityType: 'contract',
      entityId: updated.id,
      newValue: parsed.data,
      oldValue: { number: contract.number, isActive: contract.isActive },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/contracts/:id (деактивация) ──────────────────
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'admin') {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const contract = await prisma.contract.findUnique({ where: { id: req.params.id as string } });
    if (!contract) {
      res.status(404).json({ error: 'Договор не найден' });
      return;
    }

    // Деактивация вместо удаления
    const updated = await prisma.contract.update({
      where: { id: req.params.id as string },
      data: { isActive: false },
    });

    await logAudit({
      userId: req.userId,
      action: 'deactivate',
      entityType: 'contract',
      entityId: updated.id,
      oldValue: { isActive: true },
      newValue: { isActive: false },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ message: 'Договор деактивирован' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/contracts/deadline-settings ─────────────────────
router.get('/deadline-settings', async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.requestDeadlineSetting.findMany();
    const result: any = {};
    for (const s of settings) {
      result[s.requestType] = {
        deadlineDays: s.deadlineDays,
        notificationDaysBefore: s.notificationDaysBefore,
      };
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/contracts/deadline-settings ─────────────────────
router.put('/deadline-settings', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'admin') {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const parsed = deadlineSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors });
      return;
    }

    // Обновляем planned
    await prisma.requestDeadlineSetting.upsert({
      where: { requestType: 'planned' },
      update: {
        deadlineDays: parsed.data.planned.deadlineDays,
        notificationDaysBefore: parsed.data.planned.notificationDaysBefore,
        updatedBy: req.userId!,
        updatedAt: new Date(),
      },
      create: {
        requestType: 'planned',
        deadlineDays: parsed.data.planned.deadlineDays,
        notificationDaysBefore: parsed.data.planned.notificationDaysBefore,
        updatedBy: req.userId!,
      },
    });

    // Обновляем unplanned
    await prisma.requestDeadlineSetting.upsert({
      where: { requestType: 'unplanned' },
      update: {
        deadlineDays: parsed.data.unplanned.deadlineDays,
        notificationDaysBefore: parsed.data.unplanned.notificationDaysBefore,
        updatedBy: req.userId!,
        updatedAt: new Date(),
      },
      create: {
        requestType: 'unplanned',
        deadlineDays: parsed.data.unplanned.deadlineDays,
        notificationDaysBefore: parsed.data.unplanned.notificationDaysBefore,
        updatedBy: req.userId!,
      },
    });

    await logAudit({
      userId: req.userId,
      action: 'update',
      entityType: 'deadline_settings',
      entityId: 'settings',
      newValue: parsed.data,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ message: 'Настройки сохранены' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
