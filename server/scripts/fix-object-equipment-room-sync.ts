/**
 * Скрипт: Восстановление связи ObjectEquipment.roomTypeCode из задач
 * 
 * Проблема: для задач типа group_climate ObjectEquipment.roomTypeCode не синхронизировался
 * из Task.roomTypeCode при создании/обновлении задачи. В результате оборудование
 * не отображалось в помещениях при следующем визите.
 * 
 * Решение: пройтись по всем задачам с roomTypeCode и обновить ObjectEquipment.roomTypeCode
 * 
 * Запуск: npx tsx scripts/fix-object-equipment-room-sync.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Диагностика: поиск задач с roomTypeCode, но без синхронизации с ObjectEquipment...\n');

  // 1. Индивидуальные задачи с objectEquipmentId и roomTypeCode
  const individualTasks = await prisma.task.findMany({
    where: {
      taskType: 'individual',
      objectEquipmentId: { not: null },
      roomTypeCode: { not: null },
    },
    select: {
      id: true,
      roomTypeCode: true,
      objectEquipment: {
        select: {
          id: true,
          roomTypeCode: true,
        },
      },
    },
  });

  const individualMismatch = individualTasks.filter(
    t => t.objectEquipment && t.objectEquipment.roomTypeCode !== t.roomTypeCode
  );

  console.log(`📋 Индивидуальные задачи с roomTypeCode: ${individualTasks.length}`);
  console.log(`⚠️  Из них с рассинхронизацией: ${individualMismatch.length}\n`);

  // 2. Group_climate задачи с equipmentItems и roomTypeCode
  const groupTasks = await prisma.task.findMany({
    where: {
      taskType: 'group_climate',
      roomTypeCode: { not: null },
      equipmentItems: { some: {} },
    },
    select: {
      id: true,
      roomTypeCode: true,
      equipmentItems: {
        select: {
          objectEquipmentId: true,
          objectEquipment: {
            select: {
              id: true,
              roomTypeCode: true,
            },
          },
        },
      },
    },
  });

  const groupMismatch: Array<{
    taskId: string;
    taskRoomCode: string;
    equipmentId: string;
    equipmentRoomCode: string | null;
  }> = [];

  for (const task of groupTasks) {
    for (const item of task.equipmentItems) {
      if (item.objectEquipment && item.objectEquipment.roomTypeCode !== task.roomTypeCode) {
        groupMismatch.push({
          taskId: task.id,
          taskRoomCode: task.roomTypeCode!,
          equipmentId: item.objectEquipmentId,
          equipmentRoomCode: item.objectEquipment.roomTypeCode,
        });
      }
    }
  }

  console.log(`📋 Group_climate задачи с roomTypeCode: ${groupTasks.length}`);
  console.log(`⚠️  Из них с рассинхронизацией: ${groupMismatch.length} единиц оборудования\n`);

  if (individualMismatch.length === 0 && groupMismatch.length === 0) {
    console.log('✅ Все данные синхронизированы. Исправление не требуется.');
    return;
  }

  console.log('🔧 Начинаю исправление...\n');

  // 3. Исправляем индивидуальные задачи
  let individualFixed = 0;
  for (const task of individualMismatch) {
    try {
      await prisma.objectEquipment.update({
        where: { id: task.objectEquipment!.id },
        data: { roomTypeCode: task.roomTypeCode },
      });
      individualFixed++;
    } catch (err: any) {
      if (err.code !== 'P2002') {
        console.error(`❌ Ошибка обновления equipment ${task.objectEquipment!.id}:`, err.message);
      }
    }
  }
  console.log(`✅ Индивидуальные задачи: исправлено ${individualFixed} из ${individualMismatch.length}\n`);

  // 4. Исправляем group_climate задачи
  const uniqueEquipmentIds = [...new Set(groupMismatch.map(m => m.equipmentId))];
  let groupFixed = 0;
  
  for (const equipmentId of uniqueEquipmentIds) {
    const mismatch = groupMismatch.find(m => m.equipmentId === equipmentId);
    if (!mismatch) continue;
    
    try {
      await prisma.objectEquipment.update({
        where: { id: equipmentId },
        data: { roomTypeCode: mismatch.taskRoomCode },
      });
      groupFixed++;
    } catch (err: any) {
      if (err.code !== 'P2002') {
        console.error(`❌ Ошибка обновления equipment ${equipmentId}:`, err.message);
      }
    }
  }
  console.log(`✅ Group_climate: исправлено ${groupFixed} единиц оборудования из ${uniqueEquipmentIds.length}\n`);

  console.log('🎉 Исправление завершено!');
  console.log(`📊 Итого: ${individualFixed + groupFixed} записей ObjectEquipment обновлено.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
