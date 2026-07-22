import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { authMiddleware, AuthRequest, tmOrAdmin } from '../middleware/auth.js';
import prisma from '../models/prisma.js';
import { generateReportHtml, generatePdf, buildReportFileName } from '../services/report.js';
import { generateUnifiedReportHtml, UnifiedReportVisit } from '../services/unifiedReport.js';
import { resizeForActScan } from '../services/imageProcessor.js';
import { sendMail } from '../utils/email.js';
import { logAudit } from '../middleware/audit.js';
import { PDFDocument } from 'pdf-lib';

const router = Router();
router.use(authMiddleware);

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

  const subject = `Акт выполненных работ: ${visit.address.fullAddress} от ${visit.dateStart.toLocaleDateString('ru-RU')}`;
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

async function getTmEngineerIds(tmId: string): Promise<string[]> {
  const assignments = await prisma.tmEngineer.findMany({ where: { tmId }, select: { engineerId: true } });
  return assignments.map(a => a.engineerId);
}

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
  type: z.enum(['period', 'objects']),
  dateFrom: z.string(),
  dateTo: z.string(),
  addressIds: z.array(z.string().uuid()).optional(),
  engineerId: z.string().uuid().optional(),
  scanIds: z.array(z.string().uuid()).optional(),
});

router.post('/summary-generate', tmOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = summaryGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Ошибка валидации', details: parsed.error.flatten() });
      return;
    }
    const { type, dateFrom, dateTo, addressIds, engineerId, scanIds } = parsed.data;

    if (type === 'objects' && (!addressIds || addressIds.length === 0)) {
      res.status(400).json({ error: 'Выберите хотя бы один объект' });
      return;
    }

    const from = new Date(dateFrom + 'T00:00:00');
    const to = new Date(dateTo + 'T23:59:59');

    const where: any = {
      isDeleted: false,
      dateStart: { gte: from, lte: to },
      status: { in: ['completed', 'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm'] },
    };

    if (type === 'objects') {
      where.addressId = { in: addressIds };
    }
    if (req.userRole === 'tm') {
      const engineerIds = await getTmEngineerIds(req.userId!);
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
        user: { select: { specializationVik: true, specializationIszh: true } },
        tasks: {
          orderBy: { sortOrder: 'asc' },
          include: {
            equipmentType: true,
            roomType: true,
            photos: true,
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

    const unifiedVisits: UnifiedReportVisit[] = visits.map(v => ({
      id: v.id,
      dateStart: v.dateStart,
      timeStart: v.timeStart,
      timeEnd: v.timeEnd,
      engineerName: v.engineerName,
      season: v.season,
      status: v.status,
      address: { fullAddress: v.address.fullAddress },
      engineerSpec: v.user ? { specializationVik: v.user.specializationVik, specializationIszh: v.user.specializationIszh } : undefined,
      tasks: v.tasks.map(t => ({
        id: t.id,
        taskType: t.taskType,
        conclusion: t.conclusion,
        comment: t.comment,
        parameters: t.parameters,
        selectedRecommendationIds: t.selectedRecommendationIds || undefined,
        additionalRecommendations: t.additionalRecommendations || undefined,
        equipmentType: t.equipmentType ? { name: t.equipmentType.name } : undefined,
        roomType: t.roomType ? { name: t.roomType.name } : undefined,
        photos: t.photos.map(p => ({ fileName: p.fileName, filePath: p.filePath, moment: p.moment })),
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
      })),
    }));

    const html = await generateUnifiedReportHtml(unifiedVisits, {
      type,
      dateFrom: from.toLocaleDateString('ru-RU'),
      dateTo: to.toLocaleDateString('ru-RU'),
      generatedBy: { fullName: user?.fullName || 'Неизвестно', role: user?.role || 'unknown' },
      recMap,
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
      : `Otchet_po_obektam_${dateFrom.replace(/\./g, '-')}_${dateTo.replace(/\./g, '-')}.pdf`;

    res.download(pdfPath, downloadName);
  } catch (err: any) {
    console.error('Unified report generation error:', err);
    res.status(500).json({ error: 'Ошибка формирования сводного отчёта', details: err.message });
  }
});

export default router;
