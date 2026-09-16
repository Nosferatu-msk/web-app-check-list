import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
  console.log('=== ДИАГНОСТИКА ДУБЛИКАТОВ PROPOSALS ===\n');

  // Находим адрес
  const address = await prisma.address.findFirst({
    where: {
      fullAddress: { contains: 'Можайское' },
    },
  });

  if (!address) {
    console.log('Адрес не найден');
    return;
  }

  console.log('Адрес:', address.fullAddress);
  console.log('ID:', address.id);
  console.log('');

  // Получаем все proposals для этого адреса
  const proposals = await prisma.equipmentProposal.findMany({
    where: { addressId: address.id },
    include: {
      proposedBy: { select: { fullName: true } },
      objectEquipment: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Всего proposals: ${proposals.length}\n`);

  // Группируем по equipmentTypeCode
  const grouped = {};
  for (const p of proposals) {
    if (!grouped[p.equipmentTypeCode]) {
      grouped[p.equipmentTypeCode] = [];
    }
    grouped[p.equipmentTypeCode].push(p);
  }

  for (const [code, props] of Object.entries(grouped)) {
    console.log(`\n=== ${code} (${props.length} proposals) ===\n`);

    for (const p of props) {
      console.log('---');
      console.log('Proposal ID:', p.id);
      console.log('Status:', p.status);
      console.log('RequestType:', p.requestType);
      console.log('SN:', p.serialNumber);
      console.log('Brand:', p.brand);
      console.log('Model:', p.model);
      console.log('Room:', p.roomTypeCode);
      console.log('ObjectEquipment ID:', p.objectEquipmentId || 'нет');
      console.log('Предложил:', p.proposedBy?.fullName);
      console.log('Создано:', p.createdAt);
      console.log('Pending until:', p.pendingUntil);
    }
  }

  // Получаем все tasks для этого адреса
  console.log('\n\n=== ЗАДАЧИ ДЛЯ АДРЕСА ===\n');

  const tasks = await prisma.task.findMany({
    where: { visit: { addressId: address.id } },
    include: {
      visit: { select: { id: true, status: true } },
      equipmentType: true,
      objectEquipment: true,
      photos: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Всего задач: ${tasks.length}\n`);

  // Группируем по типу оборудования
  const tasksByType = {};
  for (const t of tasks) {
    const code = t.equipmentType?.code || 'unknown';
    if (!tasksByType[code]) {
      tasksByType[code] = [];
    }
    tasksByType[code].push(t);
  }

  for (const [code, typeTasks] of Object.entries(tasksByType)) {
    console.log(`\n--- ${code} (${typeTasks.length} задач) ---\n`);
    for (const t of typeTasks) {
      console.log('Task ID:', t.id);
      console.log('Visit:', t.visit.id, `(${t.visit.status})`);
      console.log('ObjectEquipment:', t.objectEquipment?.id || 'нет');
      console.log('Фото:', t.photos.length);
      for (const photo of t.photos) {
        console.log(`  - ${photo.fileName}`);
      }
      console.log('');
    }
  }

  await prisma.$disconnect();
}

diagnose().catch(console.error);
