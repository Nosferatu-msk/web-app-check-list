import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('=== Подробная диагностика статусов заявок ===\n');

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
  
  const allRequests = await prisma.importedRequest.findMany({
    where: {
      contractId: contract.id,
      startDate: { lte: to },
      deadline: { gte: from },
    },
    select: {
      id: true,
      externalRequestId: true,
      equipmentTypeCode: true,
      visitId: true,
      visitRequests: { select: { visitId: true } },
    },
  });
  
  console.log(`Всего заявок: ${allRequests.length}\n`);
  
  // Считаем статусы
  const stats = {
    completed: 0,
    in_progress: 0,
    planned: 0,
    awaiting_assignment: 0,
    no_visit: 0,
  };
  
  const samples = {
    completed: [] as string[],
    in_progress: [] as string[],
    planned: [] as string[],
    awaiting_assignment: [] as string[],
    no_visit: [] as string[],
  };
  
  for (const req of allRequests) {
    const visitIds = [
      req.visitId,
      ...req.visitRequests.map(vr => vr.visitId),
    ].filter((id): id is string => id !== null && id !== undefined);
    
    if (visitIds.length === 0) {
      stats.no_visit++;
      if (samples.no_visit.length < 3) samples.no_visit.push(req.externalRequestId);
      continue;
    }
    
    const visits = await prisma.visit.findMany({
      where: { id: { in: visitIds } },
      select: { status: true },
    });
    
    // Берём первый визит (как в RequestsPage для обычных заявок)
    const visit = visits[0];
    if (!visit) {
      stats.no_visit++;
      if (samples.no_visit.length < 3) samples.no_visit.push(req.externalRequestId);
    } else if (['completed', 'sent', 'corrected_by_tm'].includes(visit.status)) {
      stats.completed++;
      if (samples.completed.length < 3) samples.completed.push(req.externalRequestId);
    } else if (visit.status === 'in_progress') {
      stats.in_progress++;
      if (samples.in_progress.length < 3) samples.in_progress.push(req.externalRequestId);
    } else if (visit.status === 'planned') {
      stats.planned++;
      if (samples.planned.length < 3) samples.planned.push(req.externalRequestId);
    } else if (visit.status === 'awaiting_assignment') {
      stats.awaiting_assignment++;
      if (samples.awaiting_assignment.length < 3) samples.awaiting_assignment.push(req.externalRequestId);
    } else {
      stats.no_visit++;
      if (samples.no_visit.length < 3) samples.no_visit.push(req.externalRequestId);
    }
  }
  
  console.log('=== Распределение статусов (по первому визиту) ===');
  console.log(`Завершены (completed/sent/corrected_by_tm): ${stats.completed}`);
  console.log(`В работе (in_progress): ${stats.in_progress}`);
  console.log(`Назначены (planned): ${stats.planned}`);
  console.log(`Ожидают назначения (awaiting_assignment): ${stats.awaiting_assignment}`);
  console.log(`Без визитов: ${stats.no_visit}`);
  
  console.log('\n=== Примеры заявок ===');
  console.log(`Завершены: ${samples.completed.join(', ')}`);
  console.log(`В работе: ${samples.in_progress.join(', ')}`);
  console.log(`Назначены: ${samples.planned.join(', ')}`);
  console.log(`Ожидают назначения: ${samples.awaiting_assignment.join(', ')}`);
  console.log(`Без визитов: ${samples.no_visit.join(', ')}`);
  
  console.log('\n=== Для отчёта (группировка как в RequestsPage) ===');
  console.log(`Завершены: ${stats.completed}`);
  console.log(`В работе: ${stats.in_progress + stats.planned}`);
  console.log(`Не начаты: ${stats.awaiting_assignment + stats.no_visit}`);
}

check().catch(console.error).finally(() => prisma.$disconnect());
