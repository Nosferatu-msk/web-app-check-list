import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import prisma from '../models/prisma.js';
import { generateAccessToken, generateRefreshToken, authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';
import { sendMail } from '../utils/email.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Слишком много попыток. Попробуйте через 15 минут.' },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6),
});

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Неверный email или пароль' });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Неверный email или пароль' });
    return;
  }
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id, user.role);
  await logAudit({ userId: user.id, action: 'login', entityType: 'user', entityId: user.id, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, isActive: user.isActive },
  });
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(401).json({ error: 'Refresh token required' });
    return;
  }
  try {
    const jwt = await import('jsonwebtoken');
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET || 'dev-secret') as { userId: string; role: string };
    const accessToken = generateAccessToken(payload.userId, payload.role);
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, fullName: true, email: true, role: true, isActive: true } });
  if (!user) {
    res.status(404).json({ error: 'Пользователь не найден' });
    return;
  }
  res.json(user);
});

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.json({ message: 'Если email зарегистрирован, письмо будет отправлено' });
    return;
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
  try {
    await sendMail({
      to: user.email,
      subject: 'Сброс пароля — Чек-лист инженера',
      text: `Для сброса пароля перейдите по ссылке:\n${resetUrl}\n\nСсылка действительна 1 час.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px;">
          <h2 style="margin:0 0 16px;color:#1677ff;">Чек-лист инженера</h2>
          <p>Вы запросили сброс пароля. Нажмите кнопку ниже, чтобы установить новый пароль:</p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 24px;margin:16px 0;background:#1677ff;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
            Сбросить пароль
          </a>
          <p style="color:#888;font-size:13px;">Или скопируйте ссылку в браузер:<br/><span style="word-break:break-all;color:#555;">${resetUrl}</span></p>
          <p style="color:#888;font-size:13px;">Ссылка действительна 1 час. Если вы не запрашивали сброс — проигнорируйте это письмо.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Email send error:', err);
  }
  res.json({ message: 'Если email зарегистрирован, письмо будет отправлено' });
});

// POST /api/auth/reset-password
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), async (req: Request, res: Response) => {
  const { token, password } = req.body;
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
    res.status(400).json({ error: 'Недействительная или истёкшая ссылка' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
  await prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { used: true } });
  res.json({ message: 'Пароль успешно изменён' });
});

export default router;
