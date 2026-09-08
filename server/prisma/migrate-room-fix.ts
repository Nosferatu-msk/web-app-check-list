import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Миграция: восстановление roomTypeCode для objectEquipment ===\n');

  // Найти objectEquipment с пустым roomTypeCode, привязанные к задачам
  const equipment = await prisma.objectEquipment.findMany({
    where: {
      roomTypeCode: null,
      tasks: { some: {} }, // есть привязанные задачи
    },
    include: {
      tasks: {
        include: {
          roomType: true,
        },
      },
    },
  });

  let updated = 0;

  for (const oe of equipment) {
    // Берём roomType из первой привязанной задачи
    const task = oe.tasks[0];
    if (!task?.roomType?.code) continue;

    await prisma.objectEquipment.update({
      where: { id: oe.id },
      data: { roomTypeCode: task.roomType.code },
    });

    console.log(`  ✅ ${oe.id} (${oe.equipmentTypeCode}) → ${task.roomType.code}`);
    updated++;
  }

  console.log(`\n=== Итого: обновлено: ${updated} ===`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
