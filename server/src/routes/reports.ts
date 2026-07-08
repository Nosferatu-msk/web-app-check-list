import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import prisma from '../models/prisma.js';
import { generateReportHtml, generatePdf, buildReportFileName } from '../services/report.js';
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

export default router;
