import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Логика из requests.ts (как в RequestsPage)
function computeExecutionStatus(visit: any, isISZH: boolean, equipmentTypeId?: string): string {
  if (!visit || visit.status === 'awaiting_assignment') return 'not_assigned';
  if (visit.status === 'planned') return 'assigned';
  if (visit.status === 'in_progress') return 'in_progress';
  if (['completed', 'sent', 'corrected_by_tm'].includes(visit.status)) {
    if (equipmentTypeId && visit.tasks && !isISZH) {
      const hasMatchingTask = visit.tasks.some((t: any) => t.equipmentTypeId === equipmentTypeId);
      if (!hasMatchingTask) return 'not_assigned';
    }
    return 'completed';
  }
  return 'not_assigned';
}

function computeISZHExecutionStatus(visits: any[]): string {
  if (!visits || visits.length === 0) return 'not_assigned';
  const realVisits = visits.filter(v => v._count?.tasks > 0);
  if (realVisits.length === 0) {
    const hasAnyVisit = visits.length > 0;
    const hasAssigned = visits.some(v => v.status === 'planned' || v.status === 'in_progress');
    if (hasAssigned) return 'assigned';
    return hasAnyVisit ? 'not_assigned' : 'not_assigned';
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
}

async function test() {
  console.log('=== Тестирование логики RequestsPage ===\n');

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
  
  const allRequests = await prisma.importedRequest.findMany({
    where: {
      contractId: contract.id,
      startDate: { gte: startDate, lte: endDate },
    },
    include: {
      visit: {
        include: {
          tasks: true,
        },
      },
      visitRequests: {
        include: {
          visit: {
            include: {
              tasks: true,
            },
          },
        },
      },
      equipmentType: true,
    },
  });
  
  console.log(`Всего заявок: ${allRequests.length}\n`);
  
  const stats = {
    completed: 0,
    in_progress: 0,
    assigned: 0,
    not_assigned: 0,
  };
  
  for (const req of allRequests) {
    const isISZHObject = req.equipmentType?.code === 'iszh_object';
    
    let executionStatus: string;
    if (!isISZHObject) {
      executionStatus = computeExecutionStatus(req.visit, false, req.equipmentTypeId);
    } else {
      const allVisits = req.visitRequests?.map(vr => vr.visit).filter(Boolean) || [];
      executionStatus = computeISZHExecutionStatus(allVisits);
    }
    
    if (executionStatus === 'completed') {
      stats.completed++;
    } else if (executionStatus === 'in_progress') {
      stats.in_progress++;
    } else if (executionStatus === 'assigned') {
      stats.assigned++;
    } else {
      stats.not_assigned++;
    }
  }
  
  console.log('=== Логика RequestsPage ===');
  console.log(`Завершены (completed): ${stats.completed}`);
  console.log(`В работе (in_progress): ${stats.in_progress}`);
  console.log(`Назначены (assigned): ${stats.assigned}`);
  console.log(`Не назначены (not_assigned): ${stats.not_assigned}`);
  
  console.log('\n=== Для вкладок RequestsPage ===');
  console.log(`Вкладка "Завершённые": ${stats.completed}`);
  console.log(`Вкладка "В работе": ${stats.in_progress}`);
  console.log(`Вкладка "Не назначенные": ${stats.not_assigned}`);
  console.log(`Вкладка "Все": ${stats.completed + stats.in_progress + stats.assigned + stats.not_assigned}`);
  
  console.log('\n=== Ожидаемый результат (из вашего сообщения) ===');
  console.log(`Завершено: 52`);
  console.log(`В работе: 76`);
  console.log(`Не начато: 1`);
}

test().catch(console.error).finally(() => prisma.$disconnect());
