import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import prisma from '../models/prisma.js';

const router = Router();

const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Попробуйте через 15 минут.' },
});

function verifySignature(payload: string, signature: string, timestamp: string): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;

  const maxAge = 5 * 60;
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > maxAge) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ─── DEPLOY WEBHOOK ──────────────────────────────────────────
router.post('/deploy', webhookLimiter, async (req: Request, res: Response) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const timestamp = req.headers['x-webhook-timestamp'] as string;

  if (!signature || !timestamp) {
    res.status(401).json({ error: 'Отсутствуют заголовки подписи' });
    return;
  }

  const sigValue = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  const rawBody = JSON.stringify(req.body);

  if (!verifySignature(rawBody, sigValue, timestamp)) {
    res.status(401).json({ error: 'Невалидная подпись webhook' });
    return;
  }

  const { version, release_notes } = req.body;

  if (!version || !release_notes) {
    res.status(400).json({ error: 'Поля version и release_notes обязательны' });
    return;
  }

  try {
    const existing = await prisma.systemRelease.findUnique({ where: { version } });
    if (existing) {
      res.json({ success: true, skipped: true, reason: 'already_deployed', version });
      return;
    }

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    await prisma.systemRelease.create({
      data: {
        version,
        releaseNotes: release_notes,
        deployedBy: 'ci_webhook',
        notificationCount: users.length,
      },
    });

    if (users.length > 0) {
      await prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          type: 'system_release',
          title: `Вышел новый релиз ${version}`,
          message: release_notes,
          entityType: 'system_release',
          entityId: version,
        })),
      });
    }

    res.json({ success: true, version, notifications_created: users.length });
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Ошибка обработки webhook' });
  }
});

export default router;
