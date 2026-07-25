import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../models/prisma.js';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authMiddleware);

// ─── Helpers ─────────────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function notifyAdminsAndTMs(
  addressId: string,
  type: string,
  title: string,
  message: string,
  entityType: string,
  entityId: string,
) {
  // Администраторы
  const admins = await prisma.user.findMany({
    where: { role: 'admin', isActive: true },
    select: { id: true },
  });

  // ТМ, привязанные к объекту
  const tmObjects = await prisma.tmObject.findMany({
    where: { addressId },
    select: { tmId: true },
  });

  const userIds = new Set<string>();
  admins.forEach((a) => userIds.add(a.id));
  tmObjects.forEach((tm) => userIds.add(tm.tmId));

  if (userIds.size > 0) {
    await prisma.notification.createMany({
      data: Array.from(userIds).map((userId) => ({
        userId,
        type,
        title,
        message,
        entityType,
        entityId,
      })),
    });
  }
}

// ─── CREATE PROPOSAL (engineer) ──────────────────────────────
const createProposalSchema = z.object({
  addressId: z.string().uuid(),
  equipmentTypeCode: z.string().min(1),
  roomTypeCode: z.string().min(1),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  locationDescription: z.string().optional(),
  newManufacturer: z.object({
    name: z.string().min(1),
    country: z.string().optional(),
  }).optional(),
  newModel: z.object({
    modelName: z.string().min(1),
    fullModelName: z.string().optional(),
  }).optional(),
});

router.post('/', validate(createProposalSchema), async (req: AuthRequest, res: Response) => {
  const { addressId, equipmentTypeCode, roomTypeCode, brand, model, serialNumber, locationDescription, newManufacturer, newModel } = req.body;

  // Обработка нового производителя
  if (newManufacturer) {
    const existing = await prisma.manufacturer.findFirst({
      where: { name: { equals: newManufacturer.name, mode: 'insensitive' } },
    });
    if (!existing) {
      await prisma.manufacturer.create({
        data: { name: newManufacturer.name, country: newManufacturer.country || null },
      });
    }
  }

  // Обработка новой модели
  if (newModel) {
    const manufacturer = await prisma.manufacturer.findFirst({
      where: { name: { equals: brand || newManufacturer?.name || '', mode: 'insensitive' } },
    });
    if (manufacturer) {
      const eqType = await prisma.equipmentType.findUnique({ where: { code: equipmentTypeCode } });
      if (eqType) {
        const existingModel = await prisma.model.findFirst({
          where: { equipmentTypeId: eqType.id, manufacturerId: manufacturer.id, modelName: newModel.modelName },
        });
        if (!existingModel) {
          await prisma.model.create({
            data: {
              equipmentTypeId: eqType.id,
              manufacturerId: manufacturer.id,
              modelName: newModel.modelName,
              fullModelName: newModel.fullModelName || null,
              status: 'pending',
              submittedById: req.userId,
              submittedAt: new Date(),
            },
          });
        }
      }
    }
  }

  const pendingUntil = new Date(Date.now() + THIRTY_DAYS_MS);

  const proposal = await prisma.equipmentProposal.create({
    data: {
      addressId,
      equipmentTypeCode,
      roomTypeCode,
      brand: brand || null,
      model: model || null,
      serialNumber: serialNumber || null,
      locationDescription: locationDescription || null,
      proposedById: req.userId!,
      status: 'pending',
      requestType: 'new_equipment',
      pendingUntil,
    },
    include: {
      address: true,
      proposedBy: { select: { id: true, fullName: true, email: true } },
    },
  });

  await notifyAdminsAndTMs(
    addressId,
    'proposal_created',
    'Новое предложение по оборудованию',
    `Инженер добавил новое оборудование: ${brand || ''} ${model || ''}`.trim(),
    'equipment_proposal',
    proposal.id,
  );

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

// ─── ROOM CHANGE PROPOSAL (engineer) ─────────────────────────
const roomChangeSchema = z.object({
  objectEquipmentId: z.string().uuid(),
  newRoomTypeCode: z.string().min(1),
});

router.post('/room-change', validate(roomChangeSchema), async (req: AuthRequest, res: Response) => {
  const { objectEquipmentId, newRoomTypeCode } = req.body;

  const equipment = await prisma.objectEquipment.findUnique({
    where: { id: objectEquipmentId },
    include: { address: true },
  });

  if (!equipment || !equipment.isActive) {
    res.status(404).json({ error: 'Оборудование не найдено или неактивно' });
    return;
  }

  if (equipment.roomTypeCode === newRoomTypeCode) {
    res.status(400).json({ error: 'Оборудование уже находится в этом помещении' });
    return;
  }

  // Проверка: нет ли уже pending-proposal для этой записи
  const existingPending = await prisma.equipmentProposal.findFirst({
    where: { objectEquipmentId, status: 'pending' },
  });
  if (existingPending) {
    res.status(409).json({ error: 'Для этого оборудования уже есть ожидающий подтверждения запрос' });
    return;
  }

  const pendingUntil = new Date(Date.now() + THIRTY_DAYS_MS);

  // Транзакция: создаём proposal + обновляем equipment
  const [proposal] = await prisma.$transaction([
    prisma.equipmentProposal.create({
      data: {
        addressId: equipment.addressId,
        equipmentTypeCode: equipment.equipmentTypeCode,
        roomTypeCode: newRoomTypeCode,
        brand: equipment.brand,
        model: equipment.model,
        serialNumber: equipment.serialNumber,
        locationDescription: equipment.locationDescription,
        proposedById: req.userId!,
        status: 'pending',
        requestType: 'room_change',
        oldRoomTypeCode: equipment.roomTypeCode,
        pendingUntil,
        objectEquipmentId,
      },
      include: {
        address: true,
        proposedBy: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.objectEquipment.update({
      where: { id: objectEquipmentId },
      data: {
        roomTypeCode: newRoomTypeCode,
        confirmationStatus: 'pending',
        pendingUntil,
      },
    }),
  ]);

  await notifyAdminsAndTMs(
    equipment.addressId,
    'proposal_created',
    'Запрос на перенос оборудования',
    `Инженер предложил перенос оборудования: ${equipment.brand || ''} ${equipment.model || ''}`.trim(),
    'equipment_proposal',
    proposal.id,
  );

  await logAudit({
    userId: req.userId,
    action: 'create_room_change',
    entityType: 'equipment_proposal',
    entityId: proposal.id,
    newValue: { objectEquipmentId, newRoomTypeCode, oldRoomTypeCode: equipment.roomTypeCode },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json(proposal);
});

// ─── LIST MY PROPOSALS (engineer) ────────────────────────────
router.get('/my', async (req: AuthRequest, res: Response) => {
  const status = req.query.status as string;
  const where: any = { proposedById: req.userId };
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

// ─── UPDATE PROPOSAL (engineer, own pending) ─────────────────
const updateProposalSchema = z.object({
  roomTypeCode: z.string().min(1).optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  locationDescription: z.string().optional(),
});

router.patch('/:id', validate(updateProposalSchema), async (req: AuthRequest, res: Response) => {
  const proposal = await prisma.equipmentProposal.findUnique({
    where: { id: req.params.id as string },
  });

  if (!proposal) {
    res.status(404).json({ error: 'Предложение не найдено' });
    return;
  }
  if (proposal.proposedById !== req.userId) {
    res.status(403).json({ error: 'Можно редактировать только свои предложения' });
    return;
  }
  if (proposal.status !== 'pending') {
    res.status(400).json({ error: 'Можно редактировать только ожидающие предложения' });
    return;
  }

  // Если это room_change и изменился roomTypeCode — обновить и object_equipment
  if (proposal.requestType === 'room_change' && req.body.roomTypeCode && req.body.roomTypeCode !== proposal.roomTypeCode) {
    await prisma.objectEquipment.update({
      where: { id: proposal.objectEquipmentId! },
      data: { roomTypeCode: req.body.roomTypeCode },
    });
  }

  const updated = await prisma.equipmentProposal.update({
    where: { id: proposal.id },
    data: req.body,
    include: {
      address: true,
      proposedBy: { select: { id: true, fullName: true, email: true } },
    },
  });

  await logAudit({
    userId: req.userId,
    action: 'update',
    entityType: 'equipment_proposal',
    entityId: proposal.id,
    newValue: req.body,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(updated);
});

// ─── DELETE (CANCEL) PROPOSAL (engineer, own pending) ────────
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const proposal = await prisma.equipmentProposal.findUnique({
    where: { id: req.params.id as string },
  });

  if (!proposal) {
    res.status(404).json({ error: 'Предложение не найдено' });
    return;
  }
  if (proposal.proposedById !== req.userId) {
    res.status(403).json({ error: 'Можно отменять только свои предложения' });
    return;
  }
  if (proposal.status !== 'pending') {
    res.status(400).json({ error: 'Можно отменять только ожидающие предложения' });
    return;
  }

  // Откат для room_change
  if (proposal.requestType === 'room_change' && proposal.objectEquipmentId && proposal.oldRoomTypeCode) {
    await prisma.objectEquipment.update({
      where: { id: proposal.objectEquipmentId },
      data: {
        roomTypeCode: proposal.oldRoomTypeCode,
        confirmationStatus: 'confirmed',
        pendingUntil: null,
      },
    });
  }

  // Деактивация для new_equipment
  if (proposal.requestType === 'new_equipment' && proposal.objectEquipmentId) {
    await prisma.objectEquipment.update({
      where: { id: proposal.objectEquipmentId },
      data: {
        isActive: false,
        confirmationStatus: 'confirmed',
        pendingUntil: null,
      },
    });
  }

  // Помечаем как rejected (не удаляем физически)
  const updated = await prisma.equipmentProposal.update({
    where: { id: proposal.id },
    data: {
      status: 'rejected',
      reviewedById: req.userId,
      reviewedAt: new Date(),
      rejectionReason: 'Отменено инженером',
    },
  });

  await logAudit({
    userId: req.userId,
    action: 'cancel',
    entityType: 'equipment_proposal',
    entityId: proposal.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(updated);
});

// ─── LIST PROPOSALS (admin) ──────────────────────────────────
router.get('/admin', adminOnly, async (req: AuthRequest, res: Response) => {
  const status = req.query.status as string;
  const requestType = req.query.request_type as string;
  const addressId = req.query.address_id as string;
  const engineerId = req.query.engineer_id as string;
  const expiringSoon = req.query.expiring_soon === 'true';

  const where: any = {};
  if (status) where.status = status;
  if (requestType) where.requestType = requestType;
  if (addressId) where.addressId = addressId;
  if (engineerId) where.proposedById = engineerId;
  if (expiringSoon) {
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    where.pendingUntil = { lte: threeDaysFromNow, gt: new Date() };
    where.status = 'pending';
  }

  const proposals = await prisma.equipmentProposal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      address: true,
      proposedBy: { select: { id: true, fullName: true, email: true } },
      reviewedBy: { select: { id: true, fullName: true, email: true } },
      objectEquipment: true,
    },
  });

  // Подсчёт summary
  const pendingCount = await prisma.equipmentProposal.count({ where: { status: 'pending' } });
  const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const expiringSoonCount = await prisma.equipmentProposal.count({
    where: {
      status: 'pending',
      pendingUntil: { lte: threeDays, gt: new Date() },
    },
  });

  res.json({
    data: proposals,
    summary: {
      total: proposals.length,
      pending: pendingCount,
      expiringSoon: expiringSoonCount,
    },
  });
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

  if (proposal.requestType === 'room_change') {
    // Перенос уже применён — просто подтверждаем
    if (proposal.objectEquipmentId) {
      await prisma.objectEquipment.update({
        where: { id: proposal.objectEquipmentId },
        data: {
          confirmationStatus: 'confirmed',
          pendingUntil: null,
          roomConfirmedAt: new Date(),
          roomConfirmedBy: req.userId,
        },
      });
    }
  } else {
    // new_equipment — создаём object_equipment
    const created = await prisma.objectEquipment.create({
      data: {
        addressId: proposal.addressId,
        equipmentTypeCode: proposal.equipmentTypeCode,
        roomTypeCode: proposal.roomTypeCode,
        brand: proposal.brand,
        model: proposal.model,
        serialNumber: proposal.serialNumber,
        locationDescription: proposal.locationDescription,
        confirmationStatus: 'confirmed',
        createdBy: proposal.proposedById,
      },
    });

    // Связываем proposal с созданным equipment
    await prisma.equipmentProposal.update({
      where: { id: proposal.id },
      data: { objectEquipmentId: created.id },
    });
  }

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

  // Уведомление инженеру
  await prisma.notification.create({
    data: {
      userId: proposal.proposedById,
      type: 'proposal_approved',
      title: 'Предложение подтверждено',
      message: `Ваше предложение по оборудованию подтверждено администратором`,
      entityType: 'equipment_proposal',
      entityId: proposal.id,
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
const rejectSchema = z.object({
  reason: z.string().optional(),
});

router.put('/admin/:id/reject', validate(rejectSchema), adminOnly, async (req: AuthRequest, res: Response) => {
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

  const reason = req.body.reason || null;

  // Откат для room_change
  if (proposal.requestType === 'room_change' && proposal.objectEquipmentId && proposal.oldRoomTypeCode) {
    await prisma.objectEquipment.update({
      where: { id: proposal.objectEquipmentId },
      data: {
        roomTypeCode: proposal.oldRoomTypeCode,
        confirmationStatus: 'confirmed',
        pendingUntil: null,
      },
    });
  }

  // Деактивация для new_equipment
  if (proposal.requestType === 'new_equipment' && proposal.objectEquipmentId) {
    await prisma.objectEquipment.update({
      where: { id: proposal.objectEquipmentId },
      data: {
        isActive: false,
        confirmationStatus: 'confirmed',
        pendingUntil: null,
      },
    });
  }

  const updated = await prisma.equipmentProposal.update({
    where: { id: proposal.id },
    data: {
      status: 'rejected',
      reviewedById: req.userId,
      reviewedAt: new Date(),
      rejectionReason: reason,
    },
    include: {
      address: true,
      proposedBy: { select: { id: true, fullName: true, email: true } },
      reviewedBy: { select: { id: true, fullName: true, email: true } },
    },
  });

  // Уведомление инженеру
  await prisma.notification.create({
    data: {
      userId: proposal.proposedById,
      type: 'proposal_rejected',
      title: 'Предложение отклонено',
      message: reason
        ? `Ваше предложение отклонено. Причина: ${reason}`
        : 'Ваше предложение по оборудованию отклонено администратором',
      entityType: 'equipment_proposal',
      entityId: proposal.id,
    },
  });

  await logAudit({
    userId: req.userId,
    action: 'reject',
    entityType: 'equipment_proposal',
    entityId: proposal.id,
    newValue: { proposalId: proposal.id, reason },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(updated);
});

// ─── BATCH ACTIONS (admin) ───────────────────────────────────
const batchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
});

router.put('/admin/batch', validate(batchSchema), adminOnly, async (req: AuthRequest, res: Response) => {
  const { ids, action, reason } = req.body;
  const results = { approved: 0, rejected: 0, errors: [] as { id: string; message: string }[] };

  for (const id of ids) {
    try {
      const proposal = await prisma.equipmentProposal.findUnique({ where: { id } });
      if (!proposal || proposal.status !== 'pending') {
        results.errors.push({ id, message: 'Предложение не найдено или уже рассмотрено' });
        continue;
      }

      if (action === 'approve') {
        if (proposal.requestType === 'room_change' && proposal.objectEquipmentId) {
          await prisma.objectEquipment.update({
            where: { id: proposal.objectEquipmentId },
            data: {
              confirmationStatus: 'confirmed',
              pendingUntil: null,
              roomConfirmedAt: new Date(),
              roomConfirmedBy: req.userId,
            },
          });
        } else {
          const created = await prisma.objectEquipment.create({
            data: {
              addressId: proposal.addressId,
              equipmentTypeCode: proposal.equipmentTypeCode,
              roomTypeCode: proposal.roomTypeCode,
              brand: proposal.brand,
              model: proposal.model,
              serialNumber: proposal.serialNumber,
              locationDescription: proposal.locationDescription,
              confirmationStatus: 'confirmed',
              createdBy: proposal.proposedById,
            },
          });
          await prisma.equipmentProposal.update({
            where: { id },
            data: { objectEquipmentId: created.id },
          });
        }

        await prisma.equipmentProposal.update({
          where: { id },
          data: { status: 'approved', reviewedById: req.userId, reviewedAt: new Date() },
        });

        await prisma.notification.create({
          data: {
            userId: proposal.proposedById,
            type: 'proposal_approved',
            title: 'Предложение подтверждено',
            message: 'Ваше предложение по оборудованию подтверждено администратором',
            entityType: 'equipment_proposal',
            entityId: id,
          },
        });

        results.approved++;
      } else {
        if (proposal.requestType === 'room_change' && proposal.objectEquipmentId && proposal.oldRoomTypeCode) {
          await prisma.objectEquipment.update({
            where: { id: proposal.objectEquipmentId },
            data: {
              roomTypeCode: proposal.oldRoomTypeCode,
              confirmationStatus: 'confirmed',
              pendingUntil: null,
            },
          });
        }

        if (proposal.requestType === 'new_equipment' && proposal.objectEquipmentId) {
          await prisma.objectEquipment.update({
            where: { id: proposal.objectEquipmentId },
            data: { isActive: false, confirmationStatus: 'confirmed', pendingUntil: null },
          });
        }

        await prisma.equipmentProposal.update({
          where: { id },
          data: {
            status: 'rejected',
            reviewedById: req.userId,
            reviewedAt: new Date(),
            rejectionReason: reason || null,
          },
        });

        await prisma.notification.create({
          data: {
            userId: proposal.proposedById,
            type: 'proposal_rejected',
            title: 'Предложение отклонено',
            message: reason
              ? `Ваше предложение отклонено. Причина: ${reason}`
              : 'Ваше предложение по оборудованию отклонено администратором',
            entityType: 'equipment_proposal',
            entityId: id,
          },
        });

        results.rejected++;
      }
    } catch (err) {
      results.errors.push({ id, message: err instanceof Error ? err.message : 'Неизвестная ошибка' });
    }
  }

  await logAudit({
    userId: req.userId,
    action: `batch_${action}`,
    entityType: 'equipment_proposal',
    newValue: { ids, action, results },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.json(results);
});

export default router;
