import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Проблемные заявки и визиты (от Анны, 29.09.2026)
const PROBLEM_REQUESTS = [
  'IS1000000074', // Тепловая завеса, RU/76/175 — «Завершён» без задачи
  'IS1000000030', // Пурифаер, RU/76/175 — связана с тем же визитом
  'IS1000000027', // RU/76/146 — «Завершён», нет визитов
  'IS1000000034', // RU/76/146
  'IS1000000052', // RU/76/146
  'IS1000000053', // RU/76/146
];

const PROBLEM_VISIT_ID = 'a1f5e6a2-b9b2-47c2-ab91-6a840d07311b'; // два исполнителя

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    awaiting_assignment: '⏳ Ожидает назначения',
    planned: '📋 Назначена',
    not_started: '🔵 Не начат',
    in_progress: '🟡 В работе',
    completed: '✅ Завершён',
    sent: '📤 Отправлен',
    corrected_by_tm: '🔧 Корректирован ТМ',
  };
  return map[status] || status;
}

async function diagnose() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ДИАГНОСТИКА: Связь визитов и заявок');
  console.log('  ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════\n');

  // ─── 1. ПРОБЛЕМНЫЕ ЗАЯВКИ ─────────────────────────────────
  console.log('━━━ 1. ПРОБЛЕМНЫЕ ЗАЯВКИ ━━━\n');

  for (const extId of PROBLEM_REQUESTS) {
    const request = await prisma.importedRequest.findFirst({
      where: { externalRequestId: extId },
      include: {
        equipmentType: { select: { id: true, name: true, code: true } },
        matchedAddress: { select: { id: true, fullAddress: true, objectCode: true } },
        visit: {
          select: {
            id: true, status: true, userId: true, addressId: true,
            isDeleted: true,
            _count: { select: { tasks: true, visitEngineers: true } },
          },
        },
        visitRequests: {
          select: {
            visit: {
              select: {
                id: true, status: true, userId: true, addressId: true,
                isDeleted: true,
                _count: { select: { tasks: true, visitEngineers: true } },
              },
            },
          },
        },
      },
    });

    if (!request) {
      console.log(`❌ ${extId} — ЗАЯВКА НЕ НАЙДЕНА`);
      continue;
    }

    console.log(`━━ ${extId} ━━`);
    console.log(`  Тип оборудования: ${request.equipmentType.name} (${request.equipmentType.code})`);
    console.log(`  Объект: ${request.matchedAddress?.objectCode || '—'} | ${request.matchedAddress?.fullAddress || '—'}`);
    console.log(`  Период: ${request.startDate?.toISOString().split('T')[0] || '—'} — ${request.deadline?.toISOString().split('T')[0] || '—'}`);

    // Прямая связь (visitId)
    console.log(`\n  📎 Прямая связь (importedRequest.visitId):`);
    if (request.visit) {
      console.log(`     Визит: ${request.visit.id}`);
      console.log(`     Статус визита: ${statusLabel(request.visit.status)}`);
      console.log(`     Адрес визита: ${request.visit.addressId}`);
      console.log(`     userId визита: ${request.visit.userId || 'null (виртуальный)'}`);
      console.log(`     Удалён: ${request.visit.isDeleted ? 'ДА ⚠️' : 'нет'}`);
      console.log(`     Задач в визите: ${request.visit._count.tasks}`);
      console.log(`     Инженеров: ${request.visit._count.visitEngineers}`);

      // Совпадает ли адрес заявки и адрес визита?
      if (request.matchedAddressId && request.visit.addressId !== request.matchedAddressId) {
        console.log(`     ⚠️  АНЕМАЛИЯ: адрес визита (${request.visit.addressId}) ≠ адрес заявки (${request.matchedAddressId})`);
      }
    } else {
      console.log(`     visitId = null`);
    }

    // Связи через VisitRequest (many-to-many)
    console.log(`\n  🔗 Связи через VisitRequest (many-to-many):`);
    if (request.visitRequests.length === 0) {
      console.log(`     Нет связей VisitRequest`);
    } else {
      for (const vr of request.visitRequests) {
        const v = vr.visit;
        console.log(`     → Визит: ${v.id}`);
        console.log(`       Статус: ${statusLabel(v.status)}`);
        console.log(`       Адрес: ${v.addressId}`);
        console.log(`       userId: ${v.userId || 'null'}`);
        console.log(`       Удалён: ${v.isDeleted ? 'ДА ⚠️' : 'нет'}`);
        console.log(`       Задач: ${v._count.tasks}`);
        console.log(`       Инженеров: ${v._count.visitEngineers}`);
      }
    }

    // Проверка синхронизации
    console.log(`\n  🔍 Проверка синхронизации:`);
    const hasVisitRequest = request.visitRequests.length > 0;
    const hasDirectVisit = !!request.visit;
    const isISZH = request.equipmentType.code === 'iszh_object';

    if (!hasVisitRequest && hasDirectVisit && request.visit &&
        ['completed', 'sent', 'corrected_by_tm'].includes(request.visit.status)) {
      console.log(`     ⚠️  РАССИНХРОНИЗАЦИЯ: нет VisitRequest, но visitId → завершённый визит`);
      console.log(`         Статус заявки будет «Завершён» без фактической привязки!`);
    }

    if (hasVisitRequest && hasDirectVisit && request.visit) {
      const linkedVisitId = request.visitRequests[0]?.visit.id;
      if (linkedVisitId && linkedVisitId !== request.visit.id) {
        console.log(`     ⚠️  РАССИНХРОНИЗАЦИЯ: VisitRequest → ${linkedVisitId}, но visitId → ${request.visit.id}`);
      }
    }

    if (!hasVisitRequest && hasDirectVisit && request.visit &&
        request.visit.status === 'awaiting_assignment') {
      console.log(`     ✅ Норма: нет VisitRequest, visitId → виртуальный визит (awaiting_assignment)`);
    }

    if (hasVisitRequest && !isISZH && request.visitRequests.length > 1) {
      console.log(`     ⚠️  АНЕМАЛИЯ: не-ИСЖ заявка имеет ${request.visitRequests.length} связей VisitRequest (должна быть 1)`);
    }

    // Проверка задач по типу оборудования в связанном визите
    if (hasDirectVisit && request.visit && !request.visit.isDeleted) {
      const tasksInVisit = await prisma.task.findMany({
        where: {
          visitId: request.visit.id,
          equipmentTypeId: request.equipmentTypeId,
        },
        select: { id: true, status: true, equipmentTypeId: true },
      });
      console.log(`\n  📋 Задачи по типу «${request.equipmentType.name}» в визите visitId:`);
      if (tasksInVisit.length === 0) {
        console.log(`     ⚠️  НЕТ ЗАДАЧ по типу оборудования заявки!`);
        if (['completed', 'sent', 'corrected_by_tm'].includes(request.visit.status)) {
          console.log(`         Статус заявки = «Завершён», но задача не выполнялась ← БАГ`);
        }
      } else {
        for (const t of tasksInVisit) {
          console.log(`     → Задача ${t.id}: статус ${t.status}`);
        }
      }
    }

    console.log('');
  }

  // ─── 2. ПРОБЛЕМНЫЙ ВИЗИТ (два исполнителя) ────────────────
  console.log('\n━━━ 2. ПРОБЛЕМНЫЙ ВИЗИТ (два исполнителя) ━━━\n');

  const problemVisit = await prisma.visit.findUnique({
    where: { id: PROBLEM_VISIT_ID },
    include: {
      address: { select: { fullAddress: true, objectCode: true } },
      tasks: {
        include: { equipmentType: { select: { name: true, code: true } } },
        orderBy: { sortOrder: 'asc' },
      },
      visitEngineers: {
        include: { engineer: { select: { fullName: true, email: true } } },
      },
      visitRequests: {
        include: {
          importedRequest: {
            select: {
              externalRequestId: true,
              equipmentType: { select: { name: true, code: true } },
            },
          },
        },
      },
      importedRequests: {
        select: {
          externalRequestId: true,
          equipmentType: { select: { name: true, code: true } },
        },
      },
    },
  });

  if (!problemVisit) {
    console.log(`❌ Визит ${PROBLEM_VISIT_ID} не найден`);
  } else {
    console.log(`  Визит: ${problemVisit.id}`);
    console.log(`  Статус: ${statusLabel(problemVisit.status)}`);
    console.log(`  Адрес: ${problemVisit.address?.objectCode} | ${problemVisit.address?.fullAddress}`);
    console.log(`  userId: ${problemVisit.userId || 'null'}`);
    console.log(`  Удалён: ${problemVisit.isDeleted ? 'ДА' : 'нет'}`);
    console.log(`  Дата: ${problemVisit.dateStart?.toISOString().split('T')[0]}`);

    console.log(`\n  👷 Инженеры (VisitEngineers):`);
    if (problemVisit.visitEngineers.length === 0) {
      console.log(`     Нет записей VisitEngineers`);
    } else {
      for (const ve of problemVisit.visitEngineers) {
        console.log(`     → ${ve.engineer.fullName} (${ve.engineer.email})`);
        console.log(`       Primary: ${ve.isPrimary ? 'ДА' : 'нет'}`);
        console.log(`       Назначен: ${ve.assignedAt?.toISOString() || '—'}`);
        console.log(`       Назначил: ${ve.assignedBy || '—'}`);
      }
    }

    console.log(`\n  📋 Задачи (${problemVisit.tasks.length}):`);
    for (const t of problemVisit.tasks) {
      console.log(`     → ${t.id}: ${t.equipmentType?.name || '—'} (${t.equipmentType?.code || '—'}) статус: ${t.status}`);
    }

    console.log(`\n  🔗 Заявки через VisitRequest:`);
    for (const vr of problemVisit.visitRequests) {
      console.log(`     → ${vr.importedRequest.externalRequestId} (${vr.importedRequest.equipmentType?.name})`);
    }

    console.log(`\n  📎 Заявки через importedRequests (прямая связь visitId):`);
    for (const ir of problemVisit.importedRequests) {
      console.log(`     → ${ir.externalRequestId} (${ir.equipmentType?.name})`);
    }

    // Проверка: есть ли заявки, привязанные через VisitRequest, но без задач по их типу
    console.log(`\n  🔍 Проверка соответствия задач и заявок:`);
    const taskTypes = new Set(problemVisit.tasks.map(t => t.equipmentTypeId));
    for (const vr of problemVisit.visitRequests) {
      const reqEqId = vr.importedRequest.equipmentType?.code;
      const hasTask = problemVisit.tasks.some(
        t => t.equipmentType?.code === reqEqId
      );
      if (!hasTask) {
        console.log(`     ⚠️  ${vr.importedRequest.externalRequestId} (${reqEqId}): привязана, но НЕТ задачи по этому типу!`);
      } else {
        console.log(`     ✅ ${vr.importedRequest.externalRequestId} (${reqEqId}): есть задача`);
      }
    }
  }

  // ─── 3. ОБЩАЯ ДИАГНОСТИКА: рассинхронизация в БД ──────────
  console.log('\n\n━━━ 3. ОБЩАЯ ДИАГНОСТИКА: масштаб проблемы ━━━\n');

  // 3a. Заявки без VisitRequest, но visitId → завершённый визит
  const desynced1 = await prisma.importedRequest.findMany({
    where: {
      visitRequests: { none: {} },
      visit: {
        status: { in: ['completed', 'sent', 'corrected_by_tm'] },
      },
      equipmentType: { code: { not: 'iszh_object' } },
    },
    select: {
      externalRequestId: true,
      equipmentType: { select: { name: true, code: true } },
      visit: { select: { id: true, status: true, addressId: true } },
      matchedAddress: { select: { objectCode: true } },
    },
    take: 50,
  });

  console.log(`  3a. Рассинхронизация: нет VisitRequest, visitId → completed визит`);
  console.log(`      Найдено: ${desynced1.length}`);
  for (const r of desynced1) {
    console.log(`      → ${r.externalRequestId} (${r.equipmentType.name}) объект: ${r.matchedAddress?.objectCode || '—'}`);
    console.log(`        visitId: ${r.visit?.id} статус: ${r.visit?.status}`);
  }

  // 3b. Заявки с VisitRequest, но visitId указывает на ДРУГОЙ визит
  const desynced2 = await prisma.importedRequest.findMany({
    where: {
      visitRequests: { some: {} },
      equipmentType: { code: { not: 'iszh_object' } },
    },
    select: {
      id: true,
      externalRequestId: true,
      visitId: true,
      visitRequests: { select: { visitId: true } },
      equipmentType: { select: { name: true } },
    },
    take: 100,
  });

  const mismatched = desynced2.filter(r => {
    const linkedVisitId = r.visitRequests[0]?.visitId;
    return linkedVisitId && r.visitId !== linkedVisitId;
  });

  console.log(`\n  3b. Рассинхронизация: VisitRequest и visitId указывают на разные визиты`);
  console.log(`      Найдено: ${mismatched.length} (из ${desynced2.length} проверенных)`);
  for (const r of mismatched.slice(0, 20)) {
    console.log(`      → ${r.externalRequestId} (${r.equipmentType.name})`);
    console.log(`        visitId: ${r.visitId}`);
    console.log(`        VisitRequest → визит: ${r.visitRequests[0]?.visitId}`);
  }

  // 3c. Не-ИСЖ заявки с несколькими VisitRequest
  const allNonIszh = await prisma.importedRequest.findMany({
    where: { equipmentType: { code: { not: 'iszh_object' } } },
    select: {
      id: true,
      externalRequestId: true,
      equipmentType: { select: { name: true } },
      visitRequests: { select: { visitId: true, visit: { select: { status: true } } } },
    },
  });

  const multiLink = allNonIszh.filter(r => r.visitRequests.length > 1);

  console.log(`\n  3c. Не-ИСЖ заявки с несколькими VisitRequest (нарушение 1:1)`);
  console.log(`      Найдено: ${multiLink.length} (из ${allNonIszh.length} проверенных)`);

  for (const r of multiLink) {
    console.log(`      → ${r.externalRequestId} (${r.equipmentType.name}): ${r.visitRequests.length} связей`);
    for (const vr of r.visitRequests) {
      console.log(`        визит ${vr.visitId} (${vr.visit.status})`);
    }
  }

  // 3d. Виртуальные визиты с назначенными инженерами
  const virtualWithEngineers = await prisma.visit.findMany({
    where: {
      status: { in: ['planned', 'in_progress', 'not_started'] },
      userId: { not: null },
      visitEngineers: { some: {} },
      tasks: { none: {} },
    },
    select: {
      id: true,
      status: true,
      userId: true,
      addressId: true,
      _count: { select: { visitEngineers: true, importedRequests: true } },
    },
    take: 50,
  });

  console.log(`\n  3d. Визиты без задач, но с инженерами (возможные «подвисшие» ТМ-назначения)`);
  console.log(`      Найдено: ${virtualWithEngineers.length}`);
  for (const v of virtualWithEngineers) {
    console.log(`      → ${v.id}: статус ${v.status}, userId: ${v.userId}`);
    console.log(`        Инженеров: ${v._count.visitEngineers}, Заявок: ${v._count.importedRequests}`);
  }

  // 3e. Заявки со статусом «Завершён» (по visitId), но без задач по типу
  const falseCompleted = await prisma.importedRequest.findMany({
    where: {
      equipmentType: { code: { not: 'iszh_object' } },
      visit: {
        status: { in: ['completed', 'sent', 'corrected_by_tm'] },
      },
    },
    select: {
      externalRequestId: true,
      equipmentTypeId: true,
      equipmentType: { select: { name: true, code: true } },
      matchedAddress: { select: { objectCode: true } },
      visit: {
        select: {
          id: true, status: true, addressId: true,
          tasks: { select: { equipmentTypeId: true } },
        },
      },
    },
    take: 200,
  });

  const falseCompletedFiltered = falseCompleted.filter(r => {
    const hasMatchingTask = r.visit.tasks.some(t => t.equipmentTypeId === r.equipmentTypeId);
    return !hasMatchingTask;
  });

  console.log(`\n  3e. Заявки «Завершён» (по visitId), но НЕТ задачи по типу оборудования в визите`);
  console.log(`      Найдено: ${falseCompletedFiltered.length} (из ${falseCompleted.length} проверенных)`);
  for (const r of falseCompletedFiltered.slice(0, 20)) {
    console.log(`      → ${r.externalRequestId} (${r.equipmentType.name}) объект: ${r.matchedAddress?.objectCode || '—'}`);
    console.log(`        visitId: ${r.visit.id} задач по типу: 0`);
  }

  // ─── 4. ГЛУБОКАЯ ДИАГНОСТИКА: Тепловые завесы ─────────────
  console.log('\n\n━━━ 4. ГЛУБОКАЯ ДИАГНОСТИКА: все 9 «Тепловых завес» ━━━\n');

  const falseCompletedIds = falseCompletedFiltered.map(r => r.externalRequestId);
  for (const extId of falseCompletedIds) {
    const req = await prisma.importedRequest.findFirst({
      where: { externalRequestId: extId },
      include: {
        visit: {
          include: {
            tasks: {
              include: { equipmentType: { select: { name: true, code: true } } },
            },
            visitEngineers: {
              include: { engineer: { select: { fullName: true } } },
            },
          },
        },
        visitRequests: {
          select: {
            createdAt: true,
            visit: { select: { id: true, status: true, dateStart: true } },
          },
        },
        matchedAddress: { select: { objectCode: true } },
      },
    });
    if (!req) continue;

    console.log(`━━ ${extId} (${req.matchedAddress?.objectCode || '—'}) ━━`);
    console.log(`  Визит: ${req.visit?.id} статус: ${req.visit?.status} дата: ${req.visit?.dateStart?.toISOString().split('T')[0]}`);

    // Все задачи в визите
    console.log(`  Задачи в визите (${req.visit?.tasks.length || 0}):`);
    for (const t of req.visit?.tasks || []) {
      console.log(`    → ${t.equipmentType?.name} (${t.equipmentType?.code}) статус: ${t.status}`);
    }

    // VisitRequest — когда создан?
    for (const vr of req.visitRequests) {
      console.log(`  VisitRequest создан: ${vr.createdAt.toISOString()}`);
      console.log(`  VisitRequest → визит: ${vr.visit.id} (${vr.visit.status})`);
    }

    // Инженеры
    console.log(`  Инженеры:`);
    for (const ve of req.visit?.visitEngineers || []) {
      console.log(`    → ${ve.engineer.fullName} (primary: ${ve.isPrimary})`);
    }

    // Аудит — кто/когда привязал заявку?
    const auditLogs = await prisma.requestAssignmentLog.findMany({
      where: { importedRequestId: req.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        engineer: { select: { fullName: true } },
        performer: { select: { fullName: true } },
      },
    });
    console.log(`  Аудит привязки:`);
    for (const log of auditLogs) {
      console.log(`    → ${log.action} | ${log.createdAt.toISOString()} | инженер: ${log.engineer?.fullName || '—'} | выполнил: ${log.performer?.fullName || '—'} | ${log.reason || ''}`);
    }

    // Проверка: есть ли удалённые задачи в этом визите (через taskInclude)
    // Проверяем все задачи (включая удалённые) — невозможно, мягкое удаление не для tasks
    // Но можно проверить audit_log на удаление задач
    const taskDeleteLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'task',
        action: 'delete',
        // Фильтр по визиту — нет прямого поля, проверяем через newValue
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    console.log('');
  }

  // ─── 5. ПРОВЕРКА: визиты из секции 3e — какие задачи были? ─
  console.log('\n━━━ 5. УНИКАЛЬНЫЕ ВИЗИТЫ из секции 3e ━━━\n');

  const uniqueVisitIds = [...new Set(falseCompletedFiltered.map(r => r.visit.id))];
  for (const vid of uniqueVisitIds) {
    const v = await prisma.visit.findUnique({
      where: { id: vid },
      include: {
        tasks: { include: { equipmentType: { select: { name: true, code: true } } } },
        visitRequests: {
          include: {
            importedRequest: {
              select: { externalRequestId: true, equipmentType: { select: { name: true, code: true } } },
            },
          },
        },
        address: { select: { objectCode: true } },
      },
    });
    if (!v) continue;

    console.log(`Визит ${vid} (${v.address?.objectCode || '—'}) статус: ${v.status}`);
    console.log(`  Задачи:`);
    for (const t of v.tasks) {
      console.log(`    → ${t.equipmentType?.name} (${t.equipmentType?.code})`);
    }
    console.log(`  Привязанные заявки:`);
    for (const vr of v.visitRequests) {
      const hasTask = v.tasks.some(t => t.equipmentType?.code === vr.importedRequest.equipmentType?.code);
      console.log(`    → ${vr.importedRequest.externalRequestId} (${vr.importedRequest.equipmentType?.name}) ${hasTask ? '✅' : '⚠️ НЕТ ЗАДАЧИ'}`);
    }
    console.log('');
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ДИАГНОСТИКА ЗАВЕРШЕНА');
  console.log('═══════════════════════════════════════════════════════');
}

diagnose()
  .catch(err => {
    console.error('Ошибка:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
