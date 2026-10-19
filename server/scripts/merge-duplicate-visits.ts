/**
 * Скрипт: Объединение дубликатов визитов за один день
 * 
 * Проблема: инженер может создать несколько визитов на один объект в один день
 * Решение: найти все дубликаты (по addressId + userId + DATE(dateStart)),
 *          оставить самый старый визит, перенести задачи и фото из остальных,
 *          удалить дубликаты (пометить isDeleted = true)
 * 
 * Запуск: npx tsx scripts/merge-duplicate-visits.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Поиск дубликатов визитов...\n');

  // Находим все группы дубликатов (визиты за один день по одному адресу от одного инженера)
  // Игнорируем визиты без user_id (импортированные через заявки)
  const duplicateGroups = await prisma.$queryRaw`
    SELECT 
      DATE(date_start) as visit_date,
      address_id,
      user_id,
      ARRAY_AGG(id ORDER BY created_at) as visit_ids
    FROM visits
    WHERE is_deleted = false
      AND user_id IS NOT NULL
    GROUP BY DATE(date_start), address_id, user_id
    HAVING COUNT(*) > 1
    ORDER BY visit_date DESC
  `;

  console.log(`Найдено групп дубликатов: ${(duplicateGroups as any[]).length}\n`);

  let totalMerged = 0;
  let totalTasksMoved = 0;
  let totalPhotosMoved = 0;

  for (const group of duplicateGroups as any[]) {
    const visitIds = group.visit_ids;
    const primaryVisitId = visitIds[0]; // Самый старый визит — основной
    const duplicateVisitIds = visitIds.slice(1); // Остальные — дубликаты

    console.log(`\n📅 Дата: ${group.visit_date}`);
    console.log(`📍 Адрес: ${group.address_id}`);
    console.log(`👤 Инженер: ${group.user_id}`);
    console.log(`✅ Основной визит: ${primaryVisitId}`);
    console.log(`❌ Дубликаты: ${duplicateVisitIds.length} шт.`);

    // Получаем задачи из дубликатов
    const duplicateTasks = await prisma.task.findMany({
      where: { visitId: { in: duplicateVisitIds } },
      include: { photos: true, equipmentItems: true },
    });

    console.log(`📋 Задач в дубликатах: ${duplicateTasks.length}`);

    // Переносим задачи в основной визит
    for (const task of duplicateTasks) {
      await prisma.task.update({
        where: { id: task.id },
        data: { visitId: primaryVisitId },
      });
      totalTasksMoved++;
      totalPhotosMoved += task.photos.length;
    }

    // Помечаем дубликаты как удалённые
    await prisma.visit.updateMany({
      where: { id: { in: duplicateVisitIds } },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: '00000000-0000-0000-0000-000000000000', // Системное удаление
      },
    });

    totalMerged += duplicateVisitIds.length;
  }

  console.log('\n\n✅ Объединение завершено!');
  console.log(`📊 Итого:`);
  console.log(`   - Объединено визитов: ${totalMerged}`);
  console.log(`   - Перенесено задач: ${totalTasksMoved}`);
  console.log(`   - Перенесено фото: ${totalPhotosMoved}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
