/**
 * Диагностический скрипт для проверки синхронизации roomTypeCode между
 * Task.objectEquipmentId → ObjectEquipment.roomTypeCode
 * 
 * Проблема: Если инженер добавлял оборудование из помещения A в помещение B,
 * но room_change proposal не создавался (баг в VisitPage.tsx строка 549),
 * то ObjectEquipment.roomTypeCode остаётся равным помещению A.
 * 
 * Скрипт:
 * 1. Находит все задачи с objectEquipmentId
 * 2. Проверяет, совпадает ли task.roomTypeCode с objectEquipment.roomTypeCode
 * 3. Если не совпадает — это рассинхронизация
 * 4. Создаёт room_change proposals для исправления
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Mismatch {
  taskId: string;
  visitId: string;
  addressId: string;
  objectCode: string;
  equipmentTypeCode: string;
  taskRoomTypeCode: string | null;
  equipmentRoomTypeCode: string | null;
  objectEquipmentId: string;
}

async function main() {
  console.log('🔍 Диагностика синхронизации roomTypeCode между Task и ObjectEquipment...\n');

  // Найти все задачи с objectEquipmentId
  const tasks = await prisma.task.findMany({
    where: {
      objectEquipmentId: { not: null },
    },
    include: {
      visit: {
        include: {
          address: {
            select: {
              id: true,
              objectCode: true,
              fullAddress: true,
            },
          },
        },
      },
      equipmentType: {
        select: {
          code: true,
          name: true,
        },
      },
      objectEquipment: {
        select: {
          id: true,
          roomTypeCode: true,
          equipmentTypeCode: true,
        },
      },
    },
  });

  console.log(`Найдено задач с objectEquipmentId: ${tasks.length}\n`);

  // Найти рассинхронизации
  const mismatches: Mismatch[] = [];

  for (const task of tasks) {
    if (!task.objectEquipment) continue;

    const taskRoom = task.roomTypeCode;
    const equipmentRoom = task.objectEquipment.roomTypeCode;

    // Если roomTypeCode не совпадает — это рассинхронизация
    if (taskRoom !== equipmentRoom) {
      mismatches.push({
        taskId: task.id,
        visitId: task.visitId,
        addressId: task.visit.addressId,
        objectCode: task.visit.address.objectCode,
        equipmentTypeCode: task.objectEquipment.equipmentTypeCode,
        taskRoomTypeCode: taskRoom,
        equipmentRoomTypeCode: equipmentRoom,
        objectEquipmentId: task.objectEquipment.id,
      });
    }
  }

  console.log(`\n📊 Найдено рассинхронизаций: ${mismatches.length}\n`);

  if (mismatches.length === 0) {
    console.log('✅ Все данные синхронизированы!');
    return;
  }

  // Группировка по объектам
  const byObject = new Map<string, Mismatch[]>();
  for (const m of mismatches) {
    const key = m.objectCode;
    if (!byObject.has(key)) byObject.set(key, []);
    byObject.get(key)!.push(m);
  }

  console.log('📋 Рассинхронизации по объектам:\n');
  for (const [objectCode, items] of byObject.entries()) {
    console.log(`  ${objectCode}: ${items.length} рассинхронизаций`);
  }

  console.log('\n🔍 Детали рассинхронизаций (первые 20):\n');
  for (const m of mismatches.slice(0, 20)) {
    console.log(`  Задача: ${m.taskId}`);
    console.log(`    Объект: ${m.objectCode}`);
    console.log(`    Тип оборудования: ${m.equipmentTypeCode}`);
    console.log(`    Task roomTypeCode: ${m.taskRoomTypeCode || 'null'}`);
    console.log(`    Equipment roomTypeCode: ${m.equipmentRoomTypeCode || 'null'}`);
    console.log('');
  }

  if (mismatches.length > 20) {
    console.log(`  ... и ещё ${mismatches.length - 20} рассинхронизаций\n`);
  }

  // Создание room_change proposals для исправления
  console.log('\n🔧 Создание room_change proposals для исправления...\n');

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const m of mismatches) {
    // Пропускаем, если у оборудования нет roomTypeCode (уровень объекта)
    if (!m.equipmentRoomTypeCode) {
      console.log(`  ⏭️  Пропущено: ${m.objectCode} — оборудование на уровне объекта`);
      skipped++;
      continue;
    }

    // Пропускаем, если у задачи нет roomTypeCode
    if (!m.taskRoomTypeCode) {
      console.log(`  ⏭️  Пропущено: ${m.objectCode} — задача без помещения`);
      skipped++;
      continue;
    }

    try {
      // Проверить, нет ли уже proposal для этого оборудования (любой статус)
      const existingProposal = await prisma.equipmentProposal.findFirst({
        where: {
          objectEquipmentId: m.objectEquipmentId,
          requestType: 'room_change',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (existingProposal) {
        if (existingProposal.status === 'pending') {
          console.log(`  ⏭️  Пропущено: ${m.objectCode} — уже есть pending proposal`);
          skipped++;
          continue;
        } else if (existingProposal.status === 'approved') {
          console.log(`  ⚠️  Пропущено: ${m.objectCode} — proposal уже одобрен, но рассинхронизация есть (требует ручной проверки)`);
          skipped++;
          continue;
        } else if (existingProposal.status === 'rejected') {
          console.log(`  ⏭️  Пропущено: ${m.objectCode} — proposal был отклонён админом (не создаём повторно)`);
          skipped++;
          continue;
        }
      }

      // Создать room_change proposal
      const pendingUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней

      await prisma.equipmentProposal.create({
        data: {
          addressId: m.addressId,
          equipmentTypeCode: m.equipmentTypeCode,
          roomTypeCode: m.taskRoomTypeCode,
          proposedById: (await prisma.user.findFirst({ where: { role: 'admin' } }))?.id || 'system',
          status: 'pending',
          requestType: 'room_change',
          oldRoomTypeCode: m.equipmentRoomTypeCode,
          pendingUntil,
          objectEquipmentId: m.objectEquipmentId,
        },
      });

      // Сразу применить изменение к ObjectEquipment (как делает POST /proposals/room-change)
      await prisma.objectEquipment.update({
        where: { id: m.objectEquipmentId },
        data: {
          roomTypeCode: m.taskRoomTypeCode,
          confirmationStatus: 'pending',
          pendingUntil,
        },
      });

      created++;
      console.log(`  ✅ Создан proposal для ${m.objectCode}: ${m.equipmentRoomTypeCode} → ${m.taskRoomTypeCode}`);
    } catch (err: any) {
      errors++;
      console.log(`  ❌ Ошибка для ${m.objectCode}: ${err.message}`);
    }
  }

  console.log('\n📊 Итоги:');
  console.log(`  Создано proposals: ${created}`);
  console.log(`  Пропущено: ${skipped}`);
  console.log(`  Ошибок: ${errors}`);
  console.log(`  Всего рассинхронизаций: ${mismatches.length}`);

  console.log('\n✅ Диагностика завершена!');
  console.log('\n⚠️  ВАЖНО:');
  console.log('  Созданные proposals имеют статус "pending".');
  console.log('  Администратор должен одобрить их через панель модерации.');
  console.log('  После одобрения изменения будут подтверждены.');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
