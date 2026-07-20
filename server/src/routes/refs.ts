import { Router, Response } from 'express';
import prisma from '../models/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/refs/equipment-types
router.get('/equipment-types', async (_req: AuthRequest, res: Response) => {
  const data = await prisma.equipmentType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  res.json(data);
});

// GET /api/refs/room-types
router.get('/room-types', async (_req: AuthRequest, res: Response) => {
  const data = await prisma.roomType.findMany({ orderBy: { name: 'asc' } });
  res.json(data);
});

// GET /api/refs/recommendations?equipment_type_id=...
router.get('/recommendations', async (req: AuthRequest, res: Response) => {
  const equipmentTypeId = req.query.equipment_type_id as string;
  const where: any = { isActive: true };
  if (equipmentTypeId) where.equipmentTypeId = equipmentTypeId;
  const data = await prisma.recommendation.findMany({ where, orderBy: { sortOrder: 'asc' } });
  res.json(data);
});

// GET /api/refs/addresses/search?q=...
router.get('/addresses/search', async (req: AuthRequest, res: Response) => {
  const q = req.query.q as string;
  if (!q || q.length < 2) { res.json([]); return; }

  const textFilter = { AND: [{ isDeleted: false }, { OR: [{ fullAddress: { contains: q, mode: 'insensitive' } }, { street: { contains: q, mode: 'insensitive' } }] }] };

  // Role-based filtering: engineer sees only TM's addresses, tm sees own, admin sees all
  let addressIds: string[] | null = null;
  if (req.userRole === 'engineer') {
    const assignment = await prisma.tmEngineer.findUnique({ where: { engineerId: req.userId as string } });
    if (assignment) {
      const tmObjects = await prisma.tmObject.findMany({ where: { tmId: assignment.tmId }, select: { addressId: true } });
      addressIds = tmObjects.map(t => t.addressId);
    } else {
      res.json([]); return;
    }
  } else if (req.userRole === 'tm') {
    const tmObjects = await prisma.tmObject.findMany({ where: { tmId: req.userId as string }, select: { addressId: true } });
    addressIds = tmObjects.map(t => t.addressId);
  }

  const where: any = addressIds !== null
    ? { AND: [textFilter, { id: { in: addressIds } }] }
    : textFilter;

  const data = await prisma.address.findMany({ where, take: 20 });
  res.json(data);
});

// GET /api/refs/object-equipment?address_id=...&specialization=vik|iszh

router.get('/object-equipment', async (req: AuthRequest, res: Response) => {
  const addressId = req.query.address_id as string;
  if (!addressId) { res.json([]); return; }

  const VIK_CODES = ['vent', 'vrv_vn', 'vrv_nar', 'mssvn', 'mssnar', 'splitvn', 'splitnar', 'teplozavesa', 'pritochnaya', 'pritochno-vytyzhnaya', 'vytyzhnaya'];
  const ISZH_CODES = ['rsch', 'schetchik_gvs', 'schetchik_hvs', 'schetchik_electroshc', 'seti_vodosnab', 'teplovye_seti'];

  // Determine which codes to filter by
  let allowedCodes: string[] | null = null;
  const specParam = req.query.specialization as string;

  if (specParam === 'vik') {
    allowedCodes = VIK_CODES;
  } else if (specParam === 'iszh') {
    allowedCodes = ISZH_CODES;
  } else if (req.userRole === 'engineer') {
    const engineer = await prisma.user.findUnique({
      where: { id: req.userId as string },
      select: { specializationVik: true, specializationIszh: true },
    });
    if (engineer) {
      const hasVik = engineer.specializationVik;
      const hasIszh = engineer.specializationIszh;
      if (hasVik && !hasIszh) {
        allowedCodes = VIK_CODES;
      } else if (hasIszh && !hasVik) {
        allowedCodes = ISZH_CODES;
      }
    }
  }

  const where: any = { addressId, isActive: true };
  if (allowedCodes) {
    where.equipmentTypeCode = { in: allowedCodes };
  }

  // Фильтрация по уровню привязки (определяется по наличию roomTypeCode)
  const bindingLevel = req.query.binding_level as string;
  if (bindingLevel === 'room') {
    where.roomTypeCode = { not: null };
  } else if (bindingLevel === 'object') {
    where.roomTypeCode = null;
  }

  // Фильтрация по типу блока (наружный/внутренний)
  const isOutdoorParam = req.query.is_outdoor_unit as string;
  if (isOutdoorParam === 'true') {
    where.isOutdoorUnit = true;
  } else if (isOutdoorParam === 'false') {
    where.isOutdoorUnit = false;
  }

  // Фильтрация по помещению
  const roomTypeCode = req.query.room_type_code as string;
  if (roomTypeCode) {
    where.roomTypeCode = roomTypeCode;
  }

  const excludeVisitId = req.query.exclude_visit_id as string;
  if (excludeVisitId) {
    // Индивидуальные задачи — objectEquipmentId в task
    const usedEquipment = await prisma.task.findMany({
      where: { visitId: excludeVisitId, objectEquipmentId: { not: null } },
      select: { objectEquipmentId: true },
    });
    // Групповые задачи — objectEquipmentId в task_equipment_items
    const usedItems = await prisma.taskEquipmentItem.findMany({
      where: { task: { visitId: excludeVisitId } },
      select: { objectEquipmentId: true },
    });
    const usedIds = [
      ...usedEquipment.map(t => t.objectEquipmentId).filter(Boolean) as string[],
      ...usedItems.map(i => i.objectEquipmentId),
    ];
    if (usedIds.length > 0) {
      where.id = { notIn: usedIds };
    }
  }

  const data = await prisma.objectEquipment.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });

  res.json(data);
});

// GET /api/refs/object-equipment/rooms — список помещений с оборудованием для адреса
router.get('/object-equipment/rooms', async (req: AuthRequest, res: Response) => {
  const addressId = req.query.address_id as string;
  if (!addressId) { res.json([]); return; }

  const excludeVisitId = req.query.exclude_visit_id as string;

  // Получаем всё оборудование с привязкой к помещению
  const equipment = await prisma.objectEquipment.findMany({
    where: {
      addressId,
      isActive: true,
      roomTypeCode: { not: null },
    },
    select: { roomTypeCode: true, id: true },
  });

  // Исключаем уже добавленные в визит
  let usedIds: string[] = [];
  if (excludeVisitId) {
    const usedEquipment = await prisma.task.findMany({
      where: { visitId: excludeVisitId, objectEquipmentId: { not: null } },
      select: { objectEquipmentId: true },
    });
    usedIds = usedEquipment.map(t => t.objectEquipmentId).filter(Boolean) as string[];
  }

  // Группируем по roomTypeCode, считаем количество (исключая использованные)
  const roomMap = new Map<string, number>();
  for (const eq of equipment) {
    if (usedIds.includes(eq.id)) continue;
    const code = eq.roomTypeCode!;
    roomMap.set(code, (roomMap.get(code) || 0) + 1);
  }

  // Получаем названия помещений
  const roomCodes = Array.from(roomMap.keys());
  if (roomCodes.length === 0) { res.json([]); return; }

  const roomTypes = await prisma.roomType.findMany({
    where: { code: { in: roomCodes } },
    select: { code: true, name: true },
  });

  const result = roomTypes.map(rt => ({
    code: rt.code,
    name: rt.name,
    count: roomMap.get(rt.code) || 0,
  })).sort((a, b) => a.name.localeCompare(b.name));

  res.json(result);
});

// GET /api/refs/engineers — list engineers (admin: all, tm: own group)
router.get('/engineers', async (req: AuthRequest, res: Response) => {
  const role = req.userRole;
  if (role === 'admin') {
    const data = await prisma.user.findMany({
      where: { role: 'engineer', isActive: true },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
    });
    res.json(data);
  } else if (role === 'tm') {
    const assignments = await prisma.tmEngineer.findMany({
      where: { tmId: req.userId as string },
      select: { engineer: { select: { id: true, fullName: true, email: true } } },
    });
    res.json(assignments.map(a => a.engineer));
  } else {
    res.json([]);
  }
});

// PATCH /api/refs/object-equipment/:id/room — confirm room for equipment
router.patch('/object-equipment/:id/room', async (req: AuthRequest, res: Response) => {
  const roomTypeCode = req.body?.roomTypeCode as string;
  if (!roomTypeCode) { res.status(400).json({ error: 'Не указан roomTypeCode' }); return; }

  const existing = await prisma.objectEquipment.findUnique({ where: { id: req.params.id as string } });
  if (!existing) { res.status(404).json({ error: 'Запись не найдена' }); return; }
  if (existing.roomTypeCode) {
    res.status(409).json({ error: 'Помещение уже указано' });
    return;
  }

  const rmType = await prisma.roomType.findFirst({ where: { code: roomTypeCode } });
  if (!rmType) {
    res.status(400).json({ error: 'Тип помещения не найден в справочнике' });
    return;
  }

  const item = await prisma.objectEquipment.update({
    where: { id: req.params.id as string },
    data: {
      roomTypeCode,
      roomConfirmedAt: new Date(),
      roomConfirmedBy: req.userId,
    },
  });
  res.json(item);
});

export default router;
