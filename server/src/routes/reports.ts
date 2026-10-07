import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { authMiddleware, AuthRequest, tmOrAdmin } from '../middleware/auth.js';
import prisma from '../models/prisma.js';
import { generateReportHtml, generatePdf, buildReportFileName } from '../services/report.js';
import { generateMtrReportHtml, buildMtrReportFileName } from '../services/mtrReport.js';
import { generateUnifiedReportHtml, UnifiedReportVisit } from '../services/unifiedReport.js';
import { generateRequestsReportHtml, RequestsReportRequest, RequestsReportKPI } from '../services/requestsReport.js';
import { resizeForActScan } from '../services/imageProcessor.js';
import { validateTaskFields } from '../utils/validation.js';
import { sendMail } from '../utils/email.js';
import { logAudit } from '../middleware/audit.js';
import { PDFDocument } from 'pdf-lib';

const router = Router();
router.use(authMiddleware);

const TZ = 'Europe/Moscow';

const reportsDir = path.resolve('./reports');
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

// POST /api/visits/:id/report/generate
router.post('/:id/report/generate', async (req: AuthRequest, res: Response) => {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: req.params.id as string },
      include: { address: true },
    });
    if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }

    const baseName = buildReportFileName(visit);
    const pdfPath = path.join(reportsDir, `${baseName}.pdf`);

    const html = await generateReportHtml(req.params.id as string);
    await generatePdf(html, pdfPath);

    await logAudit({ userId: req.userId, action: 'generate_report', entityType: 'visit', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ fileName: `${baseName}.pdf`, pdfPath });
  } catch (err: any) {
    console.error('Report generation error:', err);
    res.status(500).json({ error: 'Ошибка генерации отчёта', details: err.message });
  }
});

// GET /api/visits/:id/report/download
router.get('/:id/report/download', async (req: AuthRequest, res: Response) => {
  const visit = await prisma.visit.findUnique({
    where: { id: req.params.id as string },
    include: { address: true, tasks: { include: { photos: true, equipmentItems: { include: { photos: true } } } } },
  });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }

  const baseName = buildReportFileName(visit);
  const pdfPath = path.join(reportsDir, `${baseName}.pdf`);

  // If PDF doesn't exist, generate it
  if (!fs.existsSync(pdfPath)) {
    const html = await generateReportHtml(req.params.id as string);
    await generatePdf(html, pdfPath);
  }

  // Build ZIP with PDF + photos
  // For simplicity, serve just the PDF for now; ZIP assembly happens client-side
  if (!fs.existsSync(pdfPath)) {
    res.status(404).json({ error: 'Отчёт не найден' });
    return;
  }
  res.download(pdfPath, `${baseName}.pdf`);
});

// POST /api/visits/:id/report/send
router.post('/:id/report/send', async (req: AuthRequest, res: Response) => {
  const { email, cc, comment } = req.body;
  if (!email) { res.status(400).json({ error: 'Укажите email получателя' }); return; }

  const visit = await prisma.visit.findUnique({
    where: { id: req.params.id as string },
    include: { address: true },
  });
  if (!visit) { res.status(404).json({ error: 'Визит не найден' }); return; }

  const baseName = buildReportFileName(visit);
  const pdfPath = path.join(reportsDir, `${baseName}.pdf`);

  if (!fs.existsSync(pdfPath)) {
    const html = await generateReportHtml(req.params.id as string);
    await generatePdf(html, pdfPath);
  }

  const subject = `Акт выполненных работ: ${visit.address.fullAddress} от ${visit.dateStart.toLocaleDateString('ru-RU', { timeZone: TZ })}`;
  const text = comment || `Направляем акт выполненных работ по адресу: ${visit.address.fullAddress}`;

  try {
    await sendMail({
      to: email,
      subject,
      text,
      attachments: [{ filename: `${baseName}.pdf`, path: pdfPath }],
    });

    const isEngineerSending = req.userRole === 'engineer';
    const updateData: any = {
      status: isEngineerSending ? 'sent_by_engineer' : 'sent_by_tm',
    };
    if (isEngineerSending) {
      updateData.sentByEngineerAt = new Date();
    } else {
      updateData.sentByTmAt = new Date();
    }
    await prisma.visit.update({ where: { id: req.params.id as string }, data: updateData });

    await logAudit({ userId: req.userId, action: 'send_report', entityType: 'visit', entityId: req.params.id as string, newValue: { email, sentBy: req.userRole }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ message: 'Отчёт отправлен' });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка отправки email', details: err.message });
  }
});

// ─── Helpers ────────────────────────────────────────────────────

import { getTeamEngineerIds } from '../utils/tmTeam.js';

const actScansDir = path.resolve('./uploads/act-scans');
if (!fs.existsSync(actScansDir)) fs.mkdirSync(actScansDir, { recursive: true });

// ─── POST /upload-act-scans — Загрузка сканов актов ────────────

const ALLOWED_SCAN_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SCAN_SIZE = 50 * 1024 * 1024; // 50 MB total
const MAX_SCAN_COUNT = 10;

router.post('/upload-act-scans', tmOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const multer = (await import('multer')).default;
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024, files: MAX_SCAN_COUNT },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_SCAN_TYPES.includes(file.mimetype)) cb(null, true);
        else cb(new Error(`Недопустимый формат: ${file.mimetype}. Разрешены: JPG, PNG, PDF`));
      },
    }).array('files', MAX_SCAN_COUNT);

    upload(req as any, res as any, async (err: any) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }

      const files = (req as any).files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.json({ scanIds: [] });
        return;
      }

      let totalSize = 0;
      const scanIds: string[] = [];

      for (const file of files) {
        totalSize += file.size;
        if (totalSize > MAX_SCAN_SIZE) {
          res.status(400).json({ error: 'Превышен максимальный размер (50 МБ). Удалите часть файлов.' });
          return;
        }

        const isPdf = file.mimetype === 'application/pdf';
        const uuid = crypto.randomUUID();
        const ext = isPdf ? '.pdf' : '.jpg';
        const savedName = `${uuid}_${file.originalname.replace(/[^a-zA-Zа-яА-Я0-9._\-]/g, '_').slice(0, 100)}${ext}`;
        const savedPath = path.join(actScansDir, savedName);

        if (isPdf) {
          // Validate PDF
          try {
            await PDFDocument.load(file.buffer, { ignoreEncryption: false });
          } catch {
            res.status(400).json({ error: `Файл ${file.originalname} повреждён или защищён паролем.` });
            return;
          }
          fs.writeFileSync(savedPath, file.buffer);
        } else {
          // Compress image
          try {
            const compressed = await resizeForActScanBuffer(file.buffer);
            fs.writeFileSync(savedPath, compressed);
          } catch {
            res.status(400).json({ error: `Не удалось обработать изображение ${file.originalname}. Проверьте формат файла.` });
            return;
          }
        }

        const attachment = await prisma.reportAttachment.create({
          data: {
            filePath: savedPath,
            fileType: isPdf ? 'pdf' : 'image',
            originalName: file.originalname,
            fileSize: fs.statSync(savedPath).size,
            uploadedBy: req.userId!,
          },
        });
        scanIds.push(attachment.id);
      }

      await logAudit({ userId: req.userId, action: 'upload_act_scans', entityType: 'report_attachment', ipAddress: req.ip, userAgent: req.headers['user-agent'], newValue: { count: scanIds.length } });
      res.json({ scanIds });
    });
  } catch (err: any) {
    console.error('Upload act scans error:', err);
    res.status(500).json({ error: 'Ошибка загрузки сканов', details: err.message });
  }
});

async function resizeForActScanBuffer(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 80 })
    .withMetadata({})
    .toBuffer();
}

// ─── POST /summary-generate — Унифицированный сводный отчёт ────

const summaryGenerateSchema = z.object({
  type: z.enum(['period', 'objects', 'requests']),
  dateFrom: z.string(),
  dateTo: z.string(),
  addressIds: z.array(z.string().uuid()).optional(),
  requestIds: z.array(z.string().uuid()).optional(),
  contractId: z.string().uuid().optional(),
  engineerId: z.string().uuid().optional(),
  scanIds: z.array(z.string().uuid()).optional(),
});

// Логика определения статуса заявки (скопировано из requests.ts для единообразия)
function computeRequestStatus(
  req: { visitId: string | null; visitRequests: { visitId: string }[]; equipmentTypeId: string; equipmentTypeCode: string | null },
  visits: Array<{ id: string; status: string; tasks?: Array<{ equipmentTypeId: string }>; _count?: { tasks: number } }>
): 'completed' | 'in_progress' | 'assigned' | 'not_started' {
  const isISZH = req.equipmentTypeCode === 'iszh_object';
  
  if (isISZH) {
    // Для ИСЖ объекта — агрегированный статус по всем визитам
    const realVisits = visits.filter(v => v._count?.tasks && v._count.tasks > 0);
    if (realVisits.length === 0) {
      return visits.length > 0 ? 'assigned' : 'not_started';
    }
    const statuses = realVisits.map(v => v.status);
    const completedStatuses = ['completed', 'sent', 'corrected_by_tm'];
    const allCompleted = statuses.every(s => completedStatuses.includes(s));
    if (allCompleted) return 'completed';
    const hasInProgress = statuses.includes('in_progress');
    if (hasInProgress) return 'in_progress';
    const hasAssigned = statuses.includes('planned');
    if (hasAssigned) return 'assigned';
    const hasCompleted = statuses.some(s => completedStatuses.includes(s));
    if (hasCompleted) return 'in_progress';
    return 'assigned';
  } else {
    // Для обычных заявок — статус по прямому визиту (req.visitId)
    // Это тот же подход, что и в RequestsPage
    const directVisitId = req.visitId;
    if (!directVisitId) {
      // Если нет прямого визита, проверяем через visitRequests
      if (req.visitRequests.length === 0) return 'not_started';
      // Берём первый визит из visitRequests
      const firstVisitId = req.visitRequests[0].visitId;
      const visit = visits.find(v => v.id === firstVisitId);
      if (!visit) return 'not_started';
      if (visit.status === 'awaiting_assignment') return 'not_started';
      if (visit.status === 'planned') return 'assigned';
      if (visit.status === 'in_progress') return 'in_progress';
      if (['completed', 'sent', 'corrected_by_tm'].includes(visit.status)) {
        // Проверка: есть ли задача по типу оборудования заявки в визите
        if (req.equipmentTypeId && visit.tasks) {
          const hasMatchingTask = visit.tasks.some(t => t.equipmentTypeId === req.equipmentTypeId);
          if (!hasMatchingTask) return 'not_started';
        }
        return 'completed';
      }
      return 'not_started';
    }
    
    // Есть прямой визит — используем его
    const visit = visits.find(v => v.id === directVisitId);
    if (!visit) return 'not_started';
    if (visit.status === 'awaiting_assignment') return 'not_started';
    if (visit.status === 'planned') return 'assigned';
    if (visit.status === 'in_progress') return 'in_progress';
    if (['completed', 'sent', 'corrected_by_tm'].includes(visit.status)) {
      // Проверка: есть ли задача по типу оборудования заявки в визите
      if (req.equipmentTypeId && visit.tasks) {
        const hasMatchingTask = visit.tasks.some(t => t.equipmentTypeId === req.equipmentTypeId);
        if (!hasMatchingTask) return 'not_started';
      }
      return 'completed';
    }
    return 'not_started';
  }
}

router.post('/summary-generate', tmOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = summaryGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Ошибка валидации', details: parsed.error.flatten() });
      return;
    }
    const { type, dateFrom, dateTo, addressIds, requestIds, contractId, engineerId, scanIds } = parsed.data;

    if (type === 'objects' && (!addressIds || addressIds.length === 0)) {
      res.status(400).json({ error: 'Выберите хотя бы один объект' });
      return;
    }
    if (type === 'requests' && !contractId && (!requestIds || requestIds.length === 0)) {
      res.status(400).json({ error: 'Выберите договор или укажите номера заявок' });
      return;
    }

    const from = new Date(dateFrom + 'T00:00:00');
    const to = new Date(dateTo + 'T23:59:59');

    const where: any = {
      isDeleted: false,
      dateStart: { gte: from, lte: to },
      status: { in: ['completed', 'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm', 'awaiting_assignment', 'planned', 'not_started', 'in_progress'] },
      userId: { not: null },
    };

    if (type === 'objects') {
      where.addressId = { in: addressIds };
    }
    if (type === 'requests') {
      if (contractId) {
        // Режим «По договору и периоду» — находим ВСЕ заявки договора за период
        // Используем тот же фильтр, что и в RequestsPage — по startDate в пределах периода
        const allContractRequests = await prisma.importedRequest.findMany({
          where: {
            contractId,
            startDate: { gte: from, lte: to },
          },
          select: {
            id: true,
            externalRequestId: true,
            externalStatus: true,
            equipmentTypeId: true,
            equipmentTypeCode: true,
            visitId: true,
            visitRequests: { select: { visitId: true } },
          },
        });

        // Подсчёт сводной статистики по заявкам
        const requestStats = {
          total: allContractRequests.length,
          completed: 0,
          inProgress: 0,
          notStarted: 0,
        };

        for (const req of allContractRequests) {
          const hasVisit = req.visitId || req.visitRequests.length > 0;
          if (hasVisit) {
            // Получаем все визиты для заявки
            const visitIdsToCheck = [
              req.visitId,
              ...req.visitRequests.map(vr => vr.visitId),
            ].filter((id): id is string => id !== null && id !== undefined);

            if (visitIdsToCheck.length > 0) {
              const visits = await prisma.visit.findMany({
                where: {
                  id: { in: visitIdsToCheck },
                },
                select: {
                  id: true,
                  status: true,
                  tasks: {
                    select: { equipmentTypeId: true },
                  },
                  _count: {
                    select: { tasks: true },
                  },
                },
              });

              // Определяем статус заявки с использованием той же логики, что и в RequestsPage
              const status = computeRequestStatus(req, visits);

              if (status === 'completed') {
                requestStats.completed++;
              } else if (status === 'in_progress' || status === 'assigned') {
                // В RequestsPage статус 'assigned' попадает во вкладку "В работе" вместе с 'in_progress'
                requestStats.inProgress++;
              } else {
                requestStats.notStarted++;
              }
            } else {
              requestStats.notStarted++;
            }
          } else {
            requestStats.notStarted++;
          }
        }

        // Сохраняем статистику для передачи в HTML-генератор
        (req as any).requestStats = requestStats;

        // Отладка: выводим статистику по заявкам
        console.log('[report-debug] Статистика по заявкам (как в RequestsPage):');
        console.log(`  Завершены: ${requestStats.completed}`);
        console.log(`  В работе: ${requestStats.inProgress}`);
        console.log(`  Не начаты: ${requestStats.notStarted}`);

        // Собираем информацию о заявках в работе и не начатых для вывода в конце отчёта
        const pendingRequests: Array<{
          externalRequestId: string;
          externalStatus: string | null;
          equipmentTypeCode: string | null;
          status: 'in_progress' | 'not_started';
        }> = [];

        for (const req of allContractRequests) {
          const hasVisit = req.visitId || req.visitRequests.length > 0;
          if (!hasVisit) {
            // Заявка без визитов — не начата
            pendingRequests.push({
              externalRequestId: req.externalRequestId,
              externalStatus: req.externalStatus,
              equipmentTypeCode: req.equipmentTypeCode,
              status: 'not_started',
            });
          } else {
            // Проверяем, есть ли визиты в работе
            const visitIdsToCheck = [
              req.visitId,
              ...req.visitRequests.map(vr => vr.visitId),
            ].filter((id): id is string => id !== null && id !== undefined);

            if (visitIdsToCheck.length > 0) {
              const visits = await prisma.visit.findMany({
                where: { id: { in: visitIdsToCheck } },
                select: {
                  id: true,
                  status: true,
                  tasks: {
                    select: { equipmentTypeId: true },
                  },
                  _count: {
                    select: { tasks: true },
                  },
                },
              });

              const status = computeRequestStatus(req, visits);

              // Если заявка не завершена полностью — добавляем в список
              if (status === 'in_progress') {
                pendingRequests.push({
                  externalRequestId: req.externalRequestId,
                  externalStatus: req.externalStatus,
                  equipmentTypeCode: req.equipmentTypeCode,
                  status: 'in_progress',
                });
              }
            }
          }
        }

        (req as any).pendingRequests = pendingRequests;

        // Получаем visitIds для загрузки визитов
        const visitIds = new Set<string>();
        for (const ir of allContractRequests) {
          if (ir.visitId) visitIds.add(ir.visitId);
          for (const vr of ir.visitRequests) {
            visitIds.add(vr.visitId);
          }
        }
        // Также включаем визиты с прямым contract_id в периоде (без привязки к заявкам)
        const directVisits = await prisma.visit.findMany({
          where: {
            contractId,
            isDeleted: false,
            dateStart: { gte: from, lte: to },
            status: { in: ['completed', 'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm', 'awaiting_assignment', 'planned', 'not_started', 'in_progress'] },
            userId: { not: null },
          },
          select: { id: true },
        });
        for (const v of directVisits) {
          visitIds.add(v.id);
        }
        if (visitIds.size > 0) {
          where.id = { in: [...visitIds] };
        } else {
          // Нет визитов — отчёт будет пустым, но без ошибки
          where.id = { in: ['00000000-0000-0000-0000-000000000000'] };
        }
      } else {
        // Режим «Указать номера заявок»
        const importedRequests = await prisma.importedRequest.findMany({
          where: { id: { in: requestIds } },
          select: { visitId: true, visitRequests: { select: { visitId: true } } },
        });
        const visitIds = new Set<string>();
        for (const ir of importedRequests) {
          if (ir.visitId) visitIds.add(ir.visitId);
          for (const vr of ir.visitRequests) {
            visitIds.add(vr.visitId);
          }
        }
        if (visitIds.size === 0) {
          res.status(400).json({ error: 'По указанным заявкам не найдено визитов' });
          return;
        }
        where.id = { in: [...visitIds] };
      }
    }
    // Фильтрация по команде ТМ НЕ применяется для режима заявок (ТМ должен видеть все заявки договора)
    if (req.userRole === 'tm' && type !== 'requests') {
      const engineerIds = await getTeamEngineerIds(req.userId!);
      // Включаем визиты самого ТМ (если ТМ тоже выполнял работы)
      if (!engineerIds.includes(req.userId!)) {
        engineerIds.push(req.userId!);
      }
      where.userId = { in: engineerIds };
    }
    if (engineerId) {
      where.userId = engineerId;
    }

    const visits = await prisma.visit.findMany({
      where,
      orderBy: { dateStart: 'asc' },
      include: {
        address: true,
        contract: { select: { number: true } },
        user: { select: { specializationVik: true, specializationIszh: true, specializationGpm: true, specializationDgu: true, specializationIbp: true } },
        visitRequests: {
          select: {
            importedRequest: {
              select: { externalRequestId: true, startDate: true, deadline: true, equipmentTypeCode: true },
            },
          },
        },
        anomalies: {
          where: { type: 'photo_phash_match' },
          select: { photoId: true, severity: true, details: true },
        },
        tasks: {
          orderBy: { sortOrder: 'asc' },
          include: {
            equipmentType: true,
            roomType: true,
            photos: {
              orderBy: { createdAt: 'asc' },
              select: { id: true, fileName: true, filePath: true, moment: true, verificationStatus: true, verificationDetails: true },
            },
            equipmentItems: {
              orderBy: { sortOrder: 'asc' },
              include: {
                objectEquipment: true,
                photos: true,
              },
            },
          },
        },
      },
    });

    const recommendations = await prisma.recommendation.findMany({ where: { isActive: true } });
    const recMap = new Map(recommendations.map(r => [r.id, r.text]));

    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { fullName: true, role: true } });

    const unifiedVisits: UnifiedReportVisit[] = visits.map(v => {
      // Номера связанных заявок
      const requestIds = v.visitRequests.map(vr => vr.importedRequest.externalRequestId).filter(Boolean);

      // pHash-аномалии по photoId
      const phashByPhoto = new Map<string, { severity: string; details: any }>();
      for (const a of (v.anomalies || [])) {
        if (a.photoId) phashByPhoto.set(a.photoId, { severity: a.severity, details: a.details });
      }

      return {
        id: v.id,
        dateStart: v.dateStart,
        timeStart: v.timeStart,
        timeEnd: v.timeEnd,
        engineerName: v.engineerName,
        season: v.season,
        status: v.status,
        contractNumber: v.contract?.number || undefined,
        requestIds: requestIds.length > 0 ? requestIds : undefined,
        address: { fullAddress: v.address.fullAddress },
        engineerSpec: v.user ? { specializationVik: v.user.specializationVik, specializationIszh: v.user.specializationIszh, specializationGpm: v.user.specializationGpm, specializationDgu: v.user.specializationDgu, specializationIbp: v.user.specializationIbp } : undefined,
        tasks: v.tasks.map(t => {
          // Валидация brand/model/serialNumber
          const fieldErrors = validateTaskFields({ brand: t.brand, model: t.model, serialNumber: t.serialNumber });
          const fieldErrorKeys = new Set(fieldErrors.map(e => e.field));

          return {
            id: t.id,
            taskType: t.taskType,
            conclusion: t.conclusion,
            comment: t.comment,
            parameters: t.parameters,
            brand: t.brand || undefined,
            model: t.model || undefined,
            serialNumber: t.serialNumber || undefined,
            fieldErrorKeys: fieldErrorKeys.size > 0 ? [...fieldErrorKeys] : undefined,
            selectedRecommendationIds: t.selectedRecommendationIds || undefined,
            additionalRecommendations: t.additionalRecommendations || undefined,
            equipmentType: t.equipmentType ? { name: t.equipmentType.name, code: t.equipmentType.code } : undefined,
            roomType: t.roomType ? { name: t.roomType.name } : undefined,
            photos: t.photos.map(p => {
              // Извлекаем pHash-предупреждение из visitAnomalies
              let phashWarning: string | undefined;
              const anomaly = phashByPhoto.get(p.id);
              if (anomaly) {
                phashWarning = 'Дубликат';
              }
              return {
                fileName: p.fileName,
                filePath: p.filePath,
                moment: p.moment,
                phashWarning,
              };
            }),
            equipmentItems: t.equipmentItems?.map(ei => ({
              id: ei.id,
              status: ei.status,
              objectEquipment: ei.objectEquipment ? {
                equipmentTypeCode: ei.objectEquipment.equipmentTypeCode,
                brand: ei.objectEquipment.brand,
                model: ei.objectEquipment.model,
                serialNumber: ei.objectEquipment.serialNumber,
                isOutdoorUnit: ei.objectEquipment.isOutdoorUnit,
              } : undefined,
              photos: ei.photos.map(p => ({ fileName: p.fileName, filePath: p.filePath, moment: p.moment })),
            })),
          };
        }),
      };
    });

    const html = await generateUnifiedReportHtml(unifiedVisits, {
      type,
      dateFrom: from.toLocaleDateString('ru-RU', { timeZone: TZ }),
      dateTo: to.toLocaleDateString('ru-RU', { timeZone: TZ }),
      generatedBy: { fullName: user?.fullName || 'Неизвестно', role: user?.role || 'unknown' },
      recMap,
      requestStats: (req as any).requestStats,
      pendingRequests: (req as any).pendingRequests,
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const safePrefix = type === 'period' ? 'summary' : 'objects';
    const pdfPath = path.join(reportsDir, `${safePrefix}_unified_${dateStr}_${Date.now()}.pdf`);
    await generatePdf(html, pdfPath);

    // Merge act scans if provided
    if (scanIds && scanIds.length > 0) {
      const attachments = await prisma.reportAttachment.findMany({ where: { id: { in: scanIds } } });

      const pdfBuffers: Buffer[] = [fs.readFileSync(pdfPath)];
      const pdfAttachments = attachments.filter(a => a.fileType === 'pdf');
      const imageAttachments = attachments.filter(a => a.fileType === 'image');

      // Add image scans as pages (already compressed)
      if (imageAttachments.length > 0) {
        const { PDFDocument: PDFDoc } = await import('pdf-lib');
        const mainDoc = await PDFDoc.load(pdfBuffers[0]);

        for (const att of imageAttachments) {
          const imgBuf = fs.readFileSync(att.filePath);
          const jpgImage = await mainDoc.embedJpg(imgBuf);
          const page = mainDoc.addPage([595.28, 841.89]); // A4
          const { width, height } = jpgImage.scale(1);
          const maxWidth = 595.28 - 60;
          const maxHeight = 841.89 - 60;
          const scale = Math.min(maxWidth / width, maxHeight / height, 1);
          page.drawImage(jpgImage, {
            x: (595.28 - width * scale) / 2,
            y: (841.89 - height * scale) / 2,
            width: width * scale,
            height: height * scale,
          });
        }

        // Merge PDF attachments
        for (const att of pdfAttachments) {
          const attBuf = fs.readFileSync(att.filePath);
          const attDoc = await PDFDoc.load(attBuf);
          const pages = await mainDoc.copyPages(attDoc, attDoc.getPageIndices());
          pages.forEach(p => mainDoc.addPage(p));
        }

        const finalPdf = await mainDoc.save();
        fs.writeFileSync(pdfPath, finalPdf);
      } else if (pdfAttachments.length > 0) {
        // Only PDF attachments, no images
        const mainPdf = fs.readFileSync(pdfPath);
        const mainDoc = await PDFDocument.load(mainPdf);
        for (const att of pdfAttachments) {
          const attBuf = fs.readFileSync(att.filePath);
          const attDoc = await PDFDocument.load(attBuf);
          const pages = await mainDoc.copyPages(attDoc, attDoc.getPageIndices());
          pages.forEach(p => mainDoc.addPage(p));
        }
        fs.writeFileSync(pdfPath, await mainDoc.save());
      }

      // Link scans to a report task record
      await prisma.reportTask.create({
        data: {
          type,
          params: { dateFrom, dateTo, addressIds },
          status: 'ready',
          pdfPath,
          createdBy: req.userId!,
          completedAt: new Date(),
          attachments: { connect: scanIds.map(id => ({ id })) },
        },
      });
    }

    await logAudit({ userId: req.userId, action: 'generate_unified_report', entityType: 'report', ipAddress: req.ip, userAgent: req.headers['user-agent'], newValue: { type, dateFrom, dateTo, addressIds } });

    const downloadName = type === 'period'
      ? `Svodnyj_otchet_${dateFrom.replace(/\./g, '-')}_${dateTo.replace(/\./g, '-')}.pdf`
      : type === 'requests'
        ? `Otchet_po_zayavkam_${dateFrom.replace(/\./g, '-')}_${dateTo.replace(/\./g, '-')}.pdf`
        : `Otchet_po_obektam_${dateFrom.replace(/\./g, '-')}_${dateTo.replace(/\./g, '-')}.pdf`;

    res.download(pdfPath, downloadName);
  } catch (err: any) {
    console.error('Unified report generation error:', err);
    res.status(500).json({ error: 'Ошибка формирования сводного отчёта', details: err.message });
  }
});

// ─── MTR REPORT ROUTES ────────────────────────────────────────

// POST /api/reports/mtr/:id/report/generate
router.post('/mtr/:id/report/generate', async (req: AuthRequest, res: Response) => {
  try {
    const visit = await prisma.mtrVisit.findUnique({
      where: { id: req.params.id as string },
      include: { address: true },
    });
    if (!visit) { res.status(404).json({ error: 'Визит МТР не найден' }); return; }

    const baseName = buildMtrReportFileName(visit);
    const pdfPath = path.join(reportsDir, `${baseName}.pdf`);

    const html = await generateMtrReportHtml(req.params.id as string);
    await generatePdf(html, pdfPath);

    await logAudit({ userId: req.userId, action: 'generate_report', entityType: 'mtr_visit', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ fileName: `${baseName}.pdf`, pdfPath });
  } catch (err: any) {
    console.error('MTR Report generation error:', err);
    res.status(500).json({ error: 'Ошибка генерации отчёта МТР', details: err.message });
  }
});

// GET /api/reports/mtr/:id/report/download
router.get('/mtr/:id/report/download', async (req: AuthRequest, res: Response) => {
  try {
    const visit = await prisma.mtrVisit.findUnique({
      where: { id: req.params.id as string },
      include: { address: true },
    });
    if (!visit) { res.status(404).json({ error: 'Визит МТР не найден' }); return; }

    const baseName = buildMtrReportFileName(visit);
    const pdfPath = path.join(reportsDir, `${baseName}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      const html = await generateMtrReportHtml(req.params.id as string);
      await generatePdf(html, pdfPath);
    }

    if (!fs.existsSync(pdfPath)) {
      res.status(404).json({ error: 'Отчёт МТР не найден' });
      return;
    }
    res.download(pdfPath, `${baseName}.pdf`);
  } catch (err: any) {
    console.error('MTR Report download error:', err);
    res.status(500).json({ error: 'Ошибка скачивания отчёта МТР', details: err.message });
  }
});

// POST /api/reports/requests-generate — новый отчёт по заявкам
router.post('/requests-generate', tmOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { contractId, dateFrom, dateTo, periodType } = req.body;
    
    if (!contractId) {
      res.status(400).json({ error: 'Не указан договор' });
      return;
    }
    
    if (!dateFrom || !dateTo) {
      res.status(400).json({ error: 'Не указан период' });
      return;
    }

    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    // Загружаем пользователя для информации о сформировавшем
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { fullName: true, role: true },
    });
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    // Загружаем все заявки договора
    const allRequests = await prisma.importedRequest.findMany({
      where: { contractId },
      include: {
        matchedAddress: { select: { fullAddress: true } },
        visit: {
          include: {
            user: { select: { fullName: true } },
            tasks: {
              include: {
                equipmentType: true,
                roomType: true,
                photos: true,
                equipmentItems: {
                  include: {
                    objectEquipment: true,
                    photos: true,
                  },
                },
              },
            },
          },
        },
        visitRequests: {
          include: {
            visit: {
              include: {
                user: { select: { fullName: true } },
                tasks: {
                  include: {
                    equipmentType: true,
                    roomType: true,
                    photos: true,
                    equipmentItems: {
                      include: {
                        objectEquipment: true,
                        photos: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Отладка: выводим количество загруженных заявок
    console.log(`[requests-report] Загружено заявок: ${allRequests.length}`);

    // Фильтруем по периоду (дата создания или закрытия)
    const filteredRequests = allRequests.filter(r => {
      if (periodType === 'closed') {
        // Для закрытых заявок — дата последнего завершённого визита
        const completedVisits = r.visitRequests
          .map((vr: any) => vr.visit)
          .filter((v: any) => ['completed', 'sent', 'corrected_by_tm'].includes(v.status));
        
        if (completedVisits.length === 0) return false; // Нет завершённых визитов
        
        const lastVisitDate = completedVisits.reduce(
          (max: Date, v: any) => v.dateStart > max ? v.dateStart : max, 
          new Date(0)
        );
        
        return lastVisitDate >= from && lastVisitDate <= to;
      } else {
        // Для созданных заявок — дата создания (startDate или createdAt)
        const dateField = r.startDate || r.createdAt;
        if (!dateField) return false;
        const date = new Date(dateField);
        return date >= from && date <= to;
      }
    });

    // Отладка: выводим количество заявок после фильтрации по периоду
    console.log(`[requests-report] Заявок после фильтрации по периоду: ${filteredRequests.length}`);

    // Загружаем рекомендации
    const recommendations = await prisma.recommendation.findMany({
      select: { id: true, text: true },
    });
    const recMap = new Map(recommendations.map(r => [r.id, r.text]));

    // Проверяем дубликаты фото через VisitAnomaly и phashWarning
    const photoAnomalies = await prisma.visitAnomaly.findMany({
      where: {
        type: 'duplicate',
        photo: {
          task: {
            visit: {
              contractId,
            },
          },
        },
      },
      select: {
        photoId: true,
      },
    });
    const duplicatePhotoIds = new Set(photoAnomalies.map((a: any) => a.photoId));

    // Определяем статусы заявок и группируем данные
    const requestsData: RequestsReportRequest[] = [];
    let totalVisits = 0;
    let totalCompletedTasks = 0;
    const servicedAddresses = new Set<string>();

    // Отладка: подсчёт статусов
    let statusCompleted = 0;
    let statusInProgress = 0;
    let statusNotStarted = 0;

    for (const r of filteredRequests) {
      // Получаем все визиты для заявки (включая прямой visit)
      const visits = r.visitRequests.map((vr: any) => vr.visit);
      
      // Добавляем прямой визит, если он есть и его нет в visitRequests
      if ((r as any).visit && !visits.find((v: any) => v.id === (r as any).visit.id)) {
        visits.push((r as any).visit);
      }

      // Определяем статус заявки
      const status = computeRequestStatus(
        {
          visitId: r.visitId,
          visitRequests: r.visitRequests.map((vr: any) => ({ visitId: vr.visitId })),
          equipmentTypeId: r.equipmentTypeId,
          equipmentTypeCode: r.equipmentTypeCode
        },
        visits
      );

      // Подсчитываем статусы для отладки
      if (status === 'completed') statusCompleted++;
      else if (status === 'in_progress' || status === 'assigned') statusInProgress++;
      else statusNotStarted++;
      
      // Фильтруем визиты по статусам (только завершённые и в работе)
      const validVisits = visits.filter((v: any) => 
        ['completed', 'sent', 'corrected_by_tm', 'in_progress'].includes(v.status)
      );

      if (validVisits.length > 0) {
        totalVisits += validVisits.length;
        
        // Подсчитываем выполненные задачи
        for (const visit of validVisits) {
          totalCompletedTasks += visit.tasks.filter((t: any) => t.conclusion).length;
          // Подсчёт обслуженных объектов по адресам визитов (не по заявкам)
          servicedAddresses.add(visit.addressId);
        }
      }

      // Формируем данные для отчёта
      const requestData: RequestsReportRequest = {
        externalRequestId: r.externalRequestId,
        address: r.matchedAddress?.fullAddress || 'Адрес не указан',
        status: status === 'completed' ? 'completed' : status === 'in_progress' || status === 'assigned' ? 'in_progress' : 'not_started',
        visits: validVisits.map((v: any) => ({
          id: v.id,
          dateStart: v.dateStart,
          engineerName: v.user?.fullName || 'Не указан',
          status: v.status,
          tasks: v.tasks.map((t: any) => ({
            id: t.id,
            taskType: t.taskType,
            conclusion: t.conclusion,
            brand: t.brand,
            model: t.model,
            serialNumber: t.serialNumber,
            parameters: t.parameters,
            selectedRecommendationIds: t.selectedRecommendationIds,
            additionalRecommendations: t.additionalRecommendations,
            equipmentType: t.equipmentType,
            roomType: t.roomType,
            photos: t.photos.map((p: any) => ({
              fileName: p.fileName,
              filePath: p.filePath,
              moment: p.moment,
              phash: p.phash,
              isDuplicate: duplicatePhotoIds.has(p.id),
            })),
            equipmentItems: t.equipmentItems.map((ei: any) => ({
              id: ei.id,
              status: ei.status,
              objectEquipment: ei.objectEquipment,
              photos: ei.photos.map((p: any) => ({
                fileName: p.fileName,
                filePath: p.filePath,
                moment: p.moment,
                phash: p.phash,
                isDuplicate: duplicatePhotoIds.has(p.id),
              })),
            })),
          })),
        })),
      };

      requestsData.push(requestData);
    }

    // Сортируем заявки: завершённые → в работе → не начатые
    requestsData.sort((a, b) => {
      const order = { completed: 0, in_progress: 1, not_started: 2 };
      return order[a.status] - order[b.status];
    });

    // Отладка: выводим подсчитанные статусы
    console.log(`[requests-report] Статусы заявок: Завершены=${statusCompleted}, В работе=${statusInProgress}, Не начаты=${statusNotStarted}`);

    // Рассчитываем SLA
    const completedRequests = requestsData.filter(r => r.status === 'completed');
    const closedInTime = completedRequests.filter(r => {
      const req = filteredRequests.find(fr => fr.externalRequestId === r.externalRequestId);
      if (!req || !req.deadline) return false;
      // Проверяем, что все визиты завершены до deadline
      const lastVisitDate = r.visits.reduce((max, v) => v.dateStart > max ? v.dateStart : max, new Date(0));
      return lastVisitDate <= new Date(req.deadline);
    }).length;
    const sla = completedRequests.length > 0 ? (closedInTime / completedRequests.length) * 100 : 0;

    // Формируем KPI
    const kpi: RequestsReportKPI = {
      totalRequests: filteredRequests.length,
      completedRequests: completedRequests.length,
      inProgressRequests: requestsData.filter(r => r.status === 'in_progress').length,
      notStartedRequests: requestsData.filter(r => r.status === 'not_started').length,
      sla,
      totalVisits,
      totalCompletedTasks,
      totalServicedAddresses: servicedAddresses.size,
    };

    // Генерируем HTML
    const html = await generateRequestsReportHtml(requestsData, kpi, {
      periodType: periodType || 'created',
      dateFrom,
      dateTo,
      generatedBy: { fullName: user.fullName, role: user.role },
      recMap,
    });

    // Генерируем PDF
    const pdfPath = path.join(reportsDir, `requests-report-${Date.now()}.pdf`);
    await generatePdf(html, pdfPath);

    await logAudit({ 
      userId: req.userId, 
      action: 'generate_requests_report', 
      entityType: 'contract', 
      entityId: contractId, 
      ipAddress: req.ip, 
      userAgent: req.headers['user-agent'] 
    });

    // Отправляем файл
    res.download(pdfPath, `Отчет-по-заявкам-${Date.now()}.pdf`, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Ошибка скачивания отчёта' });
      }
      // Удаляем файл после отправки
      setTimeout(() => {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }
      }, 60000);
    });
  } catch (err: any) {
    console.error('Requests report generation error:', err);
    res.status(500).json({ error: 'Ошибка генерации отчёта по заявкам', details: err.message });
  }
});

export default router;
