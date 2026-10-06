/**
 * ПОЛНОЕ ИСПРАВЛЕНИЕ привязок октябрьских визитов к заявкам
 * 
 * Проблема: 28 визитов имеют заявки, но не привязаны к ним
 * Решение: найти все визиты без привязок и связать их с заявками по адресу и периоду
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== ПОЛНОЕ ИСПРАВЛЕНИЕ привязок октябрьских визитов ===\n');

  // Найти все визиты октября без привязок, но с доступными заявками
  const visitsWithoutLinks = await prisma.visit.findMany({
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

  console.log(`Найдено ${visitsWithoutLinks.length} визитов без привязок\n`);

  let totalLinked = 0;
  const results: Array<{
    visitId: string;
    address: string;
    dateStart: Date;
    linkedRequests: string[];
  }> = [];

  for (const visit of visitsWithoutLinks) {
    const visitDate = visit.dateStart;
    const linkedRequestIds: string[] = [];

    // 1. Привязка заявок ИСЖ объекта (одна заявка → много визитов)
    const iszhRequests = await prisma.importedRequest.findMany({
      where: {
        matchedAddressId: visit.addressId,
        equipmentType: { code: 'iszh_object' },
        startDate: { lte: visitDate },
        deadline: { gte: visitDate },
      },
      include: {
        equipmentType: true,
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
            },
          },
        },
      });

      const alreadyLinkedToThisAddress = existingLinks.some(
        link => link.visit.addressId === visit.addressId
      );

      if (alreadyLinkedToThisAddress) {
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

      linkedRequestIds.push(request.externalRequestId);
    }

    // 2. Привязка заявок на конкретное оборудование (1 заявка → 1 визит)
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
        },
      });

      for (const request of equipRequests) {
        // Проверка: не привязана ли уже к другому визиту
        const existingLinks = await prisma.visitRequest.findMany({
          where: {
            importedRequestId: request.id,
          },
        });

        if (existingLinks.length > 0) {
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

        linkedRequestIds.push(request.externalRequestId);
      }
    }

    // 3. Синхронизация contractId
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

  console.log('\n=== ИТОГО ===');
  console.log(`Обработано визитов: ${visitsWithoutLinks.length}`);
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
