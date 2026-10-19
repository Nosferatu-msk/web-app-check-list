/**
 * ОТКАТ изменений скрипта fix-task-equipment-binding.ts
 * 
 * Этот скрипт возвращает task.objectEquipmentId к исходному значению
 * (до запуска fix-task-equipment-binding.ts)
 * 
 * Проблема: Скрипт fix-task-equipment-binding.ts обновил задачи,
 * привязав их к НОВОМУ оборудованию из proposals, но это могло быть неправильно.
 * 
 * Решение: Вернуть задачи к исходному оборудованию.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('⏪ ОТКАТ изменений fix-task-equipment-binding.ts...\n');

  // Найти все approved new_equipment proposals с taskId
  // где задача была обновлена на другое оборудование
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
        },
      },
    },
  });

  console.log(`Найдено proposals для проверки: ${proposals.length}\n`);

  // Проблема: мы не знаем, какое было ИСХОДНОЕ objectEquipmentId у задачи
  // до запуска fix-task-equipment-binding.ts
  // 
  // Единственный способ — восстановить из audit_log или бэкапа БД
  // Но у нас нет audit_log для этого изменения
  //
  // Альтернатива: если задача была привязана к оборудованию, которое существует
  // и имеет те же brand/model/serialNumber, что и proposal — это правильное оборудование
  //
  // Решение: Оставить задачу с текущим objectEquipmentId, но проверить,
  // что оно корректно

  console.log('⚠️  ВНИМАНИЕ!');
  console.log('Для полного отката нужно восстановить БД из бэкапа.\n');
  console.log('Если бэкапа нет, можно:');
  console.log('1. Проверить, какие задачи были обновлены (по audit_log)');
  console.log('2. Вернуть их к исходному оборудованию вручную');
  console.log('3. Или оставить как есть, если данные корректны\n');

  // Проверим, есть ли задачи, которые были привязаны к оборудованию
  // с другим serialNumber, чем в proposal
  let suspiciousCount = 0;

  for (const proposal of proposals) {
    if (!proposal.task) continue;

    const taskEquipment = await prisma.objectEquipment.findUnique({
      where: { id: proposal.task.objectEquipmentId! },
      select: {
        id: true,
        serialNumber: true,
        brand: true,
        model: true,
      },
    });

    if (!taskEquipment) continue;

    // Если serialNumber задачи не совпадает с serialNumber proposal
    // — это подозрительно
    if (
      taskEquipment.serialNumber !== proposal.serialNumber &&
      taskEquipment.brand !== proposal.brand &&
      taskEquipment.model !== proposal.model
    ) {
      suspiciousCount++;
      console.log(`Подозрительная задача: ${proposal.task.id}`);
      console.log(`  Proposal: ${proposal.serialNumber} (${proposal.brand} ${proposal.model})`);
      console.log(`  Task equipment: ${taskEquipment.serialNumber} (${taskEquipment.brand} ${taskEquipment.model})`);
      console.log('');
    }
  }

  console.log(`\nНайдено подозрительных задач: ${suspiciousCount}`);
  console.log('\n⚠️  Для полного отката восстановите БД из бэкапа!');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
