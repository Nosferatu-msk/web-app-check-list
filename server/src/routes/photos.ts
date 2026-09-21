import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import prisma from '../models/prisma.js';
import { logAudit } from '../middleware/audit.js';
import { verifyPhoto } from '../services/photoVerification.js';
import { hammingDistance } from '../utils/phash.js';

const PHASH_DUPLICATE_THRESHOLD = 10;

const router = Router();
router.use(authMiddleware);

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Функция вычисления SHA-256 хеша файла
function computeFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

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
    const uid = crypto.randomUUID().slice(0, 8);
    const fileName = `${num}_${equipmentCode}_${roomCode}_${serial}_${moment}_${uid}.jpg`;

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

    // Вычисляем хеш файла для проверки дубликатов
    const hash = computeFileHash(newPath);

    // Проверка дубликатов: фото с таким же хешем не должно быть загружено для другой единицы в этой задаче
    const siblingItems = await prisma.taskEquipmentItem.findMany({
      where: { taskId: item.taskId, id: { not: itemId } },
      select: { id: true },
    });
    const siblingItemIds = siblingItems.map(si => si.id);
    if (siblingItemIds.length > 0) {
      const duplicatePhoto = await prisma.photo.findFirst({
        where: {
          taskEquipmentItemId: { in: siblingItemIds },
          hash,
        },
      });
      if (duplicatePhoto) {
        try { fs.unlinkSync(newPath); } catch { /* ignore */ }
        res.status(409).json({ error: 'Это фото уже загружено для другой единицы оборудования. Используйте другой файл.' });
        return;
      }
    }

    // Антифрод: метаданные от клиента
    const capturedAt = req.body.capturedAt ? new Date(req.body.capturedAt as string) : null;
    const gpsLat = req.body.gpsLat ? parseFloat(req.body.gpsLat as string) : null;
    const gpsLng = req.body.gpsLng ? parseFloat(req.body.gpsLng as string) : null;
    const photoSource = (req.body.photoSource as string) || null;

    const photo = await prisma.photo.create({
      data: {
        taskEquipmentItemId: itemId,
        fileName,
        filePath: newPath,
        moment,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        hash,
        capturedAt,
        gpsLat,
        gpsLng,
        photoSource,
      },
    });

    // Асинхронная верификация (не блокирует ответ)
    verifyPhoto(photo.id).catch(err => console.error('[photos] verifyPhoto error:', err));

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

// ─── MTR: фото для визита МТР ───────────────────────────────
// ВАЖНО: эти маршруты должны быть зарегистрированы ДО /:taskId/photos,
// иначе Express перехватит "mtr-visits" как :taskId
router.post('/mtr-visits/:visitId/photos', upload.single('photo'), handleMulterError, async (req: AuthRequest, res: Response) => {
  try {
    const visitId = req.params.visitId as string;
    const moment = req.body.moment as 'before' | 'after';
    if (!moment || !['before', 'after'].includes(moment)) {
      res.status(400).json({ error: 'Укажите moment: before или after' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    const visit = await prisma.mtrVisit.findUnique({
      where: { id: visitId },
      include: { address: true },
    });
    if (!visit) {
      res.status(404).json({ error: 'Визит МТР не найден' });
      return;
    }

    if (req.userRole === 'engineer_mtr' && visit.engineerId !== req.userId) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }

    const fileName = `mtr_${visit.requestNumber}_${moment}_${Date.now()}.jpg`;
    const oldPath = req.file.path;
    const newPath = path.join(path.dirname(oldPath), fileName);
    fs.renameSync(oldPath, newPath);

    // Вычисляем хеш файла для проверки дубликатов
    const hash = computeFileHash(newPath);

    // Антифрод: метаданные от клиента
    const capturedAt = req.body.capturedAt ? new Date(req.body.capturedAt as string) : null;
    const gpsLat = req.body.gpsLat ? parseFloat(req.body.gpsLat as string) : null;
    const gpsLng = req.body.gpsLng ? parseFloat(req.body.gpsLng as string) : null;
    const photoSource = (req.body.photoSource as string) || null;

    const photo = await prisma.photo.create({
      data: {
        mtrVisitId: visitId,
        fileName,
        filePath: newPath,
        moment,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        hash,
        capturedAt,
        gpsLat,
        gpsLng,
        photoSource,
      },
    });

    // Асинхронная верификация (не блокирует ответ)
    verifyPhoto(photo.id).catch(err => console.error('[photos] verifyPhoto error:', err));

    await logAudit({
      userId: req.userId,
      action: 'upload_photo',
      entityType: 'photo',
      entityId: photo.id,
      newValue: { fileName, moment, mtrVisitId: visitId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json(photo);
  } catch (err) {
    console.error('Upload MTR visit photo error:', err);
    res.status(500).json({ error: 'Ошибка загрузки фото' });
  }
});

router.get('/mtr-visits/:visitId/photos', async (req: AuthRequest, res: Response) => {
  const photos = await prisma.photo.findMany({
    where: { mtrVisitId: req.params.visitId as string },
  });
  res.json(photos);
});

router.delete('/mtr-visits/:visitId/photos/:photoId', async (req: AuthRequest, res: Response) => {
  const photo = await prisma.photo.findUnique({ where: { id: req.params.photoId as string } });
  if (!photo || photo.mtrVisitId !== req.params.visitId) {
    res.status(404).json({ error: 'Фото не найдено' });
    return;
  }

  const visit = await prisma.mtrVisit.findUnique({ where: { id: req.params.visitId as string } });
  if (!visit) {
    res.status(404).json({ error: 'Визит МТР не найден' });
    return;
  }
  if (req.userRole === 'engineer_mtr' && visit.engineerId !== req.userId) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }
  if (visit.status !== 'draft' && visit.status !== 'in_progress') {
    res.status(400).json({ error: 'Можно удалять фото только в визиты в статусе «Черновик» или «В работе»' });
    return;
  }

  try { fs.unlinkSync(photo.filePath); } catch { /* ignore */ }
  await prisma.photo.delete({ where: { id: photo.id } });

  await logAudit({
    userId: req.userId,
    action: 'delete_photo',
    entityType: 'photo',
    entityId: photo.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json({ message: 'Фото удалено' });
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
    const uid = crypto.randomUUID().slice(0, 8);
    const fileName = `${num}_${equipmentCode}_${roomCode}_${moment}_${uid}.jpg`;

    const oldPath = req.file.path;
    const newPath = path.join(path.dirname(oldPath), fileName);
    fs.renameSync(oldPath, newPath);

    const existing = await prisma.photo.findUnique({ where: { taskId_moment: { taskId, moment } } });
    if (existing) {
      try { fs.unlinkSync(existing.filePath); } catch { /* ignore */ }
      await prisma.photo.delete({ where: { id: existing.id } });
    }

    // Вычисляем хеш файла для проверки дубликатов
    const hash = computeFileHash(newPath);

    // Проверка дубликатов: фото с таким же хешем не должно быть загружено для другой задачи в этом визите
    const visitTaskIds = visitTasks.filter(t => t.id !== taskId).map(t => t.id);
    if (visitTaskIds.length > 0) {
      const duplicatePhoto = await prisma.photo.findFirst({
        where: {
          taskId: { in: visitTaskIds },
          hash,
        },
      });
      if (duplicatePhoto) {
        try { fs.unlinkSync(newPath); } catch { /* ignore */ }
        res.status(409).json({ error: 'Это фото уже загружено для другой задачи в этом визите. Используйте другой файл.' });
        return;
      }
    }

    // Антифрод: метаданные от клиента
    const capturedAt = req.body.capturedAt ? new Date(req.body.capturedAt as string) : null;
    const gpsLat = req.body.gpsLat ? parseFloat(req.body.gpsLat as string) : null;
    const gpsLng = req.body.gpsLng ? parseFloat(req.body.gpsLng as string) : null;
    const photoSource = (req.body.photoSource as string) || null;

    const photo = await prisma.photo.create({
      data: {
        taskId, fileName, filePath: newPath, moment,
        fileSize: req.file.size, mimeType: req.file.mimetype, hash,
        capturedAt, gpsLat, gpsLng, photoSource,
      },
    });

    // Асинхронная верификация (не блокирует ответ)
    verifyPhoto(photo.id).catch(err => console.error('[photos] verifyPhoto error:', err));

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

// POST /api/photos/check-duplicate — проверка дубликата фото по хешу
router.post('/check-duplicate', async (req: AuthRequest, res: Response) => {
  const { hash } = req.body;
  if (!hash) {
    res.status(400).json({ error: 'Укажите hash файла' });
    return;
  }

  // Ищем фото с таким же хешем
  const existingPhoto = await prisma.photo.findFirst({
    where: { hash },
    include: {
      task: {
        include: {
          visit: {
            include: { address: true, user: { select: { fullName: true } } },
          },
          equipmentType: true,
          objectEquipment: true,
        },
      },
      taskEquipmentItem: {
        include: {
          objectEquipment: true,
        },
      },
      mtrVisit: {
        include: {
          address: true,
          engineer: { select: { fullName: true } },
        },
      },
    },
  });

  if (!existingPhoto) {
    res.json({ isDuplicate: false });
    return;
  }

  // Формируем информацию о существующем фото
  let info: any = {
    isDuplicate: true,
    photoId: existingPhoto.id,
    fileName: existingPhoto.fileName,
    createdAt: existingPhoto.createdAt,
  };

  if (existingPhoto.task) {
    info.type = 'visit';
    info.visitId = existingPhoto.task.visit.id;
    info.address = existingPhoto.task.visit.address.fullAddress;
    info.engineer = existingPhoto.task.visit.user?.fullName;
    info.equipmentType = existingPhoto.task.equipmentType?.name;
    info.serialNumber = existingPhoto.task.objectEquipment?.serialNumber;
  } else if (existingPhoto.taskEquipmentItem) {
    info.type = 'visit';
    const task = await prisma.task.findUnique({
      where: { id: existingPhoto.taskEquipmentItem.taskId },
      include: {
        visit: { include: { address: true, user: { select: { fullName: true } } } },
        equipmentType: true,
      },
    });
    if (task) {
      info.visitId = task.visit.id;
      info.address = task.visit.address.fullAddress;
      info.engineer = task.visit.user?.fullName;
      info.equipmentType = task.equipmentType?.name;
      info.serialNumber = existingPhoto.taskEquipmentItem.objectEquipment?.serialNumber;
    }
  } else if (existingPhoto.mtrVisit) {
    info.type = 'mtr';
    info.mtrVisitId = existingPhoto.mtrVisit.id;
    info.address = existingPhoto.mtrVisit.address.fullAddress;
    info.engineer = existingPhoto.mtrVisit.engineer?.fullName;
    info.requestNumber = existingPhoto.mtrVisit.requestNumber;
  }

  res.json(info);
});

// GET /api/photos/:id/detail — детали фото для модалки сравнения
router.get('/:id/detail', async (req: AuthRequest, res: Response) => {
  try {
    const photo: any = await prisma.photo.findUnique({
      where: { id: req.params.id as string },
      include: {
        task: { include: { visit: { include: { user: true } }, equipmentType: true } },
        taskEquipmentItem: { include: { objectEquipment: true, task: { include: { visit: { include: { user: true } } } } } },
        mtrVisit: { include: { engineer: true } },
      },
    });
    if (!photo) { res.status(404).json({ error: 'Фото не найдено' }); return; }

    const result: any = { id: photo.id, fileName: photo.fileName, moment: photo.moment };

    if (photo.task?.visit) {
      result.engineerName = photo.task.visit.engineerName || photo.task.visit.user?.fullName;
      result.visitDate = photo.task.visit.dateStart?.toISOString().split('T')[0];
      result.equipmentType = photo.task.equipmentType?.name || '';
    } else if (photo.taskEquipmentItem?.task?.visit) {
      result.engineerName = photo.taskEquipmentItem.task.visit.engineerName || photo.taskEquipmentItem.task.visit.user?.fullName;
      result.visitDate = photo.taskEquipmentItem.task.visit.dateStart?.toISOString().split('T')[0];
      result.equipmentType = photo.taskEquipmentItem.objectEquipment?.equipmentTypeCode || '';
    } else if (photo.mtrVisit) {
      result.engineerName = photo.mtrVisit.engineer?.fullName;
      result.visitDate = photo.mtrVisit.dateStart?.toISOString().split('T')[0];
      result.equipmentType = 'МТР';
    }

    res.json(result);
  } catch (err) {
    console.error('[photos] getPhotoDetail error:', err);
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
});

// GET /api/photos/:id/duplicates — все дубликаты фото по pHash
router.get('/:id/duplicates', async (req: AuthRequest, res: Response) => {
  try {
    const photo = await prisma.photo.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, phash: true, moment: true },
    });
    if (!photo || !photo.phash) {
      res.json({ current: null, duplicates: [] });
      return;
    }

    const allPhotos = await prisma.photo.findMany({
      where: {
        id: { not: photo.id },
        phash: { not: null },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      include: {
        task: { include: { visit: { include: { address: true, user: { select: { fullName: true } } } }, equipmentType: true } },
        taskEquipmentItem: { include: { objectEquipment: true, task: { include: { visit: { include: { address: true, user: { select: { fullName: true } } } } } } } },
      },
      take: 200,
    });

    const matches: Array<{ photoId: string; distance: number; similarity: number }> = [];
    for (const p of allPhotos) {
      if (!p.phash) continue;
      const dist = hammingDistance(photo.phash, p.phash);
      if (dist <= PHASH_DUPLICATE_THRESHOLD) {
        matches.push({ photoId: p.id, distance: dist, similarity: Math.round((1 - dist / 64) * 100) });
      }
    }
    matches.sort((a, b) => a.distance - b.distance);

    const formatInfo = (p: any, dist: number, sim: number, isCurrent: boolean) => {
      const info: any = { photoId: p.id, hammingDistance: dist, similarityPercent: sim, isCurrent, moment: p.moment };
      if (p.task?.visit) {
        info.visitCode = p.task.visit.address?.objectCode || '';
        info.address = p.task.visit.address?.fullAddress || '';
        info.engineerName = p.task.visit.user?.fullName || '';
        info.equipmentType = p.task.equipmentType?.name || '';
        info.visitDate = p.task.visit.dateStart?.toISOString().split('T')[0] || '';
        info.visitId = p.task.visit.id;
      } else if (p.taskEquipmentItem?.task?.visit) {
        info.visitCode = p.taskEquipmentItem.task.visit.address?.objectCode || '';
        info.address = p.taskEquipmentItem.task.visit.address?.fullAddress || '';
        info.engineerName = p.taskEquipmentItem.task.visit.user?.fullName || '';
        info.equipmentType = p.taskEquipmentItem.objectEquipment?.equipmentTypeCode || '';
        info.visitDate = p.taskEquipmentItem.task.visit.dateStart?.toISOString().split('T')[0] || '';
        info.visitId = p.taskEquipmentItem.task.visit.id;
      }
      return info;
    };

    const currentPhoto: any = await prisma.photo.findUnique({
      where: { id: photo.id },
      include: {
        task: { include: { visit: { include: { address: true, user: { select: { fullName: true } } } }, equipmentType: true } },
        taskEquipmentItem: { include: { objectEquipment: true, task: { include: { visit: { include: { address: true, user: { select: { fullName: true } } } } } } } },
      },
    });

    const current = currentPhoto ? formatInfo(currentPhoto, 0, 100, true) : null;

    const duplicates = matches.map(m => {
      const p = allPhotos.find(x => x.id === m.photoId);
      if (!p) return null;
      return formatInfo(p, m.distance, m.similarity, false);
    }).filter(Boolean);

    res.json({ current, duplicates });
  } catch (err) {
    console.error('[photos] getPhotoDuplicates error:', err);
    res.status(500).json({ error: 'Ошибка получения дубликатов' });
  }
});

export default router;
