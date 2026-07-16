import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authMiddleware, AuthRequest, tmOrAdmin } from '../middleware/auth.js';
import prisma from '../models/prisma.js';
import { generateReportHtml, generatePdf, buildReportFileName, generateSummaryReportHtml, generateObjectReportHtml } from '../services/report.js';
import { sendMail } from '../utils/email.js';
import { logAudit } from '../middleware/audit.js';

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
    include: { address: true, tasks: { include: { photos: true } } },
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

function calculateDateRange(period: string, dateStr?: string): { from: Date; to: Date; label: string } {
  const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  base.setHours(0, 0, 0, 0);

  const from = new Date(base);
  const to = new Date(base);
  to.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => d.toLocaleDateString('ru-RU');

  switch (period) {
    case 'day':
      return { from, to, label: fmt(base) };
    case 'week': {
      const dayOfWeek = base.getDay() || 7; // Mon=1 .. Sun=7
      from.setDate(base.getDate() - dayOfWeek + 1);
      to.setDate(from.getDate() + 6);
      to.setHours(23, 59, 59, 999);
      return { from, to, label: `${fmt(from)} — ${fmt(to)}` };
    }
    case 'month': {
      from.setDate(1);
      const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      to.setTime(lastDay.getTime());
      to.setHours(23, 59, 59, 999);
      return { from, to, label: `${fmt(from)} — ${fmt(to)}` };
    }
    default:
      return { from, to, label: fmt(base) };
  }
}

// ─── GET /summary — Сводный отчёт ──────────────────────────────

router.get('/summary', tmOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { period, date, engineerId, addressId } = req.query as Record<string, string>;
    if (!period || !['day', 'week', 'month'].includes(period)) {
      res.status(400).json({ error: 'Параметр period обязателен: day | week | month' });
      return;
    }

    const { from, to, label } = calculateDateRange(period, date);

    // Build where clause
    const where: any = {
      isDeleted: false,
      dateStart: { gte: from, lte: to },
      status: { in: ['completed', 'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm'] },
    };

    // Role-based filtering
    if (req.userRole === 'tm') {
      const engineerIds = await getTmEngineerIds(req.userId!);
      where.userId = { in: engineerIds };
    }

    // Optional filters (admin or tm within their scope)
    if (engineerId) {
      where.userId = engineerId;
    }
    if (addressId) {
      where.addressId = addressId;
    }

    const visits = await prisma.visit.findMany({
      where,
      orderBy: { dateStart: 'desc' },
      include: {
        address: true,
        tasks: {
          orderBy: { sortOrder: 'asc' },
          include: { equipmentType: true, roomType: true },
        },
      },
    });

    // Load recommendations for resolving IDs to text
    const recommendations = await prisma.recommendation.findMany({ where: { isActive: true } });
    const recMap = new Map(recommendations.map(r => [r.id, r.text]));

    const html = generateSummaryReportHtml(visits, period, label, recMap);

    const pdfPath = path.join(reportsDir, `summary_${period}_${from.toISOString().slice(0, 10)}.pdf`);
    await generatePdf(html, pdfPath);

    await logAudit({ userId: req.userId, action: 'generate_summary_report', entityType: 'report', ipAddress: req.ip, userAgent: req.headers['user-agent'], newValue: { period, date, label } });

    res.download(pdfPath, `summary_${period}_${from.toISOString().slice(0, 10)}.pdf`);
  } catch (err: any) {
    console.error('Summary report error:', err);
    res.status(500).json({ error: 'Ошибка формирования сводного отчёта', details: err.message });
  }
});

// ─── GET /by-object — Отчёт по объекту ─────────────────────────

router.get('/by-object', tmOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { addressId, dateFrom, dateTo } = req.query as Record<string, string>;
    if (!addressId) {
      res.status(400).json({ error: 'Параметр addressId обязателен' });
      return;
    }

    const to = dateTo ? new Date(dateTo + 'T23:59:59') : new Date();
    to.setHours(23, 59, 59, 999);
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    from.setHours(0, 0, 0, 0);

    // Verify address exists
    const address = await prisma.address.findUnique({ where: { id: addressId } });
    if (!address) {
      res.status(404).json({ error: 'Адрес не найден' });
      return;
    }

    const where: any = {
      isDeleted: false,
      addressId,
      dateStart: { gte: from, lte: to },
    };

    // TM can only see their engineers' visits
    if (req.userRole === 'tm') {
      const engineerIds = await getTmEngineerIds(req.userId!);
      where.userId = { in: engineerIds };
    }

    const visits = await prisma.visit.findMany({
      where,
      orderBy: { dateStart: 'desc' },
      include: {
        address: true,
        tasks: {
          orderBy: { sortOrder: 'asc' },
          include: { equipmentType: true, roomType: true, photos: true },
        },
      },
    });

    const recommendations = await prisma.recommendation.findMany({ where: { isActive: true } });
    const recMap = new Map(recommendations.map(r => [r.id, r.text]));

    const dateRangeLabel = `${from.toLocaleDateString('ru-RU')} — ${to.toLocaleDateString('ru-RU')}`;
    const html = generateObjectReportHtml(visits, address, dateRangeLabel, recMap);

    const safeAddr = address.fullAddress.replace(/[^a-zA-Zа-яА-Я0-9_\-]/g, '_').replace(/_+/g, '_').slice(0, 50);
    const pdfPath = path.join(reportsDir, `object_${safeAddr}_${from.toISOString().slice(0, 10)}.pdf`);
    await generatePdf(html, pdfPath);

    await logAudit({ userId: req.userId, action: 'generate_object_report', entityType: 'report', ipAddress: req.ip, userAgent: req.headers['user-agent'], newValue: { addressId, dateFrom, dateTo } });

    res.download(pdfPath, `object_${safeAddr}.pdf`);
  } catch (err: any) {
    console.error('Object report error:', err);
    res.status(500).json({ error: 'Ошибка формирования отчёта по объекту', details: err.message });
  }
});

export default router;
