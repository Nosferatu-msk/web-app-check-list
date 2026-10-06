import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('=== Диагностика статусов заявок для договора 050005596590 ===\n');

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
  
  // Получаем все заявки договора
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
    assigned: 0,
    not_assigned: 0,
  };
  
  for (const req of allRequests) {
    const isISZH = req.equipmentTypeCode === 'iszh_object';
    const visitIds = [
      req.visitId,
      ...req.visitRequests.map(vr => vr.visitId),
    ].filter((id): id is string => id !== null && id !== undefined);
    
    if (visitIds.length === 0) {
      stats.not_assigned++;
      continue;
    }
    
    const visits = await prisma.visit.findMany({
      where: { id: { in: visitIds } },
      select: {
        status: true,
        _count: { select: { tasks: true } },
      },
    });
    
    if (isISZH) {
      // Логика для ИСЖ
      const realVisits = visits.filter(v => v._count.tasks > 0);
      if (realVisits.length === 0) {
        stats.not_assigned++;
      } else {
        const statuses = realVisits.map(v => v.status);
        const completedStatuses = ['completed', 'sent', 'corrected_by_tm'];
        const allCompleted = statuses.every(s => completedStatuses.includes(s));
        if (allCompleted) {
          stats.completed++;
        } else if (statuses.includes('in_progress')) {
          stats.in_progress++;
        } else if (statuses.includes('planned')) {
          stats.assigned++;
        } else {
          stats.not_assigned++;
        }
      }
    } else {
      // Логика для обычных заявок
      const visit = visits[0];
      if (!visit) {
        stats.not_assigned++;
      } else if (visit.status === 'awaiting_assignment') {
        stats.not_assigned++;
      } else if (visit.status === 'planned') {
        stats.assigned++;
      } else if (visit.status === 'in_progress') {
        stats.in_progress++;
      } else if (['completed', 'sent', 'corrected_by_tm'].includes(visit.status)) {
        stats.completed++;
      } else {
        stats.not_assigned++;
      }
    }
  }
  
  console.log('=== Распределение статусов ===');
  console.log(`Завершены: ${stats.completed}`);
  console.log(`В работе: ${stats.in_progress}`);
  console.log(`Назначены: ${stats.assigned}`);
  console.log(`Не назначены: ${stats.not_assigned}`);
  console.log(`\nИтого: ${stats.completed + stats.in_progress + stats.assigned + stats.not_assigned}`);
  
  console.log('\n=== Для отчёта ===');
  console.log(`Завершены: ${stats.completed}`);
  console.log(`В работе: ${stats.in_progress + stats.assigned}`);
  console.log(`Не начаты: ${stats.not_assigned}`);
}

check().catch(console.error).finally(() => prisma.$disconnect());
