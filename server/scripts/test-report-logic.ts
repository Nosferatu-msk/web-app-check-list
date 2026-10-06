import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Логика из reports.ts (новая)
function computeRequestStatusNew(
  req: { visitId: string | null; visitRequests: { visitId: string }[]; equipmentTypeCode: string | null },
  visits: Array<{ id: string; status: string; _count?: { tasks: number } }>
): 'completed' | 'in_progress' | 'assigned' | 'not_started' {
  const isISZH = req.equipmentTypeCode === 'iszh_object';
  
  if (isISZH) {
    const realVisits = visits.filter(v => v._count?.tasks && v._count.tasks > 0);
    if (realVisits.length === 0) {
      return visits.length > 0 ? 'assigned' : 'not_started';
    }
    const statuses = realVisits.map(v => v.status);
    const completedStatuses = ['completed', 'sent', 'corrected_by_tm'];
    const allCompleted = statuses.every(s => completedStatuses.includes(s));
    if (allCompleted) return 'completed';
    const hasInProgress = statuses.includes('in_progress');
    if (hasInProgress) return 'in_progress';
    const hasAssigned = statuses.includes('planned');
    if (hasAssigned) return 'assigned';
    const hasCompleted = statuses.some(s => completedStatuses.includes(s));
    if (hasCompleted) return 'in_progress';
    return 'assigned';
  } else {
    const directVisitId = req.visitId;
    if (!directVisitId) {
      if (req.visitRequests.length === 0) return 'not_started';
      const firstVisitId = req.visitRequests[0].visitId;
      const visit = visits.find(v => v.id === firstVisitId);
      if (!visit) return 'not_started';
      if (visit.status === 'awaiting_assignment') return 'not_started';
      if (visit.status === 'planned') return 'assigned';
      if (visit.status === 'in_progress') return 'in_progress';
      if (['completed', 'sent', 'corrected_by_tm'].includes(visit.status)) return 'completed';
      return 'not_started';
    }
    
    const visit = visits.find(v => v.id === directVisitId);
    if (!visit) return 'not_started';
    if (visit.status === 'awaiting_assignment') return 'not_started';
    if (visit.status === 'planned') return 'assigned';
    if (visit.status === 'in_progress') return 'in_progress';
    if (['completed', 'sent', 'corrected_by_tm'].includes(visit.status)) return 'completed';
    return 'not_started';
  }
}

async function test() {
  console.log('=== Тестирование новой логики vs RequestsPage ===\n');

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
  
  const stats = {
    completed: 0,
    in_progress: 0,
    assigned: 0,
    not_started: 0,
  };
  
  for (const req of allRequests) {
    const visitIds = [
      req.visitId,
      ...req.visitRequests.map(vr => vr.visitId),
    ].filter((id): id is string => id !== null && id !== undefined);
    
    if (visitIds.length === 0) {
      stats.not_started++;
      continue;
    }
    
    const visits = await prisma.visit.findMany({
      where: { id: { in: visitIds } },
      select: {
        id: true,
        status: true,
        _count: { select: { tasks: true } },
      },
    });
    
    const status = computeRequestStatusNew(req, visits);
    
    if (status === 'completed') {
      stats.completed++;
    } else if (status === 'in_progress') {
      stats.in_progress++;
    } else if (status === 'assigned') {
      stats.assigned++;
    } else {
      stats.not_started++;
    }
  }
  
  console.log('=== Новая логика (reports.ts) ===');
  console.log(`Завершены: ${stats.completed}`);
  console.log(`В работе: ${stats.in_progress}`);
  console.log(`Назначены: ${stats.assigned}`);
  console.log(`Не начаты: ${stats.not_started}`);
  
  console.log('\n=== Для отчёта (группировка как в RequestsPage) ===');
  console.log(`Завершены: ${stats.completed}`);
  console.log(`В работе: ${stats.in_progress + stats.assigned}`);
  console.log(`Не начаты: ${stats.not_started}`);
  
  console.log('\n=== Ожидаемый результат (из RequestsPage) ===');
  console.log(`Завершены: 52`);
  console.log(`В работе: 76`);
  console.log(`Не начаты: 1`);
  
  console.log('\n=== Совпадение? ===');
  const reportCompleted = stats.completed;
  const reportInProgress = stats.in_progress + stats.assigned;
  const reportNotStarted = stats.not_started;
  
  console.log(`Завершены: ${reportCompleted === 52 ? '✅' : '❌'} (${reportCompleted} vs 52)`);
  console.log(`В работе: ${reportInProgress === 76 ? '✅' : '❌'} (${reportInProgress} vs 76)`);
  console.log(`Не начаты: ${reportNotStarted === 1 ? '✅' : '❌'} (${reportNotStarted} vs 1)`);
}

test().catch(console.error).finally(() => prisma.$disconnect());
