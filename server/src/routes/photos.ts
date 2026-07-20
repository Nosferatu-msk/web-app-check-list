import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import prisma from '../models/prisma.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authMiddleware);

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Допустимы только изображения'));
  },
});

function handleMulterError(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Файл слишком большой (макс. 10 МБ)' });
    } else {
      res.status(400).json({ error: err.message });
    }
    return;
  }
  next(err);
}

// POST /api/tasks/items/:itemId/photos — загрузка фото для единицы в групповой задаче
// ВАЖНО: этот маршрут должен быть зарегистрирован ДО /:taskId/photos,
// иначе Express перехватит "items" как :taskId
router.post('/items/:itemId/photos', upload.single('photo'), handleMulterError, async (req: AuthRequest, res: Response) => {
  try {
    const itemId = req.params.itemId as string;
    const moment = req.body.moment as 'before' | 'after';
    if (!moment || !['before', 'after'].includes(moment)) {
      res.status(400).json({ error: 'Укажите moment: before или after' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    const item = await prisma.taskEquipmentItem.findUnique({
      where: { id: itemId },
      include: {
        task: { include: { visit: true, equipmentType: true } },
        objectEquipment: true,
      },
    });
    if (!item) { res.status(404).json({ error: 'Единица оборудования не найдена' }); return; }

    const visit = item.task.visit;
    const visitTasks = await prisma.task.findMany({
      where: { visitId: visit.id },
      orderBy: { sortOrder: 'asc' },
    });
    const taskIndex = visitTasks.findIndex(t => t.id === item.taskId);
    const num = String(taskIndex + 1).padStart(2, '0');

    const equipmentCode = item.objectEquipment.equipmentTypeCode;
    const roomCode = item.objectEquipment.roomTypeCode || 'object';
    const serial = (item.objectEquipment.serialNumber || 'nosn').replace(/[\/\\]/g, '_');
    const fileName = `${num}_${equipmentCode}_${roomCode}_${serial}_${moment}.jpg`;

    const oldPath = req.file.path;
    const newPath = path.join(path.dirname(oldPath), fileName);
    fs.renameSync(oldPath, newPath);

    const existing = await prisma.photo.findFirst({
      where: { taskEquipmentItemId: itemId, moment },
    });
    if (existing) {
      try { fs.unlinkSync(existing.filePath); } catch { /* ignore */ }
      await prisma.photo.delete({ where: { id: existing.id } });
    }

    const photo = await prisma.photo.create({
      data: {
        taskEquipmentItemId: itemId,
        fileName,
        filePath: newPath,
        moment,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      },
    });

    if (!item.status) {
      await prisma.taskEquipmentItem.update({
        where: { id: itemId },
        data: { status: 'ok' },
      });
    }
    const task = await prisma.task.findUnique({ where: { id: item.taskId } });
    if (task && task.status === 'not_started') {
      await prisma.task.update({ where: { id: item.taskId }, data: { status: 'in_progress' } });
    }

    await logAudit({ userId: req.userId, action: 'upload_photo', entityType: 'photo', entityId: photo.id, newValue: { fileName, moment, taskEquipmentItemId: itemId }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json(photo);
  } catch (err) {
    console.error('Upload item photo error:', err);
    res.status(500).json({ error: 'Ошибка загрузки фото' });
  }
});

// POST /api/tasks/:taskId/photos — загрузка фото для индивидуальной задачи
router.post('/:taskId/photos', upload.single('photo'), handleMulterError, async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.taskId as string;
    const moment = req.body.moment as 'before' | 'after';
    if (!moment || !['before', 'after'].includes(moment)) {
      res.status(400).json({ error: 'Укажите moment: before или after' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { visit: true, equipmentType: true, roomType: true },
    });
    if (!task) { res.status(404).json({ error: 'Задача не найдена' }); return; }

    const visitTasks = await prisma.task.findMany({
      where: { visitId: task.visitId },
      orderBy: { sortOrder: 'asc' },
    });
    const taskIndex = visitTasks.findIndex(t => t.id === taskId);
    const num = String(taskIndex + 1).padStart(2, '0');

    const equipmentCode = task.equipmentType.code;
    const roomCode = (task.roomType?.code || 'unknown').replace(/[\/\\]/g, '_');
    const fileName = `${num}_${equipmentCode}_${roomCode}_${moment}.jpg`;

    const oldPath = req.file.path;
    const newPath = path.join(path.dirname(oldPath), fileName);
    fs.renameSync(oldPath, newPath);

    const existing = await prisma.photo.findUnique({ where: { taskId_moment: { taskId, moment } } });
    if (existing) {
      try { fs.unlinkSync(existing.filePath); } catch { /* ignore */ }
      await prisma.photo.delete({ where: { id: existing.id } });
    }

    const photo = await prisma.photo.create({
      data: { taskId, fileName, filePath: newPath, moment, fileSize: req.file.size, mimeType: req.file.mimetype },
    });

    if (task.status === 'not_started') {
      await prisma.task.update({ where: { id: taskId }, data: { status: 'in_progress' } });
    }

    await logAudit({ userId: req.userId, action: 'upload_photo', entityType: 'photo', entityId: photo.id, newValue: { fileName, moment }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.status(201).json(photo);
  } catch (err) {
    console.error('Upload task photo error:', err);
    res.status(500).json({ error: 'Ошибка загрузки фото' });
  }
});

// GET /api/tasks/:taskId/photos
router.get('/:taskId/photos', async (req: AuthRequest, res: Response) => {
  const photos = await prisma.photo.findMany({ where: { taskId: req.params.taskId as string } });
  res.json(photos);
});

// DELETE /api/photos/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const photo = await prisma.photo.findUnique({ where: { id: req.params.id as string } });
  if (photo) {
    try { fs.unlinkSync(photo.filePath); } catch { /* ignore */ }
    await prisma.photo.delete({ where: { id: photo.id } });
  }
  res.json({ message: 'Фото удалено' });
});

// GET /api/photos/:id/file — serve photo file
router.get('/:id/file', async (req: AuthRequest, res: Response) => {
  const photo = await prisma.photo.findUnique({ where: { id: req.params.id as string } });
  if (!photo) { res.status(404).json({ error: 'Фото не найдено' }); return; }
  if (!fs.existsSync(photo.filePath)) { res.status(404).json({ error: 'Файл не найден' }); return; }
  res.sendFile(path.resolve(photo.filePath));
});

export default router;
