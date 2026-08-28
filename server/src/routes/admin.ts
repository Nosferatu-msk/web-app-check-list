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
  objectCode: z.string().optional().or(z.literal('')),
});

router.get('/addresses', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const search = req.query.q as string;
  const includeDeleted = req.query.include_deleted === 'true';
  const where: any = {
    ...(includeDeleted ? {} : { isDeleted: false }),
    ...(search ? {
      OR: [
        { fullAddress: { contains: search, mode: 'insensitive' as const } },
        { street: { contains: search, mode: 'insensitive' as const } },
        { objectCode: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  };
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
    where: { isDeleted: false, OR: [{ fullAddress: { contains: q, mode: 'insensitive' } }, { street: { contains: q, mode: 'insensitive' } }, { objectCode: { contains: q, mode: 'insensitive' } }] },
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
  try {
    await prisma.address.update({
      where: { id: req.params.id as string },
      data: { isDeleted: true },
    });
    await logAudit({ userId: req.userId, action: 'delete', entityType: 'address', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ message: 'Удалено' });
  } catch (err: any) {
    console.error('Delete address error:', err);
    res.status(500).json({ error: 'Ошибка при удалении' });
  }
});

// ─── EQUIPMENT TYPES ─────────────────────────────────────────
const equipmentTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  photosRequired: z.number().int().min(1).max(2),
  isActive: z.boolean().optional(),
  specializationReq: z.string().optional().nullable(),
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
  password: z.string().min(6).optional().or(z.literal('')).transform(v => v || undefined),
  role: z.enum(['engineer', 'tm', 'admin', 'engineer_mtr', 'tm_mtr']),
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
  specializationVik: z.boolean().optional(),
  specializationIszh: z.boolean().optional(),
  specializationGpm: z.boolean().optional(),
  specializationDgu: z.boolean().optional(),
  specializationIbp: z.boolean().optional(),
});

router.get('/users', async (req: AuthRequest, res: Response) => {
  const search = req.query.search as string;
  const role = req.query.role as string;
  const where: any = {};
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
    ];
  }
  if (role) {
    where.role = role;
  }
  const data = await prisma.user.findMany({
    where,
    select: { id: true, fullName: true, email: true, role: true, isActive: true, specializationVik: true, specializationIszh: true, specializationGpm: true, specializationDgu: true, specializationIbp: true, createdAt: true },
    orderBy: { fullName: 'asc' },
    take: 50,
  });
  res.json(data);
});

router.post('/users', validate(userSchema), async (req: AuthRequest, res: Response) => {
  const { password, role, specializationVik, specializationIszh, specializationGpm, specializationDgu, specializationIbp, ...rest } = req.body;
  if (role === 'engineer' && !specializationVik && !specializationIszh && !specializationGpm && !specializationDgu && !specializationIbp) {
    res.status(400).json({ error: 'Выберите хотя бы одну специализацию' });
    return;
  }
  const passwordHash = await bcrypt.hash(password || 'default123', 12);
  const item = await prisma.user.create({
    data: {
      ...rest,
      role,
      passwordHash,
      specializationVik: role === 'engineer' ? (specializationVik ?? false) : false,
      specializationIszh: role === 'engineer' ? (specializationIszh ?? false) : false,
      specializationGpm: role === 'engineer' ? (specializationGpm ?? false) : false,
      specializationDgu: role === 'engineer' ? (specializationDgu ?? false) : false,
      specializationIbp: role === 'engineer' ? (specializationIbp ?? false) : false,
    },
  });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'user', entityId: item.id, newValue: { fullName: rest.fullName, email: rest.email, role, specializationVik: item.specializationVik, specializationIszh: item.specializationIszh, specializationGpm: item.specializationGpm, specializationDgu: item.specializationDgu, specializationIbp: item.specializationIbp }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json({ id: item.id, fullName: item.fullName, email: item.email, role: item.role, isActive: item.isActive, specializationVik: item.specializationVik, specializationIszh: item.specializationIszh, specializationGpm: item.specializationGpm, specializationDgu: item.specializationDgu, specializationIbp: item.specializationIbp });
});

router.put('/users/:id', validate(userSchema), async (req: AuthRequest, res: Response) => {
  const { password, role, specializationVik, specializationIszh, specializationGpm, specializationDgu, specializationIbp, ...rest } = req.body;
  if (role === 'engineer' && !specializationVik && !specializationIszh && !specializationGpm && !specializationDgu && !specializationIbp) {
    res.status(400).json({ error: 'Выберите хотя бы одну специализацию' });
    return;
  }
  const data: any = { ...rest, role };
  if (password) data.passwordHash = await bcrypt.hash(password, 12);
  if (role === 'engineer') {
    data.specializationVik = specializationVik ?? false;
    data.specializationIszh = specializationIszh ?? false;
    data.specializationGpm = specializationGpm ?? false;
    data.specializationDgu = specializationDgu ?? false;
    data.specializationIbp = specializationIbp ?? false;
  } else {
    data.specializationVik = false;
    data.specializationIszh = false;
    data.specializationGpm = false;
    data.specializationDgu = false;
    data.specializationIbp = false;
  }
  const item = await prisma.user.update({
    where: { id: req.params.id as string },
    data,
    select: { id: true, fullName: true, email: true, role: true, isActive: true, specializationVik: true, specializationIszh: true, specializationGpm: true, specializationDgu: true, specializationIbp: true },
  });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'user', entityId: item.id, newValue: { ...rest, role, specializationVik: item.specializationVik, specializationIszh: item.specializationIszh, specializationGpm: item.specializationGpm, specializationDgu: item.specializationDgu, specializationIbp: item.specializationIbp }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
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
  const existing = await prisma.tmObject.findFirst({
    where: { tmId: req.body.tmId, addressId: req.body.addressId, contractId: req.body.contractId || null },
  });
  const item = existing
    ? await prisma.tmObject.update({
        where: { id: existing.id },
        data: req.body,
        include: {
          tm: { select: { id: true, fullName: true, email: true } },
          address: true,
        },
      })
    : await prisma.tmObject.create({
        data: req.body,
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

// ─── OBJECT EQUIPMENT ────────────────────────────────────────
const objectEquipmentSchema = z.object({
  addressId: z.string().uuid(),
  equipmentTypeCode: z.string().min(1),
  roomTypeCode: z.string().min(1).optional().or(z.literal('')),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  locationDescription: z.string().optional(),
  isActive: z.boolean().optional(),
});

router.get('/object-equipment', async (req: AuthRequest, res: Response) => {
  const addressId = req.query.address_id as string;
  const where = addressId ? { addressId } : {};
  const data = await prisma.objectEquipment.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
  res.json(data);
});

router.post('/object-equipment', validate(objectEquipmentSchema), async (req: AuthRequest, res: Response) => {
  const data = { ...req.body };
  if (data.roomTypeCode === '') data.roomTypeCode = null;
  const item = await prisma.objectEquipment.create({ data });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'object_equipment', entityId: item.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(item);
});

router.put('/object-equipment/:id', validate(objectEquipmentSchema), async (req: AuthRequest, res: Response) => {
  const data = { ...req.body };
  if (data.roomTypeCode === '') data.roomTypeCode = null;
  const item = await prisma.objectEquipment.update({ where: { id: req.params.id as string }, data });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'object_equipment', entityId: item.id, newValue: req.body, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(item);
});

const confirmRoomSchema = z.object({
  roomTypeCode: z.string().min(1),
});

router.patch('/object-equipment/:id/room', validate(confirmRoomSchema), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.objectEquipment.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: 'Запись не найдена' }); return; }
  if (existing.roomTypeCode) {
    res.status(409).json({ error: 'Помещение уже указано' });
    return;
  }
  const rmType = await prisma.roomType.findFirst({ where: { code: req.body.roomTypeCode } });
  if (!rmType) {
    res.status(400).json({ error: 'Тип помещения не найден в справочнике' });
    return;
  }
  const item = await prisma.objectEquipment.update({
    where: { id: req.params.id as string },
    data: {
      roomTypeCode: req.body.roomTypeCode,
      roomConfirmedAt: new Date(),
      roomConfirmedBy: req.userId,
    },
  });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'object_equipment', entityId: item.id, newValue: { roomTypeCode: req.body.roomTypeCode }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(item);
});

router.delete('/object-equipment/:id', async (req: AuthRequest, res: Response) => {
  await prisma.objectEquipment.delete({ where: { id: req.params.id as string } });
  await logAudit({ userId: req.userId, action: 'delete', entityType: 'object_equipment', entityId: req.params.id as string, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ message: 'Удалено' });
});

// ─── AUDIT LOG ───────────────────────────────────────────────
function buildAuditWhere(req: any) {
  const where: any = {};
  const userId = req.query.user_id as string;
  const action = req.query.action as string;
  const dateFrom = req.query.date_from as string;
  const dateTo = req.query.date_to as string;
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }
  return where;
}

router.get('/audit-log', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;
  const where = buildAuditWhere(req);
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

router.get('/audit-log/export', async (req: AuthRequest, res: Response) => {
  const where = buildAuditWhere(req);
  const data = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { fullName: true, email: true } } },
  });
  const fmt = (d: Date) => {
    const msk = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(msk.getDate())}.${pad(msk.getMonth() + 1)}.${msk.getFullYear()} ${pad(msk.getHours())}:${pad(msk.getMinutes())}:${pad(msk.getSeconds())}`;
  };
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const header = 'Дата;Пользователь;Email;Действие;Сущность;ID сущности;IP-адрес';
  const rows = data.map(r => [
    fmt(r.createdAt),
    r.user?.fullName || '—',
    r.user?.email || '—',
    r.action,
    r.entityType,
    r.entityId || '—',
    r.ipAddress || '—',
  ].join(';'));
  const csv = '\uFEFF' + [header, ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audit-log-${dateStr}.csv"`);
  res.send(csv);
});

router.delete('/audit-log', async (req: AuthRequest, res: Response) => {
  const where = buildAuditWhere(req);
  const count = await prisma.auditLog.count({ where });
  await prisma.auditLog.deleteMany({ where });
  await logAudit({ userId: req.userId, action: 'delete', entityType: 'audit_log', entityId: null, oldValue: { filters: where, deletedCount: count }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ message: `Удалено записей: ${count}` });
});

// ─── MANUFACTURERS ──────────────────────────────────────────

const createManufacturerSchema = z.object({
  name: z.string().min(1),
  country: z.string().optional().nullable(),
});

const updateManufacturerSchema = z.object({
  name: z.string().min(1).optional(),
  country: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.get('/manufacturers', async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const q = (req.query.q as string) || '';

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { country: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.manufacturer.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.manufacturer.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

router.post('/manufacturers', validate(createManufacturerSchema), async (req: AuthRequest, res: Response) => {
  const { name, country } = req.body;
  const manufacturer = await prisma.manufacturer.create({ data: { name, country } });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'manufacturer', entityId: manufacturer.id, newValue: manufacturer, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(manufacturer);
});

router.put('/manufacturers/:id', validate(updateManufacturerSchema), async (req: AuthRequest, res: Response) => {
  const old = await prisma.manufacturer.findUnique({ where: { id: req.params.id as string } });
  if (!old) return res.status(404).json({ message: 'Производитель не найден' });
  const updated = await prisma.manufacturer.update({ where: { id: req.params.id as string }, data: req.body });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'manufacturer', entityId: updated.id, oldValue: old, newValue: updated, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(updated);
});

router.delete('/manufacturers/:id', async (req: AuthRequest, res: Response) => {
  const old = await prisma.manufacturer.findUnique({ where: { id: req.params.id as string } });
  if (!old) return res.status(404).json({ message: 'Производитель не найден' });
  await prisma.manufacturer.update({ where: { id: req.params.id as string }, data: { isActive: false } });
  await logAudit({ userId: req.userId, action: 'deactivate', entityType: 'manufacturer', entityId: old.id, oldValue: old, newValue: { isActive: false }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json({ message: 'Производитель деактивирован' });
});

// ─── MODELS ─────────────────────────────────────────────────

const createModelSchema = z.object({
  equipmentTypeId: z.string().uuid(),
  manufacturerId: z.string().uuid(),
  modelName: z.string().min(1),
  fullModelName: z.string().optional().nullable(),
  status: z.enum(['approved', 'pending', 'rejected']).optional(),
});

const updateModelSchema = z.object({
  equipmentTypeId: z.string().uuid().optional(),
  manufacturerId: z.string().uuid().optional(),
  modelName: z.string().min(1).optional(),
  fullModelName: z.string().optional().nullable(),
});

router.get('/models', async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const q = (req.query.q as string) || '';
  const status = (req.query.status as string) || '';
  const equipmentTypeId = (req.query.equipment_type_id as string) || '';
  const manufacturerId = (req.query.manufacturer_id as string) || '';

  const where: any = {};
  if (q) {
    where.OR = [
      { modelName: { contains: q, mode: 'insensitive' } },
      { fullModelName: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (status) where.status = status;
  if (equipmentTypeId) where.equipmentTypeId = equipmentTypeId;
  if (manufacturerId) where.manufacturerId = manufacturerId;

  const [data, total] = await Promise.all([
    prisma.model.findMany({
      where,
      include: {
        equipmentType: true,
        manufacturer: true,
        submittedBy: { select: { id: true, fullName: true, email: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.model.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

router.post('/models', validate(createModelSchema), async (req: AuthRequest, res: Response) => {
  const model = await prisma.model.create({
    data: {
      ...req.body,
      status: req.body.status || 'approved',
      submittedById: req.userId,
      submittedAt: new Date(),
    },
    include: { equipmentType: true, manufacturer: true },
  });
  await logAudit({ userId: req.userId, action: 'create', entityType: 'model', entityId: model.id, newValue: model, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(model);
});

router.put('/models/:id', validate(updateModelSchema), async (req: AuthRequest, res: Response) => {
  const old = await prisma.model.findUnique({ where: { id: req.params.id as string } });
  if (!old) return res.status(404).json({ message: 'Модель не найдена' });
  const updated = await prisma.model.update({
    where: { id: req.params.id as string },
    data: req.body,
    include: { equipmentType: true, manufacturer: true },
  });
  await logAudit({ userId: req.userId, action: 'update', entityType: 'model', entityId: updated.id, oldValue: old, newValue: updated, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(updated);
});

router.put('/models/:id/approve', async (req: AuthRequest, res: Response) => {
  const model = await prisma.model.findUnique({ where: { id: req.params.id as string } });
  if (!model) return res.status(404).json({ message: 'Модель не найдена' });
  if (model.status !== 'pending') return res.status(400).json({ message: 'Модель не на модерации' });

  const updated = await prisma.model.update({
    where: { id: req.params.id as string },
    data: { status: 'approved', reviewedById: req.userId, reviewedAt: new Date() },
    include: { equipmentType: true, manufacturer: true },
  });
  await logAudit({ userId: req.userId, action: 'approve', entityType: 'model', entityId: updated.id, oldValue: { status: 'pending' }, newValue: { status: 'approved' }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(updated);
});

router.put('/models/:id/reject', async (req: AuthRequest, res: Response) => {
  const model = await prisma.model.findUnique({ where: { id: req.params.id as string } });
  if (!model) return res.status(404).json({ message: 'Модель не найдена' });
  if (model.status !== 'pending') return res.status(400).json({ message: 'Модель не на модерации' });

  const { reason } = req.body;
  const updated = await prisma.model.update({
    where: { id: req.params.id as string },
    data: { status: 'rejected', reviewedById: req.userId, reviewedAt: new Date(), rejectionReason: reason || null },
    include: { equipmentType: true, manufacturer: true },
  });
  await logAudit({ userId: req.userId, action: 'reject', entityType: 'model', entityId: updated.id, oldValue: { status: 'pending' }, newValue: { status: 'rejected', reason }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.json(updated);
});

// ─── SYSTEM RELEASES ─────────────────────────────────────────
router.get('/system-releases', async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;

  const [data, total] = await Promise.all([
    prisma.systemRelease.findMany({
      orderBy: { deployedAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: { admin: { select: { id: true, fullName: true } } },
    }),
    prisma.systemRelease.count(),
  ]);

  res.json({ data, total, page, pageSize });
});

const systemNotificationSchema = z.object({
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  version: z.string().max(50).optional(),
});

router.post('/system-notifications', validate(systemNotificationSchema), async (req: AuthRequest, res: Response) => {
  const { title, message, version } = req.body;

  if (version) {
    const existing = await prisma.systemRelease.findUnique({ where: { version } });
    if (existing) {
      return res.status(409).json({ error: `Версия ${version} уже существует` });
    }
  }

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const release = await prisma.systemRelease.create({
    data: {
      version: version || `manual-${Date.now()}`,
      releaseNotes: message,
      deployedBy: 'admin_manual',
      adminId: req.userId,
      notificationCount: users.length,
    },
  });

  if (users.length > 0) {
    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: 'system_release',
        title,
        message,
        entityType: 'system_release',
        entityId: release.version,
      })),
    });
  }

  await logAudit({
    userId: req.userId,
    action: 'create',
    entityType: 'system_release',
    entityId: release.id,
    newValue: { version: release.version, title, recipients: users.length },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ success: true, notifications_created: users.length, release });
});

export default router;
