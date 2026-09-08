import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Миграция: восстановление марок по моделям ===\n');

  // Найти записи с моделью, но без марки
  const equipmentWithoutBrand = await prisma.objectEquipment.findMany({
    where: {
      model: { not: null },
      brand: null,
    },
  });

  console.log(`Найдено записей без марки: ${equipmentWithoutBrand.length}\n`);

  let updated = 0;

  for (const eq of equipmentWithoutBrand) {
    if (!eq.model) continue;

    // Ищем другую запись с такой же моделью, но с маркой
    const withBrand = await prisma.objectEquipment.findFirst({
      where: {
        model: eq.model,
        brand: { not: null },
        id: { not: eq.id },
      },
    });

    if (withBrand?.brand) {
      await prisma.objectEquipment.update({
        where: { id: eq.id },
        data: { brand: withBrand.brand },
      });
      console.log(`  ✅ ${eq.id.slice(0,8)} ${eq.equipmentTypeCode}: "${eq.model}" → марка "${withBrand.brand}"`);
      updated++;
    }
  }

  console.log(`\n=== Итого: обновлено марок: ${updated} ===`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
