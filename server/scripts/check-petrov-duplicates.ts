import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('=== Проверка дубликатов пользователей с email psv.sovteh@gmail.com ===\n');

  // Ищем всех пользователей с таким email
  const users = await prisma.user.findMany({
    where: { email: 'psv.sovteh@gmail.com' },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true
    }
  });

  console.log('Найдено пользователей с email psv.sovteh@gmail.com:', users.length);
  users.forEach(u => {
    console.log(`\n  ID: ${u.id}`);
    console.log(`  ФИО: ${u.fullName}`);
    console.log(`  Роль: ${u.role}`);
    console.log(`  Активен: ${u.isActive}`);
    console.log(`  Создан: ${u.createdAt}`);
  });

  // Проверяем визиты для каждого пользователя
  console.log('\n=== Визиты по договору 050005596590 за сентябрь ===');
  
  const contract = await prisma.contract.findFirst({
    where: { number: '050005596590' },
    select: { id: true }
  });
  
  if (!contract) {
    console.log('Договор не найден');
    return;
  }
  
  const from = new Date('2026-09-01T00:00:00');
  const to = new Date('2026-09-30T23:59:59');
  
  for (const user of users) {
    const visits = await prisma.visit.findMany({
      where: {
        contractId: contract.id,
        isDeleted: false,
        dateStart: { gte: from, lte: to },
        userId: user.id
      },
      select: { id: true, dateStart: true, engineerName: true }
    });
    
    console.log(`\nПользователь ${user.fullName} (${user.id}):`);
    console.log(`  Визитов: ${visits.length}`);
    if (visits.length > 0) {
      visits.slice(0, 5).forEach(v => {
        console.log(`    • ${v.dateStart.toLocaleDateString('ru-RU')} — ${v.engineerName}`);
      });
      if (visits.length > 5) {
        console.log(`    ... и ещё ${visits.length - 5}`);
      }
    }
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
