import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Исправление коллизий имён файлов фото.
 * Несколько записей photo могут указывать на один файл на диске,
 * потому что имя файла не содержало уникального идентификатора.
 *
 * Скрипт:
 * 1. Находит группы записей с одинаковым file_path
 * 2. Каждой записи присваивает уникальный путь (копирует файл)
 * 3. Пересчитывает phash для затронутых фото
 */
async function main() {
  console.log('[fix-collisions] Поиск коллизий файлов...');

  // Находим все file_path, которые используются более чем одной записью
  const duplicates: { file_path: string; count: number }[] = await prisma.$queryRaw`
    SELECT file_path, COUNT(*) as count
    FROM photos
    WHERE file_path IS NOT NULL
    GROUP BY file_path
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;

  console.log(`[fix-collisions] Найдено ${duplicates.length} коллизий`);

  let totalFixed = 0;
  let totalCopied = 0;

  for (const dup of duplicates) {
    const photos = await prisma.photo.findMany({
      where: { filePath: dup.file_path },
      orderBy: { createdAt: 'asc' },
    });

    if (photos.length <= 1) continue;

    const originalPath = dup.file_path;
    const exists = fs.existsSync(originalPath);

    console.log(`[fix-collisions] ${originalPath} — ${photos.length} записей, файл ${exists ? 'существует' : 'ОТСУТСТВУЕТ'}`);

    // Первая запись остаётся с оригинальным путём (если файл существует)
    // Остальные получают уникальные пути
    for (let i = 1; i < photos.length; i++) {
      const photo = photos[i];
      const ext = path.extname(originalPath);
      const base = path.basename(originalPath, ext);
      const dir = path.dirname(originalPath);
      const uid = crypto.randomUUID().slice(0, 8);
      const newPath = path.join(dir, `${base}_${uid}${ext}`);

      if (exists) {
        try {
          fs.copyFileSync(originalPath, newPath);
          totalCopied++;
        } catch (err) {
          console.error(`  Ошибка копирования для ${photo.id}: ${err}`);
          continue;
        }
      }

      await prisma.photo.update({
        where: { id: photo.id },
        data: { filePath: newPath },
      });
      totalFixed++;
      console.log(`  ${photo.id}: → ${newPath}`);
    }
  }

  console.log(`\n[fix-collisions] Исправлено ${totalFixed} записей, скопировано ${totalCopied} файлов`);

  // Пересчитываем phash для всех фото с verificationStatus != 'pending'
  console.log('[fix-collisions] Пересчёт phash для затронутых фото...');

  const affectedPhotos = await prisma.photo.findMany({
    where: {
      phash: { not: null },
    },
    select: { id: true, filePath: true },
  });

  // Динамический импорт computePhash (в контейнере только dist/)
  const { computePhash } = await import('../dist/utils/phash.js');

  let recomputed = 0;
  let errors = 0;

  for (const photo of affectedPhotos) {
    if (!photo.filePath || !fs.existsSync(photo.filePath)) continue;
    try {
      const newPhash = await computePhash(photo.filePath);
      await prisma.photo.update({
        where: { id: photo.id },
        data: { phash: newPhash },
      });
      recomputed++;
    } catch (err) {
      errors++;
    }
  }

  console.log(`[fix-collisions] Пересчитано phash: ${recomputed}, ошибок: ${errors}`);
  console.log('[fix-collisions] Готово!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
