import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

/**
 * Синхронизация имён файлов фото в БД с реальными файлами на диске.
 * 
 * Проблема: БД от 22 октября содержит имена файлов без хешей (например, 01_splitvn_server_after.jpg),
 * но на диске файлы имеют хеши (например, 01_splitvn_server_after_150f5f3a.jpg).
 * 
 * Скрипт:
 * 1. Находит все записи photo с именами без хешей
 * 2. Для каждой записи ищет соответствующий файл на диске
 * 3. Обновляет file_name и file_path в БД
 */
async function main() {
  console.log('[sync-photo] Начало синхронизации имён файлов фото...');

  // Директория с фотографиями
  const uploadsDir = '/app/uploads';
  
  // Получаем все файлы на диске
  const diskFiles = fs.readdirSync(uploadsDir);
  console.log(`[sync-photo] Файлов на диске: ${diskFiles.length}`);

  // Находим все записи в БД, которых нет на диске
  // Получаем все файлы на диске
  const diskFilesSet = new Set(diskFiles);
  
  // Находим все записи в БД
  const allPhotos = await prisma.photo.findMany();
  
  // Фильтруем те, которых нет на диске
  const photosWithoutHash = allPhotos.filter(p => !diskFilesSet.has(p.fileName));

  console.log(`[sync-photo] Записей в БД без хеша: ${photosWithoutHash.length}`);

  let updated = 0;
  let notFound = 0;
  let multipleMatches = 0;

  for (const photo of photosWithoutHash) {
    const baseName = photo.fileName.replace('.jpg', '');
    
    // Ищем файлы на диске, которые начинаются с базового имени
    const matches = diskFiles.filter(f => {
      if (!f.startsWith(baseName)) return false;
      // Проверяем, что после базового имени идёт _ и хеш (8 символов)
      const rest = f.substring(baseName.length);
      return /^_[a-f0-9]{8}\.jpg$/.test(rest);
    });

    if (matches.length === 0) {
      notFound++;
      console.log(`  [NOT FOUND] ${photo.fileName} (id: ${photo.id})`);
      continue;
    }

    if (matches.length > 1) {
      multipleMatches++;
      console.log(`  [MULTIPLE] ${photo.fileName} → ${matches.length} файлов: ${matches.join(', ')}`);
      // Для коллизий пытаемся сопоставить по task_id и created_at
      // Но пока просто берём первый файл
      console.log(`    Берём первый: ${matches[0]}`);
    }

    const newFileName = matches[0];
    const newFilePath = path.join(uploadsDir, newFileName);

    // Обновляем БД
    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        fileName: newFileName,
        filePath: newFilePath,
      },
    });

    updated++;
    if (matches.length === 1) {
      console.log(`  [OK] ${photo.fileName} → ${newFileName}`);
    }
  }

  console.log(`\n[sync-photo] Итоги:`);
  console.log(`  Обновлено: ${updated}`);
  console.log(`  Не найдено: ${notFound}`);
  console.log(`  Несколько совпадений: ${multipleMatches}`);
  console.log('[sync-photo] Готово!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
