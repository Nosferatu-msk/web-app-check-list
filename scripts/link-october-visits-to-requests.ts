/**
 * Скрипт связывания октябрьских визитов с заявками
 * 
 * Проблема: визиты, созданные в октябре вручную (без автопривязки), 
 * не связаны с заявками октября через VisitRequest
 * 
 * Решение: найти визиты октября без привязок и связать их с заявками
 * по адресу и периоду действия заявки
 * 
 * Запуск на production:
 *   docker compose -f docker-compose.prod.yml exec -T server npx tsx scripts/link-october-visits-to-requests.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Скрипт связывания октябрьских визитов с заявками ===\n');

  // 1. Найти все визиты октября без привязки к заявкам
  const octoberVisitsWithoutRequests = await prisma.visit.findMany({
    where: {
      dateStart: {
        gte: new Date('2026-10-01T00:00:00.000Z'),
        lt: new Date('2026-11-01T00:00:00.000Z'),
      },
      isDeleted: false,
      visitRequests: {
        none: {},
      },
    },
    include: {
      address: true,
      tasks: {
        select: {
          equipmentTypeId: true,
        },
      },
      visitEngineers: {
        include: {
          engineer: true,
        },
      },
    },
    orderBy: {
      dateStart: 'asc',
    },
  });

  console.log(`Найдено ${octoberVisitsWithoutRequests.length} визитов октября без привязки к заявкам\n`);

  if (octoberVisitsWithoutRequests.length === 0) {
    console.log('Все визиты октября уже привязаны к заявкам!');
    return;
  }

  let totalLinked = 0;
  const results: Array<{
    visitId: string;
    address: string;
    dateStart: Date;
    linkedRequests: string[];
  }> = [];

  for (const visit of octoberVisitsWithoutRequests) {
    console.log(`\nВизит ${visit.id}:`);
    console.log(`  Адрес: ${visit.address.fullAddress}`);
    console.log(`  Дата: ${visit.dateStart.toISOString().split('T')[0]}`);
    console.log(`  Статус: ${visit.status}`);

    const visitDate = visit.dateStart;
    const linkedRequestIds: string[] = [];

    // 2а. Привязка заявок ИСЖ объекта (одна заявка → много визитов)
    const iszhRequests = await prisma.importedRequest.findMany({
      where: {
        matchedAddressId: visit.addressId,
        equipmentType: { code: 'iszh_object' },
        startDate: { lte: visitDate },
        deadline: { gte: visitDate },
        NOT: {
          visitRequests: {
            some: { visitId: visit.id },
          },
        },
      },
      include: {
        equipmentType: true,
        visit: true,
      },
      orderBy: {
        importedAt: 'asc',
      },
    });

    // Защита от дубликатов по периоду
    const seenPeriods = new Set<string>();
    const uniqueIszh = iszhRequests.filter(r => {
      const periodKey = `${r.startDate?.toISOString()}_${r.deadline?.toISOString()}`;
      if (seenPeriods.has(periodKey)) return false;
      seenPeriods.add(periodKey);
      return true;
    });

    console.log(`  Найдено заявок ИСЖ объекта: ${uniqueIszh.length}`);

    for (const request of uniqueIszh) {
      // Проверка: не привязана ли уже к другому визиту на этом адресе
      const existingLinks = await prisma.visitRequest.findMany({
        where: {
          importedRequestId: request.id,
        },
        include: {
          visit: {
            select: {
              addressId: true,
              dateStart: true,
            },
          },
        },
      });

      // Если заявка уже привязана к визиту на этом же адресе в октябре — пропускаем
      const alreadyLinkedToThisAddress = existingLinks.some(
        link => link.visit.addressId === visit.addressId
      );

      if (alreadyLinkedToThisAddress) {
        console.log(`    ⚠ Заявка ${request.externalRequestId} уже привязана к другому визиту на этом адресе`);
        continue;
      }

      await prisma.visitRequest.create({
        data: {
          visitId: visit.id,
          importedRequestId: request.id,
        },
      });

      await prisma.importedRequest.update({
        where: { id: request.id },
        data: { visitId: visit.id },
      });

      await prisma.requestAssignmentLog.create({
        data: {
          importedRequestId: request.id,
          action: 'assigned',
          engineerId: visit.visitEngineers[0]?.engineerId || null,
          performedBy: null,
          reason: 'Автоматическая привязка октябрьских визитов (скрипт)',
        },
      });

      linkedRequestIds.push(request.externalRequestId);
      console.log(`    ✓ Привязана заявка ИСЖ: ${request.externalRequestId}`);
    }

    // 2б. Привязка заявок на конкретное оборудование (1 заявка → 1 визит)
    const taskEquipmentTypeIds = [
      ...new Set(visit.tasks.map(t => t.equipmentTypeId).filter(Boolean)),
    ] as string[];

    if (taskEquipmentTypeIds.length > 0) {
      const equipRequests = await prisma.importedRequest.findMany({
        where: {
          matchedAddressId: visit.addressId,
          equipmentTypeId: { in: taskEquipmentTypeIds },
          equipmentType: { code: { not: 'iszh_object' } },
          startDate: { lte: visitDate },
          deadline: { gte: visitDate },
          visitRequests: { none: {} },
        },
        include: {
          equipmentType: true,
          visit: true,
        },
      });

      console.log(`  Найдено заявок на оборудование: ${equipRequests.length}`);

      for (const request of equipRequests) {
        // Проверка: не привязана ли уже к другому визиту
        const existingLinks = await prisma.visitRequest.findMany({
          where: {
            importedRequestId: request.id,
          },
        });

        if (existingLinks.length > 0) {
          console.log(`    ⚠ Заявка ${request.externalRequestId} уже привязана к другому визиту`);
          continue;
        }

        await prisma.visitRequest.create({
          data: {
            visitId: visit.id,
            importedRequestId: request.id,
          },
        });

        await prisma.importedRequest.update({
          where: { id: request.id },
          data: { visitId: visit.id },
        });

        await prisma.requestAssignmentLog.create({
          data: {
            importedRequestId: request.id,
            action: 'assigned',
            engineerId: visit.visitEngineers[0]?.engineerId || null,
            performedBy: null,
            reason: 'Автоматическая привязка октябрьских визитов (скрипт)',
          },
        });

        linkedRequestIds.push(request.externalRequestId);
        console.log(`    ✓ Привязана заявка: ${request.externalRequestId} (${request.equipmentType.code})`);
      }
    }

    // 2в. Синхронизация contractId из заявки в визит
    if (linkedRequestIds.length > 0 && !visit.contractId) {
      const firstRequest = await prisma.importedRequest.findFirst({
        where: {
          externalRequestId: { in: linkedRequestIds },
          contractId: { not: null },
        },
        select: { contractId: true },
      });

      if (firstRequest?.contractId) {
        await prisma.visit.update({
          where: { id: visit.id },
          data: { contractId: firstRequest.contractId },
        });
        console.log(`  ✓ Установлен contractId: ${firstRequest.contractId}`);
      }
    }

    if (linkedRequestIds.length > 0) {
      results.push({
        visitId: visit.id,
        address: visit.address.fullAddress,
        dateStart: visit.dateStart,
        linkedRequests: linkedRequestIds,
      });
      totalLinked += linkedRequestIds.length;
    }
  }

  console.log('\n\n=== ИТОГО ===');
  console.log(`Обработано визитов: ${octoberVisitsWithoutRequests.length}`);
  console.log(`Создано привязок: ${totalLinked}`);
  console.log('\nДетали:');
  results.forEach(r => {
    console.log(`  Визит ${r.visitId.slice(0, 8)}... (${r.address}, ${r.dateStart.toISOString().split('T')[0]})`);
    r.linkedRequests.forEach(reqId => {
      console.log(`    → ${reqId}`);
    });
  });
}

main()
  .catch(e => {
    console.error('Ошибка выполнения скрипта:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
