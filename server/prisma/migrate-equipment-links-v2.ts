import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Миграция v2: objectEquipment для ВСЕХ задач с данными ===\n');

  // Найти ВСЕ задачи с параметрами equipment, но без object_equipment_id
  const tasks = await prisma.task.findMany({
    where: {
      objectEquipmentId: null,
      NOT: { parameters: { equals: null } },
    },
    include: {
      equipmentType: true,
      roomType: true,
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

    if (!model && !serialNumber && !brand) {
      skipped++;
      continue;
    }

    // Ищем существующее оборудование с такими данными на этом адресе
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
      await prisma.task.update({
        where: { id: task.id },
        data: { objectEquipmentId: existing.id },
      });
      // Также обновим roomTypeCode если есть
      if (task.roomType?.code && !existing.roomTypeCode) {
        await prisma.objectEquipment.update({
          where: { id: existing.id },
          data: { roomTypeCode: task.roomType.code },
        });
      }
      console.log(`  🔗 ${task.id.slice(0,8)} → ${existing.id.slice(0,8)} (${task.equipmentType?.code})`);
      created++;
      continue;
    }

    // Создаём новое оборудование
    const oe = await prisma.objectEquipment.create({
      data: {
        addressId: task.visit.addressId,
        equipmentTypeCode: task.equipmentType?.code || '',
        roomTypeCode: task.roomType?.code || null,
        brand: brand || null,
        model: model || null,
        serialNumber: serialNumber || null,
        confirmationStatus: 'confirmed',
      },
    });

    await prisma.task.update({
      where: { id: task.id },
      data: { objectEquipmentId: oe.id },
    });

    console.log(`  ✅ ${task.id.slice(0,8)} → ${oe.id.slice(0,8)} (${task.equipmentType?.code}: ${model || ''} SN:${serialNumber || ''})`.trim());
    created++;
  }

  console.log(`\n=== Итого: создано/привязано: ${created}, пропущено: ${skipped} ===`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
