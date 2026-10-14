/**
 * Скрипт пересчёта привязок заявок к визитам по serialNumber.
 * Запускается после миграции данных (разрыв связей не-ИСЖ заявок).
 * 
 * Использование:
 *   cd server
 *   npx tsx scripts/recalculate-request-bindings.ts
 * 
 * Логика:
 *   Для каждой не-ИСЖ заявки с serialNumber != null:
 *   1. Ищем визит по (addressId, contractId, period, equipmentTypeCode, serialNumber)
 *   2. Если найден — создаём VisitRequest + обновляем visitId
 *   3. Логируем результат
 */

import prisma from '../src/models/prisma.js';
import { findMatchingVisit } from '../src/utils/requestBinding.js';

async function main() {
  console.log('[recalculate] Начало пересчёта привязок...');

  // Получаем все не-ИСЖ заявки с serialNumber
  const requests = await prisma.importedRequest.findMany({
    where: {
      serialNumber: { not: null },
      equipmentTypeCode: { not: 'iszh_object' },
      matchedAddressId: { not: null },
      startDate: { not: null },
      deadline: { not: null },
      visitRequests: { none: {} }, // только непривязанные заявки
    },
    include: { equipmentType: true },
  });

  console.log(`[recalculate] Найдено ${requests.length} заявок с serialNumber`);

  let bound = 0;
  let notBound = 0;
  let errors = 0;

  for (const request of requests) {
    try {
      // Ищем подходящий визит
      const matchingVisit = await findMatchingVisit(
        request.matchedAddressId!,
        request.contractId,
        request.equipmentTypeCode!,
        request.serialNumber!,
        request.startDate!,
        request.deadline!,
      );

      if (matchingVisit) {
        // Создаём связь
        await prisma.visitRequest.create({
          data: {
            visitId: matchingVisit.id,
            importedRequestId: request.id,
          },
        });
        // Обновляем visitId
        await prisma.importedRequest.update({
          where: { id: request.id },
          data: { visitId: matchingVisit.id },
        });
        console.log(`[recalculate] ✅ ${request.externalRequestId} (SN: ${request.serialNumber}) → визит ${matchingVisit.id}`);
        bound++;
      } else {
        console.log(`[recalculate] ⚠️ ${request.externalRequestId} (SN: ${request.serialNumber}) — визит не найден`);
        notBound++;
      }
    } catch (err: any) {
      console.error(`[recalculate] ❌ ${request.externalRequestId}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n[recalculate] Итого:`);
  console.log(`  Привязано: ${bound}`);
  console.log(`  Не привязано (визит не найден): ${notBound}`);
  console.log(`  Ошибок: ${errors}`);
  console.log(`[recalculate] Завершено.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
