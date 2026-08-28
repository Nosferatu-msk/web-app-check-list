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

async function canAccessVisit(visitUserId: string | null, req: AuthRequest, visitId?: string): Promise<boolean> {
  if (req.userRole === 'admin') return true;
  if (!visitUserId) {
    // Визит без инженера (awaiting_assignment) — доступен ТМ и админу
    return req.userRole === 'tm' || req.userRole === 'admin';
  }
  if (visitUserId === req.userId) return true;
  // Проверка через visitEngineers — вторичный инженер тоже имеет доступ
  if (req.userRole === 'engineer' && visitId) {
    const ve = await prisma.visitEngineer.findFirst({
      where: { visitId, engineerId: req.userId as string },
    });
    if (ve) return true;
  }
  if (req.userRole === 'tm') {
    const engineerIds = await getTmEngineerIds(req.userId!);
    if (engineerIds.includes(visitUserId)) return true;
    // ТМ также имеет доступ, если его инженеры назначены через visitEngineers
    if (visitId) {
      const tmEngineerIds = await getTmEngineerIds(req.userId!);
      const ve = await prisma.visitEngineer.findFirst({
        where: { visitId, engineerId: { in: tmEngineerIds } },
      });
      if (ve) return true;
    }
  }
  return false;
}

// ─── CHECK REQUESTS BY ADDRESS ───────────────────────────────
// Проверка наличия заявок по адресу для автоназначения
router.get('/check-requests', async (req: AuthRequest, res: Response) => {
  if (req.userRole !== 'engineer') {
    res.status(403).json({ error: 'Доступно только инженеру' });
    return;
  }

  const addressId = req.query.addressId as string;
  if (!addressId) {
    res.status(400).json({ error: 'Не указан addressId' });
    return;
  }

  // Проверка специализации инженера — только ВИК и ИСЖ
  const engineer = await prisma.user.findUnique({
    where: { id: req.userId as string },
    select: { specializationVik: true, specializationIszh: true },
  });

  const canAutoAssign = !!(engineer?.specializationVik || engineer?.specializationIszh);

  if (!canAutoAssign) {
    res.json({ requests: [], canAutoAssign: false });
    return;
  }

  // Поиск заявок по адресу со статусами awaiting_assignment и planned
  const requests = await prisma.importedRequest.findMany({
    where: {
      matchedAddressId: addressId,
      visit: {
        status: { in: ['awaiting_assignment', 'planned'] },
      },
      equipmentType: {
        specializationReq: { in: ['vik', 'iszh'] },
      },
    },
    include: {
      equipmentType: { select: { id: true, name: true, code: true, specializationReq: true } },
      visit: {
        include: {
          visitEngineers: {
            include: { engineer: { select: { id: true, fullName: true } } },
          },
        },
      },
    },
    take: 10,
  });

  // Фильтрация: только заявки, где инженер ещё не назначен
  const availableRequests = requests.filter(r => {
    const visit = r.visit;
    if (!visit) return false;
    // Пропустить, если инженер уже назначен на этот визит
    if (visit.visitEngineers.some(ve => ve.engineerId === req.userId)) return false;
    return true;
  });

  res.json({
    requests: availableRequests.map(r => ({
      id: r.id,
      externalRequestId: r.externalRequestId,
      equipmentType: r.equipmentType,
      visitStatus: r.visit?.status,
      visitId: r.visitId,
      assignedEngineers: r.visit?.visitEngineers.map(ve => ({
        id: ve.engineer.id,
        fullName: ve.engineer.fullName,
        isPrimary: ve.isPrimary,
      })) || [],
    })),
    canAutoAssign: true,
  });
});

// ─── VISITS ──────────────────────────────────────────────────
const createVisitSchema = z.object({
  addressId: z.string().uuid(),
  engineerName: z.string().min(1),
  dateStart: z.string(),
  timeStart: z.string(),
  season: z.enum(['summer', 'winter']),
  userId: z.string().uuid().optional(),
  autoAssignRequests: z.boolean().optional(),
});

router.post('/', validate(createVisitSchema), async (req: AuthRequest, res: Response) => {
  const { userId: targetUserId, autoAssignRequests, ...rest } = req.body;
  let visitUserId: string;

  if (req.userRole === 'engineer') {
    visitUserId = req.userId!;
  } else if (targetUserId) {
    visitUserId = targetUserId;
  } else {
    visitUserId = req.userId!;
  }

  // Validate address access: engineer/tm can only use addresses assigned to their TM
  if (req.userRole === 'engineer') {
    const assignment = await prisma.tmEngineer.findUnique({ where: { engineerId: req.userId as string } });
    if (assignment) {
      const tmObject = await prisma.tmObject.findFirst({ where: { tmId: assignment.tmId, addressId: rest.addressId } });
      if (!tmObject) { res.status(403).json({ error: 'Адрес не закреплён за вашим ТМ' }); return; }
    } else { res.status(403).json({ error: 'Вы не привязаны к ТМ' }); return; }
  } else if (req.userRole === 'tm') {
    const tmObject = await prisma.tmObject.findFirst({ where: { tmId: req.userId as string, addressId: rest.addressId } });
    if (!tmObject) { res.status(403).json({ error: 'Адрес не закреплён за вами' }); return; }
  }

  // Проверка дубликатов: если инженер уже имеет активный визит по этому адресу — вернуть его
  if (req.userRole === 'engineer') {
    const existingVisit = await prisma.visit.findFirst({
      where: {
        addressId: rest.addressId,
        userId: req.userId,
        isDeleted: false,
        status: { in: ['not_started', 'planned', 'in_progress'] },
      },
      include: { address: true, tasks: { include: taskInclude } },
    });
    if (existingVisit) {
      res.status(200).json({ ...existingVisit, existingVisit: true });
      return;
    }
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
    include: { address: true, tasks: { include: taskInclude } },
  });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'visit', entityId: visit.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });

  // Автоназначение на заявки по адресу
  const autoAssignedRequests: any[] = [];
  if (autoAssignRequests && req.userRole === 'engineer') {
    // Проверка специализации — только ВИК и ИСЖ
    const engineer = await prisma.user.findUnique({
      where: { id: req.userId as string },
      select: { specializationVik: true, specializationIszh: true, fullName: true },
    });

    if (engineer?.specializationVik || engineer?.specializationIszh) {
      // Поиск заявок по адресу со статусами awaiting_assignment и planned
      const requests = await prisma.importedRequest.findMany({
        where: {
          matchedAddressId: rest.addressId,
          visit: {
            status: { in: ['awaiting_assignment', 'planned'] },
          },
          equipmentType: {
            specializationReq: { in: ['vik', 'iszh'] },
          },
        },
        include: {
          equipmentType: true,
          visit: {
            include: {
              visitEngineers: true,
            },
          },
        },
        take: 20,
      });

      // Привязка инженера к каждой заявке через VisitRequest
      for (const request of requests) {
        // Пропустить, если этот визит уже связан с заявкой
        const existingLink = await prisma.visitRequest.findUnique({
          where: {
            visitId_importedRequestId: {
              visitId: visit.id,
              importedRequestId: request.id,
            },
          },
        });
        if (existingLink) continue;

        // Создать VisitRequest — связать визит инженера с заявкой
        await prisma.visitRequest.create({
          data: {
            visitId: visit.id,
            importedRequestId: request.id,
          },
        });

        // Также назначить инженера на визит заявки через VisitEngineers
        if (request.visitId && request.visit) {
          const visitForRequest = request.visit;
          
          // Пропустить, если инженер уже назначен на этот визит
          if (!visitForRequest.visitEngineers.some(ve => ve.engineerId === req.userId)) {
            const isPrimary = visitForRequest.visitEngineers.length === 0;

            await prisma.visitEngineer.create({
              data: {
                visitId: visitForRequest.id,
                engineerId: req.userId!,
                isPrimary,
                assignedBy: req.userId!,
              },
            });

            // Обновить визит заявки, если это первый инженер
            if (isPrimary) {
              await prisma.visit.update({
                where: { id: visitForRequest.id },
                data: {
                  userId: req.userId,
                  engineerName: engineer.fullName,
                  status: 'planned',
                },
              });
            }
          }
        }

        // Записать в лог назначений
        await prisma.requestAssignmentLog.create({
          data: {
            importedRequestId: request.id,
            action: 'assigned',
            engineerId: req.userId,
            performedBy: req.userId,
            reason: 'Автоматически при создании визита',
          },
        });

        autoAssignedRequests.push({
          requestId: request.id,
          externalRequestId: request.externalRequestId,
          visitId: visit.id,
        });
      }
    }
  }

  res.status(201).json({ ...visit, autoAssignedRequests });
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const status = req.query.status as string;
  const statuses = req.query.statuses as string;
  const search = req.query.search as string;
  const dateFrom = req.query.date_from as string;
  const dateTo = req.query.date_to as string;
  const includeDeleted = req.query.include_deleted === 'true';
  const contractIdFilter = req.query.contractId as string;
  const periodMonth = req.query.periodMonth as string;
  const periodYear = req.query.periodYear as string;

  const where: any = {};
  if (!includeDeleted) where.isDeleted = false;
  if (contractIdFilter) where.contractId = contractIdFilter;

  // Фильтр по периоду (месяц/год)
  if (periodMonth && periodYear) {
    const monthNum = parseInt(periodMonth);
    const yearNum = parseInt(periodYear);
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);
    where.dateStart = { ...where.dateStart, gte: startDate, lte: endDate };
  }

  if (req.userRole === 'engineer') {
    // Инженер видит визиты, где он основной (userId) или назначен через visitEngineers
    where.AND = [
      ...(where.AND || []),
      { OR: [
        { userId: req.userId },
        { visitEngineers: { some: { engineerId: req.userId } } }
      ]}
    ];
  } else if (req.userRole === 'tm') {
    // ТМ видит визиты по своим договорам
    const tmContracts = await prisma.contract.findMany({
      where: { tmId: req.userId!, module: 'to' },
      select: { id: true },
    });
    const contractIds = tmContracts.map(c => c.id);

    const engineerIds = await getTmEngineerIds(req.userId!);
    if (req.query.user_id && engineerIds.includes(req.query.user_id as string)) {
      where.userId = req.query.user_id;
    } else {
      where.userId = { in: engineerIds };
    }
    // ТМ видит визиты по своим договорам ИЛИ визиты своих инженеров
    where.AND = [
      ...(where.AND || []),
      { OR: [
        { contractId: { in: contractIds } },
        { userId: { in: engineerIds } },
      ]},
    ];
  } else if (req.userRole === 'admin') {
    if (req.query.user_id) where.userId = req.query.user_id;
  }

  if (statuses) {
    const statusList = statuses.split(',').filter(Boolean);
    if (statusList.length > 0) where.status = { in: statusList };
  } else if (status) {
    where.status = status;
  }
  if (search) {
    where.AND = [
      ...(where.AND || []),
      { OR: [
        { address: { fullAddress: { contains: search, mode: 'insensitive' } } },
        { address: { objectCode: { contains: search, mode: 'insensitive' } } },
      ]}
    ];
  }
  if (dateFrom) where.dateStart = { ...where.dateStart, gte: new Date(dateFrom) };
  if (dateTo) where.dateStart = { ...where.dateStart, lte: new Date(dateTo) };

  // Для globalStats — те же фильтры, но БЕЗ фильтра по статусам
  const { status: _statusFilter, ...statsWhere } = where;

  const [dataRaw, total, statusCounts] = await Promise.all([
    prisma.visit.findMany({
      where, skip: (page - 1) * pageSize, take: pageSize,
      orderBy: { dateStart: 'desc' },
      include: {
        address: true,
        contract: { select: { id: true, number: true } },
        user: { select: { id: true, fullName: true, email: true, specializationVik: true, specializationIszh: true, specializationGpm: true, specializationDgu: true, specializationIbp: true } },
        assignedBy: { select: { id: true, fullName: true, email: true } },
        deletedBy: { select: { id: true, fullName: true, email: true } },
        importedRequests: { select: { externalRequestId: true } },
        visitRequests: {
          select: {
            importedRequest: { select: { externalRequestId: true } },
          },
        },
        visitEngineers: { include: { engineer: { select: { id: true, fullName: true, email: true, specializationVik: true, specializationIszh: true, specializationGpm: true, specializationDgu: true, specializationIbp: true } } } },
        _count: { select: { tasks: true } },
      },
    }),
    prisma.visit.count({ where }),
    prisma.visit.groupBy({
      by: ['status'],
      where: statsWhere,
      _count: { status: true },
    }),
  ]);

  // Объединяем заявки из importedRequests и visitRequests
  const data = dataRaw.map(v => {
    const directRequests = v.importedRequests.map(r => r.externalRequestId);
    const linkedRequests = v.visitRequests.map(vr => vr.importedRequest.externalRequestId);
    const allRequestIds = [...new Set([...directRequests, ...linkedRequests])];
    return {
      ...v,
      importedRequests: allRequestIds.map(id => ({ externalRequestId: id })),
      visitRequests: undefined, // не возвращаем промежуточную таблицу
    };
  });

  const globalStats = {
    total,
    planned: 0,
    inProgress: 0,
    completed: 0,
  };
  for (const sc of statusCounts) {
    const count = sc._count.status;
    if (['planned', 'not_started', 'awaiting_assignment'].includes(sc.status)) globalStats.planned += count;
    else if (sc.status === 'in_progress') globalStats.inProgress += count;
    else if (['completed', 'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm'].includes(sc.status)) globalStats.completed += count;
  }
  res.json({ data, total, page, pageSize, globalStats });
});

const taskInclude = {
  equipmentType: true,
  roomType: true,
  photos: true,
  objectEquipment: true,
  equipmentItems: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      objectEquipment: true,
      photos: true,
    },
  },
};

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({
    where: { id: req.params.id as string },
    include: {
      address: true,
      contract: { select: { id: true, number: true } },
      user: { select: { id: true, fullName: true, email: true } },
      assignedBy: { select: { id: true, fullName: true, email: true } },
      importedRequests: { select: { externalRequestId: true } },
      visitRequests: {
        select: {
          importedRequest: { select: { externalRequestId: true } },
        },
      },
      visitEngineers: { include: { engineer: { select: { id: true, fullName: true, email: true } } } },
      tasks: {
        orderBy: { sortOrder: 'asc' },
        include: taskInclude,
      },
    },
  });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req, visit.id))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  // Объединяем заявки из importedRequests и visitRequests
  const directRequests = visit.importedRequests.map(r => r.externalRequestId);
  const linkedRequests = visit.visitRequests.map(vr => vr.importedRequest.externalRequestId);
  const allRequestIds = [...new Set([...directRequests, ...linkedRequests])];
  const visitResult = { ...visit, importedRequests: allRequestIds.map(id => ({ externalRequestId: id })), visitRequests: undefined };

  // Filter tasks by engineer's specialization
  if (req.userRole === 'engineer') {
    const engineer = await prisma.user.findUnique({
      where: { id: req.userId as string },
      select: { specializationVik: true, specializationIszh: true, specializationGpm: true, specializationDgu: true, specializationIbp: true },
    });
    if (engineer) {
      const activeSpecs: string[] = [];
      if (engineer.specializationVik) activeSpecs.push('vik');
      if (engineer.specializationIszh) activeSpecs.push('iszh');
      if (engineer.specializationGpm) activeSpecs.push('gpm');
      if (engineer.specializationDgu) activeSpecs.push('dgu');
      if (engineer.specializationIbp) activeSpecs.push('ibp');

      // Only filter if engineer has some but not all specializations
      if (activeSpecs.length > 0 && activeSpecs.length < 5) {
        visit.tasks = visit.tasks.filter(t => t.equipmentType && activeSpecs.includes(t.equipmentType.specializationReq || ''));
      }
    }
  }

  res.json(visitResult);
});

const updateVisitSchema = z.object({
  addressId: z.string().uuid().optional(),
  engineerName: z.string().min(1).optional(),
  dateStart: z.string().optional(),
  timeStart: z.string().optional(),
  season: z.enum(['summer', 'winter']).optional(),
});

router.put('/:id', validate(updateVisitSchema), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.visit.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(existing.userId, req, existing.id))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

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
    include: { address: true, tasks: { include: taskInclude } },
  });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'visit', entityId: visit.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(visit);
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const existing = await prisma.visit.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(existing.userId, req, existing.id))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

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
  const existing = await prisma.visit.findUnique({ 
    where: { id: req.params.id as string },
    include: {
      tasks: {
        include: {
          equipmentType: { select: { photosRequired: true, name: true } },
          photos: { select: { id: true } },
        },
      },
    },
  });
  if (!existing) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(existing.userId, req, existing.id))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  // Проверка обязательных фото
  const tasksMissingPhotos = existing.tasks.filter(task => {
    const required = task.equipmentType?.photosRequired || 0;
    const actual = task.photos?.length || 0;
    return required > 0 && actual < required;
  });

  if (tasksMissingPhotos.length > 0) {
    const taskNames = tasksMissingPhotos.map(t => t.equipmentType?.name || 'оборудование').join(', ');
    res.status(400).json({
      error: `Нельзя завершить визит: для оборудования (${taskNames}) не загружены обязательные фото`,
      tasksMissingPhotos: tasksMissingPhotos.map(t => ({
        taskId: t.id,
        equipmentName: t.equipmentType?.name,
        required: t.equipmentType?.photosRequired,
        actual: t.photos?.length || 0,
      })),
    });
    return;
  }

  // Проверка: все задачи должны быть выполнены (не в статусе not_started)
  const notStartedTasks = existing.tasks.filter(t => t.status === 'not_started');
  if (notStartedTasks.length > 0) {
    const taskNames = notStartedTasks.map(t => t.equipmentType?.name || 'оборудование').join(', ');
    res.status(400).json({
      error: `Нельзя завершить визит: ${notStartedTasks.length} задач(а) не начаты (${taskNames}). Выполните или удалите их.`,
      notStartedTasks: notStartedTasks.map(t => ({
        taskId: t.id,
        equipmentName: t.equipmentType?.name,
      })),
    });
    return;
  }

  const now = new Date();
  const msk = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const timeEnd = `${String(msk.getHours()).padStart(2, '0')}:${String(msk.getMinutes()).padStart(2, '0')}`;
  const visit = await prisma.visit.update({
    where: { id: req.params.id as string },
    data: { status: 'completed', timeEnd },
    include: { address: true, tasks: { include: taskInclude } },
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
  if (!(await canAccessVisit(existing.userId, req, existing.id))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

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
  taskType: z.enum(['individual', 'group_climate']).optional(),
  equipmentTypeId: z.string().uuid(),
  roomTypeId: z.string().uuid().optional().or(z.literal('')),
  roomTypeCode: z.string().optional(),
  objectEquipmentId: z.string().uuid().optional().or(z.literal('')),
  comment: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  equipmentItemIds: z.array(z.string().uuid()).optional(),
});

router.post('/:visitId/tasks', validate(createTaskSchema), async (req: AuthRequest, res: Response) => {
  const visitId = req.params.visitId as string;
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req, visit.id))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const data = req.body;
  if (data.roomTypeId === '') data.roomTypeId = undefined;
  if (data.objectEquipmentId === '') data.objectEquipmentId = undefined;
  const maxOrder = await prisma.task.aggregate({ where: { visitId }, _max: { sortOrder: true } });

  const task = await prisma.task.create({
    data: {
      visitId,
      taskType: data.taskType || 'individual',
      equipmentTypeId: data.equipmentTypeId,
      roomTypeId: data.roomTypeId || null,
      roomTypeCode: data.roomTypeCode || null,
      objectEquipmentId: data.objectEquipmentId || null,
      comment: data.comment || null,
      brand: data.brand || null,
      model: data.model || null,
      serialNumber: data.serialNumber || null,
      sortOrder: (maxOrder._max?.sortOrder ?? 0) + 1,
      ...(data.taskType === 'group_climate' && data.equipmentItemIds?.length ? {
        equipmentItems: {
          create: data.equipmentItemIds.map((oeId: string, idx: number) => ({
            objectEquipmentId: oeId,
            sortOrder: idx + 1,
          })),
        },
      } : {}),
    },
    include: taskInclude,
  });

  // Автоматически переводим визит в "В работе" при создании задачи
  if (['not_started', 'planned', 'awaiting_assignment'].includes(visit.status)) {
    await prisma.visit.update({
      where: { id: visit.id },
      data: { status: 'in_progress' },
    });
  }

  await logAudit({ userId: req.userId, action: 'create', entityType: 'task', entityId: task.id, newValue: data, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(task);
});

router.get('/:visitId/tasks', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({ where: { id: req.params.visitId as string } });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req, visit.id))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const tasks = await prisma.task.findMany({
    where: { visitId: req.params.visitId as string },
    orderBy: { sortOrder: 'asc' },
    include: taskInclude,
  });
  res.json(tasks);
});

router.get('/:visitId/tasks/:id', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({ where: { id: req.params.visitId as string } });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req, visit.id))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const task = await prisma.task.findFirst({
    where: { id: req.params.id as string, visitId: req.params.visitId as string },
    include: taskInclude,
  });
  if (!task) { res.status(404).json({ error: 'Задача не найдена' }); return; }
  res.json(task);
});

router.put('/:visitId/tasks/:id', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({ where: { id: req.params.visitId as string } });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req, visit.id))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const data: Record<string, any> = {};
  if (req.body.equipmentTypeId !== undefined) data.equipmentTypeId = req.body.equipmentTypeId;
  if (req.body.roomTypeId !== undefined) data.roomTypeId = req.body.roomTypeId || null;
  if (req.body.roomTypeCode !== undefined) data.roomTypeCode = req.body.roomTypeCode;
  if (req.body.comment !== undefined) data.comment = req.body.comment;
  if (req.body.brand !== undefined) data.brand = req.body.brand;
  if (req.body.model !== undefined) data.model = req.body.model;
  if (req.body.serialNumber !== undefined) data.serialNumber = req.body.serialNumber;
  if (req.body.status !== undefined) data.status = req.body.status;
  if (req.body.parameters !== undefined) data.parameters = req.body.parameters;
  if (req.body.selectedRecommendationIds !== undefined) data.selectedRecommendationIds = req.body.selectedRecommendationIds;
  if (req.body.additionalRecommendations !== undefined) data.additionalRecommendations = req.body.additionalRecommendations;
  if (req.body.conclusion !== undefined) data.conclusion = req.body.conclusion;

  const task = await prisma.task.update({
    where: { id: req.params.id as string },
    data,
    include: taskInclude,
  });

  // Автоматически переводим визит в "В работе" при первом изменении задачи
  if (['not_started', 'planned', 'awaiting_assignment'].includes(visit.status)) {
    await prisma.visit.update({
      where: { id: visit.id },
      data: { status: 'in_progress' },
    });
  }

  await logAudit({ userId: req.userId, action: 'update', entityType: 'task', entityId: task.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(task);
});

router.delete('/:visitId/tasks/:id', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({ where: { id: req.params.visitId as string } });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req, visit.id))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

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
  if (!(await canAccessVisit(visit.userId, req, visit.id))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const taskId = req.params.id as string;
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) { res.status(404).json({ error: 'Задача не найдена' }); return; }

  // Сброс параметров задачи
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'not_started',
      parameters: Prisma.JsonNull,
      selectedRecommendationIds: [],
      additionalRecommendations: null,
      conclusion: null,
    },
  });

  // Удаление фото задачи (для индивидуальных)
  await prisma.photo.deleteMany({ where: { taskId } });

  // Для групповых задач — сброс статусов единиц и удаление их фото
  if (task.taskType === 'group_climate') {
    await prisma.taskEquipmentItem.updateMany({
      where: { taskId },
      data: { status: null },
    });
    const items = await prisma.taskEquipmentItem.findMany({ where: { taskId }, select: { id: true } });
    for (const item of items) {
      await prisma.photo.deleteMany({ where: { taskEquipmentItemId: item.id } });
    }
  }

  await logAudit({ userId: req.userId, action: 'reset', entityType: 'task', entityId: taskId, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  const updated = await prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  res.json(updated);
});

// ─── TASK EQUIPMENT ITEMS (групповые задачи) ────────────────
const addItemSchema = z.object({
  objectEquipmentId: z.string().uuid(),
});

router.post('/:visitId/tasks/:taskId/items', validate(addItemSchema), async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({ where: { id: req.params.visitId as string } });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req, visit.id))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const task = await prisma.task.findFirst({
    where: { id: req.params.taskId as string, visitId: req.params.visitId as string },
  });
  if (!task || task.taskType !== 'group_climate') {
    res.status(400).json({ error: 'Задача не является групповой' }); return;
  }

  const maxOrder = await prisma.taskEquipmentItem.aggregate({
    where: { taskId: task.id },
    _max: { sortOrder: true },
  });

  const item = await prisma.taskEquipmentItem.create({
    data: {
      taskId: task.id,
      objectEquipmentId: req.body.objectEquipmentId,
      sortOrder: (maxOrder._max?.sortOrder ?? 0) + 1,
    },
    include: { objectEquipment: true, photos: true },
  });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'task_equipment_item', entityId: item.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(item);
});

router.put('/:visitId/tasks/:taskId/items/:itemId', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({ where: { id: req.params.visitId as string } });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req, visit.id))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const data: Record<string, any> = {};
  if (req.body.status !== undefined) data.status = req.body.status;
  if (req.body.sortOrder !== undefined) data.sortOrder = req.body.sortOrder;

  const item = await prisma.taskEquipmentItem.update({
    where: { id: req.params.itemId as string },
    data,
    include: { objectEquipment: true, photos: true },
  });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'task_equipment_item', entityId: item.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(item);
});

router.delete('/:visitId/tasks/:taskId/items/:itemId', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({ where: { id: req.params.visitId as string } });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }
  if (!(await canAccessVisit(visit.userId, req, visit.id))) { res.status(403).json({ error: 'Доступ запрещён' }); return; }

  const itemId = req.params.itemId as string;
  // Удаляем фото единицы
  await prisma.photo.deleteMany({ where: { taskEquipmentItemId: itemId } });
  await prisma.taskEquipmentItem.delete({ where: { id: itemId } });

  // Пересчёт sortOrder
  const taskId = req.params.taskId as string;
  const remaining = await prisma.taskEquipmentItem.findMany({
    where: { taskId },
    orderBy: { sortOrder: 'asc' },
  });
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].sortOrder !== i + 1) {
      await prisma.taskEquipmentItem.update({
        where: { id: remaining[i].id },
        data: { sortOrder: i + 1 },
      });
    }
  }
  await logAudit({ userId: req.userId, action: 'delete', entityType: 'task_equipment_item', entityId: itemId, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ message: 'Единица оборудования удалена' });
});

export default router;
