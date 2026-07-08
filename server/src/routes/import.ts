import { Router, Response } from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import prisma from '../models/prisma.js';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authMiddleware, adminOnly);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) cb(null, true);
    else cb(new Error('Только CSV файлы'));
  },
});

interface CsvRow { [key: string]: string }

function parseCsv(buffer: Buffer): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CsvRow[] = [];
    const stream = Readable.from(buffer);
    stream.pipe(csv({ separator: undefined, mapHeaders: ({ header }) => header.trim() }))
      .on('data', (row: CsvRow) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function detectSeparator(buffer: Buffer): string {
  const firstLine = buffer.toString('utf-8').split('\n')[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

function parseCsvWithSeparator(buffer: Buffer, sep: string): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CsvRow[] = [];
    const stream = Readable.from(buffer);
    stream.pipe(csv({ separator: sep, mapHeaders: ({ header }) => header.trim() }))
      .on('data', (row: CsvRow) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function parseUploadedCsv(req: any): Promise<{ rows: CsvRow[]; fileName: string }> {
  const file = req.file;
  if (!file) throw new Error('Файл не загружен');
  const sep = detectSeparator(file.buffer);
  const rows = await parseCsvWithSeparator(file.buffer, sep);
  return { rows, fileName: file.originalname };
}

interface ImportResult {
  total: number;
  success: number;
  duplicates: number;
  errors: { row: number; message: string }[];
}

// ─── ADDRESSES ───────────────────────────────────────────────
router.post('/addresses', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows, fileName } = await parseUploadedCsv(req);
    const result: ImportResult = { total: rows.length, success: 0, duplicates: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const fullAddress = r.full_address || r.fullAddress || r['полный адрес'];
      if (!fullAddress) { result.errors.push({ row: i + 2, message: 'Не заполнен full_address' }); continue; }

      const existing = await prisma.address.findFirst({ where: { fullAddress } });
      if (existing) { result.duplicates++; continue; }

      let customerEmail = r.customer_email || r.customerEmail || r['email заказчика'] || null;
      if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        result.errors.push({ row: i + 2, message: `Некорректный email: ${customerEmail}` });
        customerEmail = null;
      }

      await prisma.address.create({
        data: {
          city: r.city || r['город'] || '',
          street: r.street || r['улица'] || '',
          house: r.house || r['дом'] || '',
          building: r.building || r['строение'] || null,
          fullAddress,
          customerEmail,
        },
      });
      result.success++;
    }

    await prisma.importLog.create({
      data: { userId: req.userId!, entityType: 'addresses', fileName, totalRows: result.total, successRows: result.success, duplicateRows: result.duplicates, errorRows: result.errors.length, errors: result.errors.length ? result.errors : undefined },
    });
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── EQUIPMENT TYPES ─────────────────────────────────────────
router.post('/equipment-types', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows, fileName } = await parseUploadedCsv(req);
    const result: ImportResult = { total: rows.length, success: 0, duplicates: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const code = r.code || r['код'];
      const name = r.name || r['название'] || r['наименование'];
      if (!code || !name) { result.errors.push({ row: i + 2, message: 'Не заполнены code или name' }); continue; }

      const photosRequired = parseInt(r.photos_required || r.photosRequired || '1');
      if (photosRequired < 1 || photosRequired > 2) { result.errors.push({ row: i + 2, message: 'photos_required должен быть 1 или 2' }); continue; }

      const existing = await prisma.equipmentType.findUnique({ where: { code } });
      if (existing) { result.duplicates++; continue; }

      await prisma.equipmentType.create({
        data: { name, code, photosRequired, isActive: (r.is_active || r.isActive || 'true').toLowerCase() === 'true' },
      });
      result.success++;
    }

    await prisma.importLog.create({
      data: { userId: req.userId!, entityType: 'equipment_types', fileName, totalRows: result.total, successRows: result.success, duplicateRows: result.duplicates, errorRows: result.errors.length, errors: result.errors.length ? result.errors : undefined },
    });
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── ROOM TYPES ──────────────────────────────────────────────
router.post('/room-types', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows, fileName } = await parseUploadedCsv(req);
    const result: ImportResult = { total: rows.length, success: 0, duplicates: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const code = r.code || r['код'];
      const name = r.name || r['название'];
      if (!code || !name) { result.errors.push({ row: i + 2, message: 'Не заполнены code или name' }); continue; }

      const existing = await prisma.roomType.findUnique({ where: { code } });
      if (existing) { result.duplicates++; continue; }

      await prisma.roomType.create({ data: { name, code } });
      result.success++;
    }

    await prisma.importLog.create({
      data: { userId: req.userId!, entityType: 'room_types', fileName, totalRows: result.total, successRows: result.success, duplicateRows: result.duplicates, errorRows: result.errors.length, errors: result.errors.length ? result.errors : undefined },
    });
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── RECOMMENDATIONS ─────────────────────────────────────────
router.post('/recommendations', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows, fileName } = await parseUploadedCsv(req);
    const result: ImportResult = { total: rows.length, success: 0, duplicates: 0, errors: [] };
    const eqTypes = await prisma.equipmentType.findMany();
    const eqMap = new Map(eqTypes.map(e => [e.code, e.id]));

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const equipmentCode = r.equipment_code || r.equipmentCode || r['код оборудования'];
      const text = r.text || r['текст'] || r['рекомендация'];
      if (!equipmentCode || !text) { result.errors.push({ row: i + 2, message: 'Не заполнены equipment_code или text' }); continue; }

      const eqId = eqMap.get(equipmentCode);
      if (!eqId) { result.errors.push({ row: i + 2, message: `Тип оборудования не найден: ${equipmentCode}` }); continue; }

      const sortOrder = parseInt(r.sort_order || r.sortOrder || '0') || 0;
      const isActive = (r.is_active || r.isActive || 'true').toLowerCase() !== 'false';

      await prisma.recommendation.create({
        data: { equipmentTypeId: eqId, text: text.substring(0, 500), sortOrder, isActive },
      });
      result.success++;
    }

    await prisma.importLog.create({
      data: { userId: req.userId!, entityType: 'recommendations', fileName, totalRows: result.total, successRows: result.success, duplicateRows: result.duplicates, errorRows: result.errors.length, errors: result.errors.length ? result.errors : undefined },
    });
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── USERS ───────────────────────────────────────────────────
router.post('/users', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows, fileName } = await parseUploadedCsv(req);
    const result: ImportResult = { total: rows.length, success: 0, duplicates: 0, errors: [] };
    const TEMP_PASSWORD = 'Welcome2026!';

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const email = (r.email || r['email']).toLowerCase().trim();
      const fullName = r.full_name || r.fullName || r['фио'] || r['ФИО'];
      const role = r.role || r['роль'];
      if (!email || !fullName) { result.errors.push({ row: i + 2, message: 'Не заполнены email или full_name' }); continue; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { result.errors.push({ row: i + 2, message: `Некорректный email: ${email}` }); continue; }
      if (!['engineer', 'tm', 'admin'].includes(role)) { result.errors.push({ row: i + 2, message: `Недопустимая роль: ${role}` }); continue; }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) { result.duplicates++; continue; }

      const password = r.password || r['пароль'] || TEMP_PASSWORD;
      const passwordHash = await bcrypt.hash(password, 12);

      await prisma.user.create({
        data: { fullName, email, passwordHash, role: role as any, mustChangePassword: !r.password },
      });
      result.success++;

      // If engineer with tm_email, create tm_engineer link
      if (role === 'engineer') {
        const tmEmail = (r.tm_email || r.tmEmail || '').toLowerCase().trim();
        if (tmEmail) {
          const tm = await prisma.user.findUnique({ where: { email: tmEmail } });
          if (tm && tm.role === 'tm') {
            const engineer = await prisma.user.findUnique({ where: { email } });
            if (engineer) {
              await prisma.tmEngineer.upsert({
                where: { engineerId: engineer.id },
                update: { tmId: tm.id },
                create: { tmId: tm.id, engineerId: engineer.id },
              });
            }
          }
        }
      }
    }

    await prisma.importLog.create({
      data: { userId: req.userId!, entityType: 'users', fileName, totalRows: result.total, successRows: result.success, duplicateRows: result.duplicates, errorRows: result.errors.length, errors: result.errors.length ? result.errors : undefined },
    });
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── TM OBJECTS ──────────────────────────────────────────────
router.post('/tm-objects', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows, fileName } = await parseUploadedCsv(req);
    const result: ImportResult = { total: rows.length, success: 0, duplicates: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const objectCode = r.object_code || r.objectCode || r['код объекта'];
      const tmEmail = (r.tm_email || r.tmEmail || r['email тм']).toLowerCase().trim();
      if (!objectCode || !tmEmail) { result.errors.push({ row: i + 2, message: 'Не заполнены object_code или tm_email' }); continue; }

      const tm = await prisma.user.findUnique({ where: { email: tmEmail } });
      if (!tm || tm.role !== 'tm') { result.errors.push({ row: i + 2, message: `ТМ не найден: ${tmEmail}` }); continue; }

      const address = await prisma.address.findFirst({ where: { fullAddress: { contains: objectCode } } });
      if (!address) {
        const addrByCode = await prisma.address.findFirst({ where: { fullAddress: objectCode } });
        if (!addrByCode) { result.errors.push({ row: i + 2, message: `Адрес не найден по коду: ${objectCode}` }); continue; }
      }
      const addr = address || (await prisma.address.findFirst({ where: { fullAddress: objectCode } }))!;

      const existing = await prisma.tmObject.findFirst({ where: { tmId: tm.id, addressId: addr.id } });
      if (existing) { result.duplicates++; continue; }

      await prisma.tmObject.create({ data: { tmId: tm.id, addressId: addr.id } });
      result.success++;
    }

    await prisma.importLog.create({
      data: { userId: req.userId!, entityType: 'tm_objects', fileName, totalRows: result.total, successRows: result.success, duplicateRows: result.duplicates, errorRows: result.errors.length, errors: result.errors.length ? result.errors : undefined },
    });
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── TM ENGINEERS ────────────────────────────────────────────
router.post('/tm-engineers', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows, fileName } = await parseUploadedCsv(req);
    const result: ImportResult = { total: rows.length, success: 0, duplicates: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const engineerEmail = (r.engineer_email || r.engineerEmail || r['email инженера']).toLowerCase().trim();
      const tmEmail = (r.tm_email || r.tmEmail || r['email тм']).toLowerCase().trim();
      if (!engineerEmail || !tmEmail) { result.errors.push({ row: i + 2, message: 'Не заполнены engineer_email или tm_email' }); continue; }

      const engineer = await prisma.user.findUnique({ where: { email: engineerEmail } });
      if (!engineer || engineer.role !== 'engineer') { result.errors.push({ row: i + 2, message: `Инженер не найден: ${engineerEmail}` }); continue; }

      const tm = await prisma.user.findUnique({ where: { email: tmEmail } });
      if (!tm || tm.role !== 'tm') { result.errors.push({ row: i + 2, message: `ТМ не найден: ${tmEmail}` }); continue; }

      const existing = await prisma.tmEngineer.findUnique({ where: { engineerId: engineer.id } });
      if (existing) { result.duplicates++; continue; }

      await prisma.tmEngineer.create({ data: { tmId: tm.id, engineerId: engineer.id } });
      result.success++;
    }

    await prisma.importLog.create({
      data: { userId: req.userId!, entityType: 'tm_engineers', fileName, totalRows: result.total, successRows: result.success, duplicateRows: result.duplicates, errorRows: result.errors.length, errors: result.errors.length ? result.errors : undefined },
    });
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
