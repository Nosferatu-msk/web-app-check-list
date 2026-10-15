import { Router, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import prisma from '../models/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { parseRequestsExcel, importRequests, validateRequestsFile } from '../services/requestImport.js';
import { getTeamEngineerIds } from '../utils/tmTeam.js';

function getCurrentSeason(): 'summer' | 'winter' {
  const msk = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const month = msk.getMonth() + 1;
  const day = msk.getDate();
  if ((month > 4 && month < 10) || (month === 4 && day >= 1) || (month === 10 && day <= 31)) {
    return 'summer';
  }
  return 'winter';
}

const router = Router();
router.use(authMiddleware);

// в”Ђв”Ђв”Ђ Р’Р«Р§РРЎР›Р•РќРР• РЎРўРђРўРЈРЎРђ Р—РђРЇР’РљР в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Р”Р»СЏ РѕР±С‹С‡РЅС‹С… Р·Р°СЏРІРѕРє (РЅРµ РРЎР– РѕР±СЉРµРєС‚Р°)
function computeExecutionStatus(visit: any, isISZH: boolean, equipmentTypeId?: string, requestSerialNumber?: string | null): string {
  if (!visit || visit.status === 'awaiting_assignment') return 'not_assigned';
  if (visit.status === 'planned') return 'assigned';
  if (visit.status === 'in_progress') return 'in_progress';
  if (['completed', 'sent', 'corrected_by_tm'].includes(visit.status)) {
    // РџСЂРѕРІРµСЂРєР°: РµСЃС‚СЊ Р»Рё Р·Р°РґР°С‡Р° РїРѕ С‚РёРїСѓ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ Р·Р°СЏРІРєРё РІ РІРёР·РёС‚Рµ
    if (equipmentTypeId && visit.tasks && !isISZH) {
      const hasMatchingTask = visit.tasks.some((t: any) => t.equipmentTypeId === equipmentTypeId);
      if (!hasMatchingTask) return 'not_assigned';

      // Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅР°СЏ РїСЂРѕРІРµСЂРєР° serialNumber РґР»СЏ РЅРµ-РРЎР– Р·Р°СЏРІРѕРє
      if (requestSerialNumber) {
        const hasMatchingSN = visit.tasks.some((t: any) => {
          if (t.equipmentTypeId !== equipmentTypeId) return false;
          const taskSN = t.serialNumber || t.objectEquipment?.serialNumber;
          return taskSN === requestSerialNumber;
        });
        if (!hasMatchingSN) return 'not_assigned';
      }
    }
    return 'completed';
  }
  return 'not_assigned';
}

// Р”Р»СЏ Р·Р°СЏРІРѕРє РРЎР– РѕР±СЉРµРєС‚Р° вЂ” Р°РіСЂРµРіРёСЂРѕРІР°РЅРЅС‹Р№ СЃС‚Р°С‚СѓСЃ РїРѕ РІСЃРµРј СЃРІСЏР·Р°РЅРЅС‹Рј РІРёР·РёС‚Р°Рј
// РРіРЅРѕСЂРёСЂСѓРµРј В«РІРёСЂС‚СѓР°Р»СЊРЅС‹РµВ» РІРёР·РёС‚С‹ Р±РµР· Р·Р°РґР°С‡ Рё РёРЅР¶РµРЅРµСЂРѕРІ (С‚РѕР»СЊРєРѕ РґР»СЏ СЃРІСЏР·Рё СЃ Р·Р°СЏРІРєРѕР№)
function computeISZHExecutionStatus(visits: any[]): string {
  if (!visits || visits.length === 0) {
    return 'not_assigned';
  }

  // Р¤РёР»СЊС‚СЂСѓРµРј С‚РѕР»СЊРєРѕ В«СЂРµР°Р»СЊРЅС‹РµВ» РІРёР·РёС‚С‹ вЂ” СЃ Р·Р°РґР°С‡Р°РјРё
  // Р’РёР·РёС‚С‹ Р±РµР· Р·Р°РґР°С‡ СЃС‡РёС‚Р°СЋС‚СЃСЏ РІРёСЂС‚СѓР°Р»СЊРЅС‹РјРё (СЃРѕР·РґР°РЅС‹ РїСЂРё РёРјРїРѕСЂС‚Рµ/РїСЂРёРІСЏР·РєРµ Р·Р°СЏРІРєРё)
  const realVisits = visits.filter(v => v._count?.tasks > 0);

  // Р•СЃР»Рё РЅРµС‚ РІРёР·РёС‚РѕРІ СЃ Р·Р°РґР°С‡Р°РјРё вЂ” РїСЂРѕРІРµСЂСЏРµРј РµСЃС‚СЊ Р»Рё РЅР°Р·РЅР°С‡РµРЅРЅС‹Рµ РІРёР·РёС‚С‹
  if (realVisits.length === 0) {
    const hasAnyVisit = visits.length > 0;
    const hasAssigned = visits.some(v => v.status === 'planned' || v.status === 'in_progress');
    if (hasAssigned) return 'assigned';
    return hasAnyVisit ? 'not_assigned' : 'not_assigned';
  }

  const statuses = realVisits.map(v => v.status);
  const completedStatuses = ['completed', 'sent', 'corrected_by_tm'];

  // РџСЂРѕРІРµСЂРєР°: РІСЃРµ СЂРµР°Р»СЊРЅС‹Рµ РІРёР·РёС‚С‹ Р·Р°РІРµСЂС€РµРЅС‹?
  const allCompleted = statuses.every(s => completedStatuses.includes(s));
  if (allCompleted) {
    return 'completed';
  }

  // РџСЂРѕРІРµСЂРєР°: РµСЃС‚СЊ Р»Рё С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ РІРёР·РёС‚ РІ СЂР°Р±РѕС‚Рµ РёР»Рё РЅР°Р·РЅР°С‡РµРЅРЅС‹Р№?
  const hasInProgress = statuses.includes('in_progress');
  const hasAssigned = statuses.includes('planned');
  const hasNotStarted = statuses.includes('not_started');

  // Р•СЃР»Рё РµСЃС‚СЊ РІРёР·РёС‚ РІ СЂР°Р±РѕС‚Рµ вЂ” Р·Р°СЏРІРєР° РІ СЂР°Р±РѕС‚Рµ
  if (hasInProgress) {
    return 'in_progress';
  }

  // Р•СЃР»Рё РµСЃС‚СЊ РЅР°Р·РЅР°С‡РµРЅРЅС‹Рµ РІРёР·РёС‚С‹ (planned) РёР»Рё РЅРµ РЅР°С‡Р°С‚С‹Рµ вЂ” Р·Р°СЏРІРєР° РЅР°Р·РЅР°С‡РµРЅР°
  if (hasAssigned || hasNotStarted) {
    return 'assigned';
  }

  // Р•СЃР»Рё РµСЃС‚СЊ Р·Р°РІРµСЂС€С‘РЅРЅС‹Рµ, РЅРѕ РЅРµ РІСЃРµ вЂ” Р·Р°СЏРІРєР° РІ СЂР°Р±РѕС‚Рµ (С‡Р°СЃС‚РёС‡РЅРѕРµ РїРѕРєСЂС‹С‚РёРµ)
  const hasCompleted = statuses.some(s => completedStatuses.includes(s));
  if (hasCompleted) {
    return 'in_progress';
  }

  return 'assigned';
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      name.endsWith('.xlsx')
    ) cb(null, true);
    else cb(new Error('РџРѕРґРґРµСЂР¶РёРІР°СЋС‚СЃСЏ С‚РѕР»СЊРєРѕ С„Р°Р№Р»С‹ XLSX'));
  },
});

// в”Ђв”Ђв”Ђ РРњРџРћР Рў Р—РђРЇР’РћРљ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
router.post('/import', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Р¤Р°Р№Р» РЅРµ Р·Р°РіСЂСѓР¶РµРЅ' });
      return;
    }

    const isValidate = req.query.mode === 'validate';

    // РџР°СЂСЃРёРЅРі Excel
    const rows = await parseRequestsExcel(file.buffer);
    if (rows.length === 0) {
      res.status(400).json({ error: 'Р¤Р°Р№Р» РЅРµ СЃРѕРґРµСЂР¶РёС‚ РґР°РЅРЅС‹С…' });
      return;
    }
    if (rows.length > 5000) {
      res.status(400).json({ error: 'Р¤Р°Р№Р» СЃРѕРґРµСЂР¶РёС‚ Р±РѕР»РµРµ 5000 СЃС‚СЂРѕРє. Р Р°Р·Р±РµР№С‚Рµ С„Р°Р№Р» РЅР° С‡Р°СЃС‚Рё.' });
      return;
    }

    // Р РµР¶РёРј РІР°Р»РёРґР°С†РёРё (preview)
    if (isValidate) {
      const validation = await validateRequestsFile(rows);
      res.json(validation);
      return;
    }

    // РЎРѕР·РґР°РЅРёРµ import_log
    const importLog = await prisma.importLog.create({
      data: {
        userId: req.userId!,
        entityType: 'requests',
        fileName: file.originalname,
        totalRows: rows.length,
        successRows: 0,
        errorRows: 0,
        status: 'processing',
      },
    });

    // РђСЃРёРЅС…СЂРѕРЅРЅС‹Р№ РёРјРїРѕСЂС‚ (РґР»СЏ Р±РѕР»СЊС€РёС… С„Р°Р№Р»РѕРІ)
    if (rows.length > 100) {
      // Р—Р°РїСѓСЃРєР°РµРј РІ С„РѕРЅРµ
      importRequests(rows, req.userId!, importLog.id).catch(err => {
        console.error('Import requests error:', err);
        prisma.importLog.update({
          where: { id: importLog.id },
          data: { status: 'error', errors: { message: err.message } as any },
        }).catch(console.error);
      });

      res.json({
        importLogId: importLog.id,
        status: 'processing',
        totalRows: rows.length,
        message: 'РРјРїРѕСЂС‚ Р·Р°РїСѓС‰РµРЅ РІ С„РѕРЅРѕРІРѕРј СЂРµР¶РёРјРµ. РСЃРїРѕР»СЊР·СѓР№С‚Рµ GET /api/requests/import/:id РґР»СЏ РїСЂРѕРІРµСЂРєРё СЃС‚Р°С‚СѓСЃР°.',
      });
      return;
    }

    // РЎРёРЅС…СЂРѕРЅРЅС‹Р№ РёРјРїРѕСЂС‚ (РґР»СЏ РјР°Р»РµРЅСЊРєРёС… С„Р°Р№Р»РѕРІ)
    const result = await importRequests(rows, req.userId!, importLog.id);

    // РЈРІРµРґРѕРјР»РµРЅРёРµ РўРњ
    if (result.created > 0) {
      // РќР°С…РѕРґРёРј РўРњ, РєРѕС‚РѕСЂС‹Р№ РёРјРїРѕСЂС‚РёСЂРѕРІР°Р»
      const tmIds = new Set<string>();
      const addresses = await prisma.address.findMany({
        where: { id: { in: rows.map(r => r.objectCode).filter(Boolean) } },
        select: { id: true },
      });
      const tmObjects = await prisma.tmObject.findMany({
        where: { addressId: { in: addresses.map(a => a.id) } },
        select: { tmId: true },
      });
      tmObjects.forEach(tmo => tmIds.add(tmo.tmId));

      // РЈРІРµРґРѕРјР»СЏРµРј РўРњ
      for (const tmId of tmIds) {
        await prisma.notification.create({
          data: {
            userId: tmId,
            type: 'request_imported',
            title: 'РРјРїРѕСЂС‚ Р·Р°СЏРІРѕРє',
            message: `РРјРїРѕСЂС‚РёСЂРѕРІР°РЅРѕ ${result.created} Р·Р°СЏРІРѕРє. РЎРѕР·РґР°РЅРѕ РІРёР·РёС‚РѕРІ: ${result.created}. РћС€РёР±РѕРє: ${result.errors}. РџСЂРѕРїСѓС‰РµРЅРѕ: ${result.skipped}.`,
            entityType: 'import_log',
            entityId: importLog.id,
          },
        });
      }
    }

    await logAudit({
      userId: req.userId,
      action: 'import_requests',
      entityType: 'import_log',
      entityId: importLog.id,
      newValue: { total: result.total, created: result.created, errors: result.errors },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// в”Ђв”Ђв”Ђ РЎРўРђРўРЈРЎ РРњРџРћР РўРђ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
router.get('/import/:id', async (req: AuthRequest, res: Response) => {
  try {
    const importLog = await prisma.importLog.findUnique({
      where: { id: req.params.id as string },
    });
    if (!importLog) {
      res.status(404).json({ error: 'РРјРїРѕСЂС‚ РЅРµ РЅР°Р№РґРµРЅ' });
      return;
    }
    res.json(importLog);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// в”Ђв”Ђв”Ђ РЎРџРРЎРћРљ Р—РђРЇР’РћРљ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const importStatus = req.query.importStatus as string | undefined;
    const executionStatus = req.query.executionStatus as string | undefined;
    const objectCode = req.query.objectCode as string | undefined;
    const sortField = req.query.sortField as string | undefined;
    const sortOrder = (req.query.sortOrder as string) === 'ascend' ? 'asc' : 'desc';
    const engineerFilter = req.query.engineerId as string | undefined;
    const contractIdFilter = req.query.contractId as string | undefined;
    const periodMonth = req.query.periodMonth as string | undefined;
    const periodYear = req.query.periodYear as string | undefined;
    const searchQuery = req.query.search as string | undefined;
    const isOverdueFilter = req.query.isOverdue as string | undefined;

    const where: any = {};
    if (importStatus) where.importStatus = importStatus;
    if (objectCode) where.objectCode = objectCode;
    if (contractIdFilter) where.contractId = contractIdFilter;
    if (engineerFilter) {
      where.visit = { visitEngineers: { some: { engineerId: engineerFilter } } };
    }

    // Р¤РёР»СЊС‚СЂ РїРѕ РїРµСЂРёРѕРґСѓ (РјРµСЃСЏС†/РіРѕРґ) вЂ” РїРѕ РґР°С‚Рµ РЅР°С‡Р°Р»Р° Р·Р°СЏРІРєРё
    if (periodMonth && periodYear) {
      const monthNum = parseInt(periodMonth);
      const yearNum = parseInt(periodYear);
      const startDate = new Date(yearNum, monthNum - 1, 1);
      const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);
      where.startDate = { gte: startDate, lte: endDate };
    }

    // РўРµРєСЃС‚РѕРІС‹Р№ РїРѕРёСЃРє РїРѕ РєРѕРґСѓ РѕР±СЉРµРєС‚Р°, РЅРѕРјРµСЂСѓ Р·Р°СЏРІРєРё, Р°РґСЂРµСЃСѓ
    if (searchQuery) {
      where.AND = [
        ...(where.AND || []),
        { OR: [
          { objectCode: { contains: searchQuery, mode: 'insensitive' } },
          { externalRequestId: { contains: searchQuery, mode: 'insensitive' } },
          { matchedAddress: { fullAddress: { contains: searchQuery, mode: 'insensitive' } } },
        ]},
      ];
    }

    // Р¤РёР»СЊС‚СЂР°С†РёСЏ РїРѕ С‚РµСЂСЂРёС‚РѕСЂРёРё РўРњ вЂ” С‡РµСЂРµР· РґРѕРіРѕРІРѕСЂС‹
    if (req.userRole === 'tm') {
      const tmContracts = await prisma.contract.findMany({
        where: { tmId: req.userId!, module: 'to' },
        select: { id: true },
      });
      const contractIds = tmContracts.map(c => c.id);
      where.contractId = { in: contractIds };

      // РўРњ РІРёРґРёС‚ РІСЃРµ Р·Р°СЏРІРєРё СЃРІРѕРµРіРѕ РґРѕРіРѕРІРѕСЂР° (РЅРµ С‚РѕР»СЊРєРѕ РЅР°Р·РЅР°С‡РµРЅРЅС‹Рµ РёРЅР¶РµРЅРµСЂР°Рј)
      // Р’РєР»СЋС‡Р°СЏ: Р·Р°СЏРІРєРё Р±РµР· РІРёР·РёС‚РѕРІ, Р·Р°СЏРІРєРё СЃ РІРёР·РёС‚Р°РјРё Р±РµР· visitEngineers, Р·Р°СЏРІРєРё СЃ РІРёР·РёС‚Р°РјРё СЃ visitEngineers
      // Р¤РёР»СЊС‚СЂР°С†РёСЏ РїРѕ РёРЅР¶РµРЅРµСЂР°Рј РЅРµ РЅСѓР¶РЅР° вЂ” РўРњ РІРёРґРёС‚ РІСЃРµ Р·Р°СЏРІРєРё СЃРІРѕРµРіРѕ РґРѕРіРѕРІРѕСЂР°
    } else if (req.userRole === 'engineer') {
      // РРЅР¶РµРЅРµСЂ РІРёРґРёС‚ С‚РѕР»СЊРєРѕ РЅР°Р·РЅР°С‡РµРЅРЅС‹Рµ РµРјСѓ Р·Р°СЏРІРєРё (С‡РµСЂРµР· visit_engineers)
      const visitEngineers = await prisma.visitEngineer.findMany({
        where: { engineerId: req.userId! },
        select: { visitId: true },
      });
      const visitIds = visitEngineers.map(ve => ve.visitId);
      where.visitId = { in: visitIds };
    }

    // РЎРѕСЂС‚РёСЂРѕРІРєР°
    let orderBy: any = { createdAt: 'desc' };
    if (sortField) {
      switch (sortField) {
        case 'externalRequestId':
          orderBy = { externalRequestId: sortOrder };
          break;
        case 'objectCode':
          orderBy = { objectCode: sortOrder };
          break;
        case 'address':
          orderBy = { matchedAddress: { fullAddress: sortOrder } };
          break;
      }
    }

    // Р”Р»СЏ С„РёР»СЊС‚СЂР°С†РёРё РїРѕ executionStatus РЅСѓР¶РЅР° РїРѕСЃС‚-РѕР±СЂР°Р±РѕС‚РєР° (РґР»СЏ РРЎР– РѕР±СЉРµРєС‚Р° СЃ РјРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹РјРё РІРёР·РёС‚Р°РјРё)
    const needsPostFilter = !!executionStatus || isOverdueFilter === 'true';
    
    const [rawData, total] = await Promise.all([
      prisma.importedRequest.findMany({
        where,
        include: {
          equipmentType: { select: { id: true, name: true, code: true, specializationReq: true } },
          matchedAddress: { select: { id: true, fullAddress: true, objectCode: true } },
          contract: { select: { id: true, number: true } },
          visit: {
            select: {
              id: true, status: true, isMultiSpecialist: true,
              tasks: { select: { equipmentTypeId: true } },
              visitEngineers: {
                select: {
                  id: true, engineerId: true, isPrimary: true,
                  engineer: { select: { id: true, fullName: true } },
                },
              },
            },
          },
          // Р”Р»СЏ РРЎР– РѕР±СЉРµРєС‚Р° вЂ” РІСЃРµ СЃРІСЏР·Р°РЅРЅС‹Рµ РІРёР·РёС‚С‹ С‡РµСЂРµР· visit_requests
          visitRequests: {
            select: {
              visit: {
                select: {
                  id: true, status: true, userId: true,
                  visitEngineers: {
                    select: {
                      id: true, engineerId: true, isPrimary: true,
                      engineer: { select: { id: true, fullName: true } },
                    },
                  },
                  _count: { select: { tasks: true } },
                },
              },
            },
          },
        },
        orderBy,
        // Р•СЃР»Рё РЅСѓР¶РЅР° РїРѕСЃС‚-С„РёР»СЊС‚СЂР°С†РёСЏ вЂ” Р·Р°РіСЂСѓР¶Р°РµРј РІСЃРµ, РёРЅР°С‡Рµ вЂ” СЃ РїР°РіРёРЅР°С†РёРµР№
        skip: needsPostFilter ? 0 : (page - 1) * pageSize,
        take: needsPostFilter ? 10000 : pageSize,
      }),
      prisma.importedRequest.count({ where }),
    ]);

    const now = new Date();

    // Р’С‹С‡РёСЃР»РµРЅРёРµ executionStatus Рё isOverdue РґР»СЏ РІСЃРµС… Р·Р°СЏРІРѕРє
    const enrichedData = rawData.map(req => {
      const isISZHObject = req.equipmentType?.code === 'iszh_object';

      let executionStatus: string;
      if (!isISZHObject) {
        executionStatus = computeExecutionStatus(req.visit, false, req.equipmentTypeId, req.serialNumber);
      } else {
        const allVisits = req.visitRequests?.map(vr => vr.visit).filter(Boolean) || [];
        executionStatus = computeISZHExecutionStatus(allVisits);
      }

      // РџСЂРѕСЃСЂРѕС‡РµРЅР° Р»Рё Р·Р°СЏРІРєР°
      let isOverdue = false;
      if (req.deadline && !['completed', 'sent'].includes(executionStatus)) {
        isOverdue = new Date(req.deadline) < now;
      }

      return { ...req, executionStatus, isOverdue };
    });

    // РџРѕСЃС‚-С„РёР»СЊС‚СЂР°С†РёСЏ РїРѕ executionStatus
    let filteredData = enrichedData;
    if (executionStatus) {
      filteredData = filteredData.filter(req => req.executionStatus === executionStatus);
    }

    // РџРѕСЃС‚-С„РёР»СЊС‚СЂР°С†РёСЏ РїРѕ РїСЂРѕСЃСЂРѕС‡РєРµ
    if (isOverdueFilter === 'true') {
      filteredData = filteredData.filter(req => req.isOverdue);
    }

    // РџСЂРёРјРµРЅСЏРµРј РїР°РіРёРЅР°С†РёСЋ Рє РѕС‚С„РёР»СЊС‚СЂРѕРІР°РЅРЅС‹Рј РґР°РЅРЅС‹Рј
    const finalData = needsPostFilter
      ? filteredData.slice((page - 1) * pageSize, page * pageSize)
      : filteredData;
    const finalTotal = needsPostFilter ? filteredData.length : total;

    res.json({ data: finalData, total: finalTotal, page, pageSize });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// в”Ђв”Ђв”Ђ РќРђР—РќРђР§Р•РќРР• РРќР–Р•РќР•Р Рђ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const assignSchema = z.object({
  engineerId: z.string().uuid(),
  requestId: z.string().uuid().optional(),
});

router.post('/assign', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'tm' && req.userRole !== 'admin') {
      res.status(403).json({ error: 'Р”РѕСЃС‚СѓРї Р·Р°РїСЂРµС‰С‘РЅ' });
      return;
    }

    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors });
      return;
    }

    const { engineerId, requestId } = parsed.data;

    // РќР°С…РѕРґРёРј Р·Р°СЏРІРєСѓ
    const request = await prisma.importedRequest.findUnique({
      where: { id: requestId },
      include: {
        equipmentType: true,
        matchedAddress: true,
        visit: { include: { tasks: true, visitEngineers: true } },
      },
    });
    if (!request || !request.visitId) {
      res.status(404).json({ error: 'Р—Р°СЏРІРєР° РЅРµ РЅР°Р№РґРµРЅР° РёР»Рё РІРёР·РёС‚ РЅРµ СЃРѕР·РґР°РЅ' });
      return;
    }

    const visit = request.visit!;

    // РџСЂРѕРІРµСЂРєР° СЃРїРµС†РёР°Р»РёР·Р°С†РёРё
    const requiredSpec = request.equipmentType.specializationReq;
    if (requiredSpec) {
      const engineer = await prisma.user.findUnique({ where: { id: engineerId } });
      if (!engineer) {
        res.status(404).json({ error: 'РРЅР¶РµРЅРµСЂ РЅРµ РЅР°Р№РґРµРЅ' });
        return;
      }

      const specMap: Record<string, keyof typeof engineer> = {
        vik: 'specializationVik',
        iszh: 'specializationIszh',
        gpm: 'specializationGpm',
        dgu: 'specializationDgu',
        ibp: 'specializationIbp',
      };
      const specField = specMap[requiredSpec];
      if (specField && !engineer[specField]) {
        res.status(400).json({
          error: `РРЅР¶РµРЅРµСЂ ${engineer.fullName} РЅРµ РёРјРµРµС‚ СЃРїРµС†РёР°Р»РёР·Р°С†РёРё ${requiredSpec.toUpperCase()}. РќР°Р·РЅР°С‡РµРЅРёРµ РЅРµРІРѕР·РјРѕР¶РЅРѕ.`,
        });
        return;
      }
    }

    // РЎРѕР·РґР°С‘Рј Р·Р°РїРёСЃСЊ visit_engineer
    const isPrimary = visit.visitEngineers.length === 0;
    const visitEngineer = await prisma.visitEngineer.create({
      data: {
        visitId: visit.id,
        engineerId,
        isPrimary,
        assignedBy: req.userId!,
      },
    });

    // РћР±РЅРѕРІР»СЏРµРј РІРёР·РёС‚
    const engineer = await prisma.user.findUnique({ where: { id: engineerId } });
    const updateData: any = {};
    if (isPrimary) {
      updateData.userId = engineerId;
      updateData.engineerName = engineer?.fullName || '';
      updateData.status = 'planned';
    }
    if (Object.keys(updateData).length > 0) {
      await prisma.visit.update({ where: { id: visit.id }, data: updateData });
    }

    // Р—Р°РїРёСЃСЊ РІ Р»РѕРі
    await prisma.requestAssignmentLog.create({
      data: {
        importedRequestId: request.id,
        action: 'assigned',
        engineerId,
        performedBy: req.userId!,
      },
    });

    // РЈРІРµРґРѕРјР»РµРЅРёРµ РёРЅР¶РµРЅРµСЂСѓ
    await prisma.notification.create({
      data: {
        userId: engineerId,
        type: 'request_assigned',
        title: 'РќРѕРІР°СЏ Р·Р°СЏРІРєР°',
        message: `Р—Р°СЏРІРєР° в„– ${request.externalRequestId}. РћР±СЉРµРєС‚: ${request.matchedAddress?.fullAddress || request.addressRaw}. РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ: ${request.equipmentType.name}.`,
        entityType: 'visit',
        entityId: visit.id,
      },
    });

    await logAudit({
      userId: req.userId,
      action: 'assign_engineer',
      entityType: 'imported_request',
      entityId: request.id,
      newValue: { engineerId, visitId: visit.id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json(visitEngineer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// в”Ђв”Ђв”Ђ РЎРќРЇРўРР• РќРђР—РќРђР§Р•РќРРЇ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
router.post('/unassign', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'tm' && req.userRole !== 'admin') {
      res.status(403).json({ error: 'Р”РѕСЃС‚СѓРї Р·Р°РїСЂРµС‰С‘РЅ' });
      return;
    }

    const { visitId, engineerId, requestId, reason } = req.body;
    if (!visitId || !engineerId) {
      res.status(400).json({ error: 'РќРµ СѓРєР°Р·Р°РЅС‹ visitId РёР»Рё engineerId' });
      return;
    }

    // РЈРґР°Р»СЏРµРј Р·Р°РїРёСЃСЊ visit_engineer
    await prisma.visitEngineer.deleteMany({
      where: { visitId, engineerId },
    });

    // РџСЂРѕРІРµСЂСЏРµРј, РѕСЃС‚Р°Р»РёСЃСЊ Р»Рё РёРЅР¶РµРЅРµСЂС‹
    const remaining = await prisma.visitEngineer.count({ where: { visitId } });
    if (remaining === 0) {
      // Р’РёР·РёС‚ РІРѕР·РІСЂР°С‰Р°РµС‚СЃСЏ РІ awaiting_assignment
      await prisma.visit.update({
        where: { id: visitId },
        data: { userId: null, engineerName: '', status: 'awaiting_assignment' },
      });
    } else {
      // Р•СЃР»Рё СЃРЅСЏС‚ РѕСЃРЅРѕРІРЅРѕР№, РЅР°Р·РЅР°С‡Р°РµРј РЅРѕРІРѕРіРѕ РѕСЃРЅРѕРІРЅРѕРіРѕ
      const newPrimary = await prisma.visitEngineer.findFirst({
        where: { visitId, isPrimary: true },
      });
      if (!newPrimary) {
        const firstEngineer = await prisma.visitEngineer.findFirst({
          where: { visitId },
          orderBy: { assignedAt: 'asc' },
        });
        if (firstEngineer) {
          const eng = await prisma.user.findUnique({ where: { id: firstEngineer.engineerId } });
          await prisma.visit.update({
            where: { id: visitId },
            data: { userId: firstEngineer.engineerId, engineerName: eng?.fullName || '' },
          });
          await prisma.visitEngineer.update({
            where: { id: firstEngineer.id },
            data: { isPrimary: true },
          });
        }
      }
    }

    // Р—Р°РїРёСЃСЊ РІ Р»РѕРі
    if (requestId) {
      await prisma.requestAssignmentLog.create({
        data: {
          importedRequestId: requestId,
          action: 'unassigned',
          engineerId,
          performedBy: req.userId!,
          reason: reason || null,
        },
      });
    }

    // РЈРІРµРґРѕРјР»РµРЅРёРµ РёРЅР¶РµРЅРµСЂСѓ
    // РџРѕР»СѓС‡Р°РµРј РґР°РЅРЅС‹Рµ РґР»СЏ С‚РµРєСЃС‚Р° СѓРІРµРґРѕРјР»РµРЅРёСЏ
    let requestNumber = '';
    let address = '';
    if (requestId) {
      const reqData = await prisma.importedRequest.findUnique({
        where: { id: requestId },
        select: { externalRequestId: true, matchedAddress: { select: { fullAddress: true } } },
      });
      requestNumber = reqData?.externalRequestId || '';
      address = reqData?.matchedAddress?.fullAddress || '';
    } else {
      // Р•СЃР»Рё requestId РЅРµ СѓРєР°Р·Р°РЅ, РїРѕР»СѓС‡Р°РµРј С‡РµСЂРµР· РІРёР·РёС‚
      const visitData = await prisma.visit.findUnique({
        where: { id: visitId },
        include: {
          importedRequests: { select: { externalRequestId: true } },
          address: { select: { fullAddress: true } },
        },
      });
      requestNumber = visitData?.importedRequests?.[0]?.externalRequestId || '';
      address = visitData?.address?.fullAddress || '';
    }

    await prisma.notification.create({
      data: {
        userId: engineerId,
        type: 'request_unassigned',
        title: 'РЎРЅСЏС‚РёРµ СЃ Р·Р°СЏРІРєРё',
        message: `Р’С‹ СЃРЅСЏС‚С‹ СЃ Р·Р°СЏРІРєРё в„– ${requestNumber}. РћР±СЉРµРєС‚: ${address}.`,
        entityType: 'visit',
        entityId: visitId,
      },
    });

    await logAudit({
      userId: req.userId,
      action: 'unassign_engineer',
      entityType: 'visit',
      entityId: visitId,
      newValue: { engineerId, reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// в”Ђв”Ђв”Ђ РћРўРљРђР— РРќР–Р•РќР•Р Рђ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
router.post('/decline', async (req: AuthRequest, res: Response) => {
  try {
    const { requestId, reason } = req.body;
    if (!requestId || !reason) {
      res.status(400).json({ error: 'РќРµ СѓРєР°Р·Р°РЅС‹ requestId РёР»Рё reason' });
      return;
    }

    const request = await prisma.importedRequest.findUnique({
      where: { id: requestId },
      include: { visit: { include: { visitEngineers: true } } },
    });

    if (!request || !request.visit) {
      res.status(404).json({ error: 'Р—Р°СЏРІРєР° РЅРµ РЅР°Р№РґРµРЅР° РёР»Рё РІРёР·РёС‚ РЅРµ СЃРѕР·РґР°РЅ' });
      return;
    }

    // РЈРґР°Р»СЏРµРј Р·Р°РїРёСЃСЊ visit_engineer
    await prisma.visitEngineer.deleteMany({
      where: { visitId: request.visit.id, engineerId: req.userId! },
    });

    // Р•СЃР»Рё РІРёР·РёС‚ Р±С‹Р» РІ СЃС‚Р°С‚СѓСЃРµ planned, РІРѕР·РІСЂР°С‰Р°РµРј РІ awaiting_assignment
    if (request.visit.status === 'planned') {
      const remaining = await prisma.visitEngineer.count({ where: { visitId: request.visit.id } });
      if (remaining === 0) {
        await prisma.visit.update({
          where: { id: request.visit.id },
          data: { userId: null, engineerName: '', status: 'awaiting_assignment' },
        });
      }
    }

    // Р—Р°РїРёСЃСЊ РІ Р»РѕРі
    await prisma.requestAssignmentLog.create({
      data: {
        importedRequestId: requestId,
        action: 'declined',
        engineerId: req.userId!,
        performedBy: req.userId!,
        reason,
      },
    });

    // РЈРІРµРґРѕРјР»РµРЅРёРµ РўРњ
    const tmIds = new Set<string>();
    if (request.contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: request.contractId },
        select: { tmId: true },
      });
      if (contract?.tmId) tmIds.add(contract.tmId);
    }

    for (const tmId of tmIds) {
      await prisma.notification.create({
        data: {
          userId: tmId,
          type: 'request_declined',
          title: 'РРЅР¶РµРЅРµСЂ РѕС‚РєР°Р·Р°Р»СЃСЏ РѕС‚ Р·Р°СЏРІРєРё',
          message: `РРЅР¶РµРЅРµСЂ РѕС‚РєР°Р·Р°Р»СЃСЏ РѕС‚ Р·Р°СЏРІРєРё в„– ${request.externalRequestId}. РџСЂРёС‡РёРЅР°: ${reason}`,
          entityType: 'imported_request',
          entityId: requestId,
        },
      });
    }

    await logAudit({
      userId: req.userId,
      action: 'decline_request',
      entityType: 'imported_request',
      entityId: requestId,
      newValue: { reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// в”Ђв”Ђв”Ђ РњРђРЎРЎРћР’РћР• РќРђР—РќРђР§Р•РќРР• в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const bulkAssignSchema = z.object({
  requestIds: z.array(z.string().uuid()).min(1),
  engineerIds: z.array(z.string().uuid()).min(1),
});

router.post('/bulk-assign', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'tm' && req.userRole !== 'admin') {
      res.status(403).json({ error: 'Р”РѕСЃС‚СѓРї Р·Р°РїСЂРµС‰С‘РЅ' });
      return;
    }

    const parsed = bulkAssignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors });
      return;
    }

    const { requestIds, engineerIds } = parsed.data;

    // Р—Р°РіСЂСѓР¶Р°РµРј РґР°РЅРЅС‹Рµ РёРЅР¶РµРЅРµСЂРѕРІ (СЃРїРµС†РёР°Р»РёР·Р°С†РёРё)
    const engineers = await prisma.user.findMany({
      where: { id: { in: engineerIds }, role: 'engineer', isActive: true },
      select: {
        id: true, fullName: true,
        specializationVik: true, specializationIszh: true,
        specializationGpm: true, specializationDgu: true, specializationIbp: true,
      },
    });

    if (engineers.length !== engineerIds.length) {
      res.status(400).json({ error: 'РќРµРєРѕС‚РѕСЂС‹Рµ РёРЅР¶РµРЅРµСЂС‹ РЅРµ РЅР°Р№РґРµРЅС‹ РёР»Рё РЅРµ Р°РєС‚РёРІРЅС‹' });
      return;
    }

    const engineerMap = new Map(engineers.map(e => [e.id, e]));

    // Р—Р°РіСЂСѓР¶Р°РµРј Р·Р°СЏРІРєРё СЃ РІРёР·РёС‚Р°РјРё Рё С‚РёРїР°РјРё РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ
    const requests = await prisma.importedRequest.findMany({
      where: { id: { in: requestIds } },
      include: {
        equipmentType: { select: { id: true, name: true, code: true, specializationReq: true } },
        matchedAddress: { select: { id: true, fullAddress: true } },
        visit: {
          include: {
            visitEngineers: { select: { id: true, engineerId: true, isPrimary: true } },
          },
        },
      },
    });

    const results: { requestId: string; assigned: string[]; skipped: string[]; error?: string }[] = [];

    for (const request of requests) {
      const result: { requestId: string; assigned: string[]; skipped: string[]; error?: string } = {
        requestId: request.id,
        assigned: [],
        skipped: [],
      };

      if (!request.visitId || !request.visit) {
        result.error = 'Р’РёР·РёС‚ РЅРµ СЃРѕР·РґР°РЅ';
        results.push(result);
        continue;
      }

      const visit = request.visit;
      const requiredSpec = request.equipmentType.specializationReq;

      for (const engineerId of engineerIds) {
        const engineer = engineerMap.get(engineerId)!;

        // РџСЂРѕРІРµСЂРєР°: СѓР¶Рµ РЅР°Р·РЅР°С‡РµРЅ?
        const alreadyAssigned = visit.visitEngineers.some(ve => ve.engineerId === engineerId);
        if (alreadyAssigned) {
          result.skipped.push(engineerId);
          continue;
        }

        // РџСЂРѕРІРµСЂРєР° СЃРїРµС†РёР°Р»РёР·Р°С†РёРё
        if (requiredSpec) {
          const specMap: Record<string, keyof typeof engineer> = {
            vik: 'specializationVik',
            iszh: 'specializationIszh',
            gpm: 'specializationGpm',
            dgu: 'specializationDgu',
            ibp: 'specializationIbp',
          };
          const specField = specMap[requiredSpec];
          if (specField && !engineer[specField]) {
            result.skipped.push(engineerId);
            continue;
          }
        }

        // РЎРѕР·РґР°С‘Рј VisitEngineer
        const isPrimary = visit.visitEngineers.length === 0 && result.assigned.length === 0;
        await prisma.visitEngineer.create({
          data: {
            visitId: visit.id,
            engineerId,
            isPrimary,
            assignedBy: req.userId!,
          },
        });

        result.assigned.push(engineerId);

        // РћР±РЅРѕРІР»СЏРµРј РІРёР·РёС‚ РїСЂРё РїРµСЂРІРѕРј РЅР°Р·РЅР°С‡РµРЅРёРё
        if (isPrimary) {
          await prisma.visit.update({
            where: { id: visit.id },
            data: {
              userId: engineerId,
              engineerName: engineer.fullName,
              status: 'planned',
            },
          });
        }

        // Р—Р°РїРёСЃСЊ РІ Р»РѕРі РЅР°Р·РЅР°С‡РµРЅРёР№
        await prisma.requestAssignmentLog.create({
          data: {
            importedRequestId: request.id,
            action: 'assigned',
            engineerId,
            performedBy: req.userId!,
          },
        });

        // РЈРІРµРґРѕРјР»РµРЅРёРµ РёРЅР¶РµРЅРµСЂСѓ
        await prisma.notification.create({
          data: {
            userId: engineerId,
            type: 'request_assigned',
            title: 'РќРѕРІР°СЏ Р·Р°СЏРІРєР°',
            message: `Р—Р°СЏРІРєР° в„– ${request.externalRequestId}. РћР±СЉРµРєС‚: ${request.matchedAddress?.fullAddress || request.addressRaw}. РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ: ${request.equipmentType.name}.`,
            entityType: 'visit',
            entityId: visit.id,
          },
        });
      }

      results.push(result);
    }

    await logAudit({
      userId: req.userId,
      action: 'bulk_assign_engineers',
      entityType: 'imported_request',
      newValue: { requestIds, engineerIds, results },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const totalAssigned = results.reduce((sum, r) => sum + r.assigned.length, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped.length, 0);

    res.json({
      results,
      summary: {
        totalRequests: requestIds.length,
        totalAssigned,
        totalSkipped,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// в”Ђв”Ђв”Ђ РџРћРРЎРљ Р—РђРЇР’РћРљ РџРћ РќРћРњР•Р РђРњ (РґР»СЏ РѕС‚С‡С‘С‚Р°) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
router.post('/search-by-numbers', async (req: AuthRequest, res: Response) => {
  try {
    const { externalRequestIds } = req.body;
    if (!Array.isArray(externalRequestIds) || externalRequestIds.length === 0) {
      res.status(400).json({ error: 'РЈРєР°Р¶РёС‚Рµ РЅРѕРјРµСЂР° Р·Р°СЏРІРѕРє' });
      return;
    }

    const where: any = {
      externalRequestId: { in: externalRequestIds },
    };

    // Р¤РёР»СЊС‚СЂР°С†РёСЏ РїРѕ С‚РµСЂСЂРёС‚РѕСЂРёРё РўРњ
    if (req.userRole === 'tm') {
      const tmObjects = await prisma.tmObject.findMany({
        where: { tmId: req.userId! },
        select: { addressId: true },
      });
      const addressIds = tmObjects.map(t => t.addressId);
      where.matchedAddressId = { in: addressIds };
    }

    const requests = await prisma.importedRequest.findMany({
      where,
      select: {
        id: true,
        externalRequestId: true,
        externalStatus: true,
        objectCode: true,
        importStatus: true,
        visitId: true,
        matchedAddress: { select: { fullAddress: true } },
        equipmentType: { select: { name: true } },
        visit: {
          select: {
            status: true,
            visitEngineers: {
              select: { engineer: { select: { fullName: true } } },
            },
          },
        },
      },
    });

    res.json({ data: requests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// в”Ђв”Ђв”Ђ Р”Р•РўРђР›Р Р—РђРЇР’РљР в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const request = await prisma.importedRequest.findUnique({
      where: { id: req.params.id as string },
      include: {
        equipmentType: true,
        matchedAddress: true,
        visit: {
          include: {
            tasks: { include: { equipmentType: true } },
            visitEngineers: { include: { engineer: { select: { id: true, fullName: true, email: true } } } },
          },
        },
        assignmentLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            engineer: { select: { id: true, fullName: true, email: true } },
            performer: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });
    if (!request) {
      res.status(404).json({ error: 'Р—Р°СЏРІРєР° РЅРµ РЅР°Р№РґРµРЅР°' });
      return;
    }
    res.json(request);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// в”Ђв”Ђв”Ђ РћР‘РќРћР’Р›Р•РќРР• РЎР•Р РР™РќРћР“Рћ РќРћРњР•Р Рђ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const updateSerialNumberSchema = z.object({
  serialNumber: z.string().trim().max(200).nullable(),
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!['admin', 'tm'].includes(req.userRole!)) {
      res.status(403).json({ error: 'Р”РѕСЃС‚СѓРїРЅРѕ С‚РѕР»СЊРєРѕ РўРњ Рё Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂСѓ' });
      return;
    }

    const parsed = updateSerialNumberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors });
      return;
    }

    const request = await prisma.importedRequest.findUnique({
      where: { id: req.params.id as string },
      include: { equipmentType: true },
    });
    if (!request) {
      res.status(404).json({ error: 'Р—Р°СЏРІРєР° РЅРµ РЅР°Р№РґРµРЅР°' });
      return;
    }
    if (request.equipmentType?.code === 'iszh_object') {
      res.status(400).json({ error: 'Р”Р»СЏ Р·Р°СЏРІРѕРє РРЎР– РѕР±СЉРµРєС‚Р° СЃРµСЂРёР№РЅС‹Р№ РЅРѕРјРµСЂ РЅРµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ' });
      return;
    }

    const newSN = parsed.data.serialNumber?.trim() || null;

    // РћР±РЅРѕРІРёС‚СЊ serialNumber
    await prisma.importedRequest.update({
      where: { id: request.id },
      data: { serialNumber: newSN },
    });

    // РџРµСЂРµСЃС‡С‘С‚ РїСЂРёРІСЏР·РѕРє
    let bound = false;
    if (newSN && request.matchedAddressId && request.equipmentTypeCode && request.startDate && request.deadline) {
      // SN СѓРєР°Р·Р°РЅ вЂ” РёС‰РµРј РІРёР·РёС‚ РґР»СЏ РїСЂРёРІСЏР·РєРё
      // 1. Р Р°Р·РѕСЂРІР°С‚СЊ С‚РµРєСѓС‰СѓСЋ СЃРІСЏР·СЊ
      await prisma.visitRequest.deleteMany({ where: { importedRequestId: request.id } });

      // 2. РџРѕРёСЃРєР°С‚СЊ РІРёР·РёС‚
      const { findMatchingVisit } = await import('../utils/requestBinding.js');
      const matchingVisit = await findMatchingVisit(
        request.matchedAddressId,
        request.contractId,
        request.equipmentTypeCode,
        newSN,
        request.startDate,
        request.deadline,
      );

      if (matchingVisit) {
        // 3. РЎРѕР·РґР°С‚СЊ РЅРѕРІСѓСЋ СЃРІСЏР·СЊ
        await prisma.visitRequest.create({
          data: { visitId: matchingVisit.id, importedRequestId: request.id },
        });
        await prisma.importedRequest.update({
          where: { id: request.id },
          data: { visitId: matchingVisit.id },
        });
        bound = true;
      } else {
        // 4. Р’РµСЂРЅСѓС‚СЊ РЅР° РІРёСЂС‚СѓР°Р»СЊРЅС‹Р№ РІРёР·РёС‚ (РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ РёР»Рё СЃРѕР·РґР°С‚СЊ РЅРѕРІС‹Р№)
        let virtualVisitId: string;
        if (!request.visitId) {
          // visitId = null вЂ” СЃРѕР·РґР°С‘Рј РЅРѕРІС‹Р№ РІРёСЂС‚СѓР°Р»СЊРЅС‹Р№ РІРёР·РёС‚
          const virtualVisit = await prisma.visit.create({
            data: {
              addressId: request.matchedAddressId,
              contractId: request.contractId,
              engineerName: '',
              userId: null,
              dateStart: new Date(),
              timeStart: '09:00',
              season: getCurrentSeason(),
              status: 'awaiting_assignment',
            },
          });
          virtualVisitId = virtualVisit.id;
        } else {
          const currentVisit = await prisma.visit.findUnique({
            where: { id: request.visitId },
          });
          if (currentVisit && currentVisit.status === 'awaiting_assignment' && !currentVisit.userId) {
            // РўРµРєСѓС‰РёР№ РІРёР·РёС‚ СѓР¶Рµ РІРёСЂС‚СѓР°Р»СЊРЅС‹Р№ вЂ” РїРµСЂРµРёСЃРїРѕР»СЊР·СѓРµРј
            virtualVisitId = currentVisit.id;
          } else {
            // РЎРѕР·РґР°С‘Рј РЅРѕРІС‹Р№ РІРёСЂС‚СѓР°Р»СЊРЅС‹Р№ РІРёР·РёС‚
            const virtualVisit = await prisma.visit.create({
              data: {
                addressId: request.matchedAddressId,
                contractId: request.contractId,
                engineerName: '',
                userId: null,
                dateStart: new Date(),
                timeStart: '09:00',
                season: getCurrentSeason(),
                status: 'awaiting_assignment',
              },
            });
            virtualVisitId = virtualVisit.id;
          }
        }
        await prisma.importedRequest.update({
          where: { id: request.id },
          data: { visitId: virtualVisitId },
        });
      }
    } else if (!newSN) {
      // SN РѕС‡РёС‰РµРЅ (null) вЂ” СЂР°Р·СЂС‹РІР°РµРј С‚РµРєСѓС‰РёРµ СЃРІСЏР·Рё
      await prisma.visitRequest.deleteMany({ where: { importedRequestId: request.id } });
      // Р’РѕР·РІСЂР°С‰Р°РµРј РЅР° РІРёСЂС‚СѓР°Р»СЊРЅС‹Р№ РІРёР·РёС‚
      if (request.visitId) {
        const currentVisit = await prisma.visit.findUnique({ where: { id: request.visitId } });
        if (currentVisit && currentVisit.status === 'awaiting_assignment' && !currentVisit.userId) {
          // РЈР¶Рµ РЅР° РІРёСЂС‚СѓР°Р»СЊРЅРѕРј вЂ” РЅРёС‡РµРіРѕ РЅРµ РґРµР»Р°РµРј
        } else {
          const virtualVisit = await prisma.visit.create({
            data: {
              addressId: request.matchedAddressId!,
              contractId: request.contractId,
              engineerName: '',
              userId: null,
              dateStart: new Date(),
              timeStart: '09:00',
              season: getCurrentSeason(),
              status: 'awaiting_assignment',
            },
          });
          await prisma.importedRequest.update({
            where: { id: request.id },
            data: { visitId: virtualVisit.id },
          });
        }
      }
    }

    // Р›РѕРіРёСЂРѕРІР°РЅРёРµ
    await prisma.requestAssignmentLog.create({
      data: {
        importedRequestId: request.id,
        action: bound ? 'assigned' : 'unassigned',
        performedBy: req.userId,
        reason: `РР·РјРµРЅС‘РЅ serialNumber: ${newSN || '(РїСѓСЃС‚Рѕ)'}`,
      },
    });

    res.json({ success: true, bound, serialNumber: newSN });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// в”Ђв”Ђв”Ђ Р РЈР§РќРђРЇ РџР РР’РЇР—РљРђ Рљ РћР‘РЄР•РљРўРЈ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const bindSchema = z.object({
  addressId: z.string().uuid(),
});

router.post('/:id/bind', async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'tm' && req.userRole !== 'admin') {
      res.status(403).json({ error: 'Р”РѕСЃС‚СѓРї Р·Р°РїСЂРµС‰С‘РЅ' });
      return;
    }

    const parsed = bindSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors });
      return;
    }

    const { addressId } = parsed.data;
    const request = await prisma.importedRequest.findUnique({
      where: { id: req.params.id as string },
    });
    if (!request) {
      res.status(404).json({ error: 'Р—Р°СЏРІРєР° РЅРµ РЅР°Р№РґРµРЅР°' });
      return;
    }
    if (request.importStatus !== 'error') {
      res.status(400).json({ error: 'Р—Р°СЏРІРєР° РЅРµ РІ СЃС‚Р°С‚СѓСЃРµ РѕС€РёР±РєРё' });
      return;
    }

    // РћР±РЅРѕРІР»СЏРµРј Р·Р°СЏРІРєСѓ
    const updated = await prisma.importedRequest.update({
      where: { id: req.params.id as string },
      data: {
        matchedAddressId: addressId,
        importStatus: 'matched',
        errorMessage: null,
      },
    });

    // РџСЂРѕРІРµСЂСЏРµРј, СЏРІР»СЏРµС‚СЃСЏ Р»Рё Р·Р°СЏРІРєР° РІРёРґРѕРј "РРЎР– РѕР±СЉРµРєС‚Р°"
    const eq = await prisma.equipmentType.findUnique({ where: { id: request.equipmentTypeId } });
    const isISZH = eq?.name.toLowerCase().includes('РёСЃР¶ РѕР±СЉРµРєС‚Р°') || !eq?.specializationReq;

    // РЎРѕР·РґР°С‘Рј РІРёР·РёС‚
    const visit = await prisma.visit.create({
      data: {
        userId: null,
        addressId,
        engineerName: '',
        dateStart: new Date(),
        timeStart: '09:00',
        season: getCurrentSeason(),
        status: 'awaiting_assignment',
        isMultiSpecialist: isISZH || false,
      },
    });

    // РћР±РЅРѕРІР»СЏРµРј Р·Р°СЏРІРєСѓ СЃ РІРёР·РёС‚РѕРј
    await prisma.importedRequest.update({
      where: { id: req.params.id as string },
      data: { visitId: visit.id, importStatus: 'created' },
    });

    // РЎРѕР·РґР°С‘Рј Р·Р°РґР°С‡Сѓ (РєСЂРѕРјРµ РРЎР– РѕР±СЉРµРєС‚Р°)
    if (!isISZH) {
      await prisma.task.create({
        data: {
          visitId: visit.id,
          equipmentTypeId: request.equipmentTypeId,
          externalRequestId: request.externalRequestId,
          status: 'not_started',
        },
      });
    }

    await logAudit({
      userId: req.userId,
      action: 'bind_request',
      entityType: 'imported_request',
      entityId: request.id,
      newValue: { addressId, visitId: visit.id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ request: updated, visit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
