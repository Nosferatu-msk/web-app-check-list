import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('=== Проверка всех визитов с userId = ТМ_МБ ===\n');

  const contract = await prisma.contract.findFirst({
    where: { number: '050005596590' },
    select: { id: true }
  });
  
  if (!contract) {
    console.log('❌ Договор не найден');
    return;
  }
  
  const from = new Date('2026-09-01T00:00:00');
  const to = new Date('2026-09-30T23:59:59');
  const tmMbId = 'b9758bf8-cf33-4d13-a741-edbb4d55748f';
  
  // Все визиты с userId = ТМ_МБ
  const allVisits = await prisma.visit.findMany({
    where: {
      contractId: contract.id,
      isDeleted: false,
      dateStart: { gte: from, lte: to },
      userId: tmMbId
    },
    select: {
      id: true,
      dateStart: true,
      engineerName: true,
      userId: true
    }
  });
  
  console.log('Всего визитов с userId = ТМ_МБ:', allVisits.length);
  
  // Группируем по engineerName
  const byName = new Map<string, number>();
  allVisits.forEach(v => {
    byName.set(v.engineerName, (byName.get(v.engineerName) || 0) + 1);
  });
  
  console.log('\nРаспределение по engineerName:');
  byName.forEach((count, name) => {
    console.log(`  - "${name}": ${count} визит(ов)`);
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
