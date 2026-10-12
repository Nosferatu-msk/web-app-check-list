/**
 * Полная диагностика синхронизации roomTypeCode между Task и ObjectEquipment
 * 
 * Проверяет ВСЕ задачи с objectEquipmentId и анализирует рассинхронизации
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Полная диагностика синхронизации roomTypeCode...\n');

  // 1. Общая статистика
  const totalTasks = await prisma.task.count({
    where: { objectEquipmentId: { not: null } },
  });

  console.log(`📊 Всего задач с objectEquipmentId: ${totalTasks}\n`);

  // 2. Задачи с совпадающими roomTypeCode
  const tasksWithMatchingRoom = await prisma.task.count({
    where: {
      objectEquipmentId: { not: null },
      roomTypeCode: { not: null },
      objectEquipment: {
        roomTypeCode: { not: null },
      },
    },
  });

  console.log(`✅ Задачи с совпадающими roomTypeCode: ${tasksWithMatchingRoom}`);

  // 3. Задачи с разными roomTypeCode (рассинхронизация)
  const tasksWithMismatch = await prisma.task.findMany({
    where: {
      objectEquipmentId: { not: null },
      roomTypeCode: { not: null },
      objectEquipment: {
        roomTypeCode: { not: null },
      },
    },
    select: {
      id: true,
      roomTypeCode: true,
      objectEquipment: {
        select: {
          roomTypeCode: true,
        },
      },
    },
  });

  const mismatchCount = tasksWithMismatch.filter(
    (t) => t.roomTypeCode !== t.objectEquipment.roomTypeCode
  ).length;

  console.log(`❌ Задачи с разными roomTypeCode: ${mismatchCount}\n`);

  // 4. Задачи без roomTypeCode, но оборудование с roomTypeCode
  const tasksWithoutRoomButEquipmentHas = await prisma.task.count({
    where: {
      objectEquipmentId: { not: null },
      roomTypeCode: null,
      objectEquipment: {
        roomTypeCode: { not: null },
      },
    },
  });

  console.log(`⚠️  Задачи без roomTypeCode, но оборудование с roomTypeCode: ${tasksWithoutRoomButEquipmentHas}`);

  // 5. Задачи с roomTypeCode, но оборудование без roomTypeCode
  const tasksWithRoomButEquipmentWithout = await prisma.task.count({
    where: {
      objectEquipmentId: { not: null },
      roomTypeCode: { not: null },
      objectEquipment: {
        roomTypeCode: null,
      },
    },
  });

  console.log(`⚠️  Задачи с roomTypeCode, но оборудование без roomTypeCode: ${tasksWithRoomButEquipmentWithout}`);

  // 6. Оба без roomTypeCode (нормально — уровень объекта)
  const bothWithoutRoom = await prisma.task.count({
    where: {
      objectEquipmentId: { not: null },
      roomTypeCode: null,
      objectEquipment: {
        roomTypeCode: null,
      },
    },
  });

  console.log(`✅ Оба без roomTypeCode (уровень объекта): ${bothWithoutRoom}\n`);

  // 7. Детальный анализ рассинхронизаций
  if (mismatchCount > 0) {
    console.log('🔍 Детали рассинхронизаций (первые 20):\n');
    
    const mismatches = tasksWithMismatch
      .filter((t) => t.roomTypeCode !== t.objectEquipment.roomTypeCode)
      .slice(0, 20);

    for (const task of mismatches) {
      console.log(`  Задача: ${task.id}`);
      console.log(`    Task roomTypeCode: ${task.roomTypeCode}`);
      console.log(`    Equipment roomTypeCode: ${task.objectEquipment.roomTypeCode}`);
      console.log('');
    }
  }

  // 8. Анализ задач без roomTypeCode (но с roomTypeId)
  const tasksWithTypeIdButNoCode = await prisma.task.findMany({
    where: {
      objectEquipmentId: { not: null },
      roomTypeCode: null,
      roomTypeId: { not: null },
    },
    include: {
      visit: {
        include: {
          address: {
            select: {
              objectCode: true,
            },
          },
        },
      },
      objectEquipment: {
        select: {
          roomTypeCode: true,
        },
      },
    },
    take: 10,
  });

  if (tasksWithTypeIdButNoCode.length > 0) {
    console.log('🔍 Задачи с roomTypeId, но без roomTypeCode (первые 10):\n');
    
    for (const task of tasksWithTypeIdButNoCode) {
      console.log(`  Задача: ${task.id}`);
      console.log(`    Объект: ${task.visit.address.objectCode}`);
      console.log(`    roomTypeId: ${task.roomTypeId}`);
      console.log(`    roomTypeCode: ${task.roomTypeCode}`);
      console.log(`    Equipment roomTypeCode: ${task.objectEquipment.roomTypeCode}`);
      console.log('');
    }
  }

  console.log('✅ Диагностика завершена!');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
