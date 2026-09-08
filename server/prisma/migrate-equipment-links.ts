import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Миграция: создание objectEquipment для задач с данными ===\n');

  // Найти задачи с параметрами equipment, но без object_equipment_id
  const tasks = await prisma.task.findMany({
    where: {
      objectEquipmentId: null,
      visit: { status: { in: ['completed', 'sent', 'sent_by_engineer', 'sent_by_tm', 'corrected_by_tm'] } },
    },
    include: {
      equipmentType: true,
      visit: { include: { address: true } },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const task of tasks) {
    const params = (task.parameters || {}) as Record<string, any>;
    const model = params.model || task.model;
    const serialNumber = params.serial_number || task.serialNumber;
    const brand = task.brand;

    // Пропускаем задачи без данных оборудования
    if (!model && !serialNumber && !brand) {
      skipped++;
      continue;
    }

    // Проверяем, нет ли уже оборудования с такими данными на этом адресе
    const existing = await prisma.objectEquipment.findFirst({
      where: {
        addressId: task.visit.addressId,
        equipmentTypeCode: task.equipmentType?.code || '',
        OR: [
          ...(serialNumber ? [{ serialNumber }] : []),
          ...(model ? [{ model }] : []),
        ],
      },
    });

    if (existing) {
      // Привязываем задачу к существующему оборудованию
      await prisma.task.update({
        where: { id: task.id },
        data: { objectEquipmentId: existing.id },
      });
      console.log(`  🔗 ${task.id} → существующее ${existing.id} (${task.equipmentType?.code})`);
      created++;
      continue;
    }

    // Создаём новое оборудование
    const oe = await prisma.objectEquipment.create({
      data: {
        addressId: task.visit.addressId,
        equipmentTypeCode: task.equipmentType?.code || '',
        roomTypeCode: task.roomTypeCode || null,
        brand: brand || null,
        model: model || null,
        serialNumber: serialNumber || null,
        confirmationStatus: 'confirmed',
      },
    });

    // Привязываем задачу к оборудованию
    await prisma.task.update({
      where: { id: task.id },
      data: { objectEquipmentId: oe.id },
    });

    console.log(`  ✅ ${task.id} → новое ${oe.id} (${task.equipmentType?.code}: ${brand || ''} ${model || ''} SN:${serialNumber || ''})`.trim());
    created++;
  }

  console.log(`\n=== Итого: создано/привязано: ${created}, пропущено: ${skipped} ===`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
