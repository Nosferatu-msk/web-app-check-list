import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('=== Проверка фильтра по периоду в RequestsPage ===\n');

  const contract = await prisma.contract.findFirst({
    where: { number: '050005596590' },
    select: { id: true }
  });
  
  if (!contract) {
    console.log('❌ Договор не найден');
    return;
  }
  
  // Фильтр по периоду сентябрь 2026 (как в RequestsPage)
  const startDate = new Date(2026, 8, 1); // Сентябрь (месяц 8, т.к. 0-индексация)
  const endDate = new Date(2026, 9, 0, 23, 59, 59); // Последний день сентября
  
  console.log('Фильтр по периоду:');
  console.log(`  startDate >= ${startDate.toISOString()}`);
  console.log(`  startDate <= ${endDate.toISOString()}\n`);
  
  const allRequests = await prisma.importedRequest.findMany({
    where: {
      contractId: contract.id,
      startDate: { gte: startDate, lte: endDate },
    },
    select: {
      id: true,
      externalRequestId: true,
      startDate: true,
      deadline: true,
    },
  });
  
  console.log(`Всего заявок по фильтру: ${allRequests.length}\n`);
  
  // Покажем первые 10 заявок
  console.log('Первые 10 заявок:');
  allRequests.slice(0, 10).forEach(r => {
    console.log(`  ${r.externalRequestId}: startDate=${r.startDate.toISOString().split('T')[0]}, deadline=${r.deadline?.toISOString().split('T')[0]}`);
  });
  
  // Проверим, сколько заявок имеет startDate в сентябре
  const septemberRequests = allRequests.filter(r => {
    const d = r.startDate;
    return d.getFullYear() === 2026 && d.getMonth() === 8; // Сентябрь
  });
  
  console.log(`\nЗаявок с startDate в сентябре: ${septemberRequests.length}`);
  
  // Проверим, сколько заявок имеет deadline в сентябре
  const septemberDeadline = allRequests.filter(r => {
    if (!r.deadline) return false;
    const d = r.deadline;
    return d.getFullYear() === 2026 && d.getMonth() === 8; // Сентябрь
  });
  
  console.log(`Заявок с deadline в сентябре: ${septemberDeadline.length}`);
  
  // Проверим, сколько заявок имеет startDate ИЛИ deadline в сентябре
  const anySeptember = allRequests.filter(r => {
    const start = r.startDate;
    const deadline = r.deadline;
    const startInSept = start.getFullYear() === 2026 && start.getMonth() === 8;
    const deadlineInSept = deadline && deadline.getFullYear() === 2026 && deadline.getMonth() === 8;
    return startInSept || deadlineInSept;
  });
  
  console.log(`Заявок с startDate ИЛИ deadline в сентябре: ${anySeptember.length}`);
}

check().catch(console.error).finally(() => prisma.$disconnect());
