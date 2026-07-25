import cron from 'node-cron';
import prisma from '../models/prisma.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

export function startCronJobs() {
  // Ежедневно в 03:00
  cron.schedule('0 3 * * *', async () => {
    console.log('[cron] Запуск обработки истёкших предложений...');
    try {
      await processExpiredProposals();
      console.log('[cron] Обработка завершена');
    } catch (err) {
      console.error('[cron] Ошибка:', err);
    }
  });

  console.log('[cron] Cron-задачи инициализированы');
}

async function processExpiredProposals() {
  const now = new Date();

  // Шаг 1: Пометить истёкшие proposals
  const expired = await prisma.equipmentProposal.findMany({
    where: {
      status: 'pending',
      pendingUntil: { lt: now },
    },
    select: { id: true },
  });

  if (expired.length === 0) return;

  const expiredIds = expired.map((e) => e.id);

  await prisma.equipmentProposal.updateMany({
    where: { id: { in: expiredIds } },
    data: { status: 'expired', reviewedAt: now },
  });

  // Шаг 2: Откатить object_equipment (для room_change)
  const roomChangeProposals = await prisma.equipmentProposal.findMany({
    where: {
      id: { in: expiredIds },
      requestType: 'room_change',
      objectEquipmentId: { not: null },
      oldRoomTypeCode: { not: null },
    },
    select: { objectEquipmentId: true, oldRoomTypeCode: true },
  });

  for (const ep of roomChangeProposals) {
    if (ep.objectEquipmentId && ep.oldRoomTypeCode) {
      await prisma.objectEquipment.update({
        where: { id: ep.objectEquipmentId },
        data: {
          roomTypeCode: ep.oldRoomTypeCode,
          confirmationStatus: 'confirmed',
          pendingUntil: null,
        },
      });
    }
  }

  // Шаг 3: Деактивировать object_equipment (для new_equipment)
  const newEquipmentProposals = await prisma.equipmentProposal.findMany({
    where: {
      id: { in: expiredIds },
      requestType: 'new_equipment',
      objectEquipmentId: { not: null },
    },
    select: { objectEquipmentId: true },
  });

  for (const ep of newEquipmentProposals) {
    if (ep.objectEquipmentId) {
      await prisma.objectEquipment.update({
        where: { id: ep.objectEquipmentId },
        data: {
          isActive: false,
          confirmationStatus: 'confirmed',
          pendingUntil: null,
        },
      });
    }
  }

  // Шаг 4: Пометить в активных визитах (только new_equipment)
  const newEqIds = newEquipmentProposals.map((ep) => ep.objectEquipmentId!).filter(Boolean);
  if (newEqIds.length > 0) {
    await prisma.taskEquipmentItem.updateMany({
      where: {
        objectEquipmentId: { in: newEqIds },
        task: {
          status: { in: ['not_started', 'in_progress'] },
        },
      },
      data: { status: 'removed_expired' },
    });
  }

  // Шаг 5: Уведомить инженеров об истечении (без дублей)
  const expiredProposals = await prisma.equipmentProposal.findMany({
    where: { id: { in: expiredIds } },
    select: { id: true, proposedById: true, brand: true, model: true },
  });

  for (const ep of expiredProposals) {
    const existingNotification = await prisma.notification.findFirst({
      where: { entityId: ep.id, type: 'proposal_expired' },
    });

    if (!existingNotification) {
      const equipName = [ep.brand, ep.model].filter(Boolean).join(' ') || 'оборудование';
      await prisma.notification.create({
        data: {
          userId: ep.proposedById,
          type: 'proposal_expired',
          title: 'Оборудование не подтверждено',
          message: `Оборудование "${equipName}" удалено из справочника, т.к. не было подтверждено`,
          entityType: 'equipment_proposal',
          entityId: ep.id,
        },
      });
    }
  }

  // Шаг 6: Предупреждение за 3 дня до истечения
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const expiringSoon = await prisma.equipmentProposal.findMany({
    where: {
      status: 'pending',
      pendingUntil: { gte: now, lte: threeDaysFromNow },
    },
    select: { id: true, proposedById: true, brand: true, model: true, pendingUntil: true },
  });

  for (const ep of expiringSoon) {
    const existingNotification = await prisma.notification.findFirst({
      where: { entityId: ep.id, type: 'proposal_expiring_soon' },
    });

    if (!existingNotification && ep.pendingUntil) {
      const daysLeft = Math.ceil((ep.pendingUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const equipName = [ep.brand, ep.model].filter(Boolean).join(' ') || 'оборудование';
      await prisma.notification.create({
        data: {
          userId: ep.proposedById,
          type: 'proposal_expiring_soon',
          title: 'Предложение скоро истечёт',
          message: `Оборудование "${equipName}" будет удалено через ${daysLeft} дн.`,
          entityType: 'equipment_proposal',
          entityId: ep.id,
        },
      });
    }
  }
}
