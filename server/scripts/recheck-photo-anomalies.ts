import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Перепроверка существующих отклонений фото с новыми критериями:
 * - pHash совпадение: critical (как и было)
 * - Timestamp: critical только если > 10000 минут (ранее было любое отклонение)
 */
async function recheckAnomalies() {
  console.log('=== Перепроверка отклонений фото с новыми критериями ===\n');

  // Получаем все отклонения по фото
  const anomalies = await prisma.visitAnomaly.findMany({
    where: {
      OR: [
        { type: 'photo_phash_match' },
        { type: 'photo_timestamp_mismatch' },
      ],
    },
    include: {
      visit: {
        include: {
          address: true,
          user: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Найдено отклонений: ${anomalies.length}\n`);

  const phashAnomalies = anomalies.filter(a => a.type === 'photo_phash_match');
  const timestampAnomalies = anomalies.filter(a => a.type === 'photo_timestamp_mismatch');

  console.log(`- pHash совпадения: ${phashAnomalies.length}`);
  console.log(`- Timestamp отклонения: ${timestampAnomalies.length}\n`);

  // Анализируем timestamp отклонения
  console.log('=== Анализ timestamp отклонений ===\n');

  const criticalTimestamp = [];
  const warningTimestamp = [];

  for (const anomaly of timestampAnomalies) {
    const details = anomaly.details as any;
    const diffMinutes = details?.differenceMinutes || 0;

    if (diffMinutes > 10000) {
      criticalTimestamp.push({ anomaly, diffMinutes });
    } else {
      warningTimestamp.push({ anomaly, diffMinutes });
    }
  }

  console.log(`Критические (> 10000 мин): ${criticalTimestamp.length}`);
  console.log(`Предупреждения (<= 10000 мин): ${warningTimestamp.length}\n`);

  if (criticalTimestamp.length > 0) {
    console.log('--- Критические отклонения (оставить) ---');
    for (const { anomaly, diffMinutes } of criticalTimestamp) {
      const details = anomaly.details as any;
      console.log(`  Визит: ${anomaly.visitId}`);
      console.log(`  Адрес: ${anomaly.visit?.address?.objectCode || 'неизвестно'}`);
      console.log(`  Инженер: ${anomaly.visit?.user?.fullName || 'неизвестно'}`);
      console.log(`  Отклонение: ${diffMinutes} минут (${Math.round(diffMinutes / 60)} часов)`);
      console.log(`  Тип: ${details?.timingType || 'неизвестно'}`);
      console.log(`  Дата создания: ${anomaly.createdAt}`);
      console.log('');
    }
  }

  if (warningTimestamp.length > 0) {
    console.log('--- Отклонения, которые станут warning (<= 10000 мин) ---');
    for (const { anomaly, diffMinutes } of warningTimestamp.slice(0, 10)) {
      const details = anomaly.details as any;
      console.log(`  Визит: ${anomaly.visitId}`);
      console.log(`  Адрес: ${anomaly.visit?.address?.objectCode || 'неизвестно'}`);
      console.log(`  Отклонение: ${diffMinutes} минут (${Math.round(diffMinutes / 60)} часов)`);
      console.log(`  Тип: ${details?.timingType || 'неизвестно'}`);
      console.log('');
    }

    if (warningTimestamp.length > 10) {
      console.log(`  ... и ещё ${warningTimestamp.length - 10} отклонений\n`);
    }
  }

  // Анализируем pHash отклонения
  console.log('\n=== Анализ pHash отклонений ===\n');

  const phashCritical = phashAnomalies.filter(a => a.severity === 'critical');
  const phashWarning = phashAnomalies.filter(a => a.severity === 'warning');

  console.log(`Критические (pHash): ${phashCritical.length}`);
  console.log(`Предупреждения (pHash): ${phashWarning.length}\n`);

  if (phashCritical.length > 0) {
    console.log('--- Критические pHash отклонения ---');
    for (const anomaly of phashCritical.slice(0, 5)) {
      const details = anomaly.details as any;
      console.log(`  Визит: ${anomaly.visitId}`);
      console.log(`  Адрес: ${anomaly.visit?.address?.objectCode || 'неизвестно'}`);
      console.log(`  Инженер: ${anomaly.visit?.user?.fullName || 'неизвестно'}`);
      console.log(`  Сходство: ${details?.similarityPercent || 0}%`);
      console.log(`  Расстояние Хэмминга: ${details?.hammingDistance || 0}`);
      console.log(`  Совпадение с визитом: ${details?.matchVisitId || 'неизвестно'}`);
      console.log(`  Информация: ${details?.matchInfo || 'неизвестно'}`);
      console.log('');
    }

    if (phashCritical.length > 5) {
      console.log(`  ... и ещё ${phashCritical.length - 5} отклонений\n`);
    }
  }

  console.log('\n=== Итоговая статистика ===');
  console.log(`Всего отклонений: ${anomalies.length}`);
  console.log(`Критические (останутся): ${phashCritical.length + criticalTimestamp.length}`);
  console.log(`Будут понилены до warning: ${warningTimestamp.length}`);
  console.log(`Warning (останутся): ${phashWarning.length}`);
}

recheckAnomalies()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
