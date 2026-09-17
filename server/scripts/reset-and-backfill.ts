/**
 * Сброс верификации и повторный backfill с расширенным pHash.
 */
import { PrismaClient } from '@prisma/client';
const { verifyPhoto } = await import('../dist/services/photoVerification.js');

const prisma = new PrismaClient();

async function main() {
  console.log('[reset] Удаление старых отклонений...');
  const deleted = await prisma.visitAnomaly.deleteMany({});
  console.log(`[reset] Удалено отклонений: ${deleted.count}`);

  console.log('[reset] Сброс verificationStatus и phash...');
  const reset = await prisma.photo.updateMany({
    where: {},
    data: { verificationStatus: 'pending', verificationDetails: null, phash: null },
  });
  console.log(`[reset] Сброшено фото: ${reset.count}`);

  console.log('\n[backfill] Начало повторной проверки...');

  const photos = await prisma.photo.findMany({
    where: {
      verificationStatus: 'pending',
      taskId: { not: null },
      task: { visit: { isDeleted: false } },
    },
    select: { id: true },
    take: 5000,
  });

  const itemPhotos = await prisma.photo.findMany({
    where: {
      verificationStatus: 'pending',
      taskEquipmentItemId: { not: null },
      taskEquipmentItem: { task: { visit: { isDeleted: false } } },
    },
    select: { id: true },
    take: 5000,
  });

  const allPhotoIds = [...new Set([...photos.map(p => p.id), ...itemPhotos.map(p => p.id)])];
  console.log(`[backfill] Найдено ${allPhotoIds.length} фото для проверки`);

  let processed = 0;
  let errors = 0;
  const batchSize = 10;

  for (let i = 0; i < allPhotoIds.length; i += batchSize) {
    const batch = allPhotoIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(id => verifyPhoto(id)));
    for (const r of results) {
      if (r.status === 'fulfilled') processed++;
      else { errors++; console.error(`[backfill] Ошибка:`, r.reason); }
    }
    if ((i + batchSize) % 100 === 0 || i + batchSize >= allPhotoIds.length) {
      console.log(`[backfill] Прогресс: ${Math.min(i + batchSize, allPhotoIds.length)}/${allPhotoIds.length} (ошибок: ${errors})`);
    }
  }

  const stats = await prisma.photo.groupBy({ by: ['verificationStatus'], where: { id: { in: allPhotoIds } }, _count: true });
  const anomalyCount = await prisma.visitAnomaly.count();
  const criticalCount = await prisma.visitAnomaly.count({ where: { severity: 'critical' } });

  console.log('\n[backfill] Завершено!');
  console.log(`[backfill] Обработано: ${processed}, ошибок: ${errors}`);
  console.log('[backfill] Статусы:');
  for (const s of stats) console.log(`  ${s.verificationStatus}: ${s._count}`);
  console.log(`[backfill] Отклонений: ${anomalyCount} (критических: ${criticalCount})`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
