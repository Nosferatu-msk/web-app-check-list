import prisma from '../models/prisma.js';
import { normalizeAddress } from '../utils/addressNormalizer.js';
import ExcelJS from 'exceljs';

interface ImportRequestsResult {
  importLogId: string;
  total: number;
  created: number;
  matched: number;
  skipped: number;
  errors: number;
  errorDetails: { row: number; externalRequestId: string; message: string }[];
}

interface RequestRow {
  rowNumber: number;
  externalRequestId: string;
  externalStatus: string;
  equipmentTypeName: string;
  objectCode: string;
  addressRaw: string;
}

interface ParsedRequest {
  row: RequestRow;
  equipmentTypeId: string | null;
  equipmentTypeCode: string | null;
  matchedAddressId: string | null;
  error: string | null;
  isSkipped?: boolean;
}

/**
 * Парсинг Excel-файла заявок
 */
export async function parseRequestsExcel(buffer: Buffer): Promise<RequestRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Excel-файл не содержит листов');

  const rows: RequestRow[] = [];
  let headers: string[] = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells = row.values as any[];
    if (rowNumber === 1) {
      headers = cells.slice(1).map((v: any) => String(v || '').trim().toLowerCase());
      return;
    }
    const values = cells.slice(1);
    
    // Поиск колонок по названиям
    const findCol = (names: string[]) => {
      for (const name of names) {
        const idx = headers.findIndex(h => h.includes(name));
        if (idx !== -1) return String(values[idx] || '').trim();
      }
      return '';
    };

    const externalRequestId = findCol(['№ заявки', 'номер заявки', 'заявка']);
    const externalStatus = findCol(['статус']);
    const equipmentTypeName = findCol(['вид оборудования', 'тип оборудования', 'оборудование']);
    const objectCode = findCol(['код объекта', 'object_code', 'object code']);
    const addressRaw = findCol(['адрес', 'address']);

    if (externalRequestId || equipmentTypeName || objectCode || addressRaw) {
      rows.push({
        rowNumber,
        externalRequestId,
        externalStatus,
        equipmentTypeName,
        objectCode,
        addressRaw,
      });
    }
  });

  return rows;
}

/**
 * Валидация и маппинг одной строки
 */
async function validateAndMapRow(
  row: RequestRow,
  equipmentTypeMap: Map<string, { id: string; code: string }>,
  addressByCodeMap: Map<string, string>,
  addressByNormalizedMap: Map<string, string>,
  existingRequestIds: Set<string>,
  fileRequestIds: Set<string>,
): Promise<ParsedRequest> {
  const result: ParsedRequest = {
    row,
    equipmentTypeId: null,
    equipmentTypeCode: null,
    matchedAddressId: null,
    error: null,
  };

  // 1. Проверка уникальности № заявки
  if (!row.externalRequestId) {
    result.error = 'Не заполнен № заявки';
    return result;
  }
  if (existingRequestIds.has(row.externalRequestId)) {
    result.isSkipped = true;
    result.error = `Заявка ${row.externalRequestId} уже импортирована ранее`;
    return result;
  }
  if (fileRequestIds.has(row.externalRequestId)) {
    result.isSkipped = true;
    result.error = `Дублирующийся № заявки в файле: ${row.externalRequestId}`;
    return result;
  }

  // 2. Поиск вида оборудования
  const eqName = row.equipmentTypeName.toLowerCase().trim();
  const eqType = equipmentTypeMap.get(eqName);
  if (!eqType) {
    result.error = `Вид оборудования не найден: "${row.equipmentTypeName}"`;
    return result;
  }
  result.equipmentTypeId = eqType.id;
  result.equipmentTypeCode = eqType.code;

  // 3. Поиск объекта по коду (приоритет)
  const objCode = row.objectCode.trim();
  if (objCode) {
    const addrId = addressByCodeMap.get(objCode.toUpperCase());
    if (addrId) {
      result.matchedAddressId = addrId;
      return result;
    }
  }

  // 4. Поиск по нормализованному адресу
  if (row.addressRaw) {
    const normalized = normalizeAddress(row.addressRaw);
    const addrId = addressByNormalizedMap.get(normalized);
    if (addrId) {
      result.matchedAddressId = addrId;
      return result;
    }
  }

  // 5. Не найден
  if (!objCode && !row.addressRaw) {
    result.error = 'Не заполнены код объекта и адрес';
  } else {
    result.error = `Объект не найден (код: "${row.objectCode}", адрес: "${row.addressRaw}")`;
  }
  return result;
}

/**
 * Основной метод импорта заявок
 */
export async function importRequests(
  rows: RequestRow[],
  userId: string,
  importLogId: string,
): Promise<ImportRequestsResult> {
  const result: ImportRequestsResult = {
    importLogId,
    total: rows.length,
    created: 0,
    matched: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };

  // Загрузка справочников
  const equipmentTypes = await prisma.equipmentType.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, specializationReq: true },
  });
  const equipmentTypeMap = new Map<string, { id: string; code: string }>();
  for (const eq of equipmentTypes) {
    equipmentTypeMap.set(eq.name.toLowerCase().trim(), { id: eq.id, code: eq.code });
  }

  const addresses = await prisma.address.findMany({
    where: { isDeleted: false },
    select: { id: true, objectCode: true, fullAddress: true },
  });
  const addressByCodeMap = new Map<string, string>();
  const addressByNormalizedMap = new Map<string, string>();
  for (const addr of addresses) {
    if (addr.objectCode) {
      addressByCodeMap.set(addr.objectCode.toUpperCase(), addr.id);
    }
    const normalized = normalizeAddress(addr.fullAddress);
    addressByNormalizedMap.set(normalized, addr.id);
  }

  // Существующие external_request_id в БД
  const existingRequests = await prisma.importedRequest.findMany({
    select: { externalRequestId: true },
  });
  const existingRequestIds = new Set(existingRequests.map(r => r.externalRequestId));

  // Уникальность в рамках файла
  const fileRequestIds = new Set<string>();

  // Валидация и маппинг всех строк
  const parsedRows: ParsedRequest[] = [];
  for (const row of rows) {
    const parsed = await validateAndMapRow(
      row,
      equipmentTypeMap,
      addressByCodeMap,
      addressByNormalizedMap,
      existingRequestIds,
      fileRequestIds,
    );
    if (row.externalRequestId) fileRequestIds.add(row.externalRequestId);
    parsedRows.push(parsed);
  }

  // Создание визитов — по одному на каждую заявку
  for (const parsed of parsedRows) {
    if (parsed.error) {
      if (parsed.isSkipped) {
        result.skipped++;
      } else {
        result.errors++;
      }
      result.errorDetails.push({
        row: parsed.row.rowNumber,
        externalRequestId: parsed.row.externalRequestId,
        message: parsed.error,
      });
      continue;
    }

    const addressId = parsed.matchedAddressId!;
    const eq = equipmentTypes.find(e => e.id === parsed.equipmentTypeId);
    const isISZHEquipment = !eq?.specializationReq;

    // Создание визита
    const visit = await prisma.visit.create({
      data: {
        userId: null,
        addressId,
        engineerName: '',
        dateStart: new Date(),
        timeStart: '09:00',
        season: getCurrentSeason(),
        status: 'awaiting_assignment',
        isMultiSpecialist: false,
      },
    });

    // Создание записи imported_request
    await prisma.importedRequest.create({
      data: {
        externalRequestId: parsed.row.externalRequestId,
        externalStatus: parsed.row.externalStatus || null,
        equipmentTypeId: parsed.equipmentTypeId!,
        equipmentTypeCode: parsed.equipmentTypeCode,
        objectCode: parsed.row.objectCode,
        addressRaw: parsed.row.addressRaw,
        matchedAddressId: addressId,
        visitId: visit.id,
        importStatus: 'created',
        importedBy: userId,
      },
    });

    // Создание задачи (кроме ИСЖ объекта)
    if (!isISZHEquipment) {
      await prisma.task.create({
        data: {
          visitId: visit.id,
          equipmentTypeId: parsed.equipmentTypeId!,
          externalRequestId: parsed.row.externalRequestId,
          status: 'not_started',
        },
      });
    }

    result.created++;
  }

  // Обновление import_log
  await prisma.importLog.update({
    where: { id: importLogId },
    data: {
      status: 'completed',
      totalRows: result.total,
      successRows: result.created,
      errorRows: result.errors,
      duplicateRows: result.skipped,
      errors: result.errorDetails.length > 0 ? result.errorDetails as any : undefined,
    },
  });

  return result;
}

function getCurrentSeason(): 'summer' | 'winter' {
  const msk = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const month = msk.getMonth() + 1;
  const day = msk.getDate();
  if ((month > 4 && month < 10) || (month === 4 && day >= 1) || (month === 10 && day <= 31)) {
    return 'summer';
  }
  return 'winter';
}

/**
 * Валидация файла без создания записей (preview)
 */
export async function validateRequestsFile(
  rows: RequestRow[],
): Promise<{ total: number; valid: number; errors: { row: number; externalRequestId: string; message: string }[] }> {
  const errors: { row: number; externalRequestId: string; message: string }[] = [];
  const fileRequestIds = new Set<string>();

  // Загрузка справочников
  const equipmentTypes = await prisma.equipmentType.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, specializationReq: true },
  });
  const equipmentTypeMap = new Map<string, { id: string; code: string }>();
  for (const eq of equipmentTypes) {
    equipmentTypeMap.set(eq.name.toLowerCase().trim(), { id: eq.id, code: eq.code });
  }

  const addresses = await prisma.address.findMany({
    where: { isDeleted: false },
    select: { id: true, objectCode: true, fullAddress: true },
  });
  const addressByCodeMap = new Map<string, string>();
  const addressByNormalizedMap = new Map<string, string>();
  for (const addr of addresses) {
    if (addr.objectCode) {
      addressByCodeMap.set(addr.objectCode.toUpperCase(), addr.id);
    }
    const normalized = normalizeAddress(addr.fullAddress);
    addressByNormalizedMap.set(normalized, addr.id);
  }

  const existingRequests = await prisma.importedRequest.findMany({
    select: { externalRequestId: true },
  });
  const existingRequestIds = new Set(existingRequests.map(r => r.externalRequestId));

  for (const row of rows) {
    const parsed = await validateAndMapRow(
      row,
      equipmentTypeMap,
      addressByCodeMap,
      addressByNormalizedMap,
      existingRequestIds,
      fileRequestIds,
    );
    if (row.externalRequestId) fileRequestIds.add(row.externalRequestId);
    if (parsed.error) {
      errors.push({
        row: row.rowNumber,
        externalRequestId: row.externalRequestId,
        message: parsed.error,
      });
    }
  }

  return {
    total: rows.length,
    valid: rows.length - errors.length,
    errors,
  };
}
