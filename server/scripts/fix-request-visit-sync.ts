import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getCurrentSeason(): 'summer' | 'winter' {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  if ((month > 4 && month < 9) || (month === 4 && day >= 1) || (month === 9 && day <= 30)) return 'summer';
  return 'winter';
}

async function createVirtualVisit(addressId: string, contractId: string | null) {
  return prisma.visit.create({
    data: {
      addressId,
      contractId,
      engineerName: '',
      userId: null,
      dateStart: new Date(),
      timeStart: '09:00',
      season: getCurrentSeason(),
      status: 'awaiting_assignment',
    },
  });
}

async function fix() {
  const stats = { fixed: 0, skipped: 0, errors: 0 };

  console.log('═══════════════════════════════════════════════════════');
  console.log('  МИГРАЦИЯ: Исправление связей визитов и заявок');
  console.log('  ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════\n');

  // ─── 1. Заявки с VisitRequest, но без задачи по типу оборудования в визите ─
  console.log('━━━ 1. VisitRequest без задачи по типу оборудования ━━━\n');

  const requestsWithBadLink = await prisma.importedRequest.findMany({
    where: {
      equipmentType: { code: { not: 'iszh_object' } },
      visitRequests: { some: {} },
      visit: { isDeleted: false },
    },
    select: {
      id: true,
      externalRequestId: true,
      equipmentTypeId: true,
      contractId: true,
      matchedAddressId: true,
      equipmentType: { select: { id: true, name: true, code: true } },
      matchedAddress: { select: { objectCode: true } },
      visit: {
        select: {
          id: true, status: true, isDeleted: true, addressId: true,
          tasks: { select: { equipmentTypeId: true } },
        },
      },
      visitRequests: {
        select: { id: true, visitId: true },
      },
    },
  });

  for (const req of requestsWithBadLink) {
    if (!req.visit) continue;

    const hasMatchingTask = req.visit.tasks.some(
      t => t.equipmentTypeId === req.equipmentTypeId
    );

    if (hasMatchingTask) continue; // Всё ОК, задача есть

    // Проверка: визит завершён?
    const isCompleted = ['completed', 'sent', 'corrected_by_tm'].includes(req.visit.status);
    const isDeleted = req.visit.isDeleted;

    if (!isCompleted && !isDeleted) {
      console.log(`  ⏭️  ${req.externalRequestId}: визит не завершён (${req.visit.status}), пропускаем`);
      stats.skipped++;
      continue;
    }

    console.log(`  🔧 ${req.externalRequestId} (${req.equipmentType.name}) объект: ${req.matchedAddress?.objectCode || '—'}`);
    console.log(`     Визит: ${req.visit.id} статус: ${req.visit.status} удалён: ${isDeleted}`);
    console.log(`     Задач по типу: 0 → разрываем связь`);

    try {
      // Удаляем VisitRequest
      await prisma.visitRequest.deleteMany({
        where: { importedRequestId: req.id },
      });

      // Создаём виртуальный визит
      const virtualVisit = await createVirtualVisit(req.matchedAddressId || req.visit.addressId, req.contractId);

      // Обновляем visitId
      await prisma.importedRequest.update({
        where: { id: req.id },
        data: { visitId: virtualVisit.id },
      });

      console.log(`     ✅ Исправлено → виртуальный визит ${virtualVisit.id}`);
      stats.fixed++;
    } catch (err: any) {
      console.log(`     ❌ Ошибка: ${err.message}`);
      stats.errors++;
    }
  }

  // ─── 2. Заявки с VisitRequest на удалённые визиты ─
  console.log('\n━━━ 2. VisitRequest на удалённые визиты ━━━\n');

  const requestsOnDeletedVisits = await prisma.importedRequest.findMany({
    where: {
      visitRequests: { some: { visit: { isDeleted: true } } },
    },
    select: {
      id: true,
      externalRequestId: true,
      equipmentTypeId: true,
      contractId: true,
      matchedAddressId: true,
      visitId: true,
      equipmentType: { select: { name: true, code: true } },
      matchedAddress: { select: { objectCode: true, id: true } },
      visit: { select: { id: true, isDeleted: true } },
      visitRequests: {
        select: { id: true, visitId: true, visit: { select: { isDeleted: true } } },
      },
    },
  });

  for (const req of requestsOnDeletedVisits) {
    const allDeleted = req.visitRequests.every(vr => vr.visit.isDeleted);
    if (!allDeleted) {
      console.log(`  ⏭️  ${req.externalRequestId}: не все визиты удалены, пропускаем`);
      stats.skipped++;
      continue;
    }

    console.log(`  🔧 ${req.externalRequestId} (${req.equipmentType.name}) объект: ${req.matchedAddress?.objectCode || '—'}`);
    console.log(`     Все VisitRequest → удалённые визиты`);

    try {
      // Удаляем все VisitRequest
      await prisma.visitRequest.deleteMany({
        where: { importedRequestId: req.id },
      });

      // Создаём виртуальный визит
      const virtualVisit = await createVirtualVisit(req.matchedAddressId || '', req.contractId);

      // Обновляем visitId
      await prisma.importedRequest.update({
        where: { id: req.id },
        data: { visitId: virtualVisit.id },
      });

      console.log(`     ✅ Исправлено → виртуальный визит ${virtualVisit.id}`);
      stats.fixed++;
    } catch (err: any) {
      console.log(`     ❌ Ошибка: ${err.message}`);
      stats.errors++;
    }
  }

  // ─── 3. Рассинхронизация: нет VisitRequest, visitId → completed ─
  console.log('\n━━━ 3. Рассинхронизация: нет VisitRequest, visitId → completed ━━━\n');

  const desynced = await prisma.importedRequest.findMany({
    where: {
      visitRequests: { none: {} },
      visit: {
        status: { in: ['completed', 'sent', 'corrected_by_tm'] },
      },
      equipmentType: { code: { not: 'iszh_object' } },
    },
    select: {
      id: true,
      externalRequestId: true,
      equipmentTypeId: true,
      contractId: true,
      matchedAddressId: true,
      visitId: true,
      equipmentType: { select: { id: true, name: true } },
      matchedAddress: { select: { objectCode: true, id: true } },
      visit: {
        select: {
          id: true, status: true,
          tasks: { select: { equipmentTypeId: true } },
        },
      },
    },
  });

  for (const req of desynced) {
    // Проверяем: может задача всё-таки есть в визите?
    const hasTask = req.visit?.tasks.some(t => t.equipmentTypeId === req.equipmentTypeId);

    if (hasTask) {
      // Задача есть, но VisitRequest отсутствует — нужно восстановить связь
      console.log(`  🔧 ${req.externalRequestId} (${req.equipmentType.name}): задача есть, но нет VisitRequest — восстанавливаем`);
      try {
        await prisma.visitRequest.create({
          data: {
            visitId: req.visitId!,
            importedRequestId: req.id,
          },
        });
        console.log(`     ✅ VisitRequest восстановлен`);
        stats.fixed++;
      } catch (err: any) {
        console.log(`     ❌ Ошибка: ${err.message}`);
        stats.errors++;
      }
    } else {
      // Задачи нет — сбрасываем на виртуальный визит
      console.log(`  🔧 ${req.externalRequestId} (${req.equipmentType.name}) объект: ${req.matchedAddress?.objectCode || '—'}`);
      console.log(`     visitId → ${req.visit?.id} (completed), задач по типу нет → сброс`);

      try {
        const virtualVisit = await createVirtualVisit(req.matchedAddressId || '', req.contractId);
        await prisma.importedRequest.update({
          where: { id: req.id },
          data: { visitId: virtualVisit.id },
        });
        console.log(`     ✅ Исправлено → виртуальный визит ${virtualVisit.id}`);
        stats.fixed++;
      } catch (err: any) {
        console.log(`     ❌ Ошибка: ${err.message}`);
        stats.errors++;
      }
    }
  }

  // ─── ИТОГО ─
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  МИГРАЦИЯ ЗАВЕРШЕНА`);
  console.log(`  Исправлено: ${stats.fixed}`);
  console.log(`  Пропущено:  ${stats.skipped}`);
  console.log(`  Ошибки:     ${stats.errors}`);
  console.log('═══════════════════════════════════════════════════════');
}

fix()
  .catch(err => {
    console.error('Критическая ошибка:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
