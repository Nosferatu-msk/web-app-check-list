import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../models/prisma.js';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authMiddleware, adminOnly);

// ─── ADDRESSES ───────────────────────────────────────────────
const addressSchema = z.object({
  city: z.string().min(1),
  street: z.string().min(1),
  house: z.string().min(1),
  building: z.string().optional(),
  fullAddress: z.string().min(1),
  customerEmail: z.string().email().optional().or(z.literal('')),
});

router.get('/addresses', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const search = req.query.q as string;
  const where = search ? {
    OR: [
      { fullAddress: { contains: search, mode: 'insensitive' as const } },
      { street: { contains: search, mode: 'insensitive' as const } },
    ],
  } : {};
  const [data, total] = await Promise.all([
    prisma.address.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { fullAddress: 'asc' } }),
    prisma.address.count({ where }),
  ]);
  res.json({ data, total, page, pageSize });
});

router.get('/addresses/search', async (req: AuthRequest, res: Response) => {
  const q = req.query.q as string;
  if (!q || q.length < 2) { res.json([]); return; }
  const data = await prisma.address.findMany({
    where: { OR: [{ fullAddress: { contains: q, mode: 'insensitive' } }, { street: { contains: q, mode: 'insensitive' } }] },
    take: 20,
  });
  res.json(data);
});

router.get('/addresses/:id', async (req: AuthRequest, res: Response) => {
  const item = await prisma.address.findUnique({ where: { id: req.params.id as string } });
  if (!item) { res.status(404).json({ error: 'Не найдено' }); return; }
  res.json(item);
});

router.post('/addresses', validate(addressSchema), async (req: AuthRequest, res: Response) => {
  const item = await prisma.address.create({ data: req.body });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'address', entityId: item.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(item);
});

router.put('/addresses/:id', validate(addressSchema), async (req: AuthRequest, res: Response) => {
  const old = await prisma.address.findUnique({ where: { id: req.params.id as string } });
  const item = await prisma.address.update({ where: { id: req.params.id as string }, data: req.body });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'address', entityId: item.id, oldValue: old || undefined, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(item);
});

router.delete('/addresses/:id', async (req: AuthRequest, res: Response) => {
  await prisma.address.delete({ where: { id: req.params.id as string } });
  await logAudit({ userId: req.userId, action: 'delete', entityType: 'address', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ message: 'Удалено' });
});

// ─── EQUIPMENT TYPES ─────────────────────────────────────────
const equipmentTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  photosRequired: z.number().int().min(1).max(2),
  isActive: z.boolean().optional(),
});

router.get('/equipment-types', async (_req: AuthRequest, res: Response) => {
  const data = await prisma.equipmentType.findMany({ orderBy: { name: 'asc' } });
  res.json(data);
});

router.post('/equipment-types', validate(equipmentTypeSchema), async (req: AuthRequest, res: Response) => {
  const item = await prisma.equipmentType.create({ data: req.body });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'equipment_type', entityId: item.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(item);
});

router.put('/equipment-types/:id', validate(equipmentTypeSchema), async (req: AuthRequest, res: Response) => {
  const item = await prisma.equipmentType.update({ where: { id: req.params.id as string }, data: req.body });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'equipment_type', entityId: item.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(item);
});

router.delete('/equipment-types/:id', async (req: AuthRequest, res: Response) => {
  await prisma.equipmentType.delete({ where: { id: req.params.id as string } });
  await logAudit({ userId: req.userId, action: 'delete', entityType: 'equipment_type', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ message: 'Удалено' });
});

// ─── ROOM TYPES ──────────────────────────────────────────────
const roomTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
});

router.get('/room-types', async (_req: AuthRequest, res: Response) => {
  const data = await prisma.roomType.findMany({ orderBy: { name: 'asc' } });
  res.json(data);
});

router.post('/room-types', validate(roomTypeSchema), async (req: AuthRequest, res: Response) => {
  const item = await prisma.roomType.create({ data: req.body });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'room_type', entityId: item.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(item);
});

router.put('/room-types/:id', validate(roomTypeSchema), async (req: AuthRequest, res: Response) => {
  const item = await prisma.roomType.update({ where: { id: req.params.id as string }, data: req.body });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'room_type', entityId: item.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(item);
});

router.delete('/room-types/:id', async (req: AuthRequest, res: Response) => {
  await prisma.roomType.delete({ where: { id: req.params.id as string } });
  await logAudit({ userId: req.userId, action: 'delete', entityType: 'room_type', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ message: 'Удалено' });
});

// ─── RECOMMENDATIONS ─────────────────────────────────────────
const recommendationSchema = z.object({
  equipmentTypeId: z.string().uuid(),
  text: z.string().min(1),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

router.get('/recommendations', async (req: AuthRequest, res: Response) => {
  const equipmentTypeId = req.query.equipment_type_id as string;
  const where = equipmentTypeId ? { equipmentTypeId } : {};
  const data = await prisma.recommendation.findMany({ where, orderBy: { sortOrder: 'asc' } });
  res.json(data);
});

router.post('/recommendations', validate(recommendationSchema), async (req: AuthRequest, res: Response) => {
  const item = await prisma.recommendation.create({ data: req.body });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'recommendation', entityId: item.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(item);
});

router.put('/recommendations/:id', validate(recommendationSchema), async (req: AuthRequest, res: Response) => {
  const item = await prisma.recommendation.update({ where: { id: req.params.id as string }, data: req.body });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'recommendation', entityId: item.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(item);
});

router.delete('/recommendations/:id', async (req: AuthRequest, res: Response) => {
  await prisma.recommendation.delete({ where: { id: req.params.id as string } });
  await logAudit({ userId: req.userId, action: 'delete', entityType: 'recommendation', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ message: 'Удалено' });
});

// ─── USERS ───────────────────────────────────────────────────
import bcrypt from 'bcryptjs';

const userSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  role: z.enum(['engineer', 'tm', 'admin']),
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
});

router.get('/users', async (_req: AuthRequest, res: Response) => {
  const data = await prisma.user.findMany({ select: { id: true, fullName: true, email: true, role: true, isActive: true, createdAt: true }, orderBy: { fullName: 'asc' } });
  res.json(data);
});

router.post('/users', validate(userSchema), async (req: AuthRequest, res: Response) => {
  const { password, ...rest } = req.body;
  const passwordHash = await bcrypt.hash(password || 'default123', 12);
  const item = await prisma.user.create({ data: { ...rest, passwordHash } });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'user', entityId: item.id, newValue: { fullName: rest.fullName, email: rest.email, role: rest.role }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json({ id: item.id, fullName: item.fullName, email: item.email, role: item.role, isActive: item.isActive });
});

router.put('/users/:id', async (req: AuthRequest, res: Response) => {
  const { password, ...rest } = req.body;
  const data: any = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 12);
  const item = await prisma.user.update({ where: { id: req.params.id as string }, data, select: { id: true, fullName: true, email: true, role: true, isActive: true } });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'user', entityId: item.id, newValue: rest, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(item);
});

router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  await prisma.user.update({ where: { id: req.params.id as string }, data: { isActive: false } });
  await logAudit({ userId: req.userId, action: 'delete', entityType: 'user', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ message: 'Деактивирован' });
});

// ─── TM OBJECTS ──────────────────────────────────────────────
const tmObjectSchema = z.object({
  tmId: z.string().uuid(),
  addressId: z.string().uuid(),
});

router.get('/tm-objects', async (req: AuthRequest, res: Response) => {
  const tmId = req.query.tm_id as string;
  const where = tmId ? { tmId } : {};
  const data = await prisma.tmObject.findMany({
    where,
    include: {
      tm: { select: { id: true, fullName: true, email: true } },
      address: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(data);
});

router.post('/tm-objects', validate(tmObjectSchema), async (req: AuthRequest, res: Response) => {
  const item = await prisma.tmObject.upsert({
    where: { tmId_addressId: { tmId: req.body.tmId, addressId: req.body.addressId } },
    update: {},
    create: req.body,
    include: {
      tm: { select: { id: true, fullName: true, email: true } },
      address: true,
    },
  });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'tm_object', entityId: item.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(item);
});

router.delete('/tm-objects/:id', async (req: AuthRequest, res: Response) => {
  await prisma.tmObject.delete({ where: { id: req.params.id as string } });
  await logAudit({ userId: req.userId, action: 'delete', entityType: 'tm_object', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ message: 'Удалено' });
});

// ─── TM ENGINEERS ────────────────────────────────────────────
const tmEngineerSchema = z.object({
  tmId: z.string().uuid(),
  engineerId: z.string().uuid(),
});

router.get('/tm-engineers', async (req: AuthRequest, res: Response) => {
  const tmId = req.query.tm_id as string;
  const where = tmId ? { tmId } : {};
  const data = await prisma.tmEngineer.findMany({
    where,
    include: {
      tm: { select: { id: true, fullName: true, email: true } },
      engineer: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(data);
});

router.post('/tm-engineers', validate(tmEngineerSchema), async (req: AuthRequest, res: Response) => {
  const item = await prisma.tmEngineer.upsert({
    where: { engineerId: req.body.engineerId },
    update: { tmId: req.body.tmId },
    create: req.body,
    include: {
      tm: { select: { id: true, fullName: true, email: true } },
      engineer: { select: { id: true, fullName: true, email: true } },
    },
  });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'tm_engineer', entityId: item.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(item);
});

router.delete('/tm-engineers/:id', async (req: AuthRequest, res: Response) => {
  await prisma.tmEngineer.delete({ where: { id: req.params.id as string } });
  await logAudit({ userId: req.userId, action: 'delete', entityType: 'tm_engineer', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ message: 'Удалено' });
});

// ─── IMPORT LOGS ─────────────────────────────────────────────
router.get('/import-logs', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const [data, total] = await Promise.all([
    prisma.importLog.findMany({
      skip: (page - 1) * pageSize, take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.importLog.count(),
  ]);
  res.json({ data, total, page, pageSize });
});

// ─── AUDIT LOG ───────────────────────────────────────────────
router.get('/audit-log', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;
  const userId = req.query.user_id as string;
  const action = req.query.action as string;
  const where: any = {};
  if (userId) where.userId = userId;
  if (action) where.action = action;
  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where, skip: (page - 1) * pageSize, take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { fullName: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  res.json({ data, total, page, pageSize });
});

export default router;
