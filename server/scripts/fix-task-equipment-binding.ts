/**
 * Исправление привязки задач к оборудованию после approve proposals
 * 
 * Проблема: При approve new_equipment proposal код создавал НОВОЕ оборудование,
 * но не обновлял task.objectEquipmentId, если задача уже была привязана к другому оборудованию.
 * 
 * Решение: Обновить task.objectEquipmentId на оборудование из proposal для всех approved proposals.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Исправление привязки задач к оборудованию...\n');

  // Найти все approved new_equipment proposals с taskId
  const proposals = await prisma.equipmentProposal.findMany({
    where: {
      status: 'approved',
      requestType: 'new_equipment',
      taskId: { not: null },
      objectEquipmentId: { not: null },
    },
    include: {
      task: {
        select: {
          id: true,
          objectEquipmentId: true,
          roomTypeCode: true,
          brand: true,
          model: true,
          serialNumber: true,
        },
      },
      objectEquipment: {
        select: {
          id: true,
          roomTypeCode: true,
          brand: true,
          model: true,
          serialNumber: true,
        },
      },
    },
  });

  console.log(`Найдено approved new_equipment proposals с taskId: ${proposals.length}\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const proposal of proposals) {
    if (!proposal.task || !proposal.objectEquipment) {
      skipped++;
      continue;
    }

    // Если задача уже привязана к тому же оборудованию — пропускаем
    if (proposal.task.objectEquipmentId === proposal.objectEquipment.id) {
      skipped++;
      continue;
    }

    try {
      // Обновить задачу: привязать к оборудованию из proposal
      await prisma.task.update({
        where: { id: proposal.task.id },
        data: {
          objectEquipmentId: proposal.objectEquipment.id,
          roomTypeCode: proposal.objectEquipment.roomTypeCode,
          brand: proposal.objectEquipment.brand,
          model: proposal.objectEquipment.model,
          serialNumber: proposal.objectEquipment.serialNumber,
        },
      });

      updated++;
      console.log(`✅ Обновлено: ${proposal.task.id}`);
      console.log(`   Старое equipment: ${proposal.task.objectEquipmentId}`);
      console.log(`   Новое equipment: ${proposal.objectEquipment.id}`);
      console.log(`   Room: ${proposal.objectEquipment.roomTypeCode}\n`);
    } catch (err: any) {
      errors++;
      console.log(`❌ Ошибка для ${proposal.task.id}: ${err.message}\n`);
    }
  }

  console.log('\n📊 Итоги:');
  console.log(`  Обновлено: ${updated}`);
  console.log(`  Пропущено: ${skipped}`);
  console.log(`  Ошибок: ${errors}`);

  console.log('\n✅ Исправление завершено!');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
