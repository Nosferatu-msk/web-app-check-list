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
  const data = await prisma.address.findMany({
    where: { OR: [{ fullAddress: { contains: q, mode: 'insensitive' } }, { street: { contains: q, mode: 'insensitive' } }] },
    take: 20,
  });
  res.json(data);
});

// GET /api/refs/object-equipment?address_id=...
router.get('/object-equipment', async (req: AuthRequest, res: Response) => {
  const addressId = req.query.address_id as string;
  if (!addressId) { res.json([]); return; }
  const data = await prisma.objectEquipment.findMany({
    where: { addressId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(data);
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

export default router;
