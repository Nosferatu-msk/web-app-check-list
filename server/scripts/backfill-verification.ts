/**
 * Backfill: проверка всех существующих фото из активных визитов.
 * Запуск: node scripts/backfill-verification.js
 *
 * Проходит по всем фото из не-удалённых визитов, для которых verificationStatus = 'pending'
 * или phash IS NULL, и запускает verifyPhoto.
 */
import { PrismaClient } from '@prisma/client';

// Динамический импорт — работает и из scripts/ (через tsx) и из dist/
const { verifyPhoto } = await import('../dist/services/photoVerification.js');

const prisma = new PrismaClient();

async function main() {
  console.log('[backfill] Начало проверки существующих фото...');

  // Находим все фото из активных (не удалённых) визитов без верификации
  const photos = await prisma.photo.findMany({
    where: {
      OR: [
        { verificationStatus: 'pending' },
        { phash: null },
      ],
      // Только фото из ТО-визитов (не MTR — у них нет visit_anomalies)
      taskId: { not: null },
      task: {
        visit: {
          isDeleted: false,
        },
      },
    },
    select: { id: true },
    take: 5000,
  });

  // Также фото из групповых задач
  const itemPhotos = await prisma.photo.findMany({
    where: {
      OR: [
        { verificationStatus: 'pending' },
        { phash: null },
      ],
      taskEquipmentItemId: { not: null },
      taskEquipmentItem: {
        task: {
          visit: {
            isDeleted: false,
          },
        },
      },
    },
    select: { id: true },
    take: 5000,
  });

  const allPhotoIds = [...new Set([...photos.map(p => p.id), ...itemPhotos.map(p => p.id)])];
  console.log(`[backfill] Найдено ${allPhotoIds.length} фото для проверки`);

  let processed = 0;
  let errors = 0;

  // Обрабатываем батчами по 10 для снижения нагрузки
  const batchSize = 10;
  for (let i = 0; i < allPhotoIds.length; i += batchSize) {
    const batch = allPhotoIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(id => verifyPhoto(id))
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        processed++;
      } else {
        errors++;
        console.error(`[backfill] Ошибка верификации:`, r.reason);
      }
    }

    if ((i + batchSize) % 100 === 0 || i + batchSize >= allPhotoIds.length) {
      console.log(`[backfill] Прогресс: ${Math.min(i + batchSize, allPhotoIds.length)}/${allPhotoIds.length} (ошибок: ${errors})`);
    }
  }

  // Статистика результатов
  const stats = await prisma.photo.groupBy({
    by: ['verificationStatus'],
    where: {
      id: { in: allPhotoIds },
    },
    _count: true,
  });

  console.log('\n[backfill] Завершено!');
  console.log(`[backfill] Обработано: ${processed}, ошибок: ${errors}`);
  console.log('[backfill] Статусы верификации:');
  for (const s of stats) {
    console.log(`  ${s.verificationStatus}: ${s._count}`);
  }

  const anomalyCount = await prisma.visitAnomaly.count();
  console.log(`[backfill] Всего отклонений создано: ${anomalyCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
