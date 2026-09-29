import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VISIT_ID = '1484be38-1899-4a02-bba0-bfbfad2b5115';
const REQUEST_IDS = ['IS1000000027', 'IS1000000034'];

async function restore() {
  console.log('=== Восстановление визита и привязка заявок ===\n');

  // 1. Проверяем визит
  const visit = await prisma.visit.findUnique({
    where: { id: VISIT_ID },
    include: {
      tasks: { include: { equipmentType: { select: { name: true, code: true } } } },
      visitEngineers: { include: { engineer: { select: { fullName: true } } } },
      address: { select: { objectCode: true, fullAddress: true } },
    },
  });

  if (!visit) {
    console.log('❌ Визит не найден');
    return;
  }

  console.log(`Визит: ${visit.id}`);
  console.log(`Статус: ${visit.status}, Удалён: ${visit.isDeleted}`);
  console.log(`Адрес: ${visit.address?.objectCode} | ${visit.address?.fullAddress}`);
  console.log(`Задач: ${visit.tasks.length}`);
  for (const t of visit.tasks) {
    console.log(`  → ${t.equipmentType?.name} (${t.equipmentType?.code})`);
  }
  console.log(`Инженеры: ${visit.visitEngineers.length}`);
  for (const ve of visit.visitEngineers) {
    console.log(`  → ${ve.engineer.fullName}`);
  }

  // 2. Восстанавливаем визит
  if (visit.isDeleted) {
    await prisma.visit.update({
      where: { id: VISIT_ID },
      data: { isDeleted: false },
    });
    console.log('\n✅ Визит восстановлен (isDeleted = false)');
  } else {
    console.log('\nℹ️  Визит не удалён — восстановление не нужно');
  }

  // 3. Находим заявки
  for (const extId of REQUEST_IDS) {
    const request = await prisma.importedRequest.findFirst({
      where: { externalRequestId: extId },
      include: {
        equipmentType: { select: { name: true, code: true, id: true } },
        visit: { select: { id: true, status: true } },
        visitRequests: { select: { visitId: true } },
      },
    });

    if (!request) {
      console.log(`\n❌ Заявка ${extId} не найдена`);
      continue;
    }

    console.log(`\n━━ ${extId} (${request.equipmentType.name}) ━━`);
    console.log(`  Текущий visitId: ${request.visit?.id} (${request.visit?.status})`);
    console.log(`  VisitRequest: ${request.visitRequests.length > 0 ? request.visitRequests.map(vr => vr.visitId).join(', ') : 'нет'}`);

    // Проверяем, есть ли уже VisitRequest на этот визит
    const existingLink = await prisma.visitRequest.findUnique({
      where: {
        visitId_importedRequestId: {
          visitId: VISIT_ID,
          importedRequestId: request.id,
        },
      },
    });

    if (existingLink) {
      console.log(`  ✅ VisitRequest уже существует`);
    } else {
      // Создаём VisitRequest
      await prisma.visitRequest.create({
        data: {
          visitId: VISIT_ID,
          importedRequestId: request.id,
        },
      });
      console.log(`  ✅ VisitRequest создан`);
    }

    // Обновляем visitId
    await prisma.importedRequest.update({
      where: { id: request.id },
      data: { visitId: VISIT_ID },
    });
    console.log(`  ✅ visitId обновлён на ${VISIT_ID}`);
  }

  // 4. Проверяем результат
  console.log('\n=== Проверка результата ===\n');

  const updatedVisit = await prisma.visit.findUnique({
    where: { id: VISIT_ID },
    include: {
      visitRequests: {
        include: {
          importedRequest: {
            select: { externalRequestId: true, equipmentType: { select: { name: true } } },
          },
        },
      },
    },
  });

  console.log(`Визит: ${updatedVisit?.id}, статус: ${updatedVisit?.status}, удалён: ${updatedVisit?.isDeleted}`);
  console.log(`Привязанные заявки:`);
  for (const vr of updatedVisit?.visitRequests || []) {
    console.log(`  → ${vr.importedRequest.externalRequestId} (${vr.importedRequest.equipmentType?.name})`);
  }

  console.log('\n✅ Готово');
}

restore()
  .catch(err => { console.error('Ошибка:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
