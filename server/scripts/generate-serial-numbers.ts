import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const METER_CODES = ['schetchik_electroshc', 'schetchik_hvs', 'schetchik_gws', 'meter_gas'];

async function main() {
  console.log('Начало генерации serialNumber для оборудования без серийного номера...');

  // Получаем всё оборудование без serialNumber (кроме счётчиков)
  const equipmentWithoutSN = await prisma.objectEquipment.findMany({
    where: {
      serialNumber: null,
      equipmentTypeCode: { notIn: METER_CODES },
    },
    include: {
      address: true,
    },
    orderBy: [
      { addressId: 'asc' },
      { equipmentTypeCode: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  console.log(`Найдено ${equipmentWithoutSN.length} записей без serialNumber`);

  // Группируем по addressId + equipmentTypeCode
  const groups = new Map<string, typeof equipmentWithoutSN>();
  for (const eq of equipmentWithoutSN) {
    const key = `${eq.addressId}_${eq.equipmentTypeCode}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(eq);
  }

  let updated = 0;
  let skipped = 0;

  for (const [key, items] of groups.entries()) {
    const [addressId, equipmentTypeCode] = key.split('_');
    const address = items[0].address;
    const objectCode = address?.objectCode;

    if (!objectCode) {
      console.warn(`Пропущено: нет objectCode для addressId=${addressId}`);
      skipped += items.length;
      continue;
    }

    // Считаем существующее оборудование с serialNumber для этого типа на объекте
    const existingWithSN = await prisma.objectEquipment.count({
      where: {
        addressId,
        equipmentTypeCode,
        serialNumber: { not: null },
      },
    });

    // Генерируем serialNumber для каждой записи
    for (let i = 0; i < items.length; i++) {
      const seqNumber = existingWithSN + i + 1;
      const serialNumber = `${objectCode}/${equipmentTypeCode}/${seqNumber}`;

      try {
        await prisma.objectEquipment.update({
          where: { id: items[i].id },
          data: { serialNumber },
        });
        updated++;
        console.log(`✓ ${items[i].id}: ${serialNumber}`);
      } catch (error: any) {
        // Если уникальность нарушена, пропускаем
        if (error.code === 'P2002') {
          console.warn(`Пропущено (дубликат): ${serialNumber}`);
          skipped++;
        } else {
          throw error;
        }
      }
    }
  }

  console.log(`\nГотово! Обновлено: ${updated}, пропущено: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
