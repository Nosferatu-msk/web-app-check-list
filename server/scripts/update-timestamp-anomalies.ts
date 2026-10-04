import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TIMESTAMP_CRITICAL_THRESHOLD_MIN = 10000;

/**
 * Массовое обновление существующих timestamp-отклонений
 * Критические отклонения понижаются до warning, если differenceMinutes <= 10000
 */
async function updateTimestampAnomalies() {
  console.log('=== Обновление timestamp-отклонений с новыми критериями ===\n');

  // Получаем все timestamp-отклонения
  const anomalies = await prisma.visitAnomaly.findMany({
    where: {
      type: 'photo_timestamp_mismatch',
    },
  });

  console.log(`Найдено timestamp-отклонений: ${anomalies.length}\n`);

  let updatedToWarning = 0;
  let keptAsCritical = 0;
  let alreadyWarning = 0;

  for (const anomaly of anomalies) {
    const details = anomaly.details as any;
    const diffMinutes = details?.differenceMinutes || 0;

    // Если уже warning — пропускаем
    if (anomaly.severity === 'warning') {
      alreadyWarning++;
      continue;
    }

    // Если отклонение <= 10000 минут — понижаем до warning
    if (diffMinutes <= TIMESTAMP_CRITICAL_THRESHOLD_MIN) {
      await prisma.visitAnomaly.update({
        where: { id: anomaly.id },
        data: { 
          severity: 'warning',
          details: {
            ...details,
            severity: 'warning',
            updatedByScript: 'recheck-timestamp-2026-10-04',
          },
        },
      });
      updatedToWarning++;
      console.log(`✓ Понижено до warning: визит ${anomaly.visitId}, отклонение ${diffMinutes} мин`);
    } else {
      // Остаётся critical
      keptAsCritical++;
      console.log(`✓ Оставлено critical: визит ${anomaly.visitId}, отклонение ${diffMinutes} мин (${Math.round(diffMinutes / 60)} часов)`);
      
      // Обновляем details для согласованности
      await prisma.visitAnomaly.update({
        where: { id: anomaly.id },
        data: {
          details: {
            ...details,
            severity: 'critical',
            updatedByScript: 'recheck-timestamp-2026-10-04',
          },
        },
      });
    }
  }

  console.log('\n=== Итоговая статистика ===');
  console.log(`Всего timestamp-отклонений: ${anomalies.length}`);
  console.log(`Понижены до warning: ${updatedToWarning}`);
  console.log(`Оставлены critical: ${keptAsCritical}`);
  console.log(`Уже были warning: ${alreadyWarning}`);

  // Теперь пересчитаем статусы верификации для затронутых фото
  console.log('\n=== Пересчёт статусов верификации фото ===\n');

  // Получаем все фото, у которых есть timestamp-отклонения
  const affectedPhotoIds = anomalies
    .filter(a => a.photoId)
    .map(a => a.photoId!);

  if (affectedPhotoIds.length === 0) {
    console.log('Нет затронутых фото для пересчёта');
    return;
  }

  let statusUpdated = 0;

  for (const photoId of affectedPhotoIds) {
    // Получаем все отклонения для этого фото
    const photoAnomalies = await prisma.visitAnomaly.findMany({
      where: { photoId },
    });

    const hasCritical = photoAnomalies.some(a => a.severity === 'critical');
    const hasWarning = photoAnomalies.some(a => a.severity === 'warning');

    const newStatus = hasCritical ? 'suspicious' : hasWarning ? 'warning' : 'clean';

    await prisma.photo.update({
      where: { id: photoId },
      data: { verificationStatus: newStatus },
    });

    statusUpdated++;
  }

  console.log(`Обновлено статусов фото: ${statusUpdated}`);
  console.log('\n=== Готово! ===');
}

updateTimestampAnomalies()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
