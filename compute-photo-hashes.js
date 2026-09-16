import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';

const prisma = new PrismaClient();

function computeFileHash(filePath: string): string | null {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch {
    return null;
  }
}

async function computeHashes() {
  console.log('=== ПЕРЕСЧЁТ ХЕШЕЙ ДЛЯ СУЩЕСТВУЮЩИХ ФОТО ===\n');

  // Находим все фото без хеша
  const photosWithoutHash = await prisma.photo.findMany({
    where: { hash: null },
  });

  console.log(`Фото без хеша: ${photosWithoutHash.length}\n`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const photo of photosWithoutHash) {
    if (!fs.existsSync(photo.filePath)) {
      console.log(`❌ Файл не найден: ${photo.filePath}`);
      notFound++;
      continue;
    }

    const hash = computeFileHash(photo.filePath);
    if (hash) {
      await prisma.photo.update({
        where: { id: photo.id },
        data: { hash },
      });
      console.log(`✅ ${photo.id.substring(0, 8)} → ${hash.substring(0, 16)}...`);
      updated++;
    } else {
      console.log(`❌ Ошибка вычисления хеша: ${photo.filePath}`);
      errors++;
    }
  }

  console.log(`\n=== РЕЗУЛЬТАТ ===`);
  console.log(`Обновлено: ${updated}`);
  console.log(`Файлов не найдено: ${notFound}`);
  console.log(`Ошибок: ${errors}`);

  await prisma.$disconnect();
}

computeHashes().catch(console.error);
