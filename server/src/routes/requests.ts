import { Router, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import prisma from '../models/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { parseRequestsExcel, importRequests, validateRequestsFile } from '../services/requestImport.js';

const router = Router();
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      name.endsWith('.xlsx')
    ) cb(null, true);
    else cb(new Error('Поддерживаются только файлы XLSX'));
  },
});

// ─── ИМПОРТ ЗАЯВОК ──────────────────────────────────────────
router.post('/import', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    const isValidate = req.query.mode === 'validate';

    // Парсинг Excel
    const rows = await parseRequestsExcel(file.buffer);
    if (rows.length === 0) {
      res.status(400).json({ error: 'Файл не содержит данных' });
      return;
    }
    if (rows.length > 5000) {
      res.status(400).json({ error: 'Файл содержит более 5000 строк. Разбейте файл на части.' });
      return;
    }

    // Режим валидации (preview)
    if (isValidate) {
      const validation = await validateRequestsFile(rows);
      res.json(validation);
      return;
    }

    // Создание import_log
    const importLog = await prisma.importLog.create({
      data: {
        userId: req.userId!,
        entityType: 'requests',
        fileName: file.originalname,
        totalRows: rows.length,
        successRows: 0,
        errorRows: 0,
        status: 'processing',
      },
    });

    // Асинхронный импорт (для больших файлов)
    if (rows.length > 100) {
      // Запускаем в фоне
      importRequests(rows, req.userId!, importLog.id).catch(err => {
        console.error('Import requests error:', err);
        prisma.importLog.update({
          where: { id: importLog.id },
          data: { status: 'error', errors: { message: err.message } as any },
        }).catch(console.error);
      });

      res.json({
        importLogId: importLog.id,
        status: 'processing',
        totalRows: rows.length,
        message: 'Импорт запущен в фоновом режиме. Используйте GET /api/requests/import/:id для проверки статуса.',
      });
      return;
    }

    // Синхронный импорт (для маленьких файлов)
    const result = await importRequests(rows, req.userId!, importLog.id);

    // Уведомление ТМ
    if (result.created > 0) {
      // Находим ТМ, который импортировал
      const tmIds = new Set<string>();
      const addresses = await prisma.address.findMany({
        where: { id: { in: rows.map(r => r.objectCode).filter(Boolean) } },
        select: { id: true },
      });
      const tmObjects = await prisma.tmObject.findMany({
        where: { addressId: { in: addresses.map(a => a.id) } },
        select: { tmId: true },
      });
      tmObjects.forEach(tmo => tmIds.add(tmo.tmId));

      // Уведомляем ТМ
      for (const tmId of tmIds) {
        await prisma.notification.create({
          data: {
            userId: tmId,
            type: 'request_imported',
            title: 'Импорт заявок',
            message: `Импортировано ${result.created} заявок. Создано визитов: ${result.created}. Ошибок: ${result.errors}. Пропущено: ${result.skipped}.`,
            entityType: 'import_log',
            entityId: importLog.id,
          },
        });
      }
    }

    await logAudit({
      userId: req.userId,
      action: 'import_requests',
      entityType: 'import_log',
      entityId: importLog.id,
      newValue: { total: result.total, created: result.created, errors: result.errors },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── СТАТУС ИМПОРТА ──────────────────────────────────────────
router.get('/import/:id', async (req: AuthRequest, res: Response) => {
  try {
    const importLog = await prisma.importLog.findUnique({
      where: { id: req.params.id as string },
    });
    if (!importLog) {
      res.status(404).json({ error: 'Импорт не найден' });
      return;
    }
    res.json(importLog);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── СПИСОК ЗАЯВОК ───────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const importStatus = req.query.importStatus as string | undefined;
    const objectCode = req.query.objectCode as string | undefined;

    const where: any = {};
    if (importStatus) where.importStatus = importStatus;
    if (objectCode) where.objectCode = objectCode;

    // Фильтрация по территории ТМ
    if (req.userRole === 'tm') {
      const tmObjects = await prisma.tmObject.findMany({
        where: { tmId: req.userId! },
        select: { addressId: true },
      });
      const addressIds = tmObjects.map(t => t.addressId);
      where.matchedAddressId = { in: addressIds };
    } else if (req.userRole === 'engineer') {
      // Инженер видит только назначенные ему заявки (через visit_engineers)
      const visitEngineers = await prisma.visitEngineer.findMany({
        where: { engineerId: req.userId! },
        select: { visitId: true },
      });
      const visitIds = visitEngineers.map(ve => ve.visitId);
      where.visitId = { in: visitIds };
    }

    const [data, total] = await Promise.all([
      prisma.importedRequest.findMany({
        where,
        include: {
          equipmentType: { select: { id: true, name: true, code: true, specializationReq: true } },
          matchedAddress: { select: { id: true, fullAddress: true, objectCode: true } },
          visit: { select: { id: true, status: true, isMultiSpecialist: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.importedRequest.count({ where }),
    ]);

    res.json({ data, total, page, pageSize });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ДЕТАЛИ ЗАЯВКИ ───────────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const request = await prisma.importedRequest.findUnique({
      where: { id: req.params.id as string },
      include: {
        equipmentType: true,
        matchedAddress: true,
        visit: {
          include: {
            tasks: { include: { equipmentType: true } },
            visitEngineers: { include: { engineer: { select: { id: true, fullName: true, email: true } } } },
          },
        },
        assignmentLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            engineer: { select: { id: true, fullName: true, email: true } },
            performer: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });
    if (!request) {
      res.status(404).json({ error: 'Заявка не найдена' });
      return;
    }
    res.json(request);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── РУЧНАЯ ПРИВЯЗКА К ОБЪЕКТУ ──────────────────────────────
const bindSchema = z.object({
  addressId: z.string().uuid(),
});

router.post('/:id/bind', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'tm' && req.userRole !== 'admin') {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const parsed = bindSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors });
      return;
    }

    const { addressId } = parsed.data;
    const request = await prisma.importedRequest.findUnique({
      where: { id: req.params.id as string },
    });
    if (!request) {
      res.status(404).json({ error: 'Заявка не найдена' });
      return;
    }
    if (request.importStatus !== 'error') {
      res.status(400).json({ error: 'Заявка не в статусе ошибки' });
      return;
    }

    // Обновляем заявку
    const updated = await prisma.importedRequest.update({
      where: { id: req.params.id as string },
      data: {
        matchedAddressId: addressId,
        importStatus: 'matched',
        errorMessage: null,
      },
    });

    // Проверяем, является ли заявка видом "ИСЖ объекта"
    const eq = await prisma.equipmentType.findUnique({ where: { id: request.equipmentTypeId } });
    const isISZH = eq?.name.toLowerCase().includes('исж объекта') || !eq?.specializationReq;

    // Создаём визит
    const visit = await prisma.visit.create({
      data: {
        userId: null,
        addressId,
        engineerName: '',
        dateStart: new Date(),
        timeStart: '09:00',
        season: getCurrentSeason(),
        status: 'awaiting_assignment',
        isMultiSpecialist: isISZH || false,
      },
    });

    // Обновляем заявку с визитом
    await prisma.importedRequest.update({
      where: { id: req.params.id as string },
      data: { visitId: visit.id, importStatus: 'created' },
    });

    // Создаём задачу (кроме ИСЖ объекта)
    if (!isISZH) {
      await prisma.task.create({
        data: {
          visitId: visit.id,
          equipmentTypeId: request.equipmentTypeId,
          externalRequestId: request.externalRequestId,
          status: 'not_started',
        },
      });
    }

    await logAudit({
      userId: req.userId,
      action: 'bind_request',
      entityType: 'imported_request',
      entityId: request.id,
      newValue: { addressId, visitId: visit.id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ request: updated, visit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── НАЗНАЧЕНИЕ ИНЖЕНЕРА ─────────────────────────────────────
const assignSchema = z.object({
  engineerId: z.string().uuid(),
  requestId: z.string().uuid().optional(),
});

router.post('/assign', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'tm' && req.userRole !== 'admin') {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors });
      return;
    }

    const { engineerId, requestId } = parsed.data;

    // Находим заявку
    const request = await prisma.importedRequest.findUnique({
      where: { id: requestId },
      include: {
        equipmentType: true,
        matchedAddress: true,
        visit: { include: { tasks: true, visitEngineers: true } },
      },
    });
    if (!request || !request.visitId) {
      res.status(404).json({ error: 'Заявка не найдена или визит не создан' });
      return;
    }

    const visit = request.visit!;

    // Проверка специализации
    const requiredSpec = request.equipmentType.specializationReq;
    if (requiredSpec) {
      const engineer = await prisma.user.findUnique({ where: { id: engineerId } });
      if (!engineer) {
        res.status(404).json({ error: 'Инженер не найден' });
        return;
      }

      const specMap: Record<string, keyof typeof engineer> = {
        vik: 'specializationVik',
        iszh: 'specializationIszh',
        gpm: 'specializationGpm',
        dgu: 'specializationDgu',
        ibp: 'specializationIbp',
      };
      const specField = specMap[requiredSpec];
      if (specField && !engineer[specField]) {
        res.status(400).json({
          error: `Инженер ${engineer.fullName} не имеет специализации ${requiredSpec.toUpperCase()}. Назначение невозможно.`,
        });
        return;
      }
    }

    // Создаём запись visit_engineer
    const isPrimary = visit.visitEngineers.length === 0;
    const visitEngineer = await prisma.visitEngineer.create({
      data: {
        visitId: visit.id,
        engineerId,
        isPrimary,
        assignedBy: req.userId!,
      },
    });

    // Обновляем визит
    const engineer = await prisma.user.findUnique({ where: { id: engineerId } });
    const updateData: any = {};
    if (isPrimary) {
      updateData.userId = engineerId;
      updateData.engineerName = engineer?.fullName || '';
      updateData.status = 'planned';
    }
    if (Object.keys(updateData).length > 0) {
      await prisma.visit.update({ where: { id: visit.id }, data: updateData });
    }

    // Запись в лог
    await prisma.requestAssignmentLog.create({
      data: {
        importedRequestId: request.id,
        action: 'assigned',
        engineerId,
        performedBy: req.userId!,
      },
    });

    // Уведомление инженеру
    await prisma.notification.create({
      data: {
        userId: engineerId,
        type: 'request_assigned',
        title: 'Новая заявка',
        message: `Заявка № ${request.externalRequestId}. Объект: ${request.matchedAddress?.fullAddress || request.addressRaw}. Оборудование: ${request.equipmentType.name}.`,
        entityType: 'visit',
        entityId: visit.id,
      },
    });

    await logAudit({
      userId: req.userId,
      action: 'assign_engineer',
      entityType: 'imported_request',
      entityId: request.id,
      newValue: { engineerId, visitId: visit.id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json(visitEngineer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── СНЯТИЕ НАЗНАЧЕНИЯ ───────────────────────────────────────
router.post('/unassign', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'tm' && req.userRole !== 'admin') {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const { visitId, engineerId, requestId, reason } = req.body;
    if (!visitId || !engineerId) {
      res.status(400).json({ error: 'Не указаны visitId или engineerId' });
      return;
    }

    // Удаляем запись visit_engineer
    await prisma.visitEngineer.deleteMany({
      where: { visitId, engineerId },
    });

    // Проверяем, остались ли инженеры
    const remaining = await prisma.visitEngineer.count({ where: { visitId } });
    if (remaining === 0) {
      // Визит возвращается в awaiting_assignment
      await prisma.visit.update({
        where: { id: visitId },
        data: { userId: null, engineerName: '', status: 'awaiting_assignment' },
      });
    } else {
      // Если снят основной, назначаем нового основного
      const newPrimary = await prisma.visitEngineer.findFirst({
        where: { visitId, isPrimary: true },
      });
      if (!newPrimary) {
        const firstEngineer = await prisma.visitEngineer.findFirst({
          where: { visitId },
          orderBy: { assignedAt: 'asc' },
        });
        if (firstEngineer) {
          const eng = await prisma.user.findUnique({ where: { id: firstEngineer.engineerId } });
          await prisma.visit.update({
            where: { id: visitId },
            data: { userId: firstEngineer.engineerId, engineerName: eng?.fullName || '' },
          });
          await prisma.visitEngineer.update({
            where: { id: firstEngineer.id },
            data: { isPrimary: true },
          });
        }
      }
    }

    // Запись в лог
    if (requestId) {
      await prisma.requestAssignmentLog.create({
        data: {
          importedRequestId: requestId,
          action: 'unassigned',
          engineerId,
          performedBy: req.userId!,
          reason: reason || null,
        },
      });
    }

    // Уведомление инженеру
    // Получаем данные для текста уведомления
    let requestNumber = '';
    let address = '';
    if (requestId) {
      const reqData = await prisma.importedRequest.findUnique({
        where: { id: requestId },
        select: { externalRequestId: true, matchedAddress: { select: { fullAddress: true } } },
      });
      requestNumber = reqData?.externalRequestId || '';
      address = reqData?.matchedAddress?.fullAddress || '';
    } else {
      // Если requestId не указан, получаем через визит
      const visitData = await prisma.visit.findUnique({
        where: { id: visitId },
        include: {
          importedRequests: { select: { externalRequestId: true } },
          address: { select: { fullAddress: true } },
        },
      });
      requestNumber = visitData?.importedRequests?.[0]?.externalRequestId || '';
      address = visitData?.address?.fullAddress || '';
    }

    await prisma.notification.create({
      data: {
        userId: engineerId,
        type: 'request_unassigned',
        title: 'Снятие с заявки',
        message: `Вы сняты с заявки № ${requestNumber}. Объект: ${address}.`,
        entityType: 'visit',
        entityId: visitId,
      },
    });

    await logAudit({
      userId: req.userId,
      action: 'unassign_engineer',
      entityType: 'visit',
      entityId: visitId,
      newValue: { engineerId, reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ОТКАЗ ИНЖЕНЕРА ──────────────────────────────────────────
router.post('/decline', async (req: AuthRequest, res: Response) => {
  try {
    const { requestId, reason } = req.body;
    if (!requestId || !reason) {
      res.status(400).json({ error: 'Не указаны requestId или reason' });
      return;
    }

    const request = await prisma.importedRequest.findUnique({
      where: { id: requestId },
      include: { visit: true },
    });
    if (!request || !request.visitId) {
      res.status(404).json({ error: 'Заявка не найдена' });
      return;
    }

    // Удаляем инженера из visit_engineers
    await prisma.visitEngineer.deleteMany({
      where: { visitId: request.visitId, engineerId: req.userId! },
    });

    // Визит возвращается в awaiting_assignment
    const remaining = await prisma.visitEngineer.count({ where: { visitId: request.visitId } });
    if (remaining === 0) {
      await prisma.visit.update({
        where: { id: request.visitId },
        data: { userId: null, engineerName: '', status: 'awaiting_assignment' },
    });
    }

    // Запись в лог
    await prisma.requestAssignmentLog.create({
      data: {
        importedRequestId: request.id,
        action: 'declined',
        engineerId: req.userId!,
        performedBy: req.userId!,
        reason,
      },
    });

    // Уведомление ТМ
    const tmIds = new Set<string>();
    if (request.matchedAddressId) {
      const tmObjects = await prisma.tmObject.findMany({
        where: { addressId: request.matchedAddressId },
        select: { tmId: true },
      });
      tmObjects.forEach(tmo => tmIds.add(tmo.tmId));
    }
    const engineer = await prisma.user.findUnique({ where: { id: req.userId! } });
    for (const tmId of tmIds) {
      await prisma.notification.create({
        data: {
          userId: tmId,
          type: 'request_declined',
          title: 'Отказ от заявки',
          message: `Инженер ${engineer?.fullName} отказался от заявки № ${request.externalRequestId}. Причина: ${reason}`,
          entityType: 'imported_request',
          entityId: request.id,
        },
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function getCurrentSeason(): 'summer' | 'winter' {
  const msk = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const month = msk.getMonth() + 1;
  const day = msk.getDate();
  if ((month > 4 && month < 10) || (month === 4 && day >= 1) || (month === 10 && day <= 31)) {
    return 'summer';
  }
  return 'winter';
}

// ─── ПОИСК ЗАЯВОК ПО НОМЕРАМ (для отчёта) ────────────────────
router.post('/search-by-numbers', async (req: AuthRequest, res: Response) => {
  try {
    const { externalRequestIds } = req.body;
    if (!Array.isArray(externalRequestIds) || externalRequestIds.length === 0) {
      res.status(400).json({ error: 'Укажите номера заявок' });
      return;
    }

    const where: any = {
      externalRequestId: { in: externalRequestIds },
    };

    // Фильтрация по территории ТМ
    if (req.userRole === 'tm') {
      const tmObjects = await prisma.tmObject.findMany({
        where: { tmId: req.userId! },
        select: { addressId: true },
      });
      const addressIds = tmObjects.map(t => t.addressId);
      where.matchedAddressId = { in: addressIds };
    }

    const requests = await prisma.importedRequest.findMany({
      where,
      select: {
        id: true,
        externalRequestId: true,
        externalStatus: true,
        objectCode: true,
        importStatus: true,
        visitId: true,
        matchedAddress: { select: { fullAddress: true } },
        equipmentType: { select: { name: true } },
        visit: {
          select: {
            status: true,
            visitEngineers: {
              select: { engineer: { select: { fullName: true } } },
            },
          },
        },
      },
    });

    res.json(requests);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
