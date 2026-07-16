import { Router, Response } from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import prisma from '../models/prisma.js';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import iconv from 'iconv-lite';
import { sendMail } from '../utils/email.js';

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

function decodeBuffer(buffer: Buffer): string {
  // Check for UTF-8 BOM
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.toString('utf-8').replace(/^\uFEFF/, '');
  }
  // Check for UTF-16 LE BOM
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return iconv.decode(buffer, 'utf-16le');
  }
  // Try UTF-8 first
  const utf8Text = buffer.toString('utf-8');
  // If it contains replacement characters, it's likely not valid UTF-8
  if (utf8Text.includes('\uFFFD')) {
    return iconv.decode(buffer, 'win1251');
  }
  return utf8Text;
}

function detectSeparator(buffer: Buffer): string {
  const firstLine = decodeBuffer(buffer).split('\n')[0] || '';
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
  const decodedText = decodeBuffer(file.buffer);
  const decodedBuffer = Buffer.from(decodedText, 'utf-8');
  const sep = detectSeparator(decodedBuffer);
  const rows = await parseCsvWithSeparator(decodedBuffer, sep);
  if (rows.length > 20000) {
    throw new Error('Файл содержит более 20 000 строк. Разбейте файл на части.');
  }
  return { rows, fileName: file.originalname };
}

interface ImportResult {
  total: number;
  success: number;
  duplicates: number;
  errors: { row: number; message: string }[];
}

interface ValidateResult {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  errorRows: number;
  duplicates: { row: number; value: string }[];
  errors: { row: number; message: string }[];
}

function isValidateMode(req: any): boolean {
  return req.query.mode === 'validate';
}

// ─── ADDRESSES ───────────────────────────────────────────────
router.post('/addresses', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows, fileName } = await parseUploadedCsv(req);
    const result: ImportResult = { total: rows.length, success: 0, duplicates: 0, errors: [] };
    const dupRows: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const fullAddress = r.full_address || r.fullAddress || r['полный адрес'];
      if (!fullAddress) { result.errors.push({ row: i + 2, message: 'Не заполнен full_address' }); continue; }

      const existing = await prisma.address.findFirst({ where: { fullAddress } });
      if (existing) { result.duplicates++; dupRows.push(i + 2); continue; }

      let customerEmail = r.customer_email || r.customerEmail || r['email заказчика'] || null;
      if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        result.errors.push({ row: i + 2, message: `Некорректный email: ${customerEmail}` });
        customerEmail = null;
      }

      const validateMode = isValidateMode(req);
      if (validateMode) continue;

      await prisma.address.create({
        data: {
          city: r.city || r['город'] || '',
          street: r.street || r['улица'] || '',
          house: r.house || r['дом'] || '',
          building: r.building || r['строение'] || null,
          fullAddress,
          customerEmail,
          objectCode: r.object_code || r.objectCode || r['код объекта'] || null,
        },
      });
      result.success++;
    }

    if (isValidateMode(req)) {
      const vr: ValidateResult = {
        totalRows: rows.length,
        validRows: rows.length - result.errors.length - result.duplicates,
        duplicateRows: result.duplicates,
        errorRows: result.errors.length,
        duplicates: dupRows.map(row => ({ row, value: rows[row - 2]?.full_address || rows[row - 2]?.fullAddress || rows[row - 2]?.['полный адрес'] || '' })),
        errors: result.errors,
      };
      return res.json(vr);
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
    const dupRows: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const code = r.code || r['код'];
      const name = r.name || r['название'] || r['наименование'];
      if (!code || !name) { result.errors.push({ row: i + 2, message: 'Не заполнены code или name' }); continue; }

      const photosRequired = parseInt(r.photos_required || r.photosRequired || '1');
      if (photosRequired < 1 || photosRequired > 2) { result.errors.push({ row: i + 2, message: 'photos_required должен быть 1 или 2' }); continue; }

      const existing = await prisma.equipmentType.findUnique({ where: { code } });
      if (existing) { result.duplicates++; dupRows.push(i + 2); continue; }

      if (isValidateMode(req)) continue;

      await prisma.equipmentType.create({
        data: { name, code, photosRequired, isActive: (r.is_active || r.isActive || 'true').toLowerCase() === 'true' },
      });
      result.success++;
    }

    if (isValidateMode(req)) {
      const vr: ValidateResult = {
        totalRows: rows.length,
        validRows: rows.length - result.errors.length - result.duplicates,
        duplicateRows: result.duplicates,
        errorRows: result.errors.length,
        duplicates: dupRows.map(row => ({ row, value: rows[row - 2]?.code || rows[row - 2]?.['код'] || '' })),
        errors: result.errors,
      };
      return res.json(vr);
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
    const dupRows: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const code = r.code || r['код'];
      const name = r.name || r['название'];
      if (!code || !name) { result.errors.push({ row: i + 2, message: 'Не заполнены code или name' }); continue; }

      const existing = await prisma.roomType.findUnique({ where: { code } });
      if (existing) { result.duplicates++; dupRows.push(i + 2); continue; }

      if (isValidateMode(req)) continue;

      await prisma.roomType.create({ data: { name, code } });
      result.success++;
    }

    if (isValidateMode(req)) {
      const vr: ValidateResult = {
        totalRows: rows.length,
        validRows: rows.length - result.errors.length - result.duplicates,
        duplicateRows: result.duplicates,
        errorRows: result.errors.length,
        duplicates: dupRows.map(row => ({ row, value: rows[row - 2]?.code || rows[row - 2]?.['код'] || '' })),
        errors: result.errors,
      };
      return res.json(vr);
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
    const dupRows: number[] = [];
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

      if (isValidateMode(req)) continue;

      await prisma.recommendation.create({
        data: { equipmentTypeId: eqId, text: text.substring(0, 500), sortOrder, isActive },
      });
      result.success++;
    }

    if (isValidateMode(req)) {
      const vr: ValidateResult = {
        totalRows: rows.length,
        validRows: rows.length - result.errors.length - result.duplicates,
        duplicateRows: result.duplicates,
        errorRows: result.errors.length,
        duplicates: [],
        errors: result.errors,
      };
      return res.json(vr);
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
    const dupRows: number[] = [];
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
      if (existing) { result.duplicates++; dupRows.push(i + 2); continue; }

      const password = r.password || r['пароль'] || TEMP_PASSWORD;
      const passwordHash = await bcrypt.hash(password, 12);

      if (isValidateMode(req)) continue;

      const mustChange = !r.password;
      await prisma.user.create({
        data: { fullName, email, passwordHash, role: role as any, mustChangePassword: mustChange },
      });
      result.success++;

      // Send credentials email when a temporary password was generated
      if (mustChange) {
        try {
          await sendMail({
            to: email,
            subject: 'Доступ к системе «Чек-лист инженера»',
            text: `Ваши учётные данные:\n\nЛогин: ${email}\nПароль: ${password}\n\nПри первом входе система предложит сменить пароль.\n\nСсылка для входа: ${process.env.CLIENT_URL}`,
          });
        } catch (mailErr) {
          console.error(`Failed to send credentials email to ${email}:`, mailErr);
        }
      }

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

    if (isValidateMode(req)) {
      const vr: ValidateResult = {
        totalRows: rows.length,
        validRows: rows.length - result.errors.length - result.duplicates,
        duplicateRows: result.duplicates,
        errorRows: result.errors.length,
        duplicates: dupRows.map(row => ({ row, value: rows[row - 2]?.email || '' })),
        errors: result.errors,
      };
      return res.json(vr);
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
    const dupRows: number[] = [];

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
      if (existing) { result.duplicates++; dupRows.push(i + 2); continue; }

      if (isValidateMode(req)) continue;

      await prisma.tmObject.create({ data: { tmId: tm.id, addressId: addr.id } });
      result.success++;
    }

    if (isValidateMode(req)) {
      const vr: ValidateResult = {
        totalRows: rows.length,
        validRows: rows.length - result.errors.length - result.duplicates,
        duplicateRows: result.duplicates,
        errorRows: result.errors.length,
        duplicates: dupRows.map(row => ({ row, value: `${rows[row - 2]?.object_code || rows[row - 2]?.objectCode || ''} → ${rows[row - 2]?.tm_email || rows[row - 2]?.tmEmail || ''}` })),
        errors: result.errors,
      };
      return res.json(vr);
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
    const dupRows: number[] = [];

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
      if (existing) { result.duplicates++; dupRows.push(i + 2); continue; }

      if (isValidateMode(req)) continue;

      await prisma.tmEngineer.create({ data: { tmId: tm.id, engineerId: engineer.id } });
      result.success++;
    }

    if (isValidateMode(req)) {
      const vr: ValidateResult = {
        totalRows: rows.length,
        validRows: rows.length - result.errors.length - result.duplicates,
        duplicateRows: result.duplicates,
        errorRows: result.errors.length,
        duplicates: dupRows.map(row => ({ row, value: `${rows[row - 2]?.engineer_email || rows[row - 2]?.engineerEmail || ''} → ${rows[row - 2]?.tm_email || rows[row - 2]?.tmEmail || ''}` })),
        errors: result.errors,
      };
      return res.json(vr);
    }

    await prisma.importLog.create({
      data: { userId: req.userId!, entityType: 'tm_engineers', fileName, totalRows: result.total, successRows: result.success, duplicateRows: result.duplicates, errorRows: result.errors.length, errors: result.errors.length ? result.errors : undefined },
    });
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── OBJECT EQUIPMENT ────────────────────────────────────────
router.post('/object-equipment', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows, fileName } = await parseUploadedCsv(req);
    const result: ImportResult = { total: rows.length, success: 0, duplicates: 0, errors: [] };
    const dupRows: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const objectCode = r.object_code || r.objectCode || r['код объекта'];
      const equipmentType = r.equipment_type || r.equipmentType || r['тип оборудования'];
      const roomType = r.room_type || r.roomType || r['тип помещения'];

      if (!objectCode || !equipmentType || !roomType) {
        result.errors.push({ row: i + 2, message: 'Не заполнены object_code, equipment_type или room_type' });
        continue;
      }

      // Find address by object_code
      const address = await prisma.address.findFirst({ where: { objectCode } });
      if (!address) {
        result.errors.push({ row: i + 2, message: `Адрес с object_code "${objectCode}" не найден` });
        continue;
      }

      // Check if equipment type exists
      const eqType = await prisma.equipmentType.findFirst({ where: { code: equipmentType } });
      if (!eqType) {
        result.errors.push({ row: i + 2, message: `Тип оборудования "${equipmentType}" не найден` });
        continue;
      }

      // Check if room type exists
      const rmType = await prisma.roomType.findFirst({ where: { code: roomType } });
      if (!rmType) {
        result.errors.push({ row: i + 2, message: `Тип помещения "${roomType}" не найден` });
        continue;
      }

      const serialNumber = r.serial_number || r.serialNumber || r['серийный номер'] || null;
      const locationDescription = r.location_description || r.locationDescription || r['местоположение'] || null;

      // Check for duplicate: same address + equipment type + serial number (or location if no SN)
      const duplicateWhere: any = {
        addressId: address.id,
        equipmentTypeCode: equipmentType,
      };
      if (serialNumber) {
        duplicateWhere.serialNumber = serialNumber;
      } else if (locationDescription) {
        duplicateWhere.locationDescription = locationDescription;
      }

      const existing = await prisma.objectEquipment.findFirst({ where: duplicateWhere });
      if (existing) { result.duplicates++; dupRows.push(i + 2); continue; }

      if (isValidateMode(req)) continue;

      await prisma.objectEquipment.create({
        data: {
          addressId: address.id,
          equipmentTypeCode: equipmentType,
          roomTypeCode: roomType,
          brand: r.brand || r['марка'] || null,
          model: r.model || r['модель'] || null,
          serialNumber,
          locationDescription,
        },
      });
      result.success++;
    }

    if (isValidateMode(req)) {
      const vr: ValidateResult = {
        totalRows: rows.length,
        validRows: rows.length - result.errors.length - result.duplicates,
        duplicateRows: result.duplicates,
        errorRows: result.errors.length,
        duplicates: dupRows.map(row => ({ row, value: `${rows[row - 2]?.object_code || rows[row - 2]?.objectCode || ''} / ${rows[row - 2]?.equipment_type || rows[row - 2]?.equipmentType || ''}` })),
        errors: result.errors,
      };
      return res.json(vr);
    }

    await prisma.importLog.create({
      data: { userId: req.userId!, entityType: 'object_equipment', fileName, totalRows: result.total, successRows: result.success, duplicateRows: result.duplicates, errorRows: result.errors.length, errors: result.errors.length ? result.errors : undefined },
    });
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
