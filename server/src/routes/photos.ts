import { Router, Response } from 'express';
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

// POST /api/tasks/:taskId/photos
router.post('/:taskId/photos', upload.single('photo'), async (req: AuthRequest, res: Response) => {
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

  // Get task to build file name
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      visit: true,
      equipmentType: true,
      roomType: true,
    },
  });
  if (!task) { res.status(404).json({ error: 'Задача не найдена' }); return; }

  // Calculate sort order within visit
  const visitTasks = await prisma.task.findMany({
    where: { visitId: task.visitId },
    orderBy: { sortOrder: 'asc' },
  });
  const taskIndex = visitTasks.findIndex(t => t.id === taskId);
  const num = String(taskIndex + 1).padStart(2, '0');

  const equipmentCode = task.equipmentType.code;
  const roomCode = task.roomType?.code || 'unknown';
  const fileName = `${num}_${equipmentCode}_${roomCode}_${moment}.jpg`;

  // Rename file
  const oldPath = req.file.path;
  const newPath = path.join(path.dirname(oldPath), fileName);
  fs.renameSync(oldPath, newPath);

  // Delete existing photo for this moment if any
  const existing = await prisma.photo.findUnique({ where: { taskId_moment: { taskId, moment } } });
  if (existing) {
    try { fs.unlinkSync(existing.filePath); } catch { /* ignore */ }
    await prisma.photo.delete({ where: { id: existing.id } });
  }

  const photo = await prisma.photo.create({
    data: {
      taskId,
      fileName,
      filePath: newPath,
      moment,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    },
  });

  // Update task status to in_progress if not_started
  if (task.status === 'not_started') {
    await prisma.task.update({ where: { id: taskId }, data: { status: 'in_progress' } });
  }

  await logAudit({ userId: req.userId, action: 'upload_photo', entityType: 'photo', entityId: photo.id, newValue: { fileName, moment }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json(photo);
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
    await prisma.photo.delete({ where: { id: req.params.id as string } });
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
