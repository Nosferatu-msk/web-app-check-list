import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../models/prisma.js';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authMiddleware);

// ─── CREATE PROPOSAL (engineer) ──────────────────────────────
const createProposalSchema = z.object({
  addressId: z.string().uuid(),
  equipmentTypeCode: z.string().min(1),
  roomTypeCode: z.string().min(1),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  locationDescription: z.string().optional(),
});

router.post('/', validate(createProposalSchema), async (req: AuthRequest, res: Response) => {
  const proposal = await prisma.equipmentProposal.create({
    data: {
      addressId: req.body.addressId,
      equipmentTypeCode: req.body.equipmentTypeCode,
      roomTypeCode: req.body.roomTypeCode,
      brand: req.body.brand || null,
      model: req.body.model || null,
      serialNumber: req.body.serialNumber || null,
      locationDescription: req.body.locationDescription || null,
      proposedById: req.userId!,
      status: 'pending',
    },
    include: {
      address: true,
      proposedBy: { select: { id: true, fullName: true, email: true } },
    },
  });
  await logAudit({
    userId: req.userId,
    action: 'create',
    entityType: 'equipment_proposal',
    entityId: proposal.id,
    newValue: req.body,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(201).json(proposal);
});

// ─── LIST PROPOSALS (admin) ──────────────────────────────────
router.get('/admin', adminOnly, async (req: AuthRequest, res: Response) => {
  const status = req.query.status as string;
  const where: any = {};
  if (status) where.status = status;

  const proposals = await prisma.equipmentProposal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      address: true,
      proposedBy: { select: { id: true, fullName: true, email: true } },
      reviewedBy: { select: { id: true, fullName: true, email: true } },
    },
  });
  res.json(proposals);
});

// ─── APPROVE PROPOSAL (admin) ────────────────────────────────
router.put('/admin/:id/approve', adminOnly, async (req: AuthRequest, res: Response) => {
  const proposal = await prisma.equipmentProposal.findUnique({
    where: { id: req.params.id as string },
  });
  if (!proposal) {
    res.status(404).json({ error: 'Предложение не найдено' });
    return;
  }
  if (proposal.status !== 'pending') {
    res.status(400).json({ error: 'Предложение уже рассмотрено' });
    return;
  }

  // Create ObjectEquipment from proposal data
  await prisma.objectEquipment.create({
    data: {
      addressId: proposal.addressId,
      equipmentTypeCode: proposal.equipmentTypeCode,
      roomTypeCode: proposal.roomTypeCode,
      brand: proposal.brand,
      model: proposal.model,
      serialNumber: proposal.serialNumber,
      locationDescription: proposal.locationDescription,
    },
  });

  // Update proposal status
  const updated = await prisma.equipmentProposal.update({
    where: { id: proposal.id },
    data: {
      status: 'approved',
      reviewedById: req.userId,
      reviewedAt: new Date(),
    },
    include: {
      address: true,
      proposedBy: { select: { id: true, fullName: true, email: true } },
      reviewedBy: { select: { id: true, fullName: true, email: true } },
    },
  });

  await logAudit({
    userId: req.userId,
    action: 'approve',
    entityType: 'equipment_proposal',
    entityId: proposal.id,
    newValue: { proposalId: proposal.id },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(updated);
});

// ─── REJECT PROPOSAL (admin) ─────────────────────────────────
router.put('/admin/:id/reject', adminOnly, async (req: AuthRequest, res: Response) => {
  const proposal = await prisma.equipmentProposal.findUnique({
    where: { id: req.params.id as string },
  });
  if (!proposal) {
    res.status(404).json({ error: 'Предложение не найдено' });
    return;
  }
  if (proposal.status !== 'pending') {
    res.status(400).json({ error: 'Предложение уже рассмотрено' });
    return;
  }

  const updated = await prisma.equipmentProposal.update({
    where: { id: proposal.id },
    data: {
      status: 'rejected',
      reviewedById: req.userId,
      reviewedAt: new Date(),
    },
    include: {
      address: true,
      proposedBy: { select: { id: true, fullName: true, email: true } },
      reviewedBy: { select: { id: true, fullName: true, email: true } },
    },
  });

  await logAudit({
    userId: req.userId,
    action: 'reject',
    entityType: 'equipment_proposal',
    entityId: proposal.id,
    newValue: { proposalId: proposal.id },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(updated);
});

export default router;
