import prisma from '../src/models/prisma.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function main() {
  console.log('=== Миграция привязок оборудования к помещениям ===\n');

  const pendingUntil = new Date(Date.now() + THIRTY_DAYS_MS);
  let created = 0;
  let skipped = 0;

  // 1. Индивидуальные задачи с objectEquipmentId из завершённых визитов
  const tasksWithEquipment = await prisma.task.findMany({
    where: {
      objectEquipmentId: { not: null },
      visit: { status: { in: ['completed', 'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm'] } },
    },
    include: {
      objectEquipment: true,
      roomType: true,
    },
  });

  console.log(`Найдено индивидуальных задач с оборудованием: ${tasksWithEquipment.length}`);

  for (const task of tasksWithEquipment) {
    const eq = task.objectEquipment;
    if (!eq) continue;

    const taskRoomCode = task.roomTypeCode || null;
    const eqRoomCode = eq.roomTypeCode || null;

    if (taskRoomCode === eqRoomCode) {
      skipped++;
      continue;
    }

    if (!taskRoomCode) {
      skipped++;
      continue;
    }

    // Проверяем, нет ли уже pending proposal
    const existing = await prisma.equipmentProposal.findFirst({
      where: { objectEquipmentId: eq.id, status: 'pending' },
    });
    if (existing) {
      console.log(`  ⏭ ${eq.id} — уже есть pending proposal`);
      skipped++;
      continue;
    }

    const visitUserId = (await prisma.task.findUnique({
      where: { id: task.id },
      select: { visit: { select: { userId: true } } },
    }))?.visit?.userId;

    const proposedById = eq.createdBy || visitUserId;
    if (!proposedById) {
      console.log(`  ⏭ ${eq.id} — не удалось определить автора`);
      skipped++;
      continue;
    }

    await prisma.equipmentProposal.create({
      data: {
        addressId: eq.addressId,
        equipmentTypeCode: eq.equipmentTypeCode,
        roomTypeCode: taskRoomCode,
        brand: eq.brand,
        model: eq.model,
        serialNumber: eq.serialNumber,
        locationDescription: eq.locationDescription,
        proposedById,
        status: 'pending',
        requestType: 'room_change',
        oldRoomTypeCode: eqRoomCode,
        pendingUntil,
        objectEquipmentId: eq.id,
      },
    });

    // Обновляем roomTypeCode сразу (как делает обычный room_change proposal)
    await prisma.objectEquipment.update({
      where: { id: eq.id },
      data: {
        roomTypeCode: taskRoomCode,
        confirmationStatus: 'pending',
        pendingUntil,
      },
    });

    console.log(`  ✅ ${eq.equipmentTypeCode} ${eq.brand || ''} ${eq.model || ''}: ${eqRoomCode || '∅'} → ${taskRoomCode}`);
    created++;
  }

  // 2. Групповые задачи (group_climate) — equipmentItems
  const climateItems = await prisma.taskEquipmentItem.findMany({
    where: {
      objectEquipmentId: { not: null },
      task: {
        taskType: 'group_climate',
        visit: { status: { in: ['completed', 'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm'] } },
      },
    },
    include: {
      objectEquipment: true,
      task: { include: { roomType: true } },
    },
  });

  console.log(`\nНайдено единиц климатического оборудования: ${climateItems.length}`);

  for (const item of climateItems) {
    const eq = item.objectEquipment;
    if (!eq) continue;

    const taskRoomCode = item.task.roomTypeCode || null;
    const eqRoomCode = eq.roomTypeCode || null;

    if (taskRoomCode === eqRoomCode) {
      skipped++;
      continue;
    }

    if (!taskRoomCode) {
      skipped++;
      continue;
    }

    const existing = await prisma.equipmentProposal.findFirst({
      where: { objectEquipmentId: eq.id, status: 'pending' },
    });
    if (existing) {
      console.log(`  ⏭ ${eq.id} — уже есть pending proposal`);
      skipped++;
      continue;
    }

    const visitUserId = (await prisma.task.findUnique({
      where: { id: item.taskId },
      select: { visit: { select: { userId: true } } },
    }))?.visit?.userId;

    const proposedById = eq.createdBy || visitUserId;
    if (!proposedById) {
      console.log(`  ⏭ ${eq.id} — не удалось определить автора`);
      skipped++;
      continue;
    }

    await prisma.equipmentProposal.create({
      data: {
        addressId: eq.addressId,
        equipmentTypeCode: eq.equipmentTypeCode,
        roomTypeCode: taskRoomCode,
        brand: eq.brand,
        model: eq.model,
        serialNumber: eq.serialNumber,
        locationDescription: eq.locationDescription,
        proposedById,
        status: 'pending',
        requestType: 'room_change',
        oldRoomTypeCode: eqRoomCode,
        pendingUntil,
        objectEquipmentId: eq.id,
      },
    });

    await prisma.objectEquipment.update({
      where: { id: eq.id },
      data: {
        roomTypeCode: taskRoomCode,
        confirmationStatus: 'pending',
        pendingUntil,
      },
    });

    console.log(`  ✅ ${eq.equipmentTypeCode} ${eq.brand || ''} ${eq.model || ''}: ${eqRoomCode || '∅'} → ${taskRoomCode}`);
    created++;
  }

  console.log(`\n=== Итого: создано proposals: ${created}, пропущено: ${skipped} ===`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
