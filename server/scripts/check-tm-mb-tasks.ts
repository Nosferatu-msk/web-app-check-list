import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('=== Проверка 16 визитов ТМ_МБ — поиск Петрова С.В. ===\n');

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
  
  // Все визиты с userId = ТМ_МБ и engineerName = "ТМ_МБ"
  const visits = await prisma.visit.findMany({
    where: {
      contractId: contract.id,
      isDeleted: false,
      dateStart: { gte: from, lte: to },
      userId: tmMbId,
      engineerName: 'ТМ_МБ'
    },
    select: {
      id: true,
      dateStart: true,
      engineerName: true,
      address: {
        select: {
          fullAddress: true
        }
      },
      tasks: {
        select: {
          id: true,
          brand: true,
          model: true
        }
      }
    }
  });
  
  console.log('Визитов с engineerName = "ТМ_МБ":', visits.length);
  console.log('\nДетали:');
  
  visits.forEach(v => {
    console.log(`\n  Визит ${v.id}:`);
    console.log(`    Дата: ${v.dateStart.toLocaleDateString('ru-RU')}`);
    console.log(`    Адрес: ${v.address.fullAddress}`);
    console.log(`    Задач: ${v.tasks.length}`);
    if (v.tasks.length > 0) {
      v.tasks.slice(0, 3).forEach(t => {
        console.log(`      - ${t.brand} ${t.model}`);
      });
    }
  });
  
  // Проверяем, есть ли визиты Петрова С.В. среди этих 16
  // Ищем по адресу и дате — если визит ТМ_МБ создан на адрес, где работал Петров С.В.
  console.log('\n\n=== Поиск визитов Петрова С.В. по задачам ===');
  
  // Находим все задачи, созданные Петровым С.В. (по userId в задачах)
  const petrovId = '92b81fc8-d4bd-4bd0-a98b-3cfcc393b716';
  const petrovTasks = await prisma.task.findMany({
    where: {
      visit: {
        contractId: contract.id,
        isDeleted: false,
        dateStart: { gte: from, lte: to }
      }
    },
    select: {
      id: true,
      visitId: true,
      visit: {
        select: {
          userId: true,
          engineerName: true,
          dateStart: true
        }
      }
    }
  });
  
  console.log('Всего задач в визитах по договору:', petrovTasks.length);
  
  // Группируем по visitId
  const byVisit = new Map<string, { userId: string; engineerName: string; date: Date; taskCount: number }>();
  petrovTasks.forEach(t => {
    const existing = byVisit.get(t.visitId);
    if (existing) {
      existing.taskCount++;
    } else {
      byVisit.set(t.visitId, {
        userId: t.visit.userId,
        engineerName: t.visit.engineerName,
        date: t.visit.dateStart,
        taskCount: 1
      });
    }
  });
  
  console.log('\nРаспределение задач по визитам:');
  byVisit.forEach((data, visitId) => {
    console.log(`  - ${visitId}: userId=${data.userId}, engineerName="${data.engineerName}", дата=${data.date.toLocaleDateString('ru-RU')}, задач=${data.taskCount}`);
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
